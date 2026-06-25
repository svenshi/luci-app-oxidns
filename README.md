# luci-app-oxidns

LuCI management application for OxiDNS on OpenWrt.

This project provides the OpenWrt-native control plane for OxiDNS:

- package-managed OxiDNS installation and upgrades;
- procd service management;
- YAML configuration viewing, validation, and saving;
- runtime log viewing;
- top-level basic configuration controls.

The LuCI app does not embed the OxiDNS binary. The OxiDNS runtime is expected to
be installed through the OpenWrt package manager as the `oxidns` package.

## Runtime Model

`luci-app-oxidns` is intentionally separate from the OxiDNS core package:

- `svenshi/oxidns` publishes the core source release and generic artifacts.
- `svenshi/oxidns-openwrt-packages` builds OpenWrt `oxidns` packages and the
  package manifest consumed by this LuCI app.
- `svenshi/luci-app-oxidns` publishes the LuCI management package.

The default runtime installation is the `oxidns` full bundle from the OpenWrt
package feed. Bare binary management is only an advanced fallback and is not the
default LuCI path.

## Features

- Overview page with package, binary, service, API, config, and log status.
- Service actions: start, stop, restart, enable, and disable.
- Core package actions: check update, install, upgrade, and remove through
  `opkg` or `apk`.
- Configuration editor with read, validate, save, backup, reload, upload,
  download, and default-template actions.
- Basic configuration form for safe top-level fields only.
- Runtime log viewer with refresh, pause/resume, filtering, search, copy, and
  clear-front-end-display actions.
- LuCI settings for manifest/feed URLs, proxy URL, API endpoint, config path,
  work directory, and optional GitHub token.

## Install

Install the LuCI package from a release artifact:

```sh
opkg install luci-app-oxidns_0.1.0-r1_all.ipk
```

or on OpenWrt systems using `apk`:

```sh
apk add --allow-untrusted luci-app-oxidns_0.1.0-r1_all.apk
```

Restart `rpcd` after installation if the OxiDNS menu is not visible:

```sh
/etc/init.d/rpcd restart
```

Then open LuCI and go to `Services -> OxiDNS`.

## Package Feed

The OxiDNS core should be installed from the self-maintained OpenWrt package
feed. Replace the URL below with the feed published by
`svenshi/oxidns-openwrt-packages`.

For `opkg`:

```sh
echo 'src/gz oxidns https://example.com/oxidns/openwrt/packages' >> /etc/opkg/customfeeds.conf
opkg update
opkg install oxidns
```

For `apk`:

```sh
echo 'https://example.com/oxidns/openwrt/packages' >> /etc/apk/repositories
apk update
apk add oxidns
```

The LuCI core package page can also install or upgrade `oxidns` when the package
manifest URL is configured in `Services -> OxiDNS -> Settings`.

## Upgrade And Remove

Upgrade the LuCI package by installing a newer `luci-app-oxidns` artifact or by
upgrading it from the configured package feed.

Upgrade the OxiDNS core from LuCI or with the system package manager:

```sh
opkg update
opkg upgrade oxidns
```

or:

```sh
apk update
apk upgrade oxidns
```

Removing `oxidns` should preserve `/etc/oxidns/config.yaml` and
`/var/lib/oxidns` by default. The LuCI package can remain installed and will
show the core as not installed.

## Build

Build from an OpenWrt buildroot or SDK with the LuCI feed available:

```sh
make package/luci-app-oxidns/compile V=s
```

When developing as an external package, place or symlink this repository under
the OpenWrt package tree and ensure `$(TOPDIR)/feeds/luci/luci.mk` exists.

Local package artifacts can be produced without an SDK for CI smoke testing:

```sh
scripts/build-luci-package.sh 0.1.0 dist
```

Run the local validation suite:

```sh
scripts/check.sh
scripts/integration-check.sh
scripts/release-check.sh 0.1.0 dist
```

## Default Runtime Paths

- Binary: `/usr/bin/oxidns`
- Config: `/etc/oxidns/config.yaml`
- Working directory: `/var/lib/oxidns`
- Init script: `/etc/init.d/oxidns`

## Release Flow

The recommended release flow keeps OpenWrt package artifacts out of the OxiDNS
core release:

1. Tag `svenshi/oxidns` with the core version.
2. Trigger `svenshi/oxidns-openwrt-packages` through `repository_dispatch` or
   `workflow_dispatch`.
3. Build package-managed OxiDNS full-bundle `ipk` and `apk` artifacts in the
   OpenWrt package repository.
4. Publish `manifest.json`, `latest.json`, and `sha256sums.txt` from the package
   repository or feed.
5. Tag `svenshi/luci-app-oxidns` to publish the LuCI package.
6. Update the package feed and verify install, service start, config save, and
   log viewing on target OpenWrt images.

The release workflow in this repository runs static checks, integration checks,
builds `ipk` and `apk` LuCI artifacts, and publishes them to the GitHub release.

## Supported Core Package Matrix

The first OpenWrt core package matrix targets:

- `x86_64-unknown-linux-musl`
- `aarch64-unknown-linux-musl`
- `i686-unknown-linux-musl`
- `arm-unknown-linux-musleabihf`

Package selection is based on the OpenWrt package manager, package architecture,
and the manifest generated by `oxidns-openwrt-packages`.

## Known Limitations

- The basic configuration form only edits top-level safe fields. It does not
  edit `plugins` entries or plugin arguments.
- OxiDNS API log reading is preferred, but the log page falls back to `logread`
  when the API is unavailable.
- Local CI package checks do not replace final verification on real OpenWrt
  `opkg` and `apk` targets.
- Bare binary mode is an advanced fallback and is not the default install,
  upgrade, or remove path.
