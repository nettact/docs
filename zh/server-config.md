# Server 配置(nettact-lite)

`nettact-lite` 是自托管的单二进制 Server:HTTP API + 内置 Web 控制台 + SQLite
存储。它**完全由命令行 flag 配置**(外加两个用于前端下载的可选环境变量,见
[Web 控制台前端](#web-控制台前端));Docker Compose 部署时,常用项通过 `.env`
映射为 flag(见 [.env 变量对照](#env-变量对照-docker-compose))。

本页与 `nettact-lite --help` 逐项对应;若两者不一致,以 `--help` 为准并请报告。

---

## Flag 参考

| Flag | 默认值 | 说明 |
|---|---|---|
| `-addr` | `:12450` | 监听地址(`[host]:port`)。**控制台里保存过的监听地址会覆盖此 flag**,见[监听地址](#监听地址)。 |
| `-db` | `./nettact.db` | SQLite 数据库路径(会同时产生 `-wal`/`-shm` 伴生文件)。 |
| `-webui-dir` | 空(= `<db 目录>/webui`) | Web 控制台前端的下载/安装目录,版本装到 `<webui-dir>/<version>/`。 |
| `-dev` | `false` | 开发模式:对 Vite 开发源(web-console)开放 CORS,会话 Cookie 不带 Secure。生产勿用。 |
| `-admin-user` | 空 | 可选;**仅首次运行生效**。省略则首启自动创建 `admin` 账号并生成随机密码(打印一次)。 |
| `-admin-pass` | 空 | 可选;**仅首次运行生效**。省略则首启自动生成初始密码并打印(仅一次)。 |
| `-tls-cert` | 空 | TLS 证书路径;与 `-tls-key` 同时提供时原生服务 HTTPS/WSS。 |
| `-tls-key` | 空 | TLS 私钥路径;必须与 `-tls-cert` 成对出现,只给一个则拒绝启动(避免误退回明文)。 |
| `-secure-cookie` | `auto` | 会话 Cookie 的 `Secure` 属性:`auto` / `true` / `false`,见[会话 Cookie](#会话-cookie)。 |

另有一个子命令:

```
nettact-lite passwd -db <路径>     # 离线重置管理员密码(找回密码用)
```

见[管理员凭据与改密](#管理员凭据与改密)。

---

## .env 变量对照(Docker Compose)

Compose 部署时不直接写 flag,而是在 `.env` 里设变量,由 `docker-compose.yml`
映射(改了 `.env` 需 `docker compose up -d` 重建才生效):

| `.env` 变量 | 默认值 | 作用 |
|---|---|---|
| `NETTACT_HTTP_PORT` | `12450` | 发布到宿主机的端口(容器内固定监听 `:12450`,此变量只改端口映射的宿主机侧)。因为改的是宿主机侧,也可以写成地址加端口把控制台限制在某张网卡上,例如 `10.0.0.5:12450`。 |
| `NETTACT_SECURE_COOKIE` | `auto` | 映射为 `-secure-cookie`;前置 TLS 终止反代时设 `true`。 |
| `NETTACT_TZ` | `UTC` | 映射为容器的 `TZ`,决定**给人看**的时间怎么打印(通知正文、邮件页脚、日志)。填任意 IANA 时区名如 `Asia/Shanghai`;镜像无需装 tzdata。 |
| `NETTACT_LITE_VERSION` | `latest` | Server 镜像 tag(建议钉住 `vX.Y.Z` 便于可复现升级)。 |
| `NETTACT_AGENT_VERSION` | `latest` | Agent 镜像 tag(与 Server 独立发版)。 |
| `NETTACT_LITE_IMAGE` | `ghcr.io/nettact/nettact-lite` | 覆盖 Server 镜像地址(如本地构建测试)。 |
| `NETTACT_AGENT_IMAGE` | `ghcr.io/nettact/nettact-agent` | 覆盖 Agent 镜像地址。 |

数据库路径、TLS 等其余 flag 在 `docker-compose.yml` 的 `command:` 里
按需直接增删(TLS 的注释行已备好,同时要换 https 版 healthcheck,见
[部署篇](./deploy.md#_7-启用-https-可选))。

---

## 监听地址

监听地址有三个来源,优先级从高到低:

1. **控制台里保存的监听地址**(Settings → Listen address,存在数据库);
2. `-addr` flag;
3. 内置默认 `:12450`。

也就是说:**一旦在控制台保存过监听地址,`-addr` flag 就不再生效**(控制台的
server-info 会标示当前地址来源)。若保存的地址无法绑定(端口被占等),Server
不会因此起不来——自动回退到 flag/默认地址并在日志与 server-info 里报告;
保存的值格式非法则记日志并忽略。

**Docker 部署请让该设置留空**:容器内监听固定为 `:12450`,端口映射由
`NETTACT_HTTP_PORT` 决定,控制台里保存监听地址会让容器与端口映射脱节。

---

## 管理员凭据与改密

单用户(单管理员)模型,无多用户/租户。

- **首次运行**(数据库为空):自动创建管理员。若省略 `-admin-user`/`-admin-pass`,
  用户名为 `admin`,密码随机生成并在启动日志里**打印一次**(`NetTact first run`
  区块);compose 部署用 `docker compose logs server` 读取。
- `-admin-user` / `-admin-pass` 只在首次运行时用于指定初始账号;之后的运行忽略
  这两个 flag,不能用它们改密。
- **修改密码**(任选其一):
  - 控制台:登录后 Settings 页修改;
  - 命令行:`nettact-lite passwd -db <路径>`(compose:
    `docker compose exec server nettact-lite passwd -db /data/nettact.db`)。
    交互式输入新密码(不经命令行参数,不进 shell 历史);重置后**所有已登录
    会话立即失效**,服务端在运行中则建议重启一次。
- 密码策略:至少 8 个字符。

---

## 数据保留

指标存储分四层:原始采样、1 分钟聚合、1 小时聚合、1 天聚合。保留窗口固定、不可
配置:原始采样 2 天、1 分钟聚合 30 天、1 小时聚合 2 年,1 天聚合永久保留。

图表按查询范围自动选层:≤2 小时的范围读原始数据,更长范围读聚合——所以原始
采样只承担"最近两小时"级别的细节回看,长期趋势由聚合层保证。原始采样保留窗口
短是刻意的:按 1s 探测间隔计,每多留一天原始数据就是 GB 级的 SQLite 空间。

---

## TLS

`-tls-cert` 与 `-tls-key` 同时提供时,Server 原生服务 HTTPS(控制台)与 WSS
(Agent 连接),**监听变为 TLS-only**(不再接受明文 HTTP)。只提供其中一个则
启动失败——防止挂载的证书路径写错时静默退回明文、暴露令牌与遥测。

另一种做法是前置 TLS 终止反向代理(Caddy/Nginx/Traefik),Server 保持明文,
此时把 `-secure-cookie` 设为 `true`(见下节)。

---

## 会话 Cookie

浏览器只在 HTTPS 页面上发送带 `Secure` 的 Cookie,所以这个属性配错的症状是
**登录成功后立刻掉线**(localhost 除外)。`-secure-cookie` 三个取值:

| 取值 | 行为 | 适用场景 |
|---|---|---|
| `auto`(默认) | 本进程启用 TLS 时才带 `Secure` | 绝大多数场景;纯 HTTP 部署开箱可登录 |
| `true` | 恒带 `Secure` | TLS 终止反代在前(浏览器侧 https,Server 明文) |
| `false` | 恒不带 | 不推荐 |

`-dev` 模式下恒不带 `Secure`(本地 Vite 走明文)。

---

## Web 控制台前端

前端(web-console)**不打包进二进制/镜像**,由 Server 运行时自动下载:编译时
烧入精确的前端版本号,首启检测到缺失就从
[NetTact 下载中心](https://d.nettact.org) 下载(SHA256 校验)到 `-webui-dir`
(默认 `<db 目录>/webui`),下载完成前非 `/api` 路径返回内置占位页(503),API 与探针
不受影响,失败后台重试。默认下载路径为
`https://d.nettact.org/web-console/<tag>/<asset>`。下载中心的 Cloudflare Worker
负责访问官方 GitHub Release(包括私有仓库),Server 无需配置 GitHub Token。

两个可选环境变量覆盖此行为(开发/内网场景):

| 环境变量 | 作用 |
|---|---|
| `NETTACT_WEBUI_LOCAL` | 直接服务本地目录里的 dist(如 `../web-console/dist`);开发构建(`Version=dev`,未烧版本)不自动下载,用这个。 |
| `NETTACT_WEBUI_BASE_URL` | 覆盖下载源;源必须提供 `<base>/<tag>/<asset>` 布局。也可以完全离线——把前端预置到 `<webui-dir>/<version>/`。 |
