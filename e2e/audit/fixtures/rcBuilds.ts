/* RC-P09c — synthetic builds for the critique screenshots (twelve for phase 2;
 * RC-P14c added a thirteenth, the third generation of a rebuild family, plus a
 * third open ask, two solvers and the board's rows, for phase 3).
 *
 * SHAPED LIKE listGallery's ROWS: every column in GALLERY_BUILD_COLUMNS
 * (src/lib/build/gallery.ts), plus the three embeds its select asks for —
 * build_nodes, build_media and bounties — so the gallery renders them through
 * its real query path. The home feed's get_build_feed rows and the gallery's
 * facet counts are derived from the same twelve, so every surface shows one
 * consistent world.
 *
 * THE SPREAD THE CRITIQUE NEEDS TO SEE: titles from 20 to 70 characters,
 * several made-for and made-with values, reproduction counts from 0 to 41,
 * three builds last confirmed 200 days ago (the stale plaque), two carrying an
 * open bounty (the dashed gap edge), and two rebuilds (the credit line).
 *
 * NO REAL USER DATA. Every name, handle and id is invented here.
 *
 * COVERS ARE GENERATED, NOT CHECKED IN: `coverPng` encodes a small solid-colour
 * PNG in memory (a PNG is a signature and three chunks, each CRC-checked, with
 * zlib-deflated scanlines), so the spec can answer each signed cover URL with
 * its own picture at the aspect ratio the row declares.
 */

import { deflateSync } from "node:zlib";

type Row = Record<string, unknown>;

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

/** The invented makers. None of them is a real account. */
export const RC_MAKERS = [
  { id: "7a000000-0000-4000-8000-000000000001", username: "maya.o", display_name: "Maya Okafor" },
  { id: "7a000000-0000-4000-8000-000000000002", username: "tomas_l", display_name: "Tomás Lind" },
  { id: "7a000000-0000-4000-8000-000000000003", username: "priyab", display_name: "Priya Bose" },
] as const;

interface Spec {
  title: string;
  outcome: string;
  shape: string;
  madeFor: string[];
  madeWith: string[];
  reproductions: number;
  confirmedDaysAgo: number | null;
  model: string | null;
  /** An open ask on a gap: its reward in pounds, or null for an ask that names none. */
  bounty?: number | null;
  /** `parent` is the 1-based position in SPECS of the build this one rebuilt. */
  rebuildOf?: { title: string; handle: string; note: string; parent: number };
  cover: [number, number];
  rgb: [number, number, number];
}

