// UI-P62 — the build graph: numbering, default titles, session groups, uses,
// how a step runs, and the writes that refuse bad input.

import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertNode = vi.fn();
const getNodeTree = vi.fn();
vi.mock("./nodes", () => ({
  upsertNode: (...a: unknown[]) => upsertNode(...a),
  getNodeTree: (...a: unknown[]) => getNodeTree(...a),
  reorderNodes: vi.fn(),
  deleteNode: vi.fn(),
}));

const getNodeType = vi.fn();
vi.mock("./nodeTypes", () => ({ getNodeType: (...a: unknown[]) => getNodeType(...a) }));

import {
  addAgent,
  addAgentPrompt,
  addManualStep,
  addTeam,
  setAgentTool,
  setInstructions,
  setManualFields,
  placeAfterMoves,
  addUse,
  buildSteps,
  dismissSuggestion,
  goesInto,
  parseRuns,
  removeUse,
  runsLabel,
  sessionGroups,
  setNodeFields,
  setRuns,
  setStepTitle,
  stepTitle,
  usesOf,
  wordCount,
} from "./graph";
import type { BuildNode, NodeTree } from "./types";

const BUILD = "33333333-0000-4000-8000-000000000003";

let seq = 0;
const node = (over: Partial<NodeTree>): NodeTree =>
  ({
    id: `n${++seq}`,
    build_id: BUILD,
    parent_id: null,
    position: 1,
    type: "prompt",
    title: null,
    note: null,
    payload: { text: "one two three" },
    source_ref: null,
    event_id: null,
    is_gap: false,
    created_at: "2026-10-07T09:00:00.000Z",
    children: [],
    ...over,
  }) as NodeTree;

const fromSession = (sessionId: string, over: Partial<NodeTree> = {}) =>
  node({ source_ref: { source: "transcript", session_id: "p", index: 0, import_session_id: sessionId }, ...over });

beforeEach(() => {
  seq = 0;
  upsertNode.mockReset();
  upsertNode.mockImplementation(async (row: unknown) => row);
  getNodeTree.mockReset();
  getNodeType.mockReset();
  getNodeType.mockResolvedValue({ key: "x", is_active: true });
});

const payloadWritten = () => (upsertNode.mock.calls[0][0] as { payload: Record<string, unknown> }).payload;

