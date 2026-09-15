/* BG-P30 — the audit harness: fifteen routes, two themes, one stubbed network.
 *
 * WHY THE NETWORK IS STUBBED, AND STUBBED WIDELY. The sweep has to render the
 * POPULATED state of every route, because an empty state paints a fraction of
 * the pairings the spec cares about: no part chips, no plaque, no gap edge, no
 * unread marker. The repo has exactly one `.env` and nothing in the tree says
 * the project it names is a dev project, so the sweep serves its own rows
 * rather than reading — or writing — a project that may be production. That is
 * the same trade tier 2 documents in `e2e/tier2/support/supabaseStub.ts`, taken
 * for the same reason.
 *
 * THE CATCH-ALL IS REGISTERED FIRST ON PURPOSE. Playwright matches the LAST
 * registered handler first, so a handler registered after the catch-all beats
 * it. Every specific table below therefore comes after the `[]` fallback, and a
 * route that asks for a table nobody seeded gets an empty list rather than a
 * failure — an unseeded table is a thinner page, not a broken sweep.
 *
 * NOTHING REACHES THE NETWORK. `/rest/v1`, `/auth/v1`, `/storage/v1` and the
 * realtime socket are all intercepted, and fonts are served from a local stub
 * so a sweep run offline measures the same glyph boxes as one run online.
 */

import type { Page, Route } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "../../..");

export const THEMES = ["exhibition", "dusk"] as const;
export type Theme = (typeof THEMES)[number];

type Row = Record<string, unknown>;

/* ───────────────────────── identity ───────────────────────── */

/** The project ref is the first label of the API hostname — supabase-js's own rule. */
function projectRef(): string {
  const url = supabaseUrl();
  return new URL(url).hostname.split(".")[0];
}

function supabaseUrl(): string {
  if (process.env.VITE_SUPABASE_URL) return process.env.VITE_SUPABASE_URL;
  const envPath = path.join(REPO_ROOT, ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*VITE_SUPABASE_URL\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "");
    }
  }
  throw new Error(
    "VITE_SUPABASE_URL is not set and .env does not define it — the audit cannot " +
      "derive the auth storage key. Set it in the environment before running.",
  );
}

export const ME = {
  id: "11111111-0000-4000-8000-000000000001",
  username: "audit",
  display_name: "Audit Runner",
};

export const THEM = {
  id: "22222222-0000-4000-8000-0000000000bb",
  username: "maren",
  display_name: "Maren",
};

/** A structurally valid JWT. It authenticates nothing — every request is intercepted. */
function fakeJwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url").replace(/=+$/, "");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(claims)}.audit-not-a-signature`;
}

/* ───────────────────────── the seed ───────────────────────── */

export const BUILD_ID = "33333333-0000-4000-8000-000000000003";
export const BUILD_SLUG = "inbox-triage-agent";
export const GAP_BUILD_ID = "44444444-0000-4000-8000-000000000004";
export const GAP_BUILD_SLUG = "overnight-triage-gap";
export const CONTENT_ID = "55555555-0000-4000-8000-000000000005";
export const THREAD_ID = "66666666-0000-4000-8000-000000000006";

const ISO = (d: string) => `${d}T09:00:00.000Z`;

const profile = (who: typeof ME, extra: Row = {}): Row => ({
  id: who.id,
  username: who.username,
  display_name: who.display_name,
  avatar_url: null,
  bio: "Builds things that read email so nobody has to.",
  created_at: ISO("2026-01-04"),
  is_creator: true,
  follower_count: 128,
  following_count: 41,
  ...extra,
});

const PROFILES: Row[] = [profile(ME), profile(THEM)];

