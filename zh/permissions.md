# 权限参考

Agent 能采集什么、能跑哪类探测,由**本地权限策略**决定。策略只能在 Agent 所在的
机器上设置——控制台看得到、但改不了,这是刻意的安全边界:拿下控制台不等于能扩大
任何一台 Agent 的采集范围。

本页是完整的权限清单与设置方法。配置项本身的语法见
[Agent 配置](./agent-config.md)。

## 三层视图

控制台 Agent 详情页把每条权限归入四组之一,判断依据是三个互相独立的事实:

| 事实 | 含义 |
|---|---|
| **已授予** | 本地策略允许 |
| **平台支持** | 这个构建 + 这个操作系统 + **这个进程的权限**能做到 |
| **实际生效** | 已授予 ∩ 平台支持,再剔除父权限没生效的子权限 |

"平台支持"包含运行时权限,不只是编译期能力:同一个 Linux 二进制,以 root 跑就支持
ICMP 探测,以普通用户跑可能就不支持。所以同一份配置在两台机器上生效的权限可以不同,
控制台如实展示差异,不会静默失败。

四组的含义与对策:

- **生效** —— 正常工作。
- **未授予** —— 平台能做,只是策略没给。改策略重启即可,见下一节。
- **受阻** —— 已授予但用不了:要么需要提权,要么本平台没有这个能力,要么它依赖的
  父权限没生效。改策略没用。
- **本机不支持** —— 既没授予,平台也做不到。

## 整体替换语义

**设置 `permissions` 是整体替换默认集,不是在默认集上增删。** 写了什么就只有什么。

这一点最容易踩坑:只想加一个 `host.cpu.read`,结果写 `permissions: [host.cpu.read]`,
把所有探测权限全关掉了。控制台的 Agent 详情页点任一"未授予"权限,弹窗给出的就是
**完整的替换行**(已授予 ∪ 这一条,并自动补齐依赖),照抄即可。

其它规则:

- 字面量 `none` = 空授权,只保留维持运行所必需的功能。
- **永不支持通配符**,`*` 与 `all` 会被拒绝。
- 任何权限改动都需要**重启 Agent**,不支持热加载。

关于依赖,有两种完全不同的情况,别混淆:

1. **你写的列表里,子权限缺了父权限** → **Agent 启动失败**,并明确报出缺哪一条,
   例如 `permission "network.wifi.ssid.read" requires "network.wifi.status.read"`。
   不是静默忽略。配置里必须把父权限一起写上——控制台生成的配置行已经替你补好了。
2. **父权限写了,但当前平台不支持它** → 子权限被**静默裁掉**(不报错,Agent 正常
   运行,该权限就是不生效)。控制台把它列在"受阻",并指出是哪个父权限没生效。

## 预设档位

控制台「Agent」页签发注册令牌时可直接选档,生成的一键命令会带上对应参数。

### 推荐(内置默认集)

不设置 `permissions` 时就是这一档:标准探测 + 基础网络状态。

```
probe.icmp,probe.dns,probe.http,probe.tcp,probe.nat,network.gateway.probe,network.interface.status.read,network.interface.address.read,network.wifi.status.read,diagnostic.traceroute.icmp,diagnostic.traceroute.tcp
```

### 推荐 + 主机指标

再加 CPU、内存、磁盘、负载、运行时长与网络吞吐。绝大多数"想看这台机器忙不忙"的
需求到这里为止。

```
probe.icmp,probe.dns,probe.http,probe.tcp,probe.nat,network.gateway.probe,network.interface.status.read,network.interface.address.read,network.wifi.status.read,host.cpu.read,host.memory.read,host.disk.read,host.load.read,host.uptime.read,host.network.io.read,diagnostic.traceroute.icmp,diagnostic.traceroute.tcp
```

### 全部

全部 29 条,含进程与连接快照。**这一档会读到进程名、进程所属用户、连接的远程地址**,
和"这台机器忙不忙"是完全不同的隐私决定,按需选择。

