# NetTact Desktop

NetTact Desktop 是面向家庭和中小企业用户的一体化桌面版本。它把 NetTact Server、
监控 Agent 和系统托盘/菜单栏应用组合在一个程序中，不需要命令行配置、
单独部署 Server，也不需要手动签发 Agent 注册令牌。

控制台会在系统默认浏览器中打开。Desktop 不内置 Chromium、WebView2 或 Electron；
关闭浏览器不会停止监控，需要从系统托盘或菜单栏选择“退出”才会停止程序。

## 下载最新版

所有安装包、校验文件和历史版本统一通过
[NetTact 下载中心](https://d.nettact.org) 分发。下载中心由 Cloudflare Worker
从官方 GitHub Release 获取经过白名单校验的资产；仓库可以保持私有，下载者无需
GitHub Token。下面的固定地址始终指向最近一次成功发布的 Desktop 版本，历史版本可在
下载中心首页选择。

| 平台 | 下载 | SHA-256 |
|---|---|---|
| Windows x64（MSI 安装包） | [nettact-desktop-windows-amd64.msi](https://d.nettact.org/desktop/nettact-desktop-windows-amd64.msi) | [校验文件](https://d.nettact.org/desktop/nettact-desktop-windows-amd64.msi.sha256) |
| macOS 12+（Apple Silicon + Intel 通用版） | [nettact-desktop-macos-universal.zip](https://d.nettact.org/desktop/nettact-desktop-macos-universal.zip) | [校验文件](https://d.nettact.org/desktop/nettact-desktop-macos-universal.zip.sha256) |

[latest.json](https://d.nettact.org/desktop/latest.json) 提供当前版本号、发布时间和各平台
下载地址，供脚本或其他自动化工具读取。

::: warning 当前版本尚未完成正式代码签名
Windows 构建尚未进行 Authenticode 签名，macOS 应用仅使用 ad-hoc 签名且未公证。
系统可能显示 SmartScreen 或 Gatekeeper 警告。请只从本页列出的
`d.nettact.org` 地址下载，并在运行前核对 SHA-256。
:::

## Windows 安装与首次运行

1. 下载 Windows MSI 和对应的 `.sha256` 文件。
2. 双击 `nettact-desktop-windows-amd64.msi`，按照安装向导完成安装。安装程序会为
   所有用户安装到 `C:\Program Files\NetTact`，并创建开始菜单和桌面快捷方式。
3. 如果 SmartScreen 显示警告，请先确认下载域名和 SHA-256，再选择“更多信息”→
   “仍要运行”。
4. 启动后，程序驻留在系统托盘，并在默认浏览器中打开本地控制台。

在 PowerShell 中计算 SHA-256：

```powershell
(Get-FileHash .\nettact-desktop-windows-amd64.msi -Algorithm SHA256).Hash.ToLower()
Get-Content .\nettact-desktop-windows-amd64.msi.sha256
```

两条命令显示的哈希值应一致。

## macOS 安装与首次运行

1. 下载 macOS ZIP 和对应的 `.sha256` 文件。
2. 解压后把 `NetTact.app` 移到“应用程序”目录。
3. 第一次尝试打开应用。
4. macOS 14 及更早版本：右键应用，选择“打开”→“打开”。
5. macOS 15 及更新版本：前往“系统设置”→“隐私与安全性”，选择“仍要打开”。

也可以在终端中移除隔离标记：

```bash
xattr -d com.apple.quarantine /Applications/NetTact.app
```

校验下载文件：

```bash
shasum -a 256 -c nettact-desktop-macos-universal.zip.sha256
```

NetTact 在 macOS 上是菜单栏应用，不显示 Dock 图标。点击菜单栏图标后选择
“打开控制台”。

## 运行方式

Desktop 启动后会：

1. 创建当前用户的数据目录和滚动日志；
2. 在 `127.0.0.1:12450` 启动内置 Server；
3. 启动内置 Agent 并自动完成本地注册；
4. 通过一次性登录地址在默认浏览器中打开控制台；
5. 持续驻留在系统托盘或菜单栏中执行监控。

Web 控制台已随应用一起打包，首次启动无需联网下载前端资源，离线也能直接打开控制台。
默认情况下，Server 只监听回环地址，不会向局域网开放控制台；只有在控制台中主动修改
监听地址后这一行为才会改变。

“登录时启动”选项可以让 Desktop 随系统静默启动，不会在登录时自动弹出浏览器。
之后点击托盘图标或菜单栏中的“打开控制台”即可重新打开。

## 数据位置与卸载

Desktop 的数据库、Agent 身份、发送缓冲和日志保存在：

- Windows：`%LOCALAPPDATA%\NetTact`
- macOS：`~/Library/Application Support/NetTact`

升级或重新安装会继续使用这些数据。仅删除应用程序不会删除监控数据；如需完全清除，
请先退出 NetTact，再手动删除对应的数据目录。

如果需要在服务器、NAS 或多台设备上分别部署 Server 和 Agent，请改用
[Docker Compose 部署](./deploy.md)。
