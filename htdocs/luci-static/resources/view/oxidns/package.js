'use strict';
'require view';
'require rpc';
'require ui';

var callStatus = rpc.declare({
	object: 'luci.oxidns',
	method: 'status',
	expect: {}
});

var callCheckUpdate = rpc.declare({
	object: 'luci.oxidns',
	method: 'package_check_update',
	expect: {}
});

var callInstall = rpc.declare({
	object: 'luci.oxidns',
	method: 'package_install',
	expect: {}
});

var callUpgrade = rpc.declare({
	object: 'luci.oxidns',
	method: 'package_upgrade',
	expect: {}
});

var callRemove = rpc.declare({
	object: 'luci.oxidns',
	method: 'package_remove',
	expect: {}
});

var latestCheck = null;

function valueOrDash(value) {
	if (value === null || value === undefined || value === '')
		return '-';
	return value;
}

function renderRow(label, value, id) {
	var attrs = { 'class': 'td left' };
	if (id)
		attrs.id = id;

	return E('div', { 'class': 'tr' }, [
		E('div', { 'class': 'td left', 'style': 'width: 240px' }, label),
		E('div', attrs, valueOrDash(value))
	]);
}

function setText(id, value) {
	var node = document.getElementById(id);
	if (node)
		node.textContent = valueOrDash(value);
}

function packageManagerSummary(status) {
	var pm = status.package_manager || {};
	if (!pm.manager || pm.manager === 'none')
		return _('Unavailable');
	return '%s · %s · %s'.format(pm.manager, pm.format || '-', pm.arch || '-');
}

function currentVersion(status) {
	return (status.package && status.package.version) || '-';
}

function runPackageAction(label, call) {
	ui.showModal(_('OxiDNS'), [
		E('p', {}, label)
	]);

	return L.resolveDefault(call(), null).then(function(result) {
		ui.hideModal();
		if (!result || result.ok === false) {
			ui.addNotification(null, E('p', {}, (result && (result.message || result.error)) || _('Package operation failed')), 'danger');
			return;
		}
		ui.addNotification(null, E('p', {}, _('Package operation completed.')), 'info');
		return callStatus().then(updateStatus);
	}).catch(function(err) {
		ui.hideModal();
		ui.addNotification(null, E('p', {}, err.message || String(err)), 'danger');
	});
}

function updateStatus(status) {
	setText('oxidns-package-manager', packageManagerSummary(status || {}));
	setText('oxidns-current-version', currentVersion(status || {}));
	setText('oxidns-package-installed', status && status.package && status.package.installed ? _('Yes') : _('No'));
}

function updateCheck(check) {
	latestCheck = check || null;
	setText('oxidns-latest-version', check && check.latest_version);
	setText('oxidns-update-available', check && check.update_available ? _('Yes') : _('No'));
	setText('oxidns-selected-package', check && check.package ? check.package.filename : '-');
}

function handleCheckUpdate() {
	ui.showModal(_('OxiDNS'), [
		E('p', {}, _('Checking package manifest...'))
	]);

	return L.resolveDefault(callCheckUpdate(), null).then(function(result) {
		ui.hideModal();
		if (!result || result.ok === false) {
			ui.addNotification(null, E('p', {}, (result && (result.message || result.error)) || _('Update check failed')), 'danger');
			return;
		}
		updateCheck(result);
	}).catch(function(err) {
		ui.hideModal();
		ui.addNotification(null, E('p', {}, err.message || String(err)), 'danger');
	});
}

function handleRemove() {
	if (!confirm(_('Remove the OxiDNS core package? Configuration and runtime data should be preserved by the package scripts.')))
		return;
	return runPackageAction(_('Removing OxiDNS package...'), callRemove);
}

function handleInstallOrUpgrade(upgrade) {
	var call = upgrade ? callUpgrade : callInstall;
	return runPackageAction(upgrade ? _('Upgrading OxiDNS package...') : _('Installing OxiDNS package...'), call);
}

function actionButton(label, handler, style) {
	return E('button', {
		'class': 'btn cbi-button cbi-button-%s'.format(style || 'neutral'),
		'click': function(ev) {
			ev.preventDefault();
			return handler();
		}
	}, label);
}

return view.extend({
	load: function() {
		return L.resolveDefault(callStatus(), {});
	},

	render: function(status) {
		var rows = [
			renderRow(_('Package manager'), packageManagerSummary(status), 'oxidns-package-manager'),
			renderRow(_('Installed'), status.package && status.package.installed ? _('Yes') : _('No'), 'oxidns-package-installed'),
			renderRow(_('Current version'), currentVersion(status), 'oxidns-current-version'),
			renderRow(_('Latest version'), '-', 'oxidns-latest-version'),
			renderRow(_('Update available'), '-', 'oxidns-update-available'),
			renderRow(_('Selected package'), '-', 'oxidns-selected-package')
		];

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('OxiDNS Core Package')),
			E('div', { 'class': 'cbi-map-descr' },
				_('Install, upgrade, or remove the package-managed OxiDNS runtime.')),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Package Status')),
				E('div', { 'class': 'table cbi-section-table' }, rows)
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Actions')),
				E('div', { 'class': 'cbi-section-descr' },
					_('Packages are downloaded from the configured OxiDNS OpenWrt package manifest and installed through the system package manager.')),
				E('div', { 'class': 'cbi-button-row' }, [
					actionButton(_('Check for updates'), handleCheckUpdate, 'action'),
					' ',
					actionButton(_('Install'), function() { return handleInstallOrUpgrade(false); }, 'positive'),
					' ',
					actionButton(_('Upgrade'), function() { return handleInstallOrUpgrade(true); }, 'action'),
					' ',
					actionButton(_('Remove'), handleRemove, 'negative')
				])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
