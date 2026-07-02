#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

function usage() {
	console.error('usage: write-ar-archive.mjs <out.ar> <member-name=path>...');
	process.exit(1);
}

const [, , outPath, ...memberSpecs] = process.argv;
if (!outPath || memberSpecs.length === 0)
	usage();

const chunks = [ Buffer.from('!<arch>\n', 'ascii') ];

for (const spec of memberSpecs) {
	const sep = spec.indexOf('=');
	const memberName = sep >= 0 ? spec.slice(0, sep) : path.basename(spec);
	const sourcePath = sep >= 0 ? spec.slice(sep + 1) : spec;

	if (!memberName || memberName.length > 16 || /[\/\s]/.test(memberName)) {
		console.error(`unsupported ar member name: ${memberName}`);
		process.exit(1);
	}

	const data = fs.readFileSync(sourcePath);
	const header = [
		memberName.padEnd(16, ' '),
		'0'.padEnd(12, ' '),
		'0'.padEnd(6, ' '),
		'0'.padEnd(6, ' '),
		'100644'.padEnd(8, ' '),
		String(data.length).padEnd(10, ' '),
		'`\n'
	].join('');

	chunks.push(Buffer.from(header, 'ascii'), data);

	if (data.length % 2 === 1)
		chunks.push(Buffer.from('\n', 'ascii'));
}

fs.writeFileSync(outPath, Buffer.concat(chunks));
