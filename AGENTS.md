# AGENTS.md

## Repository Background

`luci-app-oxidns` is the OpenWrt LuCI management application for OxiDNS. It provides the web UI and rpcd backend used to install and manage an `oxidns` runtime on OpenWrt.

This repository does not contain the OxiDNS Rust core source code, and it does not contain the OpenWrt `oxidns` core package build implementation. The current LuCI workflow installs the OxiDNS core from official GitHub release archives or from an uploaded archive/binary, verifies release digests where available, and manages the installed binary plus WebUI files directly. OpenWrt package-managed core installation through `opkg` or `apk` is not the default workflow in this repository.

## Main Responsibilities

- LuCI pages: overview, core binary management, configuration, logs, and settings.
- rpcd backend: status, service control, boot enablement, core install/reinstall/upload/remove actions, config read/write/validate, log access, and LuCI integration settings.
- Target mapping contract files used to align supported OpenWrt architectures with OxiDNS release targets.
- LuCI package builds: local scripts can produce `luci-app-oxidns` `ipk` and `apk` artifacts.
- Internationalization: Simplified Chinese translations are shipped as `luci-i18n-oxidns-zh-cn`.

## Repository Relationships

- `../oxidns`: OxiDNS Rust core repository. Owns the core program, generic releases, generic binaries, Docker images, and non-OpenWrt artifacts.
- `../luci-app-oxidns`: this repository. Owns the LuCI management app, rpcd backend, LuCI package release, and OpenWrt-facing runtime integration.

## Boundaries

- `root/usr/share/oxidns/targets.json` is an interface contract for mapping OpenWrt device architectures to OxiDNS release targets.
- Frontend pages must call system operations through the rpcd backend. Do not perform shell/system actions directly in LuCI JavaScript.
- The configuration page is a full YAML editor. It may edit any part of the OxiDNS config, including plugin configuration, but must validate through the rpcd backend before saving.
- GitHub tokens and other secrets must not be echoed to UI, logs, or RPC error messages.
- Development must consider both OpenWrt LuCI package environments: `opkg` / `ipk` on older releases and `apk` / `apk` packages on newer releases. LuCI app package build, install, upgrade, removal, validation, and LuCI Software upload behavior should remain compatible with both unless a change explicitly scopes one environment out.

## Key Paths

- `htdocs/luci-static/resources/view/oxidns/`: LuCI JavaScript pages.
- `root/usr/libexec/rpcd/luci.oxidns`: rpcd shell backend.
- `root/usr/share/luci/menu.d/luci-app-oxidns.json`: LuCI menu entries.
- `root/usr/share/rpcd/acl.d/luci-app-oxidns.json`: rpcd ACL.
- `root/usr/share/oxidns/`: OxiDNS LuCI contract files such as target mappings.
- `po/zh_Hans/oxidns.po`: Simplified Chinese translation.
- `scripts/build-luci-package.sh`: local LuCI package build script.
- `scripts/check.sh`, `scripts/integration-check.sh`, `scripts/release-check.sh`: local validation entry points.

## Common Validation

```sh
scripts/check.sh
scripts/integration-check.sh
scripts/release-check.sh 0.1.0 /tmp/luci-app-oxidns-release-check
```

## Commit Notes

- Follow the existing Conventional Commit style for LuCI app changes.
- Changes to package management, config writes, service control, or log access should be checked against rpcd ACLs, frontend callers, and local validation scripts.
