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
  spaces: Row[];
  members: Row[];
  posts: Row[];
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
    spaces: [claude],
    members: [{ space_id: claude.id, user_id: KIT.id, role: "moderator" }],
    posts: [post(1), post(2), post(3), post(4)],
    created: { rpc: [], spaces: [], patches: [] },
    seq: 0,
    asked: [],
    hold: { release: null, armed: false },
  };
}

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };
const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

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
      const spaces = world.spaces.filter((space) => (input.space_ids as string[]).includes(space.id));
      world.posts.unshift({
        id,
        author_id: ME.id,
        parent_id: null,
        root_id: id,
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
        attachments: ((input.attachments as Row[]) ?? []).map((attachment, position) => ({ position, kind: attachment.kind, build_id: attachment.build_id ?? null, node_id: attachment.node_id ?? null, part_key: attachment.part_key ?? null, session_key: attachment.session_key ?? null, media_path: null, media_kind: null, snapshot: null })),
        post_spaces: spaces.map((space) => ({ space: { id: space.id, slug: space.slug, name: space.name } })),
      });
      return reply(route, id, 200);
    }

    if (table === "openbuild_posts") {
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
      return reply(route, world.spaces.filter((space) => (slug ? space.slug === slug.slice(3) : ids.length ? ids.includes(space.id) : true)));
    }

    if (table === "space_members") {
      const spaceId = filter(url, "space_id")?.slice(3) ?? null;
      const userId = filter(url, "user_id")?.slice(3) ?? null;
      if (method === "HEAD") return route.fulfill({ status: 200, headers: { ...CORS, "content-range": `0-0/${world.members.filter((member) => member.space_id === spaceId).length}` } });
      if (select.startsWith("role, space:spaces")) {
        return reply(route, world.members.filter((member) => member.user_id === userId).map((member) => ({ role: member.role, space: world.spaces.find((space) => space.id === member.space_id) })));
      }
      if (select.includes("profile:profiles")) {
        return reply(route, world.members.filter((member) => member.space_id === spaceId && member.role === "moderator").map((member) => ({ user_id: member.user_id, role: member.role, profile: member.user_id === ME.id ? AUTHOR : KIT })));
      }
      return reply(route, world.members.filter((member) => (!spaceId || member.space_id === spaceId) && (!userId || member.user_id === userId)));
    }

    if (table === "profiles") {
      const username = filter(url, "username");
      const ids = listOf(filter(url, "id"));
      const all = [AUTHOR, KIT];
      return reply(route, all.filter((person) => (username ? person.username === username.slice(3) : ids.length ? ids.includes(person.id) : true)));
    }

    if (table === "builds") {
      return reply(route, [{ id: "b1", slug: "resume-screener", title: "Resume screener", made_with: "Claude Code", status: "published", creator_id: ME.id, making: {}, reproduction_count: 0, last_confirmed_at: null, last_confirmed_model: null, published_at: "2026-10-01T00:00:00Z", allow_as_post_source: true }]);
    }

    if (table === "build_nodes") {
      if (select.includes("contributor_id")) {
        const mine = request.url().includes("build.creator_id=eq.");
        return reply(route, mine ? [{ id: "n2", build_id: "b1", title: "Rubric", contributor_id: null, build: { id: "b1", title: "Resume screener", status: "published", creator_id: ME.id, allow_as_post_source: true } }] : []);
      }
      return reply(route, [
        { id: "n1", build_id: "b1", parent_id: null, type: "prompt", title: "Take the CV", position: 0, is_gap: false, tested: null, setup: null, step: null, text: "Read the CV.", session: null },
        { id: "n2", build_id: "b1", parent_id: null, type: "code", title: "Rubric", position: 1, is_gap: false, tested: null, setup: null, step: null, text: "score = 0", session: null },
      ]);
    }

    return reply(route, []);
  });
}