const SPECS: Spec[] = [
  { title: "Inbox triage agent for founders", outcome: "Sorts a morning's email into reply, read later and ignore.", shape: "agent", madeFor: ["founder"], madeWith: ["Claude", "n8n"], reproductions: 41, confirmedDaysAgo: 3, model: "sonnet-4.5", cover: [1600, 1067], rgb: [94, 112, 130] },
  { title: "Contract clause reviewer that flags the risky bits", outcome: "Reads a contract and lists the clauses a lawyer should look at first.", shape: "workflow", madeFor: ["lawyer"], madeWith: ["Claude"], reproductions: 27, confirmedDaysAgo: 9, model: "opus-4.1", cover: [1200, 800], rgb: [128, 104, 92] },
  { title: "Weekly investor update drafted from the metrics sheet", outcome: "Turns a spreadsheet of numbers into a one-page update.", shape: "prompt", madeFor: ["founder"], madeWith: ["ChatGPT", "Sheets"], reproductions: 19, confirmedDaysAgo: 200, model: "gpt-4o", cover: [1600, 1067], rgb: [104, 124, 108] },
  { title: "Support reply suggester", outcome: "Suggests a first reply for each new ticket, in the house voice.", shape: "agent", madeFor: ["support"], madeWith: ["Claude", "Zendesk"], reproductions: 12, confirmedDaysAgo: 21, model: "haiku-4.5", bounty: 150, cover: [1200, 900], rgb: [116, 100, 132] },
  { title: "A long-running research assistant that keeps a reading list honest", outcome: "Tracks what has been read, what is disputed and what is still owed.", shape: "agent", madeFor: ["researcher"], madeWith: ["Claude", "Zotero"], reproductions: 8, confirmedDaysAgo: 200, model: "sonnet-4.5", cover: [1600, 1067], rgb: [90, 118, 124] },
  { title: "Invoice chaser for late payers", outcome: "Sends a polite reminder when an invoice is a week late.", shape: "workflow", madeFor: ["freelancer"], madeWith: ["n8n", "Gmail"], reproductions: 6, confirmedDaysAgo: 45, model: "gpt-4o-mini", bounty: null, cover: [1200, 800], rgb: [126, 118, 96] },
  { title: "Inbox triage agent, rebuilt for a shared support mailbox", outcome: "The triage agent, pointed at a team inbox with assignment rules.", shape: "agent", madeFor: ["support"], madeWith: ["Claude", "n8n"], reproductions: 5, confirmedDaysAgo: 14, model: "sonnet-4.5", rebuildOf: { title: "Inbox triage agent for founders", handle: "maya.o", note: "Added assignment rules.", parent: 1 }, cover: [1600, 1067], rgb: [98, 108, 124] },
  { title: "Meeting notes to action items", outcome: "Pulls owners and dates out of a transcript.", shape: "prompt", madeFor: ["founder", "designer"], madeWith: ["Claude"], reproductions: 3, confirmedDaysAgo: 30, model: "haiku-4.5", cover: [1200, 900], rgb: [120, 96, 104] },
  { title: "Grant application first-draft writer for small charities", outcome: "Drafts the answers a funder asks for from last year's report.", shape: "workflow", madeFor: ["nonprofit"], madeWith: ["ChatGPT"], reproductions: 2, confirmedDaysAgo: 200, model: "gpt-4o", bounty: 80, cover: [1600, 1067], rgb: [102, 122, 116] },
  { title: "Menu costing sheet with live supplier prices", outcome: "Keeps a restaurant's dish costs current as prices move.", shape: "dataset", madeFor: ["restaurant"], madeWith: ["Sheets", "Claude"], reproductions: 1, confirmedDaysAgo: 60, model: "sonnet-4.5", cover: [1200, 800], rgb: [132, 110, 100] },
  { title: "Contract reviewer, rebuilt for leases", outcome: "The clause reviewer, retuned for commercial leases.", shape: "workflow", madeFor: ["lawyer"], madeWith: ["Claude"], reproductions: 0, confirmedDaysAgo: null, model: null, rebuildOf: { title: "Contract clause reviewer that flags the risky bits", handle: "tomas_l", note: "Swapped the clause list for lease terms.", parent: 2 }, cover: [1200, 900], rgb: [110, 104, 126] },
  { title: "Podcast show notes and chapter markers from a transcript", outcome: "Writes the notes and the timestamps for each chapter.", shape: "prompt", madeFor: ["creator"], madeWith: ["Claude", "Descript"], reproductions: 0, confirmedDaysAgo: null, model: null, cover: [1600, 1067], rgb: [96, 116, 110] },
  // RC-P14c: the third generation — a rebuild of build 7, itself a rebuild of build 1.
  { title: "Inbox triage for on-call, with Slack alerts", outcome: "The shared-mailbox triage, paging whoever is on call when a reply cannot wait.", shape: "agent", madeFor: ["support"], madeWith: ["Claude", "Slack"], reproductions: 2, confirmedDaysAgo: 6, model: "sonnet-4.5", rebuildOf: { title: "Inbox triage agent, rebuilt for a shared support mailbox", handle: "maya.o", note: "Pages the on-call person instead of the whole team.", parent: 7 }, cover: [1200, 800], rgb: [100, 112, 120] },
];

/** The build the phase-3 build page and lineage captures open: the middle of the family. */
export const RC_FIXTURE_SLUG = "rc-build-7";

