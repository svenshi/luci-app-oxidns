#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [rootDir, outFile] = process.argv.slice(2);

if (!rootDir || !outFile) {
	console.error('usage: write-apk-data-tar.mjs <root-dir> <out.tar>');
	process.exit(1);
}

const blockSize = 512;
const root = path.resolve(rootDir);
const chunks = [];

function padBuffer(buffer) {
	const remainder = buffer.length % blockSize;
	if (remainder !== 0)
		chunks.push(Buffer.alloc(blockSize - remainder));
}

function paxLine(key, value) {
	const body = `${key}=${value}\n`;
	let length = Buffer.byteLength(body) + 3;

	for (;;) {
		const candidate = `${length} ${body}`;
		const actual = Buffer.byteLength(candidate);
		if (actual === length)
			return candidate;
		length = actual;
	}
}

function writeString(buffer, offset, length, value) {
	buffer.fill(0, offset, offset + length);
	Buffer.from(value).copy(buffer, offset, 0, length);
}

function writeOctal(buffer, offset, length, value) {
	const text = value.toString(8).padStart(length - 1, '0');
	writeString(buffer, offset, length, text);
}

function splitName(name) {
	const bytes = Buffer.byteLength(name);
	if (bytes <= 100)
		return { name, prefix: '' };

	const parts = name.split('/');
	for (let i = 1; i < parts.length; i++) {
		const prefix = parts.slice(0, i).join('/');
		const suffix = parts.slice(i).join('/');
		if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(suffix) <= 100)
			return { name: suffix, prefix };
	}

	throw new Error(`tar path too long: ${name}`);
}

function tarHeader({ name, mode, size, type, linkname = '', uname = 'root', gname = 'root', mtime = 0 }) {
	const header = Buffer.alloc(blockSize, 0);
	const split = splitName(name);

	writeString(header, 0, 100, split.name);
	writeOctal(header, 100, 8, mode & 0o7777);
	writeOctal(header, 108, 8, 0);
	writeOctal(header, 116, 8, 0);
	writeOctal(header, 124, 12, size);
	writeOctal(header, 136, 12, mtime);
	header.fill(0x20, 148, 156);
	writeString(header, 156, 1, type);
	writeString(header, 157, 100, linkname);
	writeString(header, 257, 6, 'ustar');
	writeString(header, 263, 2, '00');
	writeString(header, 265, 32, uname);
	writeString(header, 297, 32, gname);
	writeOctal(header, 329, 8, 0);
	writeOctal(header, 337, 8, 0);
	writeString(header, 345, 155, split.prefix);

	let checksum = 0;
	for (const byte of header)
		checksum += byte;

	const checksumText = checksum.toString(8).padStart(6, '0');
	writeString(header, 148, 8, `${checksumText}\0 `);
	return header;
}

function writeEntry(entry) {
	const paxHeaders = {
		ctime: '0',
		atime: '0',
		...entry.pax,
	};
	const paxContent = Object.entries(paxHeaders).map(([key, value]) => paxLine(key, value)).join('');
	const paxData = Buffer.from(paxContent);
	const paxName = `PaxHeaders/${path.basename(entry.name) || 'root'}`;

	chunks.push(tarHeader({
		name: paxName,
		mode: 0o644,
		size: paxData.length,
		type: 'x',
		uname: '',
		gname: '',
	}));
	chunks.push(paxData);
	padBuffer(paxData);

	chunks.push(tarHeader(entry));
	if (entry.data) {
		chunks.push(entry.data);
		padBuffer(entry.data);
	}
}

function collect(dir, base = '') {
	const names = fs.readdirSync(dir).sort();
	const entries = [];

	for (const name of names) {
		const absolute = path.join(dir, name);
		const relative = base ? `${base}/${name}` : name;
		const stat = fs.lstatSync(absolute);

		entries.push({ absolute, relative, stat });
		if (stat.isDirectory())
			entries.push(...collect(absolute, relative));
	}

	return entries;
}

for (const item of collect(root)) {
	if (item.stat.isDirectory()) {
		writeEntry({
			name: item.relative,
			mode: item.stat.mode,
			size: 0,
			type: '5',
			pax: {},
		});
	} else if (item.stat.isFile()) {
		const data = fs.readFileSync(item.absolute);
		const sha1 = crypto.createHash('sha1').update(data).digest('hex');
		writeEntry({
			name: item.relative,
			mode: item.stat.mode,
			size: data.length,
			type: '0',
			data,
			pax: {
				'APK-TOOLS.checksum.SHA1': sha1,
			},
		});
	} else if (item.stat.isSymbolicLink()) {
		const target = fs.readlinkSync(item.absolute);
		const sha1 = crypto.createHash('sha1').update(target).digest('hex');
		writeEntry({
			name: item.relative,
			mode: item.stat.mode,
			size: 0,
			type: '2',
			linkname: target,
			pax: {
				'APK-TOOLS.checksum.SHA1': sha1,
			},
		});
	}
}

chunks.push(Buffer.alloc(blockSize * 2));
fs.writeFileSync(outFile, Buffer.concat(chunks));
