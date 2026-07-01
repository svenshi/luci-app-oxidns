#!/usr/bin/env node

import fs from 'node:fs';

const [input, output] = process.argv.slice(2);

if (!input || !output) {
	console.error('usage: strip-tar-eof.mjs <input.tar> <output.tar>');
	process.exit(1);
}

const blockSize = 512;
const data = fs.readFileSync(input);
let end = data.length;

function isZeroBlock(offset) {
	for (let i = offset; i < offset + blockSize; i++) {
		if (data[i] !== 0)
			return false;
	}

	return true;
}

while (end >= blockSize && isZeroBlock(end - blockSize))
	end -= blockSize;

fs.writeFileSync(output, data.subarray(0, end));
