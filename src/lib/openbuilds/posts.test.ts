// UX-04 P7: the data functions for posts, spaces and where they travel.
//
// The claims: every list has a limit and named columns; every write is the signed-in user's own and says its refusal in words;
// the database's plain refusals (a raised exception) reach the caller UNCHANGED and nothing else of the server's words does; work
// from a draft is copied at attach time and published work is referenced; a thread is read in two requests.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
  builder: number;
}
type Answer = { data?: unknown; error?: unknown; status?: number; count?: number | null };

let calls: Recorded[] = [];
let builders = 0;
let answer: (table: string, own: Recorded[]) => Answer = () => ({ data: [], error: null });
let rpcAnswer: Answer = { data: "post-1", error: null };
let session: { user: { id: string } } | null = { user: { id: "me" } };
let header: Record<string, unknown> | null = null;
let tree: unknown[] = [];

function builder(table: string) {
  const id = (builders += 1);
  const mine = () => calls.filter((call) => call.builder === id);
  const self: Record<string, unknown> = {};
  for (const method of ["select", "insert", "update", "delete", "upsert", "eq", "neq", "in", "is", "not", "gt", "or", "ilike", "order", "limit", "range", "single", "maybeSingle"]) {
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
  supabase: {
    from: (table: string) => builder(table),
    rpc: vi.fn(async (name: string, args: unknown) => {
      calls.push({ table: "rpc", method: name, args: [args], builder: 0 });
      return rpcAnswer;
    }),
    auth: { getSession: vi.fn(async () => ({ data: { session } })) },
  },
}));
vi.mock("@/lib/build/builds", () => ({ getBuildHeader: vi.fn(async () => header) }));
vi.mock("@/lib/build/nodes", () => ({ getNodeTree: vi.fn(async () => tree) }));

import {
  ABOUT_POSTS_LIMIT,
  PostError,
  countPostsStartedFrom,
  createPost,
  createReply,
  createSpace,
  editPost,
  getPost,
  getSpace,
  hidePost,
  inviteToSpace,
  joinSpace,
  leaveSpace,
  likePost,
  listAttachableWork,
  getNewReplyCounts,
  markTopicSeen,
  entryMediaPath,
  listMySpaces,
  listPosts,
  listPostsAbout,
  listPostsBy,
  listSpaces,
  pinPost,
  postKey,
  reactToPost,
  setModerator,
  unhidePost,
  unlikePost,
  unpinPost,
  updateSpace,
} from "./index";

const of = (table: string, method: string) => calls.filter((call) => call.table === table && call.method === method);
const requests = () => calls.filter((call) => call.method === "request").length;
const spaceRow = (over: Record<string, unknown> = {}) => ({
  id: "s1", slug: "support", name: "Support", description: "", rules: "", creator_id: "u1", who_can_post: "anyone",
  post_order: "newest", default_view: "thread", rewards_allowed: true, reactions: ["rating"], created_at: "2026-11-01T00:00:00Z", ...over,
});
const postRow = (over: Record<string, unknown> = {}) => ({
  id: "p1", author_id: "u1", parent_id: null, root_id: "p1", body: "How?", about_build_id: null, about_node_id: null, reward_gbp: "25.00",
  still_open: true, tags: ["mail"], closes_at: null, pinned_by: null, pinned_at: null, hidden_by: null, hidden_reason: null, like_count: 2,
  created_at: "2026-11-01T10:00:00Z", updated_at: "2026-11-01T10:00:00Z",
  author: { id: "u1", username: "maya", display_name: "Maya", avatar_url: null },
  attachments: [], post_spaces: [{ space: { id: "s1", slug: "support", name: "Support" } }], reply_count: 3, ...over,
});
const refusal = (message: string, code = "P0001") => ({ data: null, error: { code, message, details: "Failing row contains (secret words)" }, status: 400 });

