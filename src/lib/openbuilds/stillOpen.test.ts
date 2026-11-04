// UX-08 P1: publishing starts a topic for each still-open mark, once; a republish writes none; a failed write is a toast and the
// build stays published.

import { beforeEach, describe, expect, it, vi } from "vitest";

const createPost = vi.hoisted(() => vi.fn());
const posted = vi.hoisted(() => ({ rows: [] as unknown[], error: null as unknown }));
const toastError = vi.hoisted(() => vi.fn());

vi.mock("./posts", () => ({ createPost }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("@/lib/errors/report", () => ({ reportError: vi.fn() }));
vi.mock("@/lib/social/types", () => {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "limit"]) query[method] = () => query;
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: posted.rows, error: posted.error }).then(resolve);
  return { currentUserId: async () => "maker", db: { from: () => query } };
});

import type { NodeTree } from "@/lib/build/types";
import { sendStillOpenTopics, STILL_OPEN_FAILED } from "@/pages/site/compose/stillOpenTopics";

import { startStillOpenTopics, stillOpenMarksOf } from "./stillOpen";

const node = (id: string, over: Partial<NodeTree> = {}): NodeTree => ({ id, build_id: "b1", parent_id: null, type: "prompt", title: null, note: null, payload: {}, position: 1, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [], ...over }) as unknown as NodeTree;

const MAKING = {
  sessions_meta: { "typed-s2": { tool: "claude", date: "2026-11-01", open: { problem: "The deploy session" } } },
  workstreams: [{ key: "ws-a", name: "Part A", open: { problem: "A next session for retries" } }],
};
const TREE = [node("n1"), node("n2", { is_gap: true, payload: { gap_problem: "  The retry logic  " } as never })];

beforeEach(() => {
  createPost.mockReset();
  createPost.mockResolvedValue("t1");
  toastError.mockReset();
  posted.rows = [];
  posted.error = null;
});

describe("UX-08 P1 · the marks", () => {
  it("are the parts, the sessions and the step tiles marked, in that order", () => {
    expect(stillOpenMarksOf(MAKING, TREE)).toEqual([
      { size: "part", key: "ws-a", problem: "A next session for retries" },
      { size: "session", key: "typed-s2", problem: "The deploy session" },
      { size: "step", key: "n2", problem: "The retry logic" },
    ]);
    expect(stillOpenMarksOf({}, [node("n1")])).toEqual([]);
  });
});

describe("UX-08 P1 · publishing starts the topics", () => {
  it("two marks write two topics: the words as the body, the marked piece attached, still open, in no space", async () => {
    const marks = stillOpenMarksOf({ sessions_meta: MAKING.sessions_meta }, TREE);
    const result = await startStillOpenTopics({ buildId: "b1", marks });
    expect(result).toEqual({ started: 2, skipped: 0 });
    expect(createPost).toHaveBeenCalledTimes(2);
    expect(createPost).toHaveBeenNthCalledWith(1, { body: "The deploy session", spaceIds: [], attachments: [{ kind: "session", buildId: "b1", sessionKey: "typed-s2" }], aboutNodeId: null, stillOpen: true });
    expect(createPost).toHaveBeenNthCalledWith(2, { body: "The retry logic", spaceIds: [], attachments: [{ kind: "step", buildId: "b1", nodeId: "n2" }], aboutNodeId: "n2", stillOpen: true });
  });

  it("the spaces the checklist chose apply to all of them", async () => {
    await startStillOpenTopics({ buildId: "b1", marks: stillOpenMarksOf(MAKING, TREE), spaceIds: ["s1"] });
    expect(createPost.mock.calls.map((call) => (call[0] as { spaceIds: string[] }).spaceIds)).toEqual([["s1"], ["s1"], ["s1"]]);
  });

  it("a republish writes none: a mark already posted is not posted again", async () => {
    posted.rows = [
      { id: "t1", post_attachments: [{ kind: "session", node_id: null, part_key: null, session_key: "typed-s2" }] },
      { id: "t2", post_attachments: [{ kind: "step", node_id: "n2", part_key: null, session_key: null }] },
    ];
    const result = await startStillOpenTopics({ buildId: "b1", marks: stillOpenMarksOf({ sessions_meta: MAKING.sessions_meta }, TREE) });
    expect(result).toEqual({ started: 0, skipped: 2 });
    expect(createPost).not.toHaveBeenCalled();
  });

  it("with no marks nothing is read or written", async () => {
    expect(await startStillOpenTopics({ buildId: "b1", marks: [] })).toEqual({ started: 0, skipped: 0 });
    expect(createPost).not.toHaveBeenCalled();
  });

  it("a failed write is tried for the rest, then thrown", async () => {
    createPost.mockRejectedValueOnce(new Error("no"));
    await expect(startStillOpenTopics({ buildId: "b1", marks: stillOpenMarksOf({ sessions_meta: MAKING.sessions_meta }, TREE) })).rejects.toThrow("no");
    expect(createPost).toHaveBeenCalledTimes(2);
  });
});

describe("UX-08 P1 · a failed topic write", () => {
  it("is a toast and nothing else: sendStillOpenTopics does not throw", async () => {
    createPost.mockRejectedValue(new Error("no"));
    await expect(sendStillOpenTopics({ buildId: "b1", making: MAKING, tree: TREE, spaceIds: [] })).resolves.toBeUndefined();
    expect(toastError).toHaveBeenCalledWith("Your still-open topics didn't send. Try again from the build page.");
    expect(STILL_OPEN_FAILED).toBe("Your still-open topics didn't send. Try again from the build page.");
  });

  it("a failed read of what was posted is the same toast", async () => {
    posted.error = { code: "500" };
    await sendStillOpenTopics({ buildId: "b1", making: MAKING, tree: TREE, spaceIds: [] });
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(createPost).not.toHaveBeenCalled();
  });

  it("no marks, no toast, no write", async () => {
    await sendStillOpenTopics({ buildId: "b1", making: {}, tree: [node("n1")], spaceIds: [] });
    expect(toastError).not.toHaveBeenCalled();
    expect(createPost).not.toHaveBeenCalled();
  });
});
