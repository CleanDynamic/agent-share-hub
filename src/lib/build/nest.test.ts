// CA-04 P2 — tiles inside tiles: what buildSteps reads, how nestStep moves a tile, the two guards, and Copy together.

import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertNode = vi.fn();
const reorderNodes = vi.fn();
vi.mock("./nodes", () => ({
  upsertNode: (...a: unknown[]) => upsertNode(...a),
  getNodeTree: vi.fn(),
  reorderNodes: (...a: unknown[]) => reorderNodes(...a),
  deleteNode: vi.fn(),
}));
vi.mock("./nodeTypes", () => ({ getNodeType: vi.fn(async () => ({ key: "x", is_active: true })) }));

import { copyTogether } from "./copyTogether";
import { buildSteps, nestMoves, nestRefusal, nestStep, NEST_COPY, NEST_DEPTH_MAX, sessionGroups, setStepSession, withSentWith } from "./graph";
import type { NodeTree } from "./types";

const BUILD = "b";

const node = (id: string, type: string, payload: Record<string, unknown>, position: number, parent: string | null = null, children: NodeTree[] = []): NodeTree =>
  ({ id, build_id: BUILD, parent_id: parent, position, type, title: null, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "", children }) as NodeTree;

/** Session 1: prompt 1, prompt 2 holding order-form.tsx, which holds menu.pdf; then prompt 3; and a result. */
function tree(): NodeTree[] {
  const file = node("f1", "document", { title: "menu.pdf" }, 1, "c1");
  const code = node("c1", "code", { source: "export const Form = () => null;", language: "tsx", filename: "order-form.tsx" }, 1, "p2", [file]);
  return [
    node("p1", "prompt", { text: "Plan the order page.", session: "typed-a" }, 1),
    node("p2", "prompt", { text: "Build the form from this.", session: "typed-a" }, 2, null, [code]),
    node("p3", "prompt", { text: "Check it on a phone.", session: "typed-b" }, 3),
    node("r1", "result", { summary: "The order page" }, 4),
  ];
}

beforeEach(() => {
  upsertNode.mockReset();
  upsertNode.mockImplementation(async (row: unknown) => row);
  reorderNodes.mockReset();
});

describe("buildSteps reads tiles inside tiles", () => {
  it("returns three levels under their parent, and only top-level steps take numbers", () => {
    const steps = buildSteps(tree());
    expect(steps.map((step) => [step.id, step.number])).toEqual([
      ["p1", "1"],
      ["p2", "2"],
      ["p3", "3"],
    ]);
    const [code] = steps[1].sentWith ?? [];
    expect([code.id, code.kind, code.number, code.defaultTitle, code.inside]).toEqual(["c1", "code", "", "order-form.tsx", { id: "p2", label: "prompt 2" }]);
    const [file] = code.sentWith ?? [];
    expect([file.id, file.kind, file.number, file.filename, file.inside]).toEqual(["f1", "file", "", "menu.pdf", { id: "c1", label: "order-form.tsx" }]);
    expect(withSentWith(steps[1]).map((step) => step.id)).toEqual(["p2", "c1", "f1"]);
    expect(steps[0].sentWith).toBeUndefined();
  });

  it("keeps an agent's and a team's children as they were", () => {
    const agent = node("a1", "agent_config", { system_prompt: "x", model: "m" }, 1, null, [node("ap", "prompt", { text: "go" }, 1, "a1")]);
    const [step] = buildSteps([agent]);
    expect(step.children.map((child) => child.number)).toEqual(["1.1", "1.2"]);
    expect(step.sentWith).toBeUndefined();
  });

  it("leaves a nested tile out of its session: sessions are top-level steps'", () => {
    const groups = sessionGroups(buildSteps(tree()), [], {}, { "typed-a": { tool: null, date: "2026-10-01" }, "typed-b": { tool: null, date: "2026-10-02" } });
    expect(groups.map((group) => group.stepNumbers)).toEqual([["1", "2"], ["3"]]);
  });
});

