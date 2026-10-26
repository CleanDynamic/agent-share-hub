// SV-06: the motion audit's numbers as a markdown table.
//
//   node scripts/sv06-table.mjs before            the before table
//   node scripts/sv06-table.mjs after before      the after table, with the before numbers beside it

import { readFileSync } from "node:fs";

const [stage = "before", against] = process.argv.slice(2);
const read = (name) => JSON.parse(readFileSync(`design/audits/composer/sv-06/${name}.json`, "utf8"));
const now = read(stage);
const was = against ? read(against) : null;
const pct = (value) => `${Math.round(value * 100)}%`;
const cell = (key, value, old) => {
  const shown = key === "largestJump" ? pct(value) : `${value}`;
  if (old === undefined) return shown;
  return `${key === "largestJump" ? pct(old) : old} → ${shown}`;
};

const keys = ["frameGaps", "longTasks", "cancelled", "largestJump", "firstFrameMs"];
const head = ["moment", "frame gaps > 25 ms", "long tasks > 50 ms", "cancelled", "largest one-frame jump", "click to first frame (ms)", "settled (ms)"];
console.log(`| ${head.join(" | ")} |`);
console.log(`| ${head.map(() => "---").join(" | ")} |`);
for (const [name, numbers] of Object.entries(now.moments)) {
  const old = was?.moments[name];
  const cells = keys.map((key) => cell(key, numbers[key], old?.[key]));
  cells.push(old ? `${old.settledMs} → ${numbers.settledMs}` : `${numbers.settledMs}`);
  console.log(`| ${name} | ${cells.join(" | ")} |`);
}
console.log("");
console.log("| import | click to last prompt landed (ms) |");
console.log("| --- | --- |");
for (const [count, ms] of Object.entries(now.imports)) console.log(`| ${count} ${count === "1" ? "prompt" : "prompts"} | ${was ? `${was.imports[count]} → ${ms}` : ms} |`);