beforeEach(() => {
  calls = [];
  builders = 0;
  session = { user: { id: "me" } };
  header = null;
  tree = [];
  answer = () => ({ data: [], error: null });
  rpcAnswer = { data: "post-1", error: null };
});

describe("query keys", () => {
  it("are ['posts', '<fn>', ...args]", () => {
    expect(postKey("getPost", "p1")).toEqual(["posts", "getPost", "p1"]);
  });
});

describe("spaces", () => {
  it("lists a page of spaces with named columns and a range", async () => {
    answer = () => ({ data: [spaceRow()], error: null });
    const page = await listSpaces({ limit: 1 });
    expect(of("spaces", "select")[0].args[0]).not.toBe("*");
    expect(of("spaces", "range")[0].args).toEqual([0, 0]);
    expect(page.spaces[0]).toMatchObject({ slug: "support", whoCanPost: "anyone", reactions: ["rating"], creatorId: "u1" });
    expect(page.next).toBe(1);
    answer = () => ({ data: [], error: null });
    expect((await listSpaces({ limit: 5 })).next).toBeNull();
  });

  it("lists the spaces the signed-in user belongs to, with their role, one request with a limit", async () => {
    answer = () => ({ data: [{ role: "moderator", space: spaceRow() }, { role: "member", space: null }], error: null });
    const spaces = await listMySpaces();
    expect(spaces).toHaveLength(1);
    expect(spaces[0]).toMatchObject({ slug: "support", role: "moderator" });
    expect(of("space_members", "eq")[0].args).toEqual(["user_id", "me"]);
    expect(of("space_members", "limit")[0].args).toEqual([100]);
    session = null;
    await expect(listMySpaces()).rejects.toThrow("Sign in to do that.");
  });

  it("reads one space by its lower-case slug, or null", async () => {
    answer = () => ({ data: spaceRow(), error: null });
    expect((await getSpace(" Support "))?.id).toBe("s1");
    expect(of("spaces", "eq")[0].args).toEqual(["slug", "support"]);
    answer = () => ({ data: null, error: null });
    expect(await getSpace("nope")).toBeNull();
  });

  it("creates a space as the signed-in user, and says a taken address in words", async () => {
    answer = () => ({ data: spaceRow(), error: null });
    await createSpace({ slug: "Support", name: " Support ", reactions: ["rating"] });
    expect(of("spaces", "insert")[0].args[0]).toEqual({ slug: "support", name: "Support", reactions: ["rating"], creator_id: "me" });
    answer = () => ({ data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } });
    await expect(createSpace({ slug: "support", name: "Support" })).rejects.toThrow("That address is taken.");
  });

  it("updates a space, and says it in words when someone else's update changes no row", async () => {
    answer = () => ({ data: spaceRow({ name: "New" }), error: null });
    expect((await updateSpace("s1", { name: "New", rewardsAllowed: false })).name).toBe("New");
    expect(of("spaces", "update")[0].args[0]).toEqual({ name: "New", rewards_allowed: false });
    answer = () => ({ data: null, error: null });
    await expect(updateSpace("s1", { name: "Mine now" })).rejects.toThrow("Only the person who made a space can change it.");
  });

  it("joins as a plain member, not twice-as-an-error, and says an invite-only space in words", async () => {
    await joinSpace("s1");
    expect(of("space_members", "insert")[0].args[0]).toEqual({ space_id: "s1", user_id: "me", role: "member", invited: false });
    answer = () => ({ data: null, error: { code: "23505", message: "dup" } });
    await expect(joinSpace("s1")).resolves.toBeUndefined();
    answer = () => ({ data: null, error: { code: "42501", message: "new row violates row-level security policy" } });
    await expect(joinSpace("s1")).rejects.toThrow("This space is invite only.");
  });

  it("leaves as the signed-in user, invites as a moderator, and makes a moderator only as the creator", async () => {
    await leaveSpace("s1");
    expect(of("space_members", "delete")).toHaveLength(1);
    expect(of("space_members", "eq").map((call) => call.args)).toEqual([["space_id", "s1"], ["user_id", "me"]]);

    await inviteToSpace("s1", "u9");
    expect(of("space_members", "insert").at(-1)?.args[0]).toEqual({ space_id: "s1", user_id: "u9", role: "member", invited: true });
    answer = () => ({ data: null, error: { code: "42501", message: "rls" } });
    await expect(inviteToSpace("s1", "u9")).rejects.toThrow("Only a moderator can invite people.");

    answer = () => ({ data: [{ user_id: "u9" }], error: null });
    await setModerator("s1", "u9", true);
    expect(of("space_members", "update")[0].args[0]).toEqual({ role: "moderator" });
    answer = () => ({ data: [], error: null });
    await expect(setModerator("s1", "u9", true)).rejects.toThrow("Only the person who made a space can change who moderates it.");
  });
});

