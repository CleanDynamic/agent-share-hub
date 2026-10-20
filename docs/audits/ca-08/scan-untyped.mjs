// CA-08 Part 2, cause 9 — where the compiler cannot warn that a column is missing.
//
//   node docs/audits/ca-08/scan-untyped.mjs
//
// Read-only. Prints (1) every column the two flows name, table by table, that src/integrations/supabase/types.ts does
// not list (types.ts is generated from the live database by Lovable; it was last regenerated on 13 October 2026), and
// (2) every `as unknown as` cast in the files those flows run through. Column lists are read from the source as it
// stands, so the output follows the code; the write keys are listed by hand from the code, each with its file.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../..", import.meta.url).pathname;
const read = (file) => readFileSync(join(ROOT, file), "utf8");

/* ── types.ts: table -> Row columns ── */

const types = read("src/integrations/supabase/types.ts");
const typed = {};
for (const match of types.matchAll(/\n {6}(\w+): \{\n {8}Row: \{([\s\S]*?)\n {8}\}/g)) {
  typed[match[1]] = new Set([...match[2].matchAll(/\n {10}(\w+)\??:/g)].map((m) => m[1]));
}

/* ── the column lists the flows select, read from the code ── */

const constant = (file, name) => {
  const source = read(file);
  const at = source.search(new RegExp(`export const ${name}\\s*=`));
  if (at < 0) throw new Error(`${name} not found in ${file}`);
  const tail = source.slice(at).split(";")[0];
  const literals = [...tail.matchAll(/"([^"]*)"|`([^`]*)`/g)].map((m) => m[1] ?? m[2]);
  return literals.join("");
};
const sessionColumns = (() => {
  const source = read("src/lib/build/sessions.ts");
  const tail = source.slice(source.indexOf("const SESSION_COLUMNS =")).split(";")[0];
  return [...tail.matchAll(/"([^"]*)"/g)].map((m) => m[1]).join("");
})();
const mediaColumns = constant("src/lib/build/media.ts", "MEDIA_COLUMNS");

const columnsOf = (list) =>
  list
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.includes(":") ? item.split(":")[1] : item))
    .map((item) => item.split("->")[0].trim());

const selects = [
  ["builds", constant("src/lib/build/builds.ts", "BUILD_COLUMNS"), "src/lib/build/builds.ts:28 BUILD_COLUMNS (createBuild, getBuildHeader, updateBuild, listDraftBuildsByCreator)"],
  ["builds", "id, session_count", "src/lib/build/drafts.ts:55 listDraftsWithSessions (counts)"],
  ["builds", "made_with, making", "src/lib/build/making.ts:304 readMadeWith (setSessionMeta, addMadeWithTools, getMadeWith)"],
  ["builds", "id", "src/lib/build/sessions.ts:236 countDraftBuilds (the header's Drafts badge)"],
  ["builds", constant("src/lib/build/gallery.ts", "GALLERY_BUILD_COLUMNS"), "src/lib/build/gallery.ts:305 GALLERY_BUILD_COLUMNS (the Gallery, not these flows)"],
  ["build_nodes", constant("src/lib/build/nodes.ts", "NODE_COLUMNS"), "src/lib/build/nodes.ts:15 NODE_COLUMNS"],
  ["build_events", constant("src/lib/build/events.ts", "EVENT_COLUMNS"), "src/lib/build/events.ts:13 EVENT_COLUMNS"],
  ["node_types", constant("src/lib/build/nodeTypes.ts", "NODE_TYPE_COLUMNS"), "src/lib/build/nodeTypes.ts:13 NODE_TYPE_COLUMNS"],
  ["build_media", mediaColumns, "src/lib/build/media.ts:26 MEDIA_COLUMNS"],
  ["build_media", `${mediaColumns}, post_position, post_text`, "src/lib/build/cover.ts:293 POST_MEDIA_COLUMNS"],
  ["import_sessions", `${sessionColumns}, status`, "src/lib/build/sessions.ts:81 SESSION_COLUMNS (+ status, listLibrarySessions)"],
  ["import_sessions", "id, status, build_id", "src/lib/build/sessions.ts:263 attachSession"],
  ["profiles", "colour_swatches", "src/lib/profile/colourSwatches.ts:70 getColourSwatches"],
  [
    "profiles",
    "id, username, display_name, avatar_url, banner_url, bio, website_url, twitter_handle, is_admin, is_creator, is_curator, curator_application_status, account_type, user_interests, follower_count, following_count, joined_at",
    "src/contexts/AuthContext.tsx:46 fetchProfile",
  ],
];

