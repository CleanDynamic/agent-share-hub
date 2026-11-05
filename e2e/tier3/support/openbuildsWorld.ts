/* eslint-disable @typescript-eslint/no-explicit-any -- a fake backend: the rows are whatever the page asks for. */
// UX-05: a small in-memory backend for the OpenBuilds specs, answering PostgREST the way the pages ask.
//
// THE BACKEND IS FAKED (as bounties-board.spec.ts does): /rest/v1/, /auth/v1/, /storage/v1/ and /functions/v1/ are answered here, the
// realtime socket and the font CDN are silenced. State is shared by every page that installs the same world, so a second, signed-out
// context sees what a signed-in one wrote. It cannot prove a policy: it models the one rule these specs lean on (a signed-out reader
// never gets a hidden post) so the CLIENT's own filters are what is under test.

import type { Page, Route } from "@playwright/test";

import { ME, projectRef } from "../../tier2/support/supabaseStub";

type Row = Record<string, any>;

export interface World {
  /** UX-06: builds, their tiles and sessions, as plain tables the build layer reads and writes. */
  builds: Row[];
  nodes: Row[];
  sessions: Row[];
  spaces: Row[];
  members: Row[];
  posts: Row[];
  /** UX-07: the signed-in reader's notifications, as rc_notify writes them. */
  notifications: Row[];
  created: { rpc: Row[]; spaces: Row[]; patches: Row[] };
  seq: number;
  /** Requests the feed made, for specs that look at what was asked. */
  asked: string[];
  /** Hold the next read of the feed until released, so a spec can look at the page while it waits. */
  hold: { release: (() => void) | null; armed: boolean };
}

const AUTHOR = { id: ME.id, username: ME.username, display_name: ME.display_name, avatar_url: null };
const KIT = { id: "00000000-0000-4000-8000-0000000000cc", username: "kit", display_name: "Kit Ward", avatar_url: null };

export function newWorld(): World {
  const claude = { id: "s-claude", slug: "claude-code", name: "Claude Code", description: "Work made with Claude Code", rules: "", creator_id: KIT.id, who_can_post: "anyone", post_order: "newest", default_view: "thread", rewards_allowed: true, reactions: [], created_at: "2026-10-01T00:00:00Z" };
  const post = (n: number, extra: Row = {}): Row => ({
    id: `p${n}`,
    author_id: KIT.id,
    parent_id: null,
    root_id: `p${n}`,
    body: `Post number ${n}\nSome words about number ${n}`,
    about_build_id: null,
    about_node_id: null,
    reward_gbp: null,
    still_open: n % 2 === 0,
    tags: [],
    closes_at: null,
    pinned_by: null,
    pinned_at: null,
    hidden_by: null,
    hidden_reason: null,
    like_count: 0,
    reply_count: 0,
    created_at: new Date(Date.parse("2026-11-03T12:00:00Z") - n * 3_600_000).toISOString(),
    updated_at: "2026-11-03T12:00:00Z",
    author: KIT,
    attachments: [],
    post_spaces: [{ space: { id: claude.id, slug: claude.slug, name: claude.name } }],
    ...extra,
  });
  return {
    builds: [{ id: "b1", slug: "resume-screener", title: "Resume screener", made_with: ["claude-code"], status: "published", creator_id: ME.id, making: {}, reproduction_count: 0, last_confirmed_at: null, last_confirmed_model: null, published_at: "2026-10-01T00:00:00Z", allow_as_post_source: true, parent_build_id: null, source_handle_at_fork: null, updated_at: "2026-10-01T00:00:00Z", created_at: "2026-10-01T00:00:00Z", session_count: 0 }],
    nodes: [
      { id: "n1", build_id: "b1", parent_id: null, type: "prompt", title: "Take the CV", position: 0, is_gap: false, payload: { text: "Read the CV." }, source_ref: null, note: null },
      { id: "n2", build_id: "b1", parent_id: null, type: "code", title: "Rubric", position: 1, is_gap: false, payload: { source: "score = 0" }, source_ref: null, note: null },
    ],
    sessions: [],
    spaces: [claude],
    members: [{ space_id: claude.id, user_id: KIT.id, role: "moderator" }],
    posts: [post(1), post(2), post(3), post(4)],
    notifications: [],
    created: { rpc: [], spaces: [], patches: [] },
    seq: 0,
    asked: [],
    hold: { release: null, armed: false },
  };
}

