'use strict';
'require view';
'require rpc';
'require ui';

var callConfigRead = rpc.declare({
	object: 'luci.oxidns',
	method: 'config_read',
	expect: {}
});

var callStatus = rpc.declare({
	object: 'luci.oxidns',
	method: 'status',
	expect: {}
});

var callConfigValidate = rpc.declare({
	object: 'luci.oxidns',
	method: 'config_validate',
	params: [ 'content' ],
	expect: {}
});

var callConfigSave = rpc.declare({
	object: 'luci.oxidns',
	method: 'config_save',
	params: [ 'content', 'base_mtime', 'restart' ],
	expect: {}
});

var configState = {};

function loadErrorMessage(err) {
	if (err && (err.message || err.error))
		return err.message || err.error;
	return _('Unable to load configuration.');
}

function valueOrDash(value) {
	if (value === null || value === undefined || value === '')
		return '-';
	return value;
}

function coreInstalled(status) {
	return !!(status && status.core && status.core.installed);
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

function configTextarea(content) {
	var value = content || '';
	var textarea = E('textarea', {
		'id': 'oxidns-config-content',
		'class': 'cbi-input-textarea',
		'style': 'width: 100%; min-height: 420px; font-family: monospace;',
		'spellcheck': 'false'
	});

	textarea.defaultValue = value;
	textarea.value = value;
	return textarea;
}

function runConfigCall(label, call, args, onSuccess) {
	ui.showModal(_('OxiDNS'), [
		E('p', {}, label)
	]);

	return L.resolveDefault(call.apply(null, args || []), null).then(function(result) {
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
	return runConfigCall(_('Validating configuration...'), callConfigValidate, [
		textareaValue()
	]);
}

function saveYaml(restart) {
	return runConfigCall(restart ? _('Saving and restarting service...') : _('Saving configuration...'), callConfigSave, [
		textareaValue(),
		configState.mtime,
		restart
	], function(result) {
		configState.mtime = result.mtime;
	});
}

return view.extend({
	load: function() {
		var configPromise = L.resolveDefault(callConfigRead(), null).then(function(config) {
			return config || {
				ok: false,
				message: _('Unable to load configuration.')
			};
		}).catch(function(err) {
			return {
				ok: false,
				message: loadErrorMessage(err)
			};
		});

		return Promise.all([
			configPromise,
			L.resolveDefault(callStatus(), {})
		]).then(function(results) {
			return {
				config: results[0],
				status: results[1] || {}
			};
		});
	},

	render: function(data) {
		configState = data && data.config ? data.config : {};
		var statusState = data && data.status ? data.status : {};
		var readFailed = configState.ok === false;
		var configContent = configState.content || '';
		var configMessage = readFailed
			? (configState.message || _('Unable to load configuration.'))
			: '';

		if (readFailed && !coreInstalled(statusState)) {
			return E('div', { 'class': 'cbi-map' }, [
				E('h2', {}, _('OxiDNS Configuration')),
				E('div', { 'class': 'cbi-map-descr' },
					_('Edit, validate, and save the full OxiDNS YAML configuration file.')),
				E('div', { 'class': 'cbi-section' }, [
					E('div', { 'class': 'alert-message warning', 'style': 'margin: 1em 0;' },
						_('Install the OxiDNS core before editing the configuration.')),
					E('a', {
						'class': 'btn cbi-button cbi-button-action',
						'href': L.url('admin/services/oxidns/core')
					}, _('Install Core'))
				])
			]);
		}

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('OxiDNS Configuration')),
			E('div', { 'class': 'cbi-map-descr' },
				_('Edit, validate, and save the full OxiDNS YAML configuration file.')),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('YAML')),
				E('div', { 'class': 'table cbi-section-table' }, [
					E('div', { 'class': 'tr' }, [
						E('div', { 'class': 'td left', 'style': 'width: 240px' }, _('Path')),
						E('div', { 'class': 'td left' }, valueOrDash(configState.path))
					])
				]),
				readFailed ? E('div', {
					'class': 'alert-message warning',
					'style': 'margin: 1em 0;'
				}, configMessage) : '',
				configTextarea(configContent),
				E('div', {
					'class': 'cbi-button-row',
					'style': 'display: flex; flex-wrap: wrap; gap: .5em; margin-top: 1em;'
				}, [
					E('button', {
						'class': 'btn cbi-button cbi-button-action',
						'click': function(ev) {
							ev.preventDefault();
							return validateYaml();
						}
					}, _('Validate')),
					E('button', {
						'class': 'btn cbi-button cbi-button-positive',
						'click': function(ev) {
							ev.preventDefault();
							return saveYaml(false);
						}
					}, _('Save')),
					E('button', {
						'class': 'btn cbi-button cbi-button-action',
						'click': function(ev) {
							ev.preventDefault();
							return saveYaml(true);
						}
					}, _('Save & Restart'))
				]),
				E('div', { 'id': 'oxidns-config-status', 'style': 'margin-top: 1em;' })
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
