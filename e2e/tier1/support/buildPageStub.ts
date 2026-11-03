// UX-01 P10: the stubbed build the build-page repaint spec (BG-P21) uses, for the tier-1 spec that measures the skeleton's change to the
// page. Copied from e2e/tier3/build-page-repaint.spec.ts, which keeps its own.

import type { Page, Route } from "@playwright/test";

const REST = /\/rest\/v1\//;
export const SLUG = "inbox-triage-agent";

type Row = Record<string, unknown>;

const BUILD_ID = "00000000-0000-4000-8000-000000000001";
const CREATOR = "00000000-0000-4000-8000-0000000000aa";

const build: Row = {
  id: BUILD_ID,
  creator_id: CREATOR,
  slug: SLUG,
  title: "Inbox triage agent that drafts the replies",
  outcome:
    "Sorts a morning's email into three piles, drafts the replies for two of them, and leaves the third alone.",
  shape: "workflow",
  status: "published",
  made_for: ["founder"],
  made_with: ["Claude", "n8n"],
  live_url: null,
  repo_url: null,
  hero_node_id: "00000000-0000-4000-8000-0000000000e1",
  cover_media_id: null,
  cost_setup: 40,
  cost_monthly: 12,
  currency: "GBP",
  time_to_first_result: 25,
  completeness: 88,
  reproduction_count: 41,
  last_confirmed_at: "2026-09-10T00:00:00.000Z",
  last_confirmed_model: "claude-sonnet-4-5",
  parent_build_id: "00000000-0000-4000-8000-0000000000b9",
  root_build_id: "00000000-0000-4000-8000-0000000000b9",
  forked_from_event_id: null,
  source_content_item_id: null,
  monetisation_type: "free",
  price_gbp: null,
  donation_enabled: false,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-09-10T00:00:00.000Z",
  published_at: "2026-08-02T00:00:00.000Z",
  // The rebuild credit: the two frozen snapshot columns plus the note.
  rebuild_note: "Swapped the classifier and halved the cost.",
  rebuild_count: 1,
  source_title_at_fork: "Inbox triage, first pass",
  source_handle_at_fork: "maren",
  solves_node_id: null,
};

const node = (partial: Row): Row => ({
  build_id: BUILD_ID,
  parent_id: null,
  position: 0,
  note: null,
  payload: {},
  source_ref: null,
  event_id: null,
  is_gap: false,
  status: "placed",
  created_at: "2026-08-01T00:00:00.000Z",
  ...partial,
});

const NODES: Row[] = [
  node({
    id: "00000000-0000-4000-8000-0000000000e1",
    type: "screen_recording",
    title: "The agent running on a real inbox",
    position: 0,
    payload: { media_id: "00000000-0000-4000-8000-0000000000m1" },
  }),
  node({
    id: "00000000-0000-4000-8000-0000000000n1",
    type: "prompt",
    title: "The classify prompt",
    position: 1,
    note: "Written for a morning inbox rather than a backlog, which is why it leans on recency.",
    payload: { text: "Classify this email into reply, read, or ignore." },
  }),
  node({
    id: "00000000-0000-4000-8000-0000000000n2",
    type: "agent_config",
    title: "The retry policy nobody has written",
    position: 2,
    // THE GAP. It keeps its own category and takes a dashed breakage edge.
    is_gap: true,
    payload: {},
  }),
  node({
    id: "00000000-0000-4000-8000-0000000000n3",
    type: "breakage",
    title: "Context window overflowed on long threads",
    position: 3,
    event_id: "00000000-0000-4000-8000-0000000000v2",
    payload: {
      symptom: "Threads past forty messages came back empty.",
      cause: "The whole thread was pasted into the prompt.",
      resolution: "Summarise everything older than the last ten messages first.",
      event_start: 2,
      event_end: 3,
    },
  }),
];

const EVENTS: Row[] = [1, 2, 3, 4].map((ordinal) => ({
  id: `00000000-0000-4000-8000-0000000000v${ordinal}`,
  build_id: BUILD_ID,
  ordinal,
  kind: ordinal === 2 ? "breakage" : "prompt",
  phase: ordinal <= 2 ? 1 : 2,
  phase_title: ordinal <= 2 ? "Getting it running" : "Making it good",
  title: `Step ${ordinal}`,
  payload: { text: `What happened at step ${ordinal}.` },
  occurred_at: `2026-08-0${ordinal}T09:00:00.000Z`,
  visibility: "kept",
  produced_node_id: null,
  created_at: "2026-08-01T00:00:00.000Z",
}));

const NODE_TYPES: Row[] = [
  {
    key: "prompt",
    label: "Prompt",
    category: "instruction",
    colour: "#E8571A",
    icon: "MessageSquare",
    renderer: "instruction",
    copyable: true,
    is_active: true,
    sort: 1,
    schema: { fields: [{ key: "text", label: "Text", type: "text" }] },
  },
  {
    key: "agent_config",
    label: "Agent config",
    category: "configuration",
    colour: "#22C55E",
    icon: "Cog",
    renderer: "configuration",
    copyable: false,
    is_active: true,
    sort: 1,
    schema: { fields: [] },
  },
  {
    key: "breakage",
    label: "Breakage",
    category: "breakage",
    colour: "#EF4444",
    icon: "TriangleAlert",
    renderer: "breakage",
    copyable: false,
    is_active: true,
    sort: 1,
    schema: {
      fields: [
        { key: "symptom", label: "Symptom", type: "text" },
        { key: "cause", label: "Cause", type: "text" },
        { key: "resolution", label: "Resolution", type: "text" },
      ],
    },
  },
  {
    key: "screen_recording",
    label: "Screen recording",
    category: "media",
    colour: "#EC4899",
    icon: "Video",
    renderer: "media",
    copyable: false,
    is_active: true,
    sort: 1,
    schema: { fields: [] },
  },
];

