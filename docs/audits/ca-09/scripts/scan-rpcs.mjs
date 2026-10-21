// CA-09 Part 6: every RPC the front end calls, against types.ts (the live schema as Lovable last generated it) and
// the newest migration that defines it; and every table the front end reads, against types.ts. Read-only.
// Writes raw/rpcs.csv and raw/tables-missing.csv. Usage: node docs/audits/ca-09/scripts/scan-rpcs.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { write } from "./lib.mjs";
import { readSchema } from "../../../../src/lib/build/__audit__/ca09/schema.mjs";

const ROOT = path.resolve(new URL("../../../..", import.meta.url).pathname);
const schema = readSchema();
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (["__audit__", "__snapshots__", "test", "integrations"].includes(name)) continue;
      walk(full);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(full);
  }
};
walk(path.join(ROOT, "src"));

const migrations = readdirSync(path.join(ROOT, "supabase/migrations")).sort();
const definedIn = (fn) => {
  let last = null;
  for (const m of migrations) {
    const text = readFileSync(path.join(ROOT, "supabase/migrations", m), "utf8");
    if (new RegExp(`create\\s+(or\\s+replace\\s+)?function\\s+(public\\.)?"?${fn}"?\\s*\\(`, "i").test(text)) last = m;
  }
  return last;
};
/** The argument names of the newest definition. */
const argsIn = (fn, file) => {
  if (!file) return [];
  const text = readFileSync(path.join(ROOT, "supabase/migrations", file), "utf8");
  const all = [...text.matchAll(new RegExp(`create\\s+(?:or\\s+replace\\s+)?function\\s+(?:public\\.)?"?${fn}"?\\s*\\(([^)]*)\\)`, "gi"))];
  const last = all[all.length - 1]?.[1] ?? "";
  return last.split(",").map((a) => a.trim().split(/\s+/)[0]).filter(Boolean);
};

// Every function any migration creates, so an RPC called through a cast wrapper (`(supabase.rpc as …)("top_solvers",
// …)`) is found by its name as well as by `.rpc("…")`.
const allFunctions = new Set(Object.keys(schema.functions));
for (const m of migrations) {
  const text = readFileSync(path.join(ROOT, "supabase/migrations", m), "utf8");
  for (const f of text.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?([a-z0-9_]+)"?\s*\(/gi)) allFunctions.add(f[1].toLowerCase());
}
const calls = new Map();
const tables = new Map();
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file);
  for (const m of text.matchAll(/\.rpc\(\s*["'`]([a-z0-9_]+)["'`]\s*(,\s*\{([^}]*)\})?/g)) {
    const keys = (m[3] ?? "").split(",").map((p) => p.split(":")[0].trim()).filter((k) => /^[a-z_0-9]+$/.test(k));
    const entry = calls.get(m[1]) ?? { sites: [], keys: new Set() };
    entry.sites.push(`${rel}:${text.slice(0, m.index).split("\n").length}`);
    keys.forEach((k) => entry.keys.add(k));
    calls.set(m[1], entry);
  }
  if (/\brpc\b/.test(text)) {
    for (const m of text.matchAll(/\)\s*\(\s*["'`]([a-z0-9_]+)["'`]/g)) {
      if (!allFunctions.has(m[1])) continue;
      const entry = calls.get(m[1]) ?? { sites: [], keys: new Set() };
      entry.sites.push(`${rel}:${text.slice(0, m.index).split("\n").length}`);
      calls.set(m[1], entry);
    }
  }
  for (const m of text.matchAll(/\.from\(\s*["'`]([a-z0-9_]+)["'`]\s*\)/g)) {
    if (/storage\s*\.\s*$/.test(text.slice(Math.max(0, m.index - 20), m.index))) continue;
    const entry = tables.get(m[1]) ?? [];
    entry.push(`${rel}:${text.slice(0, m.index).split("\n").length}`);
    tables.set(m[1], entry);
  }
}

let csv = "rpc,in_types_ts,newest_migration,args_sent,args_in_migration,mismatch,call_sites\n";
for (const [fn, { sites, keys }] of [...calls].sort()) {
  const inTypes = Boolean(schema.functions[fn]);
  const mig = definedIn(fn);
  const args = argsIn(fn, mig);
  const sent = [...keys];
  const mismatch = sent.filter((k) => args.length && !args.includes(k));
  csv += `${fn},${inTypes},${mig ?? "none"},${sent.join(" ")},${args.join(" ")},${mismatch.join(" ")},${sites.join(" ")}\n`;
  console.log(`${fn.padEnd(32)} types.ts:${inTypes ? "yes" : "NO "}  migration:${mig ?? "none"}  sent:[${sent.join(",")}]${mismatch.length ? "  MISMATCH " + mismatch : ""}  (${sites.length} call sites)`);
}
write("raw/rpcs.csv", csv);

let missing = "table,call_sites\n";
console.log("\ntables read by src/ that types.ts (the live schema) does not have:");
for (const [t, sites] of [...tables].sort()) {
  if (schema.tables[t]) continue;
  missing += `${t},${sites.join(" ")}\n`;
  console.log(`  ${t.padEnd(28)} ${sites.length} call sites, e.g. ${sites[0]}`);
}
write("raw/tables-missing.csv", missing);
