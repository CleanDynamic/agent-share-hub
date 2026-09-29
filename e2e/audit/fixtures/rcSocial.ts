/* RC-P20b — the social layer's fixtures for the phase-4 critique screenshots.
 *
 * WHAT PHASE 4 ADDED, SEEN FROM ONE READER. The audit harness's signed-in
 * reader (ME) looks at the phase-3 builds (fixtures/rcBuilds.ts) with the
 * social layer on top: the builds carry like, comment and save counts; the
 * fixture build (rc-build-7) has four comments, one of them a reply by the
 * reader (so Delete shows) and one attached to a part; the reader has liked
 * two builds, saved three (not rc-build-7, so Save on its page adds it and
 * offers "Add to a collection") and keeps two collections; the notifications
 * page holds one row of each of the nine kinds the database writes; one
 * direct thread with a followed maker carries a shared build; and one report
 * is open, for the admin's Reports tab.
 *
 * SHAPED LIKE THE ROWS THE APP ASKS FOR, before embeds: the spec attaches
 * each embed a select names (a comment's author, a report's reporter, a
 * collection's item count) from these rows, so a lookup answers through the
 * same filter as the rest of the fixture world (support/restFilter.ts).
 *
 * NO REAL USER DATA. Every name, handle and id is invented here or in
 * rcBuilds.ts and harness.ts.
 */

import { ME, THEM } from "../support/harness";
import { RC_BUILDS, RC_FIXTURE_SLUG, RC_MAKERS } from "./rcBuilds";

type Row = Record<string, unknown>;

const HOUR = 60 * 60 * 1000;
const hoursAgo = (n: number) => new Date(Date.now() - n * HOUR).toISOString();
const id = (n: number, kind: string) => `7d0000${kind}-0000-4000-8000-${String(n).padStart(12, "0")}`;

const buildAt = (n: number) => RC_BUILDS[n - 1];
const buildId = (n: number) => String(buildAt(n).id);

/** The fixture build the build page, its comments and the dialogs open. */
export const RC_SOCIAL_BUILD = RC_BUILDS.find((row) => row.slug === RC_FIXTURE_SLUG) as Row;
const FIXTURE_ID = String(RC_SOCIAL_BUILD.id);
/** Its first part, which one comment is attached to. */
const FIXTURE_PART = String((RC_SOCIAL_BUILD.build_nodes as Row[])[0].id);

const [MAYA, TOMAS, PRIYA] = RC_MAKERS;

/* ── Comments on rc-build-7 ─────────────────────────────────────────────────── */

export const RC_COMMENTS: Row[] = [
  {
    id: id(1, "01"),
    build_id: FIXTURE_ID,
    node_id: null,
    parent_id: null,
    author_id: PRIYA.id,
    body: "Ran it on our support inbox for a week. It sent two refund requests to the wrong queue.",
    is_hidden: false,
    created_at: hoursAgo(70),
    edited_at: null,
  },
  {
    id: id(2, "01"),
    build_id: FIXTURE_ID,
    node_id: null,
    parent_id: id(1, "01"),
    author_id: ME.id,
    body: "Same here: the refund rule also matches questions about the refund policy.",
    is_hidden: false,
    created_at: hoursAgo(50),
    edited_at: null,
  },
  {
    id: id(3, "01"),
    build_id: FIXTURE_ID,
    node_id: FIXTURE_PART,
    parent_id: null,
    author_id: TOMAS.id,
    body: "This prompt assumes English subject lines. Half of ours are Swedish, and those all land in read later.",
    is_hidden: false,
    created_at: hoursAgo(30),
    edited_at: null,
  },
  {
    id: id(4, "01"),
    build_id: FIXTURE_ID,
    node_id: null,
    parent_id: null,
    author_id: THEM.id,
    body: "Worked first time. The on-call rebuild is the one I would start from now.",
    is_hidden: false,
    created_at: hoursAgo(6),
    edited_at: null,
  },
];

/* ── The builds, with the counts the social layer keeps ─────────────────────── */

/**
 * Like, comment and save counts per build, as the triggers keep them; nothing
 * hidden. The build page's header also reads cost and speed, which a gallery
 * row does not carry: the fixture build states them, the others leave them
 * null, as a real row would (an absent column reads as undefined, and the
 * header would print it).
 */
export const RC_SOCIAL_BUILDS: Row[] = RC_BUILDS.map((row, index) => ({
  ...row,
  cost_setup: row.id === FIXTURE_ID ? 0 : null,
  cost_monthly: row.id === FIXTURE_ID ? 12 : null,
  currency: "GBP",
  time_to_first_result: row.id === FIXTURE_ID ? 10 : null,
  like_count: [18, 11, 7, 9, 4, 3, 6, 2, 1, 0, 0, 1, 2][index] ?? 0,
  comment_count: row.id === FIXTURE_ID ? RC_COMMENTS.length : [3, 2, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1][index] ?? 0,
  save_count: [9, 6, 4, 5, 2, 1, 3, 1, 0, 0, 0, 0, 1][index] ?? 0,
  is_hidden: false,
}));

/* ── The reader's likes and saves ───────────────────────────────────────────── */

export const RC_LIKES: Row[] = [1, 4].map((n, index) => ({
  build_id: buildId(n),
  user_id: ME.id,
  created_at: hoursAgo(20 + index),
}));

/** Saved, newest first: builds 4, 1 and 2. rc-build-7 is not saved. */
export const RC_SAVES: Row[] = [4, 1, 2].map((n, index) => ({
  build_id: buildId(n),
  user_id: ME.id,
  created_at: hoursAgo(2 + index * 24),
}));