describe("buildSteps", () => {
  it("numbers a flat build by position, counting steps only", () => {
    const steps = buildSteps([
      node({ id: "cover", type: "screenshot", position: 1, payload: {} }),
      node({ id: "a", position: 2 }),
      node({ id: "file", type: "document", position: 3, payload: { title: "CLAUDE.md" } }),
      node({ id: "b", position: 4, type: "manual_step", payload: { tool: "Figma", text: "Exported" } }),
    ]);
    expect(steps.map((s) => [s.id, s.number, s.kind, s.defaultTitle])).toEqual([
      ["a", "1", "prompt", "Prompt 1"],
      ["b", "2", "manual", "Manual step 2"],
    ]);
    expect(steps[0]).toMatchObject({ text: "one two three", words: 3, title: null });
  });

  it("makes an agent's instructions its first sub-step, then its prompts", () => {
    const agent = node({
      id: "ag",
      type: "agent_config",
      payload: { system_prompt: "Be brief now", model: "claude-sonnet-5-5", runs: { how: "once" } },
      children: [
        node({ id: "p2", parent_id: "ag", position: 2, payload: { text: "second" } }),
        node({ id: "p1", parent_id: "ag", position: 1, payload: { text: "first" }, title: "Kick off" }),
      ],
    });
    const [step] = buildSteps([agent]);
    expect(step).toMatchObject({ kind: "agent", number: "1", defaultTitle: "Agent 1", model: "claude-sonnet-5-5" });
    expect(step.children.map((c) => [c.id, c.number, c.kind, stepTitle(c), c.text])).toEqual([
      ["ag:instructions", "1.1", "prompt", "Instructions", "Be brief now"],
      ["p1", "1.2", "prompt", "Kick off", "first"],
      ["p2", "1.3", "prompt", "Prompt 1.3", "second"],
    ]);
  });

  it("numbers a team's four agents n.1 to n.4; an agent's own prompts are held for when it is opened", () => {
    const agents = [1, 2, 3, 4].map((i) =>
      node({
        id: `ag${i}`,
        parent_id: "tm",
        position: i,
        type: "agent_config",
        payload: { system_prompt: `Agent ${i} brief`, model: "m" },
        children: [node({ parent_id: `ag${i}`, position: 1, payload: { text: "hidden until opened" } })],
      }),
    );
    const [lead, team] = buildSteps([
      node({ id: "lead", position: 1 }),
      node({ id: "tm", type: "team", position: 2, payload: {}, children: agents }),
    ]);
    expect(lead.number).toBe("1");
    expect(team).toMatchObject({ kind: "team", number: "2", defaultTitle: "Team 2" });
    expect(team.children.map((c) => c.number)).toEqual(["2.1", "2.2", "2.3", "2.4"]);
    expect(team.children[0]).toMatchObject({ kind: "agent", text: "Agent 1 brief" });
    expect(team.children[0].children.map((c) => [c.number, c.defaultTitle, c.text])).toEqual([
      ["2.1.1", "Instructions", "Agent 1 brief"],
      ["2.1.2", "Prompt 2.1.2", "hidden until opened"],
    ]);
  });

  it("gives an agent in a team no children when it has no prompts of its own", () => {
    const [team] = buildSteps([
      node({ id: "tm", type: "team", position: 1, payload: {}, children: [node({ id: "ag", parent_id: "tm", position: 1, type: "agent_config", payload: { system_prompt: "Brief", model: "m" } })] }),
    ]);
    expect(team.children[0].children).toEqual([]);
  });

  it("trims a typed title and falls back to the default for a blank one", () => {
    const [a, b] = buildSteps([node({ position: 1, title: "  Draft  " }), node({ position: 2, title: "   " })]);
    expect([stepTitle(a), stepTitle(b)]).toEqual(["Draft", "Prompt 2"]);
  });
});

describe("sessionGroups", () => {
  const sessions = [
    { id: "s1", client: "claude-code", model: "Sonnet 5.5", prompts: 2, turns: 4, started_at: "2026-10-04T09:00:00Z" },
    { id: "s2", client: "chatgpt", model: "GPT-6 Luna", prompts: 1, turns: 2, started_at: "2026-10-05T09:00:00Z" },
  ];

  it("groups by session, with a hand-written prompt between two sessions as its own group", () => {
    const steps = buildSteps([
      fromSession("s1", { position: 1 }),
      fromSession("s1", { position: 2 }),
      node({ position: 3, payload: { text: "typed", tool: "claude-code" } }),
      fromSession("s2", { position: 4 }),
    ]);
    expect(sessionGroups(steps, sessions)).toEqual([
      { sessionId: "s1", number: 1, tool: "Claude Code", model: "Sonnet 5.5", startedAt: "2026-10-04T09:00:00Z", stepNumbers: ["1", "2"] },
      { sessionId: null, number: 2, tool: "Claude Code", model: null, startedAt: "typed here", stepNumbers: ["3"] },
      { sessionId: "s2", number: 3, tool: "ChatGPT", model: "GPT-6 Luna", startedAt: "2026-10-05T09:00:00Z", stepNumbers: ["4"] },
    ]);
  });

  it("reads an old entry with no id or date without failing", () => {
    const steps = buildSteps([fromSession("s1")]);
    const [group] = sessionGroups(steps, [{ client: "claude-code", model: "Sonnet 5.5", prompts: 1, turns: 1 }]);
    expect(group).toMatchObject({ sessionId: "s1", tool: null, startedAt: null });
  });

  it("splits typed prompts at an agent", () => {
    const steps = buildSteps([
      node({ position: 1 }),
      node({ position: 2, type: "agent_config", payload: { system_prompt: "x", model: "m" } }),
      node({ position: 3 }),
    ]);
    expect(sessionGroups(steps, []).map((g) => g.stepNumbers)).toEqual([["1"], ["3"]]);
  });
});

