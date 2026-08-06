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

## 安装

```sh
opkg update
opkg install ca-bundle
opkg install https://d.nettact.org/agent/nettact-agent.ipk
opkg install https://d.nettact.org/agent/luci-app-nettact.ipk
```

::: tip HTTPS 支持
`opkg` 通过 HTTPS 下载需要镜像库里有 `libustream-mbedtls`(或 openssl / wolfssl 版本)和 `ca-bundle`。官方固件默认已经包含;若 `opkg install` 报 SSL 错误,先装上它们。
:::

装完后服务处于**停止且未启用**状态——安装一个包不应该让路由器立刻开始向某个还没填的服务器上报。

## 配置

在 LuCI 里打开 **服务 → NetTact**,填写服务器地址和注册令牌,选择存放模式,然后启用。

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

| 选项 | 默认值 | 说明 |
| --- | --- | --- |
| `enabled` | `0` | 总开关。必须同时设为 `1` 且填写了 `server_url`,服务才会启动。 |
| `mode` | `ram` | `ram` 或 `flash`,见上文。填其他值按 `ram` 处理。 |
| `server_url` | 空 | NetTact 服务器地址,如 `https://nettact.example.com`。 |
| `enroll_token` | 空 | 一次性注册令牌。注册成功后不再使用,可以清空。 |
| `tls_insecure` | `0` | 接受无法验证的服务器证书。仅用于自建 CA 或你自己控制的 IP 地址服务器。 |
| `upload_interval` | `30s` | 遥测上报间隔。 |
| `download_base` | `https://d.nettact.org/agent` | 下载源,可改为本地镜像。 |
| `version` | `latest` | `latest`,或锁定某个版本如 `v1.2.3`。 |

其余 Agent 选项参见 [Agent 配置](/zh/agent-config);init 脚本把 UCI 选项转成对应的 `NETTACT_AGENT_*` 环境变量传给进程,并不生成 YAML 文件。如果你需要用到没有暴露在 UCI 里的选项,手写一个 `/etc/nettact/agent.yaml` 即可——Agent 会自动发现它,且文件优先级高于环境变量。

::: warning 一台路由器只对应一台 Server
LuCI 与 UCI 描述的是**单台** Server:只有一个 `server_url`、一个 `enroll_token`,没有可重复的条目。让 Agent [同时向多台 Server 上报](/zh/agent-config#同时向多台-server-上报)的 `servers:` 列表在这里**用不了**,手写进 `/etc/nettact/agent.yaml` 也不行:init 脚本始终会从 UCI 导出 `NETTACT_AGENT_SERVER_URL` 与 `NETTACT_AGENT_TLS_INSECURE`,而它们与 `servers:` 互斥,Agent 会直接启动失败而不是合并两者。按这种方式安装的路由器只向一台 Server 上报。
:::

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

路由器上的构建(资产名带 `-lite-`)去掉了两样东西:

- **不支持 WireGuard 出口探测。** 用户态 WireGuard 加上它依赖的 gVisor 网络栈是二进制里最大的一块。如果某个监控项指定了走 WireGuard 代理,该监控项会明确报配置错误,**不会**退回直连——否则测出来的就是另一条路径的数据。SOCKS5 和 HTTP CONNECT 代理仍然可用。
- **遥测缓冲只在内存里。** 桌面/服务器版本在上报中断时会把缓冲写到磁盘;路由器版不会,因为那意味着拿闪存的擦写寿命去存一批本来就要立刻上传的数据。代价是断电或崩溃会丢掉尚未上报的缓冲(有上限)。身份信息不受影响,始终在闪存上。

其余探测能力(ICMP、DNS、HTTP、TCP、NAT 行为、traceroute、接口与无线状态)完全一致。

## 升级与维护

**更新 Agent 程序**:在 LuCI 状态页点「下载 / 更新程序」,或

```sh
/usr/lib/nettact/fetch.sh install
/etc/init.d/nettact restart
```

内存模式下每次开机本来就会重新下载,只要 `version` 是 `latest`,重启即是升级。

**更新安装包本身**:重新 `opkg install` 对应的 `.ipk` URL 即可。

**系统升级(sysupgrade)**:包里带了 `/lib/upgrade/keep.d/nettact`,`/etc/config/nettact` 和 `/etc/nettact/data` 会自动保留,升级后不需要重新注册。

**卸载**:

```sh
opkg remove luci-app-nettact nettact-agent
rm -rf /etc/nettact        # 连同身份信息一起删除
```

`opkg remove` 会停掉服务并删除下载的程序,但保留 `/etc/nettact`,这样重装后不必重新注册。要彻底清除请手动删除该目录。

## 排查

```sh
logread -e nettact              # 服务日志
/etc/init.d/nettact status      # 是否在运行
/usr/lib/nettact/fetch.sh arch  # 本机识别出的架构
ls -l /etc/nettact/data/        # 有 agent.json 即表示注册成功
```

几种常见情况:

- **服务启动后立刻退出。** 检查 `enabled=1` 且 `server_url` 已填。两者缺一,init 脚本会记一条日志然后正常退出。
- **一直卡在等待。** 启动脚本会等系统时间和默认路由就绪各最多 5 分钟。没有 RTC 的路由器开机时间停在 1970 年,会让所有 TLS 证书都「尚未生效」;确认 `sysntpd` 在跑。
- **下载失败。** 确认装了 `ca-bundle`,并且 `download_base` 可达。用 `uclient-fetch -O- <url>` 手动试一下。
- **提示架构不支持。** 把 `opkg print-architecture` 的输出附在 issue 里。

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
