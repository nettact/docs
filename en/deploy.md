# One-command deploy

Deploy NetTact's **server** with Docker Compose. The server
provides the web console.

**The agent is not part of this compose file.** It is installed on each machine
you want monitored — including the one running the server — and joins with a
one-time token minted in the console; see [section 9](#_9-installing-an-agent-on-a-machine).
The agent is a pure outbound client (it listens on no ports) that dials out to
the server.

Installers, standalone binaries, checksums, and version history are distributed
through the [NetTact Download Center](https://d.nettact.org). A Cloudflare
Worker retrieves assets from official GitHub Releases, including private
repositories; deployments do not need GitHub credentials.

> Supported: Docker Engine 24+ with bundled Compose v2 (the `docker compose`
> subcommand). The old standalone `docker-compose` (v1) is untested.

For the full configuration reference, see:
[Server configuration](./server-config.md) · [Agent configuration](./agent-config.md).

---

## 1. One-command install script (Linux)

On a Linux host with nothing but Docker installed, a single command deploys the
server — it puts the compose assets in `~/nettact`, generates `.env`, brings the
server up, waits for it to become healthy, then prints the console URL and the
first-run password:

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
| `--server-version <tag>` | Pin the server image version (default `latest`) |

| Environment | What it does |
|---|---|
| `NETTACT_INSTALL_DIR` | Where to install (default: `~/nettact`) |
| `NETTACT_DIST_BASE_URL` | Where the compose assets are downloaded from (internal mirror) |

**The script installs the server only, never an agent.** Which machines are
monitored is a decision taken one machine at a time, and an agent has its own
installer and its own release cadence; bundling one in here made a local agent
look like part of the server rather than a choice someone made. Install agents
as in section 9 — on this machine too, if you want it monitored.

**The install directory is `~/nettact`, not the directory you ran the script
from.** The deployment outlives the shell that created it, so its compose file
and `.env` need one predictable home: not a git working tree that gets pulled
and rewritten underneath it, and not whichever directory someone happened to be
standing in. Every operational command runs from there afterwards:

```bash
cd ~/nettact && docker compose ps
```

Run from a NetTact checkout, the script **copies** that checkout's
`docker-compose.yml` and `.env.example` into the install directory and deploys
those; with no local copy it downloads them from `https://d.nettact.org`.

The script is **idempotent**: re-running it leaves an existing `.env` and the
data volume untouched, so it is safe to re-run after a partial failure. Every
step that fails prints the reason plus the manual fallback command for it.

> **An existing deployment in a different directory** stops the script rather
> than being installed over. Compose derives the project name from the
> directory, so a different directory is a different project — the old
> deployment's containers and, more to the point, its **data volume** are
> invisible from the new one, while its fixed container name is still taken.
> Take one of the exits the script prints: install in place with
> `NETTACT_INSTALL_DIR=<old dir>`, or `docker compose down` in the old directory
> first (the old database is not carried over).

The source is owned by the `server` repository at
[`deploy/install.sh`](https://github.com/nettact/server/blob/main/deploy/install.sh).

The sections below are the **manual version** of that same flow, and also the
reference for understanding each step and for troubleshooting.

---

## 2. Quick start (Docker Compose)

Put `docker-compose.yml` and `.env.example` in a fixed directory (`~/nettact`
below, which is what the one-command script uses), then:

```bash
mkdir -p ~/nettact && cd ~/nettact
# copy them from a checkout, or:
#   curl -fsSLO https://d.nettact.org/docker-compose.yml
#   curl -fsSLO https://d.nettact.org/.env.example

# 1) Prepare the configuration
cp .env.example .env
# Review .env as needed (port, image version, ...); you do not need to set an
# admin password — one is generated automatically on first run

# 2) Start the server
docker compose up -d server

# 3) Read the auto-generated admin password from the logs (printed only once)
docker compose logs server            # look for username / password in the "NetTact first run" block

# 4) Open the console and log in
#    http://localhost:12450  (the port comes from NETTACT_HTTP_PORT in .env)
#    Log in with the credentials from the previous step, then change the password under Settings
#    (or run `docker compose exec server nettact-server passwd -db /data/nettact.db`)
```

The server is now up — and **nothing is being monitored yet**. The next step is
to mint a one-time enrollment token on the console's "Agent" page and install an
agent on the machines you care about, as described in
[section 9](#_9-installing-an-agent-on-a-machine).

Enrollment tokens are valid for 24 hours and can be used only
once. After a successful enrollment the agent stores its credentials in its own
data volume, so restarts no longer need a token. Details in
[Agent configuration — enrollment flow](./agent-config.md#enrollment-flow-and-token-lifetime).

### About HTTPS and session cookies

By default (`-secure-cookie auto`) the session cookie carries the `Secure` flag
only when the server itself is running TLS, so a **plain-HTTP deployment lets
you log in out of the box**. For production we recommend either:

- configuring TLS on the server (see [Enabling HTTPS](#_8-enabling-https-optional) below), or
- putting a TLS-terminating reverse proxy in front (Caddy/Nginx/Traefik) and
  setting `NETTACT_SECURE_COOKIE=true` in `.env` (the browser side is https, so
  the cookie should carry `Secure`).

---

## 3. Checking status

From the install directory (`~/nettact`):

```bash
docker compose ps                 # containers and health (server should be healthy)
docker compose logs -f server     # server logs
curl -f http://localhost:12450/api/v1/healthz   # health check, returns {"status":"ok"}
```

The health check distinguishes "the process is up" from "the service is usable":
it actually requests `/api/v1/healthz`, so it will not turn healthy while DB
migrations or the listener are not ready.

Agent logs live on the agent's own machine — see
[section 9](#_9-installing-an-agent-on-a-machine).

---

## 4. Automatic updates (on by default)

`install.sh` attaches a **Watchtower sidecar container** (`nettact-server-updater`)
by default. It `pull`s a new image and recreates the server container nightly at
a **random moment in the early-morning window (02:00–05:00)**, baked into
`NETTACT_UPDATE_CRON` on first install (host-local time), so no manual step is
needed. To turn it off, either:

- re-run the installer: `install.sh --no-auto-update` (removes
  `COMPOSE_PROFILES=updater` from `.env` and stops a running sidecar); or
- edit by hand: delete the `COMPOSE_PROFILES=updater` line from `.env`, then
  `docker compose up -d --remove-orphans` to stop the sidecar.

The switch is `COMPOSE_PROFILES=updater` in `.env`: as long as that line is
present, a manual `docker compose up -d` also starts the sidecar; removing it
takes the sidecar out of the configuration. Note that `NETTACT_AUTO_UPDATE` is
**not** the switch — it only tells the server "a sidecar manages this install"
so the console's software-update panel picks the right wording; setting it to
`false` without deleting `COMPOSE_PROFILES=updater` leaves the sidecar running.

**Permissions and risk**: `nettact-server-updater` mounts the host's Docker
socket (`/var/run/docker.sock`), which is root-equivalent on this host — that is
how Watchtower reads the registry and recreates containers, and also why the
default-on sidecar is something you should know about. Disable it as above if
you do not want it.

**Auto-updates can cross a schema migration**: the server runs DB migrations on
startup with **no downgrade path**, so automatic updates hand the "when to
migrate" decision to the machine. Back up before the sidecar runs (section 6),
and restore from that backup if an upgrade goes wrong.

---

## 5. Upgrading (manual)

The server and the agent are **released independently**, so upgrading means
changing the matching version variable. **Back up before upgrading** (section 6).

> This is the manual upgrade flow. Instances with auto-update enabled do not
> need it — the sidecar does it for you; to stay fully manual, disable
> auto-update as in the previous section.

```bash
cd ~/nettact
# Back up nettact-data first (see the next section)
# Edit .env: set NETTACT_SERVER_VERSION to the target version
docker compose pull               # pull the new image
docker compose up -d              # recreate the container on the new image; volumes are kept
docker compose ps                 # confirm it is healthy again
```

Data lives in named volumes, so configuration and history survive container
recreation and host reboots, and no second identity is created. If something
breaks after an upgrade, set the version variables in `.env` back to the old
version and run `pull && up -d` again; if the data schema has already changed,
restore from a backup (below).

---

## 6. Backup and restore

The persistent data you need to back up:

- volume `nettact-data` → the server's `nettact.db` (including the `-wal`/`-shm`
  sidecar files). This is the **only** thing worth backing up carefully:
  monitors, metric history, alert rules and accounts all live in it.
- on each agent machine, volume `nettact-agent-data` → that agent's identity
  (`agent.key`), credentials (`agent.json`) and send buffer (`wal/`). Losing
  it is survivable: reinstall the agent with a fresh token and it enrolls again,
  at the cost of a stale entry to delete in the console.

To get a consistent snapshot, **stop the service before backing it up** (this
avoids copying a half-written SQLite file):

```bash
# Back up the server data
docker compose stop server
docker compose cp server:/data ./backup-$(date +%F)      # or use the volume approach below
docker compose start server
```

You can also archive the named volume directly. The volume name carries the
compose project name, which comes from the directory name — installed in
`~/nettact` that makes it `nettact_nettact-data`; `docker volume ls` will show
it either way:

```bash
cd ~/nettact
docker compose stop server
docker run --rm \
  -v "$(basename "$PWD" | tr '[:upper:]' '[:lower:]')_nettact-data":/data \
  -v "$PWD":/backup alpine \
  tar czf /backup/nettact-data-$(date +%F).tar.gz -C /data .
docker compose start server
```

To restore: stop the service → extract the tar back into the volume → start the
service. An agent works the same way, except that its volume name is always
`nettact-agent-data` with no project prefix; restoring it avoids having to
enroll again.

---

## 7. Uninstalling

```bash
cd ~/nettact

# Stop and remove the containers but keep the data volumes (data is still there on the next `up`)
docker compose down

# Remove everything, including the data volumes (irreversible!)
docker compose down -v
```

Each agent is uninstalled on its own machine: `cd ~/nettact-agent && docker
compose down -v`, or the native uninstall steps in
[Agent configuration](./agent-config.md). Delete the agent's entry in the
console afterwards.

---

## 8. Enabling HTTPS (optional)

The server can serve HTTPS/WSS natively. Once you have a certificate:

1. Create `certs/` in the project directory and put `tls.crt` and `tls.key` in it.
2. In the `server` service in `docker-compose.yml`, uncomment the
   `./certs:/certs:ro` mount and the `-tls-cert /certs/tls.crt -tls-key /certs/tls.key` lines.
3. **Also switch the healthcheck to its https variant** (the commented-out line
   is already in the compose file): with TLS enabled the listener is TLS-only, so
   a plaintext http health check can never pass and the server stays unhealthy
   forever.
4. `docker compose up -d server`. The console is now on `https://`, and every
   agent's `--server-url` has to change to `https://<server host>:12450` to match
   (the certificate must be one the agents can verify, or set
   `NETTACT_AGENT_TLS_INSECURE=true` as a stopgap).

`-tls-cert` and `-tls-key` must be supplied together, otherwise the server
refuses to start (so it can never silently fall back to plaintext).

---

## 9. Installing an agent on a machine

An agent goes on **every machine you want monitored**: the one running the
server, another server, the NAS at home, a Windows PC at the office. It points
at an address of the server that machine can reach, and needs no inbound port of
its own. Prerequisites:

1. the machine can reach the server (`http(s)://<server host>:<NETTACT_HTTP_PORT>`);
2. a one-time enrollment token minted for it on the console's "Agent" page
   (**one token per agent**).

One installer covers all three shapes (native Linux / macOS, and Docker). A
**router** takes a different one — see [OpenWrt router installation](./openwrt.md),
where the agent ships as two opkg packages that download the matching binary on
first start, plus a LuCI page to configure it.

Native Linux or macOS (a systemd / launchd service; needs root):

```bash
curl -fsSL https://d.nettact.org/agent/install.sh | sudo bash -s -- \
  --server-url http://<server host>:12450 --token '<one-time token>'
```

Docker:

```bash
curl -fsSL https://d.nettact.org/agent/install.sh | bash -s -- --docker \
  --server-url http://<server host>:12450 --token '<one-time token>'
```

Append `--auto-update` to either command for daily automatic agent updates.

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

### What the Docker install produces

`--docker` writes the deployment into **`~/nettact-agent`** (override with
`NETTACT_AGENT_INSTALL_DIR`) and brings it up with compose:

| File | Contents |
|---|---|
| `docker-compose.yml` | The container definition. Host view and container view are **two different containers**, which is why this file is generated at install time rather than shipped as a template with switches |
| `.env` | Three knobs — image, version, `server_url`; edit and re-apply with `docker compose up -d` |
| `enroll.token` | The one-time enrollment token, mounted read-only. It is read only while the data volume holds no credential yet, so a spent token can stay there harmlessly |

Everything afterwards is ordinary compose, with no `docker run` line to
reconstruct:

```bash
cd ~/nettact-agent
docker compose ps
docker compose logs -f
docker compose pull && docker compose up -d     # upgrade
docker compose down                             # uninstall (add -v to drop the identity too)
```

The directory itself is `0700` — that is what keeps the token private. The token
file is deliberately `0644`: the container runs as a non-root user (uid 100) and
reads the file through a bind mount, which does not have to walk the host
directory, so locking the directory keeps the secret without leaving the agent
restart-looping on an unreadable token.

> Requires Docker Compose v2 (the `docker compose` subcommand). Debian's
> `docker.io` package does not ship it — install `docker-compose-plugin`. The
> installer checks first and prints exactly this.

**The Docker install monitors the host by default**: on a Linux Docker host the
generated compose file carries `network_mode: host`, `pid: host`,
`user: "0:0"` and `cap_add: [NET_RAW]`, and bind-mounts the host's `/proc` and
`/sys` read-only, so what you see is the machine rather than the container. To
monitor the container itself, add `--container-view`; the difference is
[section 10](#_10-host-view-vs-container-view-docker-installs).

**Bare binary (Windows / Linux)**: download the latest build for your platform
from the download center, or select an older version on the
[download center home page](https://d.nettact.org):

- [Windows x64](https://d.nettact.org/agent/nettact-agent-windows-amd64.exe)
- [Linux x64](https://d.nettact.org/agent/nettact-agent-linux-amd64)
- [Linux ARM64](https://d.nettact.org/agent/nettact-agent-linux-arm64)
- [SHA256 checksums](https://d.nettact.org/agent/SHA256SUMS)

Then write a YAML config file (see `agent/agent.example.yaml`):

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

One machine can also report to **several servers at once**, each with its own
enrollment token and its own permission grant — replace `server_url` with a
`servers:` list, as described in
[Reporting to more than one server](./agent-config.md#reporting-to-more-than-one-server).
Every install above starts out single-server, and how you add the second one
depends on which one you used:

- **Native install** (`install.sh` without `--docker`): edit the config file the
  installer wrote — `/etc/nettact/agent.yaml` on Linux,
  `/Library/Application Support/NetTact/agent.yaml` on macOS — replacing its
  `server_url:` and `enroll_token_file:` keys with a `servers:` list, then
  restart the service.
- **Bare binary**: edit the YAML file shown above the same way.
- **Docker**: the generated deployment mounts no config file, and the two
  environment variables it does set collide with a `servers:` list. It takes a
  compose edit — see
  [Adding a second server to a Docker install](#adding-a-second-server-to-a-docker-install).

### Adding a second server to a Docker install

The generated deployment has no YAML config file: the server address and the
token reach the agent as `NETTACT_AGENT_SERVER_URL` and
`NETTACT_AGENT_ENROLL_TOKEN_FILE` in the compose file's `environment:` block.
Those two are
[mutually exclusive with `servers:`](./agent-config.md#servers-replaces-the-single-server-keys),
**including when they arrive as environment variables** — leaving them in place
while a mounted config file declares a list is a startup error, not a merge:

```
`servers:` and NETTACT_AGENT_SERVER_URL are mutually exclusive; put the setting inside the servers entry
```

So the second server is added by editing `docker-compose.yml` itself, in
`~/nettact-agent`:

1. Write `~/nettact-agent/agent.yaml` with one entry per server. Name the first
   entry `default` — that is the name the single-server form uses, so the
   credential and the queued backlog it already holds survive instead of
   re-enrolling:

   ```yaml
   servers:
     - name: default
       url: http://<first server host>:12450
       enroll_token_file: /run/secrets/agent_enroll_token
     - name: work
       url: https://nettact.corp.example:12450
       enroll_token_file: /run/secrets/work_enroll_token
       permissions:            # this server gets these and nothing else
         - probe.icmp
         - probe.dns
   ```

2. Put the second server's one-time token in `~/nettact-agent/work.token`.
   Both new files want `chmod 644`, for exactly the reason `enroll.token` is
   `0644`: the container reads them as a non-root user, and the `0700` directory
   is what keeps them private.

3. In `docker-compose.yml`, **delete** these two lines from the agent service's
   `environment:` block …

   ```yaml
         NETTACT_AGENT_SERVER_URL: ${NETTACT_AGENT_SERVER_URL}
         NETTACT_AGENT_ENROLL_TOKEN_FILE: /run/secrets/agent_enroll_token
   ```

   … and add the two files to that service's `volumes:`, beside the mounts that
   are already there:

   ```yaml
         - ./agent.yaml:/etc/nettact/agent.yaml:ro
         - ./work.token:/run/secrets/work_enroll_token:ro
   ```

   Everything else in `environment:` stays. Only the four server-scoped settings
   (`server_url`, `enroll_token`, `enroll_token_file`, `tls_insecure`) collide
   with a list — `NETTACT_AGENT_DATA_DIR` is unaffected, and a
   `NETTACT_AGENT_PERMISSIONS` line, if `--permissions` put one there, keeps
   working as the default grant for any entry that names no `permissions` of its
   own.

4. `docker compose up -d`. `/etc/nettact/agent.yaml` is one of the paths the
   agent auto-discovers, so no extra variable is needed; the startup log line
   `using config file /etc/nettact/agent.yaml` confirms it was picked up.

The `NETTACT_AGENT_SERVER_URL` line in `.env` goes inert once the `environment:`
entry referencing it is gone: compose reads `.env` only to expand `${...}` inside
the compose file, and the generated file has no `env_file:`.

> **Do not re-run the installer afterwards.** A full `install.sh --docker` run
> regenerates `docker-compose.yml` from scratch — discarding these edits — and
> removes the `nettact-agent-data` volume, so the agent would try to enroll at
> every server again with tokens that are already spent. From here on, change the
> deployment by editing these files and running `docker compose up -d`, which is
> what the header comment in the generated file tells you.

### Checking that the agent is connected

An agent that cannot reach the server keeps running and keeps retrying, so a
service that is "active" is not evidence that anything is being reported. The
agent says which it is on every attempt:

```
[default] connected to https://nettact.example.com (agent 3f2a9c1e)
[default] session ended (tls_cert_expired): dial: … x509: certificate has expired …; reconnecting in 32.1s (pending 247)
```

Where to read that depends on how you installed it:

```bash
journalctl -u nettact-agent -f                        # Linux, native install
tail -f /var/log/nettact-agent.log                    # macOS, native install
cd ~/nettact-agent && docker compose logs -f          # Docker
```

The word in parentheses is a stable reason code — `tls_cert_expired`, `dns`,
`refused`, `auth` and a dozen others, each with the usual fix, are tabled under
[Watching the connection](./agent-config.md#watching-the-connection).

On a Windows scheduled-task install the output is discarded, so there is nothing
to tail. Set [`status_file`](./agent-config.md#the-status-file) instead and read
the JSON it writes; that is also the option to use anywhere else a machine has to
report its own state without a person watching a log.

---


## 10. Host view vs container view (Docker installs)

An agent inside a container sees, by default, the **container's own** interfaces,
processes and filesystem. That is almost never what you meant to monitor, so
`--docker` gives you the host view — and it does so as one unit of four
settings, because enabling only some of them produces data that looks right and
is not (host interfaces beside container processes, or host metrics beside the
container's own default gateway):

| Setting | What it buys |
|---|---|
| `network_mode: host` | The host's interfaces, routes, neighbor table and default gateway |
| `pid: host` | The host's process list |
| `HOST_PROC` / `HOST_SYS` + read-only mounts | Host resource metrics, and where the agent itself reads routes and resolvers |
| `user: "0:0"` + `cap_add: [NET_RAW]` | The raw ICMP socket that **path diagnostics** need |

Things worth knowing:

- **"Host" means the machine running the Docker daemon.** Under Docker Desktop
  that is its Linux VM, not your Windows or macOS system — a Linux container has
  no way to observe the outer OS. The installer detects a non-Linux daemon,
  falls back to the container view, and says so.
- **Disk metrics are the exception** and still describe the container's
  filesystem even in host view; see the
  [permission reference](./permissions.md#host-disk-read).
- **The container view (`--container-view`) stays non-root**, so it gets no raw
  socket and therefore **no path diagnostics** — but ICMP and gateway probing
  still work there. Those need only an unprivileged ping socket, which the
  generated compose file opens with
  `sysctls: net.ipv4.ping_group_range: "0 2147483647"`. **That line is not
  optional**: the kernel gives every new network namespace `1 0` — an empty
  range, no gid may ping — and dockerd does not change it. If the runtime
  refuses the sysctl (gVisor and friends), the installer retries without it and
  states plainly that ICMP and gateway probing will be reported as unsupported.

---

## 11. Troubleshooting

- **An agent never shows up in the console / its container restarts in a loop**:
  the installer already waits for enrollment and for the process to stay up, and
  on failure it prints the agent's log, removes the container and tells you why.
  After the fact: `cd ~/nettact-agent && docker compose logs -f`. The usual cause
  is an expired (24 hours) or already-used token — mint a fresh one
  in the console and re-run the install command.
- **`NETTACT_AGENT_ENROLL_TOKEN_FILE: open ...: permission denied`**: the token
  file is not readable by the non-root user inside the container. Run
  `chmod 644 ~/nettact-agent/enroll.token && chmod 700 ~/nettact-agent` (the
  reasoning is in section 9). The container picks it up on its next restart; no
  re-enrollment is needed as long as the token has not expired.
- **ICMP or gateway probing shows as "blocked"**: in the container view this is
  usually the ping socket. If
  `docker exec nettact-agent cat /proc/sys/net/ipv4/ping_group_range` prints
  `1 0`, the compose file is missing its `sysctls` block (see
  [section 10](#_10-host-view-vs-container-view-docker-installs)). Path
  diagnostics need the host view by design. Details in the
  [permission reference](./permissions.md).
- **You get logged out immediately after logging in**: see
  [About HTTPS and session cookies](#about-https-and-session-cookies) in section 2 —
  switch to HTTPS or put a reverse proxy in front (and set `NETTACT_SECURE_COOKIE=true`).
- **The server stays unhealthy**: check `docker compose logs server` for DB
  migrations or a port conflict, and make sure nothing else is using
  `NETTACT_HTTP_PORT`.
- **Changes to .env have no effect**: `.env` is only read on `up`/`pull`, so run
  `docker compose up -d` to recreate the containers.
- **The console will not open even though the API works (placeholder page / 503)**:
  on its first start, the server downloads its frontend from
  `https://d.nettact.org`. If the download fails it serves a placeholder page
  and retries in the background. Confirm that the server can reach the download
  center; on an isolated network, point `NETTACT_WEBUI_BASE_URL` at a compatible
  source (see
  [Server configuration](./server-config.md#the-web-console-frontend)).