describe("uses and goes into", () => {
  it("reads uses in order, skipping bad and repeated entries", () => {
    const uses = usesOf({
      payload: { uses: [{ kind: "file", node_id: "f" }, { kind: "nope", node_id: "x" }, { kind: "file", node_id: "f" }, { kind: "output", node_id: "a" }] },
    });
    expect(uses).toEqual([{ kind: "file", node_id: "f" }, { kind: "output", node_id: "a" }]);
  });

  it("goes into every step that uses it, plus the next in the same session", () => {
    const steps = buildSteps([
      fromSession("s1", { id: "a", position: 1 }),
      fromSession("s1", { id: "b", position: 2 }),
      node({ id: "c", position: 3, payload: { text: "x", uses: [{ kind: "output", node_id: "a" }] } }),
      fromSession("s2", { id: "d", position: 4 }),
    ]);
    expect(goesInto(steps, "a").map((s) => s.id)).toEqual(["c", "b"]);
    expect(goesInto(steps, "b").map((s) => s.id)).toEqual([]);
    expect(goesInto(steps, "d")).toEqual([]);
  });

  it("lets only an until step in the same agent or team be used before it runs", async () => {
    const mk = (id: string, position: number, runs?: Record<string, string>) =>
      node({ id, parent_id: "tm", position, type: "agent_config", payload: { system_prompt: "x", model: "m", ...(runs ? { runs } : {}) } });
    const tree = [
      node({ id: "outside", position: 1 }),
      node({ id: "tm", type: "team", position: 2, payload: {}, children: [mk("writer", 1), mk("checker", 2, { how: "until", detail: "ok" }), mk("other", 3)] }),
    ];
    const steps = buildSteps(tree);
    const writer = tree[1].children[0] as BuildNode;

    await addUse(writer, { kind: "output", node_id: "checker" }, steps);
    expect(payloadWritten().uses).toEqual([{ kind: "output", node_id: "checker" }]);

    upsertNode.mockClear();
    await expect(addUse(writer, { kind: "output", node_id: "other" }, steps)).rejects.toThrow(/until a condition/);
    await expect(addUse(tree[0] as BuildNode, { kind: "output", node_id: "tm" }, steps)).rejects.toThrow(/until a condition/);
    expect(upsertNode).not.toHaveBeenCalled();
  });

  it("refuses itself, a repeat, and a step that is not in the build; allows an earlier step", async () => {
    const tree = [node({ id: "a", position: 1 }), node({ id: "b", position: 2, payload: { text: "x", uses: [{ kind: "output", node_id: "a" }] } })];
    const steps = buildSteps(tree);
    await expect(addUse(tree[1] as BuildNode, { kind: "output", node_id: "b" }, steps)).rejects.toThrow(/never uses itself/);
    await expect(addUse(tree[1] as BuildNode, { kind: "output", node_id: "a" }, steps)).rejects.toThrow(/already listed/);
    await expect(addUse(tree[1] as BuildNode, { kind: "output", node_id: "zzz" }, steps)).rejects.toThrow(/not in this build/);
    await addUse(tree[1] as BuildNode, { kind: "file", node_id: "f1" }, steps);
    expect(payloadWritten().uses).toEqual([{ kind: "output", node_id: "a" }, { kind: "file", node_id: "f1" }]);
  });

  it("removes a use, dismisses a suggestion once, and forgets a dismissal when the use is added", async () => {
    const n = node({ id: "b", payload: { text: "x", uses: [{ kind: "file", node_id: "f" }], dismissed: ["file:g"] } }) as BuildNode;
    await removeUse(n, { kind: "file", node_id: "f" });
    expect(payloadWritten().uses).toEqual([]);

    upsertNode.mockClear();
    await dismissSuggestion(n, "file:g");
    expect(upsertNode).not.toHaveBeenCalled();
    await dismissSuggestion(n, "tool:t");
    expect(payloadWritten().dismissed).toEqual(["file:g", "tool:t"]);
    await expect(dismissSuggestion(n, "bad")).rejects.toThrow(/not a suggestion/);

    upsertNode.mockClear();
    await addUse(n, { kind: "file", node_id: "g" }, buildSteps([n as NodeTree]));
    expect(payloadWritten().dismissed).toEqual([]);
  });
});

