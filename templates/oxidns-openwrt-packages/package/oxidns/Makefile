include $(TOPDIR)/rules.mk

PKG_NAME:=oxidns
PKG_VERSION?=0.0.0
PKG_RELEASE:=1
PKG_LICENSE:=GPL-3.0-or-later
PKG_MAINTAINER:=Sven Shi <isvenshi@gmail.com>

include $(INCLUDE_DIR)/package.mk

define Package/oxidns
  SECTION:=net
  CATEGORY:=Network
  TITLE:=OxiDNS DNS policy orchestration engine
  URL:=https://github.com/svenshi/oxidns
endef

define Package/oxidns/description
  OxiDNS is a high-performance DNS policy orchestration engine.
endef

define Package/oxidns/conffiles
/etc/oxidns/config.yaml
endef

define Build/Compile
endef

define Package/oxidns/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/oxidns $(1)/usr/bin/oxidns
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/oxidns.init $(1)/etc/init.d/oxidns
	$(INSTALL_DIR) $(1)/etc/oxidns
	$(INSTALL_CONF) ./files/config.yaml $(1)/etc/oxidns/config.yaml
	$(INSTALL_DIR) $(1)/var/lib/oxidns
endef

$(eval $(call BuildPackage,oxidns))
