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

/* Prompt 29a: a post that arrives after the first read, for the pull to refresh. */
export const NEW_BUILD = { id: "b-fresh", who: PEOPLE.dax, title: "Standup notes from the call transcript", minutes: 2, post_doc: doc(["Fresh off the press: the standup writes its own notes from the meeting transcript."]) };

const TOPIC_ROWS = TOPICS.map((t) => postRow(t.id, t.who, t.body, t.minutes, { still_open: t.id === "t-open" }));

export interface StubLog {
  tables: Map<string, number>;
  /** The query strings of every read, by table, for finding what an empty answer covered. */
  urls: Map<string, string[]>;
}

/** Routes the page's Supabase traffic to the fixtures. Returns what was asked for, so a spec can see what an empty answer covered. */
export interface StubOptions {
  /** Prompt 29a: the second and later reads of the feed carry `NEW_BUILD` at the top, as a refresh would find it. */
  newPostsOnRefetch?: boolean;
}

export async function installPhoneStub(page: Page, options: StubOptions = {}): Promise<StubLog> {
  const log: StubLog = { tables: new Map(), urls: new Map() };
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", "content-range": "0-0/*" }, body: JSON.stringify(body) });

  await page.route("**/auth/v1/**", (route) => (route.request().url().includes("/user") ? json(route, { message: "no session" }, 401) : json(route, { session: null, user: null })));
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
    if (name === "rpc/get_build_feed") {
      const fresh = options.newPostsOnRefetch && (log.tables.get(name) ?? 0) > 1;
      return json(route, fresh ? [feedRow(NEW_BUILD.id, NEW_BUILD.who, NEW_BUILD.title, NEW_BUILD.minutes), ...feedRows] : feedRows);
    }
    if (name === "builds") {
      const ids = /[?&]id=in\.\(([^)]*)\)/.exec(decodeURIComponent(url.search))?.[1]?.split(",").map((id) => id.replace(/"/g, "")) ?? [];
      const rows = [...BUILDS, ...(options.newPostsOnRefetch ? [NEW_BUILD as (typeof BUILDS)[number]] : [])].filter((b) => ids.includes(b.id)).map(buildRow);
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
