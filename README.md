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

## Development Status

This repository is in early development. The current tree contains the LuCI app
skeleton, menu entry, ACL, and a minimal RPC backend used by the first overview
page.

## Build

Build from an OpenWrt buildroot or SDK with the LuCI feed available:

```sh
make package/luci-app-oxidns/compile V=s
```

When developing as an external package, place or symlink this repository under
the OpenWrt package tree and ensure `$(TOPDIR)/feeds/luci/luci.mk` exists.

## Default Runtime Paths

- Binary: `/usr/bin/oxidns`
- Config: `/etc/oxidns/config.yaml`
- Working directory: `/var/lib/oxidns`
- Init script: `/etc/init.d/oxidns`