/** A published build with every branch a card can render: plaque, rebuild credit, chips. */
function buildRow(n: number, extra: Row = {}): Row {
  const titles = [
    "Inbox triage agent that drafts the replies",
    "A build whose title is long enough to wrap onto a second and very nearly a third line",
    "Short one",
  ];
  return {
    id: `33333333-0000-4000-8000-00000000000${n}`,
    creator_id: n % 2 ? ME.id : THEM.id,
    slug: `build-${n}`,
    title: titles[n % titles.length],
    outcome:
      "Sorts a morning's email into three piles, drafts the replies for two of them, and leaves the third alone.",
    shape: n % 2 ? "workflow" : "agent",
    status: "published",
    made_for: ["founder", "lawyer"],
    made_with: ["Claude", "n8n"],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: null,
    cost_setup: 40,
    cost_monthly: 12,
    currency: "GBP",
    time_to_first_result: 25,
    completeness: 88,
    reproduction_count: n === 2 ? 0 : 41,
    // n === 2 is the "never reproduced" plaque state; n === 3 is stale.
    last_confirmed_at: n === 2 ? null : n === 3 ? ISO("2026-02-01") : ISO("2026-09-10"),
    last_confirmed_model: n === 2 ? null : "claude-sonnet-4-5",
    published_at: ISO("2026-08-02"),
    created_at: ISO("2026-08-01"),
    updated_at: ISO("2026-09-10"),
    parent_build_id: n === 1 ? "33333333-0000-4000-8000-0000000000b9" : null,
    root_build_id: n === 1 ? "33333333-0000-4000-8000-0000000000b9" : null,
    rebuild_count: n === 1 ? 1 : 0,
    rebuild_note: n === 1 ? "Swapped the classifier and halved the cost." : null,
    source_title_at_fork: n === 1 ? "Inbox triage, first pass" : null,
    source_handle_at_fork: n === 1 ? THEM.username : null,
    forked_from_event_id: null,
    source_content_item_id: null,
    monetisation_type: "free",
    price_gbp: null,
    donation_enabled: false,
    solves_node_id: null,
    build_nodes: [],
    build_media: [],
    bounties: [],
    profiles: profile(n % 2 ? ME : THEM),
    ...extra,
  };
}

/** The record the build page and the solve page both read, by slug. */
const HERO_BUILD: Row = buildRow(1, {
  id: BUILD_ID,
  slug: BUILD_SLUG,
  hero_node_id: "33333333-0000-4000-8000-0000000000e1",
});

/** The same record with an OPEN GAP, which is what makes it a solve page. */
const GAP_BUILD: Row = buildRow(1, {
  id: GAP_BUILD_ID,
  slug: GAP_BUILD_SLUG,
  title: "Overnight triage, one part unsolved",
  hero_node_id: null,
});

export const BUILDS: Row[] = [
  HERO_BUILD,
  buildRow(2),
  buildRow(3),
  buildRow(4),
  buildRow(5),
  buildRow(6),
  buildRow(7),
  buildRow(8),
  GAP_BUILD,
];

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
  created_at: ISO("2026-08-01"),
  ...partial,
});

/** One node per part category, so every one of the nine hues renders as a chip. */
export const NODES: Row[] = [
  node({
    id: "33333333-0000-4000-8000-0000000000e1",
    type: "screen_recording",
    title: "The agent running on a real inbox",
    position: 0,
    payload: { media_id: "33333333-0000-4000-8000-0000000000m1" },
  }),
  node({
    id: "33333333-0000-4000-8000-0000000000n1",
    type: "prompt",
    title: "The classify prompt",
    position: 1,
    note: "Written for a morning inbox rather than a backlog, which is why it leans on recency.",
    payload: { text: "Classify this email into reply, read, or ignore." },
  }),
  node({
    id: "33333333-0000-4000-8000-0000000000n2",
    type: "agent_config",
    title: "The retry policy nobody has written",
    position: 2,
    is_gap: true,
    payload: {},
  }),
  node({
    id: "33333333-0000-4000-8000-0000000000n3",
    type: "breakage",
    title: "Context window overflowed on long threads",
    position: 3,
    payload: {
      symptom: "Threads past forty messages came back empty.",
      cause: "The whole thread was pasted into the prompt.",
      resolution: "Summarise everything older than the last ten messages first.",
    },
  }),
  node({
    id: "33333333-0000-4000-8000-0000000000n4",
    type: "dataset",
    title: "Two hundred labelled threads",
    position: 4,
    payload: { text: "A CSV of subject lines and the pile each belongs in." },
  }),
  node({
    id: "33333333-0000-4000-8000-0000000000n5",
    type: "artefact",
    title: "The compiled workflow",
    position: 5,
    payload: { text: "n8n export." },
  }),
  node({
    id: "33333333-0000-4000-8000-0000000000n6",
    type: "run_log",
    title: "A week of runs",
    position: 6,
    payload: { text: "Ran 41 times, failed twice." },
  }),
  node({
    id: "33333333-0000-4000-8000-0000000000n7",
    type: "note",
    title: "Why the third pile is left alone",
    position: 7,
    payload: { text: "Because a wrong reply costs more than a late one." },
  }),
  node({
    id: "33333333-0000-4000-8000-0000000000n8",
    type: "subagent",
    title: "The summariser",
    position: 8,
    payload: { text: "Runs before the classifier on anything past ten messages." },
  }),
];

