# NetTact 用户文档 / NetTact User Documentation

NetTact 的最终用户文档,发布于 **<https://nettact.org/>**(VitePress + GitHub
Pages)。开发者文档见各模块仓库的 README。

End-user documentation for NetTact, published at **<https://nettact.org/>**
(VitePress + GitHub Pages). Developer docs live in each module repository's own
README.

## 目录结构 / Layout

站点是**中英双语**的,两种语言地位对等、各住一个目录:中文 `zh/` → `/zh/`,
英文 `en/` → `/en/`,没有 root locale。根路径 `/` 是一张 meta-refresh 落地页
([index.md](./index.md)),自动转到 `/zh/`,并留了两种语言的可见链接。

每篇文档必须在两边都存在且**路径一一对应**(`/zh/deploy` ↔ `/en/deploy`)——
语言切换器是按路径前缀改写的,少一篇就会切到 404。**新增或重命名文档时必须两边
同时改。**

The site is **bilingual**, with the two languages as equals in their own
directories: Chinese `zh/` → `/zh/`, English `en/` → `/en/`, and no root locale.
The root path `/` is a meta-refresh landing page ([index.md](./index.md)) that
redirects to `/zh/` and offers visible links to both languages.

Every page must exist on both sides at **matching paths** (`/zh/deploy` ↔
`/en/deploy`) — the language switcher rewrites the path prefix, so a missing
counterpart switches to a 404. **Add and rename pages on both sides together.**

| 中文 / Chinese | English | 内容 / Contents |
|---|---|---|
| [zh/index.md](./zh/index.md) | [en/index.md](./en/index.md) | 首页,VitePress home layout(hero + features) |
| [zh/desktop.md](./zh/desktop.md) | [en/desktop.md](./en/desktop.md) | Desktop 产品说明、Windows/macOS 最新版下载、SHA-256 校验、首次运行、运行方式与数据目录 |
| [zh/deploy.md](./zh/deploy.md) | [en/deploy.md](./en/deploy.md) | Docker Compose 快速开始、状态查看、升级、备份与恢复、卸载、HTTPS、远程 Agent、宿主机监控、故障排查 |
| [zh/server-config.md](./zh/server-config.md) | [en/server-config.md](./en/server-config.md) | `nettact-server` 全部 flag 参考、`.env` 对照、监听地址、管理员凭据与改密、数据保留、TLS、会话 Cookie、前端下载 |
| [zh/agent-config.md](./zh/agent-config.md) | [en/agent-config.md](./en/agent-config.md) | YAML 配置文件与环境变量完整参考、注册流程与令牌时效、权限策略、探测目标访问控制、平台能力差异 |
| [zh/openwrt.md](./zh/openwrt.md) | [en/openwrt.md](./en/openwrt.md) | OpenWrt 路由器安装:两个 ipk、内存/闪存两种存放模式、UCI 选项、支持的架构对照表、路由器构建的功能差异、升级与排查、本地镜像 |
| [zh/permissions.md](./zh/permissions.md) | [en/permissions.md](./en/permissions.md) | 权限参考:三层视图、整体替换语义、预设档位、四种设置方式、平台支持总表、逐条权限说明(每条带显式锚点,控制台按 `#<权限 ID 点换连字符>` 深链过来——改动锚点会让控制台的「查看文档」失效)、常见问题 |
| [zh/privacy.md](./zh/privacy.md) | [en/privacy.md](./en/privacy.md) | Microsoft Store / Mac App Store 上架用隐私政策；中文与英文分别维护，修改内容时必须同步更新两份 |

> 配置清单的单一事实来源是各二进制的 `--help` 输出(`nettact-server --help` /
> `nettact-agent --help`)。文档改动时与之逐项核对;若发现不一致,以 `--help`
> 为准并请提交修正。中英两版都要同步核对。
>
> The single source of truth for configuration is each binary's `--help` output.
> Check both language versions against it when editing; where they disagree,
> `--help` wins.

### 页内锚点 / In-page anchors

VitePress 生成的 id 会把标题里的非字母数字整段压成 `-`,并给**数字开头**的标题加
一个 `_` 前缀——`## 7. 启用 HTTPS(可选)` 的 id 是 `_7-启用-https-可选`。
VitePress 的死链检查**只校验页面、不校验锚点**,所以跨页锚点链接改完请到构建产物
(`.vitepress/dist/**/*.html`)里 grep `id="` 核对一次。

VitePress collapses runs of non-alphanumerics in a heading into `-` and prefixes
headings that **start with a digit** with `_` — `## 7. Enabling HTTPS (optional)`
becomes `_7-enabling-https-optional`. VitePress's dead-link check covers pages
but **not anchors**, so verify cross-page anchors by grepping `id="` in the build
output (`.vitepress/dist/**/*.html`).

## 本地开发 / Local development

```bash
npm ci
npm run docs:dev      # 本地预览 / preview at http://localhost:5173
npm run docs:build    # 构建(含内部死链检查) / build (includes the internal dead-link check)
npm run docs:preview  # 预览构建产物 / preview the build output
```

站点配置在 [.vitepress/config.mts](./.vitepress/config.mts)(nav / sidebar /
搜索文案按 locale 分开配置);本 README 仅为仓库自述,不进站点(`srcExclude`)。

Site configuration lives in [.vitepress/config.mts](./.vitepress/config.mts)
(nav, sidebar and search strings are configured per locale). This README is
repository-only and is excluded from the site via `srcExclude`.

## 部署 / Deployment

push 到 `main` 后由 [.github/workflows/deploy.yml](./.github/workflows/deploy.yml)
自动构建并发布到 GitHub Pages(自定义域名 `nettact.org`,见
[public/CNAME](./public/CNAME))。PR 只做构建校验,不发布。

Pushing to `main` triggers [.github/workflows/deploy.yml](./.github/workflows/deploy.yml),
which builds and publishes to GitHub Pages (custom domain `nettact.org`, see
[public/CNAME](./public/CNAME)). Pull requests only run the build check; they do
not publish.

一次性配置(仓库 Settings → Pages)/ One-time setup (repository Settings → Pages):

1. **Build and deployment → Source** 选 **GitHub Actions**;
2. **Custom domain** 填 `nettact.org`,等待 DNS 检查通过后勾选 **Enforce HTTPS**;
3. DNS:`nettact.org` 的 A 记录指向 GitHub Pages 的
   `185.199.108.153 / 185.199.109.153 / 185.199.110.153 / 185.199.111.153`
   (及 AAAA `2606:50c0:8000::153` 等四条,可选)。
