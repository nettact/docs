# One-command deploy

Deploy NetTact's **server (server-lite)** and **agent** with Docker Compose.
The server ships with the web console built in; the agent is a pure outbound
client (it listens on no ports) that dials out to the server.

> Supported: Docker Engine 24+ with bundled Compose v2 (the `docker compose`
> subcommand). The old standalone `docker-compose` (v1) is untested.

For the full configuration reference, see:
[Server configuration](./server-config.md) · [Agent configuration](./agent-config.md).

---

## 1. One-command install script (Linux)

On a Linux host with nothing but Docker installed, a single command runs the
whole deployment — it downloads the compose assets, generates `.env` and the
secret, brings up the server, waits for it to become healthy, logs in
automatically and issues an enrollment token, brings up the agent and confirms
it enrolled, then prints the console URL and the first-run password:

```bash
curl -fsSL https://d.nettact.org/install.sh | bash
```

If you would rather read it before running it:

```bash
curl -fsSL https://d.nettact.org/install.sh -o install.sh
less install.sh
bash install.sh
```

Common options (`bash install.sh --help` lists them all):

| Option | What it does |
|---|---|
| `--port <n>` | Console port (written to `.env` as `NETTACT_HTTP_PORT`, default 12450) |
| `--lite-version` / `--agent-version <tag>` | Pin the image versions (default `latest`) |
| `--server-only` | Deploy the server only |
| `--host-network` | Have the agent monitor the host network (Linux; trade-offs in section 9) |
| `--auto-update` | Check daily for a new Agent image and restart the Agent automatically. |
| `-y` / `--yes` | Non-interactive (on a non-first run where the password cannot be retrieved automatically, it prints the manual fallback command instead) |

The script is **idempotent**: re-running it leaves an existing `.env`, secret and
data volumes untouched, so it is safe to re-run after a partial failure. Every
step that fails prints the reason plus the manual fallback command for it.

