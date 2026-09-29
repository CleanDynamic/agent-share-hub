// The social data layer (RC-P15).
//
// A stand-in for the PostgREST builder records every call and records a
// REQUEST when a builder is awaited, which is when supabase-js goes to the
// network. Each test sets what the request answers, so the claims are about
// how many requests there are, what each asks for, and what comes back.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
  builder: number;
}

type Answer = { data: unknown; error: unknown; status?: number };

let calls: Recorded[] = [];
let builders = 0;
let answer: (table: string, own: Recorded[]) => Answer = () => ({ data: [], error: null, status: 200 });
let session: { user: { id: string } } | null = { user: { id: "reader-1" } };

function builder(table: string) {
  const id = (builders += 1);
  const mine = () => calls.filter((call) => call.builder === id);
  const self: Record<string, unknown> = {};
  for (const method of [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "neq",
    "in",
    "gt",
    "lt",
    "order",
    "limit",
    "single",
    "maybeSingle",
  ]) {
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
    rpc: vi.fn(),
    auth: { getSession: vi.fn(async () => ({ data: { session } })) },
  },
}));

import {
  COMMENT_SELECT,
  SocialError,
  addComment,
  deleteComment,
  editComment,
  getEngagementCounts,
  getMyLikes,
  getMySaves,
  likeBuild,
  listComments,
  listMySavedBuilds,
  nestComments,
  saveBuild,
  unlikeBuild,
} from "@/lib/social";
import { isPermissionError } from "@/lib/errors/permission";

const requests = () => calls.filter((call) => call.method === "request");
const callOf = (method: string) => calls.find((call) => call.method === method);

const twenty = Array.from({ length: 20 }, (_, index) => `build-${index + 1}`);

function commentRow(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    build_id: "build-1",
    node_id: null,
    parent_id: null,
    author_id: "author-1",
    body: `Body of ${id}`,
    is_hidden: false,
    created_at: "2026-09-01T10:00:00.000Z",
    edited_at: null,
    author: { id: "author-1", username: "ann", display_name: "Ann", avatar_url: null },
    ...over,
  };
}

beforeEach(() => {
  calls = [];
  builders = 0;
  session = { user: { id: "reader-1" } };
  answer = () => ({ data: [], error: null, status: 200 });
});

describe("getMyLikes", () => {
  it("asks once for twenty builds", async () => {
    answer = () => ({ data: [{ build_id: "build-3" }, { build_id: "build-7" }], error: null, status: 200 });

    const liked = await getMyLikes(twenty);

    expect(requests()).toHaveLength(1);
    expect(callOf("in")?.args).toEqual(["build_id", twenty]);
    expect(callOf("eq")?.args).toEqual(["user_id", "reader-1"]);
    expect(callOf("limit")?.args).toEqual([20]);
    expect([...liked].sort()).toEqual(["build-3", "build-7"]);
  });

  it("asks nothing when nobody is signed in", async () => {
    session = null;
    expect((await getMyLikes(twenty)).size).toBe(0);
    expect(requests()).toHaveLength(0);
  });

  it("asks nothing for no builds, and each build once", async () => {
    await getMyLikes([]);
    expect(requests()).toHaveLength(0);
    await getMyLikes(["build-1", "build-1", "build-2"]);
    expect(callOf("in")?.args).toEqual(["build_id", ["build-1", "build-2"]]);
  });
});

describe("getMySaves and getEngagementCounts", () => {
  it("each asks once for a list of builds", async () => {
    await getMySaves(twenty);
    expect(requests()).toHaveLength(1);
    expect(calls[0].table).toBe("build_saves");

    calls = [];
    answer = () => ({
      data: [{ id: "build-1", like_count: 24, comment_count: 5 }],
      error: null,
      status: 200,
    });
    const counts = await getEngagementCounts(twenty);
    expect(requests()).toHaveLength(1);
    expect(calls[0].table).toBe("builds");
    expect(callOf("select")?.args).toEqual(["id, like_count, comment_count"]);
    expect(callOf("limit")?.args).toEqual([20]);
    expect(counts["build-1"]).toEqual({ likes: 24, comments: 5 });
  });
});