## 怎么设置

### 接入 Agent 时(推荐)

一键安装脚本接受权限参数,装好即生效,不用装完再回头改。

Windows:

```powershell
& ([scriptblock]::Create((irm https://d.nettact.org/agent/install.ps1))) `
  -ServerUrl 'http://<server 主机>:12450' -Token '<一次性令牌>' `
  -Permissions 'probe.icmp,probe.dns,probe.http,probe.tcp,host.cpu.read,host.memory.read'
```

Linux / macOS:

```bash
curl -fsSL https://d.nettact.org/agent/install.sh | sudo bash -s -- \
  --server-url 'http://<server 主机>:12450' --token '<一次性令牌>' \
  --permissions 'probe.icmp,probe.dns,probe.http,probe.tcp,host.cpu.read,host.memory.read'
```

Docker:

```bash
curl -fsSL https://d.nettact.org/agent/install.sh | bash -s -- --docker \
  --server-url 'http://<server 主机>:12450' --token '<一次性令牌>' \
  --permissions 'probe.icmp,probe.dns,probe.http,probe.tcp,host.cpu.read,host.memory.read'
```

省略该参数 = 使用内置默认集。传 `none` = 空授权。

### 已经装好的 Agent

改配置文件里的 `permissions`,然后重启 Agent。配置文件位置:

| 平台 | 路径 |
|---|---|
| Windows | `%ProgramData%\NetTact\agent.yaml` |
| Linux | `/etc/nettact/agent.yaml` |
| macOS | `/Library/Application Support/NetTact/agent.yaml` |
| Docker | 挂载到 `/etc/nettact/agent.yaml`,或用环境变量 |

```yaml
permissions:
  - probe.icmp
  - probe.dns
  - host.cpu.read
```

重启:

```bash
systemctl restart nettact-agent            # Linux
launchctl kickstart -k system/org.nettact.agent   # macOS
Restart-ScheduledTask -TaskName "NetTact Agent"   # Windows(PowerShell,管理员)
```

### 环境变量

配置文件优先级高于环境变量。容器与 systemd 场景常用后者:

```bash
NETTACT_AGENT_PERMISSIONS=probe.icmp,probe.dns,host.cpu.read
```

```ini
# /etc/systemd/system/nettact-agent.service
[Service]
Environment=NETTACT_AGENT_PERMISSIONS=probe.icmp,probe.dns,host.cpu.read
```

### Desktop

Desktop 版内嵌的 Agent 固定为完全授权(desktop full access),不需要也无法配置权限——
它监控的就是你自己这台电脑。

## 平台支持总表

✅ 支持 · 🔑 需要提权 · ❌ 该平台构建未实现

| 权限族 | Windows | Linux | macOS | Docker |
|---|---|---|---|---|
| DNS / HTTP / TCP / NAT 探测 | ✅ | ✅ | ✅ | ✅ |
| ICMP 探测、网关探测 | ✅ | ✅ | ❌ | ✅ |
| 网卡状态 / 地址、Wi-Fi | ✅ | ✅ | ✅ | ✅ |
| 邻居(设备发现) | ✅ | ✅ | ❌ | ✅ |
| 主机指标 `host.*` | ✅ | ✅ | ✅ | ✅ |
| 进程 / 连接快照 | ✅ | ✅ | ✅ | ✅ |
| ICMP 路径诊断 | ✅ | 🔑 | ❌ | 🔑 |
| TCP 路径诊断 | 🔑 | 🔑 | ❌ | 🔑 |

关于 🔑:

**为什么 ICMP 探测不需要提权**:发一个 echo 再读回复,用**无特权 ping socket**
(`SOCK_DGRAM`/`IPPROTO_ICMP`)就够了,只要内核的 `net.ipv4.ping_group_range` 覆盖
当前 gid——这是常见发行版与 Docker 容器的默认值(`0 2147483647`)。Agent 启动时先试
raw、失败自动回落到 ping socket。实测:宿主机普通用户、以及**不加任何 capability 的
非 root 容器**,ICMP 探测与网关探测都可用。

