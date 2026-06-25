# oxidns-openwrt-packages

Template repository for publishing OxiDNS OpenWrt packages.

This repository is intended to be triggered by `svenshi/oxidns` releases. It
builds package-managed OxiDNS artifacts for OpenWrt and publishes a package
manifest consumed by `luci-app-oxidns`.

## Release Flow

```text
oxidns tag vX.Y.Z
  -> repository_dispatch to oxidns-openwrt-packages
  -> checkout oxidns at the release ref
  -> build/package full OxiDNS
  -> publish ipk/apk artifacts
  -> generate manifest.json, latest.json, and sha256sums.txt
```

## Contract

The generated `manifest.json` must follow schema version 1 from
`luci-app-oxidns`.
