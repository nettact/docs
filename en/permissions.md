# Permission reference

What an Agent may collect, and which probes it may run, is decided by its **local
permission policy**. That policy can only be set on the machine the Agent runs on
— the console can display it but never change it. That is a deliberate security
boundary: compromising the console must not widen what any Agent collects.

This page is the complete permission list and how to set it. For the syntax of
the configuration options themselves, see [Agent configuration](./agent-config.md).

## Three views

The console's Agent detail page sorts every permission into one of four groups,
based on three independent facts:

| Fact | Meaning |
|---|---|
| **Granted** | The local policy allows it |
| **Supported** | This build + this OS + **this process's privilege** can do it |
| **Effective** | Granted ∩ supported, minus any child whose parent is not effective |

"Supported" includes runtime privilege, not just compiled capability: the same
Linux binary supports ICMP probing when run as root and may not when run as an
ordinary user. So one policy can yield different effective permissions on two
machines — the console shows the difference rather than failing silently.

What the four groups mean:

- **Effective** — working.
- **Not granted** — the platform can do it, the policy just does not allow it.
  Change the policy and restart; see below.
- **Blocked** — granted but unusable: it needs more privilege, or this platform
  lacks the capability, or a permission it depends on is not effective. A policy
  change will not help.
- **Unsupported here** — neither granted nor possible on this machine.

## A permission list REPLACES the default

**Setting `permissions` replaces the default set wholesale; it does not add to
it.** You get exactly what you list, and nothing else.

This is the easy mistake: wanting to add `host.cpu.read` and writing
`permissions: [host.cpu.read]`, which switches off every probe. Click any "not
granted" permission on the console's Agent detail page and the dialog hands you
the **complete replacement line** (everything already granted, plus that one,
with dependencies filled in). Copy that.

Other rules:

- The literal `none` means an empty grant — only what the Agent needs to stay up.
- **Wildcards are never accepted**; `*` and `all` are rejected.
- Any permission change requires an **Agent restart**. There is no hot reload.

Dependencies behave in two quite different ways — do not conflate them:

1. **Your list contains a child without its parent** → **the Agent fails to
   start**, naming what is missing, e.g.
   `permission "network.wifi.ssid.read" requires "network.wifi.status.read"`.
   It is not ignored silently. The parent has to be in the configured list — the
   line the console generates already includes it for you.
2. **The parent is listed, but this platform does not support it** → the child is
   dropped **silently** (no error, the Agent runs, the permission simply has no
   effect). The console shows it under "blocked" and names the parent that is not
   in effect.

## Presets

When you issue an enrollment token on the console's "Agent" page you can pick a
preset, and the generated one-command installer carries it.

### Recommended (the built-in default)

This is what you get when `permissions` is unset: standard probes plus basic
network state.

```
probe.icmp,probe.dns,probe.http,probe.tcp,probe.nat,network.gateway.probe,network.interface.status.read,network.interface.address.read,network.wifi.status.read,diagnostic.traceroute.icmp,diagnostic.traceroute.tcp
```

### Recommended + host metrics

Adds CPU, memory, disk, load, uptime and network throughput. Almost every "how
busy is this machine" need stops here.

```
probe.icmp,probe.dns,probe.http,probe.tcp,probe.nat,network.gateway.probe,network.interface.status.read,network.interface.address.read,network.wifi.status.read,host.cpu.read,host.memory.read,host.disk.read,host.load.read,host.uptime.read,host.network.io.read,diagnostic.traceroute.icmp,diagnostic.traceroute.tcp
```

### Everything

All 29 permissions, including process and connection snapshots. **This reads
process names, the users that own them, and the remote addresses of connections**
— a different privacy decision from "how busy is this machine". Choose
deliberately.

## How to set it

### At enrollment (recommended)

The one-command installers take a permission argument, so the policy is in place
from the first start.

Windows:

```powershell
& ([scriptblock]::Create((irm https://d.nettact.org/agent/install.ps1))) `
  -ServerUrl 'http://<server host>:12450' -Token '<one-time token>' `
  -Permissions 'probe.icmp,probe.dns,probe.http,probe.tcp,host.cpu.read,host.memory.read'
```

Linux / macOS:

```bash
curl -fsSL https://d.nettact.org/agent/install.sh | sudo bash -s -- \
  --server-url 'http://<server host>:12450' --token '<one-time token>' \
  --permissions 'probe.icmp,probe.dns,probe.http,probe.tcp,host.cpu.read,host.memory.read'
```

Docker:

```bash
curl -fsSL https://d.nettact.org/agent/install.sh | bash -s -- --docker \
  --server-url 'http://<server host>:12450' --token '<one-time token>' \
  --permissions 'probe.icmp,probe.dns,probe.http,probe.tcp,host.cpu.read,host.memory.read'
```

