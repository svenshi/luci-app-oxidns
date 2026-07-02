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
			sub(/\/$/, "", path);
			if (path == member)
				found = 1;
		}
		END { exit found ? 0 : 1 }
	'
}

tar_member_contains() {
	tar -xOzf "$1" "$2" 2>/dev/null | grep -q "$3"
}

apk_data_has_checksum() {
	gzip -dc "$1" | grep -q 'APK-TOOLS.checksum.SHA1='
}

tar_nested_has_member() {
	outer="$1"
	inner="$2"
	member="$3"
	nested="$(mktemp "${TMPDIR:-/tmp}/luci-app-oxidns-nested.XXXXXX")"
	if ! tar -xOf "$outer" "$inner" > "$nested" 2>/dev/null &&
		! tar -xOf "$outer" "./$inner" > "$nested" 2>/dev/null; then
		rm -f "$nested"
		return 1
	fi

	if tar -tzf "$nested" | awk -v member="$member" '
		{
			path = $0;
			sub(/^\.\//, "", path);
			if (path == member)
				found = 1;
		}
		END { exit found ? 0 : 1 }
	'; then
		rm -f "$nested"
		return 0
	fi

	rm -f "$nested"
	return 1
}

assert_unsafe_upload_rejected() {
	upload="$1"
	printf '{"path":"%s"}' "$upload" |
		root/usr/libexec/rpcd/luci.oxidns call core_upload_install |
		json_ok "v.ok === false && v.code === 'uploaded_archive_unsafe'"
}

scripts/check.sh

root/usr/libexec/rpcd/luci.oxidns list | json_ok "'status' in v && 'core_install' in v && 'core_reinstall' in v && 'core_upload_install' in v && 'core_remove' in v && 'logs_recent' in v && 'settings_read' in v && !('config_basic_read' in v) && !('config_basic_save' in v)"
root/usr/libexec/rpcd/luci.oxidns call status | json_ok "v.ok === true && v.core && v.core.installed === false && v.webui && v.webui.installed === false && typeof v.webui.url === 'string' && typeof v.webui.local_only === 'boolean' && typeof v.webui.wildcard === 'boolean' && !('api' in v) && !('api_base_url' in v) && !('package' in v) && !('package_manager' in v)"
root/usr/libexec/rpcd/luci.oxidns call core_reinstall | json_ok "v.ok === false && v.code === 'core_not_installed'"
printf '%s' '{"path":"/etc/passwd"}' | root/usr/libexec/rpcd/luci.oxidns call core_upload_install | json_ok "v.ok === false && v.code === 'invalid_upload_path'"
UNSAFE_UPLOAD="$(mktemp "/tmp/oxidns-core-upload-unsafe.XXXXXX")"
UNSAFE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/oxidns-core-upload-unsafe-dir.XXXXXX")"
rm -f "$UNSAFE_UPLOAD"
ln -s /etc/passwd "$UNSAFE_DIR/oxidns"
tar -czf "$UNSAFE_UPLOAD" -C "$UNSAFE_DIR" oxidns 2>/dev/null
assert_unsafe_upload_rejected "$UNSAFE_UPLOAD"
rm -f "$UNSAFE_UPLOAD" "$UNSAFE_DIR/oxidns"
mkfifo "$UNSAFE_DIR/oxidns"
tar -czf "$UNSAFE_UPLOAD" -C "$UNSAFE_DIR" oxidns 2>/dev/null
assert_unsafe_upload_rejected "$UNSAFE_UPLOAD"
rm -f "$UNSAFE_UPLOAD"
rm -rf "$UNSAFE_DIR"
printf '%s' '{"content":""}' | root/usr/libexec/rpcd/luci.oxidns call config_validate | json_ok "v.ok === false && v.code === 'missing_content'"
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
tar_nested_has_member "$DIST_DIR/luci-i18n-oxidns-zh-cn_0.1.0-r1_all.ipk" control.tar.gz postinst
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.apk" .PKGINFO
tar_member_contains "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.apk" .PKGINFO '^arch = noarch$'
tar_member_contains "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.apk" .PKGINFO '^datahash = [0-9a-f][0-9a-f]*$'
apk_data_has_checksum "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.apk"
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.apk" etc
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.apk" etc/config
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.apk" usr/share/luci/menu.d
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.apk" www/luci-static/resources/view/oxidns
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.apk" usr/libexec/rpcd/luci.oxidns
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.apk" etc/init.d/oxidns
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.apk" .post-install
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.apk" .post-upgrade
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.apk" .post-deinstall
tar_has_member "$DIST_DIR/luci-i18n-oxidns-zh-cn_0.1.0-r1_all.apk" .PKGINFO
tar_member_contains "$DIST_DIR/luci-i18n-oxidns-zh-cn_0.1.0-r1_all.apk" .PKGINFO '^arch = noarch$'
tar_member_contains "$DIST_DIR/luci-i18n-oxidns-zh-cn_0.1.0-r1_all.apk" .PKGINFO '^datahash = [0-9a-f][0-9a-f]*$'
apk_data_has_checksum "$DIST_DIR/luci-i18n-oxidns-zh-cn_0.1.0-r1_all.apk"
tar_has_member "$DIST_DIR/luci-i18n-oxidns-zh-cn_0.1.0-r1_all.apk" usr/lib/lua/luci/i18n
tar_has_member "$DIST_DIR/luci-i18n-oxidns-zh-cn_0.1.0-r1_all.apk" usr/lib/lua/luci/i18n/oxidns.zh-cn.lmo
tar_has_member "$DIST_DIR/luci-i18n-oxidns-zh-cn_0.1.0-r1_all.apk" .post-install
tar_has_member "$DIST_DIR/luci-i18n-oxidns-zh-cn_0.1.0-r1_all.apk" .post-upgrade

rm -rf "$DIST_DIR"
