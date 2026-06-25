'use strict';
'require view';
'require rpc';
'require ui';

var callStatus = rpc.declare({
	object: 'luci.oxidns',
	method: 'status',
	expect: {}
});

function renderRow(label, value) {
	return E('div', { 'class': 'tr' }, [
		E('div', { 'class': 'td left', 'style': 'width: 240px' }, label),
		E('div', { 'class': 'td left' }, value || '-')
	]);
}

return view.extend({
	load: function() {
		return L.resolveDefault(callStatus(), {
			ok: false,
			error: _('Unable to query OxiDNS status')
		});
	},

	render: function(status) {
		var rows = [
			renderRow(_('Application status'), status.ok ? _('Ready') : _('Unavailable')),
			renderRow(_('Backend'), status.backend || 'rpcd'),
			renderRow(_('Install mode'), status.install_mode || _('Unknown')),
			renderRow(_('Config path'), status.config_path || '/etc/oxidns/config.yaml'),
			renderRow(_('Working directory'), status.working_dir || '/var/lib/oxidns'),
			renderRow(_('Service'), status.service || 'oxidns')
		];

		if (status.error)
			rows.push(renderRow(_('Error'), status.error));

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('OxiDNS')),
			E('div', { 'class': 'cbi-map-descr' },
				_('Manage the OxiDNS runtime, service, configuration, and logs from LuCI.')),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Overview')),
				E('div', { 'class': 'table cbi-section-table' }, rows)
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
