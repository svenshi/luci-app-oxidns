#!/bin/sh

set -eu

VERSION="${1:-${VERSION:-0.1.0}}"
OUT_DIR="${2:-${OUT_DIR:-dist}}"
PKG_VERSION="$(printf '%s' "$VERSION" | sed 's/^v//')"
PKG_BASE="luci-app-oxidns_${PKG_VERSION}-r1_all"
I18N_BASE="luci-i18n-oxidns-zh-cn_${PKG_VERSION}-r1_all"

need_cmd() {
	command -v "$1" >/dev/null 2>&1 || {
		printf 'required command not found: %s\n' "$1" >&2
		exit 1
	}
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

need_cmd awk
need_cmd gzip
need_cmd grep
need_cmd sha256sum
need_cmd tar

scripts/check.sh
scripts/integration-check.sh
scripts/build-luci-package.sh "$VERSION" "$OUT_DIR"

tar_has_member "$OUT_DIR/${PKG_BASE}.ipk" control.tar.gz
tar_has_member "$OUT_DIR/${PKG_BASE}.ipk" data.tar.gz
tar_nested_has_member "$OUT_DIR/${PKG_BASE}.ipk" control.tar.gz postinst
tar_nested_has_member "$OUT_DIR/${PKG_BASE}.ipk" control.tar.gz postrm
tar_nested_has_member "$OUT_DIR/${PKG_BASE}.ipk" data.tar.gz etc/init.d/oxidns
tar_has_member "$OUT_DIR/${I18N_BASE}.ipk" control.tar.gz
tar_has_member "$OUT_DIR/${I18N_BASE}.ipk" data.tar.gz
tar_nested_has_member "$OUT_DIR/${I18N_BASE}.ipk" control.tar.gz postinst
tar_has_member "$OUT_DIR/${PKG_BASE}.apk" .PKGINFO
tar_member_contains "$OUT_DIR/${PKG_BASE}.apk" .PKGINFO '^arch = noarch$'
tar_member_contains "$OUT_DIR/${PKG_BASE}.apk" .PKGINFO '^datahash = [0-9a-f][0-9a-f]*$'
apk_data_has_checksum "$OUT_DIR/${PKG_BASE}.apk"
tar_has_member "$OUT_DIR/${PKG_BASE}.apk" etc
tar_has_member "$OUT_DIR/${PKG_BASE}.apk" etc/config
tar_has_member "$OUT_DIR/${PKG_BASE}.apk" usr/share/luci/menu.d
tar_has_member "$OUT_DIR/${PKG_BASE}.apk" www/luci-static/resources/view/oxidns
tar_has_member "$OUT_DIR/${PKG_BASE}.apk" usr/libexec/rpcd/luci.oxidns
tar_has_member "$OUT_DIR/${PKG_BASE}.apk" etc/init.d/oxidns
tar_has_member "$OUT_DIR/${PKG_BASE}.apk" .post-install
tar_has_member "$OUT_DIR/${PKG_BASE}.apk" .post-upgrade
tar_has_member "$OUT_DIR/${PKG_BASE}.apk" .post-deinstall
tar_has_member "$OUT_DIR/${I18N_BASE}.apk" .PKGINFO
tar_member_contains "$OUT_DIR/${I18N_BASE}.apk" .PKGINFO '^arch = noarch$'
tar_member_contains "$OUT_DIR/${I18N_BASE}.apk" .PKGINFO '^datahash = [0-9a-f][0-9a-f]*$'
apk_data_has_checksum "$OUT_DIR/${I18N_BASE}.apk"
tar_has_member "$OUT_DIR/${I18N_BASE}.apk" usr/lib/lua/luci/i18n
tar_has_member "$OUT_DIR/${I18N_BASE}.apk" usr/lib/lua/luci/i18n/oxidns.zh-cn.lmo
tar_has_member "$OUT_DIR/${I18N_BASE}.apk" .post-install
tar_has_member "$OUT_DIR/${I18N_BASE}.apk" .post-upgrade
(cd "$OUT_DIR" && sha256sum -c sha256sums.txt)

printf 'Release check passed for %s in %s\n' "$VERSION" "$OUT_DIR"
