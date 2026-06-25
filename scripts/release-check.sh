#!/bin/sh

set -eu

VERSION="${1:-${VERSION:-0.1.0}}"
OUT_DIR="${2:-${OUT_DIR:-dist}}"
PKG_VERSION="$(printf '%s' "$VERSION" | sed 's/^v//')"
PKG_BASE="luci-app-oxidns_${PKG_VERSION}-r1_all"

need_cmd() {
	command -v "$1" >/dev/null 2>&1 || {
		printf 'required command not found: %s\n' "$1" >&2
		exit 1
	}
}

need_cmd ar
need_cmd grep
need_cmd sha256sum
need_cmd tar

scripts/check.sh
scripts/integration-check.sh
scripts/build-luci-package.sh "$VERSION" "$OUT_DIR"

ar t "$OUT_DIR/${PKG_BASE}.ipk" | grep -q '^debian-binary/$'
ar t "$OUT_DIR/${PKG_BASE}.ipk" | grep -q '^control.tar.gz/$'
ar t "$OUT_DIR/${PKG_BASE}.ipk" | grep -q '^data.tar.gz/$'
tar -tzf "$OUT_DIR/${PKG_BASE}.apk" | grep -q './usr/libexec/rpcd/luci.oxidns'
sha256sum -c "$OUT_DIR/sha256sums.txt"

printf 'Release check passed for %s in %s\n' "$VERSION" "$OUT_DIR"