describe("likes and saves", () => {
  it("a second like is not an error", async () => {
    answer = () => ({ data: null, error: { code: "23505", message: "duplicate key" }, status: 409 });
    await expect(likeBuild("build-1")).resolves.toBeUndefined();
    await expect(saveBuild("build-1")).resolves.toBeUndefined();
  });

  it("a refusal is the typed no-access error", async () => {
    answer = () => ({ data: null, error: { code: "42501", message: "permission denied" }, status: 403 });
    const error = await unlikeBuild("build-1").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SocialError);
    expect((error as SocialError).kind).toBe("no_access");
    expect(isPermissionError(error)).toBe(true);
  });

  it("signed out, liking refuses without a request", async () => {
    session = null;
    const error = await likeBuild("build-1").catch((caught: unknown) => caught);
    expect((error as SocialError).kind).toBe("no_access");
    expect((error as SocialError).status).toBe(401);
    expect(requests()).toHaveLength(0);
  });
});

describe("listMySavedBuilds", () => {
  it("reads the saves newest first, then their builds by id, in save order", async () => {
    answer = (table) =>
      table === "build_saves"
        ? {
            data: [
              { build_id: "build-2", created_at: "2026-09-02T00:00:00.000Z" },
              { build_id: "build-1", created_at: "2026-09-01T00:00:00.000Z" },
            ],
            error: null,
            status: 200,
          }
        : {
            data: [
              { id: "build-1", build_nodes: [], build_media: [], bounties: [] },
              { id: "build-2", build_nodes: [], build_media: [], bounties: [] },
            ],
            error: null,
            status: 200,
          };

    const page = await listMySavedBuilds({ limit: 2, before: "2026-09-03T00:00:00.000Z" });

    expect(requests()).toHaveLength(2);
    expect(calls.filter((call) => call.builder === 1).map((call) => call.method)).toEqual([
      "select",
      "eq",
      "order",
      "limit",
      "lt",
      "request",
    ]);
    expect(page.items.map((item) => item.build.id)).toEqual(["build-2", "build-1"]);
    expect(page.nextBefore).toBe("2026-09-01T00:00:00.000Z");
  });
});

describe("listComments", () => {
  it("reads one page in one request, oldest first, author embedded", async () => {
    await listComments("build-1", { after: "2026-09-01T00:00:00.000Z" });
    expect(requests()).toHaveLength(1);
    expect(callOf("select")?.args).toEqual([COMMENT_SELECT]);
    expect(callOf("eq")?.args).toEqual(["build_id", "build-1"]);
    expect(callOf("gt")?.args).toEqual(["created_at", "2026-09-01T00:00:00.000Z"]);
    expect(callOf("order")?.args).toEqual(["created_at", { ascending: true }]);
    expect(callOf("limit")?.args).toEqual([50]);
  });

  it("nests replies under the comment they answer", async () => {
    answer = () => ({
      data: [
        commentRow("c1", { created_at: "2026-09-01T10:00:00.000Z" }),
        commentRow("c2", { created_at: "2026-09-01T11:00:00.000Z" }),
        commentRow("r1", { parent_id: "c1", created_at: "2026-09-01T12:00:00.000Z" }),
        commentRow("r2", { parent_id: "c1", created_at: "2026-09-01T13:00:00.000Z" }),
        commentRow("r3", { parent_id: "c2", created_at: "2026-09-01T14:00:00.000Z" }),
      ],
      error: null,
      status: 200,
    });

    const page = await listComments("build-1");

    expect(page.comments.map((thread) => thread.id)).toEqual(["c1", "c2"]);
    expect(page.comments[0].replies.map((reply) => reply.id)).toEqual(["r1", "r2"]);
    expect(page.comments[1].replies.map((reply) => reply.id)).toEqual(["r3"]);
    expect(page.comments[0].author).toEqual({ id: "author-1", username: "ann", displayName: "Ann", avatarUrl: null });
    expect(page.rows).toHaveLength(5);
    expect(page.nextAfter).toBeNull();
  });

  it("hangs a reply read on a later page under its comment, and leaves out a reply with no comment", () => {
    const first = [commentRow("c1")];
    const later = [
      commentRow("r1", { parent_id: "c1", created_at: "2026-09-02T10:00:00.000Z" }),
      commentRow("r9", { parent_id: "hidden", created_at: "2026-09-02T11:00:00.000Z" }),
    ];
    const threads = nestComments(
      [...first, ...later].map((row) => ({
        id: row.id,
        buildId: row.build_id,
        nodeId: row.node_id,
        parentId: row.parent_id,
        authorId: row.author_id,
        author: null,
        body: row.body,
        isHidden: row.is_hidden,
        createdAt: row.created_at,
        editedAt: row.edited_at,
      })),
    );
    expect(threads.map((thread) => [thread.id, thread.replies.map((reply) => reply.id)])).toEqual([["c1", ["r1"]]]);
  });
});

