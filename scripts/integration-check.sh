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

root/usr/libexec/rpcd/luci.oxidns list | json_ok "'status' in v && 'core_install' in v && 'core_reinstall' in v && 'core_upload_install' in v && 'core_progress' in v && 'core_remove' in v && 'logs_recent' in v && 'settings_read' in v && !('config_basic_read' in v) && !('config_basic_save' in v)"
root/usr/libexec/rpcd/luci.oxidns call status | json_ok "v.ok === true && v.core && v.core.installed === false && v.webui && v.webui.installed === false && typeof v.webui.url === 'string' && typeof v.webui.local_only === 'boolean' && typeof v.webui.wildcard === 'boolean' && !('api' in v) && !('api_base_url' in v) && !('package' in v) && !('package_manager' in v)"
TARGET_FAKE_BIN="$(mktemp -d "${TMPDIR:-/tmp}/oxidns-target-fake-bin.XXXXXX")"
TARGET_CASES="$(mktemp "${TMPDIR:-/tmp}/oxidns-target-cases.XXXXXX")"
cat > "$TARGET_FAKE_BIN/uname" <<'EOF'
#!/bin/sh
if [ "${1:-}" = "-m" ]; then
	printf '%s\n' "${FAKE_UNAME_M:?}"
	exit 0
fi
exec /usr/bin/uname "$@"
EOF
chmod 755 "$TARGET_FAKE_BIN/uname"
node -e "const data=JSON.parse(require('fs').readFileSync('root/usr/share/oxidns/targets.json','utf8')); for (const target of data.targets) for (const arch of target.uname_arches) console.log(arch + ' ' + target.rust_target);" > "$TARGET_CASES"
while read -r TARGET_ARCH TARGET_RUST; do
	PATH="$TARGET_FAKE_BIN:$PATH" FAKE_UNAME_M="$TARGET_ARCH" OXIDNS_TARGETS_FILE="$PWD/root/usr/share/oxidns/targets.json" \
		root/usr/libexec/rpcd/luci.oxidns call status |
		json_ok "v.ok === true && v.core && v.core.target === '$TARGET_RUST'"
