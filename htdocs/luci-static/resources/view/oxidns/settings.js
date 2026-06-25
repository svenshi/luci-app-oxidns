'use strict';
'require view';
'require rpc';
'require ui';

var callSettingsRead = rpc.declare({
	object: 'luci.oxidns',
	method: 'settings_read',
	expect: {}
});

var callSettingsSave = rpc.declare({
	object: 'luci.oxidns',
	method: 'settings_save',
	expect: {}
});

function field(id) {
	var node = document.getElementById(id);
	return node ? node.value : '';
}

function row(label, input) {
	return E('div', { 'class': 'tr' }, [
		E('div', { 'class': 'td left', 'style': 'width: 240px' }, label),
		E('div', { 'class': 'td left' }, input)
	]);
}

function textInput(id, value, password) {
	return E('input', {
		'id': id,
		'class': 'cbi-input-text',
		'type': password ? 'password' : 'text',
		'value': value || ''
	});
}

function setStatus(message, danger) {
	var node = document.getElementById('oxidns-settings-status');
	if (!node)
		return;
	node.textContent = message || '';
	node.className = danger ? 'alert-message error' : 'alert-message info';
}

function saveSettings() {
	var payload = {
		install_mode: field('oxidns-setting-install-mode') || 'package',
		service_name: field('oxidns-setting-service-name') || 'oxidns',
		config_path: field('oxidns-setting-config-path') || '/etc/oxidns/config.yaml',
		working_dir: field('oxidns-setting-working-dir') || '/var/lib/oxidns',
		api_base_url: field('oxidns-setting-api-base-url') || 'http://127.0.0.1:9199/api',
		package_feed_url: field('oxidns-setting-package-feed-url'),
		manifest_url: field('oxidns-setting-manifest-url'),
		download_proxy: field('oxidns-setting-download-proxy'),
		github_token: field('oxidns-setting-github-token')
	};

	ui.showModal(_('OxiDNS'), [
		E('p', {}, _('Saving settings...'))
	]);

	return L.resolveDefault(callSettingsSave(payload), null).then(function(result) {
		ui.hideModal();
		if (!result || result.ok === false) {
			setStatus((result && (result.message || result.error)) || _('Failed to save settings'), true);
			return;
		}
		setStatus(_('Settings saved.'), false);
		var token = document.getElementById('oxidns-setting-github-token');
		if (token)
			token.value = '';
	}).catch(function(err) {
		ui.hideModal();
		setStatus(err.message || String(err), true);
	});
}

return view.extend({
	load: function() {
		return L.resolveDefault(callSettingsRead(), {});
	},

	render: function(settings) {
		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('OxiDNS Settings')),
			E('div', { 'class': 'cbi-map-descr' },
				_('Configure LuCI integration paths, package manifest sources, and optional download credentials.')),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'table cbi-section-table' }, [
					row(_('Install mode'), textInput('oxidns-setting-install-mode', settings.install_mode || 'package')),
					row(_('Service name'), textInput('oxidns-setting-service-name', settings.service_name || 'oxidns')),
					row(_('Config path'), textInput('oxidns-setting-config-path', settings.config_path || '/etc/oxidns/config.yaml')),
					row(_('Working directory'), textInput('oxidns-setting-working-dir', settings.working_dir || '/var/lib/oxidns')),
					row(_('API base URL'), textInput('oxidns-setting-api-base-url', settings.api_base_url || 'http://127.0.0.1:9199/api')),
					row(_('Package feed URL'), textInput('oxidns-setting-package-feed-url', settings.package_feed_url || '')),
					row(_('Manifest URL'), textInput('oxidns-setting-manifest-url', settings.manifest_url || '')),
					row(_('Download proxy'), textInput('oxidns-setting-download-proxy', settings.download_proxy || '')),
					row(_('GitHub token'), E('div', {}, [
						textInput('oxidns-setting-github-token', '', true),
						E('div', { 'class': 'cbi-value-description' },
							settings.github_token_set ? _('A token is currently configured. Enter a new value to replace it.') : _('Optional. The token is never shown after saving.'))
					]))
				]),
				E('div', { 'class': 'cbi-button-row' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-positive',
						'click': function(ev) {
							ev.preventDefault();
							return saveSettings();
						}
					}, _('Save Settings'))
				]),
				E('div', { 'id': 'oxidns-settings-status', 'style': 'margin-top: 1em;' })
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
