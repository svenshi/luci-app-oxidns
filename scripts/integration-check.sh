#!/bin/sh

set -eu

json_ok() {
	node -e "const v=JSON.parse(require('fs').readFileSync(0,'utf8')); if (!($1)) process.exit(1);"
}

scripts/check.sh

root/usr/libexec/rpcd/luci.oxidns list | json_ok "'status' in v && 'logs_recent' in v && 'settings_read' in v"
root/usr/libexec/rpcd/luci.oxidns call status | json_ok "v.ok === true && v.install_mode === 'package'"
root/usr/libexec/rpcd/luci.oxidns call package_manager | json_ok "v.ok === true && 'manager' in v"
root/usr/libexec/rpcd/luci.oxidns call package_check_update | json_ok "v.ok === false && v.code === 'package_manager_unavailable'"
root/usr/libexec/rpcd/luci.oxidns call config_read | json_ok "v.ok === false && v.code === 'config_not_found'"
root/usr/libexec/rpcd/luci.oxidns call config_basic_read | json_ok "v.ok === false && v.code === 'config_not_found'"
root/usr/libexec/rpcd/luci.oxidns call settings_read | json_ok "v.ok === true && v.github_token_set === false"
printf '%s' '{"limit":"20"}' | root/usr/libexec/rpcd/luci.oxidns call logs_recent | json_ok "v.ok === true && Array.isArray(v.lines)"

DIST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/luci-app-oxidns-dist.XXXXXX")"
scripts/build-luci-package.sh 0.1.0 "$DIST_DIR" >/dev/null
ar t "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.ipk" | grep -q '^debian-binary/$'
ar t "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.ipk" | grep -q '^control.tar.gz/$'
ar t "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.ipk" | grep -q '^data.tar.gz/$'
tar -tzf "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.apk" | grep -q './usr/libexec/rpcd/luci.oxidns'

MANIFEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/oxidns-manifest.XXXXXX")"
mkdir -p "$MANIFEST_DIR/ipk/x86_64" "$MANIFEST_DIR/apk/x86_64"
printf ipk > "$MANIFEST_DIR/ipk/x86_64/oxidns_1.4.0_x86_64.ipk"
printf apk > "$MANIFEST_DIR/apk/x86_64/oxidns-1.4.0-r1.apk"
node templates/oxidns-openwrt-packages/scripts/generate-manifest.mjs \
	--dist "$MANIFEST_DIR" \
	--version v1.4.0 \
	--commit 0000000000000000000000000000000000000000 \
	--feed-url https://example.invalid/feed
node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync(process.argv[1]+'/manifest.json','utf8')); if (m.oxidns.packages.length !== 2) process.exit(1);" "$MANIFEST_DIR"

rm -rf "$DIST_DIR" "$MANIFEST_DIR"
