// UX-09 Part 2: the rebuilds of a build that are attached to a reply, read in one request by the source build, so the Rebuilds tab
// starts it with the cards (no round of its own).

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Recorded {
  table: string;
  method: string;
  args: unknown[];
}

let calls: Recorded[] = [];
let answer: { data: unknown; error: unknown } = { data: [], error: null };

function builder(table: string) {
  const self: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "is", "not", "order", "limit"]) {
    self[method] = (...args: unknown[]) => {
      calls.push({ table, method, args });
      return self;
    };
  }
  self.then = (resolve: (value: unknown) => unknown) => {
    calls.push({ table, method: "request", args: [] });
    return Promise.resolve(answer).then(resolve);
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => builder(table) } }));

import { MADE_IN_REPLY_LIMIT, listRebuildsMadeInReply } from "./connections";

describe("listRebuildsMadeInReply", () => {
  beforeEach(() => {
    calls = [];
    answer = { data: [], error: null };
  });

  it("is one request by the source build, with named columns and a limit", async () => {
    await listRebuildsMadeInReply("src-1");
    expect(calls.filter((call) => call.method === "request")).toHaveLength(1);
    expect(calls[0]).toMatchObject({ table: "post_attachments", method: "select" });
    const select = String(calls[0]?.args[0]);
    expect(select).not.toContain("*");
    expect(select).toContain("build:builds!inner(parent_build_id)");
    expect(calls).toContainEqual({ table: "post_attachments", method: "eq", args: ["build.parent_build_id", "src-1"] });
    expect(calls).toContainEqual({ table: "post_attachments", method: "eq", args: ["kind", "build"] });
    expect(calls).toContainEqual({ table: "post_attachments", method: "not", args: ["post.parent_id", "is", null] });
    expect(calls).toContainEqual({ table: "post_attachments", method: "limit", args: [MADE_IN_REPLY_LIMIT] });
  });

  it("maps each rebuild to its reply and the topic's author; the newest reply wins; a hidden or rootless one is left out", async () => {
    answer = {
      data: [
        { build_id: "r1", post: { id: "reply-old", root_id: "t1", created_at: "2026-10-01T00:00:00Z", root: { author: { username: "maya" } } } },
        { build_id: "r1", post: { id: "reply-new", root_id: "t2", created_at: "2026-11-01T00:00:00Z", root: { author: { username: "kit" } } } },
        { build_id: "r2", post: { id: "reply-2", root_id: "t3", created_at: "2026-11-01T00:00:00Z", root: { author: [{ username: "ola" }] } } },
        { build_id: "r3", post: null },
      ],
      error: null,
    };
    const made = await listRebuildsMadeInReply("src-1");
    expect(made.get("r1")).toEqual({ replyId: "reply-new", rootId: "t2", handle: "kit" });
    expect(made.get("r2")).toEqual({ replyId: "reply-2", rootId: "t3", handle: "ola" });
    expect(made.has("r3")).toBe(false);
  });

  it("says a refusal as a PostError", async () => {
    answer = { data: null, error: { code: "42501", message: "no" } };
    await expect(listRebuildsMadeInReply("src-1")).rejects.toThrow();
  });
});
