// UX-06 P1: what the post page reads beyond getPost. One round, named columns, a limit on every list; and a build's harness
// read from `made_with`, which the database keeps as a list of tools.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
  builder: number;
}

let calls: Recorded[] = [];
let builders = 0;
let answer: (table: string, own: Recorded[]) => { data?: unknown; error?: unknown } = () => ({ data: [], error: null });
let session: { user: { id: string } } | null = { user: { id: "me" } };

function builder(table: string) {
  const id = (builders += 1);
  const mine = () => calls.filter((call) => call.builder === id);
  const self: Record<string, unknown> = {};
  for (const method of ["select", "insert", "eq", "neq", "in", "is", "not", "order", "limit", "range", "maybeSingle"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ table, method, args, builder: id });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
    calls.push({ table, method: "request", args: [], builder: id });
    return Promise.resolve(answer(table, mine())).then(resolve, reject);
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => builder(table), auth: { getSession: vi.fn(async () => ({ data: { session } })) } },
}));
vi.mock("./media", () => ({ signEntryMedia: vi.fn(async () => new Map([["me/a.png", "https://signed/a.png"]])) }));

import { readCardWork } from "./cardWork";
import { flattenThread, listMyLikes, readPostExtras, readSpaceCrowd } from "./postPage";
import type { PostThread } from "./types";

const reply = (id: string, extra: Partial<PostThread> = {}): PostThread => ({
  id,
  authorId: "kit",
  parentId: "p1",
  rootId: "p1",
  body: `Reply ${id}`,
  aboutBuildId: null,
  aboutNodeId: null,
  rewardGbp: null,
  stillOpen: false,
  tags: [],
  closesAt: null,
  pinnedBy: null,
  pinnedAt: null,
  hiddenBy: null,
  hiddenReason: null,
  likeCount: 0,
  createdAt: "2026-11-03T10:00:00Z",
  updatedAt: "2026-11-03T10:00:00Z",
  author: { id: "kit", handle: "kit", name: "Kit", avatarUrl: null },
  attachments: [],
  spaces: [],
  replyCount: 0,
  replies: [],
  ...extra,
});

const buildAttachment = (buildId: string) => ({ position: 0, kind: "build" as const, buildId, nodeId: null, partKey: null, sessionKey: null, mediaPath: null, mediaKind: null, snapshot: null });

const thread = (): PostThread =>
  reply("p1", {
    parentId: null,
    attachments: [buildAttachment("b-post")],
    spaces: [{ id: "s1", slug: "claude-code", name: "Claude Code" }],
    replies: [
      reply("r1", { attachments: [buildAttachment("b-kit")], replies: [reply("r1a", { parentId: "r1", attachments: [{ ...buildAttachment("x"), kind: "media", buildId: null, mediaPath: "me/a.png", mediaKind: "image" }] })] }),
      reply("r2"),
    ],
  });

beforeEach(() => {
  calls = [];
  builders = 0;
  session = { user: { id: "me" } };
  answer = () => ({ data: [], error: null });
});

