# OpenWrt router installation

Running the NetTact agent on an OpenWrt router puts the probes at the real edge of the network. A router sees the whole uplink, every wireless client and the actual NAT behaviour — none of which an agent on some desktop inside the LAN can observe.

There are two packages:

| Package | Contents | Architecture |
| --- | --- | --- |
| `nettact-agent` | procd service, UCI config, download script | `all` |
| `luci-app-nettact` | LuCI settings and status pages | `all` |

## Why the package ships no executable

A full agent is about 11 MB. Bundling it would mean one package per CPU architecture, and it would not fit at all on the 8 and 16 MB routers that benefit most from having it.

So the package contains scripts only, and the agent binary for this device's architecture is downloaded at first start. You choose where it lives:

- **RAM mode (default)** — downloaded to `/tmp` on every boot. **Uses no flash at all**, at the cost of ~11 MB of RAM and one download per reboot.
- **Flash mode** — downloaded once to `/usr/lib/nettact`. Boots and runs with no internet, needs about 12 MB free on the overlay.

In both modes the agent's **identity always lives on flash**, in `/etc/nettact/data` (`agent.key` and `agent.json`, under 1 KB together). A reboot therefore brings the router back as the same agent, and it never has to enroll again with a one-time token.

## Install

```sh
opkg update
opkg install ca-bundle
opkg install https://d.nettact.org/agent/nettact-agent.ipk
opkg install https://d.nettact.org/agent/luci-app-nettact.ipk
```

::: tip HTTPS support
For `opkg` to fetch over HTTPS the image needs `libustream-mbedtls` (or the openssl/wolfssl variant) and `ca-bundle`. Official images include them; if `opkg install` reports an SSL error, install those first.
:::

After installation the service is **stopped and not enabled** — installing a package should never make a router start reporting to a server nobody has configured yet.

## Configure

In LuCI, open **Services → NetTact**, fill in the server URL and enrollment token, choose a storage mode, and enable it.

Or edit `/etc/config/nettact` directly:

```sh
uci set nettact.main.server_url='https://nettact.example.com'
uci set nettact.main.enroll_token='<one-time enrollment token>'
uci set nettact.main.mode='ram'
uci set nettact.main.enabled='1'
uci commit nettact
/etc/init.d/nettact enable
/etc/init.d/nettact start
```

### UCI options

| Option | Default | Meaning |
| --- | --- | --- |
| `enabled` | `0` | Master switch. The service starts only when this is `1` **and** `server_url` is set. |
| `mode` | `ram` | `ram` or `flash`, as above. Anything unrecognised is treated as `ram`. |
| `server_url` | empty | The NetTact server, e.g. `https://nettact.example.com`. |
| `enroll_token` | empty | One-time enrollment token. Unused once enrolled; safe to clear. |
| `tls_insecure` | `0` | Accept a server certificate that does not verify. Only for a private CA or an IP-address server you control. |
| `upload_interval` | `30s` | How often buffered telemetry is uploaded. |
| `download_base` | `https://d.nettact.org/agent` | Download source; point at a local mirror if you prefer. |
| `version` | `latest` | `latest`, or a pinned tag such as `v1.2.3`. |

Every other agent option is in the [agent configuration reference](/en/agent-config). The init script passes UCI options through as the matching `NETTACT_AGENT_*` environment variables rather than generating a YAML file. If you need an option that UCI does not expose, write `/etc/nettact/agent.yaml` by hand — the agent finds it automatically, and a config file outranks the environment.

## Supported architectures

The download script reads `opkg print-architecture` (falling back to `OPENWRT_ARCH` in `/etc/os-release`) and maps it to a build:

| OpenWrt architecture | Build downloaded | Typical devices |
| --- | --- | --- |
| `x86_64` | `amd64` | x86 soft routers, mini PCs |
| `i386_*` | `386` (softfloat) | older x86 |
| `aarch64_*` | `arm64` | Raspberry Pi 4/5, NanoPi, most recent ARM routers |
| `arm_cortex-a5/7/8/9/15/17/53/72*` | `armv7` | most 32-bit ARM routers |
| `arm_arm1176*`, `arm_mpcore*` | `armv6` | Raspberry Pi 1, older ARM11 devices |
| `arm_arm926*`, `arm_fa526*`, `arm_xscale*` | `armv5` | early ARM devices |
| `mipsel_*` | `mipsle-softfloat` | MT7621 / MT7620 / MT76x8 — most consumer routers |
| `mips_*` | `mips-softfloat` | ath79 and other big-endian MIPS |
| `riscv64_*` | `riscv64` | D1, JH7110 boards |

