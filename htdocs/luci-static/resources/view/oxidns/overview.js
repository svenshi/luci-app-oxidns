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

function valueOrDash(value) {
	if (value === null || value === undefined || value === '')
		return '-';
	return value;
}

function boolText(value) {
	return value ? _('Yes') : _('No');
}

function statusBadge(text, good) {
	return E('span', {
		'class': good ? 'label label-success' : 'label label-warning'
	}, text);
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

function packageSummary(status) {
	var pkg = status.package || {};
	var pm = status.package_manager || {};
	var parts = [];

	parts.push(pkg.installed ? _('Installed') : _('Not installed'));
	if (pkg.version)
		parts.push(pkg.version);
	if (pm.manager && pm.manager !== 'none')
		parts.push('%s/%s'.format(pm.manager, pm.arch || 'unknown'));

	return parts.join(' · ');
}

function buildSummary(status) {
	var build = status.build || {};
	if (!build.version)
		return '-';
	return '%s · %s'.format(build.version, build.bundle || 'unknown');
}

function refreshStatus() {
	return L.resolveDefault(callStatus(), {}).then(function(status) {
		statusState = status || {};

		var fields = {
			'oxidns-package': packageSummary(statusState),
			'oxidns-build': buildSummary(statusState),
			'oxidns-binary': boolText(statusState.binary_present),
			'oxidns-service-running': boolText(statusState.service_status && statusState.service_status.running),
			'oxidns-service-enabled': boolText(statusState.service_status && statusState.service_status.enabled),
			'oxidns-api-ready': boolText(statusState.api && statusState.api.ready),
			'oxidns-config-path': statusState.config_path,
			'oxidns-working-dir': statusState.working_dir,
			'oxidns-api-url': statusState.api_base_url
		};

		Object.keys(fields).forEach(function(id) {
			var node = document.getElementById(id);
			if (node)
				node.textContent = valueOrDash(fields[id]);
		});
	});
}

function handleServiceAction(action) {
	var call = serviceCalls[action];
	if (!call)
		return;

	ui.showModal(_('OxiDNS'), [
		E('p', {}, _('Applying service action...'))
	]);

	return L.resolveDefault(call(), null).then(function(result) {
		ui.hideModal();
		if (!result || result.ok === false) {
			ui.addNotification(null, E('p', {}, (result && (result.message || result.error)) || _('Service action failed')), 'danger');
			return;
		}
		ui.addNotification(null, E('p', {}, _('Service action completed.')), 'info');
		return refreshStatus();
	}).catch(function(err) {
		ui.hideModal();
		ui.addNotification(null, E('p', {}, err.message || String(err)), 'danger');
	});
}

function actionButton(label, action, style) {
	return E('button', {
		'class': 'btn cbi-button cbi-button-%s'.format(style || 'neutral'),
		'click': function(ev) {
			ev.preventDefault();
			return handleServiceAction(action);
		}
	}, label);
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
			renderRow(_('Application status'), status.ok ? statusBadge(_('Ready'), true) : statusBadge(_('Unavailable'), false)),
			renderRow(_('Package'), packageSummary(status), 'oxidns-package'),
			renderRow(_('Build'), buildSummary(status), 'oxidns-build'),
			renderRow(_('Binary present'), boolText(status.binary_present), 'oxidns-binary'),
			renderRow(_('Service running'), boolText(status.service_status && status.service_status.running), 'oxidns-service-running'),
			renderRow(_('Start on boot'), boolText(status.service_status && status.service_status.enabled), 'oxidns-service-enabled'),
			renderRow(_('API ready'), boolText(status.api && status.api.ready), 'oxidns-api-ready'),
			renderRow(_('Config path'), status.config_path || '/etc/oxidns/config.yaml', 'oxidns-config-path'),
			renderRow(_('Working directory'), status.working_dir || '/var/lib/oxidns', 'oxidns-working-dir'),
			renderRow(_('API URL'), status.api_base_url || '-', 'oxidns-api-url')
		];

		if (status.error)
			rows.push(renderRow(_('Error'), status.error));

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
				E('div', { 'class': 'cbi-button-row' }, [
					actionButton(_('Start'), 'start', 'positive'),
					' ',
					actionButton(_('Stop'), 'stop', 'negative'),
					' ',
					actionButton(_('Restart'), 'restart', 'action'),
					' ',
					actionButton(_('Enable'), 'enable', 'positive'),
					' ',
					actionButton(_('Disable'), 'disable', 'neutral')
				])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