done < "$TARGET_CASES"
rm -rf "$TARGET_FAKE_BIN"
rm -f "$TARGET_CASES"
root/usr/libexec/rpcd/luci.oxidns call core_progress | json_ok "v.ok === true && typeof v.text === 'string'"
root/usr/libexec/rpcd/luci.oxidns call core_reinstall | json_ok "v.ok === false && v.code === 'core_not_installed'"
printf '%s' '{"path":"/etc/passwd"}' | root/usr/libexec/rpcd/luci.oxidns call core_upload_install | json_ok "v.ok === false && v.code === 'invalid_upload_path'"
LOCK_TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/oxidns-lock-test.XXXXXX")"
mkdir -p "$LOCK_TEST_DIR/luci-oxidns/core-operation.lock"
printf '%s\n' "$$" > "$LOCK_TEST_DIR/luci-oxidns/core-operation.lock/pid"
TMPDIR="$LOCK_TEST_DIR" root/usr/libexec/rpcd/luci.oxidns call core_reinstall | json_ok "v.ok === false && v.code === 'core_operation_busy'"
rm -rf "$LOCK_TEST_DIR"
node -e "const acl=JSON.parse(require('fs').readFileSync('root/usr/share/rpcd/acl.d/luci-app-oxidns.json','utf8'))['luci-app-oxidns']; const read=acl.read.ubus['luci.oxidns']; const write=acl.write.ubus['luci.oxidns']; if (read.includes('config_validate') || !write.includes('config_validate')) process.exit(1);"
JSON_ESCAPED="$(printf '%s\n' 'listen: "127.0.0.1:9199"' | awk 'BEGIN { ORS = "" } { if (NR > 1) printf "\\n"; for (i = 1; i <= length($0); i++) { c = substr($0, i, 1); if (c == "\\") printf "\\\\"; else if (c == "\"") printf "\\\""; else if (c == "\t") printf "\\t"; else if (c == "\r") printf "\\r"; else printf "%s", c; } }')"
test "$JSON_ESCAPED" = 'listen: \"127.0.0.1:9199\"'
PROGRESS_TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/oxidns-progress-test.XXXXXX")"
printf 'original' > "$PROGRESS_TEST_DIR/target"
mkdir "$PROGRESS_TEST_DIR/luci-oxidns"
ln -s "$PROGRESS_TEST_DIR/target" "$PROGRESS_TEST_DIR/luci-oxidns/core-progress.log"
TMPDIR="$PROGRESS_TEST_DIR" root/usr/libexec/rpcd/luci.oxidns call core_reinstall >/dev/null 2>&1 || true
test "$(cat "$PROGRESS_TEST_DIR/target")" = "original"
rm -rf "$PROGRESS_TEST_DIR"
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
root/usr/libexec/rpcd/luci.oxidns call settings_read | json_ok "v.ok === true && v.core_repository === 'svenshi/oxidns' && v.core_bundle === 'full' && v.download_proxy === '' && v.github_token === '' && v.download_proxy_set === false && v.github_token_set === false && !('api_base_url' in v)"
FAKE_UCI_DIR="$(mktemp -d "${TMPDIR:-/tmp}/oxidns-fake-uci.XXXXXX")"
FAKE_UCI_STATE="$FAKE_UCI_DIR/state"
cat > "$FAKE_UCI_DIR/uci" <<'EOF'
#!/bin/sh
set -eu
[ "${1:-}" = "-q" ] && shift
CMD="${1:-}"
shift || true
STATE="${FAKE_UCI_STATE:?}"
case "$CMD" in
	get)
		KEY="${1:-}"
		[ -f "$STATE" ] || exit 1
		grep -F "$KEY=" "$STATE" | tail -n 1 | sed 's/^[^=]*=//' || exit 1
		;;
	set)
		ASSIGNMENT="${1:-}"
		KEY="${ASSIGNMENT%%=*}"
		VALUE="${ASSIGNMENT#*=}"
		TMP_STATE="$STATE.tmp"
		if [ -f "$STATE" ]; then
			grep -F -v "$KEY=" "$STATE" > "$TMP_STATE" || true
		else
			: > "$TMP_STATE"
		fi
		printf '%s=%s\n' "$KEY" "$VALUE" >> "$TMP_STATE"
		mv "$TMP_STATE" "$STATE"
		;;
	delete)
		KEY="${1:-}"
		TMP_STATE="$STATE.tmp"
		if [ -f "$STATE" ]; then
			grep -F -v "$KEY=" "$STATE" > "$TMP_STATE" || true
			mv "$TMP_STATE" "$STATE"
		fi
		;;
	commit)
		exit 0
		;;
	*)
		exit 1
		;;
