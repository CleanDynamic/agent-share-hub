// G29: the table, from test-results/pagestate/*.json. `node e2e/pagestate/report.mjs` prints Markdown.
import fs from "node:fs";
import path from "node:path";

const DIR = path.resolve("test-results/pagestate");
/** G29's limit, and the margin inside which a cell is reported as too close to it. */
const LIMIT_S = 14;
const CLOSE_S = 0.5;
const CONDITIONS = ["aborted", "server-error", "never", "refused", "empty"];
const rows = new Map();
for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith(".json"))) {
  const r = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
  if (!rows.has(r.page)) rows.set(r.page, { legacy: r.legacy, cells: {} });
  rows.get(r.page).cells[r.condition] = r;
}

const ok = (r) =>
  r.settledSeconds !== null && r.expected.includes(r.state) && (r.busy === 0 || r.state === "signedout") && r.title !== null && r.codes.length === 0 && r.retryLabels.every((l) => l === "Try again");

const cell = (r) => {
  if (!r) return "–";
  const time = r.settledSeconds === null ? `>${LIMIT_S}` : `${r.settledSeconds}`;
  const flags = [];
  if (!r.expected.includes(r.state)) flags.push(`want ${r.expected.join("/")}`);
  // G18: under the sign-in dialog the held skeletons are busy by design (the test exempts them the same way).
  if (r.busy && r.state !== "signedout") flags.push("busy");
  if (r.settledSeconds !== null && r.settledSeconds >= LIMIT_S - CLOSE_S) flags.push("CLOSE TO THE LIMIT");
  if (r.title === null) flags.push("no title");
  if (r.codes.length) flags.push(`code ${r.codes.join(" ")}`);
  const bad = r.retryLabels.filter((l) => l !== "Try again");
  if (bad.length) flags.push(`"${bad.join('", "')}"`);
  return `${ok(r) ? "✅" : "❌"} ${r.state} ${time}s${flags.length ? ` (${flags.join("; ")})` : ""}`;
};

console.log(`| Page | ${CONDITIONS.join(" | ")} |`);
console.log(`|---|${CONDITIONS.map(() => "---").join("|")}|`);
let pass = 0;
let total = 0;
for (const [page, { legacy, cells }] of rows) {
  for (const c of CONDITIONS) if (cells[c]) { total += 1; if (ok(cells[c])) pass += 1; }
  console.log(`| ${page}${legacy ? " (legacy)" : ""} | ${CONDITIONS.map((c) => cell(cells[c])).join(" | ")} |`);
}
console.log(`\n${pass} of ${total} cells pass.`);
if (process.argv.includes("--lines")) {
  for (const [page, { cells }] of rows) for (const c of CONDITIONS) if (cells[c]?.lines?.length) console.log(`${page} / ${c}: ${cells[c].lines.join(" ‖ ")}${cells[c].title ? ` [title: ${cells[c].title}]` : ""}`);
}