export const EVENTS: Row[] = [1, 2, 3, 4].map((ordinal) => ({
  id: `33333333-0000-4000-8000-0000000000v${ordinal}`,
  build_id: BUILD_ID,
  ordinal,
  kind: ordinal === 2 ? "breakage" : "prompt",
  phase: ordinal <= 2 ? 1 : 2,
  phase_title: ordinal <= 2 ? "Getting it running" : "Making it good",
  title: `Step ${ordinal}`,
  payload: { text: `What happened at step ${ordinal}.` },
  occurred_at: ISO(`2026-08-0${ordinal}`),
  visibility: "kept",
  produced_node_id: null,
  created_at: ISO("2026-08-01"),
}));

/** The registry that maps a node type onto one of the nine categories. */
export const NODE_TYPES: Row[] = [
  ["prompt", "Prompt", "instruction", "MessageSquare", "instruction"],
  ["agent_config", "Agent config", "configuration", "Cog", "configuration"],
  ["dataset", "Dataset", "data", "Database", "data"],
  ["artefact", "Artefact", "artefact", "Package", "artefact"],
  ["run_log", "Run log", "evidence", "ClipboardCheck", "evidence"],
  ["note", "Note", "narrative", "FileText", "narrative"],
  ["subagent", "Subagent", "agents", "Bot", "agents"],
  ["breakage", "Breakage", "breakage", "TriangleAlert", "breakage"],
  ["screen_recording", "Screen recording", "media", "Video", "media"],
].map(([key, label, category, icon, renderer]) => ({
  key,
  label,
  category,
  colour: null,
  icon,
  renderer,
  copyable: category === "instruction",
  is_active: true,
  sort: 1,
  schema: { fields: [{ key: "text", label: "Text", type: "text" }] },
}));

export const MEDIA: Row[] = [
  {
    id: "33333333-0000-4000-8000-0000000000m1",
    build_id: BUILD_ID,
    bucket: "build-media",
    path: `${BUILD_ID}/run.png`,
    kind: "image",
    mime: "image/png",
    bytes: 240_000,
    width: 1920,
    height: 1080,
    duration: null,
    poster_path: null,
    created_at: ISO("2026-08-01"),
  },
];

/** An open bounty on the gap node — the ask a solve page exists to answer. */
export const BOUNTIES: Row[] = [
  {
    id: "44444444-0000-4000-8000-0000000000c1",
    build_id: GAP_BUILD_ID,
    node_id: "33333333-0000-4000-8000-0000000000n2",
    status: "open",
    reward_gbp: 150,
    currency: "GBP",
    deadline: ISO("2026-12-01"),
    brief: "A retry policy that survives a rate limit without dropping a thread.",
    solution_count: 2,
    created_by: THEM.id,
    created_at: ISO("2026-08-20"),
  },
];

export const SOLUTIONS: Row[] = [1, 2].map((n) => ({
  id: `44444444-0000-4000-8000-0000000000s${n}`,
  bounty_id: BOUNTIES[0].id,
  solver_id: n === 1 ? ME.id : THEM.id,
  status: n === 1 ? "submitted" : "accepted",
  body: "Back off exponentially and re-queue the thread rather than dropping it.",
  vote_count: n * 3,
  created_at: ISO("2026-09-01"),
  profiles: profile(n === 1 ? ME : THEM),
}));

/** The legacy generation's record, which /content/:id still renders. */
export const CONTENT_ITEMS: Row[] = [
  {
    id: CONTENT_ID,
    user_id: THEM.id,
    creator_id: THEM.id,
    slug: "legacy-inbox-blueprint",
    title: "Inbox triage blueprint (first generation)",
    description:
      "The original write-up, kept readable after the rebuild so no link in the wild goes dead.",
    content_type: "blueprint",
    category: "productivity",
    tags: ["email", "automation"],
    difficulty: "intermediate",
    status: "published",
    is_published: true,
    view_count: 2140,
    like_count: 96,
    save_count: 31,
    comment_count: 4,
    rating_avg: 4.6,
    rating_count: 12,
    cover_image_url: null,
    price: 0,
    is_free: true,
    created_at: ISO("2025-11-02"),
    updated_at: ISO("2026-01-15"),
    published_at: ISO("2025-11-03"),
    profiles: profile(THEM),
  },
];

