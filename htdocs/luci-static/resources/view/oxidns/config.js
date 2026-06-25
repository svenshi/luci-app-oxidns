'use strict';
'require view';
'require rpc';
'require ui';

var callConfigRead = rpc.declare({
	object: 'luci.oxidns',
	method: 'config_read',
	expect: {}
});

var callConfigValidate = rpc.declare({
	object: 'luci.oxidns',
	method: 'config_validate',
	expect: {}
});

var callConfigSave = rpc.declare({
	object: 'luci.oxidns',
	method: 'config_save',
	expect: {}
});

var callBasicRead = rpc.declare({
	object: 'luci.oxidns',
	method: 'config_basic_read',
	expect: {}
});

var callBasicSave = rpc.declare({
	object: 'luci.oxidns',
	method: 'config_basic_save',
	expect: {}
});

var configState = {};
var basicState = {};

function valueOrDash(value) {
	if (value === null || value === undefined || value === '')
		return '-';
	return value;
}

function textareaValue() {
	var textarea = document.getElementById('oxidns-config-content');
	return textarea ? textarea.value : '';
}

function setStatus(message, danger) {
	var node = document.getElementById('oxidns-config-status');
	if (!node)
		return;
	node.textContent = message || '';
	node.className = danger ? 'alert-message error' : 'alert-message info';
}

function runConfigCall(label, call, payload, onSuccess) {
	ui.showModal(_('OxiDNS'), [
		E('p', {}, label)
	]);

	return L.resolveDefault(call(payload || {}), null).then(function(result) {
		ui.hideModal();
		if (!result || result.ok === false) {
			setStatus((result && (result.message || result.error)) || _('Operation failed'), true);
			return;
		}
		if (onSuccess)
			onSuccess(result);
		setStatus(result.message || _('Operation completed.'), false);
	}).catch(function(err) {
		ui.hideModal();
		setStatus(err.message || String(err), true);
	});
}

function validateYaml() {
	return runConfigCall(_('Validating configuration...'), callConfigValidate, {
		content: textareaValue()
	});
}

function saveYaml(reload) {
	return runConfigCall(reload ? _('Saving and reloading configuration...') : _('Saving configuration...'), callConfigSave, {
		content: textareaValue(),
		base_mtime: configState.mtime,
		reload: reload
	}, function(result) {
		configState.mtime = result.mtime;
	});
}

function saveBasic(reload) {
	var level = document.getElementById('oxidns-basic-log-level');
	var listen = document.getElementById('oxidns-basic-api-listen');

	return runConfigCall(reload ? _('Saving basic configuration and reloading...') : _('Saving basic configuration...'), callBasicSave, {
		log_level: level ? level.value : '',
		api_http_listen: listen ? listen.value : '',
		base_mtime: basicState.mtime || configState.mtime,
		reload: reload
	}, function(result) {
		basicState.mtime = result.mtime;
		configState.mtime = result.mtime;
		return callConfigRead().then(function(nextConfig) {
			configState = nextConfig || {};
			var textarea = document.getElementById('oxidns-config-content');
			if (textarea)
				textarea.value = configState.content || '';
		});
	});
}

function option(value, label, selected) {
	return E('option', {
		'value': value,
		'selected': selected ? 'selected' : null
	}, label || value);
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(callConfigRead(), {}),
			L.resolveDefault(callBasicRead(), {})
		]);
	},

	render: function(data) {
		configState = data[0] || {};
		basicState = data[1] || {};

		var levels = [ 'off', 'trace', 'debug', 'info', 'warn', 'error' ];

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('OxiDNS Configuration')),
			E('div', { 'class': 'cbi-map-descr' },
				_('Edit the full YAML configuration or adjust supported top-level settings. Plugin configuration is only available in the YAML editor.')),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Basic Settings')),
				E('div', { 'class': 'cbi-section-descr' },
					_('Basic settings only update existing top-level fields and never modify the plugins section.')),
				E('div', { 'class': 'table cbi-section-table' }, [
					E('div', { 'class': 'tr' }, [
						E('div', { 'class': 'td left', 'style': 'width: 240px' }, _('Log level')),
						E('div', { 'class': 'td left' }, [
							E('select', { 'id': 'oxidns-basic-log-level', 'class': 'cbi-input-select' },
								levels.map(function(level) {
									return option(level, level, (basicState.log_level || 'info') === level);
								}))
						])
					]),
					E('div', { 'class': 'tr' }, [
						E('div', { 'class': 'td left' }, _('API listen')),
						E('div', { 'class': 'td left' }, [
							E('input', {
								'id': 'oxidns-basic-api-listen',
								'class': 'cbi-input-text',
								'value': basicState.api_http_listen || ''
							})
						])
					])
				]),
				E('div', { 'class': 'cbi-button-row' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-positive',
						'click': function(ev) {
							ev.preventDefault();
							return saveBasic(false);
						}
					}, _('Save Basic')),
					' ',
					E('button', {
						'class': 'btn cbi-button cbi-button-action',
						'click': function(ev) {
							ev.preventDefault();
							return saveBasic(true);
						}
					}, _('Save Basic & Reload'))
				])
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('YAML')),
				E('div', { 'class': 'cbi-section-descr' },
					_('Full YAML editing is the advanced path for plugins and routing behavior.')),
				E('div', { 'class': 'table cbi-section-table' }, [
					E('div', { 'class': 'tr' }, [
						E('div', { 'class': 'td left', 'style': 'width: 240px' }, _('Path')),
						E('div', { 'class': 'td left' }, valueOrDash(configState.path))
					])
				]),
				E('textarea', {
					'id': 'oxidns-config-content',
					'class': 'cbi-input-textarea',
					'style': 'width: 100%; min-height: 420px; font-family: monospace;',
					'spellcheck': 'false'
				}, configState.content || ''),
				E('div', { 'class': 'cbi-button-row' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-action',
						'click': function(ev) {
							ev.preventDefault();
							return validateYaml();
						}
					}, _('Validate')),
					' ',
					E('button', {
						'class': 'btn cbi-button cbi-button-positive',
						'click': function(ev) {
							ev.preventDefault();
							return saveYaml(false);
						}
					}, _('Save')),
					' ',
					E('button', {
						'class': 'btn cbi-button cbi-button-action',
						'click': function(ev) {
							ev.preventDefault();
							return saveYaml(true);
						}
					}, _('Save & Reload'))
				]),
				E('div', { 'id': 'oxidns-config-status', 'style': 'margin-top: 1em;' })
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
