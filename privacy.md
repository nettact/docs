# NetTact 隐私政策 / Privacy Policy

生效日期 / Effective date: 2026-07-25

本政策适用于 NetTact 桌面版(通过 Microsoft Store 与 Apple App Store 分发的
Windows / macOS 一体化应用)以及自托管的 NetTact Lite 服务端与 Agent。

This policy covers the NetTact desktop app (the Windows / macOS all-in-one
application distributed via the Microsoft Store and the Apple App Store) and
the self-hosted NetTact Lite server and Agent.

---

## 中文版

### 一句话总结

NetTact 是**本地优先**的网络监控工具。它采集的所有监控数据都存储在**您自己的
设备**(或您自己部署的服务器)上。**我们(开发者)不运营任何接收您数据的
服务器,不收集任何遥测、分析或崩溃报告,也不出售或共享任何数据。**

### 1. 我们是谁

NetTact 由 NetTact 项目开发与发布(下称"我们")。联系方式见文末。

### 2. 应用在您设备上处理哪些数据

NetTact 的用途是监控**您自己的网络**。为此,应用内嵌的 Agent 会在您的设备上
采集以下类别的数据,并全部存储在本机数据库中:

- **本机系统指标**:CPU、内存、磁盘、系统负载、开机时长、网卡收发字节数。
  每一类均有独立的权限开关,关闭后完全不采集。
- **局域网设备发现**:读取操作系统的 ARP / 邻居表,得到局域网内设备的 IP 地址
  与 MAC 地址;可选地通过反向 DNS 查询设备主机名(有独立权限开关)。
  不进行任何抓包(packet capture)。
- **网络探测结果**:对您配置(或默认配置)的目标执行 ICMP ping、DNS 解析、
  HTTP、TCP 连接与网关连通性探测,记录时延、丢包率、状态码等指标。
- **NAT 类型检测**:通过 STUN 协议向所配置的 STUN 服务器发起探测,得到 NAT
  类型与本网络的公网(反射)IP 地址,存储在本机。
- **账号信息**:首次启动生成的本地管理员账号。密码仅以加密散列形式保存在
  本机数据库中,绝不上传。
- **告警与通知配置**:您配置的告警规则与通知渠道(如 Webhook 地址、SMTP
  账号)保存在本机数据库中。

以上数据仅用于向您展示监控面板、生成告警,不用于任何其他目的。

### 3. 应用会发起哪些对外网络连接

NetTact 不与我们的任何服务器通信。应用发起的全部对外连接为:

