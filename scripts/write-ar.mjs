#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [out, ...members] = process.argv.slice(2);

if (!out || members.length === 0) {
	console.error('usage: write-ar.mjs <out.ar> <member>...');
	process.exit(1);
}

function field(value, width) {
	const text = String(value);
	if (Buffer.byteLength(text) > width)
		throw new Error(`ar field too long: ${text}`);
	return text.padEnd(width, ' ');
}

const fd = fs.openSync(out, 'w');

try {
	fs.writeSync(fd, '!<arch>\n');

	for (const member of members) {
		const name = path.basename(member);
		if (Buffer.byteLength(name) > 16)
			throw new Error(`ar member name too long: ${name}`);

		const data = fs.readFileSync(member);
		const stat = fs.statSync(member);
		const header = [
			field(name, 16),
			field(0, 12),
			field(0, 6),
			field(0, 6),
			field((stat.mode & 0o777).toString(8), 8),
			field(data.length, 10),
			'`\n',
		].join('');

		fs.writeSync(fd, header);
		fs.writeSync(fd, data);
		if (data.length % 2 !== 0)
			fs.writeSync(fd, '\n');
	}
} finally {
	fs.closeSync(fd);
}
