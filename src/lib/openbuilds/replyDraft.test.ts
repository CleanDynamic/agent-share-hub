// UX-06 Part 3: a step tile made inside a reply. One draft named after the post (`Reply: <heading>`), with one session and the one
// step tile, written by the build layer's own functions; then the reply attaches that step, so it carries the step's copy.

import { beforeEach, describe, expect, it, vi } from "vitest";

const createBuild = vi.fn();
const addSessionCopy = vi.fn();
const getNodeTree = vi.fn();

vi.mock("@/lib/build/builds", () => ({ createBuild: (input: unknown) => createBuild(input) }));
vi.mock("@/lib/build/addSession", () => ({ addSessionCopy: (buildId: string, copy: unknown) => addSessionCopy(buildId, copy) }));
vi.mock("@/lib/build/nodes", () => ({ getNodeTree: (buildId: string) => getNodeTree(buildId) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { REPLY_HARNESSES, REPLY_MODELS, makeReplyDraft, replyTileInput } from "./replyDraft";

beforeEach(() => {
  createBuild.mockReset().mockResolvedValue({ id: "d-new", title: "Reply: Can anyone make the scorer faster?" });
  addSessionCopy.mockReset().mockResolvedValue({ buildId: "d-new", sessionKey: "typed-1", tiles: 1, collapsed: false, replaced: null });
  getNodeTree.mockReset().mockImplementation(async () => {
    const copy = addSessionCopy.mock.calls[0]?.[1] as { key: string } | undefined;
    return [{ id: "tile-1", build_id: "d-new", parent_id: null, position: 0, type: "prompt", title: null, payload: { text: "Score each CV", session: copy?.key }, children: [] }];
  });
});

describe("a step tile made in a reply", () => {
  it("makes one draft, named after the post, with one session and one step tile", async () => {
    const made = await makeReplyDraft("Reply: Can anyone make the scorer faster?", { kind: "prompt", text: "Score each CV", tool: "claude-code", model: "claude-opus-4-5" });
    expect(createBuild).toHaveBeenCalledTimes(1);
    expect(createBuild).toHaveBeenCalledWith({ title: "Reply: Can anyone make the scorer faster?" });
    expect(addSessionCopy).toHaveBeenCalledTimes(1);
    const [buildId, copy] = addSessionCopy.mock.calls[0] as [string, { key: string; meta: Record<string, unknown>; tiles: { type: string; payload: Record<string, unknown> }[] }];
    expect(buildId).toBe("d-new");
    expect(copy.key).toMatch(/^typed-/);
    expect(copy.meta).toMatchObject({ tool: "claude-code", model: "claude-opus-4-5" });
    expect(copy.tiles).toHaveLength(1);
    expect(copy.tiles[0]).toMatchObject({ type: "prompt", payload: { text: "Score each CV", model: "claude-opus-4-5" } });
    expect(made).toEqual({ buildId: "d-new", nodeId: "tile-1" });
  });

  it("keeps a code tile's lines where the composer keeps them", async () => {
    await makeReplyDraft("Reply: x", { kind: "code", text: "score = 0", tool: null, model: null });
    const copy = addSessionCopy.mock.calls[0][1] as { meta: Record<string, unknown>; tiles: { type: string; payload: Record<string, unknown> }[] };
    expect(copy.tiles[0]).toMatchObject({ type: "code", payload: { source: "score = 0" } });
    expect(copy.meta.tool).toBeNull();
    expect(copy.meta).not.toHaveProperty("model");
  });

  it("attaches the step it made, so the reply carries the step's copy", async () => {
    const made = await makeReplyDraft("Reply: x", { kind: "prompt", text: "Score each CV", tool: null, model: null });
    expect(replyTileInput(made)).toEqual({ kind: "step", buildId: "d-new", nodeId: "tile-1" });
  });

  it("offers the harnesses and models the composer offers", () => {
    expect(REPLY_HARNESSES.map((tool) => tool.id)).toContain("claude-code");
    expect(REPLY_HARNESSES.every((tool) => tool.status !== "retired")).toBe(true);
    expect(REPLY_MODELS.length).toBeGreaterThan(0);
  });
});