describe("runs", () => {
  it("labels each way and reads a bad value as null", () => {
    expect(runsLabel(null)).toBe("Runs once");
    expect(runsLabel({ how: "once" })).toBe("Runs once");
    expect(runsLabel({ how: "parallel", count: 3 })).toBe("Runs several at once · 3");
    expect(runsLabel({ how: "until" })).toBe("Repeats until a condition is met");
    expect(runsLabel({ how: "schedule", detail: "Mondays 07:00" })).toBe("Runs on a schedule · Mondays 07:00");
    expect(runsLabel({ how: "event" })).toBe("Runs when something happens");
    expect(parseRuns({ how: "sometimes" })).toBeNull();
    expect(parseRuns("once")).toBeNull();
    expect(parseRuns({ how: "once", count: 4, detail: "x" })).toEqual({ how: "once" });
  });

  it("enforces the limits and writes nothing for once", async () => {
    const agent = node({ type: "agent_config", payload: { system_prompt: "x", model: "m", runs: { how: "schedule", detail: "old" } } }) as BuildNode;
    await expect(setRuns(agent, { how: "parallel", count: 1 })).rejects.toThrow(/2 to 20/);
    await expect(setRuns(agent, { how: "parallel", count: 21 })).rejects.toThrow(/2 to 20/);
    await expect(setRuns(agent, { how: "parallel" })).rejects.toThrow(/2 to 20/);
    await expect(setRuns(agent, { how: "until", detail: "x".repeat(81) })).rejects.toThrow(/80/);
    await expect(setRuns(agent, { how: "schedule", detail: "x".repeat(61) })).rejects.toThrow(/60/);
    await expect(setRuns(node({}) as BuildNode, { how: "once" })).rejects.toThrow(/agent or a team/);
    expect(upsertNode).not.toHaveBeenCalled();

    await setRuns(agent, { how: "parallel", count: 20, detail: "ignored" });
    expect(payloadWritten().runs).toEqual({ how: "parallel", count: 20 });
    upsertNode.mockClear();
    await setRuns(agent, { how: "until", detail: "  every claim has a source " });
    expect(payloadWritten().runs).toEqual({ how: "until", detail: "every claim has a source" });
    upsertNode.mockClear();
    await setRuns(agent, { how: "once" });
    expect(payloadWritten()).not.toHaveProperty("runs");
  });
});

describe("titles and words", () => {
  it("trims a title, saves an empty one as null, and refuses one over 80", async () => {
    const n = node({ title: "Old" }) as BuildNode;
    await setStepTitle(n, "  New  ");
    expect(upsertNode.mock.calls[0][0]).toMatchObject({ id: n.id, title: "New" });
    await setStepTitle(n, "   ");
    expect(upsertNode.mock.calls[1][0]).toMatchObject({ title: null });
    await expect(setStepTitle(n, "x".repeat(81))).rejects.toThrow(/80/);
    await setStepTitle(n, "x".repeat(80));
    expect(upsertNode).toHaveBeenCalledTimes(3);
  });

  it("counts words on whitespace", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount("  a  b\nc\td ")).toBe(4);
  });
});

describe("fields of a tool and a result", () => {
  it("changes a field, drops a blank optional one, and refuses a blank required one", async () => {
    const tool = node({ type: "integration", payload: { service: "Gmail", scopes: "read" } }) as BuildNode;
    await setNodeFields(tool, { service: " Gmail ", scopes: " " });
    expect(payloadWritten()).toEqual({ service: "Gmail" });
    await expect(setNodeFields(tool, { service: "" })).rejects.toThrow(/empty/);
    await expect(setNodeFields(tool, { url: "x" })).rejects.toThrow(/not a field/);
    await expect(setNodeFields(node({}) as BuildNode, { text: "x" })).rejects.toThrow(/no fields/);
  });
});

