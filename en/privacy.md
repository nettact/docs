# NetTact Privacy Policy

**Effective date:** 2026-07-25<br>
**Last updated:** 2026-08-04

This policy applies to NetTact Desktop distributed through the Microsoft Store, the Mac App Store, or other official channels, as well as NetTact Server and NetTact Agent (collectively, “NetTact”).

## 1. Key points

NetTact is a **local-first, self-hosted** network monitoring and diagnostic
tool.

As described below, NetTact processes network, device, and monitoring data on
your device or a server you administer. The NetTact project and the developer
or seller identified on the applicable store listing (“we,” “us,” or “our”) do
not operate a NetTact cloud service that receives this data. We do not receive
your monitoring data, account information, telemetry, usage analytics, or
crash reports from the app.

We do not sell personal data, use advertising SDKs, or track you across apps or
websites.

## 2. Scope and roles

- **NetTact Desktop:** the server, Agent, and database run on your device. By
  default, the console is available to your local browser only through a
  loopback address.
- **Self-hosted NetTact Server and Agent:** the Agent sends data to the NetTact
  server you specify. That server is controlled by you or your organization,
  not by us.
- If an organization uses NetTact to monitor its devices and networks, that
  organization is responsible for deciding what data is processed, setting
  retention periods, and providing any notices required for its users.

This policy does not govern probe targets, notification providers, DNS or STUN
services that you configure, or services independently provided by Microsoft,
Apple, GitHub, or other third parties.

## 3. Data NetTact processes in your environment

Depending on the features you use, operating-system capabilities, and your
configuration, NetTact may process:

| Data category | Examples | Purpose |
|---|---|---|
| App and device identifiers | Random Agent ID, site ID, device hostname, operating system and platform, app and Agent versions | Identify monitored devices, show status, support compatibility and troubleshooting |
| Network interface and Wi-Fi information | Interface names and status, local IP addresses, gateway, DNS servers, Wi-Fi connection status, SSID, band, channel, signal strength, and link rates | Show local network status, assess wireless quality, and diagnose faults |
| LAN device information | IP and MAC addresses, optional hostnames, vendor information, and last-seen times obtained through operating-system facilities such as the neighbor table | Discover and display devices on your network |
| Host resource metrics | Overall and per-core CPU use, memory, disk, load, uptime, and network transfer rates | Show device health and evaluate alert rules you configure |
| Network probe and diagnostic results | User-configured or default targets; latency, loss, status codes, resolution results, error details, route hops, NAT type, and public mapped address from ICMP, DNS, HTTP, TCP, gateway, NAT/STUN, and traceroute operations | Measure availability, build history charts, and create events and alerts |
| Process and connection snapshots | Process IDs, names, status, user, CPU, memory, runtime, and disk I/O; connection protocol and state, local and remote addresses and ports, and associated processes | Diagnose a host when you request a live host view in the console; these snapshots are generated only on demand |
| Account, security, and configuration data | Local administrator username and password hash, session records and cookies, Agent keys and credentials, monitoring targets, alert rules, UI settings, webhook URLs/headers/templates, and SMTP server, account, and password | Authenticate locally, retain your settings, and perform monitoring and notifications |
| Alerts, events, and notification content | Time, severity, target, metric value, failure details, affected Agent, and console links used in notifications | Display and correlate incidents and deliver notifications you configure |
| Local operational logs | Startup, runtime, and error information; an error may identify an affected target or notification endpoint | Troubleshoot the app. Desktop rotates these logs locally and does not upload them to us as crash reports |

NetTact does not perform packet capture, read communication content to profile
users, or access your contacts, photos, calendar, microphone, camera, or precise
geolocation.

## 4. How data is used

NetTact processes the data above only to:

- provide network, device, and host monitoring;
- display current status, historical trends, and device inventory;
- perform diagnostics requested by the user;
- detect faults, correlate incidents, and deliver configured notifications;
- secure the local console and Agent connections; and
- retain user settings and troubleshoot operation.

We do not use this data for advertising, marketing, credit decisions, data
brokering, or training general-purpose artificial intelligence models.

## 5. Outbound connections and third parties

NetTact sends no monitoring data, account information, or telemetry to our
servers. It does contact a NetTact-operated download host to check for and
retrieve releases; like any HTTP request, that reveals your source IP address
and ordinary request metadata. The app may make the following outbound
connections:

