#!/bin/sh

set -eu

VERSION="${1:-0.1.0}"
OUT_DIR="${2:-dist}"
PKG_VERSION="$(printf '%s' "$VERSION" | sed 's/^v//')"
PKG_NAME="luci-app-oxidns"
PKG_FILE_BASE="${PKG_NAME}_${PKG_VERSION}-r1_all"
I18N_PKG_NAME="luci-i18n-oxidns-zh-cn"
I18N_FILE_BASE="${I18N_PKG_NAME}_${PKG_VERSION}-r1_all"

need_cmd() {
	command -v "$1" >/dev/null 2>&1 || {
		printf 'required command not found: %s\n' "$1" >&2
		exit 1
	}
}

need_cmd tar
need_cmd gzip
need_cmd node

tar_create_gz() {
	out="$1"
	shift
	tar --format=ustar --owner=0 --group=0 --numeric-owner -czf "$out" "$@"
}

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/luci-app-oxidns-build.XXXXXX")"
cleanup() {
	rm -rf "$TMP_DIR"
}
trap cleanup EXIT HUP INT TERM

create_ipk() {
	out="$1"
	control_tar="$2"
	data_tar="$3"
	ipk_dir="$TMP_DIR/ipk-$(basename "$out" .ipk)"

	rm -rf "$ipk_dir"
	mkdir -p "$ipk_dir"
	cp "$TMP_DIR/debian-binary" "$ipk_dir/debian-binary"
	cp "$control_tar" "$ipk_dir/control.tar.gz"
	cp "$data_tar" "$ipk_dir/data.tar.gz"
	tar_create_gz "$out" -C "$ipk_dir" .
}