describe("reading posts", () => {
  it("lists root posts that are not hidden, in a space, a page at a time", async () => {
    answer = () => ({ data: [postRow()], error: null });
    const page = await listPosts({ scope: "everyone", spaceId: "s1", stillOpen: true, offset: 20, limit: 1 });
    expect(String(of("openbuild_posts", "select")[0].args[0])).toContain("post_spaces!inner(");
    expect(of("openbuild_posts", "is").map((call) => call.args)).toEqual([["parent_id", null], ["hidden_by", null]]);
    expect(of("openbuild_posts", "eq").map((call) => call.args)).toEqual([["post_spaces.space_id", "s1"], ["still_open", true]]);
    expect(of("openbuild_posts", "range")[0].args).toEqual([20, 20]);
    expect(page.posts[0]).toMatchObject({ id: "p1", rewardGbp: 25, replyCount: 3, likeCount: 2, spaces: [{ slug: "support" }], author: { handle: "maya" } });
    expect(page.next).toBe(21);
  });

  it("orders a space that pins first by pin, then by time", async () => {
    await listPosts({ scope: "everyone", spaceId: "s1", order: "pinned_first" });
    expect(of("openbuild_posts", "order").map((call) => call.args[0])).toEqual(["pinned_at", "created_at"]);
  });

  it("lists every topic for Everyone, in a space or in none", async () => {
    answer = () => ({ data: [postRow({ post_spaces: [] })], error: null });
    const page = await listPosts({ scope: "everyone" });
    expect(String(of("openbuild_posts", "select")[0].args[0])).not.toContain("!inner");
    expect(of("openbuild_posts", "in")).toHaveLength(0);
    expect(page.posts[0].spaces).toEqual([]);
  });

  it("lists, for Following, the reader's own, the people they follow and the spaces they belong to, and no one else's", async () => {
    answer = (table) =>
      table === "follows" ? { data: [{ following_id: "u2" }, { following_id: "u3" }], error: null }
      : table === "space_members" ? { data: [{ space_id: "s1" }], error: null }
      : table === "post_spaces" ? { data: [{ post_id: "t9" }], error: null }
      : { data: [], error: null };
    await listPosts({ scope: "following" });
    expect(of("follows", "limit")[0].args).toEqual([1000]);
    expect(of("space_members", "eq")[0].args).toEqual(["user_id", "me"]);
    expect(of("openbuild_posts", "or")[0].args[0]).toBe("author_id.in.(me,u2,u3),id.in.(t9)");
  });

  it("falls back to the people alone when the reader belongs to no space", async () => {
    answer = (table) => (table === "follows" ? { data: [{ following_id: "u2" }], error: null } : { data: [], error: null });
    await listPosts({ scope: "following" });
    expect(of("openbuild_posts", "in")[0].args).toEqual(["author_id", ["me", "u2"]]);
    session = null;
    await expect(listPosts({ scope: "following" })).rejects.toThrow("Sign in to do that.");
  });

  it("sorts a space that is most replied by the stored reply count, then by time", async () => {
    await listPosts({ scope: "everyone", spaceId: "s1", order: "most_replied" });
    expect(of("openbuild_posts", "order").map((call) => call.args[0])).toEqual(["reply_count", "created_at"]);
  });

  it("reads a thread in two requests: two levels of replies with counts at every depth", async () => {
    const reply2 = postRow({ id: "r2", parent_id: "r1", root_id: "p1", body: "deeper", reply_count: 0 });
    const reply1 = postRow({ id: "r1", parent_id: "p1", root_id: "p1", body: "first", reply_count: 0, replies: [reply2] });
    answer = (table) => {
      if (table !== "openbuild_posts") return { data: [], error: null };
      const select = calls.filter((call) => call.method === "select" && call.table === "openbuild_posts").length;
      return select === 1
        ? { data: postRow({ replies: [reply1] }), error: null }
        : { data: [{ id: "r1", parent_id: "p1" }, { id: "r2", parent_id: "r1" }, { id: "r3", parent_id: "r2" }, { id: "r4", parent_id: "r3" }], error: null };
    };
    const thread = await getPost("p1");
    expect(requests()).toBe(2);
    expect(thread?.replies[0].replies[0].id).toBe("r2");
    // r2 has r3 and r4 under it: its count reaches the replies the first request did not carry.
    expect(thread?.replyCount).toBe(4);
    expect(thread?.replies[0].replyCount).toBe(3);
    expect(thread?.replies[0].replies[0].replyCount).toBe(2);
    expect(of("openbuild_posts", "limit").map((call) => call.args)).toContainEqual([50, { referencedTable: "replies" }]);
    expect(of("openbuild_posts", "limit").map((call) => call.args)).toContainEqual([1000]);
    expect(String(of("openbuild_posts", "select")[0].args[0])).toContain("attachments:post_attachments(");
  });

  it("returns null for a post that is not there, after one request", async () => {
    answer = () => ({ data: null, error: null });
    expect(await getPost("nope")).toBeNull();
    expect(requests()).toBe(1);
  });
});

