#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const dist = arg("--dist", "dist");
const version = arg("--version");
const commit = arg("--commit");
const feedUrl = arg("--feed-url").replace(/\/$/, "");

if (!version || !commit || !feedUrl) {
  console.error("usage: generate-manifest.mjs --dist dist --version vX.Y.Z --commit SHA --feed-url URL");
  process.exit(1);
}

const rustTargets = {
  x86_64: "x86_64-unknown-linux-musl",
  aarch64: "aarch64-unknown-linux-musl",
  i386: "i686-unknown-linux-musl",
  armv7: "arm-unknown-linux-musleabihf"
};

const packages = [];
const sums = [];

for (const file of walk(dist)) {
  if (!file.endsWith(".ipk") && !file.endsWith(".apk")) continue;
  const rel = relative(dist, file).replaceAll("\\", "/");
  const parts = rel.split("/");
  const format = file.endsWith(".ipk") ? "ipk" : "apk";
  const openwrtArch = parts.length > 1 ? parts[1] : "unknown";
  const digest = sha256(file);
  sums.push(`${digest}  ${rel}`);
  packages.push({
    format,
    openwrt_arch: openwrtArch,
    rust_target: rustTargets[openwrtArch] ?? "",
    filename: parts.at(-1),
    url: `${feedUrl}/${rel}`,
    sha256: digest,
    size: statSync(file).size
  });
}

const manifest = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  feed_url: feedUrl,
  oxidns: {
    version,
    commit,
    bundle: "full",
    packages
  },
  luci_app: {
    version: "v0.1.0",
    min_oxidns: version
  }
};

writeFileSync(join(dist, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(join(dist, "latest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(join(dist, "sha256sums.txt"), `${sums.sort().join("\n")}\n`);
