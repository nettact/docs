# NetTact Desktop

NetTact Desktop is the all-in-one edition for homes and small businesses. It
combines the NetTact Server, monitoring agent, and system tray or menu-bar
application in one program. It requires no command-line setup, separate server
deployment, or manually issued agent enrollment token.

The console opens in your system's default browser. Desktop does not embed
Chromium, WebView2, or Electron. Closing the browser does not stop monitoring;
use **Exit** from the tray or menu-bar menu to stop the application.

## Download the latest version

All installers, checksums, and version history are distributed through the
[NetTact Download Center](https://d.nettact.org). A Cloudflare Worker retrieves
approved assets from official GitHub Releases, including private repositories;
downloaders do not need a GitHub token. These stable URLs always point to the
most recently published successful Desktop release, while previous versions
remain available from the download center.

| Platform | Download | SHA-256 |
|---|---|---|
| Windows x64 (MSI installer) | [nettact-desktop-windows-amd64.msi](https://d.nettact.org/desktop/nettact-desktop-windows-amd64.msi) | [checksum file](https://d.nettact.org/desktop/nettact-desktop-windows-amd64.msi.sha256) |
| macOS 12+ (universal Apple Silicon + Intel) | [nettact-desktop-macos-universal.zip](https://d.nettact.org/desktop/nettact-desktop-macos-universal.zip) | [checksum file](https://d.nettact.org/desktop/nettact-desktop-macos-universal.zip.sha256) |

[latest.json](https://d.nettact.org/desktop/latest.json) provides the current
version, publication time, and platform download URLs for scripts and other
automation.

::: warning The current builds are not production code-signed
The Windows build is not Authenticode-signed. The macOS application is ad-hoc
signed and not notarized. SmartScreen or Gatekeeper may therefore display a
warning. Download only from the `d.nettact.org` links on this page and verify
the SHA-256 checksum before running the application.
:::

## Windows installation and first launch

1. Download the Windows MSI and its `.sha256` file.
2. Double-click `nettact-desktop-windows-amd64.msi` and follow the installer.
   It installs for all users under `C:\Program Files\NetTact` and creates Start
   menu and desktop shortcuts.
3. If SmartScreen displays a warning, verify the download domain and SHA-256,
   then choose **More info** → **Run anyway**.
4. The application appears in the system tray and opens the local console in
   your default browser.

Calculate the SHA-256 hash in PowerShell:

```powershell
(Get-FileHash .\nettact-desktop-windows-amd64.msi -Algorithm SHA256).Hash.ToLower()
Get-Content .\nettact-desktop-windows-amd64.msi.sha256
```

The hashes printed by the two commands must match.

## macOS installation and first launch

1. Download the macOS ZIP and its `.sha256` file.
2. Extract it and move `NetTact.app` into Applications.
3. Try to open the application once.
4. On macOS 14 and earlier, right-click the application and select
   **Open** → **Open**.
5. On macOS 15 and later, open **System Settings** → **Privacy & Security** and
   select **Open Anyway**.

Alternatively, remove the quarantine attribute in Terminal:

```bash
xattr -d com.apple.quarantine /Applications/NetTact.app
```

Verify the download:

```bash
shasum -a 256 -c nettact-desktop-macos-universal.zip.sha256
```

NetTact is a menu-bar application on macOS and has no Dock icon. Select
**Open console** from its menu-bar menu.

## How it runs

On launch, Desktop:

1. creates the current user's data directory and rotating log;
2. starts the bundled server on `127.0.0.1:12450`;
3. starts the bundled agent and enrolls it locally;
4. opens the console in the default browser through a one-time login URL; and
5. remains in the system tray or menu bar while monitoring continues.

The web console ships inside the application, so the first start needs no
internet access to fetch frontend assets and the console opens offline. By
default, the server listens only on the loopback address and does not expose
the console to the LAN. This changes only if you explicitly change the listen
address in the console.

The **Start at login** option starts Desktop silently with the operating
system, without opening a browser during sign-in. Click the tray icon or select
**Open console** from the menu-bar menu whenever you want to reopen it.

## Data location and removal

Desktop stores its database, agent identity, send buffer, and logs under:

- Windows: `%LOCALAPPDATA%\NetTact`
- macOS: `~/Library/Application Support/NetTact`

Upgrades and reinstalls continue to use this data. Removing the application
alone does not delete monitoring data. To remove everything, exit NetTact and
then delete the corresponding data directory.

For a server, NAS, or multi-device setup with separately deployed servers and
agents, use the [Docker Compose deployment guide](./deploy.md) instead.
