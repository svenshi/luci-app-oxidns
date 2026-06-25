#!/bin/sh

set -eu

node -e "for (const f of ['htdocs/luci-static/resources/view/oxidns/overview.js','htdocs/luci-static/resources/view/oxidns/package.js','htdocs/luci-static/resources/view/oxidns/config.js','htdocs/luci-static/resources/view/oxidns/logs.js','htdocs/luci-static/resources/view/oxidns/settings.js']) new Function(require('fs').readFileSync(f,'utf8'));"
node -e "for (const f of ['root/usr/share/luci/menu.d/luci-app-oxidns.json','root/usr/share/rpcd/acl.d/luci-app-oxidns.json','root/usr/share/oxidns/openwrt-manifest.example.json','root/usr/share/oxidns/openwrt-manifest.schema.json','root/usr/share/oxidns/targets.json']) JSON.parse(require('fs').readFileSync(f,'utf8'));"
node --check scripts/write-ar.mjs
node --check templates/oxidns-openwrt-packages/scripts/generate-manifest.mjs
sh -n root/usr/libexec/rpcd/luci.oxidns
sh -n templates/oxidns-openwrt-packages/package/oxidns/files/oxidns.init
