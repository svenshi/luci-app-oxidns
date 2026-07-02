'use strict';
'require view';
'require rpc';
'require ui';
'require poll';

var callStatus = rpc.declare({
	object: 'luci.oxidns',
	method: 'status',
	expect: {}
});

var serviceCalls = {
	start: rpc.declare({ object: 'luci.oxidns', method: 'service_start', expect: {} }),
	stop: rpc.declare({ object: 'luci.oxidns', method: 'service_stop', expect: {} }),
	restart: rpc.declare({ object: 'luci.oxidns', method: 'service_restart', expect: {} }),
	enable: rpc.declare({ object: 'luci.oxidns', method: 'service_enable', expect: {} }),
	disable: rpc.declare({ object: 'luci.oxidns', method: 'service_disable', expect: {} })
};

var statusState = {};
var serviceActionsKey = null;

function valueOrDash(value) {
	if (value === null || value === undefined || value === '')
		return '-';
	return value;
}

function boolText(value) {
	return value ? _('Yes') : _('No');
}

function serviceRunning(status) {
	return !!(status && status.service_status && status.service_status.running);
}

function serviceEnabled(status) {
	return !!(status && status.service_status && status.service_status.enabled);
}

function coreInstalled(status) {
	return !!(status && status.core && status.core.installed);
}

function statusBadge(text, good) {
	return E('span', {
		'class': good ? 'label label-success' : 'label label-warning'
	}, text);
}

function backendStatusBadge(status) {
	return status && status.ok ? statusBadge(_('Available'), true) : statusBadge(_('Unavailable'), false);
}

function serviceStatusBadge(status) {
	return serviceRunning(status) ? statusBadge(_('Running'), true) : statusBadge(_('Stopped'), false);
}

function localServiceHost(host) {
	return host === 'localhost' ||
		host === '127.0.0.1' ||
		host === '0.0.0.0' ||
		host === '::' ||
		host === '::1' ||
		host === '[::]' ||
		host === '[::1]';
}

function browserWebuiUrl(status) {
	var raw = status && status.webui && status.webui.url;
	if (!raw)
		return '';

	try {
		var url = new URL(raw, window.location.href);
		if (!(status && status.webui && status.webui.local_only) && localServiceHost(url.hostname) && window.location.hostname)
			url.hostname = window.location.hostname;
		url.pathname = url.pathname || '/';
		url.search = '';
		url.hash = '';
		return url.toString();
	} catch (e) {
		return raw;
	}
}

function webuiReady(status) {
	return !!(status && status.webui && status.webui.installed && serviceRunning(status) && browserWebuiUrl(status));
}

function webuiHint(status) {
	if (!status || !status.webui || !status.webui.installed)
		return _('WebUI files are not installed.');
	if (!serviceRunning(status))
		return _('Start the OxiDNS service before opening WebUI.');
	if (status.webui.local_only)
		return _('WebUI listens on loopback only. Configure the HTTP listen address to a LAN-reachable address, or use an SSH tunnel.');
	return '';
}

function webuiButton(status) {
	var url = browserWebuiUrl(status);
	var ready = webuiReady(status);
	var hint = webuiHint(status);

	if (!ready) {
		return E('button', {
			'id': 'oxidns-webui-link',
			'class': 'btn cbi-button cbi-button-neutral',
			'type': 'button',
			'disabled': 'disabled',
			'title': hint
		}, _('Open WebUI'));
	}

	return E('a', {
		'id': 'oxidns-webui-link',
		'class': 'btn cbi-button cbi-button-action',
		'href': url,
		'target': '_blank',
		'rel': 'noopener'
	}, _('Open WebUI'));
}