const id = (n: number, kind: string) => `7b0000${kind}-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** The first build in a rebuild chain: follows `parent` up from the 1-based position `n`. */
function rootOf(n: number): number {
  let at = n;
  for (let guard = 0; guard < SPECS.length; guard += 1) {
    const parent = SPECS[at - 1]?.rebuildOf?.parent;
    if (!parent) return at;
    at = parent;
  }
  return at;
}

/** The builds, as listGallery's rows. */
export const RC_BUILDS: Row[] = SPECS.map((spec, index) => {
  const n = index + 1;
  const maker = RC_MAKERS[index % RC_MAKERS.length];
  const buildId = id(n, "01");
  const coverId = id(n, "02");
  const gapId = id(n, "03");
  return {
    id: buildId,
    creator_id: maker.id,
    slug: `rc-build-${n}`,
    title: spec.title,
    outcome: spec.outcome,
    shape: spec.shape,
    status: spec.reproductions >= 5 ? "gallery" : "published",
    made_for: spec.madeFor,
    made_with: spec.madeWith,
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: coverId,
    completeness: 80,
    reproduction_count: spec.reproductions,
    last_confirmed_at: spec.confirmedDaysAgo === null ? null : daysAgo(spec.confirmedDaysAgo),
    last_confirmed_model: spec.model,
    published_at: daysAgo(10 + n * 3),
    parent_build_id: spec.rebuildOf ? id(spec.rebuildOf.parent, "01") : null,
    root_build_id: spec.rebuildOf ? id(rootOf(n), "01") : null,
    rebuild_count: SPECS.filter((other) => other.rebuildOf?.parent === n).length,
    rebuild_note: spec.rebuildOf?.note ?? null,
    source_title_at_fork: spec.rebuildOf?.title ?? null,
    source_handle_at_fork: spec.rebuildOf?.handle ?? null,
    build_nodes: [
      { id: id(n, "04"), type: "prompt", title: "The prompt", payload: {}, position: 0, is_gap: false },
      ...(spec.bounty !== undefined
        ? [{ id: gapId, type: "prompt", title: "The part nobody has solved", payload: {}, position: 1, is_gap: true }]
        : []),
    ],
    build_media: [
      {
        id: coverId,
        node_id: null,
        bucket: "build-media",
        path: `rc/cover-${n}.png`,
        kind: "image",
        width: spec.cover[0],
        height: spec.cover[1],
        poster_path: null,
        duration: null,
        post_position: 0,
        post_text: null,
      },
    ],
    bounties: spec.bounty !== undefined ? [{ id: id(n, "05"), reward_gbp: spec.bounty, status: "open" }] : [],
  };
});

/** The same builds as get_build_feed rows, newest first, with the two open asks as bounty items. */
export const RC_FEED_ROWS: Row[] = [...RC_BUILDS]
  .sort((a, b) => String(b.published_at).localeCompare(String(a.published_at)))
  .flatMap((b) => {
    const maker = RC_MAKERS.find((m) => m.id === b.creator_id)!;
    const cover = (b.build_media as Row[])[0];
    const base = {
      item_at: b.published_at,
      build_id: b.id,
      slug: b.slug,
      title: b.title,
      outcome: b.outcome,
      shape: b.shape,
      cover_media_id: b.cover_media_id,
      creator_id: b.creator_id,
      creator_username: maker.username,
      creator_display: maker.display_name,
      creator_avatar: null,
      reproduction_count: b.reproduction_count,
      rebuild_count: b.rebuild_count,
      parent_build_id: b.parent_build_id,
      source_title_at_fork: b.source_title_at_fork,
      source_handle_at_fork: b.source_handle_at_fork,
      rebuild_note: b.rebuild_note,
      repro_note: null,
      repro_model: null,
      repro_user_username: null,
      status: b.status,
      made_for: b.made_for,
      last_confirmed_at: b.last_confirmed_at,
      last_confirmed_model: b.last_confirmed_model,
      cover_bucket: "build-media",
      cover_path: cover.path,
      cover_kind: "image",
      cover_poster_path: null,
      repro_worked: null,
      bounty_id: null,
      bounty_reward_gbp: null,
      bounty_gap_title: null,
    };
    const rows: Row[] = [{ ...base, item_kind: b.parent_build_id ? "rebuild" : "build" }];
    const bounty = (b.bounties as Row[])[0];
    if (bounty) {
      rows.push({
        ...base,
        item_kind: "bounty",
        item_at: new Date(Date.parse(String(b.published_at)) + DAY).toISOString(),
        bounty_id: bounty.id,
        bounty_reward_gbp: bounty.reward_gbp,
        bounty_gap_title: "The part nobody has solved",
      });
    }
    return rows;
  })
  .sort((a, b) => String(b.item_at).localeCompare(String(a.item_at)));

/** gallery_facets, counted over the twelve. */
export const RC_FACETS = (() => {
  const count = (key: "made_for" | "made_with") => {
    const tally = new Map<string, number>();
    for (const b of RC_BUILDS) for (const v of b[key] as string[]) tally.set(v, (tally.get(v) ?? 0) + 1);
    return [...tally.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, n]) => ({ value, count: n, label: key === "made_with" ? value : null, logo_url: null }));
  };
  return { roles: count("made_for"), tools: count("made_with") };
})();

/* ── RC-P14c: the boards and the family ──────────────────────────────────── */

const GAP_TITLES: Record<number, string> = {
  4: "A first reply that cites the right help article",
  6: "Stop chasing invoices already paid by bank transfer",
  9: "A budget table the funder's form accepts",
};

/** How many answers each open ask has had, by the build's 1-based position. */
const ANSWERS: Record<number, number> = { 4: 2, 6: 0, 9: 1 };

/** The three open asks, as the bounties board reads them: bounty columns plus both embeds. */
export const RC_OPEN_BOUNTIES: Row[] = RC_BUILDS.flatMap((b, index) => {
  const bounty = (b.bounties as Row[])[0];
  if (!bounty) return [];
  const n = index + 1;
  return [
    {
      id: bounty.id,
      build_id: b.id,
      gap_node_id: id(n, "03"),
      legacy_item_id: null,
      author_id: b.creator_id,
      status: "open",
      reward_gbp: bounty.reward_gbp,
      closes_at: null,
      is_meta: false,
      meta_parent_id: null,
      accepted_solution_id: null,
      me_too_count: 0,
      created_at: daysAgo(n === 6 ? 1 : n === 4 ? 3 : 6),
      solved_at: null,
      builds: { id: b.id, slug: b.slug, title: b.title, made_with: b.made_with, creator_id: b.creator_id, status: b.status },
      build_nodes: { title: GAP_TITLES[n] ?? "The part nobody has solved" },
      _position: n,
    },
  ];
}).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

/** Answers already sent to those asks. */
export const RC_BOUNTY_SOLUTIONS: Row[] = RC_OPEN_BOUNTIES.flatMap((bounty) =>
  Array.from({ length: ANSWERS[bounty._position as number] ?? 0 }, (_, k) => ({
    id: `${bounty.id}-s${k}`,
    bounty_id: bounty.id,
    status: "submitted",
  })),
);

/** Two solvers, as top_solvers returns them: most solved first. */
export const RC_SOLVERS: Row[] = [
  { user_id: RC_MAKERS[1].id, solved: 3, reward_total: 230, last_solved_at: daysAgo(2) },
  { user_id: RC_MAKERS[2].id, solved: 1, reward_total: null, last_solved_at: daysAgo(12) },
];

/** rebuild_tree(root): the root and its published rebuilds, walked down parent_build_id. */
export function rebuildTreeRows(rootId: string): Row[] {
  const root = RC_BUILDS.find((b) => b.id === rootId);
  if (!root) return [];
  const rows: Row[] = [];
  let level: Row[] = [root];
  for (let depth = 0; level.length > 0 && depth <= 20; depth += 1) {
    for (const b of [...level].sort((x, y) => String(x.published_at).localeCompare(String(y.published_at)))) {
      rows.push({
        id: b.id,
        parent_build_id: b.parent_build_id,
        depth,
        slug: b.slug,
        title: b.title,
        creator_id: b.creator_id,
        published_at: b.published_at,
        reproduction_count: b.reproduction_count,
        rebuild_note: b.rebuild_note,
      });
    }
    const ids = new Set(level.map((b) => b.id));
    level = RC_BUILDS.filter((b) => ids.has(b.parent_build_id as string));
  }
  return rows;
}

/* ── The generated covers ─────────────────────────────────────────────────── */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** A solid-colour RGB PNG, `width` × `height` pixels. */
function solidPng(width: number, height: number, [r, g, b]: [number, number, number]): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set([r, g, b], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** The cover for a storage path the fixture issued, at the row's aspect ratio, 60px wide. */
export function coverPng(path: string): Buffer {
  const n = Number(/cover-(\d+)\.png/.exec(path)?.[1] ?? "1");
  const spec = SPECS[(n - 1) % SPECS.length];
  const width = 60;
  const height = Math.max(1, Math.round((width * spec.cover[1]) / spec.cover[0]));
  return solidPng(width, height, spec.rgb);
}
