#!/bin/sh

set -eu

json_ok() {
	node -e "const v=JSON.parse(require('fs').readFileSync(0,'utf8')); if (!($1)) process.exit(1);"
}

tar_has_member() {
	tar -tzf "$1" | awk -v member="$2" '
		{
			path = $0;
			sub(/^\.\//, "", path);
			if (path == member)
				found = 1;
		}
		END { exit found ? 0 : 1 }
	'
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
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.ipk" debian-binary
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.ipk" control.tar.gz
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.ipk" data.tar.gz
tar_has_member "$DIST_DIR/luci-i18n-oxidns-zh-cn_0.1.0-r1_all.ipk" data.tar.gz
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.apk" usr/libexec/rpcd/luci.oxidns
tar_has_member "$DIST_DIR/luci-i18n-oxidns-zh-cn_0.1.0-r1_all.apk" usr/lib/lua/luci/i18n/oxidns.zh-cn.lmo

node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync('root/usr/share/oxidns/openwrt-manifest.example.json','utf8')); const formats=new Set(m.oxidns.packages.map(p=>p.format)); if (m.schema_version !== 1 || !formats.has('ipk') || !formats.has('apk')) process.exit(1);"

rm -rf "$DIST_DIR"
