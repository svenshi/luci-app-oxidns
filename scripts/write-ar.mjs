#!/usr/bin/env node

import { basename } from "node:path";
import { readFileSync, statSync, writeFileSync } from "node:fs";

const [out, ...members] = process.argv.slice(2);

if (!out || members.length === 0) {
  console.error("usage: write-ar.mjs <out> <member>...");
  process.exit(1);
}

function field(value, width) {
  const text = String(value);
  if (text.length > width) {
    throw new Error(`ar field too long: ${text}`);
  }
  return text.padEnd(width, " ");
}

const chunks = [Buffer.from("!<arch>\n")];

for (const member of members) {
  const name = `${basename(member)}/`;
  if (name.length > 16) {
    throw new Error(`ar member name too long: ${name}`);
  }
  const stat = statSync(member);
  const data = readFileSync(member);
  const header =
    field(name, 16) +
    field(Math.floor(stat.mtimeMs / 1000), 12) +
    field(0, 6) +
    field(0, 6) +
    field("100644", 8) +
    field(data.length, 10) +
    "`\n";
  chunks.push(Buffer.from(header));
  chunks.push(data);
  if (data.length % 2 !== 0) {
    chunks.push(Buffer.from("\n"));
  }
}

writeFileSync(out, Buffer.concat(chunks));