/* ── the keys the flows write, by hand from the code ── */

const writes = [
  ["builds", "creator_id, slug, title, outcome, shape, status, made_for, made_with, live_url, repo_url", "src/lib/build/builds.ts:104 createBuild (insert)"],
  ["builds", "title, outcome, made_for, completeness", "src/pages/site/compose/ComposePage.tsx:153-167, src/hooks/useComposeBuild.ts:269 patchBuild"],
  ["builds", "cost_setup, cost_monthly, time_to_first_result", "src/pages/site/compose/useComposeDetails.ts (edit, the three numbers)"],
  ["builds", "making", "src/lib/build/making.ts:449 setSessionMeta, :345 setMadeWithModel, :417 setSessionTool"],
  ["builds", "made_with", "src/lib/build/making.ts:376 addMadeWithTools, :391 setMadeWithEntry"],
  ["builds", "session_count, prompt_count, ai_turn_count, models_used, making, made_with", "src/lib/build/making.ts:274 refreshMakingStats"],
  ["builds", "post_doc", "src/lib/build/thread.ts:772 saveThread"],
  ["build_nodes", constant("src/lib/build/nodes.ts", "NODE_COLUMNS"), "src/lib/build/nodes.ts:36 upsertNode / :95 reorderNodes (every node the composer writes)"],
  ["import_sessions", "model, updated_at", "src/lib/build/sessions.ts:316 setSessionModel"],
  ["profiles", "colour_swatches", "src/lib/profile/colourSwatches.ts:82 saveColourSwatches"],
];

let missingAny = false;
console.log("== Columns the flows name that types.ts does not list (types.ts = the live schema on 13 Oct) ==");
for (const [label, list] of [
  ["select", selects],
  ["write", writes],
]) {
  for (const [table, columns, where] of list) {
    const known = typed[table];
    const missing = known ? columnsOf(columns).filter((column) => !known.has(column)) : ["(table not in types.ts)"];
    if (missing.length) missingAny = true;
    console.log(`${label.padEnd(6)} ${table.padEnd(15)} ${missing.length ? `MISSING: ${missing.join(", ")}` : "all typed"}  <- ${where}`);
  }
}
if (!missingAny) console.log("(none)");

/* ── every `as unknown as` cast in the files the flows run through ── */

const files = [
  "src/lib/build/builds.ts", "src/lib/build/drafts.ts", "src/lib/build/making.ts", "src/lib/build/sessions.ts", "src/lib/build/nodes.ts",
  "src/lib/build/events.ts", "src/lib/build/nodeTypes.ts", "src/lib/build/media.ts", "src/lib/build/cover.ts", "src/lib/build/composeCover.ts",
  "src/lib/build/thread.ts", "src/lib/build/graph.ts", "src/lib/build/composePrompts.ts", "src/lib/build/composeDetails.ts",
  "src/lib/build/setup.ts", "src/lib/build/gallery.ts", "src/lib/build/imports.ts", "src/lib/build/postMedia.ts",
  "src/lib/profile/colourSwatches.ts", "src/hooks/useComposeBuild.ts", "src/pages/site/compose/SandboxPage.tsx",
  "src/pages/site/compose/ComposePage.tsx", "src/pages/site/compose/useComposePrompts.ts", "src/pages/site/compose/useComposeSessions.ts",
  "src/pages/site/compose/useComposeThread.ts", "src/pages/site/compose/useComposeDetails.ts", "src/pages/site/drafts/DraftsPage.tsx",
];
console.log("\n== `as unknown as` casts in the flows' files ==");
let casts = 0;
for (const file of files) {
  read(file)
    .split("\n")
    .forEach((line, index) => {
      if (!line.includes("as unknown as")) return;
      casts += 1;
      console.log(`${file}:${index + 1}  ${line.trim().slice(0, 150)}`);
    });
}
console.log(`(${casts} casts)`);
