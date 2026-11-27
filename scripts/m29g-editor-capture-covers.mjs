#!/usr/bin/env node
// Mobile 29g: list published builds whose cover may be a capture of the OpenBuilds editor, for the owner to look at and clear.
//
// READS ONLY. It writes nothing. For each build it flags, it prints the build's link, the picture's link (signed for an hour) and
// the SQL that takes the picture out of the build's cover, to run by hand once the picture has been looked at.
//
// WHY A LIST AND NOT A FIX. Nothing in the app renders the editor into a picture. An editor capture reaches a cover in two ways:
//   1. the card's fallback (`resolveCover` in src/lib/build/cover.ts): a build with no chosen picture leads with its hero node's
//      or its first evidence node's media, and an imported session's evidence is what the harness captured while the maker
//      worked, which on this site is often the OpenBuilds editor itself. The phone no longer falls back (29g, `chosenCover`).
//   2. a maker put a screenshot of the editor into their own post. Only the owner can judge that.
// So each picture that stands as a cover is checked for the signs of a capture, and the owner looks.
//
// THE SIGNS (any one flags the picture):
//   session   the picture belongs to a node an import brought (build_nodes.source_ref is set) or to a File node attached
//             to a prompt: it was captured in a session, not chosen as the work.
//   name      the file name says screenshot or capture ("Screenshot", "Screen Shot", "CleanShot", "capture", "image.png").
//   window    the picture has a desktop browser window's shape: at least 1200 wide and between 1.45 and 1.85 times as wide
//             as tall (1440 x 900, 1920 x 1080, 2880 x 1800 and the like).
//
// RUN (the owner; needs the service role key, which reads every build):
//   SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/m29g-editor-capture-covers.mjs
//   Add --json for machine-readable output, --site https://openbuilds.ai for the build links.

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. This script reads every published build and writes nothing.");
  process.exit(1);
}
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const siteAt = args.indexOf("--site");
const site = (siteAt >= 0 ? args[siteAt + 1] : "https://openbuilds.ai").replace(/\/$/, "");

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const PAGE = 200;
const EVIDENCE = new Set(["comparison_table", "eval_run", "recording", "result", "screenshot"]);
const CAPTURE_NAME = /screen ?shot|screenshot|cleanshot|capture|^image\.(png|jpe?g)$/i;

const mediaIdOf = (payload) => {
  if (!payload || typeof payload !== "object") return null;
  if (typeof payload.media_id === "string" && payload.media_id.trim()) return payload.media_id.trim();
  if (Array.isArray(payload.variants)) {
    const chosen = payload.variants.find((v) => v && v.chosen === true) ?? payload.variants[0];
    if (chosen && typeof chosen.media_id === "string") return chosen.media_id;
  }
  return null;
};

/** The picture that stands for the build, as resolveCover walks it, and whether the maker chose it. */
function coverOf(build, nodes, media) {
  const byId = (id) => media.find((row) => row.id === id) ?? null;
  const set = media.find((row) => row.post_position === 0);
  if (set) return { row: set, chosen: true };
  const picked = build.cover_media_id ? byId(build.cover_media_id) : null;
  if (picked) return { row: picked, chosen: true };
  if (build.hero_node_id) {
    const hero = byId(mediaIdOf(nodes.find((node) => node.id === build.hero_node_id)?.payload));
    if (hero) return { row: hero, chosen: false };
  }
  const ordered = [...nodes].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  for (const node of ordered) {
    if (node.is_gap || !EVIDENCE.has(node.type)) continue;
    const row = media.find((m) => m.node_id === node.id) ?? byId(mediaIdOf(node.payload));
    if (row) return { row, chosen: false };
  }
  return null;
}

function signsOf(row, nodes) {
  const signs = [];
  const node = row.node_id ? nodes.find((n) => n.id === row.node_id) : null;
  if (node && (node.source_ref || node.type === "file")) signs.push("session");
  if (row.filename && CAPTURE_NAME.test(row.filename.trim())) signs.push("name");
  if (row.width && row.height && row.width >= 1200) {
    const ratio = row.width / row.height;
    if (ratio >= 1.45 && ratio <= 1.85) signs.push("window");
  }
  return signs;
}

const found = [];
for (let from = 0; ; from += PAGE) {
  const { data, error } = await db
    .from("builds")
    .select(
      "id, slug, title, cover_media_id, hero_node_id, maker:profiles!builds_creator_id_fkey(username), " +
        "build_nodes!build_nodes_build_id_fkey(id, type, payload, position, is_gap, source_ref), " +
        "build_media!build_media_build_id_fkey(id, node_id, bucket, path, filename, width, height, kind, post_position)",
    )
    .in("status", ["published", "gallery"])
    .order("published_at", { ascending: false })
    .range(from, from + PAGE - 1);
  if (error) {
    console.error(`Reading builds failed: ${error.message}`);
    process.exit(1);
  }
  for (const build of data ?? []) {
    const nodes = build.build_nodes ?? [];
    const media = (build.build_media ?? []).filter((row) => row.kind === "image");
    const cover = coverOf(build, nodes, media);
    if (!cover) continue;
    const signs = signsOf(cover.row, nodes);
    if (signs.length === 0) continue;
    const signed = await db.storage.from(cover.row.bucket).createSignedUrl(cover.row.path, 3600);
    found.push({
      build: `${site}/b2/${build.slug}`,
      title: build.title,
      maker: build.maker?.username ?? null,
      media_id: cover.row.id,
      chosen_by_maker: cover.chosen,
      signs,
      picture: signed.data?.signedUrl ?? `${cover.row.bucket}/${cover.row.path}`,
      clear: cover.chosen
        ? `UPDATE public.build_media SET post_position = NULL WHERE id = '${cover.row.id}'; UPDATE public.builds SET cover_media_id = NULL WHERE id = '${build.id}' AND cover_media_id = '${cover.row.id}';`
        : `-- not chosen by the maker: the phone already shows the default cover. To stop the desktop card leading with it too:\n` +
          `UPDATE public.builds SET hero_node_id = NULL WHERE id = '${build.id}' AND hero_node_id = '${cover.row.node_id ?? ""}';`,
    });
  }
  if (!data || data.length < PAGE) break;
}

if (asJson) {
  console.log(JSON.stringify(found, null, 2));
} else if (found.length === 0) {
  console.log("No published build's cover shows the signs of a capture.");
} else {
  console.log(`${found.length} published build${found.length === 1 ? "" : "s"} whose cover may be a capture. Look at each picture first.\n`);
  for (const item of found) {
    console.log(`${item.title}  (@${item.maker ?? "unknown"})`);
    console.log(`  build    ${item.build}`);
    console.log(`  picture  ${item.picture}`);
    console.log(`  why      ${item.signs.join(", ")}${item.chosen_by_maker ? ", chosen by the maker" : ", picked by the card's fallback"}`);
    console.log(`  clear    ${item.clear.replace(/\n/g, "\n           ")}\n`);
  }
}
