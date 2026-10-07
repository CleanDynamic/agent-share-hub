// UI-P48 — the composer's prompts: what is written, what is refused, and the
// swap that keeps every other top-level node where it was.

import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertNode = vi.fn();
const reorderNodes = vi.fn();
const getNodeTree = vi.fn();
vi.mock("./nodes", () => ({
  upsertNode: (...a: unknown[]) => upsertNode(...a),
  reorderNodes: (...a: unknown[]) => reorderNodes(...a),
  getNodeTree: (...a: unknown[]) => getNodeTree(...a),
  deleteNode: vi.fn(),
}));

import {
  addSessionPrompt,
  addWrittenPrompt,
  isPromptAdded,
  movePrompt,
  promptNodes,
  promptOrigin,
  savePromptText,
  setPromptModel,
  swapMoves,
} from "./composePrompts";
import type { SessionPrompt } from "./sessions";
import type { BuildNode, NodeTree } from "./types";

const BUILD = "33333333-0000-4000-8000-000000000003";
const IMPORT = "44444444-0000-4000-8000-000000000004";

const node = (over: Partial<NodeTree>): NodeTree =>
  ({
    id: "n",
    build_id: BUILD,
    parent_id: null,
    position: 1,
    type: "prompt",
    title: null,
    note: null,
    payload: { text: "x" },
    source_ref: null,
    event_id: null,
    is_gap: false,
    created_at: "2026-10-07T09:00:00.000Z",
    children: [],
    ...over,
  }) as NodeTree;

const prompt = (ordinal: number, index: number, text: string): SessionPrompt => ({
  ordinal,
  text,
  sourceRef: { source: "transcript", session_id: "proposal-1", index },
});

const fromSession = (id: string, position: number, index: number) =>
  node({ id, position, source_ref: { source: "transcript", session_id: "proposal-1", index, import_session_id: IMPORT } });

beforeEach(() => {
  upsertNode.mockReset();
  upsertNode.mockImplementation(async (row: Record<string, unknown>) => ({ id: "new", created_at: "now", note: null, event_id: null, is_gap: false, ...row }));
  reorderNodes.mockReset();
  reorderNodes.mockResolvedValue(undefined);
  getNodeTree.mockReset();
});

describe("promptNodes", () => {
  it("is the top-level prompt nodes in position order, and nothing else", () => {
    const tree = [
      node({ id: "c", position: 3 }),
      node({ id: "cover", position: 1, type: "screenshot" }),
      node({ id: "a", position: 2 }),
      node({ id: "nested", position: 4, parent_id: "c" }),
    ];
    expect(promptNodes(tree).map((n) => n.id)).toEqual(["a", "c"]);
  });
});

describe("a prompt cannot be added twice", () => {
  it("knows a prompt by its import and its event's index, anywhere in the tree", () => {
    const tree = [node({ id: "parent", position: 1, type: "stack", children: [fromSession("p", 1, 6)] })];
    expect(isPromptAdded(tree, IMPORT, 6)).toBe(true);
    expect(isPromptAdded(tree, IMPORT, 2)).toBe(false);
    expect(isPromptAdded(tree, "another-import", 6)).toBe(false);
  });

  it("refuses the same prompt again and writes nothing", async () => {
    const tree = [fromSession("p", 1, 6)];
    await expect(
      addSessionPrompt({ buildId: BUILD, tree, importSessionId: IMPORT, model: "Sonnet 5.5", prompt: prompt(3, 6, "Skip files with no EXIF date") }),
    ).rejects.toThrow(/already in this build/);
    expect(upsertNode).not.toHaveBeenCalled();
  });

  it("adds it the first time: placed after everything, titled null, the session's model and where it came from", async () => {
    const tree = [node({ id: "cover", position: 1, type: "screenshot" }), node({ id: "a", position: 2 })];
    await addSessionPrompt({ buildId: BUILD, tree, importSessionId: IMPORT, model: "Sonnet 5.5", prompt: prompt(1, 2, "Build me a script") });
    expect(upsertNode).toHaveBeenCalledTimes(1);
    expect(upsertNode.mock.calls[0][0]).toEqual({
      build_id: BUILD,
      type: "prompt",
      title: null,
      payload: { text: "Build me a script", model: "Sonnet 5.5" },
      source_ref: { source: "transcript", session_id: "proposal-1", index: 2, import_session_id: IMPORT },
      parent_id: null,
      position: 3,
    });
    expect(promptOrigin(upsertNode.mock.calls[0][0])).toEqual({ importSessionId: IMPORT, index: 2 });
  });

  it("leaves the model out while the session's is not known", async () => {
    await addSessionPrompt({ buildId: BUILD, tree: [], importSessionId: IMPORT, model: null, prompt: prompt(1, 2, "Build me a script") });
    expect(upsertNode.mock.calls[0][0].payload).toEqual({ text: "Build me a script" });
  });
});

