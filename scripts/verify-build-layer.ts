/**
 * NeoScale — build record data layer smoke check (NS-P03)
 *
 * Reads a seeded build back through src/lib/build/ and prints what came out,
 * so the data layer can be proven against a real database before anything
 * renders it.
 *
 * USAGE
 *   node --experimental-strip-types scripts/verify-build-layer.ts [slug]
 *
 * The slug defaults to the one supabase/seeds/ns-demo-build.sql inserts.
 * Seed it first:
 *   psql "$DATABASE_URL" -v creator_id=<profiles.id> \
 *     -f supabase/seeds/ns-demo-build.sql
 *
 * WHY IT BOOTS VITE: src/lib/build/ imports the app's Supabase client, which
 * reads import.meta.env and resolves the "@/" alias. Rather than add a second
 * client or a TypeScript runner as a dependency, the script starts Vite in
 * middleware mode and loads the module through it — same env, same aliases,
 * same code path the browser gets.
 */

import { createServer } from "vite";

const DEFAULT_SLUG = "inbox-triage-agent-demo";

// The Supabase client is built for the browser and reaches for localStorage at
// module scope. Give it somewhere harmless to write before it loads.
if (typeof (globalThis as Record<string, unknown>).localStorage === "undefined") {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
}

type BuildNodeish = {
  id: string;
  type: string;
  title: string | null;
  position: number | null;
  is_gap: boolean;
  children: BuildNodeish[];
};

function printTree(nodes: BuildNodeish[], depth = 0): number {
  let count = 0;
  for (const node of nodes) {
    const indent = "  ".repeat(depth + 1);
    const gap = node.is_gap ? "  [gap]" : "";
    console.log(
      `${indent}${node.position}. ${node.type}${gap} — ${node.title ?? "(untitled)"}`
    );
    count += 1 + printTree(node.children, depth + 1);
  }
  return count;
}

function maxDepth(nodes: BuildNodeish[], depth = 1): number {
  let deepest = nodes.length ? depth : 0;
  for (const node of nodes) {
    deepest = Math.max(deepest, maxDepth(node.children, depth + 1));
  }
  return deepest;
}

const slug = process.argv[2] ?? DEFAULT_SLUG;

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

try {
  const { getBuildBySlug, getEvents } = await server.ssrLoadModule(
    "/src/lib/build/index.ts"
  );
  const record = await getBuildBySlug(slug);

  if (!record) {
    console.error(`No build found for slug "${slug}".`);
    console.error("Seed it with supabase/seeds/ns-demo-build.sql first.");
    process.exitCode = 1;
  } else {
    const { build, tree, tray, events, nodeTypes } = record;

    console.log(`\nBuild   ${build.title}`);
    console.log(`slug    ${build.slug}`);
    console.log(`status  ${build.status}   shape ${build.shape}`);
    console.log(`hero    ${build.hero_node_id ?? "(none)"}`);

    console.log("\nTree (placed nodes only)");
    const placed = printTree(tree as BuildNodeish[]);

    // The seed writes 8 events, one of them hidden. getEvents defaults to
    // excluding hidden, so the composed record carries 7. Both numbers are
    // printed: the second is what a reader sees, the first is what exists.
    const allEvents = await getEvents(build.id, { includeHidden: true });

    console.log(`\ntree nodes    ${placed}`);
    console.log(`tree depth    ${maxDepth(tree as BuildNodeish[])}`);
    console.log(`tray count    ${tray.length}`);
    console.log(`event count   ${allEvents.length}   (all, includeHidden)`);
    console.log(`  visible     ${events.length}   (default — hidden excluded)`);
    console.log(`node types    ${nodeTypes.length}`);

    const hidden = events.filter(
      (e: { visibility: string }) => e.visibility === "hidden"
    );
    if (hidden.length > 0) {
      console.error(
        `\nFAIL: getEvents returned ${hidden.length} hidden event(s) by default.`
      );
      process.exitCode = 1;
    }
  }
} finally {
  await server.close();
}
