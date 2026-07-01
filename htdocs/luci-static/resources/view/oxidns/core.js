'use strict';
'require view';
'require rpc';
'require ui';

var callStatus = rpc.declare({
	object: 'luci.oxidns',
	method: 'status',
	expect: {}
});

var callCoreInstall = rpc.declare({
	object: 'luci.oxidns',
	method: 'core_install',
	expect: {}
});

var callCoreReinstall = rpc.declare({
	object: 'luci.oxidns',
	method: 'core_reinstall',
	expect: {}
});

var callCoreUploadInstall = rpc.declare({
	object: 'luci.oxidns',
	method: 'core_upload_install',
	params: [ 'path' ],
	expect: {}
});

var callCoreRemove = rpc.declare({
	object: 'luci.oxidns',
	method: 'core_remove',
	expect: {}
});

var statusState = {};

function valueOrDash(value) {
	if (value === null || value === undefined || value === '')
		return '-';
	return value;
}

function boolText(value) {
	return value ? _('Yes') : _('No');
}

function coreInstalled(status) {
	return !!(status && status.core && status.core.installed);
}

function serviceRunning(status) {
	return !!(status && status.service_status && status.service_status.running);
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

function refreshStatus() {
	return L.resolveDefault(callStatus(), {}).then(function(status) {
		statusState = status || {};
		var core = statusState.core || {};

		setText('oxidns-core-installed', boolText(core.installed));
		setText('oxidns-core-version', core.version);
		setText('oxidns-core-bundle', core.bundle);
		setText('oxidns-core-target', core.target);
		setText('oxidns-core-binary', core.binary_path);
		setText('oxidns-core-service', serviceRunning(statusState) ? _('Running') : _('Stopped'));
	});
}

function callWithRpcTimeout(call, seconds) {
	if (!seconds)
		return call();

	var previousTimeout = L.env.rpctimeout;
	L.env.rpctimeout = seconds;

	return call().then(function(result) {
		if (previousTimeout === undefined)
			delete L.env.rpctimeout;
		else
			L.env.rpctimeout = previousTimeout;
		return result;
	}, function(err) {
		if (previousTimeout === undefined)
			delete L.env.rpctimeout;
		else
			L.env.rpctimeout = previousTimeout;
		throw err;
	});
}

function runCoreAction(label, call, timeout) {
	ui.showModal(_('OxiDNS'), [
		E('p', {}, label)
	]);

	return L.resolveDefault(callWithRpcTimeout(call, timeout), null).then(function(result) {
		ui.hideModal();
		if (!result || result.ok === false) {
			ui.addNotification(null, E('p', {}, (result && (result.message || result.error)) || _('Core operation failed')), 'danger');
			return;
		}
		return refreshStatus().then(function() {
			ui.addNotification(null, E('p', {}, _('Core operation completed.')), 'info');
		});
	}).catch(function(err) {
		ui.hideModal();
		ui.addNotification(null, E('p', {}, err.message || String(err)), 'danger');
	});
}

function handleInstall() {
	return runCoreAction(_('Installing OxiDNS core...'), callCoreInstall, 300);
}

function handleReinstall() {
	return runCoreAction(_('Repair reinstalling OxiDNS core...'), callCoreReinstall, 300);
}

function handleUploadInstall() {
	var uploadPath = '/tmp/oxidns-core-upload-%d-%d'.format(Date.now(), Math.floor(Math.random() * 1000000));

	return ui.uploadFile(uploadPath).then(function() {
		return runCoreAction(_('Installing uploaded OxiDNS core...'), function() {
			return callCoreUploadInstall(uploadPath);
		}, 300);
	}).catch(function(err) {
		if (err && err.message && err.message.indexOf(_('Upload has been cancelled')) >= 0)
			return;
		ui.addNotification(null, E('p', {}, (err && err.message) || String(err)), 'danger');
	});
}

function handleRemove() {
	if (!confirm(_('Remove the OxiDNS core binary? Configuration and runtime data will be preserved.')))
		return;
	return runCoreAction(_('Removing OxiDNS core...'), callCoreRemove);
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

function actionButtons(status) {
	if (coreInstalled(status)) {
		return [
			actionButton(_('Repair Reinstall'), handleReinstall, 'action'),
			actionButton(_('Upload Core'), handleUploadInstall, 'action'),
			actionButton(_('Remove Core'), handleRemove, 'negative')
		];
	}

	return [
		actionButton(_('Install Core'), handleInstall, 'positive'),
		actionButton(_('Upload Core'), handleUploadInstall, 'action')
	];
}

return view.extend({
	load: function() {
		return L.resolveDefault(callStatus(), {});
	},

	render: function(status) {
		statusState = status || {};
		var core = statusState.core || {};
		var rows = [
			renderRow(_('Installed'), boolText(core.installed), 'oxidns-core-installed'),
			renderRow(_('Version'), core.version, 'oxidns-core-version'),
			renderRow(_('Bundle'), core.bundle, 'oxidns-core-bundle'),
			renderRow(_('Target'), core.target, 'oxidns-core-target'),
			renderRow(_('Binary path'), core.binary_path, 'oxidns-core-binary'),
			renderRow(_('Service status'), serviceRunning(statusState) ? _('Running') : _('Stopped'), 'oxidns-core-service')
		];

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('OxiDNS Core')),
			E('div', { 'class': 'cbi-map-descr' },
				_('Install or repair the OxiDNS core binary. Runtime upgrades are handled by OxiDNS itself.')),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Core Status')),
				E('div', { 'class': 'table cbi-section-table' }, rows)
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Actions')),
				E('div', { 'class': 'cbi-section-descr' },
					_('LuCI can download the official OxiDNS release archive or install an uploaded .tar.gz archive or single oxidns binary. Future upgrades are handled by the OxiDNS core.')),
				E('div', {
					'class': 'cbi-button-row',
					'style': 'display: flex; flex-wrap: wrap; gap: .5em;'
				}, actionButtons(statusState))
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
