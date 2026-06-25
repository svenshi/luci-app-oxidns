#!/bin/sh

set -eu

VERSION="${1:-0.1.0}"
OUT_DIR="${2:-dist}"
PKG_VERSION="$(printf '%s' "$VERSION" | sed 's/^v//')"
PKG_NAME="luci-app-oxidns"
PKG_FILE_BASE="${PKG_NAME}_${PKG_VERSION}-r1_all"

need_cmd() {
	command -v "$1" >/dev/null 2>&1 || {
		printf 'required command not found: %s\n' "$1" >&2
		exit 1
	}
}

need_cmd tar
need_cmd gzip
need_cmd node

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/luci-app-oxidns-build.XXXXXX")"
cleanup() {
	rm -rf "$TMP_DIR"
}
trap cleanup EXIT HUP INT TERM

CONTROL_DIR="$TMP_DIR/control"
DATA_DIR="$TMP_DIR/data"
mkdir -p "$CONTROL_DIR" "$DATA_DIR" "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"

cat > "$CONTROL_DIR/control" <<EOF
Package: $PKG_NAME
Version: $PKG_VERSION-r1
Architecture: all
Maintainer: Sven Shi <isvenshi@gmail.com>
Depends: luci-base
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

printf '2.0\n' > "$TMP_DIR/debian-binary"
tar -czf "$TMP_DIR/control.tar.gz" -C "$CONTROL_DIR" .
tar -czf "$TMP_DIR/data.tar.gz" -C "$DATA_DIR" .
node scripts/write-ar.mjs "$OUT_DIR/${PKG_FILE_BASE}.ipk" \
	"$TMP_DIR/debian-binary" \
	"$TMP_DIR/control.tar.gz" \
	"$TMP_DIR/data.tar.gz"

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
EOF

tar -czf "$OUT_DIR/${PKG_FILE_BASE}.apk" -C "$DATA_DIR" .
sha256sum "$OUT_DIR/${PKG_FILE_BASE}.ipk" "$OUT_DIR/${PKG_FILE_BASE}.apk" > "$OUT_DIR/sha256sums.txt"

printf 'Wrote %s\n' "$OUT_DIR/${PKG_FILE_BASE}.ipk"
printf 'Wrote %s\n' "$OUT_DIR/${PKG_FILE_BASE}.apk"