Omitting the argument keeps the built-in default set. Passing `none` grants nothing.

### On an Agent that is already installed

Edit `permissions` in the config file, then restart the Agent. Config file
locations:

| Platform | Path |
|---|---|
| Windows | `%ProgramData%\NetTact\agent.yaml` |
| Linux | `/etc/nettact/agent.yaml` |
| macOS | `/Library/Application Support/NetTact/agent.yaml` |
| Docker | Mount one at `/etc/nettact/agent.yaml`, or use the environment variable |

```yaml
permissions:
  - probe.icmp
  - probe.dns
  - host.cpu.read
```

Restart:

```bash
systemctl restart nettact-agent                    # Linux
launchctl kickstart -k system/org.nettact.agent    # macOS
Restart-ScheduledTask -TaskName "NetTact Agent"    # Windows (PowerShell, as Administrator)
```

### Environment variable

The config file takes precedence over the environment. Containers and systemd
units commonly use the latter:

```bash
NETTACT_AGENT_PERMISSIONS=probe.icmp,probe.dns,host.cpu.read
```

```ini
# /etc/systemd/system/nettact-agent.service
[Service]
Environment=NETTACT_AGENT_PERMISSIONS=probe.icmp,probe.dns,host.cpu.read
```

### Desktop

The Agent embedded in NetTact Desktop runs with a fixed full-access grant. There
is nothing to configure — it monitors your own computer.

## Platform support

✅ supported · 🔑 needs privilege · ❌ not implemented in that platform's build

| Permission family | Windows | Linux | macOS | Docker |
|---|---|---|---|---|
| DNS / HTTP / TCP / NAT probes | ✅ | ✅ | ✅ | ✅ |
| ICMP probe, gateway probe | ✅ | ✅ | ❌ | ✅ |
| Interface status / addresses, Wi-Fi | ✅ | ✅ | ✅ | ✅ |
| Neighbors (device discovery) | ✅ | ✅ | ❌ | ✅ |
| Host metrics `host.*` | ✅ | ✅ | ✅ | ✅ |
| Process / connection snapshots | ✅ | ✅ | ✅ | ✅ |
| ICMP path diagnostics | ✅ | 🔑 | ❌ | 🔑 |
| TCP path diagnostics | 🔑 | 🔑 | ❌ | 🔑 |

About 🔑:

**Why ICMP probing needs no privilege**: sending an echo and reading the reply is
all an **unprivileged ping socket** (`SOCK_DGRAM`/`IPPROTO_ICMP`) has to do, and
the kernel allows it whenever `net.ipv4.ping_group_range` covers the process's
gid — the default on common distributions and inside Docker containers
(`0 2147483647`). The Agent tries a raw socket first and falls back to a ping
socket automatically. Measured: an ordinary user on the host, and a plain non-root
container with no added capabilities, both get ICMP probing and gateway probing.

**Path diagnostics is what genuinely needs a raw socket**: it must receive the
Time-Exceeded replies intermediate routers send back, which an unprivileged ping
socket never sees, so it takes `CAP_NET_RAW` or root.

By platform:

- **Windows**: only TCP path diagnostics needs Administrator. The scheduled task
  the installer registers runs as SYSTEM, which satisfies it; a hand-launched
  binary needs "Run as administrator". ICMP goes through the system
  `IcmpSendEcho` and needs no elevation.
- **Linux**: ICMP probing and gateway probing work out of the box (above). Both
  traceroute modes need `CAP_NET_RAW` or root; the systemd service the installer
  writes runs as root, so a default install has everything. Switching
  `net.ipv4.ping_group_range` off (`1 0`) without `CAP_NET_RAW` takes ICMP probing
  away too — the console then reports it as unavailable.