**路径诊断才是真的要 raw socket**:它必须收到中间路由器回的 Time-Exceeded,
无特权 ping socket 收不到这类报文,只能走 raw(`CAP_NET_RAW` 或 root)。

按平台:

- **Windows**:只有 TCP 路径诊断需要管理员。一键脚本注册的计划任务以 SYSTEM 运行,
  已满足;手工双击运行则需要"以管理员身份运行"。ICMP 走系统 `IcmpSendEcho`,不需要提权。
- **Linux**:ICMP 探测与网关探测开箱可用(见上)。两种路径诊断需 `CAP_NET_RAW` 或
  root;一键脚本装出来的 systemd 服务以 root 运行,默认就是全能力。若把
  `net.ipv4.ping_group_range` 关掉(`1 0`)且又没有 `CAP_NET_RAW`,则连 ICMP 探测
  也会掉——控制台会如实显示为不可用。
- **Docker**:官方镜像**不带**文件 capability(带了会让 `--cap-drop ALL` 的容器
  直接启动失败,而且 Docker 默认 bounding set 本来就含 NET_RAW,等于给每个容器
  都偷偷开了 raw socket)。所以非 root 容器即使 `--cap-add NET_RAW` 也只拿得到
  ping socket——**这个 flag 单独加没有意义**。一键脚本的 `--docker` 宿主机视角用
  `--user 0:0 --cap-add NET_RAW` 拿到 raw,**这一步只为路径诊断**;不加时 ICMP
  探测与网关探测照常可用,只有路径诊断报不可用。
- **macOS**:❌ 的几项在 macOS 构建里尚未实现,授权和提权都无法启用。

### Docker 的另一件事:采的是谁

容器默认只看得到**它自己**的网络与进程。一键脚本 `--docker` 因此默认切到**宿主机视角**:
`--network host --pid host`,并把宿主机的 `/proc`、`/sys` 只读挂进来
(`HOST_PROC` / `HOST_SYS`)。想监控容器本身,加 `--container-view`。

只做一半会得到看起来对、其实错的数据(宿主机网卡配容器进程),所以这几项要么全开、
要么全不开。

## 权限清单

每条权限的用途、依赖与平台情况。

### 探测

#### probe.icmp {#probe-icmp}

用 ICMP(ping)探测目标的可达性与延迟。Windows ✅ / Linux ✅ / macOS ❌。

Linux 上**不需要提权**:走无特权 ping socket 即可,前提是
`net.ipv4.ping_group_range` 覆盖当前 gid(常见默认)。该 sysctl 被关闭且无
`CAP_NET_RAW` 时才不可用。

#### probe.dns {#probe-dns}

解析并探测 DNS 记录(A/AAAA/CNAME 等),记录解析耗时与结果。全平台可用。

#### probe.http {#probe-http}

发起基础 HTTP(S) 探测:仅 `GET`/`HEAD`,无请求体,且请求头限于
`User-Agent`、`Accept`、`Accept-Language`、`Cache-Control`。全平台可用。

#### probe.http.extended {#probe-http-extended}

以自定义方法、请求体或任意请求头发起 HTTP 探测。超出基础档的 HTTP 监控项需要它,
否则会以"权限受阻"停摆。

**依赖:** `probe.http`。全平台可用。

::: warning
这条会让 Agent 发送你在监控项里填的任意请求头,包括 `Authorization`、`Cookie`。
只在确实需要带鉴权探测时授予。
:::

#### probe.tcp {#probe-tcp}

探测 TCP 端口连通性(建连成功/被拒/超时),可选 TLS 握手校验。全平台可用。

#### probe.nat {#probe-nat}

通过 STUN 探测本机所处的 NAT 行为与公网映射。全平台可用。

### 网络状态

#### network.gateway.probe {#network-gateway-probe}

