# 一键部署

用 Docker Compose 部署 NetTact 的 **Server(server-lite)** 与 **Agent**。
Server 内置 Web 控制台;Agent 是纯出站客户端(不监听任何端口),通过网络主动连到 Server。

> 适用版本:Docker Engine 24+ 且自带 Compose v2(`docker compose` 子命令)。
> 旧的独立 `docker-compose`(v1)未测试。

配置项的完整参考见:[Server 配置](./server-config.md) · [Agent 配置](./agent-config.md)。

---

## 1. 一键部署脚本(Linux)

在只装了 Docker 的 Linux 主机上,一条命令完成整套部署——下载 compose 资产、
生成 `.env` 与 secret、拉起 Server、等待健康、自动登录并签发注册令牌、拉起
Agent 并确认注册成功,最后打印控制台地址与首启密码:

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
| `--lite-version` / `--agent-version <tag>` | 钉住镜像版本(默认 `latest`) |
| `--server-only` | 只部署 Server |
| `--agent-only --server-url <url> --token <令牌>` | **远程 Agent 模式**:在第二台主机上只拉起 Agent 并注册到已有 Server(见第 8 节) |
| `--host-network` | Agent 监控宿主机网络(Linux;取舍见第 9 节) |
| `-y` / `--yes` | 无交互(非首启且无法自动取得密码时直接给出手工兜底命令) |

脚本**幂等**:重复执行不动已有的 `.env`、secret 与数据卷;部分失败后重跑安全;
每步失败都会打印原因与对应的手工兜底命令。已在本仓库 checkout 里时直接
`./deploy/install.sh`,使用本地的 `docker-compose.yml` / `.env.example`
(内网镜像源可设 `NETTACT_DIST_BASE_URL` 覆盖下载地址)。

以下各节是同一流程的**手工版**,也是理解各步骤与排障的参考。

---

## 2. 快速开始(Docker Compose)

在包含 `docker-compose.yml` 与 `.env.example` 的目录(仓库根目录)下执行:

```bash
# 1) 准备配置
cp .env.example .env
# 按需检查 .env(端口、镜像版本等);无需设置管理员口令——首启自动生成

# 2) 先启动 Server
mkdir -p secrets
touch secrets/agent_enroll_token      # 占位:首次 up 前该文件必须存在
docker compose up -d server

# 3) 从日志读取首启自动生成的管理员密码(仅打印一次)
docker compose logs server            # 找到 "NetTact first run" 区块里的 username / password

# 4) 打开控制台并登录
#    http://localhost:12450  (端口由 .env 的 NETTACT_HTTP_PORT 决定)
#    用上一步日志里的账号密码登录;登录后到 Settings 修改密码
#    (或用 `docker compose exec server nettact-lite passwd -db /data/nettact.db`)

# 5) 在控制台「Agent」页签发一次性注册令牌(enrollment token),写入 secret 文件
printf '%s' '<粘贴控制台生成的令牌>' > secrets/agent_enroll_token

# 6) 启动 Agent(自动注册并开始上报)
docker compose up -d agent
```

完成后:Agent 会出现在控制台的 Agent 列表并开始上报指标,Server 可向它下发监控目标。