describe("writing by hand", () => {
  it("places a prompt with its text and no source", async () => {
    await addWrittenPrompt({ buildId: BUILD, tree: [node({ position: 4 })], text: "Now make it run every night." });
    expect(upsertNode.mock.calls[0][0]).toMatchObject({ type: "prompt", title: null, payload: { text: "Now make it run every night." }, source_ref: null, position: 5 });
  });

  it("never writes an empty prompt", async () => {
    await expect(addWrittenPrompt({ buildId: BUILD, tree: [], text: "   " })).rejects.toThrow();
    await expect(savePromptText(node({}) as BuildNode, "")).rejects.toThrow();
    expect(upsertNode).not.toHaveBeenCalled();
  });

  it("retries once at a fresh position when another writer took the one it chose", async () => {
    const taken = Object.assign(new Error("upsertNode failed: duplicate key"), { cause: { code: "23505" } });
    upsertNode.mockRejectedValueOnce(taken);
    getNodeTree.mockResolvedValue([node({ position: 1 }), node({ id: "cover", position: 2, type: "screenshot" })]);
    await addWrittenPrompt({ buildId: BUILD, tree: [node({ position: 1 })], text: "Hello" });
    expect(upsertNode.mock.calls.map((call) => call[0].position)).toEqual([2, 3]);
  });
});

describe("editing", () => {
  it("saves the text and keeps everything else the node carries", async () => {
    const saved = fromSession("p", 2, 6);
    saved.payload = { text: "old", model: "Sonnet 5.5" };
    await savePromptText(saved, "new");
    expect(upsertNode.mock.calls[0][0]).toMatchObject({ id: "p", position: 2, payload: { text: "new", model: "Sonnet 5.5" }, source_ref: saved.source_ref });
  });

  it("names the model once it is known, and takes it off again", async () => {
    await setPromptModel(node({ payload: { text: "a" } }), "Opus 5.5");
    expect(upsertNode.mock.calls[0][0].payload).toEqual({ text: "a", model: "Opus 5.5" });
    await setPromptModel(node({ payload: { text: "a", model: "Opus 5.5" } }), null);
    expect(upsertNode.mock.calls[1][0].payload).toEqual({ text: "a" });
  });
});

describe("moving", () => {
  const prompts = [node({ id: "a", position: 2 }), node({ id: "b", position: 5 }), node({ id: "c", position: 6 })];

  it("swaps a prompt with the next prompt's position, so the nodes between keep theirs", () => {
    expect(swapMoves(prompts, 0, 1)).toEqual([
      { id: "a", parent_id: null, position: 5 },
      { id: "b", parent_id: null, position: 2 },
    ]);
  });

  it("does nothing at either end", async () => {
    expect(swapMoves(prompts, 0, -1)).toEqual([]);
    expect(swapMoves(prompts, 2, 1)).toEqual([]);
    await movePrompt(BUILD, prompts, 2, 1);
    expect(reorderNodes).not.toHaveBeenCalled();
  });

  it("writes the swap through reorderNodes", async () => {
    await movePrompt(BUILD, prompts, 1, 1);
    expect(reorderNodes).toHaveBeenCalledWith(BUILD, [
      { id: "b", parent_id: null, position: 6 },
      { id: "c", parent_id: null, position: 5 },
    ]);
  });
});
