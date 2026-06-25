'use strict';
'require view';
'require rpc';
'require poll';

var callLogsRecent = rpc.declare({
	object: 'luci.oxidns',
	method: 'logs_recent',
	expect: {}
});

var state = {
	lines: [],
	pending: [],
	paused: false,
	source: '-',
	level: 'all',
	search: ''
};

function byId(id) {
	return document.getElementById(id);
}

function levelPasses(line) {
	if (state.level === 'all')
		return true;
	return line.indexOf('[' + state.level + ']') >= 0 || line.indexOf(state.level) >= 0;
}

function searchPasses(line) {
	if (!state.search)
		return true;
	return line.toLowerCase().indexOf(state.search.toLowerCase()) >= 0;
}

function filteredLines() {
	return state.lines.filter(function(line) {
		return levelPasses(line) && searchPasses(line);
	});
}

function renderLines() {
	var log = byId('oxidns-log-lines');
	var count = byId('oxidns-log-count');
	var pending = byId('oxidns-log-pending');
	var source = byId('oxidns-log-source');

	if (log)
		log.textContent = filteredLines().join('\n');
	if (count)
		count.textContent = String(filteredLines().length);
	if (pending)
		pending.textContent = state.pending.length ? _('Pending: %d').format(state.pending.length) : '';
	if (source)
		source.textContent = state.source || '-';
}

function refreshLogs() {
	return L.resolveDefault(callLogsRecent({ limit: 300 }), null).then(function(result) {
		if (!result || result.ok === false)
			return;
		state.source = result.source || '-';
		if (state.paused)
			state.pending = result.lines || [];
		else
			state.lines = result.lines || [];
		renderLines();
	});
}

function setPaused(paused) {
	state.paused = paused;
	if (!paused && state.pending.length) {
		state.lines = state.pending;
		state.pending = [];
	}
	renderLines();
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
		return L.resolveDefault(callLogsRecent({ limit: 300 }), {
			ok: true,
			source: '-',
			lines: []
		});
	},

	render: function(initial) {
		state.lines = initial.lines || [];
		state.source = initial.source || '-';
		poll.add(refreshLogs, 3);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('OxiDNS Logs')),
			E('div', { 'class': 'cbi-map-descr' },
				_('View recent OxiDNS logs. The page prefers OxiDNS API logs and falls back to OpenWrt logread.')),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-button-row' }, [
					controlButton(_('Pause'), function() { setPaused(true); }, 'neutral'),
					' ',
					controlButton(_('Resume'), function() { setPaused(false); }, 'positive'),
					' ',
					controlButton(_('Refresh'), refreshLogs, 'action'),
					' ',
					controlButton(_('Clear'), function() {
						state.lines = [];
						state.pending = [];
						renderLines();
					}, 'negative')
				]),
				E('div', { 'class': 'table cbi-section-table' }, [
					E('div', { 'class': 'tr' }, [
						E('div', { 'class': 'td left', 'style': 'width: 160px' }, _('Source')),
						E('div', { 'class': 'td left', 'id': 'oxidns-log-source' }, state.source)
					]),
					E('div', { 'class': 'tr' }, [
						E('div', { 'class': 'td left' }, _('Entries')),
						E('div', { 'class': 'td left' }, [
							E('span', { 'id': 'oxidns-log-count' }, String(state.lines.length)),
							' ',
							E('span', { 'id': 'oxidns-log-pending' })
						])
					]),
					E('div', { 'class': 'tr' }, [
						E('div', { 'class': 'td left' }, _('Level')),
						E('div', { 'class': 'td left' }, [
							E('select', {
								'class': 'cbi-input-select',
								'change': function(ev) {
									state.level = ev.target.value;
									renderLines();
								}
							}, [
								E('option', { 'value': 'all' }, _('All')),
								E('option', { 'value': 'ERROR' }, 'ERROR'),
								E('option', { 'value': 'WARN' }, 'WARN'),
								E('option', { 'value': 'INFO' }, 'INFO'),
								E('option', { 'value': 'DEBUG' }, 'DEBUG'),
								E('option', { 'value': 'TRACE' }, 'TRACE')
							])
						])
					]),
					E('div', { 'class': 'tr' }, [
						E('div', { 'class': 'td left' }, _('Search')),
						E('div', { 'class': 'td left' }, [
							E('input', {
								'class': 'cbi-input-text',
								'placeholder': _('Filter logs'),
								'input': function(ev) {
									state.search = ev.target.value || '';
									renderLines();
								}
							})
						])
					])
				]),
				E('pre', {
					'id': 'oxidns-log-lines',
					'style': 'min-height: 480px; max-height: 70vh; overflow: auto; padding: 1em; background: #111; color: #ddd; white-space: pre-wrap;'
				}, filteredLines().join('\n'))
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