function webuiEntry(status) {
	var hint = webuiHint(status);

	return E('div', {
		'style': 'display: flex; flex-wrap: wrap; gap: .75em; align-items: center;'
	}, [
		webuiButton(status),
		hint ? E('span', { 'class': 'cbi-value-description' }, hint) : ''
	]);
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

function coreSummary(status) {
	var core = status.core || {};
	var parts = [];

	parts.push(core.installed ? _('Installed') : _('Not installed'));
	if (core.version)
		parts.push(core.version);
	if (core.bundle)
		parts.push(core.bundle);
	if (core.target)
		parts.push(core.target);

	return parts.join(' · ');
}

function buildSummary(status) {
	var build = status.build || {};
	if (!build.version)
		return '-';
	return '%s · %s'.format(build.version, build.bundle || 'unknown');
}

function setNodeContent(node, value) {
	while (node.firstChild)
		node.removeChild(node.firstChild);

	if (value && value.nodeType)
		node.appendChild(value);
	else
		node.textContent = valueOrDash(value);
}

function blockedActionMessage(action, status) {
	if (!coreInstalled(status))
		return _('Install the OxiDNS core before using service controls.');
	if (action === 'start' && serviceRunning(status))
		return _('OxiDNS is already running.');
	if (action === 'stop' && !serviceRunning(status))
		return _('OxiDNS is already stopped.');
	if (action === 'enable' && serviceEnabled(status))
		return _('OxiDNS is already enabled on boot.');
	if (action === 'disable' && !serviceEnabled(status))
		return _('OxiDNS is already disabled on boot.');
	return null;
}

function refreshStatus() {
	return L.resolveDefault(callStatus(), {}).then(function(status) {
		statusState = status || {};

		var fields = {
			'oxidns-backend-status': backendStatusBadge(statusState),
			'oxidns-core': coreSummary(statusState),
			'oxidns-build': buildSummary(statusState),
			'oxidns-service-running': serviceStatusBadge(statusState),
			'oxidns-service-enabled': boolText(statusState.service_status && statusState.service_status.enabled),
			'oxidns-webui': webuiEntry(statusState),
			'oxidns-config-path': statusState.config_path,
			'oxidns-working-dir': statusState.working_dir
		};

		Object.keys(fields).forEach(function(id) {
			var node = document.getElementById(id);
			if (node)
				setNodeContent(node, fields[id]);
		});

		updateServiceActions(statusState);
	});
}

function handleServiceAction(action) {
	var call = serviceCalls[action];
	if (!call)
		return;

	var blocked = blockedActionMessage(action, statusState);
	if (blocked) {
		ui.addNotification(null, E('p', {}, blocked), 'info');
		return refreshStatus();
	}

	ui.showModal(_('OxiDNS'), [
		E('p', {}, _('Applying service action...'))
	]);

	return L.resolveDefault(call(), null).then(function(result) {
		ui.hideModal();
		if (!result || result.ok === false) {
			ui.addNotification(null, E('p', {}, (result && (result.message || result.error)) || _('Service action failed')), 'danger');
			return;
		}
		return refreshStatus().then(function() {
			ui.addNotification(null, E('p', {}, _('Service action completed.')), 'info');
		});
	}).catch(function(err) {
		ui.hideModal();
		ui.addNotification(null, E('p', {}, err.message || String(err)), 'danger');
	});
}

function actionButton(label, action, style, id) {
	var attrs = {
		'id': id,
		'class': 'btn cbi-button cbi-button-%s'.format(style || 'neutral'),
		'click': function(ev) {
			ev.preventDefault();
			return handleServiceAction(action);
		}
	};

	return E('button', attrs, label);
}

function disabledActionButton(label, hint, id) {
	return E('button', {
		'id': id,
		'class': 'btn cbi-button cbi-button-neutral',
		'type': 'button',
		'disabled': 'disabled',
		'title': hint
	}, label);
}

function coreInstallLink() {
	return E('a', {
		'class': 'btn cbi-button cbi-button-action',
		'href': L.url('admin/services/oxidns/core')
	}, _('Install Core'));
}

function serviceActionButtons(status) {
	var actions = [];
	var missingCoreHint = _('Install the OxiDNS core before using service controls.');

	if (!coreInstalled(status)) {
		actions.push(disabledActionButton(_('Start'), missingCoreHint, 'oxidns-service-start'));
		actions.push(disabledActionButton(_('Enable'), missingCoreHint, 'oxidns-service-enable'));
		actions.push(coreInstallLink());
		return actions;
	}

	if (serviceRunning(status)) {
		actions.push(actionButton(_('Stop'), 'stop', 'negative', 'oxidns-service-stop'));
		actions.push(actionButton(_('Restart'), 'restart', 'action', 'oxidns-service-restart'));
	} else {
		actions.push(actionButton(_('Start'), 'start', 'positive', 'oxidns-service-start'));
	}

	if (serviceEnabled(status))
		actions.push(actionButton(_('Disable'), 'disable', 'neutral', 'oxidns-service-disable'));
	else
		actions.push(actionButton(_('Enable'), 'enable', 'positive', 'oxidns-service-enable'));

	return actions;
}

function serviceActionStateKey(status) {
	return '%s:%s:%s'.format(
		coreInstalled(status) ? 'core' : 'missing-core',
		serviceRunning(status) ? 'running' : 'stopped',
		serviceEnabled(status) ? 'enabled' : 'disabled');
}

function updateServiceActions(status) {
	var node = document.getElementById('oxidns-service-actions');
	if (!node)
		return;

	var nextKey = serviceActionStateKey(status);
	if (nextKey === serviceActionsKey)
		return;

	serviceActionsKey = nextKey;
	while (node.firstChild)
		node.removeChild(node.firstChild);

	serviceActionButtons(status).forEach(function(button) {
		node.appendChild(button);
	});
}

return view.extend({
	load: function() {
		return L.resolveDefault(callStatus(), {
			ok: false,
			error: _('Unable to query OxiDNS status')
		});
	},

	render: function(status) {
		statusState = status || {};

		var rows = [
			renderRow(_('LuCI backend'), backendStatusBadge(status), 'oxidns-backend-status'),
			renderRow(_('Core'), coreSummary(status), 'oxidns-core'),
			renderRow(_('Build'), buildSummary(status), 'oxidns-build'),
			renderRow(_('Service status'), serviceStatusBadge(status), 'oxidns-service-running'),
			renderRow(_('Start on boot'), boolText(status.service_status && status.service_status.enabled), 'oxidns-service-enabled'),
			renderRow(_('WebUI'), webuiEntry(status), 'oxidns-webui'),
			renderRow(_('Config path'), status.config_path || '/etc/oxidns/config.yaml', 'oxidns-config-path'),
			renderRow(_('Working directory'), status.working_dir || '/var/lib/oxidns', 'oxidns-working-dir')
		];

		if (status.error)
			rows.push(renderRow(_('Error'), status.error));

		serviceActionsKey = serviceActionStateKey(statusState);
		poll.add(refreshStatus, 5);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('OxiDNS')),
			E('div', { 'class': 'cbi-map-descr' },
				_('Manage the OxiDNS runtime, service, configuration, and logs from LuCI.')),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Overview')),
				E('div', { 'class': 'table cbi-section-table' }, rows)
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Service')),
				E('div', { 'class': 'cbi-section-descr' },
					_('Control the OpenWrt init service for OxiDNS.')),
				E('div', {
					'id': 'oxidns-service-actions',
					'class': 'cbi-button-row',
					'style': 'display: flex; flex-wrap: wrap; gap: .5em;'
				}, serviceActionButtons(statusState))
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
