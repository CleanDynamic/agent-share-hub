/**
 * NeoScale — rebuild chain smoke check (NS-P37)
 *
 * Drives the whole rebuild mechanic against a real database, in order:
 *
 *   startRebuild        a fork carrying the attribution snapshot
 *   edit one payload    the smallest change there is
 *   changeSet           one changed line, naming the field
 *   rebuildReadiness    the gate opens once something has changed
 *   publishRebuild      the note, then the status
 *   rebuild_count       the source's counter, before and after
 *
 * and then DELETES the rebuild it made, so the counter comes back to where it
 * started and the database is left as it was found. Both directions of the
 * NS-P36 trigger are asserted, which is the half of this that no unit test can
 * reach.
 *
 * THIS SCRIPT WRITES. It creates a build, publishes it — publishing is what
 * makes a record readable to everyone — and then deletes it. Point it at a DEV
 * project. It refuses to run unless every one of these is set, so it cannot be
 * pointed at production by leaving a terminal open in the wrong directory:
 *
 *   NEOSCALE_ALLOW_WRITES=1
 *   NEOSCALE_DEV_EMAIL=...        a user in that project
 *   NEOSCALE_DEV_PASSWORD=...
 *
 * USAGE
 *   NEOSCALE_ALLOW_WRITES=1 NEOSCALE_DEV_EMAIL=... NEOSCALE_DEV_PASSWORD=... \
 *     node --experimental-strip-types scripts/verify-rebuild.ts [slug]
 *
 * The slug defaults to the one supabase/seeds/ns-demo-build.sql inserts. Seed
 * it and sign in as somebody OTHER than its creator if you can: a rebuild of
 * your own build exercises the same code, but a rebuild of someone else's is
 * the case the counter's SECURITY DEFINER right exists for.
 *
 * WHY IT BOOTS VITE: same reason scripts/verify-build-layer.ts does — src/lib/
 * build/ imports the app's Supabase client, which reads import.meta.env and
 * resolves the "@/" alias. Vite in middleware mode gives the script the same
 * env, the same aliases and the same code path the browser gets.
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

interface Field {
  key: string;
  type: string;
}

interface Nodeish {
  id: string;
  type: string;
  title: string | null;
  note: string | null;
  payload: Record<string, unknown> | null;
  parent_id: string | null;
  position: number | null;
  children: Nodeish[];
}

const slug = process.argv[2] ?? DEFAULT_SLUG;
const email = process.env.NEOSCALE_DEV_EMAIL;
const password = process.env.NEOSCALE_DEV_PASSWORD;

if (process.env.NEOSCALE_ALLOW_WRITES !== "1" || !email || !password) {
  console.error(
    "Refusing to run: this script writes to the database it is pointed at.\n" +
      "Set NEOSCALE_ALLOW_WRITES=1, NEOSCALE_DEV_EMAIL and NEOSCALE_DEV_PASSWORD,\n" +
      "and check .env points at a DEV Supabase project."
  );
  process.exit(1);
}

let failures = 0;

function check(label: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures += 1;
}

/** The first placed node carrying a text-ish field, and which field that is. */
function firstEditable(
  nodes: Nodeish[],
  fieldsFor: (type: string) => Field[]
): { node: Nodeish; field: string | null } | null {
  for (const node of nodes) {
    const field = fieldsFor(node.type).find(
      (candidate) => candidate.type === "text" || candidate.type === "string"
    );
    if (field) return { node, field: field.key };
    const inside = firstEditable(node.children, fieldsFor);
    if (inside) return inside;
  }
  return nodes.length > 0 ? { node: nodes[0], field: null } : null;
}

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

let draftId: string | null = null;

