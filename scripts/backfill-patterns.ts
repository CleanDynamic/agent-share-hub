/**
 * buildgallery — backfill builds.patterns (CA-13 Part 11)
 *
 * Works out which of the three patterns (router, long-running, structured-output) each PUBLISHED build uses, from the build
 * itself, with the same function the app uses (src/lib/build/patterns.ts), and writes them to builds.patterns.
 *
 * WHAT IT DOES AND DOES NOT DO
 *   - It READS: published and gallery builds (id, making), and each one's placed nodes. Nothing else.
 *   - It WRITES: one UPDATE per build, of the `patterns` column only, and only when the value differs from what is stored.
 *   - It is IDEMPOTENT: a second run finds every build already correct and writes nothing.
 *   - It touches no other column, table, policy or function, and deletes nothing.
 *   - Run it AFTER 20261021140000_ca13_patterns.sql is applied. Without the column it stops at once and changes nothing.
 *   - Builds that are saved afterwards are repaired by refreshMakingStats on their next change: this is for the ones that never are.
 *
 * THE SECRET. Reading and writing every build needs the project's service role key, which is never in the repository:
 *   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  (the key is only named here; it is read from the environment and never logged)
 *
 * USAGE
 *   NEOSCALE_ALLOW_WRITES=1 SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node --experimental-strip-types scripts/backfill-patterns.ts [--dry-run]
 *
 * `--dry-run` reads and reports, and writes nothing.
 *
 * WHY IT BOOTS VITE: src/lib/build imports the app's Supabase client and the "@/" alias; Vite in middleware mode gives the
 * script the same code path the browser gets (as scripts/verify-rebuild.ts does). Only the PURE functions are loaded from it;
 * every database call below goes through the client this script builds itself.
 */

import { createServer } from "vite";

const dry = process.argv.includes("--dry-run");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if ((!dry && process.env.NEOSCALE_ALLOW_WRITES !== "1") || !url || !key) {
  console.error(
    "Refusing to run. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and NEOSCALE_ALLOW_WRITES=1 to write (or pass --dry-run to only read).",
  );
  process.exit(1);
}

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });

try {
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url as string, key as string, { auth: { persistSession: false } });
  const graph = await server.ssrLoadModule("/src/lib/build/graph.ts");
  const making = await server.ssrLoadModule("/src/lib/build/making.ts");
  const patterns = await server.ssrLoadModule("/src/lib/build/patterns.ts");

  // The column must be there: stop before anything is written if it is not.
  const probe = await db.from("builds").select("id, patterns").limit(1);
  if (probe.error) throw new Error(`builds.patterns is not there yet (${probe.error.message}). Apply 20261021140000_ca13_patterns.sql first.`);

  let seen = 0;
  let written = 0;
  let from = 0;
  const PAGE = 100;
  for (;;) {
    const page = await db.from("builds").select("id, making, patterns").in("status", ["published", "gallery"]).order("id").range(from, from + PAGE - 1);
    if (page.error) throw new Error(`could not read builds: ${page.error.message}`);
    const rows = page.data ?? [];
    for (const row of rows) {
      seen += 1;
      const nodes = await db.from("build_nodes").select("*").eq("build_id", row.id).not("position", "is", null).order("position");
      if (nodes.error) throw new Error(`could not read the nodes of ${row.id}: ${nodes.error.message}`);
      // Nest the placed nodes as the app does: children under their parent, by position.
      const byParent = new Map<string | null, any[]>();
      for (const node of nodes.data ?? []) byParent.set(node.parent_id, [...(byParent.get(node.parent_id) ?? []), node]);
      const nest = (parent: string | null): any[] => (byParent.get(parent) ?? []).map((node) => ({ ...node, children: nest(node.id) }));
      const steps = graph.buildSteps(nest(null));
      const record = row.making && typeof row.making === "object" ? row.making : {};
      const groups = graph.sessionGroups(steps, Array.isArray(record.sessions) ? record.sessions : [], record.session_tools ?? {}, making.sessionsMetaOf(record));
      const next: string[] = patterns.buildPatterns(steps, groups);
      const now: string[] = Array.isArray(row.patterns) ? row.patterns : [];
      if (next.join(",") === now.join(",")) continue;
      console.log(`${row.id}: ${now.join(", ") || "none"} -> ${next.join(", ") || "none"}`);
      if (!dry) {
        const update = await db.from("builds").update({ patterns: next }).eq("id", row.id);
        if (update.error) throw new Error(`could not write ${row.id}: ${update.error.message}`);
      }
      written += 1;
    }
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  console.log(`\n${dry ? "Would change" : "Changed"} ${written} of ${seen} published builds.`);
} finally {
  await server.close();
}