describe("the post page's second round", () => {
  it("lists the post and every reply, the post first", () => {
    expect(flattenThread(thread()).map((post) => post.id)).toEqual(["p1", "r1", "r1a", "r2"]);
  });

  it("starts every read together, names its columns and limits every list", async () => {
    let inFlight = 0;
    let most = 0;
    answer = (table, own) => {
      inFlight += 1;
      most = Math.max(most, inFlight);
      queueMicrotask(() => (inFlight -= 1));
      // UX-07 P7: the spaces' switched-on reactions are a list read beside the crowd's one space.
      if (table === "spaces" && !own.some((call) => call.method === "maybeSingle")) return { data: [{ id: "s1", reactions: [] }], error: null };
      if (table === "spaces") return { data: { id: "s1", slug: "claude-code", name: "Claude Code", description: "", rules: "", creator_id: "sam", who_can_post: "anyone", post_order: "newest", default_view: "thread", rewards_allowed: false, reactions: [], created_at: "2026-10-01T00:00:00Z" }, error: null };
      if (table === "builds") return { data: [{ id: "b-kit", slug: "kits", title: "Kit's", status: "published", creator_id: "kit", parent_build_id: "b-post", source_handle_at_fork: "sam" }], error: null };
      return { data: [], error: null };
    };
    const extras = await readPostExtras(thread(), "me");

    expect(extras.facts.get("b-kit")).toMatchObject({ parentBuildId: "b-post", sourceHandle: "sam" });
    expect(extras.signed.get("me/a.png")).toBe("https://signed/a.png");
    for (const select of calls.filter((call) => call.method === "select")) expect(String(select.args[0])).not.toContain("*");
    const lists = new Set(calls.filter((call) => call.method === "select").map((call) => call.builder));
    for (const id of lists) expect(calls.some((call) => call.builder === id && (call.method === "limit" || call.method === "maybeSingle" || (call.method === "select" && (call.args[1] as { head?: boolean } | undefined)?.head)))).toBe(true);
    // The builds and the steps for the Wall name both attached builds at once.
    const nodes = calls.find((call) => call.table === "build_nodes" && call.method === "in" && call.args[0] === "build_id");
    expect(nodes?.args[1]).toEqual(["b-post", "b-kit"]);
  });

  it("asks for no likes signed out", async () => {
    session = null;
    expect(await listMyLikes(["p1"])).toEqual(new Set());
    expect(calls.filter((call) => call.table === "post_likes")).toHaveLength(0);
  });
});

describe("a build's harness", () => {
  it("reads made_with as the list the database keeps, naming the first tool", async () => {
    answer = (table) =>
      table === "builds"
        ? { data: [{ id: "b-kit", slug: "kits", title: "Kit's", made_with: ["claude-code", "cursor"], status: "published", reproduction_count: 0, last_confirmed_at: null, last_confirmed_model: null, published_at: null }], error: null }
        : { data: [], error: null };
    const work = await readCardWork([reply("r1", { attachments: [buildAttachment("b-kit")] })]);
    expect(work.builds.get("b-kit")?.madeWith).toBe("Claude Code");
  });
});

describe("the post's space", () => {
  it("is read by the id the post carries, every read in the same round, with the reader's role", async () => {
    let started = 0;
    let answered = 0;
    let startedBeforeAnyAnswer = 0;
    answer = (table, own) => {
      started += 1;
      if (answered === 0) startedBeforeAnyAnswer = started;
      queueMicrotask(() => (answered += 1));
      if (table === "spaces") return { data: { id: "s1", slug: "claude-code", name: "Claude Code", description: "", rules: "", creator_id: "sam", who_can_post: "anyone", post_order: "newest", default_view: "wall", rewards_allowed: false, reactions: [], created_at: "", creator: { username: "sam" } }, error: null };
      if (own.some((call) => call.method === "eq" && call.args[0] === "role")) return { data: [{ user_id: "ola", role: "moderator", profile: { username: "ola", display_name: "Ola", avatar_url: null } }], error: null };
      if (own.some((call) => call.method === "eq" && call.args[0] === "user_id")) return { data: { user_id: "me" }, error: null };
      return { data: null, error: null, count: 412 } as never;
    };
    const crowd = await readSpaceCrowd("s1", "me");
    expect(startedBeforeAnyAnswer).toBe(4);
    expect(crowd).toMatchObject({ space: { slug: "claude-code", defaultView: "wall" }, creator: { handle: "sam" }, moderators: [{ id: "ola", handle: "ola" }], members: 412, role: "member" });
    expect(calls.filter((call) => call.table === "spaces" && call.method === "eq").map((call) => call.args)).toEqual([["id", "s1"]]);
  });

  it("makes the space's maker and its moderators moderators, and nobody signed in a reader", async () => {
    answer = (table) => (table === "spaces" ? { data: { id: "s1", slug: "s", name: "S", description: "", rules: "", creator_id: "me", who_can_post: "anyone", post_order: "newest", default_view: "thread", rewards_allowed: false, reactions: [], created_at: "", creator: { username: "me" } }, error: null } : { data: [], error: null });
    expect((await readSpaceCrowd("s1", "me"))?.role).toBe("moderator");
    expect((await readSpaceCrowd("s1", null))?.role).toBe("none");
  });
});