export const CONTENT_BLOCKS: Row[] = [
  {
    id: "55555555-0000-4000-8000-0000000000b1",
    content_item_id: CONTENT_ID,
    block_type: "text",
    position: 0,
    content: { text: "Start with the classifier, not the drafter." },
    created_at: ISO("2025-11-02"),
  },
  {
    id: "55555555-0000-4000-8000-0000000000b2",
    content_item_id: CONTENT_ID,
    block_type: "prompt",
    position: 1,
    content: { text: "Classify this email into reply, read, or ignore." },
    created_at: ISO("2025-11-02"),
  },
];

export const NOTIFICATIONS: Row[] = [
  ["follow", "Maren started following you", false],
  ["reproduction", "Someone reproduced Inbox triage agent", false],
  ["bounty_solution", "A solution arrived on your gap", true],
  ["comment", "Maren replied on your build", true],
].map(([kind, body, read], n) => ({
  id: `77777777-0000-4000-8000-00000000000${n}`,
  user_id: ME.id,
  actor_id: THEM.id,
  type: kind,
  subkind: kind,
  title: body,
  body,
  message: body,
  is_read: read,
  read_at: read ? ISO("2026-09-11") : null,
  link: `/b2/${BUILD_SLUG}`,
  entity_id: BUILD_ID,
  created_at: ISO(`2026-09-1${4 - n}`),
  actor: profile(THEM),
  profiles: profile(THEM),
}));

export const DM_THREADS: Row[] = [
  {
    id: THREAD_ID,
    created_by: THEM.id,
    created_at: ISO("2026-09-01"),
    last_message_at: ISO("2026-09-14"),
    subject: null,
    unread_count: 2,
  },
];

export const DM_THREAD_MEMBERS: Row[] = [ME, THEM].map((who) => ({
  thread_id: THREAD_ID,
  user_id: who.id,
  joined_at: ISO("2026-09-01"),
  last_read_at: who.id === ME.id ? ISO("2026-09-10") : ISO("2026-09-14"),
  profiles: profile(who),
}));

export const DM_MESSAGES: Row[] = [
  ["Did the retry policy ever land?", THEM.id, "2026-09-13"],
  ["Not yet — it is the open gap on the overnight build.", ME.id, "2026-09-13"],
  ["I will take a run at it tonight.", THEM.id, "2026-09-14"],
].map(([body, sender, day], n) => ({
  id: `66666666-0000-4000-8000-00000000m${n}0`,
  thread_id: THREAD_ID,
  sender_id: sender,
  body,
  content: body,
  created_at: ISO(day as string),
  edited_at: null,
  deleted_at: null,
  profiles: profile(sender === ME.id ? ME : THEM),
}));

export const COLLECTIONS: Row[] = [
  {
    id: "88888888-0000-4000-8000-000000000001",
    owner_id: ME.id,
    user_id: ME.id,
    slug: "worth-running",
    name: "Worth running",
    title: "Worth running",
    description: "The ones that survived a second week.",
    is_public: true,
    item_count: 4,
    created_at: ISO("2026-05-01"),
    updated_at: ISO("2026-09-01"),
  },
];

export const USER_LIBRARY: Row[] = BUILDS.slice(0, 3).map((b, n) => ({
  id: `99999999-0000-4000-8000-00000000000${n}`,
  user_id: ME.id,
  content_item_id: CONTENT_ID,
  build_id: b.id,
  folder_id: null,
  saved_at: ISO("2026-09-0" + (n + 1)),
  created_at: ISO("2026-09-0" + (n + 1)),
  builds: b,
  content_items: CONTENT_ITEMS[0],
}));

/** Tables the sweep seeds. Everything else answers with an empty list. */
const TABLES: Record<string, Row[]> = {
  profiles: PROFILES,
  builds: BUILDS,
  build_nodes: NODES,
  build_events: EVENTS,
  build_media: MEDIA,
  node_types: NODE_TYPES,
  bounties: BOUNTIES,
  solutions: SOLUTIONS,
  content_items: CONTENT_ITEMS,
  content_blocks: CONTENT_BLOCKS,
  notifications: NOTIFICATIONS,
  dm_threads: DM_THREADS,
  dm_thread_members: DM_THREAD_MEMBERS,
  dm_messages: DM_MESSAGES,
  collections: COLLECTIONS,
  user_library: USER_LIBRARY,
};

