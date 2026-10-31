// SV-26 P6: the download budgets. Reads the built `dist/` and fails when
//   - the first download (index.html's scripts, preloads and styles, gzipped, signed out on `/`) is over 200 KB, or
//   - the composer's own chunk (SandboxPage-*.js, gzipped) is over 120 KB.
// KB here is 1000 bytes, as `vite build` prints it. Run after `vite build` (npm run audit:pages does).

import fs from "node:fs";
import zlib from "node:zlib";

const DIST = process.argv[2] ?? "dist";
const FIRST_MAX = 200 * 1000;
const COMPOSER_MAX = 120 * 1000;

const gz = (file) => zlib.gzipSync(fs.readFileSync(file)).length;
const html = fs.readFileSync(`${DIST}/index.html`, "utf8");
const files = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]))];
const first = files.reduce((sum, f) => sum + gz(`${DIST}${f}`), 0);
const composerFile = fs.readdirSync(`${DIST}/assets`).find((f) => /^SandboxPage-.*\.js$/.test(f));
const composer = composerFile ? gz(`${DIST}/assets/${composerFile}`) : 0;

const kb = (n) => (n / 1000).toFixed(1);
console.log(`first download ${kb(first)} KB (budget ${kb(FIRST_MAX)}), ${files.length} files`);
console.log(`composer chunk ${kb(composer)} KB (budget ${kb(COMPOSER_MAX)})${composerFile ? "" : " NOT FOUND"}`);

const failures = [];
if (first > FIRST_MAX) failures.push(`the first download is ${kb(first)} KB, over ${kb(FIRST_MAX)} KB`);
if (!composerFile) failures.push("the composer's chunk (SandboxPage-*.js) is not in dist");
else if (composer > COMPOSER_MAX) failures.push(`the composer's chunk is ${kb(composer)} KB, over ${kb(COMPOSER_MAX)} KB`);
if (failures.length) {
  console.error(`SIZE BUDGET FAILED: ${failures.join("; ")}`);
  process.exit(1);
}
