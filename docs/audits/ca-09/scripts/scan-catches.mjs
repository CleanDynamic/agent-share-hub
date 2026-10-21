// CA-09 Part 6: every `catch` in src/ (tests and __audit__ left out), classified by reading the block: does it log
// (console.error/warn), log a code (`.code` or the error object itself), show the user something (toast, setError,
// an error state), rethrow, or nothing at all. Read-only. Writes raw/catches.csv and prints the totals.
// Usage: node docs/audits/ca-09/scripts/scan-catches.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { write } from "./lib.mjs";

const ROOT = path.resolve(new URL("../../../..", import.meta.url).pathname);
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "__audit__" || name === "__snapshots__" || name === "test") continue;
      walk(full);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith(".d.ts")) files.push(full);
  }
};
walk(path.join(ROOT, "src"));

/** The text of the block that starts at `open` ("{"), braces balanced, strings ignored roughly. */
function blockAt(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(open, i + 1);
    }
  }
  return text.slice(open, open + 400);
}

const rows = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file);
  const lineOf = (index) => text.slice(0, index).split("\n").length;
  // try { } catch (e) { … }
  for (const m of text.matchAll(/catch\s*(\(\s*([A-Za-z_$][\w$]*)?[^)]*\))?\s*\{/g)) {
    const block = blockAt(text, m.index + m[0].length - 1);
    rows.push({ file: rel, line: lineOf(m.index), kind: "try", variable: m[2] ?? "", block });
  }
  // promise.catch(() => …) or .catch(fn)
  for (const m of text.matchAll(/\.catch\(\s*(\(?\s*([A-Za-z_$][\w$]*)?\s*\)?\s*=>\s*)?/g)) {
    const start = m.index + m[0].length;
    let body = text.slice(start, start + 300);
    if (body.startsWith("{")) body = blockAt(text, start);
    else body = body.split(/\)\s*[;,\n]/)[0];
    rows.push({ file: rel, line: lineOf(m.index), kind: "promise", variable: m[2] ?? "", block: body });
  }
}

const classify = (r) => {
  const b = r.block;
  const empty = /^\{\s*(\/\*[\s\S]*?\*\/|\/\/[^\n]*\n|\s)*\}$/.test(b.trim()) || /^\s*(\{\s*\}|undefined|null|\(\)\s*=>\s*\{\s*\}|\(\)\s*=>\s*(undefined|null|\[\]|false))\s*$/.test(b) || /^\s*\)\s*$/.test(b);
  const logs = /console\.(error|warn|log)/.test(b);
  const logsCause = logs && (r.variable ? new RegExp(`console\\.(error|warn|log)\\([^)]*\\b${r.variable}\\b`).test(b) : /console\.(error|warn)\([^)]*,/.test(b));
  const logsCode = /\.code\b/.test(b) && logs;
  const user = /toast|setError|setFailed|setStatus\(|setSaveError|onError|Error\(|ErrorState|alert\(/.test(b);
  const rethrows = /\bthrow\b/.test(b);
  // `.catch(failed("…"))`, `.catch(onError)`: handed to a named handler, which this scan does not follow.
  const delegated = r.kind === "promise" && !r.variable && /^\s*[A-Za-z_$][\w$.]*\s*(\(|\)|$)/.test(b) && !/^\s*(undefined|null|false|true)\b/.test(b);
  return { empty: empty && !delegated, logs, logsCause, logsCode, user, rethrows, delegated };
};

let csv = "file,line,kind,empty,logs,logs_the_error,logs_code,user_sees,rethrows,named_handler\n";
const totals = { all: 0, empty: 0, logs: 0, logsCause: 0, logsCode: 0, user: 0, rethrows: 0, delegated: 0, silent: 0, rethrowAndToast: 0 };
for (const r of rows) {
  const c = classify(r);
  totals.all++;
  for (const k of ["empty", "logs", "logsCause", "logsCode", "user", "rethrows", "delegated"]) if (c[k]) totals[k]++;
  if (!c.logs && !c.user && !c.rethrows && !c.delegated) totals.silent++;
  if (c.user && c.rethrows) totals.rethrowAndToast++;
  csv += `${r.file},${r.line},${r.kind},${c.empty},${c.logs},${c.logsCause},${c.logsCode},${c.user},${c.rethrows},${c.delegated}\n`;
}
write("raw/catches.csv", csv);
console.log(JSON.stringify(totals, null, 2));
const byFile = {};
for (const r of rows) {
  const c = classify(r);
  if (!c.logs && !c.user && !c.rethrows && !c.delegated) byFile[r.file] = (byFile[r.file] ?? 0) + 1;
}
console.log("files with the most silent catches:");
for (const [f, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(String(n).padStart(4), f);
