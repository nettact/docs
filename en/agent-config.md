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
in the agent repository. One agent can also report to **several servers at
once**, each with its own permission grant — see
[Reporting to more than one server](#reporting-to-more-than-one-server).

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
| `server_url` | `NETTACT_AGENT_SERVER_URL` | — (**required**) | Server base URL, `http(s)://host:port`, e.g. `http://host:12450`. Required unless a [`servers:`](#reporting-to-more-than-one-server) list is used instead. |
| `data_dir` | `NETTACT_AGENT_DATA_DIR` | `./agent-data` | The agent's state directory: identity key `agent.key`, enrollment credentials `agent.json` (one entry per server), and the send buffer in `wal/`. Backing up or migrating an agent means backing up this directory. |
| `tls_insecure` | `NETTACT_AGENT_TLS_INSECURE` | `false` | Skip TLS certificate verification — only for a self-signed server on your own LAN. |
| `upload_interval` | `NETTACT_AGENT_UPLOAD_INTERVAL` | `30s` | Upload cadence: how often buffered telemetry is uploaded in a batch. Lower values make dashboards fresher at the cost of roughly linearly more server disk writes. |
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

## Reporting to more than one server

One agent can report to several servers at the same time — a home server and an
employer's, say — and **each of them gets its own permission grant**. Replace
`server_url` with a `servers:` list:

```yaml
servers:
  - name: home
    url: http://192.168.1.10:12450
    enroll_token_file: /run/secrets/home_enroll_token
  - name: work
    url: https://nettact.corp.example:12450
    enroll_token_file: /run/secrets/work_enroll_token
    permissions:            # this server gets these and nothing else
      - probe.icmp
      - probe.dns
```

`servers:` is the one setting that exists **only in the config file**. Every
other option is one key, one environment variable, one string; a list of records
does not fit that model, so there is no `NETTACT_AGENT_SERVERS`.

### Entry options

| Key | Default | Description |
|---|---|---|
| `name` | — (**required**) | A unique label for this server, at most 64 characters of lowercase letters, digits, `-` and `_`. See [Names are identity](#names-are-identity). |
| `url` | — (**required**) | That server's base URL, `http(s)://host:port`. |
| `enroll_token` | empty | The one-time enrollment token **for this server**, inline. |
| `enroll_token_file` | empty | Path to a file holding it (**recommended**). Mutually exclusive with `enroll_token` inside the same entry. |
| `tls_insecure` | `false` | Skip TLS certificate verification for this server only. |
| `permissions` | the top-level `permissions` | **Replaces** the top-level grant for this server. Same syntax and the same wholesale-replacement rule; `none` grants nothing. |
| `probe_access` | the top-level `probe_access` | **Narrows** the top-level policy for this server. Same syntax; it can never widen it. |

Each server enrolls this machine separately, so each entry needs its own token,
issued on that server's own console.

### `servers:` replaces the single-server keys

`servers:` is mutually exclusive with `server_url`, `enroll_token`,
`enroll_token_file` and `tls_insecure` — including when those arrive as
environment variables rather than from the file. Setting both is a **startup
error**, not a merge:

```
`servers:` and NETTACT_AGENT_SERVER_URL are mutually exclusive; put the setting inside the servers entry
```

The order of the list is meaningful (see below) and a mixed configuration has no
obvious first entry, so the agent refuses rather than guessing. Everything else —
`data_dir`, `upload_interval`, `wire_format`, the stability limits — stays at the
top level and applies to the whole agent.

The single-server form is exactly equivalent to **one entry named `default`**.
Spelling it out as a one-element list therefore changes nothing on an
already-enrolled agent, and is the lossless way to make room for a second server
later:

```yaml
servers:
  - name: default            # same name the single-server form uses
    url: http://<server host>:12450
```

### Names are identity

`name` is not cosmetic. It keys the credential stored in `agent.json` and the
agent's queued backlog for that server, and it is deliberately **not** derived
from the URL — a URL is something you edit (a new port, a hostname replacing an
IP), and an edit must not look like a different machine.

The consequence: **renaming an entry makes the agent enroll again** as a new agent
on that server, and discards whatever that server's queue still held. Changing an
entry's `url` while keeping its `name` is the safe way to move a server.

### The first entry owns game capture

Frame-rate and game telemetry come from a single sensor child process, and its
capture list is pushed down by a server, so two servers pushing different lists
would restart it against each other. Ownership is therefore assigned rather than
shared: **the first entry in the list** configures the sensor and receives its
data. Every other entry's game configuration is ignored and no game data is ever
queued for it — adding an employer's server does not start reporting what you
play. Everything else (probes, host metrics, incident diagnostics) is collected
for every server that was granted it.

### The servers do not affect each other

Each entry has its own credential, its own set of monitoring targets pushed down
by that server, and its own upload queue. One server being unreachable, revoking
this agent, or having its session replaced by another agent leaves the others
reporting normally; the failed one retries on its own.

Their targets are executed independently, so two servers watching the same
address probe it twice. What they do share is the machine: one identity key
(`agent.key`), one `data_dir`, one upload cadence, one set of
[stability limits](#stability-limits) (two servers asking for traceroutes draw on
the same concurrency budget), and the top-level
[probe target access policy](#probe-target-access-control-1), which is the floor
none of them can get past.

---

## Enrollment flow and token lifetime

Trust between an agent and the server is established exactly once:

1. an administrator issues a **one-time enrollment token** on the console's
   "**Agent**" page (with an optional note; tokens issued from the console are
   valid for **24 hours**);
2. on its first start, the agent presents the token to the server's enrollment
   endpoint and exchanges it for long-lived credentials, which are stored in
   `data_dir` alongside the machine's ed25519 identity key (`agent.json` /
   `agent.key`);
3. every later start reuses the stored credentials and **never reads the token
   configuration again** — the token is spent, so you can delete it from the
   config; issuing new tokens does not affect already-enrolled agents.

Key points:

- One token enrolls exactly **one** agent on **one** server; issue a separate
  token per machine, and a separate one per server when an agent reports to
  several.
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
- **One grant per server.** An agent reporting to several servers can give each
  of them a different one — see
  [Reporting to more than one server](#reporting-to-more-than-one-server). The
  top-level `permissions` is then the default an entry inherits when it does not
  name its own.

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

Unlike `permissions`, this policy is the **machine owner's floor**: an agent
reporting to several servers may hand any one of them a
[narrower `probe_access`](#reporting-to-more-than-one-server), but never a wider
one — a target has to pass both layers.

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
  systemd service the installer writes runs as root and has everything. Run as an
  ordinary user, path diagnostics require `CAP_NET_RAW` outright (they have to
  receive the intermediate Time-Exceeded replies, and only a raw socket delivers
  those), while ICMP and gateway probing have a fallback: an unprivileged ping
  socket, available whenever the kernel's `net.ipv4.ping_group_range` covers the
  process's gid. Most distributions leave that range open on bare metal;
  **inside a container the opposite is true** (see below). Neighbour discovery
  uses netlink and needs no privilege at all.
- **macOS (bare binary)**: standard probes (DNS/HTTP/TCP/NAT), interface and Wi-Fi
  state, host metrics, and process/connection snapshots work; ICMP probing,
  gateway probing, neighbour discovery and path diagnostics are **not implemented
  yet**.
- **Docker (official agent image)**: the image is a Linux build, so its
  capabilities match Linux — but it deliberately carries **no** `cap_net_raw`
  file capability. (With one, `--cap-drop ALL` — a common hardening default —
  would make execve fail with EPERM and the agent would not start at all; and
  since Docker's default bounding set already contains NET_RAW, a file capability
  would quietly hand raw sockets to every container.) Raw-socket access is
  granted at **run time** instead: `--user 0:0` *plus* `--cap-add NET_RAW`.
  `--cap-add` alone does nothing for a non-root process, whose permitted set is
  empty regardless.
  **It monitors the Docker host by default**: the compose file the installer
  generates for `--docker` carries `network_mode: host`, `pid: host`,
  `user: "0:0"` and `cap_add: [NET_RAW]`, and bind-mounts the host's `/proc` and
  `/sys` read-only. Pass `--container-view` to monitor the container itself: the
  container then stays non-root and has no path diagnostics, but ICMP and gateway
  probing still work, thanks to the
  `sysctls: net.ipv4.ping_group_range: "0 2147483647"` line in the generated
  compose file. **That line is required**: a new network namespace starts at
  `1 0` (an empty range) and dockerd does not change it, so the bare-metal
  assumption that "an ordinary user can ping" does not hold in a container. See
  [the deployment guide](./deploy.md#_10-host-view-vs-container-view-docker-installs).

For the per-permission breakdown, see the
[permission reference](./permissions.md#platform-support).


## The OpenWrt router build (lite)

Routers run a trimmed build — its release assets have `-lite-` in the name — which differs from the other platforms in two ways:

- **No WireGuard egress for probes.** Userspace WireGuard and the gVisor network stack it needs are the single largest part of the binary; dropping them takes it from roughly 20 MB to roughly 11 MB. A monitor pinned to a WireGuard proxy reports a configuration error (`ReasonProxyConfig`) once and does **not** fall back to a direct dial, which would silently measure a different path. SOCKS5 and HTTP CONNECT proxies are unaffected.
- **The telemetry buffer never reaches disk.** Other platforms spill the buffer into `data_dir` when uploads stop; the router build does not, because that spends flash erase cycles on data whose whole purpose is to be uploaded immediately. The cost is that a crash or power cut loses whatever is still buffered, up to a bounded amount. The identity files (`agent.key`, `agent.json`) are unaffected — they are always written to flash, so a reboot never means re-enrolling.

Everything else matches the Linux build. For installation and configuration see [OpenWrt router installation](./openwrt.md).
