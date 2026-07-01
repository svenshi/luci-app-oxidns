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

tar_nested_has_member() {
	outer="$1"
	inner="$2"
	member="$3"
	tar -xOf "$outer" "$inner" 2>/dev/null | tar -tzf - | awk -v member="$member" '
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

root/usr/libexec/rpcd/luci.oxidns list | json_ok "'status' in v && 'core_install' in v && 'core_reinstall' in v && 'core_upload_install' in v && 'core_remove' in v && 'logs_recent' in v && 'settings_read' in v && !('config_basic_read' in v) && !('config_basic_save' in v)"
root/usr/libexec/rpcd/luci.oxidns call status | json_ok "v.ok === true && v.core && v.core.installed === false && v.webui && v.webui.installed === false && typeof v.webui.url === 'string' && typeof v.webui.local_only === 'boolean' && typeof v.webui.wildcard === 'boolean' && !('api' in v) && !('api_base_url' in v) && !('package' in v) && !('package_manager' in v)"
root/usr/libexec/rpcd/luci.oxidns call core_reinstall | json_ok "v.ok === false && v.code === 'core_not_installed'"
printf '%s' '{"path":"/etc/passwd"}' | root/usr/libexec/rpcd/luci.oxidns call core_upload_install | json_ok "v.ok === false && v.code === 'invalid_upload_path'"
root/usr/libexec/rpcd/luci.oxidns call config_read | json_ok "v.ok === false && v.code === 'config_not_found'"
root/usr/libexec/rpcd/luci.oxidns call settings_read | json_ok "v.ok === true && v.core_repository === 'svenshi/oxidns' && v.core_bundle === 'full' && v.github_token_set === false && !('api_base_url' in v)"
printf '%s' '{"limit":"20"}' | root/usr/libexec/rpcd/luci.oxidns call logs_recent | json_ok "v.ok === true && v.source === 'logread' && Array.isArray(v.lines) && !('entries' in v)"

DIST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/luci-app-oxidns-dist.XXXXXX")"
scripts/build-luci-package.sh 0.1.0 "$DIST_DIR" >/dev/null
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.ipk" debian-binary
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.ipk" control.tar.gz
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.ipk" data.tar.gz
tar_nested_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.ipk" control.tar.gz postinst
tar_nested_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.ipk" control.tar.gz postrm
tar_nested_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.ipk" data.tar.gz etc/init.d/oxidns
tar_has_member "$DIST_DIR/luci-i18n-oxidns-zh-cn_0.1.0-r1_all.ipk" data.tar.gz
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.apk" usr/libexec/rpcd/luci.oxidns
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.apk" etc/init.d/oxidns
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.apk" .post-install
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.apk" .post-upgrade
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.apk" .post-deinstall
tar_has_member "$DIST_DIR/luci-i18n-oxidns-zh-cn_0.1.0-r1_all.apk" usr/lib/lua/luci/i18n/oxidns.zh-cn.lmo

rm -rf "$DIST_DIR"
