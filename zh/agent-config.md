# Agent 配置(nettact-agent)

`nettact-agent` 是纯出站的监控客户端:不监听任何端口,主动连接 Server 上报遥测、
接收监控目标。**推荐用一个 YAML 配置文件完成全部配置**;每个配置项也有一一对应
的 `NETTACT_AGENT_*` 环境变量(容器等场景使用)。命令行参数只有 `--config`
(指定配置文件),另保留 `--help` / `--version`。

**优先级(从高到低):配置文件 > 环境变量 > 内置默认。** 同一项两处都设时文件
取值胜;文件里没写的项回落到环境变量。任何配置修改都需**重启 Agent** 生效
(不支持热加载)。

本页与 `nettact-agent --help` 逐项对应;若两者不一致,以 `--help` 为准并请报告。

---

## 配置文件(YAML)

最小配置只需一个 `server_url`(首次运行再加一个注册令牌):

```yaml
# nettact-agent.yaml —— 建议权限 600(文件可能包含注册令牌)
server_url: http://<server 主机>:12450
enroll_token_file: /run/secrets/agent_enroll_token   # 首次运行用;或 enroll_token 直接内联
```

完整的带注释模板见 agent 仓库中的 [`agent.example.yaml`](https://github.com/nettact/agent/blob/main/agent.example.yaml)。

### 配置文件的定位顺序(命中即止)

1. `--config <path>` 命令行参数;
2. `NETTACT_AGENT_CONFIG_FILE` 环境变量;
3. 工作目录下的 `./nettact-agent.yaml`;
4. 平台惯例路径:Windows `%ProgramData%\NetTact\agent.yaml`,其它系统
   `/etc/nettact/agent.yaml`(Docker 镜像同此,把文件挂载到该路径即可零环境变量运行)。

规则:

- 经 `--config` 或 `NETTACT_AGENT_CONFIG_FILE` **显式指定**的文件不存在或不可读
  → 启动失败;**显式指定但为空值**(`--config=`、`--config ""`、设为空白的环境
  变量)同样启动失败——指明了配置来源却留空几乎必是部署失误。
- 第 3、4 步**自动探测**的路径缺失则静默跳过,Agent 改用纯环境变量运行。
- 语法错误、未知键、非法取值均启动失败,并给出文件名与行号/键名;报错信息以对应
  的 `NETTACT_AGENT_*` 变量名定位(校验规则与环境变量路径完全共用)。
- 省略某个键 = 使用默认值;**显式写空值(`""`)会被拒绝**,不想设就删掉该键。

---

## 配置项参考

YAML 键与环境变量一一对应,取值、默认与范围完全相同。

### 服务器连接

| YAML 键 | 环境变量 | 默认 | 说明 |
|---|---|---|---|
| `server_url` | `NETTACT_AGENT_SERVER_URL` | —(**必填**) | Server 基址,`http(s)://主机:端口`,如 `http://host:12450`。 |
| `data_dir` | `NETTACT_AGENT_DATA_DIR` | `./agent-data` | Agent 状态目录:身份密钥 `agent.key`、注册凭据 `agent.json`、发送缓冲 `wal.db*`。备份/迁移 Agent 就是备份这个目录。 |
| `tls_insecure` | `NETTACT_AGENT_TLS_INSECURE` | `false` | 跳过 TLS 证书校验——仅限局域网自签名 Server。 |
| `upload_interval` | `NETTACT_AGENT_UPLOAD_INTERVAL` | `5s` | 上传节奏:缓冲的遥测多久批量上传一次。 |
| `wire_format` | `NETTACT_AGENT_WIRE_FORMAT` | `protobuf` | 遥测线格式:`protobuf` 或 `json`。 |

### 注册(首次运行,二选一、互斥)

| YAML 键 | 环境变量 | 默认 | 说明 |
|---|---|---|---|
| `enroll_token` | `NETTACT_AGENT_ENROLL_TOKEN` | 空 | 内联的一次性注册令牌。 |
| `enroll_token_file` | `NETTACT_AGENT_ENROLL_TOKEN_FILE` | 空 | 存放令牌的文件路径(**推荐**,配合 secret 挂载)。 |

### 本地权限策略

| YAML 键 | 环境变量 | 默认 | 说明 |
|---|---|---|---|
| `permissions` | `NETTACT_AGENT_PERMISSIONS` | 内置默认集 | 权限列表(YAML 列表 / 环境变量逗号分隔),或字面量 `none`。**整体替换语义**,见[权限策略](#权限策略)。 |

### 探测目标访问控制

| YAML 键 | 环境变量 | 默认 | 说明 |
|---|---|---|---|
| `probe_access.mode` | `NETTACT_AGENT_PROBE_ACCESS_MODE` | 见下 | `allowlist` 或 `denylist`。 |
| `probe_access.allowlist` | `NETTACT_AGENT_PROBE_ALLOWLIST` | 见下 | 选择器列表(环境变量为 CSV)。 |
| `probe_access.denylist` | `NETTACT_AGENT_PROBE_DENYLIST` | 见下 | 选择器列表,或字面量 `none`(什么都不拒)。 |

详见[探测目标访问控制](#探测目标访问控制-1)。

### 稳定性限额

| YAML 键 | 环境变量 | 默认 | 范围 | 说明 |
|---|---|---|---|---|
| `min_probe_interval` | `NETTACT_AGENT_MIN_PROBE_INTERVAL` | `1s` | `[200ms, 10m]` | 单个监控项两次探测的最小间隔(Server 下发更短间隔时被钳制)。 |
| `max_probe_concurrency` | `NETTACT_AGENT_MAX_PROBE_CONCURRENCY` | `16` | `[1, 256]` | 同时执行的探测上限。 |
| `snapshot_min_interval` | `NETTACT_AGENT_SNAPSHOT_MIN_INTERVAL` | `3s` | `[1s, 10m]` | 故障现场接口快照的最小采集间隔。 |
| `snapshot_timeout` | `NETTACT_AGENT_SNAPSHOT_TIMEOUT` | `10s` | `[1s, 60s]` | 单次快照采集超时。 |
| `max_trace_concurrency` | `NETTACT_AGENT_MAX_TRACE_CONCURRENCY` | `4` | `[1, 64]` | 同时执行的故障 traceroute 上限。 |

---

## 注册流程与令牌时效

Agent 与 Server 的信任建立只发生一次:

1. 管理员在控制台「**Agent**」页签发一枚**一次性注册令牌**(可填备注与有效期,
   默认 **60 分钟**);
2. 首次启动的 Agent 带着令牌调用 Server 的注册接口,换取长期凭据,连同本机
   ed25519 身份密钥一起存入 `data_dir`(`agent.json` / `agent.key`);
3. 之后的每次启动都复用保存的凭据,**不再读取令牌配置**——令牌用后即焚,可以
   从配置里删掉;换发新令牌也不影响已注册的 Agent。

要点:

- 一枚令牌只能注册**一台** Agent;多台机器各签发一枚。
- 令牌过期/已用的表现是 Agent 注册失败反复重试——重新签发一枚、更新配置再启动。
- 优先用 `enroll_token_file`(文件/secret 挂载),避免令牌进入进程环境或 shell 历史;
  两个键同时设置会启动失败。
- 想让一台 Agent"重新注册"(如迁移站点):清空其 `data_dir` 再用新令牌启动,
  Server 侧会出现一个新的 Agent 身份。

---

## 权限策略

Agent 能采集什么、能执行哪类探测,由**本地**权限策略决定——Server 只能在
Agent 授予的范围内下发任务,权限在进程内不可变,修改需重启。

- **不设置 `permissions`**:使用内置默认集(见下),适合标准监控场景。
- **设置 `permissions`**:**整体替换**默认集,不是在默认集上增删。写了什么就
  只有什么(依赖的父权限缺失时子权限自动失效)。
- **`permissions: none`**:空授权,只保留维持运行所必需的最小功能。
- **永不支持通配符**(`*` / `all` 会被拒绝)。

内置默认集(标准探测 + 基础网络状态读取):

```
probe.icmp  probe.dns  probe.http  probe.tcp  probe.nat
network.gateway.probe
network.interface.status.read  network.interface.address.read
network.wifi.status.read
diagnostic.traceroute.icmp  diagnostic.traceroute.tcp
```

默认集**不含**的能力需显式授予才可用,主要有:`probe.http.extended`(自定义
方法/头/请求体的 HTTP 探测)、`network.wifi.ssid.read`、
`network.neighbor.read` / `network.neighbor.hostname.read`(邻居/设备发现)、
`host.*`(CPU/内存/磁盘等主机指标与进程、连接快照——按 `host.cpu.read`、
`host.process.basic.read` 等细分)。完整 ID 清单见控制台 Agent 详情页的权限
视图(其中会同时展示"已授予/平台支持/实际生效"三层)。

---

## 探测目标访问控制

独立于权限的第二道闸:决定探测**可以打到哪些目标**(deny 恒优先于 allow)。

选择器四种写法:

| 选择器 | 含义 | 例 |
|---|---|---|
| `scope:<名>` | 地址类别:`loopback` / `lan` / `link-local` / `public` / `metadata` / `any` | `scope:lan` |
| `cidr:<前缀>` | CIDR 网段 | `cidr:10.0.0.0/8` |
| `ip:<地址>` | 单个 IP | `ip:192.168.1.1` |
| `host:<域名>` | 主机名 | `host:example.com` |

两种模式:

- `allowlist`(默认拒绝):只允许命中 allowlist 的目标;allowlist 不能为空。
- `denylist`(默认允许):只拒绝命中 denylist 的目标;denylist 必须非空,或写
  字面量 `none` 表示什么都不拒。

**默认策略**(不设置 `probe_access` 时):allowlist 模式,允许 `scope:lan` 与
`scope:public`,同时恒拒绝 `scope:loopback`、`scope:link-local`、`scope:metadata`
(云元数据地址,如 169.254.169.254)。即:开箱可探测局域网与公网目标,但不能
探测 Agent 自身回环与云元数据端点。

示例——只允许探测本站点两个网段,严格禁止其它一切:

```yaml
probe_access:
  mode: allowlist
  allowlist:
    - cidr:192.168.1.0/24
    - cidr:10.10.0.0/16
```

---

## 平台能力差异

同一份配置在不同平台上的**实际生效权限**可能不同:实际生效 = 已授予 ∩ 平台
支持(不支持的自动裁剪,不报错),控制台 Agent 详情页可查看三层视图。

- **Windows(裸二进制)**:能力最全。ICMP 探测走系统 `IcmpSendEcho`,**无需
  管理员权限**;网卡/网关/DNS/Wi-Fi 状态走系统 API。
- **Linux(裸二进制)**:标准探测与主机指标(需授予 `host.*`)可用;依赖原始
  套接字的能力(ICMP/traceroute)受运行账户与内核设置影响。
- **Docker(官方 Agent 镜像)**:容器以**非 root**运行、不加任何 capability
  (无 `NET_RAW`),支持 DNS/HTTP/TCP/NAT 探针与主机指标(主机指标仍需按上节
  授予 `host.*` 权限);ICMP 类探测在容器内不可用(会从"实际生效"集中裁剪)。默认监控的是**容器自身**的网络视角,监控
  宿主机需 `network_mode: host`(见[部署篇](./deploy.md#_9-让-agent-监控宿主机-可选-linux))。