MIPS ships softfloat only: the MT7621 family has no FPU, and a softfloat build also runs correctly on the few chips that do — so there is no variant here that can be picked wrongly.

**ARM and x86 names outside the table fall back**: any other `arm_*` is treated as ARMv7 (every ARM target OpenWrt has added in the last decade is at least that, and the older cores that exist are each listed above), and any other `x86*` as 386. MIPS and RISC-V are matched by prefix alone, with no per-model fallback. Architecture families with no build at all — PowerPC, LoongArch — fail with a clear message rather than guessing at something that would not run.

If a new ARM model falls back to ARMv7 and does not run, send us the output of `opkg print-architecture` and we will add it to the table.

## What the router build leaves out

Router builds (their asset names contain `-lite-`) drop two things:

- **No WireGuard egress for probes.** Userspace WireGuard and the gVisor network stack it dials through are the single largest part of the binary. A monitor pinned to a WireGuard proxy reports a configuration error and does **not** fall back to a direct dial — that would silently measure a different path. SOCKS5 and HTTP CONNECT proxies still work.
- **The telemetry buffer is memory-only.** The desktop and server builds spill their buffer to disk when uploads stop; the router build does not, because that means spending flash erase cycles on data whose whole purpose is to be uploaded immediately. The cost is that a crash or power cut loses whatever is still buffered, up to a bounded amount. Identity is unaffected — it is always on flash.

Everything else is identical: ICMP, DNS, HTTP, TCP, NAT behaviour, traceroute, interface and Wi-Fi state.

## Updating and maintenance

**Update the agent binary** — press "Download / update binary" on the LuCI status page, or:

```sh
/usr/lib/nettact/fetch.sh install
/etc/init.d/nettact restart
```

In RAM mode the binary is re-downloaded on every boot anyway, so with `version` set to `latest` a reboot is an update.

**Update the packages** — run `opkg install` against the same `.ipk` URLs again.

**sysupgrade** — the package ships `/lib/upgrade/keep.d/nettact`, so `/etc/config/nettact` and `/etc/nettact/data` are carried across automatically and the router does not re-enroll.

**Uninstall:**

```sh
opkg remove luci-app-nettact nettact-agent
rm -rf /etc/nettact        # also removes the agent's identity
```

`opkg remove` stops the service and deletes the downloaded binary but keeps `/etc/nettact`, so reinstalling does not mean enrolling again. Remove that directory by hand for a clean wipe.

## Troubleshooting

```sh
logread -e nettact              # service log
/etc/init.d/nettact status      # is it running
/usr/lib/nettact/fetch.sh arch  # architecture this device resolved to
ls -l /etc/nettact/data/        # agent.json present means enrollment succeeded
```

Common cases:

- **The service exits immediately after starting.** Check that `enabled` is `1` and `server_url` is set. Without both, the init script logs why and exits cleanly.
- **It waits and never starts.** The launcher waits up to five minutes each for a plausible clock and a default route. A router with no RTC boots in 1970, which makes every server certificate "not yet valid" — confirm `sysntpd` is running.
- **The download fails.** Confirm `ca-bundle` is installed and `download_base` is reachable; try it by hand with `uclient-fetch -O- <url>`.
- **"no NetTact agent build for architecture".** Include the output of `opkg print-architecture` in the issue.

## Using a local mirror

To keep routers off the public internet, point `download_base` at your own mirror. It must serve the same layout:

```
<base>/versions.json
<base>/<tag>/nettact-agent-lite-linux-<arch>
<base>/<tag>/SHA256SUMS
```

`versions.json` needs at least a `latest` field:

```json
{"latest":"v1.2.3","versions":[{"tag":"v1.2.3","prerelease":false}]}
```

The download script resolves `latest` to a concrete tag first, then takes both the binary and `SHA256SUMS` from that one immutable directory, and verifies the SHA256 before installing anything.
