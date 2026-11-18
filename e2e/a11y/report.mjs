// G25 to G27: the suite's table from test-results/a11y/*.json. `node e2e/a11y/report.mjs` prints Markdown.
//   Page × theme × width: the axe count (findings not on the allow list), the Tab walk's result, and the rules seen.
//   Reflow at 320: the page's width and the widest element.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../test-results/a11y");
const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith(".json")) : [];
const read = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));

// Only the page runs: zoom-, spacing- and ring- files written by the other specs have no axe field.
const runs = files.filter((f) => !f.startsWith("reflow-")).map(read).filter((r) => Array.isArray(r.axe) && r.walk);
const reflow = files.filter((f) => f.startsWith("reflow-")).map(read);

const cols = [["light", 1440], ["dark", 1440], ["light", 390], ["dark", 390]];
const pages = [...new Set(runs.map((r) => r.page))];
const cell = (r) => {
  if (!r) return "not run";
  const axe = r.axe.filter((a) => !a.allowed).length;
  const walk = r.walk.failures.length === 0 ? `ok (${r.walk.stops}, ${r.walk.ended})` : `${r.walk.failures.length} fail`;
  return `${r.boundary ? "CRASH · " : ""}axe ${axe} · Tab ${walk}`;
};

const out = [];
out.push("| Page | State | light 1440 | dark 1440 | light 390 | dark 390 | Rules |", "|---|---|---|---|---|---|---|");
for (const name of pages) {
  const mine = runs.filter((r) => r.page === name);
  const rules = new Map();
  for (const r of mine) for (const a of r.axe.filter((x) => !x.allowed)) rules.set(a.rule, (rules.get(a.rule) ?? 0) + 1);
  const row = cols.map(([theme, width]) => cell(mine.find((r) => r.theme === theme && r.width === width)));
  out.push(`| ${name} | ${mine[0]?.state ?? ""} | ${row.join(" | ")} | ${[...rules].map(([k, v]) => `${k} ${v}`).join(", ")} |`);
}
const total = runs.reduce((n, r) => n + r.axe.filter((a) => !a.allowed).length, 0);
const walkFails = runs.filter((r) => r.walk.failures.length).length;
out.push("", `Runs: ${runs.length}. Axe findings not allowed: ${total}. Runs with a Tab walk failure: ${walkFails}. Crashed: ${runs.filter((r) => r.boundary).length}.`);

out.push("", "| Reflow at 320 | Width | Widest |", "|---|---|---|");
for (const r of reflow) out.push(`| ${r.page} | ${r.width} | ${r.width > 320 ? r.widest.join("; ") : ""} |`);

const walkDetail = runs.filter((r) => r.walk.failures.length).map((r) => `- ${r.page} · ${r.theme} · ${r.width}: ${r.walk.failures.slice(0, 4).join(" | ")}${r.walk.failures.length > 4 ? ` (+${r.walk.failures.length - 4})` : ""}`);
if (walkDetail.length) out.push("", "Tab walk failures:", ...walkDetail);
console.log(out.join("\n"));