| Recipient | When | Data sent |
|---|---|---|
| Probe targets, DNS resolvers, and STUN servers you configure | When performing monitoring or diagnostics | ICMP, DNS, HTTP, TCP, STUN, or traceroute traffic needed for the feature. The recipient can generally see your source IP address and necessary protocol data |
| Webhook endpoints or SMTP mail servers you configure | When sending a test or actual alert | Authentication data you configure and notification content such as alert title, target, state, metrics, failure details, and console link |
| A NetTact server you deploy | When using a standalone Agent | Agent identity, device and network information, metrics, events, inventory, and requested diagnostic results |
| The NetTact download host (`d.nettact.org`), operated by us | Automatically at startup and every 24 hours to read the public release catalog; when a self-hosted server fetches its bundled web console (first run, and after an upgrade); and on an OpenWrt router each time the agent binary is downloaded — on every boot in RAM mode, once in flash mode. Each can be pointed at your own mirror (`NETTACT_UPDATE_BASE_URL`, `NETTACT_WEBUI_BASE_URL`, the `download_base` option), and update checking can be switched off entirely with `NETTACT_UPDATE_BASE_URL=off` | An ordinary HTTPS request containing no monitoring data, account information, or device identifiers. As with any network request, we receive your source IP address and standard request metadata such as the requested path and user agent |
| GitHub (`api.github.com`) | When you manually select “Check for updates” in a non-store build. A Microsoft Store build is updated by the Store and does not contact GitHub for this | An ordinary HTTPS request that does not contain your NetTact account or monitoring database content. As with other network requests, GitHub may receive your source IP address and standard request metadata. See the [GitHub Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-privacy-statement) |
| Microsoft or Apple | When obtaining, installing, or updating a store version | Account, transaction, device, or diagnostic data independently handled by the store and operating system, subject to the [Microsoft Privacy Statement](https://privacy.microsoft.com/privacystatement) or [Apple Privacy Policy](https://www.apple.com/legal/privacy/) |

Third-party services you choose may process data in other countries or regions.
Review the privacy and security terms of any probe target, webhook provider,
mail server, DNS or STUN service, or remote NetTact server before configuring
it.

## 6. Local permissions

NetTact may use the following system capabilities:

- **Network and local-network access:** to discover LAN devices, read interface
  status, and perform probes. macOS may display a Local Network permission
  prompt.
- **System notifications:** to display on-device alerts. You can disable them
  in system settings.
- **Launch at startup or login:** configured only when you enable the option,
  and removable at any time. A Microsoft Store build uses the system startup-task
  mechanism, so the entry also appears in the Windows startup-apps settings and
  can be turned off there.
- **System process and connection information:** read only when you request the
  corresponding live view; the operating system may restrict some fields.

Permission names may vary by operating-system version.

## 7. Storage, retention, and deletion

### NetTact Desktop

Data is stored on your device under:

- Windows: `%LOCALAPPDATA%\NetTact`
- macOS: `~/Library/Application Support/NetTact`

This includes the local SQLite database, Agent identity and pending-delivery
queue, and rotating logs. Desktop keeps up to three log files of approximately
10 MB each. Live process and connection snapshots remain only in server memory,
are replaced by later snapshots, are not written to the history database, and
disappear when the app exits.

### Self-hosted deployments

Data is stored on the NetTact server and Agent devices you specify. Historical
metrics and incident evidence are pruned according to server retention
settings. Accounts, configuration, inventory, alerts, and other records remain
until you delete them or remove the database.

### How to delete data

You can delete monitoring targets, Agents, notification channels, and other
configuration through the console. To remove all Desktop data, exit the app
and delete the NetTact application-data directory listed above. Uninstalling
the app alone may not remove application data. Administrators of self-hosted
deployments can delete their database, logs, and Agent data directories.

Because we do not hold a copy of this data, we cannot access, export, correct,
delete, or restore it on your behalf.

## 8. Security

NetTact Desktop binds the console to a loopback address by default.
Administrator passwords are hashed with bcrypt. One-time login tokens are
short-lived, single-use, and not written to logs. Standalone Agents can connect
to a server you configure using TLS.

The security of webhooks, SMTP, remote servers, and listening addresses depends
on your configuration. Notification credentials are stored in the database
you control so NetTact can deliver notifications. Protect your devices,
database, backups, and administrator credentials; enable TLS for remote access;
and use only services you trust.

No system can guarantee absolute security.

## 9. Sale, sharing, and tracking

We do not sell or rent personal data, provide it to data brokers, or share it
for targeted advertising. NetTact contains no advertising, third-party
analytics SDK, or cross-app tracking technology.

Data is sent to an external probe, notification service, or self-hosted server
only when you configure and use that functionality, as described in Section 5.

## 10. Children’s privacy

NetTact is a tool for home network administrators and organizational IT
operators. It is not directed to children under 13 (or another minimum age
required by local law), and we do not knowingly collect personal data from
children.

## 11. Changes to this policy

We may update this policy when product features, store requirements, or laws
change. We will revise the “Last updated” date above and may also describe
material changes in release notes or project announcements.

## 12. Contact us

For questions about this policy or NetTact’s data handling, email
**privacy@nettact.org** or contact us through the
[NetTact GitHub organization](https://github.com/nettact).