esac
EOF
	chmod 755 "$FAKE_UCI_DIR/uci"
	printf '%s' '{"core_repository":"svenshi/oxidns","core_bundle":"full","config_path":"etc/oxidns/config.yaml","working_dir":"/var/lib/oxidns","download_proxy":"","github_token":""}' |
		PATH="$FAKE_UCI_DIR:$PATH" FAKE_UCI_STATE="$FAKE_UCI_STATE" root/usr/libexec/rpcd/luci.oxidns call settings_save |
		json_ok "v.ok === false && v.code === 'invalid_config_path'"
	printf '%s' '{"core_repository":"svenshi/oxidns","core_bundle":"full","config_path":"/etc/oxidns/config.yaml","working_dir":"/var","download_proxy":"","github_token":""}' |
		PATH="$FAKE_UCI_DIR:$PATH" FAKE_UCI_STATE="$FAKE_UCI_STATE" root/usr/libexec/rpcd/luci.oxidns call settings_save |
		json_ok "v.ok === false && v.code === 'invalid_working_dir'"
	printf '%s' '{"core_repository":"svenshi/oxidns","core_bundle":"full","config_path":"/etc/oxidns/config.yaml","working_dir":"/var/lib/oxidns","download_proxy":"","github_token":""}' |
		PATH="$FAKE_UCI_DIR:$PATH" FAKE_UCI_STATE="$FAKE_UCI_STATE" root/usr/libexec/rpcd/luci.oxidns call settings_save |
		json_ok "v.ok === true && v.core_repository === 'svenshi/oxidns' && v.config_path === '/etc/oxidns/config.yaml' && v.working_dir === '/var/lib/oxidns' && v.download_proxy === '' && v.download_proxy_set === false"
	printf '%s' '{"core_repository":"svenshi/oxidns","core_bundle":"full","config_path":"/etc/oxidns/config.yaml","working_dir":"/var/lib/oxidns","download_proxy":"http://user:pass@example.invalid:8080","github_token":"github-secret-token"}' |
		PATH="$FAKE_UCI_DIR:$PATH" FAKE_UCI_STATE="$FAKE_UCI_STATE" root/usr/libexec/rpcd/luci.oxidns call settings_save |
		json_ok "v.ok === true && v.download_proxy === 'http://user:pass@example.invalid:8080' && v.github_token === '' && v.download_proxy_set === true && v.github_token_set === true && JSON.stringify(v).indexOf('github-secret-token') === -1"
	printf '%s' '{"core_repository":"svenshi/oxidns","core_bundle":"full","config_path":"/etc/oxidns/config.yaml","working_dir":"/var/lib/oxidns","download_proxy":"","github_token":""}' |
		PATH="$FAKE_UCI_DIR:$PATH" FAKE_UCI_STATE="$FAKE_UCI_STATE" root/usr/libexec/rpcd/luci.oxidns call settings_save |
		json_ok "v.ok === true && v.download_proxy_set === true && v.github_token === '' && v.github_token_set === true"
	printf '%s' '{"core_repository":"svenshi/oxidns","core_bundle":"full","config_path":"/etc/oxidns/config.yaml","working_dir":"/var/lib/oxidns","download_proxy":"","github_token":"","clear_download_proxy":"true","clear_github_token":"true"}' |
		PATH="$FAKE_UCI_DIR:$PATH" FAKE_UCI_STATE="$FAKE_UCI_STATE" root/usr/libexec/rpcd/luci.oxidns call settings_save |
		json_ok "v.ok === true && v.download_proxy === '' && v.download_proxy_set === false && v.github_token_set === false"
	cat > "$FAKE_UCI_STATE" <<'EOF'
oxidns.main.core_repository=svenshi/oxidns
oxidns.main.core_bundle=full
oxidns.main.config_path=/etc/oxidns/config.yaml
oxidns.main.working_dir=/var
oxidns.main.download_proxy=
oxidns.main.github_token=
EOF
	REMOVE_PREFLIGHT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/oxidns-remove-preflight.XXXXXX")"
	printf '%s' '{"remove_workdir":"true"}' |
		PATH="$FAKE_UCI_DIR:$PATH" FAKE_UCI_STATE="$FAKE_UCI_STATE" TMPDIR="$REMOVE_PREFLIGHT_DIR" root/usr/libexec/rpcd/luci.oxidns call core_remove |
		json_ok "v.ok === false && v.code === 'unsafe_working_dir'"
	test -f "$REMOVE_PREFLIGHT_DIR/luci-oxidns/core-progress.log"
	! grep -q 'rm -f /usr/bin/oxidns' "$REMOVE_PREFLIGHT_DIR/luci-oxidns/core-progress.log"
	! grep -q 'rm -rf /usr/share/oxidns/webui' "$REMOVE_PREFLIGHT_DIR/luci-oxidns/core-progress.log"
	rm -rf "$REMOVE_PREFLIGHT_DIR"
	rm -rf "$FAKE_UCI_DIR"
printf '%s' '{"limit":"20"}' | root/usr/libexec/rpcd/luci.oxidns call logs_recent | json_ok "v.ok === true && v.source === 'logread' && Array.isArray(v.lines) && !('entries' in v)"

DIST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/luci-app-oxidns-dist.XXXXXX")"
scripts/build-luci-package.sh 0.1.0 "$DIST_DIR" >/dev/null
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.ipk" control.tar.gz
tar_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.ipk" data.tar.gz
tar_nested_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.ipk" control.tar.gz postinst
tar_nested_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.ipk" control.tar.gz postrm
tar_nested_has_member "$DIST_DIR/luci-app-oxidns_0.1.0-r1_all.ipk" data.tar.gz etc/init.d/oxidns
tar_has_member "$DIST_DIR/luci-i18n-oxidns-zh-cn_0.1.0-r1_all.ipk" control.tar.gz
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