/* ── Two collections ────────────────────────────────────────────────────────── */

export const RC_COLLECTIONS: Row[] = [
  { id: id(1, "02"), owner_id: ME.id, title: "Support desk", is_public: true, is_default: false, updated_at: hoursAgo(3) },
  { id: id(2, "02"), owner_id: ME.id, title: "To try this weekend", is_public: false, is_default: false, updated_at: hoursAgo(40) },
];

export const RC_COLLECTION_ITEMS: Row[] = [
  [1, 4],
  [1, 13],
  [1, 1],
  [2, 3],
  [2, 8],
].map(([collection, n], index) => ({
  id: id(index + 1, "03"),
  collection_id: id(collection, "02"),
  item_kind: "build",
  build_id: buildId(n),
  item_id: buildId(n),
  content_id: null,
  added_by: ME.id,
  position: index,
  added_at: hoursAgo(3 + index * 10),
}));

/* ── One notification of each kind the database writes (RC-P19) ─────────────── */

const NOTIFY: [string, string, string, number | null, string][] = [
  ["rebuilt", "rebuilt your build", "build", 13, MAYA.id],
  ["published", "published a new build", "build", 12, TOMAS.id],
  ["reproduced", "ran your build and it worked", "build", 1, PRIYA.id],
  ["comment", "commented on your build", "build_comment", 7, PRIYA.id],
  ["reply", "replied to your comment", "build_comment", 7, THEM.id],
  ["like", "liked your build", "build", 4, TOMAS.id],
  ["solution", "posted a solution to your bounty", "bounty_build", 9, MAYA.id],
  ["solved", "accepted your solution", "bounty_build", 6, PRIYA.id],
  ["follow", "started following you", "profile", null, THEM.id],
];

export const RC_NOTIFICATIONS: Row[] = NOTIFY.map(([kind, body, targetType, n, actor], index) => ({
  id: id(index + 1, "04"),
  recipient_id: ME.id,
  actor_id: actor,
  notification_type: kind,
  body,
  target_type: targetType,
  target_id: targetType === "profile" ? actor : targetType === "build" && n ? buildId(n) : id(index + 1, "05"),
  content_id: null,
  project_id: null,
  collection_id: null,
  metadata: n ? { build_id: buildId(n) } : null,
  is_read: index >= 4,
  read_at: index >= 4 ? hoursAgo(1) : null,
  // Three today, three yesterday, three earlier: the page's day groups.
  created_at: hoursAgo([1, 3, 5, 26, 28, 30, 80, 100, 130][index]),
}));

/* ── A direct thread with a followed maker, carrying a shared build ────────────── */

export const RC_THREAD_ID = "7d000006-0000-4000-8000-000000000001";

export const RC_THREADS: Row[] = [
  {
    id: RC_THREAD_ID,
    type: "direct",
    title: null,
    created_by: MAYA.id,
    pinned_content_id: null,
    pinned_content_type: null,
    pinned_build_id: null,
    participant_a: ME.id,
    participant_b: MAYA.id,
    is_pinned_a: false,
    is_pinned_b: false,
    is_muted_a: false,
    is_muted_b: false,
    is_deleted_a: false,
    is_deleted_b: false,
    request_status: "accepted",
    last_message_at: hoursAgo(1),
    last_message_preview: "Trying it tonight.",
    last_message_sender_id: ME.id,
    is_archived: false,
    unread_count_a: 0,
    unread_count_b: 0,
  },
];

export const RC_THREAD_MEMBERS: Row[] = [ME.id, MAYA.id].map((user) => ({
  thread_id: RC_THREAD_ID,
  user_id: user,
  last_read_at: hoursAgo(0.5),
  is_pinned: false,
  is_muted: false,
  joined_at: hoursAgo(200),
}));

function message(n: number, sender: string, hours: number, extra: Row): Row {
  return {
    id: id(n, "06"),
    thread_id: RC_THREAD_ID,
    sender_id: sender,
    kind: "text",
    message_type: "text",
    body: null,
    text_content: null,
    image_url: null,
    voice_url: null,
    voice_duration_seconds: null,
    is_liked: null,
    reply_to_message_id: null,
    shared_content_type: null,
    shared_content_id: null,
    shared_content_meta: null,
    shared_build_id: null,
    edited_at: null,
    sent_at: hoursAgo(hours),
    read_at: hoursAgo(hours - 0.1),
    delivered_at: hoursAgo(hours),
    is_unsent: false,
    ...extra,
  };
}

const words = (text: string) => ({ body: text, text_content: text });

export const RC_MESSAGES: Row[] = [
  message(1, MAYA.id, 5, words("Have you tried the triage agent on a shared inbox yet?")),
  message(2, ME.id, 4, words("Not yet. Which one did you use?")),
  message(3, MAYA.id, 3, { shared_build_id: FIXTURE_ID, ...words("This one. It assigns by rule, so you can see why a ticket went where it did.") }),
  message(4, ME.id, 1, words("Trying it tonight.")),
];

/* ── One open report ────────────────────────────────────────────────────────── */

export const RC_REPORTS: Row[] = [
  {
    id: id(1, "07"),
    reporter_id: THEM.id,
    target_type: "build",
    target_id: buildId(10),
    reason: "spam",
    note: "The same build has been published three times this week under different titles.",
    status: "open",
    created_at: hoursAgo(9),
  },
];
