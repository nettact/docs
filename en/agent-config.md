# Agent configuration (nettact-agent)

`nettact-agent` is a purely outbound monitoring client: it listens on no ports
and dials out to the server to report telemetry and receive monitoring targets.
**The recommended way to configure it is a single YAML file**; every option also
has a one-to-one `NETTACT_AGENT_*` environment variable (for containers and
similar environments). The only command-line argument is `--config` (which
selects the config file); `--help` and `--version` are also available.

**Precedence, highest to lowest: config file > environment variable > built-in
default.** When an option is set in both places, the file wins; options the file
does not mention fall back to the environment variable. Any configuration change
requires an **agent restart** to take effect (hot reload is not supported).

This page matches `nettact-agent --help` item for item; if the two disagree,
`--help` wins — please report the discrepancy.

---

## The config file (YAML)

The minimum configuration is a single `server_url` (plus an enrollment token on
the first run):

```yaml
# nettact-agent.yaml — mode 600 recommended (the file may contain an enrollment token)
server_url: http://<server host>:12450
enroll_token_file: /run/secrets/agent_enroll_token   # for the first run; or inline it with enroll_token
```

The full annotated template is [`agent.example.yaml`](https://github.com/nettact/agent/blob/main/agent.example.yaml)
in the agent repository.

### How the config file is located (first hit wins)

1. the `--config <path>` command-line argument;
2. the `NETTACT_AGENT_CONFIG_FILE` environment variable;
3. `./nettact-agent.yaml` in the working directory;
4. the platform's conventional path: `%ProgramData%\NetTact\agent.yaml` on
   Windows, `/etc/nettact/agent.yaml` elsewhere (the Docker image uses the same
   path — mount your file there and it runs with zero environment variables).

The rules:

- A file **specified explicitly** through `--config` or
  `NETTACT_AGENT_CONFIG_FILE` that does not exist or cannot be read → startup
  fails. **Specified explicitly but empty** (`--config=`, `--config ""`, or the
  environment variable set to blank) also fails — naming a configuration source
  and then leaving it empty is almost always a deployment mistake.
- Paths **discovered automatically** in steps 3 and 4 are skipped silently when
  missing, and the agent runs from environment variables alone.
- Syntax errors, unknown keys and invalid values all fail at startup, reporting
  the file name plus the line number / key name; error messages identify the
  option by its `NETTACT_AGENT_*` variable name (validation is shared verbatim
  with the environment-variable path).
- Omitting a key = use its default; **explicitly writing an empty value (`""`) is
  rejected** — if you do not want to set it, delete the key.

---

## Option reference

YAML keys and environment variables correspond one to one, with identical
values, defaults and ranges.

### Server connection

| YAML key | Environment variable | Default | Description |
|---|---|---|---|
| `server_url` | `NETTACT_AGENT_SERVER_URL` | — (**required**) | Server base URL, `http(s)://host:port`, e.g. `http://host:12450`. |
| `data_dir` | `NETTACT_AGENT_DATA_DIR` | `./agent-data` | The agent's state directory: identity key `agent.key`, enrollment credentials `agent.json`, send buffer `wal.db*`. Backing up or migrating an agent means backing up this directory. |
| `tls_insecure` | `NETTACT_AGENT_TLS_INSECURE` | `false` | Skip TLS certificate verification — only for a self-signed server on your own LAN. |
| `upload_interval` | `NETTACT_AGENT_UPLOAD_INTERVAL` | `5s` | Upload cadence: how often buffered telemetry is uploaded in a batch. |
| `wire_format` | `NETTACT_AGENT_WIRE_FORMAT` | `protobuf` | Telemetry wire format: `protobuf` or `json`. |

### Enrollment (first run; the two options are mutually exclusive)

| YAML key | Environment variable | Default | Description |
|---|---|---|---|
| `enroll_token` | `NETTACT_AGENT_ENROLL_TOKEN` | empty | The one-time enrollment token, inline. |
| `enroll_token_file` | `NETTACT_AGENT_ENROLL_TOKEN_FILE` | empty | Path to a file holding the token (**recommended**, pairs with a mounted secret). |

### Local permission policy

| YAML key | Environment variable | Default | Description |
|---|---|---|---|
| `permissions` | `NETTACT_AGENT_PERMISSIONS` | built-in default set | The permission list (a YAML list, or comma-separated in the environment variable), or the literal `none`. **Replaces the set wholesale** — see [Permission policy](#permission-policy). |

### Probe target access control

| YAML key | Environment variable | Default | Description |
|---|---|---|---|
| `probe_access.mode` | `NETTACT_AGENT_PROBE_ACCESS_MODE` | see below | `allowlist` or `denylist`. |
| `probe_access.allowlist` | `NETTACT_AGENT_PROBE_ALLOWLIST` | see below | A list of selectors (CSV in the environment variable). |
| `probe_access.denylist` | `NETTACT_AGENT_PROBE_DENYLIST` | see below | A list of selectors, or the literal `none` (deny nothing). |

See [Probe target access control](#probe-target-access-control-1) for details.

### Stability limits

| YAML key | Environment variable | Default | Range | Description |
|---|---|---|---|---|
| `min_probe_interval` | `NETTACT_AGENT_MIN_PROBE_INTERVAL` | `1s` | `[200ms, 10m]` | Minimum interval between two probes of the same monitor (a shorter interval pushed down by the server is clamped to this). |
| `max_probe_concurrency` | `NETTACT_AGENT_MAX_PROBE_CONCURRENCY` | `16` | `[1, 256]` | Maximum number of probes running at once. |
| `snapshot_min_interval` | `NETTACT_AGENT_SNAPSHOT_MIN_INTERVAL` | `3s` | `[1s, 10m]` | Minimum interval between interface snapshots taken for incident forensics. |
| `snapshot_timeout` | `NETTACT_AGENT_SNAPSHOT_TIMEOUT` | `10s` | `[1s, 60s]` | Timeout for a single snapshot. |
| `max_trace_concurrency` | `NETTACT_AGENT_MAX_TRACE_CONCURRENCY` | `4` | `[1, 64]` | Maximum number of incident traceroutes running at once. |

---

## Enrollment flow and token lifetime

Trust between an agent and the server is established exactly once:

1. an administrator issues a **one-time enrollment token** on the console's
   "**Agent**" page (with an optional note and lifetime, **60 minutes** by
   default);
2. on its first start, the agent presents the token to the server's enrollment
   endpoint and exchanges it for long-lived credentials, which are stored in
   `data_dir` alongside the machine's ed25519 identity key (`agent.json` /
   `agent.key`);
3. every later start reuses the stored credentials and **never reads the token
   configuration again** — the token is spent, so you can delete it from the
   config; issuing new tokens does not affect already-enrolled agents.

Key points:

- One token enrolls exactly **one** agent; issue a separate token per machine.
- An expired or already-used token shows up as the agent failing to enroll and
  retrying in a loop — issue a new one, update the config, and restart.
- Prefer `enroll_token_file` (a mounted file/secret) so the token never enters
  the process environment or shell history; setting both keys fails at startup.
- To make an agent "enroll again" (when relocating a site, say): clear its
  `data_dir` and start it with a new token — a new agent identity appears on the
  server side.

---

## Permission policy

What an agent may collect, and which kinds of probe it may run, is decided by a
**local** permission policy — the server can only hand down tasks within what the
agent grants. Permissions are immutable within the process; changing them
requires a restart.

- **`permissions` not set**: the built-in default set is used (below), which suits
  standard monitoring.
- **`permissions` set**: it **replaces the default set wholesale**, rather than
  adding to or subtracting from it. You get exactly what you wrote (and a child
  permission is automatically inert if the parent it depends on is missing).
- **`permissions: none`**: grant nothing, keeping only the minimum needed to stay
  running.
- **Wildcards are never supported** (`*` / `all` are rejected).

The built-in default set (standard probes plus basic network-state reads):

```
probe.icmp  probe.dns  probe.http  probe.tcp  probe.nat
network.gateway.probe
network.interface.status.read  network.interface.address.read
network.wifi.status.read
diagnostic.traceroute.icmp  diagnostic.traceroute.tcp
```

Capabilities **not** in the default set have to be granted explicitly. The main
ones are: `probe.http.extended` (HTTP probes with custom methods/headers/bodies),
`network.wifi.ssid.read`, `network.neighbor.read` /
`network.neighbor.hostname.read` (neighbour/device discovery) and `host.*`
(host metrics such as CPU/memory/disk plus process and connection snapshots —
broken down as `host.cpu.read`, `host.process.basic.read` and so on).

**The complete list of permission IDs, what each one does, its platform
availability, and how to choose permissions at enrollment are in the
[permission reference](./permissions.md).** The console's agent detail page shows
the same three layers side by side (granted / supported / effective) and hands
you a ready-to-copy configuration line.

---

## Probe target access control

A second gate, independent of permissions: it decides **which targets probes may
reach** (deny always beats allow).

Selectors come in four forms:

| Selector | Meaning | Example |
|---|---|---|
| `scope:<name>` | Address class: `loopback` / `lan` / `link-local` / `public` / `metadata` / `any` | `scope:lan` |
| `cidr:<prefix>` | A CIDR range | `cidr:10.0.0.0/8` |
| `ip:<address>` | A single IP | `ip:192.168.1.1` |
| `host:<domain>` | A hostname | `host:example.com` |

Two modes:

- `allowlist` (deny by default): only targets matching the allowlist are allowed;
  the allowlist may not be empty.
- `denylist` (allow by default): only targets matching the denylist are denied;
  the denylist must be non-empty, or the literal `none` to deny nothing.

**The default policy** (when `probe_access` is not set): allowlist mode allowing
`scope:lan` and `scope:public`, while always denying `scope:loopback`,
`scope:link-local` and `scope:metadata` (cloud metadata addresses such as
169.254.169.254). That is: out of the box you can probe LAN and public targets,
but not the agent's own loopback or cloud metadata endpoints.

An example — allow only the two subnets at this site, and strictly nothing else:

```yaml
probe_access:
  mode: allowlist
  allowlist:
    - cidr:192.168.1.0/24
    - cidr:10.10.0.0/16
```

---

## Per-platform capabilities

The same configuration can produce different **effective permissions** on
different platforms: effective = granted ∩ supported by the platform
(unsupported entries are trimmed silently, not treated as errors). The console's
agent detail page shows all three layers. Note that "supported" includes
**runtime privilege** — the same binary run as root and as an ordinary user can
support different permissions.

- **Windows (bare binary)**: the most complete. ICMP probes and ICMP path
  diagnostics go through the system `IcmpSendEcho`, so **no administrator
  privileges are needed**; interface, gateway, DNS and Wi-Fi state go through
  system APIs. Only TCP path diagnostics needs Administrator (the scheduled task
  the installer registers runs as SYSTEM, which satisfies it).
- **Linux (bare binary)**: broadly at parity with Windows — ICMP probing, gateway
  probing, neighbour discovery and both traceroute modes are implemented. The
  ICMP capabilities need `CAP_NET_RAW`: the systemd service the installer writes
  runs as root and has everything, while an unprivileged process still gets ICMP
  probing if the kernel's `net.ipv4.ping_group_range` covers its gid, but not path
  diagnostics. Neighbour discovery uses netlink and needs no privilege at all.
- **macOS (bare binary)**: standard probes (DNS/HTTP/TCP/NAT), interface and Wi-Fi
  state, host metrics, and process/connection snapshots work; ICMP probing,
  gateway probing, neighbour discovery and path diagnostics are **not implemented
  yet**.
- **Docker (official agent image)**: the image is a Linux build, so its
  capabilities match Linux. The binary carries the `cap_net_raw` file capability,
  which only takes effect when the container is started with `--cap-add NET_RAW`.
  **It monitors the Docker host by default**: the installer's `--docker` mode adds
  `--network host --pid host` and bind-mounts the host's `/proc` and `/sys`
  read-only. To monitor the container itself instead, pass `--container-view`
  (see [the deployment guide](./deploy.md#_9-letting-the-agent-monitor-the-docker-host-optional-linux)).

For the per-permission breakdown, see the
[permission reference](./permissions.md#platform-support).
