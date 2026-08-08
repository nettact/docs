# 一键部署

用 Docker Compose 部署 NetTact 的 **Server**。Server 提供 Web 控制台。

**Agent 不在这套 compose 里**,它装在每一台你想监控的机器上——包括 Server 这台——
用控制台签发的一次性令牌接入,见[第 9 节](#_9-在机器上安装-agent)。Agent 是纯出站
客户端(不监听任何端口),通过网络主动连到 Server。

安装脚本、裸二进制、校验文件和历史版本统一通过
[NetTact 下载中心](https://d.nettact.org) 分发。下载中心由 Cloudflare Worker 从
官方 GitHub Release 获取资产，也支持私有仓库；部署端无需 GitHub Token。

> 适用版本:Docker Engine 24+ 且自带 Compose v2(`docker compose` 子命令)。
> 旧的独立 `docker-compose`(v1)未测试。

配置项的完整参考见:[Server 配置](./server-config.md) · [Agent 配置](./agent-config.md)。

---

## 1. 一键部署脚本(Linux)

在只装了 Docker 的 Linux 主机上,一条命令部署 Server——把 compose 资产放进
`~/nettact`、生成 `.env`、拉起 Server、等待健康,最后打印控制台地址与首启密码:

```bash
curl -fsSL https://d.nettact.org/install.sh | bash
```

倾向先审阅再执行的话:

```bash
curl -fsSL https://d.nettact.org/install.sh -o install.sh
less install.sh
bash install.sh
```

常用参数(`bash install.sh --help` 看全部):

| 参数 | 作用 |
|---|---|
| `--port <n>` | 控制台端口(写入 `.env` 的 `NETTACT_HTTP_PORT`,默认 12450) |
| `--server-version <tag>` | 钉住 Server 镜像版本(默认 `latest`) |

| 环境变量 | 作用 |
|---|---|
| `NETTACT_INSTALL_DIR` | 安装目录(默认 `~/nettact`) |
| `NETTACT_DIST_BASE_URL` | compose 资产的下载源,可指向内网镜像 |

**脚本只装 Server,不装 Agent。** 哪些机器该被监控是一台一台决定的事,而 Agent
有自己的安装器、自己的版本节奏;顺手塞一个进来,只会让人以为"本机 Agent"是 Server
的一部分。装完照第 9 节在目标机器上装 Agent 即可,Server 这台也一样。

**安装目录是 `~/nettact`,不是执行脚本时所在的目录。** 部署比创建它的那个 shell
活得久,compose 文件和 `.env` 需要一个固定的家:既不该是会被 `git pull` 覆写的工作树,
也不该是某人当时恰好待着的目录。之后所有运维命令都在那里跑:

```bash
cd ~/nettact && docker compose ps
```

从 NetTact checkout 里执行时,会把该 checkout 的 `docker-compose.yml` 与 `.env.example`
**复制**进安装目录再部署;找不到本地文件则从 `https://d.nettact.org` 下载。

脚本**幂等**:重复执行不动已有的 `.env` 与数据卷;部分失败后重跑安全;每步失败都会
打印原因与对应的手工兜底命令。

> **已有部署在别的目录**时脚本会停下来说明,而不是硬装。compose 用目录名当项目名,
> 换目录等于换项目——旧部署的容器和**数据卷**在新目录下根本看不见,而它固定的容器名
> 还占着。照提示二选一:`NETTACT_INSTALL_DIR=<旧目录>` 原地安装,或在旧目录
> `docker compose down` 之后再来(旧库不会自动迁移过来)。

脚本源码归属 `server` 仓库,路径为
[`deploy/install.sh`](https://github.com/nettact/server/blob/main/deploy/install.sh)。

以下各节是同一流程的**手工版**,也是理解各步骤与排障的参考。

---

## 2. 快速开始(Docker Compose)

把 `docker-compose.yml` 与 `.env.example` 放进一个固定目录(下面用 `~/nettact`,
一键脚本用的也是它),然后:

```bash
mkdir -p ~/nettact && cd ~/nettact
# 从 checkout 复制,或:curl -fsSLO https://d.nettact.org/docker-compose.yml
#                       curl -fsSLO https://d.nettact.org/.env.example

# 1) 准备配置
cp .env.example .env
# 按需检查 .env(端口、镜像版本等);无需设置管理员口令——首启自动生成

# 2) 启动 Server
docker compose up -d server

# 3) 从日志读取首启自动生成的管理员密码(仅打印一次)
docker compose logs server            # 找到 "NetTact first run" 区块里的 username / password

# 4) 打开控制台并登录
#    http://localhost:12450  (端口由 .env 的 NETTACT_HTTP_PORT 决定)
#    用上一步日志里的账号密码登录;登录后到 Settings 修改密码
#    (或用 `docker compose exec server nettact-server passwd -db /data/nettact.db`)
```

到这里 Server 就绪,但**还没有任何机器被监控**——下一步是在控制台「Agent」页签发
一次性注册令牌,再照[第 9 节](#_9-在机器上安装-agent)把 Agent 装到目标机器上。

注册令牌 24 小时内有效、仅可使用一次;注册成功后 Agent 把凭据保存在自己的
数据卷里,之后重启不再需要令牌。细节见 [Agent 配置 — 注册流程](./agent-config.md#注册流程与令牌时效)。

### 关于 HTTPS 与会话 Cookie

默认(`-secure-cookie auto`)下,会话 Cookie 只在 Server 自己跑 TLS 时才带 `Secure`
标志,所以**纯 HTTP 部署开箱即可登录**。生产环境建议:

- 给 Server 配 TLS(见下方[启用 HTTPS](#_8-启用-https-可选)),或
- 前置一个终止 TLS 的反向代理(Caddy/Nginx/Traefik),并在 `.env` 设
  `NETTACT_SECURE_COOKIE=true`(浏览器侧是 https,Cookie 应带 Secure)。

---

## 3. 查看状态

在安装目录(`~/nettact`)下:

```bash
docker compose ps                 # 容器与健康状态(server 应为 healthy)
docker compose logs -f server     # Server 日志
curl -f http://localhost:12450/api/v1/healthz   # 健康检查,返回 {"status":"ok"}
```

健康检查区分「进程在」与「服务可用」:它真正请求 `/api/v1/healthz`,DB 迁移或监听
未就绪时不会变 healthy。

Agent 的日志在它自己那台机器上看,见[第 9 节](#_9-在机器上安装-agent)。

---

## 4. 自动更新(默认开启)

`install.sh` 默认给 Server 挂一个 **Watchtower 旁车容器**(`nettact-server-updater`),
每晚在**凌晨窗口(02:00–05:00)内一个随机时刻**(首次安装时烘焙进
`NETTACT_UPDATE_CRON`,宿主机本地时间)自动 `pull` 新镜像并重建 Server 容器,无需手动
操作。关闭方式二选一:

- 重新运行安装脚本:`install.sh --no-auto-update`(会删掉 `.env` 里的
  `COMPOSE_PROFILES=updater`,并停掉正在运行的旁车容器);或
- 手动编辑:删掉 `.env` 里的 `COMPOSE_PROFILES=updater` 那一行,再
  `docker compose up -d --remove-orphans` 停掉旁车。

开关由 `.env` 的 `COMPOSE_PROFILES=updater` 控制:只要这一行在,手工
`docker compose up -d` 也会一起启动旁车;删掉它,旁车就不再是配置的一部分。注意
`NETTACT_AUTO_UPDATE` **不是**开关——它只是告诉 Server「本实例由旁车管理」,供控制台的
软件更新面板调整措辞;把它改成 `false` 而**不**删 `COMPOSE_PROFILES=updater`,旁车仍会
照常自动更新。

**权限与风险**:`nettact-server-updater` 挂载了宿主机的 Docker socket
(`/var/run/docker.sock`),这等价于宿主机 root 权限——Watchtower 靠它读取镜像仓库、
重建容器,这是自动更新的工作原理,也是为什么默认开启的旁车值得你知情。若你不接受,
按上面任一方式关闭即可。

**自动更新会跨 Schema 迁移**:Server 的数据库迁移在启动时自动执行且**没有降级路径**。
自动更新等于把「何时跨迁移」交给机器,所以**升级前建议手动做一次备份**(见第 6 节),
升级异常时从备份恢复。

---

## 5. 升级(手动)

Server 与 Agent **各自独立发版**,各升各的。**升级前先备份**(见第 6 节)。

> 以下为手动升级流程。开了自动更新的实例无需执行——旁车会自行完成;想完全手动,
> 先按上一节关闭自动更新。

```bash
cd ~/nettact
# 先备份 nettact-data(见下一节)
# 编辑 .env:把 NETTACT_SERVER_VERSION 改为目标版本
docker compose pull               # 拉取新镜像
docker compose up -d              # 用新镜像重建容器,数据卷保留
docker compose ps                 # 确认重新 healthy
```

数据保存在命名卷里,重建容器 / 主机重启后配置与历史仍在,不会生成第二套身份。
若升级后异常,把 `.env` 里的版本变量改回旧版本再 `pull && up -d`;
如数据结构已变则从备份恢复(见下)。

Agent 的升级在它自己那台机器上做:`cd ~/nettact-agent && docker compose pull && docker compose up -d`
(或原生安装的 `install.sh --update-only`),细节见[第 9 节](#_9-在机器上安装-agent)。

---

## 6. 备份与恢复

需要备份的持久化数据:

- 卷 `nettact-data` → Server 的 `nettact.db`(含 `-wal`/`-shm`)。这是**唯一**值得
  认真备份的东西:监控目标、历史指标、告警规则、账号都在里面。
- 每台 Agent 机器上的卷 `nettact-agent-data` → 该 Agent 的身份(`agent.key`)、
  凭据(`agent.json`)、发送缓冲(`wal/`)。不备份也无妨:重装 Agent 时用一枚新
  令牌重新注册即可,代价只是控制台里多一条旧记录要删。

为拿到一致快照,**先停对应服务再备份**(避免拷到写了一半的 SQLite):

```bash
# 备份 Server 数据
docker compose stop server
docker compose cp server:/data ./backup-$(date +%F)      # 或用下面的卷方式
docker compose start server
```

也可以直接打包命名卷。卷名带 compose 项目名前缀,而项目名来自目录名——装在
`~/nettact` 就是 `nettact_nettact-data`,拿不准用 `docker volume ls` 查:

```bash
cd ~/nettact
docker compose stop server
docker run --rm \
  -v "$(basename "$PWD" | tr '[:upper:]' '[:lower:]')_nettact-data":/data \
  -v "$PWD":/backup alpine \
  tar czf /backup/nettact-data-$(date +%F).tar.gz -C /data .
docker compose start server
```

恢复:停服务 → 把 tar 解回对应卷 → 起服务。Agent 那边同理,只是它的卷名固定为
`nettact-agent-data`(不带项目前缀),恢复它可免去重新注册。

---

## 7. 卸载

```bash
cd ~/nettact

# 停止并删除容器,但保留数据卷(下次 up 数据还在)
docker compose down

# 彻底删除,包括数据卷(不可恢复!)
docker compose down -v
```

每台 Agent 单独卸:`cd ~/nettact-agent && docker compose down -v`,或原生安装的
卸载步骤见 [Agent 配置](./agent-config.md)。卸掉 Agent 后到控制台把对应条目删掉。

---

## 8. 启用 HTTPS(可选)

Server 可原生跑 HTTPS/WSS。准备好证书后:

1. 在项目下建 `certs/`,放入 `tls.crt`、`tls.key`。
2. 在 `docker-compose.yml` 的 `server` 里取消注释 `./certs:/certs:ro` 挂载,
   以及 `-tls-cert /certs/tls.crt -tls-key /certs/tls.key` 两行。
3. **同时把 healthcheck 换成 https 变体**(compose 文件里已给出注释行):启用 TLS 后
   监听是 TLS-only 的,明文 http 健康检查永远不会通过,server 会一直显示 unhealthy。
4. `docker compose up -d server`。此时控制台走 `https://`,各台 Agent 的
   `--server-url` 也要相应改成 `https://<server 主机>:12450`(证书需能被 Agent 校验,
   或临时设 `NETTACT_AGENT_TLS_INSECURE=true`)。

`-tls-cert` 与 `-tls-key` 必须同时提供,否则 Server 拒绝启动(避免误退回明文)。

---

## 9. 在机器上安装 Agent

Agent 装在**每一台你想监控的机器**上:Server 这台、另一台服务器、家里的 NAS、
办公室的 Windows 电脑。它指向 Server 的**对外可达地址**,不需要任何入站端口。前提:

1. 那台机器能访问 Server(`http(s)://<server 主机>:<NETTACT_HTTP_PORT>`);
2. 在控制台「Agent」页为它签发一枚一次性注册令牌(**每台 Agent 一枚**)。

一个安装脚本覆盖三种装法(Linux / macOS 原生 + Docker)。**路由器**用的是另一个脚本
——见 [OpenWrt 路由器安装](./openwrt.md),那边的 agent 以两个 opkg 软件包的形式安装,
首次启动时再下载对应架构的二进制,另有一个 LuCI 页面用于配置。

原生 Linux 或 macOS(systemd / launchd 服务,需要 root):

```bash
curl -fsSL https://d.nettact.org/agent/install.sh | sudo bash -s -- \
  --server-url http://<server 主机>:12450 --token '<一次性令牌>'
```

Docker:

```bash
curl -fsSL https://d.nettact.org/agent/install.sh | bash -s -- --docker \
  --server-url http://<server 主机>:12450 --token '<一次性令牌>'
```

在任一命令末尾追加 `--auto-update`,即可启用 Agent 每日自动更新。

**接入时顺便选权限**(可选):追加 `--permissions`,把这台 Agent 允许采集的范围
一次定好,免得装完再改配置重启。控制台「Agent」页会按你选的档位直接生成完整命令。

```bash
curl -fsSL https://d.nettact.org/agent/install.sh | sudo bash -s -- \
  --server-url http://<server 主机>:12450 --token '<一次性令牌>' \
  --permissions 'probe.icmp,probe.dns,probe.http,probe.tcp,host.cpu.read,host.memory.read'
```

不带该参数 = 使用内置默认集。注意它是**整体替换**语义,不是在默认集上追加——
完整清单与各平台支持情况见[权限参考](./permissions.md)。

### Docker 安装装出来的是什么

`--docker` 会把这套部署**写进 `~/nettact-agent`**(可用 `NETTACT_AGENT_INSTALL_DIR`
改),然后用 compose 拉起来:

| 文件 | 内容 |
|---|---|
| `docker-compose.yml` | 容器定义。宿主机视角与容器视角是**两个不同的容器**,所以这份文件是安装时生成的,而不是一份带开关的模板 |
| `.env` | 镜像、版本、`server_url` 三个旋钮;改完 `docker compose up -d` 生效 |
| `enroll.token` | 一次性注册令牌,以只读方式挂进容器。它只在数据卷里还没有凭据时被读取,用过之后留着也无害 |

之后就是普通的 compose 运维,不必再拼 `docker run`:

```bash
cd ~/nettact-agent
docker compose ps
docker compose logs -f
docker compose pull && docker compose up -d     # 升级
docker compose down                              # 卸载(加 -v 连身份一起删)
```

目录本身是 `0700`——令牌的保密性靠它。令牌文件本身反而是 `0644`:容器以非 root 用户
(uid 100)运行,通过 bind mount 读这个文件,而 bind mount 不需要穿过宿主目录,所以
锁目录既保密又不会让 Agent 因读不到令牌而反复重启。

> 需要 Docker Compose v2(`docker compose` 子命令)。Debian 的 `docker.io` 包不带它,
> 装一下 `docker-compose-plugin` 即可;脚本会先检查并给出这条提示。

**Docker 安装默认监控宿主机**:在 Linux 宿主机上,`--docker` 生成的 compose 会带上
`network_mode: host`、`pid: host`、`user: "0:0"`、`cap_add: [NET_RAW]`,并把宿主机
`/proc`、`/sys` 只读挂进去,所以采到的是这台机器而不是容器自己。要改成监控容器本身,
加 `--container-view`。两者的差别见[第 10 节](#_10-宿主机视角与容器视角-docker-安装)。

**裸二进制(Windows / Linux)**:从下载中心获取对应平台的最新版,也可在
[下载中心首页](https://d.nettact.org) 选择历史版本:

- [Windows x64](https://d.nettact.org/agent/nettact-agent-windows-amd64.exe)
- [Linux x64](https://d.nettact.org/agent/nettact-agent-linux-amd64)
- [Linux ARM64](https://d.nettact.org/agent/nettact-agent-linux-arm64)
- [SHA256 校验清单](https://d.nettact.org/agent/SHA256SUMS)

下载后写一个 YAML 配置文件(参考 `agent/agent.example.yaml`):

```yaml
# nettact-agent.yaml(与二进制同目录,或放平台惯例路径;建议 chmod 600)
server_url: http://<server 主机>:12450
enroll_token: "<一次性令牌>"
```

然后直接启动 `nettact-agent`(自动发现工作目录下的 `nettact-agent.yaml`)。
注册成功后令牌即失效,可从配置文件中删除。全部配置项(数据目录、权限策略、
探测目标访问控制等)见 [Agent 配置](./agent-config.md)。

一台机器也可以**同时向多台 Server 上报**,每台各用一枚注册令牌、各持一份权限授权——
把 `server_url` 换成 `servers:` 列表即可,写法见
[同时向多台 Server 上报](./agent-config.md#同时向多台-server-上报)。上面几种装法装出来的
都是单 Server,但加第二台的改法各不相同:

- **原生安装**(不带 `--docker` 的 `install.sh`):改脚本写下的那份配置文件——Linux 在
  `/etc/nettact/agent.yaml`,macOS 在 `/Library/Application Support/NetTact/agent.yaml`——
  把其中的 `server_url:` 与 `enroll_token_file:` 换成 `servers:` 列表,再重启服务。
- **裸二进制**:同样是改上面那份 YAML。
- **Docker**:生成的部署根本没有挂配置文件,而它设的那两个环境变量与 `servers:` 列表互斥,
  得改 compose——见[给 Docker 部署添加第二台 Server](#给-docker-部署添加第二台-server)。

### 给 Docker 部署添加第二台 Server

生成的部署里没有 YAML 配置文件:Server 地址和令牌是以 `NETTACT_AGENT_SERVER_URL`、
`NETTACT_AGENT_ENROLL_TOKEN_FILE` 两个环境变量的形式,写在 compose 的 `environment:`
里送进去的。这两个变量与 `servers:`
[互斥](./agent-config.md#与单-server-写法互斥),**以环境变量形式出现同样互斥**——
一边挂配置文件写列表、一边留着它们,不是合并,而是启动直接报错:

```
`servers:` and NETTACT_AGENT_SERVER_URL are mutually exclusive; put the setting inside the servers entry
```

所以加第二台得动 `~/nettact-agent` 里的 `docker-compose.yml` 本身:

1. 写一份 `~/nettact-agent/agent.yaml`,一台 Server 一条。第一条的 `name` 就叫
   `default`——单 Server 写法用的正是这个名字,沿用它,已经拿到的凭据和积压的发送队列
   就都还在,不会重新注册:

   ```yaml
   servers:
     - name: default
       url: http://<第一台 server 主机>:12450
       enroll_token_file: /run/secrets/agent_enroll_token
     - name: work
       url: https://nettact.corp.example:12450
       enroll_token_file: /run/secrets/work_enroll_token
       permissions:            # 这台 Server 只拿到这些
         - probe.icmp
         - probe.dns
   ```

2. 把第二台的一次性令牌写进 `~/nettact-agent/work.token`。两个新文件都要 `chmod 644`,
   道理和 `enroll.token` 是 `0644` 一样:容器以非 root 用户读它们,保密性靠的是 `0700`
   的目录本身。

3. 改 `docker-compose.yml`,从 agent 服务的 `environment:` 里**删掉**这两行……

   ```yaml
         NETTACT_AGENT_SERVER_URL: ${NETTACT_AGENT_SERVER_URL}
         NETTACT_AGENT_ENROLL_TOKEN_FILE: /run/secrets/agent_enroll_token
   ```

   ……再把两个文件加进该服务的 `volumes:`,与原有的挂载并列:

   ```yaml
         - ./agent.yaml:/etc/nettact/agent.yaml:ro
         - ./work.token:/run/secrets/work_enroll_token:ro
   ```

   `environment:` 里其余的都保持原样。与列表冲突的只有那四个属于单台 Server 的设置
   (`server_url`、`enroll_token`、`enroll_token_file`、`tls_insecure`)——
   `NETTACT_AGENT_DATA_DIR` 不受影响;如果当初 `--permissions` 写下了
   `NETTACT_AGENT_PERMISSIONS`,它也照常生效,作为「条目自己没写 `permissions`」时的
   默认授权。

4. `docker compose up -d`。`/etc/nettact/agent.yaml` 本身就在 Agent 的配置自动发现路径里,
   不必再加变量;启动日志里的 `using config file /etc/nettact/agent.yaml` 就是它被读到的
   凭证。

`.env` 里那行 `NETTACT_AGENT_SERVER_URL` 在 `environment:` 中引用它的那行删掉之后就失效了:
compose 读 `.env` 只是为了展开 compose 文件里的 `${...}`,而生成的这份文件并没有
`env_file:`。

> **改完之后不要再跑一遍安装脚本。** 完整跑一次 `install.sh --docker` 会重新生成
> `docker-compose.yml`(你的改动就没了),并且顺手删掉 `nettact-agent-data` 卷——于是
> Agent 会拿着早已用掉的令牌,向每一台 Server 重新注册。从此以后请改这几个文件再
> `docker compose up -d`,生成文件开头的注释说的就是这件事。

### 确认 Agent 真的连上了

连不上 Server 的 Agent 照样在跑、照样在重试,所以服务处于 "active" 并不能证明真的
有数据在上报。每次尝试,Agent 都会把结果说出来:

```
[default] connected to https://nettact.example.com (agent 3f2a9c1e)
[default] session ended (tls_cert_expired): dial: … x509: certificate has expired …; reconnecting in 32.1s (pending 247)
```

去哪里看,取决于你是怎么装的:

```bash
journalctl -u nettact-agent -f                        # Linux 原生安装
tail -f /var/log/nettact-agent.log                    # macOS 原生安装
cd ~/nettact-agent && docker compose logs -f          # Docker
```

括号里的词是一个稳定的原因代码——`tls_cert_expired`、`dns`、`refused`、`auth`
等十几个,连同各自的常见修法,都列在[查看连接状态](./agent-config.md#查看连接状态)。

Windows 计划任务安装会丢弃输出,没有日志可跟。请改用
[`status_file`](./agent-config.md#状态文件),读它写出的 JSON;凡是需要机器自己汇报
状态、而不会有人盯着日志的场景,用的都是这个选项。

---


## 10. 宿主机视角与容器视角(Docker 安装)

一个跑在容器里的 Agent,默认看到的是**容器自己**的网卡、进程和文件系统。那几乎不是
你想监控的东西,所以 `--docker` 默认给宿主机视角,四件事一起上——只开其中几项会采出
"看着对、其实不对"的数据(宿主机网卡配着容器进程,或宿主机指标配着容器的默认网关):

| 配置 | 换来什么 |
|---|---|
| `network_mode: host` | 宿主机的网卡、路由、邻居表、默认网关 |
| `pid: host` | 宿主机的进程列表 |
| `HOST_PROC` / `HOST_SYS` + 只读挂载 | 宿主机的资源指标,以及 Agent 自己读路由/解析器的位置 |
| `user: "0:0"` + `cap_add: [NET_RAW]` | 裸 ICMP socket,**路径诊断**需要它 |

几点必须知道的:

- **"宿主机"指 Docker daemon 所在的机器**。Docker Desktop 下那是它的 Linux 虚拟机,
  不是你的 Windows/macOS——Linux 容器没有办法观测外层系统。脚本检测到非 Linux daemon
  时会自动改用容器视角并说明。
- **磁盘指标是例外**,即使宿主机视角下也反映容器文件系统,见
  [权限参考](./permissions.md#host-disk-read)。
- **容器视角(`--container-view`)保持非 root**,拿不到裸 socket,因此**没有路径诊断**;
  但 ICMP 探测与网关探测仍然可用——它们只需要非特权 ping socket,生成的 compose 会带上
  `sysctls: net.ipv4.ping_group_range: "0 2147483647"` 把它打开。**这一句不能省**:
  内核给每个新网络命名空间的默认值是 `1 0`(空区间,任何 gid 都不许 ping),dockerd
  也不会改它。运行时若拒绝这个 sysctl(gVisor 等),脚本会去掉它重试,并明说 ICMP
  探测和网关探测将显示为"不支持"。

---

## 11. 故障排查

- **Agent 装完没出现在控制台 / 容器反复重启**:安装脚本本身会等注册成功并验证进程
  稳定,失败时会打印 Agent 日志、删掉容器并直接告诉你原因。事后排查:
  `cd ~/nettact-agent && docker compose logs -f`。最常见的是令牌过期(24 小时)
  或被用过——到控制台重新签发一枚,重跑安装命令即可。
- **报 `NETTACT_AGENT_ENROLL_TOKEN_FILE: open ...: permission denied`**:令牌文件对
  容器里的非 root 用户不可读。`chmod 644 ~/nettact-agent/enroll.token && chmod 700 ~/nettact-agent`
  (原因见第 9 节),下次重启即可读到;令牌没过期就不用重新签发。
- **ICMP 探测 / 网关探测显示"受阻"**:容器视角下多半是 ping socket 没打开。
  `docker exec nettact-agent cat /proc/sys/net/ipv4/ping_group_range` 若是 `1 0`,
  说明 compose 里缺 `sysctls` 那一段(见[第 10 节](#_10-宿主机视角与容器视角-docker-安装));
  路径诊断则本来就需要宿主机视角。详见[权限参考](./permissions.md)。
- **登录后立刻掉登录**:见第 2 节[关于 HTTPS 与会话 Cookie](#关于-https-与会话-cookie),
  改用 HTTPS 或反代(并设 `NETTACT_SECURE_COOKIE=true`)。
- **server 一直 unhealthy**:`docker compose logs server` 看 DB 迁移 / 端口占用;
  确认 `NETTACT_HTTP_PORT` 未被别的进程占用。
- **改了 .env 不生效**:`.env` 只在 `up`/`pull` 时读取,需 `docker compose up -d` 重建。
- **控制台打不开但 API 正常(占位页/503)**:Server 首次启动时会从
  `https://d.nettact.org` 下载前端;下载失败会展示占位页并后台重试。确认 Server
  能访问下载中心。内网环境可用 `NETTACT_WEBUI_BASE_URL` 指向兼容下载源(见
  [Server 配置](./server-config.md#web-控制台前端))。
