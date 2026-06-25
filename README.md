# luci-app-oxidns

语言：中文 | [English](./README.en.md)

`luci-app-oxidns` 是 OxiDNS 在 OpenWrt / LuCI 上的管理插件。它提供 OpenWrt 原生的 Web 管理入口，用于管理通过系统包管理器安装的 `oxidns` 运行时。

本插件不内置 OxiDNS 二进制。OxiDNS 内核应通过 OpenWrt 包管理器以 `oxidns` 包的形式安装，默认使用 full 版本。

## 仓库职责

`luci-app-oxidns` 与 OxiDNS 核心和 OpenWrt 内核包仓库保持分离：

- `svenshi/oxidns`：OxiDNS Rust 核心源码、通用 release、通用二进制、Docker 等。
- `svenshi/oxidns-openwrt-packages`：OpenWrt `oxidns` 内核包、package feed、manifest、checksums。
- `svenshi/luci-app-oxidns`：LuCI 管理插件、rpcd 后端、LuCI 包。

默认运行方式是通过 OpenWrt package feed 安装 package-managed 的 OxiDNS full bundle。裸二进制模式只作为高级回退，不是默认路径。

## 主要功能

- 总览页：展示包状态、二进制状态、服务状态、API 状态、配置路径和日志状态。
- 服务管理：启动、停止、重启、启用自启、禁用自启。
- 内核包管理：通过 `opkg` 或 `apk` 检查更新、安装、升级和删除 `oxidns`。
- 配置管理：查看、校验、保存、备份、重载、上传、下载和恢复默认配置。
- 基础配置：只编辑安全的顶层基础字段。
- 日志查看：刷新、暂停、继续、过滤、搜索、复制和清空前端显示。
- 插件设置：manifest/feed URL、代理、API 地址、配置路径、工作目录和可选 GitHub Token。
- 国际化：提供简体中文语言包 `luci-i18n-oxidns-zh-cn`。

## 安装

从 release artifact 安装 LuCI 插件：

```sh
opkg install luci-app-oxidns_0.1.0-r1_all.ipk
opkg install luci-i18n-oxidns-zh-cn_0.1.0-r1_all.ipk
```

在使用 `apk` 的 OpenWrt 系统上：

```sh
apk add --allow-untrusted luci-app-oxidns_0.1.0-r1_all.apk
apk add --allow-untrusted luci-i18n-oxidns-zh-cn_0.1.0-r1_all.apk
```

如果安装后 LuCI 菜单未出现，重启 `rpcd`：

```sh
/etc/init.d/rpcd restart
```

然后在 LuCI 中打开 `Services -> OxiDNS`。

简体中文界面由可选语言包 `luci-i18n-oxidns-zh-cn` 提供。OpenWrt SDK 会从 `po/zh_Hans/oxidns.po` 构建该语言包；本仓库本地 release 脚本也会生成对应的 `ipk` 和 `apk`。

## Package Feed

OxiDNS 内核应从自维护 OpenWrt package feed 安装。将下面的 URL 替换为 `svenshi/oxidns-openwrt-packages` 发布的真实 feed。

`opkg`：

```sh
echo 'src/gz oxidns https://example.com/oxidns/openwrt/packages' >> /etc/opkg/customfeeds.conf
opkg update
opkg install oxidns
```

`apk`：

```sh
echo 'https://example.com/oxidns/openwrt/packages' >> /etc/apk/repositories
apk update
apk add oxidns
```

配置 manifest URL 后，LuCI 的内核包管理页面也可以安装或升级 `oxidns`。

## 升级与删除

升级 LuCI 插件时，安装新的 `luci-app-oxidns` artifact，或从已配置的 package feed 升级。

升级 OxiDNS 内核：

```sh
opkg update
opkg upgrade oxidns
```

或：

```sh
apk update
apk upgrade oxidns
```

删除 `oxidns` 默认应保留 `/etc/oxidns/config.yaml` 和 `/var/lib/oxidns`。LuCI 插件可以继续保留安装状态，并显示内核未安装。

## 构建

在已启用 LuCI feed 的 OpenWrt buildroot 或 SDK 中构建：

```sh
make package/luci-app-oxidns/compile V=s
```

作为外部包开发时，将本仓库放置或软链接到 OpenWrt package tree，并确保 `$(TOPDIR)/feeds/luci/luci.mk` 存在。

不依赖 SDK 的本地 smoke build：

```sh
scripts/build-luci-package.sh 0.1.0 dist
```

本地验证：

```sh
scripts/check.sh
scripts/integration-check.sh
scripts/release-check.sh 0.1.0 dist
```

## 默认运行路径

- 二进制：`/usr/bin/oxidns`
- 配置：`/etc/oxidns/config.yaml`
- 工作目录：`/var/lib/oxidns`
- Init 脚本：`/etc/init.d/oxidns`

## 发布流程

推荐发布流程会把 OpenWrt 内核包从 OxiDNS 主仓库 release 中拆出来，避免主仓库 release asset 膨胀：

1. 在 `svenshi/oxidns` 发布核心版本 tag。
2. 通过 `repository_dispatch` 或 `workflow_dispatch` 触发 `svenshi/oxidns-openwrt-packages`。
3. 在 OpenWrt package 仓库中构建 OxiDNS full bundle 的 `ipk` 和 `apk`。
4. 从 package 仓库或 feed 发布 `manifest.json`、`latest.json` 和 `sha256sums.txt`。
5. 在 `svenshi/luci-app-oxidns` 发布 LuCI 插件 tag。
6. 更新 package feed，并在目标 OpenWrt 镜像上验证安装、服务启动、配置保存和日志查看。

本仓库的 release workflow 会运行静态检查、集成检查，构建 LuCI `ipk` / `apk`，构建简体中文 `luci-i18n-oxidns-zh-cn` artifact，并发布到 GitHub Release。

## OpenWrt 内核包矩阵

OpenWrt 内核包矩阵目标：

- `x86_64-unknown-linux-musl`
- `aarch64-unknown-linux-musl`
- `i686-unknown-linux-musl`
- `arm-unknown-linux-musleabihf`（32 位 ARM hard-float）
- `armv7-unknown-linux-musleabihf`（ARMv7 hard-float，后续发行版本支持）

`arm-unknown-linux-musleabihf` 与 `armv7-unknown-linux-musleabihf` 是两个不同发行目标，不能互相替代。包选择基于 OpenWrt 包管理器、包架构，以及 `oxidns-openwrt-packages` 生成的 manifest。

## 已知限制

- 基础配置表单只编辑顶层安全字段，不编辑 `plugins` 条目或插件参数。
- 日志页优先读取 OxiDNS API 日志；API 不可用时回退到 `logread`。
- 本地 CI package 检查不能替代真实 OpenWrt `opkg` 和 `apk` 目标验证。
- 裸二进制模式仅为高级回退，不是默认安装、升级或删除路径。