describe("writing posts", () => {
  it("starts a post through create_post, in one call, with the user's spaces and mentions", async () => {
    expect(await createPost({ body: "Help", spaceIds: ["s1", "s1"], rewardGbp: 10, tags: ["mail"], mentionIds: ["u2"] })).toBe("post-1");
    const sent = (of("rpc", "create_post")[0].args[0] as { p: Record<string, unknown> }).p;
    expect(sent).toMatchObject({ body: "Help", space_ids: ["s1"], reward_gbp: 10, tags: ["mail"], mention_ids: ["u2"], attachments: [] });
    expect(sent).not.toHaveProperty("parent_id");
  });

  it("sends a reply with its parent and no spaces or reward", async () => {
    await createReply({ parentId: "p1", body: "Try a label" });
    const sent = (of("rpc", "create_post")[0].args[0] as { p: Record<string, unknown> }).p;
    expect(sent).toMatchObject({ parent_id: "p1", body: "Try a label" });
    expect(sent).not.toHaveProperty("space_ids");
    expect(sent).not.toHaveProperty("reward_gbp");
  });

  it("refers to published work and copies work from a draft at attach time", async () => {
    header = { id: "b1", status: "published", creator_id: "me", title: "Bot", slug: "bot", making: {} };
    await createPost({ body: "x", attachments: [{ kind: "build", buildId: "b1" }, { kind: "media", mediaPath: "me/pic.png", mediaKind: "image" }] });
    const published = (of("rpc", "create_post")[0].args[0] as { p: { attachments: Record<string, unknown>[] } }).p.attachments;
    expect(published[0]).toEqual({ kind: "build", build_id: "b1" });
    expect(published[1]).toEqual({ kind: "media", media_path: "me/pic.png", media_kind: "image" });

    header = { id: "b2", status: "draft", creator_id: "me", title: "Draft", slug: "draft", making: {} };
    tree = [{ id: "n1", type: "prompt", title: "Triage", note: null, payload: { text: "hi", build_cost: 9, trace_url: "https://x" }, children: [] }];
    await createReply({ parentId: "p1", attachments: [{ kind: "step", buildId: "b2", nodeId: "n1" }] });
    const draft = (of("rpc", "create_post")[1].args[0] as { p: { attachments: { node_id: string; snapshot: { title: string; payload: Record<string, unknown> } }[] } }).p.attachments[0];
    expect(draft.node_id).toBe("n1");
    expect(draft.snapshot.title).toBe("Triage");
    expect(draft.snapshot.payload).not.toHaveProperty("build_cost");
    expect(draft.snapshot.payload).not.toHaveProperty("trace_url");
  });

  it("lets the authorship refusals reach the caller unchanged", async () => {
    for (const message of ["A reply can attach only your own work.", "This build's maker doesn't allow it to start topics."]) {
      rpcAnswer = refusal(message);
      const error = await createReply({ parentId: "p1", attachments: [{ kind: "media", mediaPath: "me/a.png", mediaKind: "image" }] }).catch((caught) => caught);
      expect(error).toBeInstanceOf(PostError);
      expect(error.message).toBe(message);
    }
  });

  it("never copies the server's words for anything it did not write itself", async () => {
    rpcAnswer = refusal('new row for relation "posts" violates check constraint "posts_body_length"', "23514");
    const error = await createPost({ body: "my private words" }).catch((caught) => caught);
    expect(error.message).toBe("createPost failed (23514)");
    expect(error.message).not.toContain("private");
    rpcAnswer = refusal("new row violates row-level security policy", "42501");
    expect((await createPost({ body: "x", spaceIds: ["s1"] }).catch((caught) => caught)).message).toBe("You can't start a topic there.");
    expect((await createReply({ parentId: "p1" }).catch((caught) => caught)).message).toBe("You can't reply there.");
    session = null;
    await expect(createPost({ body: "x" })).rejects.toThrow("Sign in to do that.");
  });

  it("edits a post's own fields, and says it in words when nothing changed", async () => {
    answer = () => ({ data: [{ id: "p1" }], error: null });
    await editPost("p1", { body: "better", stillOpen: false });
    expect(of("openbuild_posts", "update")[0].args[0]).toEqual({ body: "better", still_open: false });
    answer = () => ({ data: [], error: null });
    await expect(editPost("p1", { body: "mine now" })).rejects.toThrow("Only the author can edit a topic or reply.");
  });

  it("pins, unpins, hides and unhides as the signed-in user", async () => {
    answer = () => ({ data: [{ id: "p1" }], error: null });
    await pinPost("p1");
    await unpinPost("p1");
    await hidePost("p1", " off topic ");
    await unhidePost("p1");
    expect(of("openbuild_posts", "update").map((call) => call.args[0])).toEqual([
      { pinned_by: "me" },
      { pinned_by: null },
      { hidden_by: "me", hidden_reason: "off topic" },
      { hidden_by: null },
    ]);
    answer = () => ({ data: [], error: null });
    await expect(hidePost("p1")).rejects.toThrow("Only the topic's author or a moderator can do that.");
  });

  it("likes and unlikes as the signed-in user; liking twice is not an error", async () => {
    await likePost("p1");
    expect(of("post_likes", "insert")[0].args[0]).toEqual({ post_id: "p1", user_id: "me" });
    answer = () => ({ data: null, error: { code: "23505", message: "dup" } });
    await expect(likePost("p1")).resolves.toBeUndefined();
    answer = () => ({ data: [], error: null });
    await unlikePost("p1");
    expect(of("post_likes", "delete")).toHaveLength(1);
  });

  it("reacts with a dislike or a rating, and lets the space's refusal through unchanged", async () => {
    await reactToPost("p1", { kind: "rating", value: 4 });
    await reactToPost("p1", { kind: "dislike" });
    expect(of("post_reactions", "upsert").map((call) => call.args[0])).toEqual([
      { post_id: "p1", user_id: "me", kind: "rating", value: 4 },
      { post_id: "p1", user_id: "me", kind: "dislike", value: null },
    ]);
    answer = () => refusal("Ratings are not switched on here.");
    await expect(reactToPost("p1", { kind: "rating", value: 3 })).rejects.toThrow("Ratings are not switched on here.");
  });
});

