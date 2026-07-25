---
layout: home

hero:
  name: NetTact
  text: Network monitoring for homes and small businesses
  tagline: Agent-push telemetry — agents run the probes close to what they measure and push results; the server hands down the target list, aggregates metrics and raises alerts
  actions:
    - theme: brand
      text: Download Desktop
      link: /en/desktop
    - theme: alt
      text: One-command deploy
      link: /en/deploy
    - theme: alt
      text: Server config
      link: /en/server-config
    - theme: alt
      text: Agent config
      link: /en/agent-config

features:
  - icon: 💻
    title: NetTact Desktop
    details: Download the all-in-one Windows or macOS edition with the server and agent built in — no command-line deployment required.
    link: /en/desktop
    linkText: Download the latest version
  - icon: 🚀
    title: One-command deploy
    details: A single curl command brings up the whole Docker Compose stack — plus upgrades, backup and restore, uninstall, HTTPS, remote agents, host monitoring and troubleshooting.
    link: /en/deploy
    linkText: Start deploying
  - icon: 🖥️
    title: Server configuration
    details: Every nettact-lite flag with its .env counterpart, listen address, admin credentials and password changes, data retention, TLS, session cookies.
    link: /en/server-config
    linkText: Read the reference
  - icon: 📡
    title: Agent configuration
    details: Full reference for the YAML config file and environment variables, enrollment flow and token lifetime, permission policy, probe target access control, per-platform capabilities.
    link: /en/agent-config
    linkText: Read the reference
  - icon: 🔒
    title: Privacy policy
    details: Bilingual privacy policy, inventory of data collection and outbound connections, app store disclosure mapping.
    link: /en/privacy
    linkText: Read it in full
---

::: tip The single source of truth for configuration
The authoritative configuration list is each binary’s `--help` output (`nettact-lite --help` /
`nettact-agent --help`). If the docs disagree with it, `--help` wins — and please
[send a correction](https://github.com/nettact/docs).
:::