describe("adding", () => {
  it("refuses a team and a manual step while their node types are not live", async () => {
    for (const missing of [null, { key: "team", is_active: false }]) {
      getNodeType.mockResolvedValue(missing);
      await expect(addTeam(BUILD, [], { name: "Crew", model: "claude-sonnet-5-5" })).rejects.toThrow("That needs the Deploy queue item from UI-P61.");
      await expect(addManualStep(BUILD, [], { tool: "Figma", text: "Exported" })).rejects.toThrow("That needs the Deploy queue item from UI-P61.");
    }
    expect(upsertNode).not.toHaveBeenCalled();
  });

  it("places an agent, a team and a manual step after the last top-level node", async () => {
    const tree = [node({ position: 4 })];
    await addAgent(BUILD, tree, { name: " Reviewer ", model: "claude-sonnet-5-5" });
    await addTeam(BUILD, tree, { name: "", model: "claude-sonnet-5-5" });
    await addManualStep(BUILD, tree, { tool: " Figma ", text: " Exported the frames " });
    expect(upsertNode.mock.calls.map(([row]) => [row.type, row.position, row.parent_id === null ? null : "child", row.title])).toEqual([
      ["agent_config", 5, null, "Reviewer"],
      ["team", 5, null, null],
      ["agent_config", 1, "child", null],
      ["manual_step", 5, null, null],
    ]);
    expect(upsertNode.mock.calls[3][0].payload).toEqual({ tool: "Figma", text: "Exported the frames" });
    await expect(addManualStep(BUILD, tree, { tool: "x".repeat(41), text: "ok" })).rejects.toThrow(/40/);
    await expect(addManualStep(BUILD, tree, { tool: "Figma", text: "x".repeat(141) })).rejects.toThrow(/140/);
  });

  it("makes a team holding one agent, and puts an agent inside a team after its others", async () => {
    upsertNode.mockImplementation(async (row: Record<string, unknown>) => ({ ...row, id: row.type === "team" ? "tm" : "new" }));
    const made = await addTeam(BUILD, [], { name: "Crew", model: "claude-sonnet-5-5" });
    expect(made.team.id).toBe("tm");
    expect(upsertNode.mock.calls[1][0]).toMatchObject({ type: "agent_config", parent_id: "tm", position: 1, payload: { system_prompt: "", model: "claude-sonnet-5-5" } });
    await expect(addTeam(BUILD, [], { name: "Crew", model: " " })).rejects.toThrow(/needs a model/);

    const team = node({ id: "tm", type: "team", children: [node({ parent_id: "tm", position: 2 })] });
    await addAgent(BUILD, [team], { model: "claude-sonnet-5-5", parentId: "tm" });
    expect(upsertNode.mock.calls[2][0]).toMatchObject({ type: "agent_config", parent_id: "tm", position: 3 });
  });

  it("writes an agent's instructions as its system prompt, and only for an agent", async () => {
    const agent = node({ id: "ag", type: "agent_config", payload: { system_prompt: "", model: "m" } }) as BuildNode;
    await setInstructions(agent, "Be brief.");
    expect(payloadWritten()).toEqual({ system_prompt: "Be brief.", model: "m" });
    await expect(setInstructions(node({}) as BuildNode, "x")).rejects.toThrow(/Only an agent/);
  });

  it("places an agent's prompt one past its highest child, and refuses empty text or a non-agent", async () => {
    const agent = node({
      id: "ag",
      type: "agent_config",
      payload: { system_prompt: "x", model: "m" },
      children: [node({ parent_id: "ag", position: 1 }), node({ parent_id: "ag", position: 3 })],
    });
    await addAgentPrompt(agent as BuildNode, [agent], "Next ask");
    expect(upsertNode.mock.calls[0][0]).toMatchObject({ parent_id: "ag", position: 4, type: "prompt", payload: { text: "Next ask" } });
    await expect(addAgentPrompt(agent as BuildNode, [agent], "  ")).rejects.toThrow(/needs its text/);
    await expect(addAgentPrompt(node({}) as BuildNode, [], "x")).rejects.toThrow(/inside an agent/);
  });

  it("reads the tree again and tries once more when the position was taken", async () => {
    const agent = node({ id: "ag", type: "agent_config", children: [] });
    const taken = Object.assign(new Error("dup"), { cause: { code: "23505" } });
    upsertNode.mockRejectedValueOnce(taken);
    getNodeTree.mockResolvedValue([{ ...agent, children: [node({ parent_id: "ag", position: 1 })] }]);
    await addAgentPrompt(agent as BuildNode, [agent], "Next");
    expect(upsertNode.mock.calls.map(([row]) => row.position)).toEqual([1, 2]);
  });
});

