/* CA-09 audit — the live schema, read from src/integrations/supabase/types.ts.

   Lovable generates types.ts from the live database. On cc6cc8c it was regenerated after `post_threads` and
   `ca06_colour_swatches` were applied (commit "Applied 3 migrations & reg. types"), so it now lists
   builds.post_doc and profiles.colour_swatches. That makes it the best description of the live schema this
   container can have: the stand-in answers 42703 for any column it does not list, as PostgREST would.

   Read-only. Parses the generated file with line rules that match its fixed layout; it is not a TypeScript parser. */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
export const TYPES_PATH = path.resolve(here, "../../../../integrations/supabase/types.ts");

/**
 * @returns {{ tables: Record<string, { columns: string[], relationships: Array<{ name: string, columns: string[], oneToOne: boolean, to: string, toColumns: string[] }> }>, functions: Record<string, { returns: string }> }}
 */
export function readSchema(file = TYPES_PATH) {
  const lines = readFileSync(file, "utf8").split("\n");
  const tables = {};
  const functions = {};
  let section = null; // "Tables" | "Views" | "Functions" | null
  let inPublic = false;
  let current = null; // table name
  let part = null; // "Row" | "Relationships" | null
  let rel = null;
  let fn = null;
  let fnReturns = null;

  for (const line of lines) {
    if (/^  public: \{/.test(line)) inPublic = true;
    else if (/^  [a-z_]+: \{/.test(line)) inPublic = false;
    if (!inPublic) continue;

    const sec = line.match(/^    (Tables|Views|Functions|Enums|CompositeTypes): \{/);
    if (sec) {
      section = sec[1];
      current = null;
      fn = null;
      continue;
    }
    if (section === "Tables" || section === "Views") {
      const t = line.match(/^      ([a-z0-9_]+): \{/);
      if (t) {
        current = t[1];
        tables[current] = { columns: [], relationships: [], view: section === "Views" };
        part = null;
        continue;
      }
      if (!current) continue;
      const p = line.match(/^        (Row|Insert|Update|Relationships): [{[]/);
      if (p) {
        part = p[1];
        continue;
      }
      if (part === "Row") {
        const c = line.match(/^          ([a-z0-9_]+): /);
        if (c) tables[current].columns.push(c[1]);
      }
      if (part === "Relationships") {
        if (/^          \{/.test(line)) rel = { name: "", columns: [], oneToOne: false, to: "", toColumns: [] };
        const k = line.match(/^            (foreignKeyName|columns|isOneToOne|referencedRelation|referencedColumns): (.*)$/);
        if (k && rel) {
          const value = k[2].trim();
          if (k[1] === "foreignKeyName") rel.name = JSON.parse(value);
          if (k[1] === "columns") rel.columns = JSON.parse(value);
          if (k[1] === "isOneToOne") rel.oneToOne = value === "true";
          if (k[1] === "referencedRelation") rel.to = JSON.parse(value);
          if (k[1] === "referencedColumns") rel.toColumns = JSON.parse(value);
        }
        if (/^          \},?$/.test(line) && rel) {
          tables[current].relationships.push(rel);
          rel = null;
        }
      }
    }
    if (section === "Functions") {
      const oneLine = line.match(/^      ([a-z0-9_]+): \{ Args: .*Returns: (.*) \}$/);
      if (oneLine) {
        functions[oneLine[1]] = { returns: oneLine[2] };
        fn = null;
        continue;
      }
      const f = line.match(/^      ([a-z0-9_]+): \{$/) || line.match(/^      ([a-z0-9_]+):$/);
      if (f) {
        fn = f[1];
        fnReturns = null;
        functions[fn] = { returns: "unknown" };
        continue;
      }
      if (fn) {
        const r = line.match(/^        Returns: (.*)$/);
        if (r) {
          fnReturns = r[1].trim();
          functions[fn].returns = fnReturns;
        }
        if (/^          \}\[\]/.test(line) || /^        \}\[\]/.test(line)) functions[fn].returns = "rows";
      }
    }
  }
  return { tables, functions };
}