/** UX-06: give a post replies, as rows the database would hold. `build` attaches the world's build b1 (or another id) to a reply. */
export function addReplies(world: World, rootId: string, replies: { id: string; parent?: string; body: string; author?: "me" | "kit"; build?: string; step?: string; aboutNodeId?: string; minutesAgo: number }[]): void {
  for (const entry of replies) {
    const author = entry.author === "me" ? AUTHOR : KIT;
    world.posts.push({
      id: entry.id,
      author_id: author.id,
      parent_id: entry.parent ?? rootId,
      root_id: rootId,
      body: entry.body,
      about_build_id: entry.aboutNodeId ? "b1" : null,
      about_node_id: entry.aboutNodeId ?? null,
      reward_gbp: null,
      still_open: false,
      tags: [],
      closes_at: null,
      pinned_by: null,
      pinned_at: null,
      hidden_by: null,
      hidden_reason: null,
      like_count: 0,
      reply_count: 0,
      created_at: new Date(Date.parse("2026-11-04T12:00:00Z") - entry.minutesAgo * 60_000).toISOString(),
      updated_at: "2026-11-04T12:00:00Z",
      author,
      attachments: entry.build
        ? [{ position: 0, kind: "build", build_id: entry.build, node_id: null, part_key: null, session_key: null, media_path: null, media_kind: null, snapshot: null }]
        : entry.step
          ? [{ position: 0, kind: "step", build_id: "b1", node_id: entry.step, part_key: null, session_key: null, media_path: null, media_kind: null, snapshot: null }]
          : [],
      post_spaces: [],
    });
  }
  const root = world.posts.find((post) => post.id === rootId);
  if (root) root.reply_count = world.posts.filter((post) => post.root_id === rootId && post.parent_id !== null).length;
}

