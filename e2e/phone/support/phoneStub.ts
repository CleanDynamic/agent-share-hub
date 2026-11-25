// Phone screens: a Supabase stub that renders the phone routes with no backend (prompt 21).
//
// Every `/rest/v1/**` and `/auth/v1/**` request is answered here and nothing reaches the network. Tables the pages read and the
// fixtures do not name answer an empty list (or null for a single-row read), so a page draws its empty state rather than
// failing. The fixtures are a small, fixed set: three builds (one with three posts), a rebuild, topics, a space and a topic
// with replies. They are kept for later prompts: `phoneFixtures` is the one place to add to.

import type { Page, Route } from "@playwright/test";

const NOW = Date.parse("2026-11-24T12:00:00Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

export const PEOPLE = {
  maya: { id: "00000000-0000-4000-8000-000000000001", username: "maya", display_name: "Maya Kent", avatar_url: null },
  dax: { id: "00000000-0000-4000-8000-000000000002", username: "dax", display_name: "Dax Ortiz", avatar_url: null },
  sam: { id: "00000000-0000-4000-8000-000000000003", username: "sam", display_name: "Sam Wu", avatar_url: null },
};

const text = (value: string) => ({ type: "paragraph", content: [{ type: "text", text: value }] });
const doc = (...posts: string[][]) => ({
  type: "doc",
  content: posts.flatMap((lines, index) => [...(index > 0 ? [{ type: "postBreak" }] : []), ...lines.map(text)]),
});

const COLUMNS = {
  cover_media_id: null,
  cover_bucket: null,
  cover_path: null,
  cover_kind: null,
  cover_poster_path: null,
  reproduction_count: 0,
  repro_note: null,
  repro_model: null,
  repro_user_username: null,
  repro_worked: null,
  last_confirmed_at: null,
  last_confirmed_model: null,
  made_for: null,
  status: "published",
  shape: "web_app",
  parent_build_id: null,
  source_title_at_fork: null,
  source_handle_at_fork: null,
  rebuild_note: null,
  rebuild_count: 0,
};

const feedRow = (id: string, who: (typeof PEOPLE)["maya"], title: string, minutes: number, over: Record<string, unknown> = {}) => ({
  item_kind: "build",
  item_at: ago(minutes),
  build_id: id,
  slug: id,
  title,
  outcome: null,
  creator_id: who.id,
  creator_username: who.username,
  creator_display: who.display_name,
  creator_avatar: null,
  ...COLUMNS,
  ...over,
});

const BUILDS = [
  { id: "b-calls", who: PEOPLE.maya, title: "Call notes that write themselves", minutes: 60, post_doc: doc(["Every sales call now ends with a summary in the CRM. It took one prompt and an afternoon."], ["Session 2 added the follow-up email draft, which the team edits before sending."], ["Session 3 handles the calls that go badly, which turned out to be the most useful part."]) },
  { id: "b-invoice", who: PEOPLE.sam, title: "Invoice chaser", minutes: 300, post_doc: doc(["A small script that reads overdue invoices and drafts a polite reminder for each client."]) },
  { id: "b-rebuild", who: PEOPLE.dax, title: "Call notes, with a calendar", minutes: 180, post_doc: doc(["Same pipeline, but it also books the follow-up on the calendar."]), parent_build_id: "b-calls", source_title_at_fork: "Call notes that write themselves", source_handle_at_fork: "maya", rebuild_note: "Same pipeline, but Session 2 runs the calendar step too.", item_kind: "rebuild" },
];

const TOPICS = [
  { id: "t-open", who: PEOPLE.sam, body: "How do I keep a prompt stable across models?\nI keep getting different formats from each one.", minutes: 90 },
  { id: "t-two", who: PEOPLE.maya, body: "What did you use to schedule the nightly run?\nLooking for something that is not cron.", minutes: 240 },
];

const feedRows = [
  ...BUILDS.map((b) => feedRow(b.id, b.who, b.title, b.minutes, b.item_kind ? { item_kind: b.item_kind, parent_build_id: b.parent_build_id, source_title_at_fork: b.source_title_at_fork, source_handle_at_fork: b.source_handle_at_fork, rebuild_note: b.rebuild_note } : {})),
  ...TOPICS.map((t) => ({
    ...feedRow(`post-${t.id}`, t.who, "", t.minutes, { item_kind: "post" }),
    post_id: t.id,
    post_created_at: ago(t.minutes),
    post_author_id: t.who.id,
    post_author_username: t.who.username,
    post_author_display: t.who.display_name,
    post_author_avatar: null,
    post_body: t.body,
    post_still_open: t.id === "t-open",
    post_reward_gbp: null,
    post_reply_count: 2,
  })),
].sort((a, b) => Date.parse(b.item_at) - Date.parse(a.item_at));

const buildRow = (b: (typeof BUILDS)[number]) => ({
  id: b.id,
  slug: b.id,
  title: b.title,
  outcome: null,
  shape: "web_app",
  creator_id: b.who.id,
  published_at: ago(b.minutes),
  post_doc: b.post_doc,
  classification: { built: "web_app", ai_role: "made_with_ai", skill: "no_coding" },
  models_used: [],
  like_count: 4,
  comment_count: 2,
  rebuild_count: 1,
  reproduction_count: 0,
  creator: PEOPLE[b.who.username as keyof typeof PEOPLE],
  status: "published",
  made_for: null,
  made_with: [],
  live_url: null,
  repo_url: null,
  hero_node_id: null,
  cover_media_id: null,
  completeness: 0,
  last_confirmed_at: null,
  last_confirmed_model: null,
  parent_build_id: b.parent_build_id ?? null,
  rebuild_note: b.rebuild_note ?? null,
  source_title_at_fork: b.source_title_at_fork ?? null,
  source_handle_at_fork: b.source_handle_at_fork ?? null,
  build_nodes: [],
  build_media: [],
});

const SPACE = {
  id: "00000000-0000-4000-8000-0000000000a1",
  slug: "claude-code",
  name: "Claude Code",
  description: "Builds, prompts and tools for people who work with Claude Code.",
  rules: "Be kind. Say what you built, what you used and what you would change.",
  creator_id: PEOPLE.sam.id,
  who_can_post: "anyone",
  post_order: "newest",
  default_view: "thread",
  rewards_allowed: true,
  reactions: null,
  created_at: ago(60 * 24 * 40),
};

const postRow = (id: string, who: (typeof PEOPLE)["maya"], body: string, minutes: number, over: Record<string, unknown> = {}) => ({
  id,
  author_id: who.id,
  parent_id: null,
  root_id: id,
  body,
  about_build_id: null,
  about_node_id: null,
  reward_gbp: null,
  still_open: false,
  tags: [],
  closes_at: null,
  pinned_by: null,
  pinned_at: null,
  hidden_by: null,
  hidden_reason: null,
  like_count: 3,
  reply_count: 3,
  created_at: ago(minutes),
  updated_at: ago(minutes),
  author: who,
  attachments: [],
  post_spaces: [{ space: { id: SPACE.id, slug: SPACE.slug, name: SPACE.name } }],
  replies: [],
  ...over,
});

const REPLIES = [
  postRow("r-pinned", PEOPLE.sam, "Pin the model in the prompt itself and keep a short example of the format you want.", 80, { parent_id: "t-open", root_id: "t-open", pinned_by: PEOPLE.sam.id, pinned_at: ago(70), reply_count: 0 }),
  postRow("r-one", PEOPLE.maya, "I do the same and then check the shape with a tiny schema before anything else runs.", 60, {
    parent_id: "t-open",
    root_id: "t-open",
    reply_count: 0,
    replies: [postRow("r-child", PEOPLE.dax, "A schema check caught most of mine too.", 30, { parent_id: "r-one", root_id: "t-open", reply_count: 0, replies: [] })],
  }),
  postRow("r-two", PEOPLE.dax, "Same problem here. What format are you after?", 45, { parent_id: "t-open", root_id: "t-open", reply_count: 0 }),
];

const TOPIC_ROWS = TOPICS.map((t) => postRow(t.id, t.who, t.body, t.minutes, { still_open: t.id === "t-open" }));

export interface StubLog {
  tables: Map<string, number>;
  /** The query strings of every read, by table, for finding what an empty answer covered. */
  urls: Map<string, string[]>;
}

/* ── signed in (mobile 29: the pages behind a session) ──
   A session for Maya, seeded where supabase-js keeps it, before the app loads. The access token is an unsigned JWT that
   never expires: it never leaves the browser, since every request is answered here. Opt in with `{ signedIn: {...} }`;
   without it the stub is signed out, as before. */

/** The project ref in VITE_SUPABASE_URL: supabase-js keeps the session under `sb-<ref>-auth-token`. */
const PROJECT_REF = "zybdotagjwektucfdkri";

const base64url = (value: string) => Buffer.from(value).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

export const SIGNED_IN_USER = {
  id: PEOPLE.maya.id,
  aud: "authenticated",
  role: "authenticated",
  email: "maya@example.test",
  email_confirmed_at: "2026-01-01T00:00:00.000Z",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};

function sessionFor(user: typeof SIGNED_IN_USER) {
  const exp = 4102444800; // 2100-01-01
  const token = [base64url(JSON.stringify({ alg: "HS256", typ: "JWT" })), base64url(JSON.stringify({ sub: user.id, role: "authenticated", aud: "authenticated", exp, email: user.email })), "stub"].join(".");
  return { access_token: token, refresh_token: "stub-refresh", token_type: "bearer", expires_in: exp - Math.floor(NOW / 1000), expires_at: exp, user };
}

/** Maya's draft rebuild of Sam's "Invoice chaser". */
const REBUILD_DRAFT_ID = "d-invoice-rebuild";

export interface SignedInOptions {
  /** profiles.is_admin, for /admin. */
  admin?: boolean;
}

/** What the signed-in pages read, answered for Maya. Null: the default answer. */
function signedInAnswer(name: string, query: string, single: boolean, options: SignedInOptions): unknown | null {
  const maya = PEOPLE.maya;
  if (name === "profiles" && query.includes(`id=eq.${maya.id}`)) {
    const row = { ...maya, banner_url: null, bio: null, website_url: null, twitter_handle: null, is_admin: Boolean(options.admin), is_creator: true, is_curator: false, curator_application_status: null, account_type: "creator", user_interests: [], follower_count: 12, following_count: 4, joined_at: "2026-01-01T00:00:00.000Z", onboarding_completed: true, terms_accepted_at: "2026-01-01T00:00:00.000Z" };
    return single ? row : [row];
  }
  if (name === "user_progress") {
    const row = { xp_total: 1240, level: 6, track: null, streak_days: 0, streak_best: 0, last_respec_at: null };
    return single ? row : [row];
  }
  /* Your progress: the maker's published builds (the draft read filters on creator too, but on status=eq.draft). */
  if (name === "builds" && query.includes(`creator_id=eq.${maya.id}`) && query.includes("status=in.")) {
    return BUILDS.filter((b) => b.who.id === maya.id).map((b, index) => ({
      ...buildRow(b),
      last_confirmed_at: null,
      last_confirmed_model: null,
      save_count: 3 + index,
      still_open_topics: 0,
      views: { views: [1530, 212][index] ?? 0 },
    }));
  }
  /* Rebuild: Maya's draft of Sam's "Invoice chaser" (/rebuild/b-invoice). */
  if (name === "builds") {
    const source = BUILDS.find((b) => b.id === "b-invoice");
    const header = source ? { ...buildRow(source), root_build_id: null, forked_from_event_id: null, source_content_item_id: null, monetisation_type: null, price_gbp: null, donation_enabled: false, cost_setup: null, cost_monthly: null, currency: null, time_to_first_result: null, created_at: new Date(NOW - 300 * 60_000).toISOString(), updated_at: new Date(NOW - 300 * 60_000).toISOString(), solves_node_id: null, making: null } : null;
    const draft = header ? { ...header, id: REBUILD_DRAFT_ID, slug: REBUILD_DRAFT_ID, title: "Invoice chaser, with a weekly summary", status: "draft", creator_id: maya.id, creator: maya, published_at: null, parent_build_id: "b-invoice", root_build_id: "b-invoice", source_title_at_fork: "Invoice chaser", source_handle_at_fork: "sam", rebuild_count: 0 } : null;
    if (query.includes("slug=eq.b-invoice")) return single ? header : [header];
    if (query.includes("parent_build_id=eq.b-invoice") && query.includes("status=eq.draft")) return single ? draft : [draft];
    if (query.includes(`id=eq.${REBUILD_DRAFT_ID}`)) return single ? draft : [draft];
    if (query.includes("id=eq.b-invoice")) return single ? header : [header];
  }
  if (name === "rpc/rebuild_tree") {
    const sam = PEOPLE.sam;
    return [{ id: "b-invoice", parent_build_id: null, depth: 0, slug: "b-invoice", title: "Invoice chaser", creator_id: sam.id, published_at: new Date(NOW - 300 * 60_000).toISOString(), reproduction_count: 0, rebuild_note: null }];
  }
  if (name === "content_reports") {
    return [{ id: "rep-1", target_type: "openbuild_post", target_id: "t-two", reason: "spam", note: null, created_at: new Date(NOW - 2 * 3600_000).toISOString(), reporter: { username: "newuser1", display_name: null } }];
  }
  return null;
}

/** Routes the page's Supabase traffic to the fixtures. Returns what was asked for, so a spec can see what an empty answer covered. */
export async function installPhoneStub(page: Page, options: { signedIn?: SignedInOptions } = {}): Promise<StubLog> {
  const log: StubLog = { tables: new Map(), urls: new Map() };
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "content-range": "0-0/*" }, body: JSON.stringify(body) });
  const signedIn = options.signedIn;

  if (signedIn) {
    const session = sessionFor(SIGNED_IN_USER);
    await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [`sb-${PROJECT_REF}-auth-token`, JSON.stringify(session)] as const);
    await page.route("**/auth/v1/**", (route) => {
      const url = route.request().url();
      if (url.includes("/user")) return json(route, SIGNED_IN_USER);
      if (url.includes("/token")) return json(route, session);
      if (url.includes("/logout")) return route.fulfill({ status: 204 });
      return json(route, {});
    });
    /* A live channel that joins and stays quiet, so a page that waits for its channel (Activity's "All caught up." is
       said only while live) can show its live state. Realtime's protocol 2.0.0 sends [join_ref, ref, topic, event,
       payload]; 1.0.0 sent an object. Joins are answered ok with the postgres changes echoed back with ids, as the server
       does; heartbeats and anything else are answered ok. Nothing is ever pushed. */
    await page.routeWebSocket(/\/realtime\/v1\/websocket/, (ws) => {
      ws.onMessage((message) => {
        if (typeof message !== "string") return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(message);
        } catch {
          return;
        }
        const array = Array.isArray(parsed);
        const [joinRef, ref, topic, event, payload] = array
          ? (parsed as [string | null, string | null, string, string, Record<string, unknown>])
          : (() => {
              const o = parsed as { join_ref?: string; ref?: string; topic: string; event: string; payload: Record<string, unknown> };
              return [o.join_ref ?? null, o.ref ?? null, o.topic, o.event, o.payload] as const;
            })();
        if (event === "phx_leave") return;
        const changes = ((payload?.config as { postgres_changes?: Record<string, unknown>[] } | undefined)?.postgres_changes ?? []).map((change, index) => ({ ...change, id: index + 1 }));
        const response = event === "phx_join" ? { postgres_changes: changes } : {};
        const reply = { status: "ok", response };
        ws.send(JSON.stringify(array ? [joinRef, ref, topic, "phx_reply", reply] : { join_ref: joinRef, ref, topic, event: "phx_reply", payload: reply }));
      });
    });
  } else {
    await page.route("**/auth/v1/**", (route) => (route.request().url().includes("/user") ? json(route, { message: "no session" }, 401) : json(route, { session: null, user: null })));
  }
  await page.route("**/realtime/v1/**", (route) => route.abort());
  await page.route("**/storage/v1/**", (route) => route.abort());
  await page.route("**/functions/v1/**", (route) => json(route, {}));
  await page.route("**/rest/v1/**", (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    const url = new URL(request.url());
    const name = url.pathname.replace("/rest/v1/", "");
    log.tables.set(name, (log.tables.get(name) ?? 0) + 1);
    log.urls.set(name, [...(log.urls.get(name) ?? []), decodeURIComponent(url.search)]);
    const single = (request.headers()["accept"] ?? "").includes("vnd.pgrst.object");
    if (signedIn) {
      const answer = signedInAnswer(name, decodeURIComponent(url.search), single, signedIn);
      if (answer !== null) return json(route, answer);
    }
    if (name === "rpc/get_build_feed") return json(route, feedRows);
    if (name === "builds") {
      /* A build by its address (the build page reads it by slug). */
      const slug = /[?&]slug=eq\.([^&]+)/.exec(decodeURIComponent(url.search))?.[1];
      if (slug) {
        const found = BUILDS.find((b) => b.id === slug);
        const row = found ? { ...buildRow(found), root_build_id: null, created_at: new Date(NOW - found.minutes * 60_000).toISOString(), updated_at: new Date(NOW - found.minutes * 60_000).toISOString(), making: null } : null;
        return json(route, single ? row : row ? [row] : []);
      }
      const ids = /[?&]id=in\.\(([^)]*)\)/.exec(decodeURIComponent(url.search))?.[1]?.split(",").map((id) => id.replace(/"/g, "")) ?? [];
      const rows = BUILDS.filter((b) => ids.includes(b.id)).map(buildRow);
      return json(route, single ? (rows[0] ?? null) : rows);
    }
    if (name === "post_spaces" && /select=space_id(&|$)/.test(url.search)) return json(route, [1, 2, 3].map(() => ({ space_id: SPACE.id })));
    if (name === "spaces") return json(route, single ? SPACE : [SPACE]);
    if (name === "openbuild_posts") {
      const query = decodeURIComponent(url.search);
      const one = /[?&]id=eq\.([^&]+)/.exec(query)?.[1];
      if (/select=id,\s*parent_id&root_id/.test(query)) return json(route, [{ id: "t-open", parent_id: null }, ...REPLIES.map((r) => ({ id: r.id, parent_id: r.parent_id })), { id: "r-child", parent_id: "r-one" }]);
      if (one) {
        const row = TOPIC_ROWS.find((t) => t.id === one);
        const found = row ? { ...row, replies: REPLIES } : null;
        return json(route, single ? found : found ? [found] : []);
      }
      return json(route, single ? null : TOPIC_ROWS);
    }
    return json(route, single ? null : []);
  });
  return log;
}
