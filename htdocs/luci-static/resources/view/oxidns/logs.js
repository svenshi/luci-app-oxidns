'use strict';
'require view';
'require rpc';
'require poll';

var callLogsRecent = rpc.declare({
	object: 'luci.oxidns',
	method: 'logs_recent',
	params: [ 'limit' ],
	expect: {}
});

var state = {
	lines: [],
	pending: [],
	paused: false,
	followTail: true,
	limit: 100
};

function byId(id) {
	return document.getElementById(id);
}

function normalizeLines(result) {
	var lines = result && result.lines;
	return Array.isArray(lines) ? lines : [];
}

function afterPaint(fn) {
	if (window.requestAnimationFrame)
		window.requestAnimationFrame(fn);
	else
		window.setTimeout(fn, 0);
}

function isNearBottom(node) {
	return node.scrollHeight - node.scrollTop - node.clientHeight < 24;
}

function scrollLogToBottom() {
	var log = byId('oxidns-log-lines');
	if (log)
		log.scrollTop = log.scrollHeight;
}

function renderLines() {
	var log = byId('oxidns-log-lines');
	if (!log)
		return;

	var shouldFollow = state.followTail || isNearBottom(log);
	log.textContent = state.lines.join('\n');

	if (shouldFollow) {
		state.followTail = true;
		afterPaint(scrollLogToBottom);
	}
}

function updatePauseButton() {
	var button = byId('oxidns-log-pause-toggle');
	if (!button)
		return;

	button.textContent = state.paused ? _('Resume') : _('Pause');
	button.className = 'btn cbi-button cbi-button-%s'.format(state.paused ? 'positive' : 'neutral');
}

function refreshLogs() {
	return L.resolveDefault(callLogsRecent(state.limit), null).then(function(result) {
		if (!result || result.ok === false)
			return;

		if (state.paused)
			state.pending = normalizeLines(result);
		else
			state.lines = normalizeLines(result);

		renderLines();
	});
}

function setPaused(paused) {
	state.paused = paused;
	if (!paused && state.pending.length) {
		state.lines = state.pending;
		state.pending = [];
	}
	updatePauseButton();
	renderLines();
}

function togglePaused() {
	return setPaused(!state.paused);
}

function controlButton(label, handler, style) {
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
		return Promise.resolve({
			ok: true,
			source: 'logread',
			lines: []
		});
	},

	render: function(initial) {
		state.lines = normalizeLines(initial);
		state.pending = [];
		state.paused = false;
		state.followTail = true;
		window.setTimeout(refreshLogs, 0);
		poll.add(refreshLogs, 1);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('OxiDNS Logs')),
			E('div', { 'class': 'cbi-map-descr' },
				_('View recent OxiDNS entries from OpenWrt logread.')),
			E('div', { 'class': 'cbi-section' }, [
				E('div', {
					'class': 'cbi-button-row',
					'style': 'display: flex; flex-wrap: wrap; gap: .5em; margin-bottom: 1.5em;'
				}, [
					E('button', {
						'id': 'oxidns-log-pause-toggle',
						'class': 'btn cbi-button cbi-button-neutral',
						'click': function(ev) {
							ev.preventDefault();
							return togglePaused();
						}
					}, _('Pause')),
					controlButton(_('Refresh'), refreshLogs, 'action'),
					controlButton(_('Clear'), function() {
						state.lines = [];
						state.pending = [];
						state.followTail = true;
						renderLines();
					}, 'negative')
				]),
				E('pre', {
					'id': 'oxidns-log-lines',
					'scroll': function(ev) {
						state.followTail = isNearBottom(ev.target);
					},
					'style': 'min-height: 560px; max-height: 72vh; overflow: auto; margin-top: .25em; padding: 1em; background: #111; color: #ddd; white-space: pre-wrap; overflow-wrap: anywhere;'
				}, state.lines.join('\n'))
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