write_rpcd_restart_script() {
	out="$1"
	cat > "$out" <<'EOF'
#!/bin/sh
[ -n "${IPKG_INSTROOT:-}" ] && exit 0
rm -f /tmp/luci-indexcache* 2>/dev/null || true
rm -rf /tmp/luci-modulecache/* 2>/dev/null || true
if [ -x /etc/init.d/rpcd ]; then
	/etc/init.d/rpcd restart >/dev/null 2>&1 || true
fi
exit 0
EOF
	chmod 755 "$out"
}

write_i18n_postinst_script() {
	out="$1"
	cat > "$out" <<'EOF'
#!/bin/sh
[ -n "${IPKG_INSTROOT:-}" ] && exit 0
if [ -x /etc/uci-defaults/luci-i18n-oxidns-zh-cn ]; then
	/etc/uci-defaults/luci-i18n-oxidns-zh-cn >/dev/null 2>&1 || true
fi
rm -f /tmp/luci-indexcache* 2>/dev/null || true
rm -rf /tmp/luci-modulecache/* 2>/dev/null || true
if [ -x /etc/init.d/rpcd ]; then
	/etc/init.d/rpcd restart >/dev/null 2>&1 || true
fi
exit 0
EOF
	chmod 755 "$out"
}

CONTROL_DIR="$TMP_DIR/control"
DATA_DIR="$TMP_DIR/data"
I18N_CONTROL_DIR="$TMP_DIR/i18n-control"
I18N_DATA_DIR="$TMP_DIR/i18n-data"
mkdir -p "$CONTROL_DIR" "$DATA_DIR" "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"

cat > "$CONTROL_DIR/control" <<EOF
Package: $PKG_NAME
Version: $PKG_VERSION-r1
Architecture: all
Maintainer: Sven Shi <isvenshi@gmail.com>
Depends: luci-base, rpcd, jsonfilter, uclient-fetch, ca-bundle
Source: https://github.com/svenshi/luci-app-oxidns
Section: luci
Priority: optional
Description: LuCI support for OxiDNS
EOF

mkdir -p "$DATA_DIR/www" "$DATA_DIR"
if [ -d htdocs ]; then
	cp -R htdocs/. "$DATA_DIR/www/"
fi
if [ -d root ]; then
	cp -R root/. "$DATA_DIR/"
fi

chmod 755 "$DATA_DIR/usr/libexec/rpcd/luci.oxidns"
if [ -f "$DATA_DIR/etc/init.d/oxidns" ]; then
	chmod 755 "$DATA_DIR/etc/init.d/oxidns"
fi
write_rpcd_restart_script "$CONTROL_DIR/postinst"
write_rpcd_restart_script "$CONTROL_DIR/postrm"

printf '2.0\n' > "$TMP_DIR/debian-binary"
tar_create_gz "$TMP_DIR/control.tar.gz" -C "$CONTROL_DIR" .
tar_create_gz "$TMP_DIR/data.tar.gz" -C "$DATA_DIR" .
create_ipk "$OUT_DIR/${PKG_FILE_BASE}.ipk" "$TMP_DIR/control.tar.gz" "$TMP_DIR/data.tar.gz"

cat > "$DATA_DIR/.PKGINFO" <<EOF
pkgname = $PKG_NAME
pkgver = $PKG_VERSION-r1
pkgdesc = LuCI support for OxiDNS
url = https://github.com/svenshi/luci-app-oxidns
builddate = $(date +%s)
packager = Sven Shi <isvenshi@gmail.com>
arch = all
origin = $PKG_NAME
depend = luci-base
depend = rpcd
depend = jsonfilter
depend = uclient-fetch
depend = ca-bundle
EOF
write_rpcd_restart_script "$DATA_DIR/.post-install"
cp "$DATA_DIR/.post-install" "$DATA_DIR/.post-upgrade"
cp "$DATA_DIR/.post-install" "$DATA_DIR/.post-deinstall"

tar_create_gz "$OUT_DIR/${PKG_FILE_BASE}.apk" -C "$DATA_DIR" .

printf 'Wrote %s\n' "$OUT_DIR/${PKG_FILE_BASE}.ipk"
printf 'Wrote %s\n' "$OUT_DIR/${PKG_FILE_BASE}.apk"

if [ -f po/zh_Hans/oxidns.po ]; then
	mkdir -p "$I18N_CONTROL_DIR" "$I18N_DATA_DIR/usr/lib/lua/luci/i18n" "$I18N_DATA_DIR/etc/uci-defaults"

	cat > "$I18N_CONTROL_DIR/control" <<-EOF
	Package: $I18N_PKG_NAME
	Version: $PKG_VERSION-r1
	Architecture: all
	Maintainer: Sven Shi <isvenshi@gmail.com>
Depends: $PKG_NAME
Source: https://github.com/svenshi/luci-app-oxidns
Section: luci
Priority: optional
	Description: Simplified Chinese translation for luci-app-oxidns
	EOF

	cat > "$I18N_DATA_DIR/etc/uci-defaults/$I18N_PKG_NAME" <<-'EOF'
	uci set luci.languages.zh_cn='简体中文 (Simplified Chinese)'
	uci commit luci
	EOF
	chmod 755 "$I18N_DATA_DIR/etc/uci-defaults/$I18N_PKG_NAME"
	write_i18n_postinst_script "$I18N_CONTROL_DIR/postinst"

	node scripts/po2lmo.mjs po/zh_Hans/oxidns.po "$I18N_DATA_DIR/usr/lib/lua/luci/i18n/oxidns.zh-cn.lmo"

	tar_create_gz "$TMP_DIR/control.tar.gz" -C "$I18N_CONTROL_DIR" .
	tar_create_gz "$TMP_DIR/data.tar.gz" -C "$I18N_DATA_DIR" .
	create_ipk "$OUT_DIR/${I18N_FILE_BASE}.ipk" "$TMP_DIR/control.tar.gz" "$TMP_DIR/data.tar.gz"

	cat > "$I18N_DATA_DIR/.PKGINFO" <<-EOF
	pkgname = $I18N_PKG_NAME
	pkgver = $PKG_VERSION-r1
	pkgdesc = Simplified Chinese translation for luci-app-oxidns
	url = https://github.com/svenshi/luci-app-oxidns
	builddate = $(date +%s)
	packager = Sven Shi <isvenshi@gmail.com>
	arch = all
	origin = $I18N_PKG_NAME
	depend = $PKG_NAME
	EOF
	write_i18n_postinst_script "$I18N_DATA_DIR/.post-install"
	cp "$I18N_DATA_DIR/.post-install" "$I18N_DATA_DIR/.post-upgrade"

	tar_create_gz "$OUT_DIR/${I18N_FILE_BASE}.apk" -C "$I18N_DATA_DIR" .

	sha256sum \
		"$OUT_DIR/${PKG_FILE_BASE}.ipk" \
		"$OUT_DIR/${PKG_FILE_BASE}.apk" \
		"$OUT_DIR/${I18N_FILE_BASE}.ipk" \
		"$OUT_DIR/${I18N_FILE_BASE}.apk" > "$OUT_DIR/sha256sums.txt"

	printf 'Wrote %s\n' "$OUT_DIR/${I18N_FILE_BASE}.ipk"
	printf 'Wrote %s\n' "$OUT_DIR/${I18N_FILE_BASE}.apk"
else
	sha256sum "$OUT_DIR/${PKG_FILE_BASE}.ipk" "$OUT_DIR/${PKG_FILE_BASE}.apk" > "$OUT_DIR/sha256sums.txt"
fi
