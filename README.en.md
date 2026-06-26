# luci-app-oxidns

Language: [中文](./README.md) | English

`luci-app-oxidns` is the LuCI management app for OxiDNS on OpenWrt. After installation, LuCI adds `Services -> OxiDNS` pages for managing installation, service state, configuration, and logs.

This LuCI app does not embed the OxiDNS runtime binary. The actual runtime is the OpenWrt package named `oxidns`, published by `svenshi/oxidns-openwrt-packages`. LuCI reads its manifest and selects the package that matches the current device architecture.

## What To Install

- `luci-app-oxidns`: the LuCI management pages.
- `luci-i18n-oxidns-zh-cn`: optional Simplified Chinese translation package.
- `oxidns`: the actual OxiDNS runtime package, installed or upgraded from the LuCI `Package` page.

## Install The LuCI App

Download the LuCI release artifact and install it on OpenWrt:

```sh
opkg install ./luci-app-oxidns_0.1.0-r1_all.ipk
opkg install ./luci-i18n-oxidns-zh-cn_0.1.0-r1_all.ipk
```

On OpenWrt systems using `apk`:

```sh
apk add --allow-untrusted ./luci-app-oxidns_0.1.0-r1_all.apk
apk add --allow-untrusted ./luci-i18n-oxidns-zh-cn_0.1.0-r1_all.apk
```

If the menu does not appear after installation, restart `rpcd`:

```sh
/etc/init.d/rpcd restart
```

Then open LuCI: `Services -> OxiDNS`.

## Install Or Upgrade OxiDNS Core

The LuCI `Package` page reads available OxiDNS runtime packages from a manifest. After the package repository is public and GitHub Pages is enabled, the default manifest URL is:

```text
https://svenshi.github.io/oxidns-openwrt-packages/manifest.json
```

If GitHub Pages is temporarily unavailable, you can use a manifest from a specific GitHub Release, for example:

```text
https://github.com/svenshi/oxidns-openwrt-packages/releases/download/v1.4.0/manifest.json
```

Steps:

1. Open `Services -> OxiDNS -> Settings` and confirm that `Manifest URL` is reachable.
2. Open `Services -> OxiDNS -> Package` and click `Check for updates`.
3. Click `Install` or `Upgrade` based on the result.

LuCI installs the package through the system package manager, `opkg` or `apk`, and verifies the SHA256 value from the manifest.

The current OxiDNS OpenWrt runtime releases are mainly `ipk` packages. Systems using `apk` need matching `apk` runtime packages before installation can work from this page.

## Main Pages

- `Overview`: package, service, API, config path, and log status.
- `Package`: check, install, upgrade, or remove the `oxidns` runtime package.
- `Service`: start, stop, restart, enable, or disable the service.
- `Config`: view, save, validate, back up, upload, or download the config file.
- `Basic Config`: edit safe top-level configuration fields.
- `Logs`: view runtime logs with refresh, pause, filter, and search controls.
- `Settings`: configure manifest URL, proxy, API endpoint, config path, and working directory.

## Default Paths

- Binary: `/usr/bin/oxidns`
- Config: `/etc/oxidns/config.yaml`
- Working directory: `/var/lib/oxidns`
- Init script: `/etc/init.d/oxidns`
- API endpoint: `http://127.0.0.1:9199/api`

## Upgrade And Remove

To upgrade the LuCI app, download and install the newer `luci-app-oxidns` package.

To upgrade the OxiDNS runtime, use the LuCI `Package` page. You can also download the matching `oxidns` package manually and install it with `opkg install`.

To remove the OxiDNS runtime from the command line:

```sh
opkg remove oxidns
```

Removing the runtime package should preserve `/etc/oxidns/config.yaml` and `/var/lib/oxidns` by default, so reinstalling or upgrading later can reuse existing state.

## Private Repositories And Downloads

The router must be able to reach the manifest and package files directly. While the package repository is private, GitHub Pages may be unavailable and release files may not be directly downloadable by the router. After public release, use the GitHub Pages manifest URL when possible.

## Known Limitations

- The `Package` page depends on `openwrt_arch` in the manifest matching the architecture reported by the device package manager.
- Current OxiDNS OpenWrt runtime packages are mainly `ipk`; matching `apk` runtime packages are still pending.
- `Basic Config` only edits safe top-level fields and does not edit complex plugin configuration.
- The log page prefers the OxiDNS API and falls back to OpenWrt `logread` when the API is unavailable.