/** A post with its replies two levels deep, as getPost's one embedded read returns it. */
function threadRow(world: World, post: Row, depth: number): Row {
  const replies = depth >= 2 ? [] : world.posts.filter((entry) => entry.parent_id === post.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { ...post, replies: replies.map((reply) => threadRow(world, reply, depth + 1)) };
}

/** UX-07: the feed function's rows for the world's topics: a 'post' row each, and a 'reply_group' row for each with replies. */
function feedRows(world: World): Row[] {
  const person = (prefix: string, author: Row | undefined) => ({ [`${prefix}_id`]: author?.id ?? null, [`${prefix}_username`]: author?.username ?? null, [`${prefix}_display`]: author?.display_name ?? null, [`${prefix}_avatar`]: null });
  const roots = world.posts.filter((post) => post.parent_id === null && post.hidden_by === null);
  const rows: Row[] = [];
  for (const root of roots) {
    const base = { build_id: null, slug: null, title: null, post_id: root.id, post_created_at: root.created_at, ...person("post_author", root.author), post_body: root.body, post_still_open: root.still_open, post_reward_gbp: root.reward_gbp, post_reply_count: root.reply_count };
    rows.push({ item_kind: "post", item_at: root.created_at, ...base });
    const newest = world.posts.filter((post) => post.root_id === root.id && post.parent_id !== null).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (newest) rows.push({ item_kind: "reply_group", item_at: newest.created_at, ...base, reply_id: newest.id, reply_at: newest.created_at, ...person("reply_author", newest.author), reply_body: newest.body, reply_new_count: null });
  }
  return rows.sort((a, b) => b.item_at.localeCompare(a.item_at));
}

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** UX-06: whether a row passes the query's plain filters (eq, neq, in, is, ilike). Embedded filters (a.b) and `or` are left alone. */
const passes = (row: Row, url: URL): boolean => {
  for (const [key, value] of url.searchParams) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns", "or"].includes(key) || key.includes(".")) continue;
    const cell = row[key];
    if (value.startsWith("eq.") && String(cell) !== value.slice(3)) return false;
    if (value.startsWith("neq.") && String(cell) === value.slice(4)) return false;
    if (value.startsWith("in.(") && !value.slice(4, -1).split(",").includes(String(cell))) return false;
    if (value === "is.null" && cell !== null && cell !== undefined) return false;
    if (value.startsWith("ilike.") && !new RegExp(value.slice(6).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*"), "i").test(String(cell ?? ""))) return false;
  }
  return true;
};

/** A node as the build layer selects it: the json paths it names lifted out of the payload. */
const nodeOut = (row: Row): Row => ({ ...row, tested: row.payload?.tested ?? null, setup: row.payload?.setup ?? null, step: row.payload?.step ?? null, text: row.payload?.text ?? null, source: row.payload?.source ?? null, session: row.payload?.session ?? null, contributor_id: row.contributor_id ?? null });

/** Plain reads and writes on one of the world's tables. */
function plainTable(world: World, rows: Row[], url: URL, method: string, body: any, prefix: string): Row[] {
  if (method === "POST") {
    const list = (Array.isArray(body) ? body : [body]) as Row[];
    return list.map((input) => {
      const known = input.id ? rows.find((row) => row.id === input.id) : undefined;
      if (known) return Object.assign(known, input);
      const row = { id: `${prefix}-${++world.seq}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...input };
      rows.push(row);
      return row;
    });
  }
  const matched = rows.filter((row) => passes(row, url));
  if (method === "PATCH") for (const row of matched) Object.assign(row, body, { updated_at: new Date().toISOString() });
  if (method === "DELETE") for (const row of matched) rows.splice(rows.indexOf(row), 1);
  return matched;
}

/** Pick `eq.`/`in.`/`is.` filters out of the query. */
const filter = (url: URL, name: string): string | null => url.searchParams.get(name);
const listOf = (value: string | null): string[] => (value?.startsWith("in.(") ? value.slice(4, -1).split(",") : value?.startsWith("eq.") ? [value.slice(3)] : []);

export async function installWorld(page: Page, world: World, options: { signedIn: boolean }): Promise<void> {
  const ref = projectRef();
  if (options.signedIn) {
    const expiresAt = Math.floor(Date.now() / 1000) + 86_400;
    const jwt = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: ME.id, exp: expiresAt, role: "authenticated" })}.sig`;
    const session = { access_token: jwt, token_type: "bearer", expires_in: 86_400, expires_at: expiresAt, refresh_token: "ux05", user: { id: ME.id, aud: "authenticated", role: "authenticated", email: "ux05@example.test", app_metadata: {}, user_metadata: {}, identities: [], created_at: new Date(0).toISOString() } };
    await page.addInitScript(([key, value]) => window.localStorage.setItem(key as string, value as string), [`sb-${ref}-auth-token`, JSON.stringify(session)] as const);
  }

  const reply = (route: Route, body: unknown, status = 200, extra: Record<string, string> = {}) => {
    const accept = route.request().headers()["accept"] ?? "";
    const wantsObject = accept.includes("pgrst.object");
    const payload = wantsObject && Array.isArray(body) ? (body[0] ?? null) : body;
    if (wantsObject && payload === null) return route.fulfill({ status: 406, contentType: "application/json", headers: CORS, body: JSON.stringify({ code: "PGRST116", message: "no rows", details: "", hint: "" }) });
    return route.fulfill({ status, contentType: "application/json", headers: { ...CORS, ...extra }, body: JSON.stringify(payload) });
  };

  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: route.request().url().includes("css2") ? "text/css" : "font/woff2", body: "" }));
  await page.routeWebSocket(/\/realtime\/v1\//, () => undefined);
  await page.route(/\/auth\/v1\//, (route) => route.fulfill({ status: 401, contentType: "application/json", headers: CORS, body: '{"msg":"no session"}' }));
  await page.route(/\/storage\/v1\//, (route) => route.fulfill({ status: 200, contentType: "application/json", headers: CORS, body: "[]" }));
  await page.route(/\/functions\/v1\//, (route) => route.fulfill({ status: 200, contentType: "application/json", headers: CORS, body: "{}" }));

  await page.route(/\/rest\/v1\//, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(request.url());
    const table = url.pathname.replace(/^.*\/rest\/v1\//, "");
    const select = url.searchParams.get("select") ?? "";
    const method = request.method();
    const body = (): any => {
      try {
        return JSON.parse(request.postData() || "null");
      } catch {
        return null;
      }
    };

    if (table === "rpc/create_post" && method === "POST") {
      const input = body().p as Row;
      world.created.rpc.push(input);
      const id = `new-${++world.seq}`;
      const spaces = world.spaces.filter((space) => ((input.space_ids as string[] | undefined) ?? []).includes(space.id));
      // UX-06: a reply names its parent; it sits in the parent's thread.
      const parent = input.parent_id ? world.posts.find((post) => post.id === input.parent_id) : null;
      world.posts.unshift({
        id,
        author_id: ME.id,
        parent_id: parent ? parent.id : null,
        root_id: parent ? parent.root_id : id,
        body: input.body,
        about_build_id: input.about_build_id ?? null,
        about_node_id: input.about_node_id ?? null,
        reward_gbp: input.reward_gbp ?? null,
        still_open: Boolean(input.still_open),
        tags: input.tags ?? [],
        closes_at: input.closes_at ?? null,
        pinned_by: null,
        pinned_at: null,
        hidden_by: null,
        hidden_reason: null,
        like_count: 0,
        reply_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: AUTHOR,
        attachments: ((input.attachments as Row[]) ?? []).map((attachment, position) => ({ position, kind: attachment.kind, build_id: attachment.build_id ?? null, node_id: attachment.node_id ?? null, part_key: attachment.part_key ?? null, session_key: attachment.session_key ?? null, media_path: null, media_kind: null, snapshot: attachment.snapshot ?? null })),
        post_spaces: spaces.map((space) => ({ space: { id: space.id, slug: space.slug, name: space.name } })),
      });
      return reply(route, id, 200);
    }

    // UX-07: the reader's notifications; opening one marks it read.
    if (table === "notifications") {
      if (method === "HEAD") return route.fulfill({ status: 200, headers: { ...CORS, "content-range": `0-0/${world.notifications.filter((row) => !row.is_read).length}` } });
      if (method === "PATCH") {
        const ids = listOf(filter(url, "id"));
        for (const row of world.notifications) if (ids.length === 0 || ids.includes(row.id)) Object.assign(row, body());
        return reply(route, []);
      }
      const rows = world.notifications.filter((row) => passes(row, url));
      return reply(route, rows, 200, { "content-range": `0-${Math.max(0, rows.length - 1)}/${rows.length}` });
    }

    // UX-07: Home's feed carries the world's topics, and a reply group for each topic with replies (its newest reply).
    if (table === "rpc/get_build_feed" && method === "POST") return reply(route, feedRows(world));

    if (table === "openbuild_posts") {
      // UX-07: Home's second read, the feed's posts by their ids.
      const ids = listOf(filter(url, "id"));
      if (method === "GET" && filter(url, "id")?.startsWith("in.(") && ids.length) {
        const topicOf = (post: Row) => world.posts.find((entry) => entry.id === post.root_id);
        return reply(route, world.posts.filter((post) => ids.includes(post.id) && post.hidden_by === null).map((post) => (select.includes("topic:") ? { ...post, topic: { body: topicOf(post)?.body ?? null } } : post)));
      }
      if (method === "PATCH") {
        const ids = listOf(filter(url, "id"));
        const patch = body() as Row;
        world.created.patches.push(patch);
        for (const post of world.posts) if (ids.includes(post.id)) Object.assign(post, patch);
        return reply(route, ids.map((id) => ({ id })));
      }
      world.asked.push(request.url());
      if (world.hold.armed && !url.searchParams.get("offset")?.startsWith("1") && world.hold.release === null && select.includes("author")) {
        await new Promise<void>((resolve) => {
          world.hold.release = resolve;
        });
        world.hold.armed = false;
        world.hold.release = null;
      }
      // UX-06: getPost's two reads, the post with its replies embedded, then the thread's (id, parent) pairs.
      const one = filter(url, "id");
      if (one?.startsWith("eq.") && select.includes("replies:")) {
        const found = world.posts.find((post) => post.id === one.slice(3) && (options.signedIn || post.hidden_by === null));
        return reply(route, found ? [threadRow(world, found, 0)] : []);
      }
      const root = filter(url, "root_id");
      if (root?.startsWith("eq.") && select.replace(/\s/g, "").startsWith("id,parent_id")) {
        return reply(route, world.posts.filter((post) => post.root_id === root.slice(3)).map((post) => ({ id: post.id, parent_id: post.parent_id })));
      }
      if (url.searchParams.has("root_id")) return reply(route, []);
      let rows = world.posts.filter((post) => post.parent_id === null);
      if (filter(url, "hidden_by") === "is.null" || !options.signedIn) rows = rows.filter((post) => post.hidden_by === null);
      if (filter(url, "still_open") === "eq.true") rows = rows.filter((post) => post.still_open);
      const inSpaces = listOf(filter(url, "post_spaces.space_id"));
      if (inSpaces.length) rows = rows.filter((post) => post.post_spaces.some((link: Row) => inSpaces.includes(link.space.id)));
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 20);
      return reply(route, rows.slice(offset, offset + limit));
    }

    if (table === "post_spaces") {
      return reply(route, world.posts.flatMap((post) => post.post_spaces.map((link: Row) => ({ space_id: link.space.id, post_id: post.id, created_at: post.created_at }))));
    }

    if (table === "spaces") {
      if (method === "POST") {
        const input = body() as Row;
        if (world.spaces.some((space) => space.slug === input.slug)) return reply(route, { code: "23505", message: "duplicate" }, 409);
        const row = { id: `s-${++world.seq}`, description: "", rules: "", who_can_post: "anyone", post_order: "newest", default_view: "thread", rewards_allowed: true, reactions: [], created_at: new Date().toISOString(), ...input };
        world.spaces.push(row);
        world.created.spaces.push(row);
        world.members.push({ space_id: row.id, user_id: row.creator_id, role: "moderator" });
        return reply(route, [row], 201);
      }
      const slug = filter(url, "slug");
      const ids = listOf(filter(url, "id"));
      return reply(
        route,
        world.spaces
          .filter((space) => (slug ? space.slug === slug.slice(3) : ids.length ? ids.includes(space.id) : true))
          .map((space) => (select.includes("creator:profiles") ? { ...space, creator: { username: space.creator_id === ME.id ? ME.username : KIT.username } } : space)),
      );
    }

    if (table === "space_members") {
      const spaceIds = listOf(filter(url, "space_id"));
      const spaceId = spaceIds[0] ?? null;
      const userId = filter(url, "user_id")?.slice(3) ?? null;
      if (method === "HEAD") return route.fulfill({ status: 200, headers: { ...CORS, "content-range": `0-0/${world.members.filter((member) => member.space_id === spaceId).length}` } });
      if (select.includes("space:spaces")) {
        return reply(route, world.members.filter((member) => member.user_id === userId).map((member) => ({ role: member.role, space: world.spaces.find((space) => space.id === member.space_id) })));
      }
      if (select.includes("profile:profiles")) {
        return reply(route, world.members.filter((member) => member.space_id === spaceId && member.role === "moderator").map((member) => ({ user_id: member.user_id, role: member.role, profile: member.user_id === ME.id ? AUTHOR : KIT })));
      }
      return reply(route, world.members.filter((member) => (spaceIds.length === 0 || spaceIds.includes(member.space_id)) && (!userId || member.user_id === userId)));
    }

    if (table === "profiles") {
      const username = filter(url, "username");
      const ids = listOf(filter(url, "id"));
      const all = [AUTHOR, KIT];
      return reply(route, all.filter((person) => (username ? person.username === username.slice(3) : ids.length ? ids.includes(person.id) : true)));
    }

    if (table === "builds") {
      if (method === "POST") {
        const made = plainTable(world, world.builds, url, method, { status: "draft", making: {}, made_with: [], reproduction_count: 0, session_count: 0, parent_build_id: null, ...body() }, "d");
        return reply(route, made, 201);
      }
      // UX-09 P3: Drafts' read of the topic each draft was made for, with the topic's author.
      if (select.includes("topic:openbuild_posts")) {
        const made = world.builds.filter((build) => build.status === "draft" && build.made_for_topic_id);
        return reply(route, made.map((build) => {
          const topic = world.posts.find((post) => post.id === build.made_for_topic_id);
          return { id: build.id, topic: topic ? { id: topic.id, author: topic.author_id === KIT.id ? { username: KIT.username } : { username: AUTHOR.username } } : null };
        }));
      }
      // Embedded reads (a draft's first prompt) come back empty.
      return reply(route, plainTable(world, world.builds, url, method, body(), "d").map((row) => ({ ...row, first_prompt: [] })));
    }

    if (table === "build_sessions") return reply(route, plainTable(world, world.sessions, url, method, body(), "bs"), method === "POST" ? 201 : 200);

    if (table === "build_nodes") {
      // The attach picker's steps, with their build embedded.
      if (select.includes("contributor_id") && select.includes("build:builds")) {
        const mine = request.url().includes("build.creator_id=eq.");
        return reply(route, mine ? [{ id: "n2", build_id: "b1", title: "Rubric", contributor_id: null, build: { id: "b1", title: "Resume screener", status: "published", creator_id: ME.id, allow_as_post_source: true } }] : []);
      }
      const rows = plainTable(world, world.nodes, url, method, body(), "node");
      return reply(route, rows.map(nodeOut), method === "POST" ? 201 : 200);
    }

    return reply(route, []);
  });
}