describe("nestStep", () => {
  it("puts a tile inside a step, at the end, in one reorderNodes write", async () => {
    const moves = await nestStep(BUILD, tree(), "p3", "p2", 99);
    expect(moves).toEqual([{ id: "p3", parent_id: "p2", position: 2 }]);
    expect(reorderNodes).toHaveBeenCalledTimes(1);
    expect(reorderNodes).toHaveBeenCalledWith(BUILD, moves);
  });

  it("makes a tile its own step at a place among the top-level steps; files and results keep theirs", () => {
    expect(nestMoves(tree(), "c1", null, 1)).toEqual([
      { id: "c1", parent_id: null, position: 2 },
      { id: "p2", parent_id: null, position: 3 },
      { id: "p3", parent_id: null, position: 5 },
    ]);
  });

  it("moves a step between sessions: its place, then its session", async () => {
    // After step 3, the last step of Session 2, and into that session.
    const moves = await nestStep(BUILD, tree(), "p1", null, 2);
    expect(moves).toEqual([
      { id: "p2", parent_id: null, position: 1 },
      { id: "p3", parent_id: null, position: 2 },
      { id: "p1", parent_id: null, position: 3 },
    ]);
    const row = tree()[0];
    const { children: _children, ...plain } = row;
    await setStepSession(plain, "typed-b");
    expect((upsertNode.mock.calls[0][0] as { payload: Record<string, unknown> }).payload).toEqual({ text: "Plan the order page.", session: "typed-b" });
  });

  it("refuses a tile going inside itself or anything it holds, and writes nothing", async () => {
    expect(nestRefusal(tree(), "p2", "p2")).toBe(NEST_COPY.cycle);
    expect(nestRefusal(tree(), "p1", "f1")).toBe(NEST_COPY.file);
    expect(nestRefusal(tree(), "p2", "c1")).toBe(NEST_COPY.cycle);
    await expect(nestStep(BUILD, tree(), "p2", "c1", 0)).rejects.toThrow(NEST_COPY.cycle);
    expect(reorderNodes).not.toHaveBeenCalled();
  });

  it("refuses a result, and keeps an agent's and a team's meaning", () => {
    const agent = node("a1", "agent_config", { system_prompt: "x", model: "m" }, 5);
    const team = node("t1", "team", {}, 6);
    const all = [...tree(), agent, team];
    expect(nestRefusal(all, "p1", "r1")).toBe(NEST_COPY.result);
    expect(nestRefusal(all, "c1", "a1")).toBe(NEST_COPY.agent);
    expect(nestRefusal(all, "p1", "a1")).toBeNull();
    expect(nestRefusal(all, "p1", "t1")).toBe(NEST_COPY.team);
    expect(nestRefusal(all, "r1", "p1")).toBe(NEST_COPY.notATile);
  });

  it(`refuses anything more than ${NEST_DEPTH_MAX} deep, in a plain sentence`, () => {
    // A top-level prompt and 49 tiles, each inside the one before: the last is 49 levels in.
    let inner: NodeTree | null = null;
    for (let at = NEST_DEPTH_MAX - 1; at >= 0; at--) inner = node(`d${at}`, "prompt", { text: `level ${at}` }, 1, at === 0 ? null : `d${at - 1}`, inner ? [inner] : []);
    const chain = [inner as NodeTree, node("loose", "prompt", { text: "one more" }, 2), node("pair", "prompt", { text: "two" }, 3, null, [node("pair2", "prompt", { text: "inside" }, 1, "pair")])];
    // Into the last, it is 50 levels in: allowed. A pair of tiles there would be 51: refused.
    expect(nestRefusal(chain, "loose", `d${NEST_DEPTH_MAX - 1}`)).toBeNull();
    expect(nestRefusal(chain, "pair", `d${NEST_DEPTH_MAX - 2}`)).toBeNull();
    expect(nestRefusal(chain, "pair", `d${NEST_DEPTH_MAX - 1}`)).toBe(NEST_COPY.depth);
    const deeper = [{ ...chain[0] }, ...chain.slice(1)];
    expect(buildSteps(deeper)).toHaveLength(3);
    expect(NEST_COPY.depth).toBe("Nesting: 50 deep max");
  });
});

describe("Copy together", () => {
  it("is the prompt's text, each code tile fenced with its language and file name, then Attach for each file, depth first", () => {
    const [, step] = buildSteps(tree());
    expect(copyTogether(step)).toBe(["Build the form from this.", "```tsx order-form.tsx\nexport const Form = () => null;\n```", "Attach menu.pdf"].join("\n\n"));
  });

  it("keeps a nested prompt's text in order, and fences code with backticks inside it whole", () => {
    const code = node("c", "code", { source: "const a = `x`;\n```\n", language: "other" }, 1, "p");
    const inner = node("q", "prompt", { text: "And this as well." }, 2, "p");
    const [step] = buildSteps([node("p", "prompt", { text: "Start." }, 1, null, [code, inner])]);
    expect(copyTogether(step)).toBe("Start.\n\n````\nconst a = `x`;\n```\n\n````\n\nAnd this as well.");
  });
});

describe("code sent with an imported prompt", async () => {
  const { codeInPrompt, fencedBlocks } = await import("./sentWithSuggest");
  const ref = { source: "transcript", session_id: "e", index: 0, import_session_id: "imp" };
  const text = "Here:\n```python app.py\nprint(1)\n```\nand\n```\nSELECT 1;\n```\nand an open one\n```js\nlet a";

  it("reads only closed fences, exactly", () => {
    expect(fencedBlocks(text)).toEqual([
      { info: "python app.py", source: "print(1)" },
      { info: "", source: "SELECT 1;" },
    ]);
  });

  it("offers each block of an imported prompt, never a typed one's, an ignored one or one already inside", () => {
    const imported = { ...node("p", "prompt", { text, dismissed: ["sent:1"] }, 1), source_ref: ref } as NodeTree;
    const [step] = buildSteps([imported]);
    expect(codeInPrompt(step)).toEqual([{ key: "sent:0", stepId: "p", source: "print(1)", language: "python", filename: "app.py" }]);
    const kept = { ...imported, payload: { text }, children: [node("c", "code", { source: "print(1)", language: "python" }, 1, "p")] } as NodeTree;
    expect(codeInPrompt(buildSteps([kept])[0]).map((offer) => offer.key)).toEqual(["sent:1"]);
    expect(codeInPrompt(buildSteps([node("t", "prompt", { text }, 1)])[0])).toEqual([]);
  });
});