describe("a manual step (UI-P70)", () => {
  const manual = (id: string, position: number, over: Partial<NodeTree> = {}) =>
    node({ id, position, type: "manual_step", payload: { tool: "Figma", text: "Laid out the hero" }, ...over });

  it("takes the next number between two prompts, and the prompts after it shift", () => {
    const steps = buildSteps([node({ id: "p1", position: 1 }), node({ id: "p2", position: 2 }), node({ id: "p3", position: 3 })]);
    expect(steps.map((step) => step.number)).toEqual(["1", "2", "3"]);
    const after = buildSteps([node({ id: "p1", position: 1 }), node({ id: "p2", position: 2 }), manual("m", 3), node({ id: "p3", position: 4 })]);
    expect(after.map((step) => [step.id, step.number, step.kind])).toEqual([
      ["p1", "1", "prompt"],
      ["p2", "2", "prompt"],
      ["m", "3", "manual"],
      ["p3", "4", "prompt"],
    ]);
    expect(after[2]).toMatchObject({ defaultTitle: "Manual step 3", title: null, tool: "Figma", text: "Laid out the hero", model: null, runs: null, mediaId: null });
  });

  it("does not number files, tools or results that sit between steps", () => {
    const steps = buildSteps([node({ id: "p1", position: 1 }), node({ id: "f", position: 2, type: "document", payload: { title: "a.md" } }), manual("m", 3)]);
    expect(steps.map((step) => step.number)).toEqual(["1", "2"]);
  });

  it("reads its picture", () => {
    const [step] = buildSteps([manual("m", 1, { payload: { tool: "Figma", text: "x", media_id: "media-1" } })]);
    expect(step.mediaId).toBe("media-1");
  });

  it("is added with its picture, and refuses a tool over 40 or a line over 140", async () => {
    await addManualStep(BUILD, [], { tool: "Figma", text: "Laid out the hero", media_id: "media-1" });
    expect(payloadWritten()).toEqual({ tool: "Figma", text: "Laid out the hero", media_id: "media-1" });
    await expect(addManualStep(BUILD, [], { tool: "x".repeat(41), text: "ok" })).rejects.toThrow(/40/);
    await expect(addManualStep(BUILD, [], { tool: "Figma", text: "x".repeat(141) })).rejects.toThrow(/140/);
    await expect(addManualStep(BUILD, [], { tool: " ", text: "ok" })).rejects.toThrow(/1 to 40/);
    await expect(addManualStep(BUILD, [], { tool: "Figma", text: "  " })).rejects.toThrow(/1 to 140/);
  });

  it("changes its tool, line and picture within the limits, and takes the picture off with null", async () => {
    const step = manual("m", 1, { payload: { tool: "Figma", text: "Old", media_id: "media-1" } }) as BuildNode;
    await setManualFields(step, { tool: " Lovable ", text: " New line " });
    expect(payloadWritten()).toEqual({ tool: "Lovable", text: "New line", media_id: "media-1" });
    upsertNode.mockClear();
    await setManualFields(step, { media_id: null });
    expect(payloadWritten()).toEqual({ tool: "Figma", text: "Old" });
    await expect(setManualFields(step, { tool: "x".repeat(41) })).rejects.toThrow(/40/);
    await expect(setManualFields(step, { text: "x".repeat(141) })).rejects.toThrow(/140/);
    await expect(setManualFields(step, { text: "" })).rejects.toThrow(/1 to 140/);
    await expect(setManualFields(node({}) as BuildNode, { text: "x" })).rejects.toThrow(/not a manual step/);
  });

  describe("placing after a step", () => {
    const tree = [node({ id: "p1", position: 1 }), node({ id: "f", position: 2, type: "document" }), node({ id: "p2", position: 3 }), node({ id: "p3", position: 4 }), manual("m", 5)];

    it("hands the steps' own positions out again, so the file keeps its own", () => {
      // After p1: p1 m p2 p3 over the slots 1, 3, 4, 5.
      expect(placeAfterMoves(tree, "m", "p1")).toEqual([
        { id: "m", parent_id: null, position: 3 },
        { id: "p2", parent_id: null, position: 4 },
        { id: "p3", parent_id: null, position: 5 },
      ]);
    });

    it("is nothing when it is already there, and goes first for a null", () => {
      expect(placeAfterMoves(tree, "m", "p3")).toEqual([]);
      expect(placeAfterMoves(tree, "m", null)).toEqual([
        { id: "m", parent_id: null, position: 1 },
        { id: "p1", parent_id: null, position: 3 },
        { id: "p2", parent_id: null, position: 4 },
        { id: "p3", parent_id: null, position: 5 },
      ]);
      expect(placeAfterMoves(tree, "missing", "p1")).toEqual([]);
      expect(placeAfterMoves(tree, "m", "missing")).toEqual([]);
    });
  });
});