try {
  const build = await server.ssrLoadModule("/src/lib/build/index.ts");
  const { supabase } = await server.ssrLoadModule(
    "/src/integrations/supabase/client.ts"
  );

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw new Error(`sign-in failed: ${signInError.message}`);

  const source = await build.getBuildBySlug(slug);
  if (!source) {
    throw new Error(`No build found for slug "${slug}". Seed it first.`);
  }

  const countBefore = source.build.rebuild_count;
  console.log(`\nSource  ${source.build.title}`);
  console.log(`slug    ${source.build.slug}`);
  console.log(`status  ${source.build.status}`);
  console.log(`rebuild_count  ${countBefore}\n`);

  // 1. The fork, with the credit frozen onto it.
  const started = await build.startRebuild({ sourceBuildId: source.build.id });
  draftId = started.id;

  check("startRebuild returns a draft", started.status === "draft", started.status);
  check(
    "source_title_at_fork snapshotted",
    started.source_title_at_fork === source.build.title,
    String(started.source_title_at_fork)
  );
  check(
    "source_handle_at_fork snapshotted",
    started.source_handle_at_fork !== undefined,
    String(started.source_handle_at_fork)
  );
  check(
    "parent_build_id points at the source",
    started.parent_build_id === source.build.id
  );

  // 2. An untouched fork changes nothing, and the gate says so.
  const untouched = await build.getBuild(started.id);
  const noChanges = build.changeSet(source, untouched);
  const closed = build.rebuildReadiness(source, untouched, noChanges);

  check("an untouched fork has an empty change set", build.changeCount(noChanges) === 0);
  check(
    "the gate is closed, with the rebuild reason",
    closed.ready === false && closed.reason === build.NO_CHANGES_REASON,
    closed.reason ?? "(no reason)"
  );

  // 3. One payload field, edited.
  const fieldsFor = (type: string): Field[] =>
    (untouched.nodeTypes.find((entry: { key: string }) => entry.key === type)?.schema
      ?.fields ?? []) as Field[];

  const target = firstEditable(untouched.tree as Nodeish[], fieldsFor);
  if (!target) throw new Error("the fork has no placed nodes to edit");

  const marker = `rebuilt ${new Date().toISOString()}`;
  await build.upsertNode({
    id: target.node.id,
    build_id: started.id,
    parent_id: target.node.parent_id,
    position: target.node.position,
    type: target.node.type,
    title: target.node.title,
    note: target.field ? target.node.note : marker,
    payload: target.field
      ? { ...(target.node.payload ?? {}), [target.field]: marker }
      : (target.node.payload ?? {}),
  });

  const edited = await build.getBuild(started.id);
  const changes = build.changeSet(source, edited);
  const lines = build.serialiseChangeSet(changes);

  console.log("");
  for (const line of lines) console.log(`  [${line.kind}] ${line.text}`);
  console.log("");

  check(
    "one changed node, nothing added or removed",
    changes.changed.length === 1 &&
      changes.added.length === 0 &&
      changes.removed.length === 0,
    `+${changes.added.length} -${changes.removed.length} ~${changes.changed.length}`
  );
  check(
    "the changed field carries a before and an after",
    changes.changed[0]?.fields.length === 1 &&
      changes.changed[0].fields[0].after === marker
  );
  check("one line comes out", lines.length === 1 && lines[0].kind === "changed");
  check(
    "the same input serialises identically twice",
    JSON.stringify(build.serialiseChangeSet(build.changeSet(source, edited))) ===
      JSON.stringify(lines)
  );

  // 4. The gate opens, and the rebuild goes live.
  const open = build.rebuildReadiness(source, edited, changes);
  check("the gate opens on one edit", open.ready === true, open.reason ?? "");

  const published = await build.publishRebuild(
    edited.build,
    "Verification run — this build is deleted at the end of the script."
  );
  check("publishRebuild sets it live", published.status === "published", published.status);
  check("the note is stored", Boolean(published.rebuild_note));

  const afterPublish = await build.getBuildHeader(source.build.id);
  check(
    "the source's rebuild_count went up by one",
    afterPublish?.rebuild_count === countBefore + 1,
    `${countBefore} -> ${afterPublish?.rebuild_count}`
  );

  // 5. Put the database back.
  await build.deleteBuild(started.id);
  draftId = null;

  const afterDelete = await build.getBuildHeader(source.build.id);
  check(
    "deleting the rebuild takes the count back down",
    afterDelete?.rebuild_count === countBefore,
    `${afterPublish?.rebuild_count} -> ${afterDelete?.rebuild_count}`
  );
} catch (error) {
  failures += 1;
  console.error(`\nFAIL  ${error instanceof Error ? error.message : String(error)}`);

  if (draftId) {
    console.error(
      `A draft was left behind: ${draftId}. Delete it before running this again.`
    );
  }
} finally {
  await server.close();
}

console.log(failures === 0 ? "\nPASS" : `\n${failures} check(s) failed`);
process.exitCode = failures === 0 ? 0 : 1;
