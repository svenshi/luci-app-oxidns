# AGENTS.md

## Repository Background

`luci-app-oxidns` is the OpenWrt LuCI management application for OxiDNS. It provides the web UI and rpcd backend used to manage an `oxidns` runtime that is installed through the OpenWrt package manager.

This repository does not contain the OxiDNS Rust core source code, and it does not contain the OpenWrt `oxidns` core package build implementation. The default runtime model is package-managed installation through `opkg` or `apk`, using the full OxiDNS bundle. Bare binary management is only an advanced fallback path, not the default LuCI workflow.

## Main Responsibilities

- LuCI pages: overview, core package management, configuration, logs, and settings.
- rpcd backend: status, service control, boot enablement, package actions, config read/write/validate, log access, and LuCI integration settings.
- Manifest contract: schema, example, and target mapping files used to align this app with the independent OpenWrt package repository.
- LuCI package builds: local scripts can produce `luci-app-oxidns` `ipk` and `apk` artifacts.
- Internationalization: Simplified Chinese translations are shipped as `luci-i18n-oxidns-zh-cn`.

## Related Repositories

- `../oxidns`: OxiDNS Rust core repository. Owns the core program, generic releases, generic binaries, Docker images, and non-OpenWrt artifacts.
- `../oxidns-openwrt-packages`: independent OpenWrt package feed repository. Owns OpenWrt `oxidns` `ipk` / `apk` builds, manifest generation, checksums, and package feed publishing.
- `../luci-app-oxidns`: this repository. Owns only the LuCI management app and LuCI package release.

## Boundaries

- `root/usr/share/oxidns/openwrt-manifest.schema.json`, example files, and target mapping files are interface contracts and may be maintained here.
- Frontend pages must call system operations through the rpcd backend. Do not perform shell/system actions directly in LuCI JavaScript.
- The basic configuration form only edits safe top-level fields. It must not support plugin form editing or mutate the `plugins` structure.
- GitHub tokens and other secrets must not be echoed to UI, logs, or RPC error messages.
- Development must consider both OpenWrt package manager environments: `opkg` / `ipk` on older releases and `apk` / `apk` packages on newer releases. Package build, install, upgrade, removal, validation, and LuCI Software upload behavior should remain compatible with both unless a change explicitly scopes one environment out.

## Key Paths

- `htdocs/luci-static/resources/view/oxidns/`: LuCI JavaScript pages.
- `root/usr/libexec/rpcd/luci.oxidns`: rpcd shell backend.
- `root/usr/share/luci/menu.d/luci-app-oxidns.json`: LuCI menu entries.
- `root/usr/share/rpcd/acl.d/luci-app-oxidns.json`: rpcd ACL.
- `root/usr/share/oxidns/`: OpenWrt package manifest contract files.
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
