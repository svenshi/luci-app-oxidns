# luci-app-oxidns

Language: [中文](./README.md) | English

`luci-app-oxidns` is the LuCI management app for OxiDNS on OpenWrt. After installation, LuCI adds `Services -> OxiDNS` pages for installing the OxiDNS core binary, managing the OpenWrt service, editing configuration, and viewing logs.

This app does not embed the OxiDNS core binary and no longer manages a separate OpenWrt `oxidns` runtime package. LuCI downloads the official OxiDNS GitHub Release archive, verifies the SHA256 digest, and installs the binary as an OpenWrt service. Future OxiDNS core upgrades are handled by OxiDNS itself; LuCI does not provide core-upgrade or LuCI-app self-upgrade buttons.

## What To Install

- `luci-app-oxidns`: LuCI pages, rpcd backend, and OpenWrt init service script.
- `luci-i18n-oxidns-zh-cn`: optional Simplified Chinese translation package.

## Install The LuCI App

On OpenWrt, the recommended path is the official one-command installer. Run it as root:

```sh
curl -fsSL https://oxidns.org/install.sh | sh
```

If `curl` is not installed, use `wget`:

```sh
wget -O- https://oxidns.org/install.sh | sh
```

The script detects the OpenWrt package manager, reads the latest package from `luci-app-oxidns` Releases, selects `.ipk` or `.apk` for the system, installs `luci-app-oxidns` plus the optional Simplified Chinese translation package, and restarts `rpcd`. See <https://oxidns.org/openwrt> for more script options.

You can also download the LuCI release artifact and install it manually:

```sh
opkg install ./luci-app-oxidns_0.1.0-r1_all.ipk
opkg install ./luci-i18n-oxidns-zh-cn_0.1.0-r1_all.ipk
```

On OpenWrt systems using `apk`:

```sh
apk add --allow-untrusted --no-network ./luci-app-oxidns_0.1.0-r1_all.apk
apk add --allow-untrusted --no-network ./luci-i18n-oxidns-zh-cn_0.1.0-r1_all.apk
```

If the menu does not appear after installation, restart `rpcd`:

```sh
/etc/init.d/rpcd restart
```

Then open LuCI: `Services -> OxiDNS`.

## Install OxiDNS Core

If you are migrating from the old OpenWrt `oxidns` package model, stop the service and remove the old runtime package first so it no longer owns `/usr/bin/oxidns` or `/etc/init.d/oxidns`:

```sh
/etc/init.d/oxidns stop
opkg remove oxidns
```

On systems using `apk`, run:

```sh
/etc/init.d/oxidns stop
apk del oxidns
```

1. Open `Services -> OxiDNS -> Settings` and confirm `Core repository` is `svenshi/oxidns` and `Core bundle` is `full`.
2. Open `Services -> OxiDNS -> Core` and click `Install Core`. For offline installs, click `Upload Core` to upload an official `.tar.gz` archive or a single `oxidns` binary.
3. After installation succeeds, use `Overview` to start and enable the service.

LuCI selects the OxiDNS Linux musl release archive for the current CPU architecture, such as `oxidns-x86_64-unknown-linux-musl.tar.gz`. The GitHub release asset SHA256 digest is verified before installation.

When the core is already installed, the `Core` page offers `Repair Reinstall` and `Upload Core`, which repair the binary or WebUI files by downloading the current installed version again or using an uploaded file. It does not install latest and is not an upgrade entry point.

## Main Pages

- `Overview`: core, service, WebUI entry, config path, and log status.
- `Core`: install, upload install, repair reinstall, or remove the OxiDNS core binary.
- `Configuration`: view, save, and validate the config file.
- `Logs`: view runtime logs with refresh and pause controls.
- `Settings`: configure core repository, bundle, proxy, config path, and working directory.

## Default Paths

- Binary: `/usr/bin/oxidns`
- WebUI: `/usr/share/oxidns/webui`
- Config: `/etc/oxidns/config.yaml`
- Working directory: `/var/lib/oxidns`
- Init script: `/etc/init.d/oxidns`

## Upgrade And Remove

To upgrade the OxiDNS core, use the upgrade feature built into OxiDNS itself, such as the core WebUI / API / CLI upgrade flow. LuCI does not provide a core-upgrade entry point.

To upgrade the LuCI app, download and install the newer `luci-app-oxidns` package. The LuCI UI does not provide self-upgrade.

To remove the OxiDNS core, click `Remove Core` on the LuCI `Core` page. This stops and disables the service, removes `/usr/bin/oxidns` and `/usr/share/oxidns/webui`, and preserves `/etc/oxidns/config.yaml` and `/var/lib/oxidns`.

## Private Repositories And Downloads

The router must be able to reach GitHub Releases and release archives directly. For private repositories or restricted networks, configure a GitHub token or download proxy in `Settings`. Token and proxy values are never shown again after saving; use the matching clear option to remove them. A configured download proxy requires `curl`; otherwise LuCI returns a clear error. You can also use `Upload Core` on the `Core` page to install an archive or binary offline.

## Known Limitations

- Only published OxiDNS Linux musl release targets are supported.
- The `Core` page handles first install, upload install, and repair reinstall only, not version upgrades.
- The `Overview` WebUI entry is generated from the HTTP listen address in the config file. If it listens on `127.0.0.1`, LuCI keeps the link and shows a hint that local access or an SSH tunnel is required.
- The log page reads OxiDNS service stdout/stderr output from OpenWrt `logread`.