/** A VIDEO HERO. poster_path is what fills the slot before anyone presses play. */
const MEDIA: Row[] = [
  {
    id: "00000000-0000-4000-8000-0000000000m1",
    build_id: BUILD_ID,
    bucket: "build-media",
    path: `${BUILD_ID}/run.mp4`,
    kind: "video",
    mime: "video/mp4",
    bytes: 2_400_000,
    width: 1920,
    height: 1080,
    duration: 48,
    poster_path: `${BUILD_ID}/run-poster.png`,
    created_at: "2026-08-01T00:00:00.000Z",
  },
];

/** One published descendant, so the Rebuilds tab exists. */
const REBUILDS: Row[] = [
  {
    id: "00000000-0000-4000-8000-0000000000r1",
    slug: "inbox-triage-overnight",
    title: "Inbox triage, overnight",
    rebuild_note: "Runs at 3am against the night's mail.",
    created_at: "2026-09-01T00:00:00.000Z",
    forked_from_event_id: "00000000-0000-4000-8000-0000000000v2",
    reproduction_count: 2,
    parent_build_id: BUILD_ID,
    creator_id: "00000000-0000-4000-8000-0000000000bb",
    profiles: { id: "00000000-0000-4000-8000-0000000000bb", username: "nightowl", display_name: "Night Owl", avatar_url: null },
  },
];

/**
 * A 160x90 PNG: 16:9, the ratio a screen recording arrives at.
 *
 * Solid colour, so it compresses to under 300 bytes. Its only job is to give
 * the hero slot an intrinsic ratio, so a `height: auto` media element resolves
 * to a real height and the layout measurements below have something to measure.
 */
const POSTER_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAKAAAABaCAIAAACwpMoFAAAAoklEQVR42u3RMQ0AAAgEsfevgYkRlfiAJqfgmurR4WIBYAEWYAEWYAEWYMACLMACLMACLMACDFiABViABViABViABRiwAAuwAAuwAAswYAEWYAEWYAEWYMACLMACLMACLMACDFiABViABViABRiwAAuwAAuwAAswYBcAC7AAC7AAC7AAAxZgARZgARZgAQYswAIswAIswAIswIAFWIAFWIAFWIB/td3jQEZmUes7AAAAAElFTkSuQmCC";

/** True when the request wants one object rather than a list. */
const wantsObject = (route: Route) =>
  (route.request().headers()["accept"] ?? "").includes("pgrst.object");

function json(route: Route, rows: Row[]) {
  const body = wantsObject(route)
    ? JSON.stringify(rows[0] ?? null)
    : JSON.stringify(rows);
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
    body,
  });
}

/**
 * Answer every request the page makes, and everything else with an empty list.
 *
 * Registered widest-first: Playwright matches the LAST registered route first,
 * so the specific handlers have to come after the catch-all.
 */
export async function stubBuild(page: Page, { heroKind = "video", delayBuildMs = 0 }: { heroKind?: "video" | "image"; delayBuildMs?: number } = {}) {
  const media =
    heroKind === "image"
      ? [{ ...MEDIA[0], kind: "image", mime: "image/png", poster_path: null, duration: null }]
      : MEDIA;

  await page.route(REST, (route: Route) => json(route, []));
  await page.route(/\/rest\/v1\/node_types/, (route: Route) => json(route, NODE_TYPES));
  await page.route(/\/rest\/v1\/build_nodes/, (route: Route) => json(route, NODES));
  await page.route(/\/rest\/v1\/build_events/, (route: Route) => json(route, EVENTS));
  await page.route(/\/rest\/v1\/build_media/, (route: Route) => json(route, media));
  await page.route(/\/rest\/v1\/builds/, async (route: Route) => {
    if (delayBuildMs > 0) await new Promise((resolve) => setTimeout(resolve, delayBuildMs));
    const url = route.request().url();
    // listRebuilds asks by parent_build_id; everything else wants the record.
    if (url.includes("parent_build_id=eq.")) return json(route, REBUILDS);
    return json(route, [build]);
  });
  // Signing, and then the bytes. Both are stubbed because the hero's SLOT is a
  // layout claim: an <img> with no intrinsic size collapses the well to a
  // hairline, and "the hero leads" would then be measuring nothing. POSTER is a
  // real 16:9 PNG, which is the ratio a screen recording arrives at.
  // `object/sign` is the POST that signs; `render/image/sign` is where the
  // client sends the GET once a transform is asked for: which is the whole of
  // acceptance 5, and why both have to be intercepted rather than just the one.
  await page.route(/\/storage\/v1\/(object|render\/image)\/sign\//, (route: Route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(POSTER_PNG_BASE64, "base64"),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        signedURL: "/storage/v1/object/sign/build-media/poster.png?token=t&width=1200",
      }),
    });
  });
}