describe("what a reader has seen", () => {
  it("marks a topic seen once a minute, and not again inside the minute", async () => {
    expect(await markTopicSeen("t1", 1_000_000)).toBe(true);
    expect(await markTopicSeen("t1", 1_030_000)).toBe(false);
    expect(await markTopicSeen("t2", 1_030_000)).toBe(true);
    expect(await markTopicSeen("t1", 1_061_000)).toBe(true);
    expect(of("topic_reads", "upsert").map((call) => call.args)).toEqual([
      [{ user_id: "me", root_id: "t1", seen_at: new Date(1_000_000).toISOString() }, { onConflict: "user_id,root_id" }],
      [{ user_id: "me", root_id: "t2", seen_at: new Date(1_030_000).toISOString() }, { onConflict: "user_id,root_id" }],
      [{ user_id: "me", root_id: "t1", seen_at: new Date(1_061_000).toISOString() }, { onConflict: "user_id,root_id" }],
    ]);
    session = null;
    expect(await markTopicSeen("t9", 5_000_000)).toBe(false);
  });

  it("counts the new replies only for topics the reader has a mark on, from the mark, not by them", async () => {
    answer = (table, own) =>
      table === "topic_reads" ? { data: [{ root_id: "t1", seen_at: "2026-11-01T10:00:00Z" }], error: null }
      : own.some((call) => call.method === "gt") ? { data: [{ id: "a" }, { id: "b" }], error: null }
      : { data: [], error: null };
    expect(await getNewReplyCounts(["t1", "t2", "t1"])).toEqual({ t1: 2 });
    expect(of("openbuild_posts", "gt")[0].args).toEqual(["created_at", "2026-11-01T10:00:00Z"]);
    expect(of("openbuild_posts", "neq")[0].args).toEqual(["author_id", "me"]);
    expect(of("openbuild_posts", "limit")[0].args).toEqual([100]);
    session = null;
    expect(await getNewReplyCounts(["t1"])).toEqual({});
  });
});

