#!/usr/bin/env node

import fs from 'node:fs';

function usage() {
	console.error('Usage: po2lmo.mjs input.po output.lmo');
	process.exit(1);
}

function parsePoString(value) {
	try {
		return JSON.parse(value);
	} catch (err) {
		throw new Error(`invalid PO string ${value}: ${err.message}`);
	}
}

function newEntry() {
	return {
		msgctxt: null,
		msgid: null,
		msgidPlural: null,
		msgstr: []
	};
}

function parsePo(content) {
	const entries = [];
	let entry = newEntry();
	let current = null;
	let currentPlural = 0;

	function hasContent(item) {
		return item.msgctxt !== null || item.msgid !== null || item.msgidPlural !== null || item.msgstr.length > 0;
	}

	function flush() {
		if (hasContent(entry))
			entries.push(entry);
		entry = newEntry();
		current = null;
		currentPlural = 0;
	}

	for (const rawLine of content.split(/\r?\n/)) {
		const line = rawLine.trim();

		if (line === '') {
			flush();
			continue;
		}

		if (line.startsWith('#'))
			continue;

		let match = line.match(/^msgctxt\s+(".*")$/);
		if (match) {
			entry.msgctxt = parsePoString(match[1]);
			current = 'msgctxt';
			continue;
		}

		match = line.match(/^msgid\s+(".*")$/);
		if (match) {
			if (entry.msgid !== null || entry.msgstr.length > 0)
				flush();
			entry.msgid = parsePoString(match[1]);
			current = 'msgid';
			continue;
		}

		match = line.match(/^msgid_plural\s+(".*")$/);
		if (match) {
			entry.msgidPlural = parsePoString(match[1]);
			current = 'msgidPlural';
			continue;
		}

		match = line.match(/^msgstr(?:\[(\d+)])?\s+(".*")$/);
		if (match) {
			currentPlural = Number(match[1] || '0');
			entry.msgstr[currentPlural] = parsePoString(match[2]);
			current = 'msgstr';
			continue;
		}

		match = line.match(/^(".*")$/);
		if (match) {
			const fragment = parsePoString(match[1]);

			if (current === 'msgctxt')
				entry.msgctxt += fragment;
			else if (current === 'msgid')
				entry.msgid += fragment;
			else if (current === 'msgidPlural')
				entry.msgidPlural += fragment;
			else if (current === 'msgstr')
				entry.msgstr[currentPlural] = (entry.msgstr[currentPlural] || '') + fragment;
			else
				throw new Error(`unexpected continued PO string: ${rawLine}`);

			continue;
		}

		throw new Error(`unsupported PO line: ${rawLine}`);
	}

	flush();
	return entries;
}

function add32(value, delta) {
	return (value + delta) >>> 0;
}

function get16(buffer, offset) {
	return (((buffer[offset + 1] || 0) << 8) + (buffer[offset] || 0)) >>> 0;
}

function signedByte(value) {
	return value > 127 ? value - 256 : value;
}

function sfhHash(value) {
	const buffer = Buffer.from(value, 'utf8');
	let len = buffer.length;
	let hash = len >>> 0;
	let offset = 0;
	const rem = len & 3;

	if (len <= 0)
		return 0;

	len >>>= 2;

	for (; len > 0; len--) {
		hash = add32(hash, get16(buffer, offset));
		const tmp = (((get16(buffer, offset + 2) << 11) >>> 0) ^ hash) >>> 0;
		hash = (((hash << 16) >>> 0) ^ tmp) >>> 0;
		offset += 4;
		hash = add32(hash, hash >>> 11);
	}

	switch (rem) {
	case 3:
		hash = add32(hash, get16(buffer, offset));
		hash = (hash ^ ((hash << 16) >>> 0)) >>> 0;
		hash = (hash ^ ((signedByte(buffer[offset + 2]) << 18) >>> 0)) >>> 0;
		hash = add32(hash, hash >>> 11);
		break;
	case 2:
		hash = add32(hash, get16(buffer, offset));
		hash = (hash ^ ((hash << 11) >>> 0)) >>> 0;
		hash = add32(hash, hash >>> 17);
		break;
	case 1:
		hash = add32(hash, signedByte(buffer[offset]));
		hash = (hash ^ ((hash << 10) >>> 0)) >>> 0;
		hash = add32(hash, hash >>> 1);
		break;
	}

	hash = (hash ^ ((hash << 3) >>> 0)) >>> 0;
	hash = add32(hash, hash >>> 5);
	hash = (hash ^ ((hash << 4) >>> 0)) >>> 0;
	hash = add32(hash, hash >>> 17);
	hash = (hash ^ ((hash << 25) >>> 0)) >>> 0;
	hash = add32(hash, hash >>> 6);

	return hash >>> 0;
}

function pluralForms(header) {
	for (const line of header.split('\n')) {
		if (line.toLowerCase().startsWith('plural-forms: '))
			return line.slice(14).trim();
	}

	return '';
}

function writeLmo(entries, outputPath) {
	const chunks = [];
	const index = [];
	let offset = 0;

	function addEntry(key, value, valueCount, keyId) {
		if (!value)
			return;

		const keyHash = keyId ?? sfhHash(key);
		const valueHash = sfhHash(value);
		if (keyHash === valueHash)
			return;

		const data = Buffer.from(value, 'utf8');
		index.push({
			keyId: keyHash >>> 0,
			valueId: valueCount >>> 0,
			offset,
			length: data.length
		});

		chunks.push(data);
		const padding = (4 - (data.length % 4)) % 4;
		if (padding)
			chunks.push(Buffer.alloc(padding));
		offset += data.length + padding;
	}

	for (const entry of entries) {
		if (entry.msgid === '')
			addEntry('', pluralForms(entry.msgstr[0] || ''), 0, 0);
		else if (entry.msgid !== null && entry.msgidPlural !== null) {
			const valueCount = entry.msgstr.length;
			for (let i = 0; i < entry.msgstr.length; i++) {
				const key = entry.msgctxt
					? `${entry.msgctxt}\x01${entry.msgid}\x02${i}`
					: `${entry.msgid}\x02${i}`;
				addEntry(key, entry.msgstr[i], valueCount);
			}
		}
		else if (entry.msgid !== null && entry.msgstr[0])
			addEntry(entry.msgctxt ? `${entry.msgctxt}\x01${entry.msgid}` : entry.msgid, entry.msgstr[0], 1);
	}

	if (index.length === 0) {
		if (fs.existsSync(outputPath))
			fs.unlinkSync(outputPath);
		return;
	}

	index.sort((a, b) => a.keyId - b.keyId);

	const indexBuffer = Buffer.alloc(index.length * 16 + 4);
	for (let i = 0; i < index.length; i++) {
		const base = i * 16;
		indexBuffer.writeUInt32BE(index[i].keyId, base);
		indexBuffer.writeUInt32BE(index[i].valueId, base + 4);
		indexBuffer.writeUInt32BE(index[i].offset, base + 8);
		indexBuffer.writeUInt32BE(index[i].length, base + 12);
	}
	indexBuffer.writeUInt32BE(offset, index.length * 16);

	fs.writeFileSync(outputPath, Buffer.concat([...chunks, indexBuffer]));
}

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath)
	usage();

writeLmo(parsePo(fs.readFileSync(inputPath, 'utf8')), outputPath);
