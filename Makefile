include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-oxidns
PKG_VERSION:=0.1.0
PKG_RELEASE:=1

PKG_LICENSE:=GPL-3.0-or-later
PKG_MAINTAINER:=Sven Shi <isvenshi@gmail.com>

LUCI_TITLE:=LuCI support for OxiDNS
LUCI_DEPENDS:=+luci-base
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