describe("media on topics and replies", () => {
  it("goes in the build-media bucket under entries/<author id>/", () => {
    expect(entryMediaPath("u1", ".PNG")).toMatch(/^entries\/u1\/[0-9a-f-]{36}\.png$/);
  });
});

describe("where posts travel", () => {
  it("lists the posts about a build and counts them per step, in two requests started together", async () => {
    answer = (_table, own) =>
      own.some((call) => call.method === "not")
        ? { data: [{ about_node_id: "n1" }, { about_node_id: "n1" }, { about_node_id: "n2" }], error: null }
        : { data: [postRow({ about_build_id: "b1", about_node_id: "n1" })], error: null };
    const about = await listPostsAbout("b1");
    expect(requests()).toBe(2);
    expect(about.countsByStep).toEqual({ n1: 2, n2: 1 });
    expect(about.posts[0].aboutBuildId).toBe("b1");
    expect(of("openbuild_posts", "limit").map((call) => call.args[0])).toEqual([ABOUT_POSTS_LIMIT, 1000]);
  });

  it("lists a person's posts and replies, newest first, a page at a time", async () => {
    answer = () => ({ data: [postRow(), postRow({ id: "r1", parent_id: "p0", root_id: "p0" })], error: null });
    const page = await listPostsBy("u1", { limit: 2 });
    expect(of("openbuild_posts", "eq")[0].args).toEqual(["author_id", "u1"]);
    expect(of("openbuild_posts", "order")[0].args).toEqual(["created_at", { ascending: false }]);
    expect(page.posts).toHaveLength(2);
    expect(page.next).toBe(2);
  });

  it("counts the root posts started from a build with an estimated count", async () => {
    answer = () => ({ data: null, error: null, count: 7 });
    expect(await countPostsStartedFrom("b1")).toBe(7);
    expect(of("post_attachments", "select")[0].args[1]).toEqual({ count: "estimated", head: true });
    expect(of("post_attachments", "is")[0].args).toEqual(["openbuild_posts.parent_id", null]);
  });
});

