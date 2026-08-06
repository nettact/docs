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

## Connect to other servers

The bundled agent always reports to the NetTact server running inside Desktop
itself. It can report to another NetTact server at the same time — a family
member's, or the one at work — and you choose separately what each of them is
allowed to collect. Everything is done in the console; there is no configuration
file to edit.

Open the console, go to **Settings**, and find the **Connect to other servers**
panel:

1. In the other server's console, open its **Agent** page and generate a one-time
   enrollment token.
2. Back in Desktop, choose **Add a server**. Fill in the **Server address** — the
   address you open that console at, including the port — and paste the
   **Enrollment token**. **Display name** is optional: left empty, the name is
   derived from the address's **host name alone**, lower-cased, with everything
   that is not a letter, digit, `-` or `_` folded to `-`. The scheme and the port
   are dropped, so `https://work.example:12450` becomes `work-example`, and
   `http://192.168.1.10:12450` becomes `192-168-1-10`. Type a name if you would
   rather see something else.
3. Under **What this server may collect**, pick a preset, or switch to the custom
   list and select individual permissions. The choice applies to that server
   alone: the one at work can be limited to reachability checks while the one at
   home also reads this computer's CPU and memory.
4. Save. This computer then appears in that server's console as well, alongside
   the monitoring you already see locally.

Each entry shows its connection state, what it is allowed to collect, and the
identity this computer was given on that server. Two actions are available per
entry: **Change what it collects** and **Remove**. Removing an entry stops this
computer reporting to that server; the history already sent stays there, and
adding the server back later needs a new enrollment token.

Worth knowing:

- **Enrollment tokens are single-use and expire 24 hours after they are
  created.** An entry showing **Sign-up failed** has not necessarily burnt its
  token, though: that status covers *every* reason sign-up did not complete —
  the server being down, no network, DNS not resolving, a certificate being
  rejected. So read the **Last error** line on the entry first. Desktop keeps the
  stored token and retries on its own, waiting 5 seconds after the first failure
  and doubling up to 5 minutes between attempts, so anything transient recovers
  by itself once the server is reachable again — there is nothing to do but
  wait. Only when the error says the token itself was refused (already used, or
  expired) is re-creating the entry the fix, and because a token is never
  displayed again once saved, that means removing the entry, generating a fresh
  token on that server, and adding it again.
- **Desktop's own server is not in the list**, and cannot be removed or
  restricted. It keeps full access to this computer, which is the point of the
  all-in-one edition.
- **Frame-rate and game capture belong to the local server only.** Adding another
  server never reports what you play to it.
- **Skip certificate checking** is for a server using a self-signed certificate on
  your own network. It makes the connection possible to intercept, so leave it
  off otherwise.
- The servers are independent. One of them being unreachable, or removing this
  computer from its own console, leaves the others — and your local monitoring —
  running normally.

## Data location and removal

Desktop stores its database, agent identity, send buffer, and logs under:

- Windows: `%LOCALAPPDATA%\NetTact`
- macOS: `~/Library/Application Support/NetTact`

Upgrades and reinstalls continue to use this data. Removing the application
alone does not delete monitoring data. To remove everything, exit NetTact and
then delete the corresponding data directory.

For a server, NAS, or multi-device setup with separately deployed servers and
agents, use the [Docker Compose deployment guide](./deploy.md) instead.