发现默认网关并对其做 ICMP 探测,用于区分"本地网络断了"和"上游断了"。
可用性与 [probe.icmp](#probe-icmp) 完全一致:Windows ✅ / Linux ✅(无需提权)/ macOS ❌。

#### network.interface.status.read {#network-interface-status-read}

读取网卡的启用/连通状态、是否无线、是否回环。**几乎所有网络类能力的根依赖。**
全平台可用。

#### network.interface.address.read {#network-interface-address-read}

读取网卡的 IP 地址、默认网关地址与配置的 DNS 服务器。

**依赖:** `network.interface.status.read`。IP 地址全平台可用;**网关与 DNS 仅
Windows 与 Linux**——macOS 构建没有路由/resolver 适配,这两个字段在 macOS 上始终为空。

::: tip
Linux 的 DNS 配置是全局的(`/etc/resolv.conf`),不像 Windows 那样按网卡区分,
因此 Agent 把这份全局列表归到**持有默认路由**的网卡上——包括
`default dev tun0` 这种没有网关地址的点对点/隧道默认路由。
:::

#### network.wifi.status.read {#network-wifi-status-read}

读取 Wi-Fi 连接状态、信号强度、信道与协商速率。**不含 SSID。**

**依赖:** `network.interface.status.read`。全平台可用(Linux 走 nl80211,无需特权)。

#### network.wifi.ssid.read {#network-wifi-ssid-read}

额外读取当前连接的 Wi-Fi 名称(SSID)。单独拆出来是因为 SSID 是可识别信息:
未授予时 Agent **根本不去读**,而不是读了再抹掉。

**依赖:** `network.wifi.status.read`。全平台可用。

#### network.neighbor.read {#network-neighbor-read}

读取系统的邻居表(ARP / NDP),被动发现局域网上的设备(IP + MAC)。不发包、不扫描,
只读系统已有的表。

Windows ✅ / Linux ✅(netlink,无需特权)/ macOS ❌。

#### network.neighbor.hostname.read {#network-neighbor-hostname-read}

对发现的邻居做反向 DNS,补上主机名。

**依赖:** `network.neighbor.read`。Windows ✅ / Linux ✅ / macOS ❌。

### 主机指标

以下六项全平台可用。容器的宿主机视角下,CPU、内存、运行时长、网络吞吐、负载采到的
是**宿主机**数据(它们经 `HOST_PROC`/`HOST_SYS` 读取);**磁盘是例外**,见下。

#### host.cpu.read {#host-cpu-read}

读取主机 CPU 使用率。

#### host.memory.read {#host-memory-read}

读取主机内存使用量与使用率。

#### host.disk.read {#host-disk-read}

读取各挂载点的磁盘使用量与使用率。

::: warning 容器内的磁盘数据是容器自己的
挂载点清单来自宿主机(`HOST_PROC`),但用量是在**容器的 mount namespace** 里取的:
`/` 得到的是容器 overlay 文件系统,宿主机上其它挂载点在容器里不存在、会被跳过。
所以宿主机视角下**磁盘是唯一一项不反映宿主机的指标**。要监控宿主机磁盘,请在宿主机
上装原生 Agent。
:::

#### host.load.read {#host-load-read}

读取系统平均负载(1/5/15 分钟)。Windows 没有原生的 load average,该项由 gopsutil
从处理器队列长度**合成**,进程刚启动、样本不足时读数接近 0。

#### host.uptime.read {#host-uptime-read}

读取主机开机时长。

#### host.network.io.read {#host-network-io-read}

读取主机网络收发吞吐(bps)。

### 进程快照

进程与连接快照是**按需采集、不落库**的即时快照(控制台"实时进程"页与故障现场),
不会写入历史指标库。

#### host.process.basic.read {#host-process-basic-read}

读取进程基础信息:PID、进程名、状态。**进程族的根依赖。**全平台可用。

#### host.process.owner.read {#host-process-owner-read}

读取每个进程所属的用户。

**依赖:** `host.process.basic.read`。全平台可用。

#### host.process.resource.read {#host-process-resource-read}

读取每个进程的 CPU 与内存占用。

**依赖:** `host.process.basic.read`。全平台可用。

#### host.process.io.read {#host-process-io-read}

读取每个进程的磁盘 I/O。

**依赖:** `host.process.basic.read`。Windows ✅ / Linux ✅ / **macOS ❌**:Agent
会把这条列为可授予,但 macOS 上底层实现返回"未实现",授予后也拿不到 I/O 字段。

### 连接快照

#### host.connection.summary.read {#host-connection-summary-read}

读取网络连接的概要:协议与状态计数,不含地址。**连接族的根依赖。**全平台可用。

#### host.connection.local.read {#host-connection-local-read}

读取连接的本地地址与端口。

**依赖:** `host.connection.summary.read`。全平台可用。

#### host.connection.remote.read {#host-connection-remote-read}

读取连接的**远程**地址与端口。

**依赖:** `host.connection.summary.read`。全平台可用。

::: warning
远程地址能反映这台机器在和谁通信,是隐私敏感度最高的一项。按需授予。
:::

#### host.connection.owner.read {#host-connection-owner-read}

读取每条连接归属哪个进程。

**依赖:** `host.connection.summary.read`。全平台可用。

### 路径诊断

路径诊断是故障发生时按需触发的一次性 traceroute,不是周期采集。

#### diagnostic.traceroute.icmp {#diagnostic-traceroute-icmp}

用 ICMP 追踪到目标的网络路径,逐跳记录响应者与延迟。

Windows ✅(走 iphlpapi,无需管理员)/ Linux 🔑(需 `CAP_NET_RAW` 或 root)/ macOS ❌。

#### diagnostic.traceroute.tcp {#diagnostic-traceroute-tcp}

用 TCP SYN 追踪路径。对只放行特定端口、丢弃 ICMP 的路径更有效。

Windows 🔑(需管理员或以 SYSTEM 运行的服务)/ Linux 🔑(需 `CAP_NET_RAW` 或 root)/ macOS ❌。

两种模式独立授权:一台机器可以只有其中一种可用,控制台会如实展示。

## 常见问题

**改了配置没生效。**
权限在进程内不可变,必须重启 Agent。另外确认改对了地方:配置文件优先级高于环境变量,
两处都写时文件取胜。

**Agent 起不来,报 `permission "X" requires "Y"`。**
配置里写了子权限却没写父权限。这一类是**启动失败**,不是静默忽略——把父权限补进
列表再启动。控制台弹窗给的配置行已经包含依赖闭包,直接用即可。

**授予了子权限却不生效,也没报错。**
和上一条不同:父权限**写了**,但当前平台不支持它,于是子权限被静默裁掉。控制台
Agent 详情页会把它列在"受阻",并指出是哪个父权限没生效。

**Linux 上路径诊断不生效,但 ICMP 探测正常。**
这是预期的:路径诊断要收中间跳的 Time-Exceeded,必须 raw socket(`CAP_NET_RAW`
或 root),而 ICMP 探测用无特权 ping socket 就够。一键脚本装的 systemd 服务以
root 运行,两者都有;容器需以 root 运行(`--user 0:0 --cap-add NET_RAW`)。

**Linux 上连 ICMP 探测也不生效。**
说明 `net.ipv4.ping_group_range` 被关掉了(值为 `1 0`)且进程没有 `CAP_NET_RAW`。
放开该 sysctl,或让 Agent 以 root / 带 `CAP_NET_RAW` 运行。

**容器里采到的是容器自己的数据。**
用 `--container-view` 装的,或是手工 `docker run` 没加宿主机视角那几项。见上文
[Docker 的另一件事](#docker-的另一件事-采的是谁)。

**控制台能不能远程改权限?**
不能,这是安全设计。控制台只能显示现状并告诉你该在 Agent 端配什么。