- **Docker**: the official image carries **no** file capability — one would make
  a `--cap-drop ALL` container fail to start outright, and since Docker's default
  bounding set already contains NET_RAW it would quietly hand raw sockets to every
  container. A non-root container therefore only ever gets a ping socket, even
  with `--cap-add NET_RAW`, so **that flag alone achieves nothing**. The
  installer's `--docker` host view reaches a raw socket with `--user 0:0
  --cap-add NET_RAW`, and **that is only for path diagnostics**: without it, ICMP
  probing and gateway probing still work and only path diagnostics is reported
  unsupported.
- **macOS**: the ❌ rows are not implemented in the macOS build yet; neither
  granting nor elevating enables them.

### Docker: whose machine are you monitoring?

By default a container sees only **its own** network and processes. The
installer's `--docker` mode therefore switches to a **host view**:
`--network host --pid host`, with the host's `/proc` and `/sys` bind-mounted
read-only (`HOST_PROC` / `HOST_SYS`). To monitor the container itself, add
`--container-view`.

Doing this halfway produces data that looks right and is not — host interfaces
beside container processes — so these settings go together or not at all.

## The permissions

Purpose, dependencies and platform availability for each one.

### Probes

#### probe.icmp {#probe-icmp}

Probe target reachability and latency with ICMP (ping). Windows ✅ / Linux ✅ / macOS ❌.

**No privilege is required on Linux**: an unprivileged ping socket suffices, as
long as `net.ipv4.ping_group_range` covers the process's gid (the common default).
It becomes unavailable only when that sysctl is switched off and the process has
no `CAP_NET_RAW`.

#### probe.dns {#probe-dns}

Resolve and probe DNS records (A/AAAA/CNAME, …), recording resolution time and
result. All platforms.

#### probe.http {#probe-http}

Run basic HTTP(S) probes: `GET`/`HEAD` only, no request body, and only the
`User-Agent`, `Accept`, `Accept-Language` and `Cache-Control` headers. All platforms.

#### probe.http.extended {#probe-http-extended}

Run HTTP probes with a custom method, a request body, or arbitrary headers. An
HTTP monitor that goes beyond the basic profile needs this or it stalls as
"permission blocked".

**Requires:** `probe.http`. All platforms.

::: warning
This lets the Agent send any header you configure on a monitor, including
`Authorization` and `Cookie`. Grant it only when you genuinely need authenticated
probes.
:::

#### probe.tcp {#probe-tcp}

Probe TCP port connectivity (connected / refused / timed out), optionally
validating a TLS handshake. All platforms.

#### probe.nat {#probe-nat}

Discover this host's NAT behaviour and public mapping via STUN. All platforms.

### Network state

#### network.gateway.probe {#network-gateway-probe}

Discover the default gateway and probe it with ICMP, which is what separates "the
local network is down" from "the upstream is down". Availability tracks
[probe.icmp](#probe-icmp) exactly: Windows ✅ / Linux ✅ (no privilege) / macOS ❌.

#### network.interface.status.read {#network-interface-status-read}

Read each interface's up/link state and whether it is wireless or loopback. **The
root dependency of almost every network capability.** All platforms.

#### network.interface.address.read {#network-interface-address-read}

Read interface IP addresses, default gateway addresses and configured DNS servers.

**Requires:** `network.interface.status.read`. IP addresses work on every
platform; **gateways and DNS servers are Windows and Linux only** — the macOS
build has no route/resolver adapter, so those two fields are always empty there.

::: tip
Linux DNS configuration is system-wide (`/etc/resolv.conf`) rather than
per-interface as on Windows, so the Agent attaches that one list to the
interfaces **carrying a default route** — including a point-to-point or tunnel
default such as `default dev tun0`, which has no gateway address at all.
:::

#### network.wifi.status.read {#network-wifi-status-read}

Read Wi-Fi connection state, signal strength, channel and negotiated rates.
**Does not include the SSID.**

**Requires:** `network.interface.status.read`. All platforms (Linux uses nl80211
and needs no privilege).

#### network.wifi.ssid.read {#network-wifi-ssid-read}

Additionally read the name (SSID) of the connected network. It is a separate
permission because an SSID is identifying information: without it the Agent
**never reads the value at all**, rather than reading and redacting it.

**Requires:** `network.wifi.status.read`. All platforms.

#### network.neighbor.read {#network-neighbor-read}

Read the system neighbor table (ARP / NDP) to passively discover LAN devices
(IP + MAC). No packets are sent and nothing is scanned — it reads a table the OS
already keeps.

Windows ✅ / Linux ✅ (netlink, no privilege needed) / macOS ❌.

#### network.neighbor.hostname.read {#network-neighbor-hostname-read}

Reverse-resolve discovered neighbors to add hostnames.

**Requires:** `network.neighbor.read`. Windows ✅ / Linux ✅ / macOS ❌.

### Host metrics

All six are available on every platform. In a container's host view, CPU, memory,
uptime, network throughput and load describe the **host** (they are read through
`HOST_PROC`/`HOST_SYS`); **disk is the exception** — see below.

#### host.cpu.read {#host-cpu-read}

Read host CPU utilization.

#### host.memory.read {#host-memory-read}

Read host memory usage and utilization.

#### host.disk.read {#host-disk-read}

Read per-mount disk usage and utilization.

::: warning In a container, disk figures describe the container
The list of mountpoints comes from the host (`HOST_PROC`), but usage is measured
in the **container's mount namespace**: `/` resolves to the container's overlay
filesystem, and the host's other mountpoints do not exist inside the container and
are skipped. Disk is therefore the one metric that does not follow the host view.
To monitor host disks, install a native Agent on the host.
:::

#### host.load.read {#host-load-read}

Read system load averages (1/5/15 minutes). Windows has no native load average;
gopsutil **synthesizes** one from the processor queue length, so the values read
near zero until it has collected enough samples.

#### host.uptime.read {#host-uptime-read}

Read how long the host has been up.

#### host.network.io.read {#host-network-io-read}

Read host network throughput (bps).

### Process snapshot

Process and connection snapshots are **on-demand, never stored**: they back the
console's live process view and incident scenes, and are not written to the
metric history.

#### host.process.basic.read {#host-process-basic-read}

Read basic process information: PID, name, state. **The root dependency of the
process family.** All platforms.

#### host.process.owner.read {#host-process-owner-read}

Read the user each process runs as.

**Requires:** `host.process.basic.read`. All platforms.

#### host.process.resource.read {#host-process-resource-read}

Read per-process CPU and memory usage.

**Requires:** `host.process.basic.read`. All platforms.

#### host.process.io.read {#host-process-io-read}

Read per-process disk I/O.

**Requires:** `host.process.basic.read`. Windows ✅ / Linux ✅ / **macOS ❌**: the
Agent offers the permission, but the underlying macOS implementation reports "not
implemented", so granting it yields no I/O fields.

### Connection snapshot

#### host.connection.summary.read {#host-connection-summary-read}

Read a summary of network connections: protocol and state counts, no addresses.
**The root dependency of the connection family.** All platforms.

#### host.connection.local.read {#host-connection-local-read}

Read the local address and port of each connection.

**Requires:** `host.connection.summary.read`. All platforms.

#### host.connection.remote.read {#host-connection-remote-read}

Read the **remote** address and port of each connection.

**Requires:** `host.connection.summary.read`. All platforms.

::: warning
Remote addresses reveal who this machine is talking to — the most privacy-
sensitive permission in the set. Grant it deliberately.
:::

#### host.connection.owner.read {#host-connection-owner-read}

Read which process owns each connection.

**Requires:** `host.connection.summary.read`. All platforms.

### Path diagnostics

Path diagnostics is a one-shot traceroute triggered when a fault occurs, not a
periodic collection.

#### diagnostic.traceroute.icmp {#diagnostic-traceroute-icmp}

Trace the network path to a destination with ICMP, recording the responder and
latency at each hop.

Windows ✅ (via iphlpapi, no Administrator needed) / Linux 🔑 (`CAP_NET_RAW` or
root) / macOS ❌.

#### diagnostic.traceroute.tcp {#diagnostic-traceroute-tcp}

Trace the path with TCP SYN probes. More effective across paths that only allow
specific ports and drop ICMP.

Windows 🔑 (Administrator, or a service running as SYSTEM) / Linux 🔑
(`CAP_NET_RAW` or root) / macOS ❌.

The two modes are granted independently: a machine may have only one of them, and
the console reports that honestly.

## Troubleshooting

**I changed the config and nothing happened.**
Permissions are immutable within a process — restart the Agent. Also check you
edited the right place: the config file takes precedence over the environment, so
a value in both means the file wins.

**The Agent will not start, reporting `permission "X" requires "Y"`.**
The configured list has a child permission without its parent. This case is a
**startup failure**, not a silent drop — add the parent and start again. The line
the console's dialog gives you is already dependency-closed.

**I granted a child permission and it has no effect, with no error.**
Different case: the parent IS listed, but this platform does not support it, so
the child was dropped silently. The console's Agent detail page lists it under
"blocked" and names the parent that is not in effect.

**Path diagnostics does not work on Linux, but ICMP probing does.**
Expected: path diagnostics must receive intermediate Time-Exceeded replies, which
takes a raw socket (`CAP_NET_RAW` or root), while ICMP probing gets by with an
unprivileged ping socket. The systemd service the installer writes runs as root
and has both; a container needs to run as root (`--user 0:0 --cap-add NET_RAW`).

**Not even ICMP probing works on Linux.**
`net.ipv4.ping_group_range` has been switched off (set to `1 0`) and the process
has no `CAP_NET_RAW`. Open that sysctl up, or run the Agent as root / with
`CAP_NET_RAW`.

**The container reports its own data instead of the host's.**
It was installed with `--container-view`, or started by hand without the host-view
settings. See [Docker: whose machine are you
monitoring?](#docker-whose-machine-are-you-monitoring).

**Can the console change permissions remotely?**
No, by design. It can only show the current state and tell you what to configure
on the Agent.
