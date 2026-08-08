# OpenWrt 路由器安装

在 OpenWrt 路由器上运行 NetTact Agent,让探测从网络的真正入口发起——路由器看得到整条上行链路、每个无线客户端和实际的 NAT 行为,这些都是装在某台 PC 上的 Agent 看不到的。

安装包分两个:

| 包 | 内容 | 架构 |
| --- | --- | --- |
| `nettact-agent` | procd 服务、UCI 配置、下载脚本 | `all` |
| `luci-app-nettact` | LuCI 配置与状态页面 | `all` |

## 为什么安装包里没有可执行文件

完整 Agent 约 11 MB。直接打进包里意味着每种 CPU 架构都要发一个包,而且 8 MB / 16 MB 闪存的路由器根本装不下——那恰恰是最需要它的一类设备。

所以包里只有脚本,Agent 程序在首次启动时按本机架构下载。存放位置由你决定:

- **内存模式(默认)**——每次开机下载到 `/tmp`。**完全不占用闪存**,代价是约 11 MB 内存和每次重启一次下载。
- **闪存模式**——只下载一次,存到 `/usr/lib/nettact`。断网也能直接开机运行,需要约 12 MB 可用的 overlay 空间。

两种模式下,Agent 的**身份信息始终保存在闪存**上的 `/etc/nettact/data`(`agent.key` 和 `agent.json`,合计不到 1 KB)。因此重启后路由器仍是同一个 Agent,永远不需要拿一次性令牌重新注册。

从闪存切回内存时,下次启动服务或下载程序时会删除闪存上的那一份——切到内存的动机本来就是腾出 overlay 空间,留着那 11 MB 就白切了。

## 安装

控制台的 Agent 页面会替你生成好这条命令,服务器地址、新的注册令牌和权限策略都已经填好——**Agent → 接入管理 → OpenWrt**:

```sh
wget -O /tmp/nettact-openwrt.sh https://d.nettact.org/agent/openwrt.sh && sh /tmp/nettact-openwrt.sh \
  --server-url 'https://nettact.example.com' \
  --token '<一次性注册令牌>'
```

::: tip 为什么不直接管道给 `sh`
管道的退出码取的是*最后一个*命令的,而 shell 读到空的标准输入会正常退出——所以 `wget … | sh` 在下载失败时什么都不打印,看起来和装好了一模一样。先下载再执行,下载就成了前置条件。
:::

它会装好两个软件包,把设置写入 `/etc/config/nettact`,启动服务,然后一直等到路由器报告自己已连接为止。若在超时内没等到,安装会**失败**并打印 agent 自己的连接状态和近期日志,而不是报一个没人验证过的成功。无论哪种情况服务都保持启用。大多数失败会自行重试——服务器不可达是一种,令牌被拒也是:站点 Agent 数超限这类原因在另一端修好后,同一枚令牌就能通过。真正的终止状态只有两个:根本没有令牌,以及凭据没能写进磁盘。

