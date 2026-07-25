---
layout: home

hero:
  name: NetTact
  text: 家庭与中小企业网络监控
  tagline: Agent 推送式遥测 —— Agent 就近执行探测并上报,Server 下发目标清单、汇聚指标与告警
  actions:
    - theme: brand
      text: 下载 Desktop
      link: /zh/desktop
    - theme: alt
      text: 一键部署
      link: /zh/deploy
    - theme: alt
      text: Server 配置
      link: /zh/server-config
    - theme: alt
      text: Agent 配置
      link: /zh/agent-config

features:
  - icon: 💻
    title: NetTact Desktop
    details: 下载 Windows 或 macOS 一体化桌面版本;内置 Server 与 Agent,无需命令行部署,打开即可开始本机网络监控。
    link: /zh/desktop
    linkText: 下载最新版
  - icon: 🚀
    title: 一键部署
    details: curl 一条命令拉起 Docker Compose 全套;含升级、备份与恢复、卸载、HTTPS、远程 Agent、宿主机监控与排障。
    link: /zh/deploy
    linkText: 开始部署
  - icon: 🖥️
    title: Server 配置
    details: nettact-lite 全部 flag 参考与 .env 对照、监听地址、管理员凭据与改密、数据保留、TLS、会话 Cookie。
    link: /zh/server-config
    linkText: 查看参考
  - icon: 📡
    title: Agent 配置
    details: YAML 配置文件与环境变量完整参考、注册流程与令牌时效、权限策略、探测目标访问控制、平台能力差异。
    link: /zh/agent-config
    linkText: 查看参考
  - icon: 🔒
    title: 隐私政策
    details: 中英双语隐私政策,数据采集与对外连接清单,应用商店申报对照。
    link: /zh/privacy
    linkText: 阅读全文
---

::: tip 配置清单的单一事实来源
配置清单以各二进制的 `--help` 输出为准(`nettact-lite --help` / `nettact-agent --help`)。
若发现文档与之不一致,以 `--help` 为准并欢迎[提交修正](https://github.com/nettact/docs)。
:::