| 连接 | 目的 | 发送的内容 |
|---|---|---|
| GitHub(api.github.com) | 手动/定期检查新版本 | 一次普通的匿名 HTTPS 请求,不携带任何账号或监控数据;GitHub 会像对待任何网络请求一样看到您的 IP 地址(参见 [GitHub 隐私声明](https://docs.github.com/site-policy/privacy-policies/github-privacy-statement)) |
| 您配置的探测目标 | 网络监控本身 | ICMP/DNS/HTTP/TCP/STUN 探测包;目标由您(或默认列表)决定 |
| 您配置的通知渠道 | 告警送达 | 告警内容会发送到您自行填写的 Webhook 地址或 SMTP 邮件服务器;这些第三方如何处理数据取决于其各自的隐私政策 |
| 您自行部署的 NetTact 服务器(可选) | 远程 Agent 场景 | 若您将 Agent 连接到自己部署的服务器,监控数据会推送到该服务器——它仍然由您控制 |

除此之外没有任何连接。**没有遥测、没有使用分析、没有崩溃上报、没有广告
SDK。**

### 4. 数据存储、保留与删除

- 全部数据保存在本机的数据库文件中(桌面版位于应用数据目录)。
- 历史指标按服务端的数据保留设置自动清理。
- 卸载应用或删除数据库文件即可彻底删除全部数据。我们没有您数据的任何副本,
  因此也无从替您删除或恢复。

### 5. 系统权限

- **网络访问 / 本地网络访问**:监控功能所必需(发送探测包、读取邻居表)。
  在 macOS 上,系统会弹出"本地网络"权限请求。
- **系统通知**:用于本机告警通知,可在系统设置中随时关闭。
- **开机自启(可选)**:仅在您开启时注册,可随时关闭。

### 6. 数据共享与出售

我们不向任何第三方共享、出售或出租任何数据——事实上我们根本接触不到您的
数据。

### 7. 儿童隐私

NetTact 是网络运维工具,不面向 13 岁以下儿童,也不会有意收集儿童个人信息
(如上所述,我们不收集任何人的个人信息)。

### 8. 安全

监控数据保存在您的设备上,受操作系统用户隔离保护;管理员密码以加密散列存储;
与自部署服务器的连接支持 TLS。请妥善保管您的设备与管理员凭据。

### 9. 政策变更

政策若有实质变更,我们会更新本页面并修改生效日期。重大变更会在应用的版本
更新说明中注明。

### 10. 联系我们

隐私相关问题请联系:**privacy@nettact.org**,或在
[GitHub](https://github.com/nettact) 提交 issue。

---

## English Version

### Summary

NetTact is a **local-first** network monitoring tool. All monitoring data it
collects is stored **on your own device** (or on a server you deploy
yourself). **We (the developer) operate no servers that receive your data, and
we collect no telemetry, analytics, or crash reports. We do not sell or share
any data.**

### 1. Who we are

NetTact is developed and published by the NetTact project ("we"). Contact
details are at the end of this policy.

### 2. Data the app processes on your device

NetTact exists to monitor **your own network**. To do that, the embedded
Agent collects the following categories of data on your device, all of which
are stored in a local database:

- **Local system metrics**: CPU, memory, disk, system load, uptime, and
  network interface byte counters. Each family has its own permission toggle;
  when disabled, nothing in that family is collected.
- **LAN device discovery**: the app reads the operating system's ARP /
  neighbor table to learn the IP and MAC addresses of devices on your LAN,
  and can optionally resolve device hostnames via reverse DNS (separately
  permission-gated). No packet capture is performed.
- **Network probe results**: ICMP ping, DNS, HTTP, TCP, and gateway
  reachability probes against targets you configure (or the defaults),
  recording latency, packet loss, status codes, and similar metrics.
- **NAT type detection**: STUN probes against the configured STUN server
  determine your NAT type and your network's public (reflexive) IP address;
  the result is stored locally.
- **Account information**: a local administrator account generated on first
  launch. The password is stored only as a cryptographic hash in the local
  database and is never transmitted.
- **Alerting and notification configuration**: alert rules and notification
  channels you configure (e.g. webhook URLs, SMTP credentials) are stored in
  the local database.

This data is used solely to render your monitoring dashboard and generate
alerts, and for no other purpose.

### 3. Outbound network connections the app makes

NetTact never communicates with any server of ours. The complete list of
outbound connections is:

| Connection | Purpose | What is sent |
|---|---|---|
| GitHub (api.github.com) | Manual/periodic update check | A single anonymous HTTPS request carrying no account or monitoring data; GitHub sees your IP address as with any web request (see the [GitHub Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-privacy-statement)) |
| Probe targets you configure | The monitoring itself | ICMP/DNS/HTTP/TCP/STUN probe packets; targets are chosen by you (or the default list) |
| Notification channels you configure | Alert delivery | Alert contents are sent to webhook URLs or SMTP servers that you enter; how those third parties handle data is governed by their own privacy policies |
| A NetTact server you deploy yourself (optional) | Remote-agent setups | If you connect an Agent to your own server, monitoring data is pushed to that server — which remains under your control |

There are no other connections. **No telemetry, no usage analytics, no crash
reporting, no advertising SDKs.**

### 4. Data storage, retention, and deletion

- All data lives in a local database file (in the app data directory for the
  desktop app).
- Historical metrics are pruned automatically according to the server's data
  retention settings.
- Uninstalling the app or deleting the database file permanently removes all
  data. We hold no copy of your data and therefore cannot delete or recover
  it on your behalf.

### 5. System permissions

- **Network access / local network access**: required for monitoring itself
  (sending probes, reading the neighbor table). On macOS the system will show
  a "Local Network" permission prompt.
- **System notifications**: used for on-device alert notifications; can be
  disabled at any time in system settings.
- **Launch at login (optional)**: registered only if you enable it; can be
  turned off at any time.

### 6. Data sharing and selling

We do not share, sell, or rent any data to anyone — we never have access to
your data in the first place.

### 7. Children's privacy

NetTact is a network operations tool. It is not directed at children under
13, and we do not knowingly collect personal information from children (as
described above, we collect no one's personal information).

### 8. Security

Monitoring data stays on your device, protected by operating-system user
isolation; the administrator password is stored as a cryptographic hash;
connections to a self-deployed server support TLS. Please safeguard your
device and administrator credentials.

### 9. Changes to this policy

If this policy changes materially, we will update this page and the effective
date above, and note significant changes in the app's release notes.

### 10. Contact

For privacy questions, contact **privacy@nettact.org** or open an issue on
[GitHub](https://github.com/nettact).

---

## 附:商店申报对照 / Appendix: store declaration mapping

供上架填写隐私问卷时对照,不构成政策本身的一部分。
For filling in the store privacy questionnaires; not part of the policy
itself.

- **Apple App Store 隐私标签 / privacy "nutrition label"**: 应选择
  **"Data Not Collected"(不收集数据)** —— 应用不向开发者或第三方传输任何
  用户数据;所有监控数据仅在设备本地处理与存储,不满足 Apple 对"收集"
  (collect,指传输到设备之外)的定义。
  Select **"Data Not Collected"** — the app transmits no user data to the
  developer or third parties; all monitoring data is processed and stored
  on-device only, so nothing meets Apple's definition of "collect"
  (transmitted off the device by the developer).
- **Microsoft Store**: 在"应用是否访问、收集或传输个人信息"处如实申报:
  应用访问本地网络信息用于本地功能,但不向开发者传输任何个人信息。隐私政策
  URL 填写本页面的公开地址。
  Declare truthfully that the app accesses local network information for
  on-device functionality but transmits no personal information to the
  developer. Use this page's public URL as the privacy policy URL.
- 两个商店均要求**公开可访问的隐私政策 URL**——请将本文档发布到官网
  (例如 `https://nettact.org/privacy`)后再提交。
  Both stores require a **publicly reachable privacy policy URL** — publish
  this document on the website (e.g. `https://nettact.org/privacy`) before
  submitting.