/** RPCs whose shape is an object rather than a list. */
const RPCS: Record<string, unknown> = {
  gallery_facets: {
    roles: [
      { value: "founder", count: 6, label: null, logo_url: null },
      { value: "lawyer", count: 2, label: null, logo_url: null },
    ],
    tools: [
      { value: "Claude", count: 7, label: "Claude", logo_url: null },
      { value: "n8n", count: 2, label: "n8n", logo_url: null },
    ],
  },
};

/* ───────────────────────── the stub ───────────────────────── */

/** A 4:3 PNG, solid colour, under 300 bytes — enough to give a slot a real ratio. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAKAAAABaCAIAAACwpMoFAAAAoklEQVR42u3RMQ0AAAgEsfevgYkRlfiAJqfgmurR4WIBYAEWYAEWYAEWYMACLMACLMACLMACDFiABViABViABViABRiwAAuwAAuwAAswYAEWYAEWYAEWYMACLMACLMACLMACDFiABViABViABRiwAAuwAAuwAAswYBcAC7AAC7AAC7AAAxZgARZgARZgAQYswAIswAIswAIswIAFWIAFWIAFWIB/td3jQEZmUes7AAAAAElFTkSuQmCC";

const wantsObject = (route: Route) =>
  (route.request().headers()["accept"] ?? "").includes("pgrst.object");

function json(route: Route, rows: Row[]) {
  const body = wantsObject(route)
    ? JSON.stringify(rows[0] ?? null)
    : JSON.stringify(rows);
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: {
      "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}`,
      "access-control-allow-origin": "*",
    },
    body,
  });
}

/** Set the theme before first paint, the way index.html's boot script reads it. */
export async function withTheme(page: Page, theme: Theme) {
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem("bg-theme", value as string);
    } catch {
      /* private window — the default room is still a ground worth measuring */
    }
  }, theme);
}

/** Put a signed-in session in storage, so ProtectedRoute lets the sweep through. */
export async function withSession(page: Page) {
  const ref = projectRef();
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  const session = {
    access_token: fakeJwt({ sub: ME.id, exp: expiresAt, role: "authenticated" }),
    token_type: "bearer",
    expires_in: 60 * 60 * 24,
    expires_at: expiresAt,
    refresh_token: "audit-refresh-token",
    user: {
      id: ME.id,
      aud: "authenticated",
      role: "authenticated",
      email: "audit@example.test",
      email_confirmed_at: new Date(0).toISOString(),
      phone: "",
      confirmed_at: new Date(0).toISOString(),
      last_sign_in_at: new Date(0).toISOString(),
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: { username: ME.username },
      identities: [],
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
      is_anonymous: false,
    },
  };
  await page.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key as string, value as string);
      } catch {
        /* nothing to do — the route will redirect and the sweep measures that */
      }
    },
    [`sb-${ref}-auth-token`, JSON.stringify(session)],
  );
}

/**
 * Answer every boundary the app talks through. Widest first: the catch-all is
 * registered before the specific handlers, because the last match wins.
 */
export async function installStub(page: Page) {
  // Fonts. Served locally so an offline sweep measures the same glyph boxes as
  // an online one, and so a font fetch cannot make a route flake.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => {
    if (route.request().url().includes("css2")) {
      return route.fulfill({ status: 200, contentType: "text/css", body: "" });
    }
    return route.fulfill({ status: 200, contentType: "font/woff2", body: "" });
  });

  await page.route(/\/rest\/v1\//, (route) => json(route, []));

  for (const [table, rows] of Object.entries(TABLES)) {
    await page.route(new RegExp(`/rest/v1/${table}(\\?|$)`), (route) => {
      if (route.request().method() === "HEAD") {
        return route.fulfill({
          status: 200,
          headers: { "content-range": `*/${rows.length}` },
          body: "",
        });
      }
      if (route.request().method() !== "GET") {
        return json(route, rows.slice(0, 1));
      }
      return json(route, rows);
    });
  }

  for (const [name, payload] of Object.entries(RPCS)) {
    await page.route(new RegExp(`/rest/v1/rpc/${name}`), (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(payload),
      }),
    );
  }

  await page.route(/\/auth\/v1\//, (route) => {
    const url = route.request().url();
    if (url.includes("/user")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: ME.id, email: "audit@example.test", aud: "authenticated" }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.route(/\/storage\/v1\//, (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(PNG_BASE64, "base64"),
    }),
  );

  // The realtime socket is mocked rather than proxied: no server is contacted,
  // and the app's join frames go nowhere. A visual sweep needs no broker.
  await page.routeWebSocket(/\/realtime\/v1\//, () => {
    /* deliberately silent */
  });
}

