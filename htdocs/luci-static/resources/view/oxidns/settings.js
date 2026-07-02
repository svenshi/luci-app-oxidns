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
	params: [
		'core_repository',
		'core_bundle',
		'config_path',
		'working_dir',
		'download_proxy',
		'github_token',
		'clear_download_proxy',
		'clear_github_token'
	],
	expect: {}
});

function field(id) {
	var node = document.getElementById(id);
	return node ? node.value : '';
}

function checked(id) {
	var node = document.getElementById(id);
	return !!(node && node.checked);
}

function row(label, input) {
	return E('div', { 'class': 'tr' }, [
		E('div', { 'class': 'td left', 'style': 'width: 240px' }, label),
		E('div', { 'class': 'td left' }, input)
	]);
}

function textInput(id, value, password, placeholder) {
	return E('input', {
		'id': id,
		'class': 'cbi-input-text',
		'type': password ? 'password' : 'text',
		'value': value || '',
		'placeholder': placeholder || null
	});
}

function option(value, label, selected) {
	return E('option', {
		'value': value,
		'selected': selected ? 'selected' : null
	}, label || value);
}

function bundleSelect(id, value) {
	var selected = value || 'full';
	return E('select', { 'id': id, 'class': 'cbi-input-select' }, [
		option('full', 'full', selected === 'full'),
		option('standard', 'standard', selected === 'standard'),
		option('minimal', 'minimal', selected === 'minimal')
	]);
}

function setStatus(message, danger) {
	var node = document.getElementById('oxidns-settings-status');
	if (!node)
		return;
	node.textContent = message || '';
	node.className = danger ? 'alert-message error' : 'alert-message info';
}

function setDescription(id, message) {
	var node = document.getElementById(id);
	if (node)
		node.textContent = message || '';
}

function setClearOptionVisible(id, visible) {
	var row = document.getElementById('%s-row'.format(id));
	var input = document.getElementById(id);

	if (row)
		row.style.display = visible ? 'block' : 'none';
	if (input)
		input.checked = false;
}

function clearOption(id, label, enabled) {
	return E('label', {
		'id': '%s-row'.format(id),
		'style': 'display: %s; margin-top: .35em;'.format(enabled ? 'block' : 'none')
	}, [
		E('input', {
			'id': id,
			'type': 'checkbox',
			'style': 'margin-right: .5em;'
		}),
		label
	]);
}

function secretSettingInput(input, descriptionId, description, clearId, clearLabel, clearEnabled) {
	return E('div', {}, [
		input,
		E('div', {
			'id': descriptionId,
			'class': 'cbi-value-description'
		}, description),
		clearOption(clearId, clearLabel, clearEnabled)
	]);
}

function proxyDescription() {
	return _('Format: http://host:port, https://host:port, socks5://host:port, or socks5h://host:port. Use http://user:pass@host:port when authentication is required.');
}

function saveSettings() {
	var payload = {
		core_repository: field('oxidns-setting-core-repository') || 'svenshi/oxidns',
		core_bundle: field('oxidns-setting-core-bundle') || 'full',
		config_path: field('oxidns-setting-config-path') || '/etc/oxidns/config.yaml',
		working_dir: field('oxidns-setting-working-dir') || '/var/lib/oxidns',
		download_proxy: field('oxidns-setting-download-proxy'),
		github_token: field('oxidns-setting-github-token'),
		clear_download_proxy: checked('oxidns-setting-clear-download-proxy'),
		clear_github_token: checked('oxidns-setting-clear-github-token')
	};

	ui.showModal(_('OxiDNS'), [
		E('p', {}, _('Saving settings...'))
	]);

	return L.resolveDefault(callSettingsSave(
		payload.core_repository,
		payload.core_bundle,
		payload.config_path,
		payload.working_dir,
		payload.download_proxy,
		payload.github_token,
		payload.clear_download_proxy,
		payload.clear_github_token
	), null).then(function(result) {
		ui.hideModal();
		if (!result || result.ok === false) {
			setStatus((result && (result.message || result.error)) || _('Failed to save settings'), true);
			return;
		}
		setStatus(_('Settings saved.'), false);
		var proxy = document.getElementById('oxidns-setting-download-proxy');
		if (proxy)
			proxy.value = result.download_proxy || '';
		var token = document.getElementById('oxidns-setting-github-token');
		if (token)
			token.value = '';
		var clearProxy = document.getElementById('oxidns-setting-clear-download-proxy');
		if (clearProxy)
			clearProxy.checked = false;
		var clearToken = document.getElementById('oxidns-setting-clear-github-token');
		if (clearToken)
			clearToken.checked = false;
		setClearOptionVisible('oxidns-setting-clear-download-proxy', result.download_proxy_set);
		setClearOptionVisible('oxidns-setting-clear-github-token', result.github_token_set);
		setDescription('oxidns-setting-download-proxy-description',
			proxyDescription());
		setDescription('oxidns-setting-github-token-description',
			result.github_token_set ? _('A token is currently configured. Enter a new value to replace it.') : _('Optional. The token is never shown after saving.'));
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
				_('Configure OxiDNS core download sources, runtime paths, and optional download credentials.')),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'table cbi-section-table' }, [
					row(_('Core repository'), textInput('oxidns-setting-core-repository', settings.core_repository || 'svenshi/oxidns')),
					row(_('Core bundle'), bundleSelect('oxidns-setting-core-bundle', settings.core_bundle || 'full')),
					row(_('Config path'), textInput('oxidns-setting-config-path', settings.config_path || '/etc/oxidns/config.yaml')),
					row(_('Working directory'), textInput('oxidns-setting-working-dir', settings.working_dir || '/var/lib/oxidns')),
					row(_('Download proxy'), secretSettingInput(
						textInput('oxidns-setting-download-proxy', settings.download_proxy || '', false, _('Example: http://127.0.0.1:7890')),
						'oxidns-setting-download-proxy-description',
						proxyDescription(),
						'oxidns-setting-clear-download-proxy',
						_('Clear configured download proxy'),
						settings.download_proxy_set)),
					row(_('GitHub token'), secretSettingInput(
						textInput('oxidns-setting-github-token', '', true),
						'oxidns-setting-github-token-description',
						settings.github_token_set ? _('A token is currently configured. Enter a new value to replace it.') : _('Optional. The token is never shown after saving.'),
						'oxidns-setting-clear-github-token',
						_('Clear configured GitHub token'),
						settings.github_token_set))
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
