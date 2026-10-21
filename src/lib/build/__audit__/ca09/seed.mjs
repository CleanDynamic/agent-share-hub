/* CA-09 audit — the stand-in's data, in Miles's shape. Every name, title and word here is made up.

   - Miles (MAKER_ID) has 16 drafts. Draft 1 has 7 steps. Draft 2 is a 10-post thread with 40 pictures (4 a post,
     the most a post holds, thread.ts MAX_POST_PICTURES × MAX_THREAD_POSTS). Six drafts are "Untitled build" with
     no steps, as the live list has.
   - 20 import_sessions: 7 waiting (parsed), 10 in a draft (claimed), 3 expired. Four proposals are large:
     1.2, 2.5, 3.8 and 5.0 MB of JSON; the rest 20 to 300 KB.
   - 30 published builds by 9 makers, each with a cover; "showcase" (slug ca09-showcase) also has the 40-picture
     thread and 12 steps, for the build page.
   - 6 DM threads, 12 notifications, follows.

   Rows carry every column types.ts lists (null when not set), so a select of any listed column answers. */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readSchema } from "./schema.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = readSchema();

export const MAKER_ID = "0b0b0b0b-0000-4000-8000-000000000001";

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
/** JWT-shaped so supabase-js and realtime-js can read its claims. Not signed: the signature is a placeholder. */
export const ACCESS_TOKEN = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: MAKER_ID, role: "authenticated", aud: "authenticated", exp: 1924992000, iat: 1792000000, session_id: "ca09" })}.ca09-not-a-signature`;

export function sessionForStorage() {
  return {
    access_token: ACCESS_TOKEN,
    token_type: "bearer",
    expires_in: 86400 * 365,
    expires_at: 1924992000,
    refresh_token: "ca09-refresh",
    user: { id: MAKER_ID, aud: "authenticated", role: "authenticated", email: "maker@example.test", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: { username: "miles-test" }, identities: [], created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z", is_anonymous: false },
  };
}

let counter = 0;
const uuid = (prefix) => {
  counter += 1;
  return `${prefix}-0000-4000-8000-${String(counter).padStart(12, "0")}`;
};

function row(table, over) {
  const out = {};
  for (const column of SCHEMA.tables[table].columns) out[column] = null;
  return { ...out, ...over };
}

const day = (n, hour = 12) => new Date(Date.UTC(2026, 9, 20 - n, hour, 17, 0)).toISOString();

const WORDS = "the plan was to make the list sort itself by date and then group it by the shelf it sits on so the photo of each item lines up with its label and nothing gets lost when the next batch arrives".split(" ");
function sentence(n, seed) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(WORDS[(seed * 7 + i * 13) % WORDS.length]);
  const s = out.join(" ");
  return s[0].toUpperCase() + s.slice(1) + ".";
}

/** A proposal of about `bytes` of JSON: events (one per user turn) and a summary, as the importer writes it. */
function proposal(bytes, seed) {
  const turnText = (i) => sentence(40, seed + i).repeat(6);
  const events = [];
  let size = 0;
  let i = 0;
  while (size < bytes) {
    const text = turnText(i);
    const event = { kind: "prompt", ordinal: i, payload: { text, reply: turnText(i + 1).repeat(3) }, source_ref: { index: i * 2 } };
    events.push(event);
    size += JSON.stringify(event).length;
    i += 1;
  }
  return { events, summary: { user_turn_count: events.length, assistant_turn_count: events.length, models: ["claude-sonnet"] }, source: { client: "claude-code" } };
}

export function seed() {
  counter = 0;
  const nodeTypes = JSON.parse(readFileSync(path.join(here, "node_types.json"), "utf8"));

  const makers = [
    { id: MAKER_ID, username: "miles-test", display_name: "Miles (test)" },
    ...["ana", "bo", "chi", "dev", "eli", "fen", "gus", "hal"].map((name, i) => ({ id: `0b0b0b0b-0000-4000-8000-00000000010${i}`, username: `${name}-test`, display_name: `${name[0].toUpperCase()}${name.slice(1)} Test` })),
  ];
  const profiles = makers.map((m, i) => row("profiles", { ...m, avatar_url: null, bio: i ? "Makes small tools." : "Testing the stand-in.", is_creator: true, is_admin: false, is_private: false, is_verified: false, level: 3, follower_count: 12 - i, following_count: i, created_at: "2026-08-01T00:00:00Z", joined_at: "2026-08-01T00:00:00Z", colour_swatches: [], user_ai_tools: [], user_interests: [] }));

  const builds = [];
  const nodes = [];
  const media = [];
  const events = [];

  const build = (over) => {
    const b = row("builds", {
      id: uuid("0d0d0d0d"), creator_id: MAKER_ID, slug: `ca09-${counter}`, title: "Untitled build", outcome: null, shape: "other", status: "draft",
      made_for: [], made_with: [], live_url: null, repo_url: null, completeness: 0, reproduction_count: 0, rebuild_count: 0, donation_enabled: false,
      session_count: 0, prompt_count: 0, ai_turn_count: 0, models_used: [], making: {}, post_doc: null, created_at: day(30), updated_at: day(30), published_at: null,
      ...over,
    });
    builds.push(b);
    return b;
  };

  const step = (b, type, position, payload, title = null) => {
    const n = row("build_nodes", { id: uuid("0f0f0f0f"), build_id: b.id, parent_id: null, position, type, title, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: b.created_at });
    nodes.push(n);
    return n;
  };

  const picture = (b, i, nodeId = null) => {
    const m = row("build_media", { id: uuid("0a0a0a0a"), build_id: b.id, node_id: nodeId, bucket: "build-media", path: `${b.id}/unplaced/picture-${i}.jpg`, kind: "image", mime: "image/jpeg", bytes: 184_000, width: 1600, height: 1200, duration: null, created_at: b.created_at, post_position: null, post_text: null, filename: `picture-${i}.jpg`, caption: null, metadata: {} });
    media.push(m);
    return m;
  };

  /** A 10-post thread: words, then a grid of four pictures, in every post. */
  const thread = (b) => {
    const content = [];
    for (let post = 0; post < 10; post++) {
      if (post) content.push({ type: "postBreak" });
      content.push({ type: "paragraph", content: [{ type: "text", text: sentence(30, post) }] });
      const grid = [];
      for (let k = 0; k < 4; k++) {
        const m = picture(b, post * 4 + k);
        m.post_position = post * 4 + k;
        grid.push({ type: "postMedia", attrs: { mediaId: m.id, w: 1600, h: 1200, alt: "", crop: null, aspect: null, zoom: null, warn: [], width: 100, caption: "" } });
      }
      content.push({ type: "postMediaGrid", attrs: { step: null }, content: grid });
    }
    b.post_doc = { type: "doc", content };
    b.cover_media_id = media.find((m) => m.build_id === b.id).id;
  };

  const sevenSteps = (b, count = 7) => {
    const kinds = [
      ["prompt", { text: sentence(60, 1), tool: "claude", model: "claude-sonnet", session: null }],
      ["prompt", { text: sentence(45, 2), tool: "claude", model: "claude-sonnet", session: null }],
      ["code", { language: "python", source: "def sort_items(items):\n    return sorted(items, key=lambda i: i['date'])\n".repeat(20), filename: "sort.py" }],
      ["manual_step", { tool: "Sheets", text: sentence(25, 3) }],
      ["integration", { service: "Google Sheets" }],
      ["prompt", { text: sentence(70, 4), tool: "claude", model: "claude-sonnet", session: null }],
      ["result", { summary: sentence(20, 5) }],
      ["document", { title: "Shelf labels", summary: sentence(15, 6) }],
      ["prompt", { text: sentence(30, 7), tool: "chatgpt", model: "gpt-5", session: null }],
      ["agent_config", { system_prompt: sentence(40, 8), model: "claude-sonnet" }],
      ["result", { summary: sentence(18, 9) }],
      ["prompt", { text: sentence(22, 10), tool: "claude", model: "claude-sonnet", session: null }],
    ];
    for (let i = 0; i < count; i++) step(b, kinds[i][0], i, kinds[i][1], kinds[i][0] === "document" ? "Shelf labels" : null);
  };

  // Miles's 16 drafts, newest first.
  const titles = ["Pantry inventory helper", "Garden photo diary", "Invoice tidy-up", "Untitled build", "Reading list sorter", "Untitled build", "Lesson plan maker", "Untitled build", "Recipe scaler", "Untitled build", "Bike route notes", "Untitled build", "Untitled build", "Birthday card prompts", "Quiz from notes", "Old blog importer"];
  const drafts = titles.map((title, i) => build({ title, created_at: day(i * 3 + 2), updated_at: day(i * 3), outcome: title === "Untitled build" ? null : sentence(12, i) }));
  sevenSteps(drafts[0], 7);
  drafts[0].session_count = 2;
  drafts[0].making = { sessions_meta: { "typed-0b0b0b0b-aaaa-4aaa-8aaa-000000000001": { tool: "claude", day: "2026-10-12" } } };
  thread(drafts[1]);
  for (let i = 2; i < drafts.length; i++) if (drafts[i].title !== "Untitled build") sevenSteps(drafts[i], 1 + (i % 3));

  // 30 published builds by nine makers, each with a cover picture.
  const shapes = ["app", "agent", "workflow", "prompt", "dataset", "technique", "media", "other"];
  const published = [];
  for (let i = 0; i < 30; i++) {
    const b = build({ creator_id: makers[i % makers.length].id, title: `${["Shelf", "Route", "Quiz", "Recipe", "Invoice", "Garden"][i % 6]} builder ${i + 1}`, outcome: sentence(14, i + 20), shape: shapes[i % shapes.length], status: i % 5 === 0 ? "gallery" : "published", published_at: day(i, 9), created_at: day(i + 5), updated_at: day(i, 9), reproduction_count: i % 4, last_confirmed_at: i % 4 ? day(i + 2) : null, made_with: ["claude"], made_for: ["teachers"], completeness: 80 });
    const cover = picture(b, 0);
    b.cover_media_id = cover.id;
    sevenSteps(b, 3 + (i % 5));
    published.push(b);
  }
  const showcase = build({ slug: "ca09-showcase", creator_id: makers[1].id, title: "Garden diary, start to finish", outcome: sentence(16, 99), shape: "workflow", status: "published", published_at: day(1, 9), created_at: day(10), updated_at: day(1, 9), reproduction_count: 3, last_confirmed_at: day(2), made_with: ["claude", "chatgpt"], made_for: ["families"], completeness: 100 });
  thread(showcase);
  sevenSteps(showcase, 12);
  for (const [i, b] of [showcase, ...published.slice(0, 5)].entries()) {
    events.push(row("build_events", { id: uuid("0e1e1e1e"), build_id: b.id, kind: "prompt", ordinal: 0, occurred_at: b.created_at, created_at: b.created_at, payload: { text: sentence(10, i) }, phase: null, phase_title: null, produced_node_id: null, visibility: "public" }));
  }

  // 20 import sessions for Miles.
  const sizes = [40e3, 120e3, 1.2e6, 25e3, 300e3, 2.5e6, 60e3, 80e3, 3.8e6, 20e3, 150e3, 5.0e6, 45e3, 90e3, 200e3, 30e3, 70e3, 110e3, 55e3, 35e3];
  const statuses = ["parsed", "claimed", "parsed", "claimed", "parsed", "claimed", "parsed", "claimed", "parsed", "claimed", "expired", "claimed", "parsed", "claimed", "expired", "claimed", "parsed", "claimed", "expired", "claimed"];
  const sessions = sizes.map((bytes, i) => {
    const p = proposal(bytes, i);
    const status = statuses[i];
    return row("import_sessions", {
      id: uuid("0e0e0e0e"), user_id: MAKER_ID, client: i % 3 ? "claude-code" : "claude", model: i % 4 ? "claude-sonnet" : null, status, build_id: status === "claimed" ? drafts[i % 4].id : null,
      target_build_id: null, created_at: day(i, 8), updated_at: day(i, 8), expires_at: day(-30), proposal: p, total_chars: Math.round(bytes), declared_chars: Math.round(bytes), declared_turns: p.events.length * 2,
      chunk_count: 1, expected_chunks: 1, content_hash: `ca09-${i}`, fingerprint: `ca09-${i}`, error: null, secret_findings: [], source_hint: null, detection_reason: null, reader_id: "claude-code",
    });
  });

  // Messages, notifications, follows.
  const threads = makers.slice(1, 7).map((m, i) => row("dm_threads", { id: uuid("0c1c1c1c"), type: "direct", participant_a: MAKER_ID, participant_b: m.id, created_by: m.id, created_at: day(i + 3), last_message_at: day(i), last_message_preview: sentence(8, i), last_message_sender_id: m.id, unread_count_a: i % 2, unread_count_b: 0, is_archived: false, request_status: "accepted" }));
  const messages = threads.flatMap((t, i) => Array.from({ length: 8 }, (_, k) => row("dm_messages", { id: uuid("0c2c2c2c"), thread_id: t.id, sender_id: k % 2 ? MAKER_ID : t.participant_b, text_content: sentence(10, i + k), body: sentence(10, i + k), kind: "text", message_type: "text", sent_at: day(i, 8 + k), is_unsent: false, is_liked: false })));
  const members = threads.flatMap((t) => [MAKER_ID, t.participant_b].map((user) => row("dm_thread_members", { thread_id: t.id, user_id: user, joined_at: t.created_at, last_read_at: t.created_at, is_admin: false, is_muted: false, is_pinned: false })));
  const notifications = Array.from({ length: 12 }, (_, i) => row("notifications", { id: uuid("0c3c3c3c"), recipient_id: MAKER_ID, actor_id: makers[1 + (i % 8)].id, notification_type: ["follow", "reproduction", "comment"][i % 3], target_type: "build", target_id: published[i].id, is_read: i > 3, created_at: day(i), body: sentence(8, i), metadata: {} }));
  const follows = makers.slice(1).map((m, i) => row("follows", { id: uuid("0c4c4c4c"), follower_id: i % 2 ? MAKER_ID : m.id, following_id: i % 2 ? m.id : MAKER_ID, created_at: day(i) }));

  return { profiles, builds, build_nodes: nodes, build_media: media, build_events: events, node_types: nodeTypes, import_sessions: sessions, dm_threads: threads, dm_messages: messages, dm_thread_members: members, notifications, follows };
}

/** The ids and slugs the measurement scripts open. */
export function landmarks() {
  const rows = seed();
  const drafts = rows.builds.filter((b) => b.status === "draft");
  return { sevenStep: drafts[0].id, thread: drafts[1].id, showcaseSlug: "ca09-showcase", profileHandle: "ana-test", makerHandle: "miles-test" };
}