/* ───────────────────────── the fifteen routes ───────────────────────── */

export interface AuditRoute {
  /** Short stable id — the first column of every report row. */
  id: string;
  path: string;
  /** Needs a signed-in session. */
  auth?: boolean;
  /** Run after load: open a sheet, switch a tab, focus a control. */
  after?: (page: Page) => Promise<void>;
  /** A selector that proves the route actually rendered its own content. */
  ready?: string;
}

export const ROUTES: AuditRoute[] = [
  { id: "home", path: "/" },
  { id: "gallery", path: "/gallery" },
  { id: "build", path: `/b2/${BUILD_SLUG}` },
  { id: "compose", path: "/compose/new", auth: true },
  {
    id: "publish",
    path: `/compose/${BUILD_ID}`,
    auth: true,
    // The publish sheet is a surface of the composer rather than a route of its
    // own, so the sweep opens it the way a person does.
    after: async (page) => {
      const opener = page
        .getByTestId("publish-open")
        .or(page.getByRole("button", { name: /publish/i }))
        .first();
      if (await opener.isVisible().catch(() => false)) {
        await opener.click().catch(() => {});
        await page.waitForTimeout(600);
      }
    },
  },
  { id: "import", path: "/import" },
  { id: "profile", path: `/profile/${THEM.username}` },
  { id: "library", path: "/library", auth: true },
  { id: "messages", path: "/messages", auth: true },
  { id: "notifications", path: "/notifications", auth: true },
  { id: "login", path: "/login" },
  { id: "signup", path: "/signup" },
  {
    id: "bounty-solve",
    path: `/b2/${GAP_BUILD_SLUG}`,
    auth: true,
    after: async (page) => {
      const open = page.getByTestId("solve-open").first();
      if (await open.isVisible().catch(() => false)) {
        await open.click().catch(() => {});
        await page.waitForTimeout(600);
      }
    },
  },
  /* THE FIFTEENTH ROUTE CURRENTLY CRASHES, AND THAT IS ITSELF A FINDING.
     `/content/:id` renders `ContentDetail.tsx`, which returns early at lines
     1476 and 1487 and then calls ten more `useMemo`/`useCallback` hooks from
     line 1597 on. The first render (loading, no post) runs the short list; the
     render after the post arrives runs the long one, React throws "Rendered
     more hooks than during the previous render", and the ErrorBoundary paints
     "Something went wrong" instead of the page. It reproduces on every cold
     load of a post that exists, in both rooms.
     
     It is a Rules-of-Hooks defect in legacy logic, and logic is outside what
     BG-P30 may touch, so it is REPORTED rather than fixed — and the route is
     kept in the sweep so that the day it is fixed, the sweep starts measuring
     the page instead of the error state. `/discover-legacy` is swept beside it
     so a legacy CONTENT surface is actually audited in the meantime. */
  { id: "legacy-content", path: `/content/${CONTENT_ID}` },
  { id: "legacy-discover", path: "/discover-legacy" },
  { id: "dev-kit", path: "/dev/kit" },
];

/** Routes that cannot render their own content yet, with the reason. */
export const DEGRADED: Record<string, string> = {
  "legacy-content":
    "ContentDetail.tsx calls hooks after two early returns — React throws on the " +
    "render after the post arrives and the ErrorBoundary paints instead. Logic, " +
    "so outside BG-P30; see the note above ROUTES.",
};

/** Open one audit route in one theme, with the network stubbed, and settle it. */
export async function openRoute(page: Page, route: AuditRoute, theme: Theme) {
  await withTheme(page, theme);
  if (route.auth) await withSession(page);
  await installStub(page);
  await page.goto(route.path, { waitUntil: "load" });
  // The reveal animations are 450ms and the feed's skeletons resolve on the
  // next tick; a measurement taken before that reads a surface mid-fade.
  await page.waitForTimeout(1500);
  await page
    .evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    .catch(() => {});
  if (route.after) await route.after(page);
}
