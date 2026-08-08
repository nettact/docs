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
一个 Agent 也可以**同时向多台 Server 上报**,并给每台单独授权,见
[同时向多台 Server 上报](#同时向多台-server-上报)。

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
| `server_url` | `NETTACT_AGENT_SERVER_URL` | —(**必填**) | Server 基址,`http(s)://主机:端口`,如 `http://host:12450`。改用 [`servers:`](#同时向多台-server-上报) 列表时不需要它。 |
| `data_dir` | `NETTACT_AGENT_DATA_DIR` | `./agent-data` | Agent 状态目录:身份密钥 `agent.key`、注册凭据 `agent.json`(每台 Server 一份)、发送缓冲目录 `wal/`。备份/迁移 Agent 就是备份这个目录。 |
| `status_file` | `NETTACT_AGENT_STATUS_FILE` | 空(关闭) | 在该路径写一个 JSON 连接状态文件——按 Server 分别记录:连没连上、为什么没连上、下次何时重试、积压多少条。见[查看连接状态](#查看连接状态)。 |
| `tls_insecure` | `NETTACT_AGENT_TLS_INSECURE` | `false` | 跳过 TLS 证书校验——仅限局域网自签名 Server。 |
| `upload_interval` | `NETTACT_AGENT_UPLOAD_INTERVAL` | `30s` | 上传节奏:缓冲的遥测多久批量上传一次。调小会让面板更新更及时,代价是 Server 侧磁盘写入大致线性增加。 |
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

## 同时向多台 Server 上报

一个 Agent 可以同时向多台 Server 上报——比如家里一台、公司一台——并且
**每台 Server 各有一份权限授权**。把 `server_url` 换成 `servers:` 列表即可:

```yaml
servers:
  - name: home
    url: http://192.168.1.10:12450
    enroll_token_file: /run/secrets/home_enroll_token
  - name: work
    url: https://nettact.corp.example:12450
    enroll_token_file: /run/secrets/work_enroll_token
    permissions:            # 这台 Server 就只有这两项
      - probe.icmp
      - probe.dns
```

`servers:` 是**唯一只存在于配置文件**的配置项。其余每一项都是"一个键 = 一个环境
变量 = 一个字符串",而一组记录的列表放不进这个模型,所以没有
`NETTACT_AGENT_SERVERS`。

### 条目字段

| 键 | 默认 | 说明 |
|---|---|---|
| `name` | —(**必填**) | 这台 Server 的唯一标识,不超过 64 个字符,只能用小写字母、数字、`-` 和 `_`。见[名字就是身份](#名字就是身份)。 |
| `url` | —(**必填**) | 这台 Server 的基址,`http(s)://主机:端口`。 |
| `enroll_token` | 空 | **这台 Server** 的一次性注册令牌,内联写法。 |
| `enroll_token_file` | 空 | 存放该令牌的文件路径(**推荐**)。同一条目内与 `enroll_token` 互斥。 |
| `tls_insecure` | `false` | 只对这台 Server 跳过 TLS 证书校验。 |
| `permissions` | 顶层的 `permissions` | 对这台 Server **整体替换**顶层授权。语法与整体替换语义完全相同,`none` 表示什么都不授。 |
| `probe_access` | 顶层的 `probe_access` | 对这台 Server **收紧**顶层策略。语法相同,但只能收紧,不能放宽。 |

每台 Server 都要各自完成一次注册,所以每个条目都需要一枚在对应控制台上签发的令牌。

### 与单 Server 写法互斥

`servers:` 与 `server_url`、`enroll_token`、`enroll_token_file`、`tls_insecure`
互斥——包括这些值来自环境变量而不是配置文件的情况。两者同时出现是**启动失败**,
不会合并:

```
`servers:` and NETTACT_AGENT_SERVER_URL are mutually exclusive; put the setting inside the servers entry
```

列表的顺序有含义(见下),混着写就说不清哪一条是第一条,所以 Agent 直接拒绝而不去
猜。其余配置项——`data_dir`、`upload_interval`、`wire_format`、稳定性限额——仍然留在
顶层,对整个 Agent 生效。

单 Server 写法完全等价于**一个名为 `default` 的条目**。因此把它照抄成单元素列表,
对已注册的 Agent 不会有任何变化,是为将来加第二台 Server 预留位置的无损写法:

```yaml
servers:
  - name: default            # 与单 Server 写法用的名字一致
    url: http://<server 主机>:12450
```

### 名字就是身份

`name` 不是显示用的标签。它是 `agent.json` 里那份凭据的键,也是该 Server 待发送
队列的键;它刻意**不从 URL 推导**——URL 是会被改的(换端口、把 IP 换成域名),改
地址不该看起来像换了一台机器。

由此带来的后果是:**改名会让 Agent 在那台 Server 上重新注册**成一个新 Agent,该
Server 队列里尚未发出的数据也随之丢弃。要迁移一台 Server,正确做法是保持 `name`
不变、只改 `url`。

### 第一条拥有游戏采集

帧率与游戏遥测来自唯一一个传感器子进程,而它采集哪些游戏是由 Server 下发的;两台
Server 各下发一份就会把它来回重启。所以归属是指定的而非协商的:**列表里的第一条**
负责配置传感器并接收其数据。其余条目下发的游戏配置一律忽略,也不会为它们排队任何
游戏数据——加一台公司的 Server 不会顺带把你玩什么上报出去。其它数据(探测、主机
指标、故障诊断)则会为每一台被授权的 Server 采集。

### 各台 Server 互不影响

每个条目都有自己的凭据、自己那台 Server 下发的监控目标、自己的发送队列。某台
Server 不可达、把这台 Agent 吊销、或者会话被另一个 Agent 顶替,都不影响其余各台
继续上报,出问题的那台自行重试。

各台的监控目标是各自独立执行的,所以两台 Server 盯同一个地址时该地址会被探测两遍。
真正共用的是这台机器本身:一把身份密钥(`agent.key`)、一个 `data_dir`、一份上传
节奏、一套[稳定性限额](#稳定性限额)(两台 Server 同时要 traceroute 时用的是同一份
并发预算),以及顶层的[探测目标访问控制](#探测目标访问控制-1)——那是谁都越不过去的
底线。

---

## 注册流程与令牌时效

Agent 与 Server 的信任建立只发生一次:

1. 管理员在控制台「**Agent**」页签发一枚**一次性注册令牌**(可填备注;从控制台
   签发的令牌有效期为 **24 小时**);
2. 首次启动的 Agent 带着令牌调用 Server 的注册接口,换取长期凭据,连同本机
   ed25519 身份密钥一起存入 `data_dir`(`agent.json` / `agent.key`);
3. 之后的每次启动都复用保存的凭据,**不再读取令牌配置**——令牌用后即焚,可以
   从配置里删掉;换发新令牌也不影响已注册的 Agent。

要点:

- 一枚令牌只能在**一台** Server 上注册**一台** Agent;多台机器各签发一枚,一台
  Agent 要上报多台 Server 时也是每台 Server 各签发一枚。
- 令牌过期/已用的表现是 Agent 注册失败反复重试——重新签发一枚、更新配置再启动。
- 优先用 `enroll_token_file`(文件/secret 挂载),避免令牌进入进程环境或 shell 历史;
  两个键同时设置会启动失败。
- 想让一台 Agent"重新注册"(如迁移站点):清空其 `data_dir` 再用新令牌启动,
  Server 侧会出现一个新的 Agent 身份。

---

## 查看连接状态

连不上 Server 的 Agent 照样在跑、照样在重试,所以"进程活着"完全说明不了有没有
数据在上报。有两条途径可以看到真相,它们给出的事实是同一批。

### 看日志

每台配置的 Server 用 `[名字]` 给自己的日志行打标签。有两行是关键:

```
[default] connected to https://nettact.example.com (agent 3f2a9c1e)
[default] session ended (tls_cert_expired): dial: … x509: certificate has expired …; reconnecting in 32.1s (pending 247)
```

第一行表示会话已建立。第二行是每次失败尝试各一行,答案全在里面:括号里是失败的
类别,后面是原始错误,再往后是下次重试的时间,以及这次中断背后积压了多少条。
重连退避从 1s 指数增长到 30s 封顶,在此基础上再叠±20% 抖动(所以单次间隔最大约 36s),避免一批 Agent 在同一台 Server 掉线后齐步重试。因此一台连不上的 Server 大约每分钟两行,不会刷屏。

注册阶段——Agent 还没有凭据的时候——退避更慢,并有自己的日志行:

```
[default] enrollment failed, retrying in 40s: enroll: … the token has already been used …
```

到哪里去看这些输出:

| Agent 的安装方式 | 命令 |
|---|---|
| Linux,安装脚本(systemd) | `journalctl -u nettact-agent -f` |
| macOS,安装脚本(launchd) | `tail -f /var/log/nettact-agent.log` |
| Docker | `cd ~/nettact-agent && docker compose logs -f` |
| OpenWrt | `logread -e nettact`,或者看 LuCI 状态页 |
| Windows,计划任务 | 计划任务会丢弃输出——请改用下面的[状态文件](#状态文件),或在控制台里前台运行以实时查看 |
| 手动运行 | 就在 stderr,在你眼前 |

### 失败原因代码

括号里的词是一个稳定的代码,可以直接搜索、也可以被翻译;它后面的原始错误则会
指明是哪台主机、哪张证书。

| 代码 | 发生了什么 | 通常怎么修 |
|---|---|---|
| `dns` | 服务器域名解析不了 | 检查主机名,以及这台机器的 DNS |
| `refused` | 主机有响应,但那个端口没人监听 | 检查端口,以及 Server 是否在运行 |
| `timeout` | 连接或握手超时 | 通常是防火墙在丢包而不是拒绝 |
| `tls_cert_expired` | 服务器证书不在有效期内 | 换证书——也可能是本机时钟不对,现象一模一样 |
| `tls_cert_untrusted` | 证书链追溯不到受信任的根 | 安装该 CA,或在自己局域网内用 `tls_insecure` |
| `tls_hostname` | 证书有效,但签的是另一个名字 | 用证书签发的那个名字去连 |
| `tls` | 其他 TLS 握手失败 | 确认那个端口确实在讲 TLS |
| `auth` | Server 拒绝了 Agent 凭据(401/403) | 多半是 Agent 已在 Server 侧被删除,重新注册即可 |
| `ack_timeout` | 会话还开着,但不再确认上传 | 通常是中间设备把一条死连接维持着 |
| `superseded` | 另一个进程用同一份凭据连上了 | 两个 Agent 共用了一个数据目录,各给一个 |
| `schema_mismatch` | Server 拒绝了本 Agent 的协议版本 | 升级 Agent 或 Server |
| `revoked` | Agent 已在 Server 上被删除 | 只要有令牌可用,它会自行重新注册 |
| `enroll_rejected` | Server 收到注册请求并明确拒绝了 | 令牌已用过或已过期,或站点 Agent 数已达上限 |
| `local_state` | 注册交换成功了,但凭据没能写进磁盘 | 数据目录满了、只读或不可写。这枚一次性令牌已经作废,腾出空间后需用新令牌重新注册 |

会话类失败会像上面那样把代码打在日志的括号里。注册与终止类代码——`no_token`、
`enroll_rejected`、`local_state`、`stopped`——不走这条路:它们写在状态 JSON 的
`last_error.code`(以及 OpenWrt 状态页)里,要查就查那里,而不是日志。
| `no_token` | 既没有凭据,也没有获取凭据的途径 | 在控制台签发注册令牌并配置上 |
| `stopped` | 这台 Server 的 runner 放弃了,原因不属于上面任何一个代码 | 看 `last_error.detail`,以及 `since` 那个时间点前后的日志 |
| `network` | 应用层以下出了问题,且不属于上面任何一种 | 看同一行里的原始错误 |

### 状态文件

`status_file` 把同样的事实写成 JSON,供那些不会有人去看日志的安装场景使用。
默认关闭;OpenWrt 安装包会替你设好,LuCI 状态页会把它渲染出来。

```yaml
status_file: /run/nettact/status.json
```

```json
{
  "schema": 1,
  "pid": 4211,
  "agent_version": "v0.5.0",
  "started_at": 1723100000,
  "updated_at": 1723100123,
  "servers": [
    {
      "name": "default",
      "url": "https://nettact.example.com",
      "state": "waiting_retry",
      "agent_id": "3f2a9c1e",
      "since": 1723100100,
      "last_connected_at": 1723099000,
      "next_retry_at": 1723100155,
      "last_error": { "code": "tls_cert_expired", "detail": "dial: … x509: certificate has expired …" },
      "pending": 247
    }
  ]
}
```

- `state` 取值为 `enrolling`、`connecting`、`connected`、`waiting_retry` 或
  `terminal`。`terminal` 表示这台 Server 的 runner 已经放弃,不会再自行重试。
- 时间都是 Unix 秒。`next_retry_at` 是绝对时刻,所以由它算出的倒计时,无论文件
  多旧都仍然正确。
- `pending` 是这台 Server 尚未发出的积压量——就是"这次中断有没有在丢数据"的那个
  数字。
- 它以原子替换方式写入,可以放心轮询。它在每次重连尝试时都会重写,所以在意闪存
  寿命的设备上请把它放到内存文件系统上(`/run`、`/tmp`)。
- Agent 正常退出时会删除它。文件还在,就说明 Agent 不是正常退出的——因此只有在
  进程仍在运行时,才把它当作实时状态。

在路由器(lite)构建上行为完全相同。

## 权限策略

Agent 能采集什么、能执行哪类探测,由**本地**权限策略决定——Server 只能在
Agent 授予的范围内下发任务,权限在进程内不可变,修改需重启。

- **不设置 `permissions`**:使用内置默认集(见下),适合标准监控场景。
- **设置 `permissions`**:**整体替换**默认集,不是在默认集上增删。写了什么就
  只有什么(依赖的父权限缺失时子权限自动失效)。
- **`permissions: none`**:空授权,只保留维持运行所必需的最小功能。
- **永不支持通配符**(`*` / `all` 会被拒绝)。
- **每台 Server 一份授权。** 上报多台 Server 的 Agent 可以给每台不同的授权,见
  [同时向多台 Server 上报](#同时向多台-server-上报);此时顶层的 `permissions` 是
  条目没写自己那份时继承的默认值。

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
`host.process.basic.read` 等细分)。

**完整的权限 ID 清单、每条权限的用途与平台支持情况、以及接入时如何选权限,见
[权限参考](./permissions.md)。** 控制台 Agent 详情页同样会展示"已授予 / 平台支持 /
实际生效"三层视图,并给出可直接复制的配置行。

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

与 `permissions` 不同,这道闸是**机器主人的底线**:上报多台 Server 的 Agent 可以给
某一台[更窄的 `probe_access`](#同时向多台-server-上报),但永远不能更宽——目标必须
同时通过两层。

---

## 平台能力差异

同一份配置在不同平台上的**实际生效权限**可能不同:实际生效 = 已授予 ∩ 平台
支持(不支持的自动裁剪,不报错),控制台 Agent 详情页可查看三层视图。注意"平台
支持"包含**运行时权限**——同一个二进制以 root 跑和以普通用户跑,支持的权限可以不同。

- **Windows(裸二进制)**:能力最全。ICMP 探测与 ICMP 路径诊断走系统
  `IcmpSendEcho`,**无需管理员权限**;网卡/网关/DNS/Wi-Fi 状态走系统 API。只有
  TCP 路径诊断需要管理员(一键脚本注册的计划任务以 SYSTEM 运行,已满足)。
- **Linux(裸二进制)**:能力与 Windows 基本对齐——ICMP 探测、网关探测、邻居发现、
  ICMP/TCP 路径诊断均已实现。一键脚本装出的 systemd 服务以 root 运行,默认全能力。
  以普通用户运行时:路径诊断必须有 `CAP_NET_RAW`(它要收中间路由的 Time-Exceeded,
  只有裸 socket 能收),而 ICMP 探测与网关探测还有一条退路——非特权 ping socket,
  条件是内核 `net.ipv4.ping_group_range` 覆盖当前进程的 gid。多数发行版在裸机上
  默认开着这个区间,**容器里则相反**(见下)。邻居发现走 netlink,不需要任何特权。
- **macOS(裸二进制)**:网络能力与 Linux 对齐。ICMP 探测与网关探测**任意用户可用**
  ——macOS 的 datagram ICMP socket 没有 `ping_group_range` 这类开关;邻居发现走
  路由 `sysctl`,同样无需特权。两种路径诊断都需要 raw ICMP socket,即 Agent 要
  **以 root 运行**(一键脚本装出的 LaunchDaemon 就是 root;手工运行需 `sudo`)。
  主机温度读取未实现,进程级 I/O 计数在 macOS 上不可用。
- **Docker(官方 Agent 镜像)**:镜像是 Linux 构建,能力同 Linux,但镜像**故意不带**
  `cap_net_raw` 文件能力(带了的话,`--cap-drop ALL` 这种常见加固会让 execve 直接
  EPERM,容器根本起不来;而且 Docker 默认 bounding set 里就有 NET_RAW,等于偷偷把
  裸 socket 发给每个容器)。所以裸 socket 靠**运行时**给:`--user 0:0` 加
  `--cap-add NET_RAW`——只加 `--cap-add` 对非 root 进程无效,它的 permitted set 是空的。
  **默认监控的是宿主机**:一键脚本 `--docker` 生成的 compose 带 `network_mode: host`、
  `pid: host`、`user: "0:0"`、`cap_add: [NET_RAW]` 并只读挂载宿主机 `/proc`、`/sys`;
  要改为监控容器自身,加 `--container-view`——那时容器保持非 root,没有路径诊断,但
  ICMP 探测与网关探测仍可用,靠生成的 compose 里那句
  `sysctls: net.ipv4.ping_group_range: "0 2147483647"`。**这句必须有**:新网络命名
  空间的内核默认值是 `1 0`(空区间),dockerd 不会改它,所以容器里"普通用户能 ping"
  这个裸机上的常识**不成立**。细节见[部署篇](./deploy.md#_10-宿主机视角与容器视角-docker-安装)。

各权限逐条的平台情况见[权限参考](./permissions.md#平台支持总表)。


## OpenWrt 路由器版(lite 构建)

路由器上跑的是一个裁剪过的构建(发布资产名里带 `-lite-`),与其它平台有两点行为差异:

- **不支持 WireGuard 出口探测。** 用户态 WireGuard 及其依赖的 gVisor 网络栈是二进制里最大的一块,去掉后体积从约 20 MB 降到约 11 MB。指定了 WireGuard 代理的监控项会报一次配置错误(`ReasonProxyConfig`),**不会**退回直连——否则测出来的是另一条路径。SOCKS5 与 HTTP CONNECT 代理不受影响。
- **遥测缓冲只在内存中,不落盘。** 其它平台在上报中断时会把缓冲写到 `data_dir`;路由器版不会,因为那意味着用闪存擦写寿命去存一批马上就要上传的数据。代价是崩溃或断电会丢掉尚未上报的缓冲(有上限)。身份文件(`agent.key`、`agent.json`)不受影响,始终写在闪存上,重启后不需要重新注册。

其余探测能力与 Linux 构建完全一致。安装与配置见 [OpenWrt 路由器安装](./openwrt.md)。
