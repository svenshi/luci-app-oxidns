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

var callCoreProgress = rpc.declare({
	object: 'luci.oxidns',
	method: 'core_progress',
	expect: {}
});

var callCoreRemove = rpc.declare({
	object: 'luci.oxidns',
	method: 'core_remove',
	params: [ 'remove_config', 'remove_workdir' ],
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
		refreshActionButtons();
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

function coreErrorStageLabel(stage) {
	var labels = {
		prepare_download: _('Prepare download'),
		download_metadata: _('Download release metadata'),
		select_release_asset: _('Select release archive'),
		verify_release_digest: _('Verify release digest'),
		download_archive: _('Download core archive'),
		verify_checksum: _('Verify checksum'),
		validate_archive: _('Validate core archive'),
		unpack_archive: _('Unpack core archive'),
		install_files: _('Install core files'),
		restart_service: _('Restart service'),
		validate_uploaded_core: _('Validate uploaded core')
	};

	return labels[stage] || stage || '-';
}

function errorDetailLine(label, value, extraClass) {
	if (value === null || value === undefined || value === '')
		return null;

	return E('div', { 'class': extraClass || '' }, [
		E('strong', {}, [ label + ': ' ]),
		value
	]);
}

function renderCoreError(result) {
	var message = (result && (result.message || result.error)) || _('Core operation failed');
	var detail = result && (result.detail || result.details);
	var children = [
		E('p', {}, E('strong', {}, _('Core operation failed')))
	];

	if (result && result.stage)
		children.push(errorDetailLine(_('Stage'), coreErrorStageLabel(result.stage)));
	children.push(errorDetailLine(_('Reason'), message));
	if (detail)
		children.push(errorDetailLine(_('Details'), detail, 'small'));
	if (result && result.code)
		children.push(errorDetailLine(_('Error code'), result.code, 'small'));

	return E('div', {}, children);
}

function replaceContent(node, content) {
	if (!node)
		return;

	while (node.firstChild)
		node.removeChild(node.firstChild);

	if (content === null || content === undefined)
		return;

	if (Array.isArray(content)) {
		for (var i = 0; i < content.length; i++)
			node.appendChild(content[i]);
	} else if (content.nodeType) {
		node.appendChild(content);
	} else {
		node.textContent = String(content);
	}
}

function scrollProgressLog(logNode) {
	if (logNode)
		logNode.scrollTop = logNode.scrollHeight;
}

function showCoreProgressModal(label) {
	var statusNode = E('p', { 'id': 'oxidns-core-progress-status' }, label);
	var logNode = E('pre', {
		'id': 'oxidns-core-progress-log',
		'style': [
			'box-sizing: border-box',
			'width: 100%',
			'min-height: 18em',
			'max-height: 44vh',
			'overflow: auto',
			'padding: 1em',
			'border: 1px solid #ccc',
			'background: #111',
			'color: #eee',
			'white-space: pre-wrap',
			'font-family: monospace',
			'font-size: 12px',
			'line-height: 1.45'
		].join(';')
	}, _('Waiting for command output...'));
	var resultNode = E('div', { 'id': 'oxidns-core-progress-result' });
	var closeButton = E('button', {
		'class': 'btn cbi-button cbi-button-neutral',
		'disabled': 'disabled',
		'click': function(ev) {
			ev.preventDefault();
			ui.hideModal();
		}
	}, _('Close'));

	ui.showModal(_('OxiDNS'), [
		statusNode,
		E('div', { 'class': 'cbi-value-title', 'style': 'margin-bottom: .35em;' }, _('Command output')),
		logNode,
		resultNode,
		E('div', { 'class': 'right', 'style': 'margin-top: 1em;' }, closeButton)
	]);

	return {
		status: statusNode,
		log: logNode,
		result: resultNode,
		closeButton: closeButton
	};
}

function setCoreProgressFinished(nodes, statusText, resultContent) {
	if (nodes && nodes.status)
		nodes.status.textContent = statusText;
	if (nodes && nodes.result)
		replaceContent(nodes.result, resultContent);
	if (nodes && nodes.closeButton) {
		nodes.closeButton.disabled = false;
		nodes.closeButton.removeAttribute('disabled');
	}
}

function refreshCoreProgressLog(logNode) {
	return L.resolveDefault(callCoreProgress(), null).then(function(result) {
		if (!result || result.ok === false)
			return;

		logNode.textContent = result.text || _('Waiting for command output...');
		scrollProgressLog(logNode);
	});
}

function startCoreProgressPolling(logNode) {
	var timer = null;
	var stopped = false;

	var tick = function() {
		if (stopped)
			return Promise.resolve();
		return refreshCoreProgressLog(logNode);
	};

	timer = window.setInterval(tick, 1000);
	window.setTimeout(tick, 500);

	return {
		stop: function() {
			stopped = true;
			if (timer !== null)
				window.clearInterval(timer);
		},
		refresh: function() {
			return refreshCoreProgressLog(logNode);
		}
	};
}

function runCoreAction(label, call, timeout) {
	var nodes = showCoreProgressModal(label);
	var progress = startCoreProgressPolling(nodes.log);

	return L.resolveDefault(callWithRpcTimeout(call, timeout), null).then(function(result) {
		progress.stop();
		if (!result || result.ok === false) {
			return progress.refresh().then(function() {
				setCoreProgressFinished(nodes, _('Core operation failed'), renderCoreError(result || {}));
			});
		}

		return progress.refresh().then(function() {
			return L.resolveDefault(refreshStatus(), null).then(function() {
				setCoreProgressFinished(nodes, _('Core operation completed.'), E('p', {}, _('Core operation completed.')));
				ui.addNotification(null, E('p', {}, _('Core operation completed.')), 'info');
			});
		});
	}).catch(function(err) {
		progress.stop();
		return progress.refresh().then(function() {
			var errorResult = {
				message: (err && err.message) || String(err)
			};
			ui.addNotification(null, renderCoreError(errorResult), 'danger');
			setCoreProgressFinished(nodes, _('Core operation failed'), renderCoreError(errorResult));
		});
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

function checked(id) {
	var node = document.getElementById(id);
	return !!(node && node.checked);
}

function handleRemove() {
	return new Promise(function(resolve) {
		var configPath = statusState.config_path || '-';
		var workingDir = statusState.working_dir || '-';

		ui.showModal(_('Remove OxiDNS Core'), [
			E('p', {}, _('Remove the OxiDNS core binary and Web UI files.')),
			E('p', { 'class': 'cbi-section-descr' },
				_('Configuration and working directory data are preserved unless selected below.')),
			E('div', { 'class': 'cbi-section' }, [
				E('label', { 'class': 'cbi-value' }, [
					E('input', {
						'id': 'oxidns-remove-config',
						'type': 'checkbox',
						'style': 'margin-right: .5em;'
					}),
					_('Delete configuration file'),
					E('div', { 'class': 'cbi-value-description' }, configPath)
				]),
				E('label', { 'class': 'cbi-value' }, [
					E('input', {
						'id': 'oxidns-remove-workdir',
						'type': 'checkbox',
						'style': 'margin-right: .5em;'
					}),
					_('Delete working directory'),
					E('div', { 'class': 'cbi-value-description' }, workingDir)
				])
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-neutral',
					'click': function(ev) {
						ev.preventDefault();
						ui.hideModal();
						resolve();
					}
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-negative',
					'click': function(ev) {
						ev.preventDefault();
						var removeConfig = checked('oxidns-remove-config');
						var removeWorkdir = checked('oxidns-remove-workdir');
						ui.hideModal();
						resolve(runCoreAction(_('Removing OxiDNS core...'), function() {
							return callCoreRemove(removeConfig, removeWorkdir);
						}));
					}
				}, _('Confirm'))
			])
		]);
	});
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

function refreshActionButtons() {
	var node = document.getElementById('oxidns-core-actions');
	if (node)
		replaceContent(node, actionButtons(statusState));
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
					'id': 'oxidns-core-actions',
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
