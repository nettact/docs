# NetTact 用户文档

NetTact 的最终用户文档,发布于 **<https://nettact.org/>**(VitePress + GitHub
Pages)。开发者文档见各模块仓库的 README。

| 文档 | 内容 |
|---|---|
| [一键部署](./deploy.md) | Docker Compose 快速开始、状态查看、升级、备份与恢复、卸载、HTTPS、远程 Agent、宿主机监控、故障排查 |
| [Server 配置](./server-config.md) | `nettact-lite` 全部 flag 参考、`.env` 对照、监听地址、管理员凭据与改密、数据保留、TLS、会话 Cookie、前端下载 |
| [Agent 配置](./agent-config.md) | YAML 配置文件与环境变量完整参考、注册流程与令牌时效、权限策略、探测目标访问控制、平台能力差异 |
| [隐私政策](./privacy.md) | 中英双语隐私政策(Microsoft Store / App Store 上架用)、数据采集与对外连接清单、商店申报对照 |

> 配置清单的单一事实来源是各二进制的 `--help` 输出(`nettact-lite --help` /
> `nettact-agent --help`)。文档改动时与之逐项核对;若发现不一致,以 `--help`
> 为准并请提交修正。

## 本地开发

```bash
npm ci
npm run docs:dev      # 本地预览 http://localhost:5173
npm run docs:build    # 构建(含内部死链检查),产物在 .vitepress/dist
npm run docs:preview  # 预览构建产物
```

站点配置在 [.vitepress/config.mts](./.vitepress/config.mts);首页是
[index.md](./index.md);本 README 仅为仓库自述,不进站点(`srcExclude`)。

## 部署

push 到 `main` 后由 [.github/workflows/deploy.yml](./.github/workflows/deploy.yml)
自动构建并发布到 GitHub Pages(自定义域名 `nettact.org`,见
[public/CNAME](./public/CNAME))。PR 只做构建校验,不发布。

一次性配置(仓库 Settings → Pages):

1. **Build and deployment → Source** 选 **GitHub Actions**;
2. **Custom domain** 填 `nettact.org`,等待 DNS 检查通过后勾选 **Enforce HTTPS**;
3. DNS:`nettact.org` 的 A 记录指向 GitHub Pages 的
   `185.199.108.153 / 185.199.109.153 / 185.199.110.153 / 185.199.111.153`
   (及 AAAA `2606:50c0:8000::153` 等四条,可选)。
