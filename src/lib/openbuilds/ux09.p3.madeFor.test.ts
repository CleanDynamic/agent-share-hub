// UX-09 Part 3: a step tile's draft made in a reply records its topic (builds.made_for_topic_id), and nothing else writes the column.
// The write is its own update, which may fail (the column is missing until the migration is applied) without stopping the reply.

import { beforeEach, describe, expect, it, vi } from "vitest";

const createBuild = vi.fn();
const addSessionCopy = vi.fn();
const getNodeTree = vi.fn();
const updates: { table: string; values: unknown; eq: unknown[] }[] = [];
let updateError: unknown = null;

vi.mock("@/lib/build/builds", () => ({ createBuild: (input: unknown) => createBuild(input) }));
vi.mock("@/lib/build/addSession", () => ({ addSessionCopy: (buildId: string, copy: unknown) => addSessionCopy(buildId, copy) }));
vi.mock("@/lib/build/nodes", () => ({ getNodeTree: (buildId: string) => getNodeTree(buildId) }));
vi.mock("@/lib/errors/report", () => ({ reportError: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      update: (values: unknown) => ({
        eq: async (...eq: unknown[]) => {
          updates.push({ table, values, eq });
          return { error: updateError };
        },
      }),
    }),
  },
}));

import { makeReplyDraft } from "./replyDraft";

beforeEach(() => {
  updates.length = 0;
  updateError = null;
  createBuild.mockReset().mockResolvedValue({ id: "d-new" });
  addSessionCopy.mockReset().mockResolvedValue({});
  getNodeTree.mockReset().mockResolvedValue([{ id: "tile-1", parent_id: null, payload: {} }]);
});

describe("UX-09 P3: the draft remembers its topic", () => {
  it("writes made_for_topic_id on the new draft, once", async () => {
    await makeReplyDraft("Reply: x", { kind: "prompt", text: "Score each CV", tool: null, model: null }, "topic-1");
    expect(updates).toEqual([{ table: "builds", values: { made_for_topic_id: "topic-1" }, eq: ["id", "d-new"] }]);
    // createBuild is asked for nothing new: the column is never part of the insert.
    expect(createBuild).toHaveBeenCalledWith({ title: "Reply: x" });
  });

  it("a refused write does not stop the reply", async () => {
    updateError = { code: "PGRST204", message: "column not found" };
    await expect(makeReplyDraft("Reply: x", { kind: "prompt", text: "a", tool: null, model: null }, "topic-1")).resolves.toEqual({ buildId: "d-new", nodeId: "tile-1" });
  });

  it("writes nothing without a topic", async () => {
    await makeReplyDraft("Reply: x", { kind: "prompt", text: "a", tool: null, model: null });
    expect(updates).toEqual([]);
  });
});