describe("addComment, editComment and deleteComment", () => {
  it("refuses a blank body before any request", async () => {
    const error = await addComment({ buildId: "build-1", body: "   " }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SocialError);
    expect((error as SocialError).kind).toBe("invalid");
    expect(requests()).toHaveLength(0);
    expect(calls).toHaveLength(0);

    await expect(editComment("c1", "\n\t ")).rejects.toBeInstanceOf(SocialError);
    expect(calls).toHaveLength(0);
  });

  it("sends the body trimmed, with the part and the parent", async () => {
    answer = () => ({ data: commentRow("c9", { body: "Worked on sonnet" }), error: null, status: 201 });
    const comment = await addComment({ buildId: "build-1", nodeId: "node-3", parentId: null, body: "  Worked on sonnet \n" });
    expect(callOf("insert")?.args[0]).toEqual({
      build_id: "build-1",
      author_id: "reader-1",
      body: "Worked on sonnet",
      node_id: "node-3",
      parent_id: null,
    });
    expect(comment.id).toBe("c9");
  });

  it("never puts the body in an error's message", async () => {
    const body = "my private client name is Acme Holdings";
    const refusals: Answer[] = [
      {
        data: null,
        error: {
          code: "23514",
          message: `new row violates check constraint; Failing row contains (${body})`,
          details: `Failing row contains (c1, build-1, ${body})`,
          hint: body,
        },
        status: 400,
      },
      { data: null, error: { code: "42501", message: body, details: body }, status: 403 },
      { data: null, error: { code: "", message: `TypeError: ${body}` }, status: 0 },
    ];
    const messages: string[] = [];
    for (const refusal of refusals) {
      answer = () => refusal;
      for (const attempt of [
        () => addComment({ buildId: "build-1", nodeId: "node-3", body }),
        () => editComment("c1", body),
        () => deleteComment("c1"),
        () => listComments("build-1"),
      ]) {
        const error = await attempt().catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(SocialError);
        messages.push((error as Error).message, String(error), JSON.stringify(error));
        expect((error as { cause?: unknown }).cause).toBeUndefined();
      }
    }
    const tooLong = await addComment({ buildId: "build-1", body: `${body} ${"x".repeat(4001)}` }).catch(
      (caught: unknown) => caught,
    );
    messages.push((tooLong as Error).message);

    expect(messages.filter((message) => message.includes("Acme"))).toEqual([]);
    expect(messages[0]).toBe("addComment failed: failed (code 23514, status 400, build build-1, node node-3)");
  });

  it("an edit that comes back with no row is not this reader's to make", async () => {
    answer = () => ({ data: null, error: null, status: 200 });
    const error = await editComment("c1", "new words").catch((caught: unknown) => caught);
    expect((error as SocialError).kind).toBe("no_access");
    expect(callOf("update")?.args[0]).toMatchObject({ body: "new words" });
  });
});