The source is owned by the `server-lite` repository at
[`deploy/install.sh`](https://github.com/nettact/server-lite/blob/main/deploy/install.sh).
From the NetTact superproject root, run
run `./deploy/install.sh`. The script uses local `docker-compose.yml` and
`.env.example` files when they exist in the current directory, otherwise it
downloads them from `https://d.nettact.org`. Set `NETTACT_DIST_BASE_URL` to
use an internal mirror.

The sections below are the **manual version** of that same flow, and also the
reference for understanding each step and for troubleshooting.

---

## 2. Quick start (Docker Compose)

Run this in the directory that contains `docker-compose.yml` and `.env.example`
(the repository root):

```bash
# 1) Prepare the configuration
cp .env.example .env
# Review .env as needed (port, image versions, ...); you do not need to set an
# admin password — one is generated automatically on first run

# 2) Start the server first
mkdir -p secrets
touch secrets/agent_enroll_token      # placeholder: this file must exist before the first `up`
docker compose up -d server

# 3) Read the auto-generated admin password from the logs (printed only once)
docker compose logs server            # look for username / password in the "NetTact first run" block

# 4) Open the console and log in
#    http://localhost:12450  (the port comes from NETTACT_HTTP_PORT in .env)
#    Log in with the credentials from the previous step, then change the password under Settings
#    (or run `docker compose exec server nettact-lite passwd -db /data/nettact.db`)

# 5) On the console's "Agent" page, issue a one-time enrollment token and write it to the secret file
printf '%s' '<paste the token generated in the console>' > secrets/agent_enroll_token

# 6) Start the agent (it enrolls itself and starts reporting)
docker compose up -d agent
```

When this finishes, the agent appears in the console's agent list and starts
reporting metrics, and the server can hand monitoring targets down to it.

Enrollment tokens are valid for 60 minutes by default and can be used only
once. After a successful enrollment the agent stores its credentials in its own
data volume, so restarts no longer need a token. Details in
[Agent configuration — enrollment flow](./agent-config.md#enrollment-flow-and-token-lifetime).

### About HTTPS and session cookies

By default (`-secure-cookie auto`) the session cookie carries the `Secure` flag
only when the server itself is running TLS, so a **plain-HTTP deployment lets
you log in out of the box**. For production we recommend either:

- configuring TLS on the server (see [Enabling HTTPS](#_7-enabling-https-optional) below), or
- putting a TLS-terminating reverse proxy in front (Caddy/Nginx/Traefik) and
  setting `NETTACT_SECURE_COOKIE=true` in `.env` (the browser side is https, so
  the cookie should carry `Secure`).

---

## 3. Checking status

```bash
docker compose ps                 # containers and health (server should be healthy)
docker compose logs -f server     # server logs
docker compose logs -f agent      # agent logs (enrollment, reporting)
curl -f http://localhost:12450/api/v1/healthz   # health check, returns {"status":"ok"}
```

The health check distinguishes "the process is up" from "the service is usable":
it actually requests `/api/v1/healthz`, so it will not turn healthy while DB
migrations or the listener are not ready, and `depends_on` makes the agent wait
until the server is healthy.

---

## 4. Upgrading

The server and the agent are **released independently**, so upgrading means
changing the matching version variable. **Back up before upgrading** (section 5).

```bash
# Back up nettact-data first (see the next section)
# Edit .env: set NETTACT_LITE_VERSION / NETTACT_AGENT_VERSION to the target versions
docker compose pull               # pull the new images
docker compose up -d              # recreate the containers on the new images; volumes are kept
docker compose ps                 # confirm it is healthy again
```

Data lives in named volumes, so configuration and history survive container
recreation and host reboots, and no second identity is created. If something
breaks after an upgrade, set the version variables in `.env` back to the old
version and run `pull && up -d` again; if the data schema has already changed,
restore from a backup (below).

---

## 5. Backup and restore

The persistent data you need to back up:

- volume `nettact-data` → the server's `nettact.db` (including the `-wal`/`-shm` sidecar files)
- volume `agent-data` → the agent's identity (`agent.key`), credentials (`agent.json`) and send buffer (`wal.db*`)

To get a consistent snapshot, **stop the service before backing it up** (this
avoids copying a half-written SQLite file):

```bash
# Back up the server data
docker compose stop server
docker compose cp server:/data ./backup-$(date +%F)      # or use the volume approach below
docker compose start server
```

You can also archive the named volume directly (the volume name is
`<project name>_nettact-data`; `docker volume ls` will show it):

```bash
docker compose stop server
docker run --rm \
  -v "$(basename "$PWD" | tr '[:upper:]' '[:lower:]')_nettact-data":/data \
  -v "$PWD":/backup alpine \
  tar czf /backup/nettact-data-$(date +%F).tar.gz -C /data .
docker compose start server
```

To restore: stop the service → extract the tar back into the volume → start the
service. The agent works the same way (volume `agent-data`; restoring it avoids
having to enroll again).

---

## 6. Uninstalling

```bash
# Stop and remove the containers but keep the data volumes (data is still there on the next `up`)
docker compose down

# Remove everything, including the data volumes (irreversible!)
docker compose down -v
```

---

## 7. Enabling HTTPS (optional)

The server can serve HTTPS/WSS natively. Once you have a certificate:

1. Create `certs/` in the project directory and put `tls.crt` and `tls.key` in it.
2. In the `server` service in `docker-compose.yml`, uncomment the
   `./certs:/certs:ro` mount and the `-tls-cert /certs/tls.crt -tls-key /certs/tls.key` lines.
3. **Also switch the healthcheck to its https variant** (the commented-out line
   is already in the compose file): with TLS enabled the listener is TLS-only, so
   a plaintext http health check can never pass, the server stays unhealthy
   forever, and the agent (`depends_on: service_healthy`) never starts.
4. `docker compose up -d server`. The console is now on `https://`, and the agent
   connects to `https://server:12450` (the certificate must match the internal
   compose hostname, or set `NETTACT_AGENT_TLS_INSECURE=true` as a stopgap).

`-tls-cert` and `-tls-key` must be supplied together, otherwise the server
refuses to start (so it can never silently fall back to plaintext).

---

## 8. Deploying a remote agent on another machine (optional)

The agent in the compose file only monitors the machine the server runs on. To
monitor other machines (another server, the NAS at home, a Windows PC at the
office), run a separate agent on that machine pointing at the server's
**externally reachable address**. Prerequisites:

1. that machine can reach the server (`http(s)://<server host>:<NETTACT_HTTP_PORT>`);
2. you have issued a fresh one-time enrollment token for it on the console's
   "Agent" page (one token per agent).

**Merged one-command Agent installer (Linux / macOS / Docker)**:

Native Linux or macOS:

```bash
curl -fsSL https://d.nettact.org/agent/install.sh | sudo bash -s -- \
  --server-url http://<server host>:12450 --token '<one-time token>'
```

Docker:

```bash
curl -fsSL https://d.nettact.org/agent/install.sh | bash -s -- --docker \
  --server-url http://<server host>:12450 --token '<one-time token>'
```

Append `--auto-update` to either command to enable daily Agent updates.

**Choose permissions while you are at it** (optional): add `--permissions` to fix
what this Agent may collect up front, instead of editing a config file and
restarting after the fact. The console's "Agent" page generates the whole command
for the preset you pick.

```bash
curl -fsSL https://d.nettact.org/agent/install.sh | sudo bash -s -- \
  --server-url http://<server host>:12450 --token '<one-time token>' \
  --permissions 'probe.icmp,probe.dns,probe.http,probe.tcp,host.cpu.read,host.memory.read'
```

Without the argument the Agent uses its built-in default set. Note that a list
**replaces** that set rather than adding to it — see the
[permission reference](./permissions.md) for the full list and per-platform
availability.

**The one-command Docker install monitors the host by default**: on a Linux
Docker host, `--docker` starts the container with `--network host --pid host
--cap-add NET_RAW --user 0:0` and bind-mounts the host's `/proc` and `/sys`
read-only, so what you see is the machine rather than the container. To monitor
the container itself, add `--container-view`.

Three caveats:

- This applies to the **one-command installer** only. The manual `docker run`
  below and the agent service in the compose file still default to the container's
  own view; add the same settings yourself (the compose file carries the full
  block, commented out).
- "Host" means the machine running the **Docker daemon**. Under Docker Desktop
  that is its Linux VM, not your Windows or macOS system — a Linux container has
  no way to observe the outer OS.
- **Disk metrics are the exception** and still describe the container's
  filesystem even in host view; see the
  [permission reference](./permissions.md#host-disk-read).

**Docker (Linux, manual)**:

```bash
docker run -d --name nettact-agent --restart unless-stopped \
  -e NETTACT_AGENT_SERVER_URL=http://<server host>:12450 \
  -e NETTACT_AGENT_ENROLL_TOKEN='<one-time token>' \
  -e NETTACT_AGENT_DATA_DIR=/agent-data \
  -v nettact-agent-data:/agent-data \
  ghcr.io/nettact/nettact-agent:latest
```

**Bare binary (Windows / Linux)**: download `nettact-agent` for your platform
from the agent repository's releases and write a YAML config file (see
`agent/agent.example.yaml`):

```yaml
# nettact-agent.yaml (next to the binary, or at the platform's conventional path; chmod 600 recommended)
server_url: http://<server host>:12450
enroll_token: "<one-time token>"
```

Then just start `nettact-agent` (it auto-discovers `nettact-agent.yaml` in the
working directory). The token is spent as soon as enrollment succeeds and can be
removed from the config file. For every configuration option (data directory,
permission policy, probe target access control, ...) see
[Agent configuration](./agent-config.md).

---

## 9. Letting the agent monitor the Docker host (optional, Linux)

By default the agent in the compose file sees the **container's own** interfaces
and metrics. To monitor the real network of the Docker host, enable
`network_mode: host` on the `agent` service in `docker-compose.yml` (adding
`pid: host` if needed).

**Note**: with `network_mode: host` the agent leaves the compose network, so the
service name `server` no longer resolves — you must also change
`NETTACT_AGENT_SERVER_URL` to an address reachable on the host, for example
`http://127.0.0.1:12450` (the port must match `NETTACT_HTTP_PORT` in `.env`).

This is a deliberate trade-off, not a requirement for the probes: the Linux
agent in this build only runs DNS/HTTP/TCP/NAT probes and host metrics, needs
**no `NET_RAW` and no privileges**, and the container runs as non-root.

---

## 10. Troubleshooting

- **The agent restarts in a loop / never enrolls**: usually
  `secrets/agent_enroll_token` is empty or the token has expired (60 minutes by
  default). Issue a new one in the console, write it to that file, and run
  `docker compose up -d agent`.
- **You get logged out immediately after logging in**: see
  [About HTTPS and session cookies](#about-https-and-session-cookies) in section 2 —
  switch to HTTPS or put a reverse proxy in front (and set `NETTACT_SECURE_COOKIE=true`).
- **The server stays unhealthy**: check `docker compose logs server` for DB
  migrations or a port conflict, and make sure nothing else is using
  `NETTACT_HTTP_PORT`.
- **Changes to .env have no effect**: `.env` is only read on `up`/`pull`, so run
  `docker compose up -d` to recreate the containers.
- **The console will not open even though the API works (placeholder page / 503)**:
  the server downloads its frontend from a GitHub release at runtime, so the
  first start needs internet access. If the download fails it serves a
  placeholder page and retries in the background; on an isolated network, point
  `NETTACT_WEBUI_BASE_URL` at a mirror (see
  [Server configuration](./server-config.md#the-web-console-frontend)).