注册令牌默认 60 分钟内有效、仅可使用一次;注册成功后 Agent 把凭据保存在自己的
数据卷里,之后重启不再需要令牌。细节见 [Agent 配置 — 注册流程](./agent-config.md#注册流程与令牌时效)。

### 关于 HTTPS 与会话 Cookie

默认(`-secure-cookie auto`)下,会话 Cookie 只在 Server 自己跑 TLS 时才带 `Secure`
标志,所以**纯 HTTP 部署开箱即可登录**。生产环境建议:

- 给 Server 配 TLS(见下方[启用 HTTPS](#7-启用-https可选)),或
- 前置一个终止 TLS 的反向代理(Caddy/Nginx/Traefik),并在 `.env` 设
  `NETTACT_SECURE_COOKIE=true`(浏览器侧是 https,Cookie 应带 Secure)。

---

## 3. 查看状态

```bash
docker compose ps                 # 容器与健康状态(server 应为 healthy)
docker compose logs -f server     # Server 日志
docker compose logs -f agent      # Agent 日志(注册、上报)
curl -f http://localhost:12450/api/v1/healthz   # 健康检查,返回 {"status":"ok"}
```

健康检查区分「进程在」与「服务可用」:它真正请求 `/api/v1/healthz`,DB 迁移或监听
未就绪时不会变 healthy,`depends_on` 会等到 server healthy 再起 agent。

---

## 4. 升级

Server 与 Agent **各自独立发版**,升级即改对应版本变量。**升级前先备份**(见第 5 节)。

```bash
# 先备份 nettact-data(见下一节)
# 编辑 .env:把 NETTACT_LITE_VERSION / NETTACT_AGENT_VERSION 改为目标版本
docker compose pull               # 拉取新镜像
docker compose up -d              # 用新镜像重建容器,数据卷保留
docker compose ps                 # 确认重新 healthy
```

数据保存在命名卷里,重建容器 / 主机重启后配置与历史仍在,不会生成第二套身份。
若升级后异常,把 `.env` 里对应的版本变量改回旧版本再 `pull && up -d`;
如数据结构已变则从备份恢复(见下)。

---

## 5. 备份与恢复

需要备份的持久化数据:

- 卷 `nettact-data` → Server 的 `nettact.db`(含 `-wal`/`-shm`)
- 卷 `agent-data` → Agent 的身份(`agent.key`)、凭据(`agent.json`)、发送缓冲(`wal.db*`)

为拿到一致快照,**先停对应服务再备份**(避免拷到写了一半的 SQLite):

```bash
# 备份 Server 数据
docker compose stop server
docker compose cp server:/data ./backup-$(date +%F)      # 或用下面的卷方式
docker compose start server
```

也可以直接打包命名卷(卷名是 `<项目名>_nettact-data`,`docker volume ls` 可查):

```bash
docker compose stop server
docker run --rm \
  -v "$(basename "$PWD" | tr '[:upper:]' '[:lower:]')_nettact-data":/data \
  -v "$PWD":/backup alpine \
  tar czf /backup/nettact-data-$(date +%F).tar.gz -C /data .
docker compose start server
```

恢复:停服务 → 把 tar 解回对应卷 → 起服务。Agent 数据同理(卷 `agent-data`,
恢复它可避免重新注册)。

---

## 6. 卸载

```bash
# 停止并删除容器,但保留数据卷(下次 up 数据还在)
docker compose down

# 彻底删除,包括数据卷(不可恢复!)
docker compose down -v
```

---

## 7. 启用 HTTPS(可选)

Server 可原生跑 HTTPS/WSS。准备好证书后:

1. 在项目下建 `certs/`,放入 `tls.crt`、`tls.key`。
2. 在 `docker-compose.yml` 的 `server` 里取消注释 `./certs:/certs:ro` 挂载,
   以及 `-tls-cert /certs/tls.crt -tls-key /certs/tls.key` 两行。
3. **同时把 healthcheck 换成 https 变体**(compose 文件里已给出注释行):启用 TLS 后
   监听是 TLS-only 的,明文 http 健康检查永远不会通过,server 将一直 unhealthy,
   agent(`depends_on: service_healthy`)也起不来。
4. `docker compose up -d server`。此时控制台走 `https://`,Agent 用 `https://server:12450`
   连接(compose 内部主机名证书需匹配,或临时设 `NETTACT_AGENT_TLS_INSECURE=true`)。

`-tls-cert` 与 `-tls-key` 必须同时提供,否则 Server 拒绝启动(避免误退回明文)。

---

## 8. 在其它机器上部署远程 Agent(可选)

compose 里的 agent 只监控 Server 所在这台机器。要监控别的机器(另一台服务器、
家里的 NAS、办公室的 Windows 电脑),在那台机器上单独跑一个 Agent,指向 Server
的**对外可达地址**即可。前提:

1. 那台机器能访问 Server(`http(s)://<server 主机>:<NETTACT_HTTP_PORT>`);
2. 在控制台「Agent」页为它新签发一枚一次性注册令牌(每台 Agent 一枚)。

**一键脚本(Linux)**:

```bash
curl -fsSL https://d.nettact.org/install.sh | bash -s -- --agent-only \
  --server-url http://<server 主机>:12450 --token '<一次性令牌>'
```

**Docker(Linux,手工)**:

```bash
docker run -d --name nettact-agent --restart unless-stopped \
  -e NETTACT_AGENT_SERVER_URL=http://<server 主机>:12450 \
  -e NETTACT_AGENT_ENROLL_TOKEN='<一次性令牌>' \
  -e NETTACT_AGENT_DATA_DIR=/agent-data \
  -v nettact-agent-data:/agent-data \
  ghcr.io/nettact/nettact-agent:latest
```

**裸二进制(Windows / Linux)**:从 agent 仓库的 Release 下载对应平台的
`nettact-agent`,写一个 YAML 配置文件(参考 `agent/agent.example.yaml`):

```yaml
# nettact-agent.yaml(与二进制同目录,或放平台惯例路径;建议 chmod 600)
server_url: http://<server 主机>:12450
enroll_token: "<一次性令牌>"
```

然后直接启动 `nettact-agent`(自动发现工作目录下的 `nettact-agent.yaml`)。
注册成功后令牌即失效,可从配置文件中删除。全部配置项(数据目录、权限策略、
探测目标访问控制等)见 [Agent 配置](./agent-config.md)。

---

## 9. 让 Agent 监控宿主机(可选,Linux)

默认 compose 里的 Agent 看到的是**容器自身**的网卡与指标。若要监控 Docker 宿主机
的真实网络,在 `docker-compose.yml` 的 `agent` 里启用 `network_mode: host`(必要时
加 `pid: host`)。

**注意**:启用 `network_mode: host` 后 Agent 脱离 compose 网络,服务名 `server` 不再
可解析——必须同时把 `NETTACT_AGENT_SERVER_URL` 改为宿主机可达地址,例如
`http://127.0.0.1:12450`(端口与 `.env` 的 `NETTACT_HTTP_PORT` 一致)。

这是明确的取舍,不是探针能力的必需项——本构建的 Linux Agent 只跑 DNS/HTTP/TCP/NAT
探针与主机指标,**不需要 `NET_RAW`/特权**,容器以非 root 运行。

---

## 10. 故障排查

- **agent 反复重启 / 未注册**:多半是 `secrets/agent_enroll_token` 为空或令牌过期
  (默认 60 分钟)。到控制台重新签发,写入该文件,`docker compose up -d agent`。
- **登录后立刻掉登录**:见第 2 节[关于 HTTPS 与会话 Cookie](#关于-https-与会话-cookie),
  改用 HTTPS 或反代(并设 `NETTACT_SECURE_COOKIE=true`)。
- **server 一直 unhealthy**:`docker compose logs server` 看 DB 迁移 / 端口占用;
  确认 `NETTACT_HTTP_PORT` 未被别的进程占用。
- **改了 .env 不生效**:`.env` 只在 `up`/`pull` 时读取,需 `docker compose up -d` 重建。
- **控制台打不开但 API 正常(占位页/503)**:Server 的前端是运行时从 GitHub Release
  下载的,首启需要外网;下载失败会展示占位页并后台重试,内网环境可用
  `NETTACT_WEBUI_BASE_URL` 指向镜像源(见 [Server 配置](./server-config.md#web-控制台前端))。