describe("an agent's tool (TF-04)", () => {
  it("addAgent keeps a listed tool as its id and a typed one as typed, and leaves it out when none is given", async () => {
    await addAgent(BUILD, [], { model: "claude-sonnet-5-5", tool: "OpenClaw" });
    await addAgent(BUILD, [], { model: "claude-sonnet-5-5", tool: "  My own harness " });
    await addAgent(BUILD, [], { model: "claude-sonnet-5-5", tool: " " });
    await addAgent(BUILD, [], { model: "claude-sonnet-5-5" });
    expect(upsertNode.mock.calls.map(([row]) => row.payload)).toEqual([
      { system_prompt: "", model: "claude-sonnet-5-5", tool: "openclaw" },
      { system_prompt: "", model: "claude-sonnet-5-5", tool: "My own harness" },
      { system_prompt: "", model: "claude-sonnet-5-5" },
      { system_prompt: "", model: "claude-sonnet-5-5" },
    ]);
  });

  it("addAgent refuses a tool of more than 40 characters", async () => {
    await expect(addAgent(BUILD, [], { model: "m", tool: "x".repeat(41) })).rejects.toThrow(/40/);
    expect(upsertNode).not.toHaveBeenCalled();
  });

  it("setAgentTool sets it, changes it, and clears it with null, keeping the rest of the payload", async () => {
    const agent = node({ id: "ag", type: "agent_config", payload: { system_prompt: "Be brief.", model: "m", runs: { how: "once" } } }) as BuildNode;
    await setAgentTool(agent, "hermes agent");
    expect(payloadWritten()).toEqual({ system_prompt: "Be brief.", model: "m", runs: { how: "once" }, tool: "hermes-agent" });

    const withTool = node({ id: "ag", type: "agent_config", payload: { system_prompt: "x", model: "m", tool: "openclaw" } }) as BuildNode;
    upsertNode.mockClear();
    await setAgentTool(withTool, null);
    expect(payloadWritten()).toEqual({ system_prompt: "x", model: "m" });
  });

  it("setAgentTool refuses a team and any step that is not an agent", async () => {
    await expect(setAgentTool(node({ type: "team", payload: {} }) as BuildNode, "openclaw")).rejects.toThrow(/Only an agent/);
    await expect(setAgentTool(node({}) as BuildNode, "openclaw")).rejects.toThrow(/Only an agent/);
    expect(upsertNode).not.toHaveBeenCalled();
  });

  it("buildSteps carries an agent's tool as its name on step.tool, and a team has none", () => {
    const tree = [
      node({ id: "ag", type: "agent_config", position: 1, payload: { system_prompt: "x", model: "m", tool: "openclaw" } }),
      node({ id: "ag2", type: "agent_config", position: 2, payload: { system_prompt: "x", model: "m", tool: "My own harness" } }),
      node({ id: "ag3", type: "agent_config", position: 3, payload: { system_prompt: "x", model: "m" } }),
      node({ id: "tm", type: "team", position: 4, payload: {} }),
    ];
    expect(buildSteps(tree).map((step) => step.tool)).toEqual(["OpenClaw", "My own harness", null, null]);
  });
});
