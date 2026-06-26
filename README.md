# luci-app-oxidns

语言：中文 | [English](./README.en.md)

`luci-app-oxidns` 是 OxiDNS 的 OpenWrt / LuCI 管理插件。安装后，LuCI 会出现 `Services -> OxiDNS` 页面，用来管理 OxiDNS 的安装、服务、配置和日志。

这个插件不内置 OxiDNS 内核二进制。真正运行的是 OpenWrt 包 `oxidns`，由 `svenshi/oxidns-openwrt-packages` 发布，LuCI 会通过 manifest 自动选择适合当前设备架构的包。

## 你需要安装什么

- `luci-app-oxidns`：LuCI 管理页面。
- `luci-i18n-oxidns-zh-cn`：可选简体中文语言包。
- `oxidns`：真正运行的 OxiDNS 内核包，可在 LuCI 的 `Package` 页面安装或升级。

## 安装 LuCI 插件

从本仓库 Release 下载对应的 LuCI 包，然后安装：

```sh
opkg install ./luci-app-oxidns_0.1.0-r1_all.ipk
opkg install ./luci-i18n-oxidns-zh-cn_0.1.0-r1_all.ipk
```

在使用 `apk` 的 OpenWrt 系统上：

```sh
apk add --allow-untrusted ./luci-app-oxidns_0.1.0-r1_all.apk
apk add --allow-untrusted ./luci-i18n-oxidns-zh-cn_0.1.0-r1_all.apk
```

如果安装后菜单没有出现，重启 `rpcd`：

```sh
/etc/init.d/rpcd restart
```

然后打开 LuCI：`Services -> OxiDNS`。

## 安装或升级 OxiDNS 内核

LuCI 的 `Package` 页面会从 manifest 读取可用的 OxiDNS 内核包。仓库公开并启用 GitHub Pages 后，默认 manifest 地址是：

```text
https://svenshi.github.io/oxidns-openwrt-packages/manifest.json
```

如果 GitHub Pages 暂时不可用，也可以临时使用某个 Release 中的 manifest，例如：

```text
https://github.com/svenshi/oxidns-openwrt-packages/releases/download/v1.4.0/manifest.json
```

使用步骤：

1. 打开 `Services -> OxiDNS -> Settings`，确认 `Manifest URL` 可访问。
2. 打开 `Services -> OxiDNS -> Package`，点击 `Check for updates`。
3. 根据页面结果点击 `Install` 或 `Upgrade`。

LuCI 会使用系统里的 `opkg` 或 `apk` 安装包，并校验 manifest 中的 SHA256。manifest 会同时列出可用的 `ipk` 和 `apk` 包，LuCI 会按当前系统的包管理器和架构选择匹配项。

## 常用页面

- `Overview`：查看包状态、服务状态、API 状态、配置路径和日志状态。
- `Package`：检查、安装、升级或删除 `oxidns` 内核包。
- `Service`：启动、停止、重启服务，或启用/禁用开机自启。
- `Config`：查看、保存、校验、备份、上传或下载配置文件。
- `Basic Config`：编辑安全的顶层基础配置项。
- `Logs`：查看运行日志，支持刷新、暂停、过滤和搜索。
- `Settings`：设置 manifest URL、代理、API 地址、配置路径和工作目录。

## 默认路径

- 二进制：`/usr/bin/oxidns`
- 配置：`/etc/oxidns/config.yaml`
- 工作目录：`/var/lib/oxidns`
- 服务脚本：`/etc/init.d/oxidns`
- API 地址：`http://127.0.0.1:9199/api`

## 升级与删除

升级 LuCI 插件时，下载新版本 `luci-app-oxidns` 包并重新安装即可。

升级 OxiDNS 内核时，推荐使用 LuCI 的 `Package` 页面；也可以手动下载匹配架构的 `oxidns` 包后用 `opkg install` 安装。

删除 OxiDNS 内核包可以在 LuCI 的 `Package` 页面操作，也可以执行：

```sh
opkg remove oxidns
```

删除内核包默认应保留 `/etc/oxidns/config.yaml` 和 `/var/lib/oxidns`，方便以后重新安装或升级。

## 私有仓库与下载

路由器需要能直接访问 manifest 和包文件。仓库仍是私有状态时，GitHub Pages 可能不可用，Release 文件也可能无法被路由器直接下载。公开发布后，推荐使用 GitHub Pages 的 manifest 地址。

## 已知限制

- Package 页面依赖 manifest 中的 `openwrt_arch` 与设备包管理器报告的架构匹配。
- OxiDNS OpenWrt 内核包同时发布 `ipk` 和 `apk`，但仍需要对应架构出现在 manifest 中。
- `Basic Config` 只编辑安全的顶层字段，不编辑复杂插件配置。
- 日志页优先读取 OxiDNS API；API 不可用时回退到 OpenWrt `logread`。