| 选项 | 说明 |
| --- | --- |
| `--token-file <路径>` | 从文件读取一次性令牌,而不是写在命令行里。 |
| `--permissions <列表>` | 逗号分隔的权限策略,或 `none`。它**替换**内置默认授权而非叠加。控制台会生成现成的值。 |
| `--mode ram\|flash` | agent 二进制的存放位置(默认 `ram`),含义见上文。 |
| `--version <tag>` | 把二进制固定到某个发布标签,而不是 `latest`。 |
| `--auto-update` | 每天检查一次并自动升级二进制。不能与固定的 `--version` 同用。这个开关每次运行都会被写一遍,所以不带它重跑就等于关闭。见[自动更新](#自动更新)。 |
| `--download-base <url>` | **二进制**的下载源,可指向本地镜像。 |
| `--ipk-base <url\|目录>` | 两个**软件包**的来源。可以是本地目录——测试未发布的构建就靠它。 |
| `--tls-insecure` | 接受无法验证的服务器证书。 |
| `--no-luci` | 只装 agent 包,不装 LuCI 页面。 |
| `--reinstall` | 用这里给的令牌重新注册,而不是继续用路由器已有的凭据——控制台的**重装**生成的就是它。旧凭据和队列会被丢弃,且只在配置写完之后才丢——所以参数写错或 uci 写入失败时,路由器还是原样。 |
| `--wait <秒>` | 等待路由器上线的时长(默认 180;填 `0` 跳过检查)。 |

重复执行是安全的。`/etc/nettact/data` 里的身份始终不动,所以已经注册过的路由器会保留原有凭据——甚至不需要再给令牌。每次运行还会在启动服务前把二进制刷新到配置指定的版本,这正是"重跑即[升级](#升级与维护)"的原因。

### 手动安装

```sh
opkg update
opkg install ca-bundle
opkg install https://d.nettact.org/agent/nettact-agent.ipk
opkg install https://d.nettact.org/agent/luci-app-nettact.ipk
```

::: tip HTTPS 支持
`opkg` 通过 HTTPS 下载需要镜像库里有 `libustream-mbedtls`(或 openssl / wolfssl 版本)和 `ca-bundle`。官方固件默认已经包含;若 `opkg install` 报 SSL 错误,先装上它们。
:::

装完后服务处于**停止且未启用**状态——安装一个包不应该让路由器立刻开始向某个还没填的服务器上报。按下一节配置即可。

## 配置

在 LuCI 里打开 **服务 → NetTact**,填写服务器地址和注册令牌,选择存放模式,然后启用。

状态页回答的是路由器主人真正关心的那个问题——不是「进程在不在跑」,而是「到底有没有在上报」。在**服务器连接**一栏下,每台已配置的 Server 都会列出连接状态(正在重试时带一个实时倒计时)、没连上的原因(大白话)、还有多少条待上传,以及上次连接是什么时候。

或者直接改 `/etc/config/nettact`:

```sh
uci set nettact.main.server_url='https://nettact.example.com'
uci set nettact.main.enroll_token='<一次性注册令牌>'
uci set nettact.main.mode='ram'
uci set nettact.main.enabled='1'
uci commit nettact
/etc/init.d/nettact enable
/etc/init.d/nettact start
```

### UCI 选项

`config nettact 'main'` —— 全局设置:

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `enabled` | `0` | 总开关。必须同时设为 `1` 且配置了服务器,服务才会启动。 |
| `mode` | `ram` | `ram` 或 `flash`,见上文。填其他值按 `ram` 处理。 |
| `server_mode` | `single` | `single` 使用下面四个选项;`multi` 忽略它们,改用 `config server` 区块。 |
| `server_url` | 空 | NetTact 服务器地址,如 `https://nettact.example.com`。 |
| `enroll_token` | 空 | 一次性注册令牌。注册成功后不再使用,可以清空。 |
| `enroll_token_file` | 空 | 改为从文件读取令牌。与 `enroll_token` 互斥。 |
| `tls_insecure` | `0` | 接受无法验证的服务器证书。仅用于自建 CA 或你自己控制的 IP 地址服务器。 |
| `upload_interval` | `30s` | 遥测上报间隔。 |
| `wire_format` | `protobuf` | `protobuf` 或 `json`。 |
| `persist_enable` | `1` | 断连期间把未上报积压写入闪存,路由器重启后不丢;只在与 Server 断开时才写。设为 `0` 退回纯内存缓冲。见[路由器版本的功能差异](#路由器版本的功能差异)。 |
| `persist_window` | `30m` | 断连后持续写盘的时长,范围 `[1m, 24h]`。 |
| `permission_mode` | `default` | `default`(Agent 内置授权,`recommended` 是它的别名)、`host_metrics`、`full`、`none` 或 `custom`,见下文。填了无法识别的值会直接拒绝启动,而不是回落到默认。 |
| `permissions` | — | 权限 id 列表,在 `permission_mode` 为 `custom` 时生效。它**整体替换**默认集而不是在其上增删;缺少父权限会直接导致启动失败。 |
| `probe_access_mode` | 未设置 | `allowlist` 或 `denylist`。未设置即保持默认:允许 `scope:lan` 与 `scope:public`,拒绝 `scope:loopback`、`scope:link-local` 与 `scope:metadata`。 |
| `probe_allowlist` | — | 选择器列表:`scope:<loopback\|lan\|link-local\|public\|metadata\|any>`、`cidr:<前缀>`、`ip:<地址>`、`host:<名称>`。 |
| `probe_denylist` | — | 语法同上。拒绝优先于允许。 |
| `min_probe_interval` | `1s` | 单个监控项的执行频率下限。范围 `200ms`–`10m`。 |
| `max_probe_concurrency` | `16` | 范围 1–256。 |
| `snapshot_min_interval` | `3s` | 范围 `1s`–`10m`。 |
| `snapshot_timeout` | `10s` | 范围 `1s`–`60s`。 |
| `max_trace_concurrency` | `4` | 范围 1–64。 |
| `download_base` | `https://d.nettact.org/agent` | 下载源,可改为本地镜像。 |
| `version` | `latest` | `latest`,或锁定某个版本如 `v1.2.3`。 |
| `auto_update` | `0` | 每天检查一次并自动升级 Agent 程序,只有二进制确实变了才重启服务。`version` 锁定了具体版本时本项无效。见[自动更新](#自动更新)。 |

几个权限预设与控制台接入 Agent 时提供的完全一致:`default` 是内置集(标准探测 + 基础网络状态),`host_metrics` 再加 CPU、内存、磁盘、负载、运行时长、网络吞吐与温度,`full` 授予全部,含进程与连接快照。完整 id 列表见 [Agent 配置](/zh/agent-config)。

### 同时向多台 Server 上报

把 `server_mode` 设为 `multi`,再为每台服务器添加一个可重复的 `config server` 区块。它们完全独立——各自的凭据、监控项、断线状态与权限:

```sh
uci set nettact.main.server_mode='multi'

uci add nettact server
uci set nettact.@server[-1].name='home'
uci set nettact.@server[-1].url='https://nettact.example.com'
uci set nettact.@server[-1].enroll_token='<一次性令牌>'

uci add nettact server
uci set nettact.@server[-1].name='work'
uci set nettact.@server[-1].url='https://nettact.corp.example'
uci set nettact.@server[-1].enroll_token='<一次性令牌>'
uci set nettact.@server[-1].permission_mode='custom'
uci add_list nettact.@server[-1].permissions='probe.icmp'
uci add_list nettact.@server[-1].permissions='probe.dns'

uci commit nettact
/etc/init.d/nettact restart
```

每个 server 区块可用:`name`、`url`、`enroll_token`、`enroll_token_file`、`tls_insecure`、`permission_mode` + `permissions`、`probe_access_mode` + `probe_allowlist` + `probe_denylist`。

::: warning name 是身份,不是备注
`name` 是本机保存凭据和积压队列的键。**改名等于让 Agent 重新注册,并丢弃为该服务器积压的数据。** 它不能从 URL 推导——URL 本来就允许你修改。只能用小写字母、数字、`-` 和 `_`,最长 64 字符,且文件内唯一。
:::

条目内的 `permission_mode` 只替换该服务器的授权;条目内的 `probe_access_mode` 只能在全局基础上**继续收窄**——目标必须同时通过两层。

### 配置文件实际在哪

init 脚本会把 `/etc/config/nettact` 渲染成 `/var/etc/nettact/agent.yaml`,再让 Agent 读它。该路径在 tmpfs 上,因此注册令牌不会在闪存上留第二份,改设置也不会消耗 overlay 的擦写寿命。这个文件每次启动服务都会从 UCI 重新生成,直接编辑它没有意义。

有三项仍以环境变量传入而不走这份文件:`NETTACT_AGENT_CONFIG_FILE`(读哪份配置)、`NETTACT_AGENT_DATA_DIR`(这样即使手写配置里没写 `data_dir`,身份信息也仍然落在闪存)和 `NETTACT_AGENT_STATUS_FILE`(LuCI 状态页读的那个 tmpfs 路径)。手写配置里自己写了 `status_file` 则盖过最后这项——文件值总是赢过环境变量。

如果你需要 UCI 没有覆盖的设置,手写一个 `/etc/nettact/agent.yaml` 即可,完整 schema 见 [Agent 配置](/zh/agent-config)。该文件存在时,init 脚本会原样使用它并且不再生成任何东西,因此两者不可能对「哪份配置生效」产生分歧。LuCI 状态页会显示当前用的是哪一份。

## 支持的架构

下载脚本读取 `opkg print-architecture`(取不到时回落到 `/etc/os-release` 的 `OPENWRT_ARCH`),再映射到对应的构建:

| OpenWrt 架构 | 下载的构建 | 常见设备 |
| --- | --- | --- |
| `x86_64` | `amd64` | 软路由、x86 工控机 |
| `i386_*` | `386`(软浮点) | 老式 x86 |
| `aarch64_*` | `arm64` | 树莓派 4/5、NanoPi、多数新 ARM 路由 |
| `arm_cortex-a5/7/8/9/15/17/53/72*` | `armv7` | 大部分 32 位 ARM 路由 |
| `arm_arm1176*`、`arm_mpcore*` | `armv6` | 树莓派 1、老 ARM11 设备 |
| `arm_arm926*`、`arm_fa526*`、`arm_xscale*` | `armv5` | 早期 ARM 设备 |
| `mipsel_*` | `mipsle-softfloat` | MT7621 / MT7620 / MT76x8(绝大多数家用路由) |
| `mips_*` | `mips-softfloat` | ath79 / 大端 MIPS |
| `riscv64_*` | `riscv64` | D1、JH7110 等 |

MIPS 只提供软浮点版本:MT7621 一系没有 FPU,而软浮点版本在少数带 FPU 的芯片上同样能正常运行——因此不存在选错版本的可能。

**表中未列出的 ARM 与 x86 型号会走回落规则**:任何其它 `arm_*` 按 ARMv7 处理(近十年 OpenWrt 新增的 ARM 目标都至少是 ARMv7,少数更老的核心已在表中逐条列出),任何其它 `x86*` 按 386 处理。MIPS 与 RISC-V 只按前缀区分,没有型号层面的回落。其余架构族(如 PowerPC、LoongArch)没有对应构建,会明确报错而不是去猜一个跑不起来的版本。

如果某个新 ARM 型号被回落成了 ARMv7 却跑不起来,请把 `opkg print-architecture` 的输出反馈给我们,我们会把它补进表里。

## 路由器版本的功能差异

路由器上的构建(资产名带 `-lite-`)有两处不同:

- **不支持 WireGuard 出口探测。** 用户态 WireGuard 加上它依赖的 gVisor 网络栈是二进制里最大的一块。如果某个监控项指定了走 WireGuard 代理,该监控项会明确报配置错误,**不会**退回直连——否则测出来的就是另一条路径的数据。SOCKS5 和 HTTP CONNECT 代理仍然可用。
- **遥测缓冲只在断连期间碰闪存。** 桌面/服务器版本无条件把缓冲落盘;路由器版在连接正常时缓冲只在内存里——不拿闪存的擦写寿命去存一批本来就要立刻上传的数据。与 Server 断开后,积压会在断连后的前 30 分钟内写入闪存(UCI `persist_window`;断连中途重启视为一次新的断连),所以断网时习惯性地重启路由器,不会再抹掉恰好能说明故障如何开始的那段数据。连接正常时崩溃仍会丢掉当时缓冲中的内容。设置 `option persist_enable '0'` 可退回纯内存模式。身份信息不受影响,始终在闪存上。

其余探测能力(ICMP、DNS、HTTP、TCP、NAT 行为、traceroute、接口与无线状态)完全一致。

## 升级与维护

**更新 Agent 程序**:重新跑一遍一键脚本。每次运行都会在启动服务前把程序刷新到配置指定的版本,所以重跑就是升级:

```sh
wget -O /tmp/nettact-openwrt.sh https://d.nettact.org/agent/openwrt.sh && sh /tmp/nettact-openwrt.sh \
  --server-url 'https://你的服务器' --wait 180
```

已注册的路由器会保留原有凭据,不需要再给 token。不想用脚本的话,也可以在 LuCI 状态页点「下载 / 更新程序」,或

```sh
/usr/lib/nettact/fetch.sh install
/etc/init.d/nettact restart
```

注意光重启服务**不会**升级:服务只在程序不存在时才下载,所以 `/etc/init.d/nettact restart` 跑的还是原来那个。内存模式下*重启系统*才算升级(`/tmp` 被清空,`version` 为 `latest` 时重新下载到的就是最新版);闪存模式下程序会一直留着,直到有人显式去取新的。也就是说,一台从某次发布之前就一直开着的路由器会持续运行旧版 Agent——这件事要紧,因为对服务器来说过旧的 Agent 会注册失败,然后每 10 秒重启一次。要让它自己跟上,见下面的自动更新。

### 自动更新

默认关闭。打开后(LuCI「服务 → NetTact → 程序」里的**自动更新**,或 `uci set nettact.main.auto_update='1'` 再 `/etc/init.d/nettact restart`),包会往 root 的 crontab 里写一条每天一次的检查:

```
37 3 * * * /usr/lib/nettact/update.sh # nettact-auto-update
```

- 检查时刻由本机 MAC 派生,固定落在 **02:00–05:00** 之间——既不会每次重启都换时间,也不会让一批路由器同时压向下载源。这与 Server 的 Watchtower 旁车是同一套做法。
- 只有下载到的二进制与当前的**确实不同**才重启服务;内容一样就什么都不做,不会白白断开一次连接。
- `version` 锁定了具体版本时跳过——锁定的意思就是留在那个版本。安装脚本也因此拒绝 `--auto-update` 与 `--version <tag>` 同时使用。
- 服务被手动 `stop` 时不动作,不会在半夜把你刚停掉的 Agent 又拉起来。
- 关闭(或停用服务、卸载包)时这条 cron 会被一并删除。

安装时就打开:给 `openwrt.sh` 加 `--auto-update`(控制台接入页面勾选「自动更新」即会生成)。这个开关**每次运行安装脚本都会被写一遍**:不带该参数重跑就等于关闭,与其他平台一致。

**更新安装包本身**:重新 `opkg install` 对应的 `.ipk` URL 即可。

**系统升级(sysupgrade)**:包里带了 `/lib/upgrade/keep.d/nettact`,`/etc/config/nettact` 和 `/etc/nettact/data` 会自动保留,升级后不需要重新注册。

**卸载**:

```sh
opkg remove luci-app-nettact nettact-agent
rm -rf /etc/nettact        # 连同身份信息一起删除
```

`opkg remove` 会停掉服务,删除下载的程序和渲染出来的 `/var/etc/nettact/agent.yaml`,但保留 `/etc/nettact`,这样重装后不必重新注册。要彻底清除请手动删除该目录。

## 排查

```sh
logread -e nettact              # 服务日志
cat /tmp/nettact/status.json    # 各 Server 的连接状态(JSON)
/etc/init.d/nettact status      # 是否在运行
cat /var/etc/nettact/agent.yaml # UCI 实际渲染出来的配置
/usr/lib/nettact/fetch.sh arch  # 本机识别出的架构
ls -l /etc/nettact/data/        # 有 agent.json 即表示注册成功
```

几种常见情况:

- **服务启动后立刻退出。** 检查 `enabled=1` 且已配置服务器。两者缺一,init 脚本会记一条日志然后正常退出。
- **在 LuCI 里改了没生效。** 看状态页的「配置来源」一行:如果显示「手写配置」,说明 `/etc/nettact/agent.yaml` 存在并被优先使用了。删除或改名该文件即可回到 UCI。
- **「服务器连接」一直显示暂无状态。** Agent 写 `/tmp/nettact/status.json`,状态页读它,所以每次启动后有几秒钟是空的。如果一直不出来,多半是手写的 `/etc/nettact/agent.yaml` 自己设了 `status_file:`——文件值优先于环境变量,安装包给的 tmpfs 路径被覆盖了。删掉那个键即可恢复面板;无论如何,日志里该有的都有。
- **一直卡在等待。** 启动脚本会等系统时间和默认路由就绪各最多 5 分钟。没有 RTC 的路由器开机时间停在 1970 年,会让所有 TLS 证书都「尚未生效」;确认 `sysntpd` 在跑。
- **下载失败。** 确认装了 `ca-bundle`,并且 `download_base` 可达。用 `uclient-fetch -O- <url>` 手动试一下。
- **提示架构不支持。** 把 `opkg print-architecture` 的输出附在 issue 里。
- **某个权限导致启动失败。** 权限不会自动补全:授予 `probe.http.extended` 却没给 `probe.http`、或授予 `host.process.owner.read` 却没给 `host.process.basic.read`,都是错误而不是警告。LuCI 的权限选择器会替你补上父权限,手改 `/etc/config/nettact` 则不会。

## 使用本地镜像

不想让路由器直连公网时,把 `download_base` 指向自建镜像。镜像需要按同样的结构提供文件:

```
<base>/versions.json
<base>/<版本号>/nettact-agent-lite-linux-<架构>
<base>/<版本号>/SHA256SUMS
```

`versions.json` 至少要有 `latest` 字段:

```json
{"latest":"v1.2.3","versions":[{"tag":"v1.2.3","prerelease":false}]}
```

下载脚本会先把 `latest` 解析成具体版本号,再从那一个不可变的版本目录里同时取程序和 `SHA256SUMS`,并校验 SHA256 后才安装。