describe("attachable work", () => {
  const build = (id: string, creator: string, status = "published", title = id) => ({ id, title, status, creator_id: creator, making: {} });

  it("offers a root post the user's own builds and other people's live builds that allow it", async () => {
    answer = (table, own) =>
      table === "builds"
        ? { data: own.some((call) => call.method === "neq") ? [build("b9", "u9")] : [build("b1", "me", "draft")], error: null }
        : { data: [], error: null };
    const work = await listAttachableWork({ userId: "me", size: "build" });
    expect(work.map((item) => [item.buildId, item.origin])).toEqual([["b1", "draft"], ["b9", "others"]]);
    const asked = of("builds", "eq").map((call) => call.args);
    expect(asked).toContainEqual(["allow_as_post_source", true]);
    expect(of("builds", "limit").every((call) => typeof call.args[0] === "number")).toBe(true);
  });

  it("offers a reply only the user's own", async () => {
    answer = (table) => (table === "builds" ? { data: [build("b1", "me", "published")], error: null } : { data: [], error: null });
    const work = await listAttachableWork({ userId: "me", size: "build", forReply: true });
    expect(work.map((item) => item.buildId)).toEqual(["b1"]);
    expect(of("builds", "neq")).toHaveLength(0);
  });

  it("offers steps by who made them: the contributor's, not the build maker's, where one is named", async () => {
    const node = (id: string, contributor: string | null, creator: string) => ({ id, build_id: `b-${creator}`, title: id, contributor_id: contributor, build: build(`b-${creator}`, creator) });
    answer = (table, own) => {
      if (table !== "build_nodes") return { data: [], error: null };
      if (own.some((call) => call.method === "neq" && call.args[0] === "build.creator_id") && own.some((call) => call.method === "in")) return { data: [node("theirs", null, "u9"), node("theirs-by-me", "me", "u9")], error: null };
      if (own.some((call) => call.method === "eq" && call.args[0] === "contributor_id")) return { data: [node("contributed", "me", "u9")], error: null };
      return { data: [node("mine", null, "me"), node("mine-but-contributed", "u5", "me")], error: null };
    };
    const forRoot = await listAttachableWork({ userId: "me", size: "step" });
    expect(forRoot.map((item) => item.nodeId).sort()).toEqual(["contributed", "mine", "theirs"]);
    const forReply = await listAttachableWork({ userId: "me", size: "step", forReply: true });
    expect(forReply.map((item) => item.nodeId).sort()).toEqual(["contributed", "mine"]);
  });

  it("offers parts and sessions from the builds' making, and what the user attached before", async () => {
    answer = (table) =>
      table === "builds"
        ? { data: [{ ...build("b1", "me"), making: { workstreams: [{ key: "ws-1", name: "Intake" }], sessions_meta: { s1: { tool: "claude-code", date: "2026-11-01", title: "First sitting" } } } }], error: null }
        : table === "post_attachments"
          ? { data: [{ build_id: "b1", node_id: null, part_key: "ws-1", session_key: null, build: { title: "b1", creator_id: "me" } }], error: null }
          : { data: [], error: null };
    const parts = await listAttachableWork({ userId: "me", size: "part", forReply: true });
    expect(parts.map((item) => [item.partKey, item.origin])).toEqual([["ws-1", "published"]]);
    const sessions = await listAttachableWork({ userId: "me", size: "session", forReply: true, query: "first" });
    expect(sessions.map((item) => item.sessionKey)).toEqual(["s1"]);
  });
});
