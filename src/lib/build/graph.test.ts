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
  addCode,
  addManualStep,
  addTeam,
  setAgentSetup,
  setInstructions,
  setManualFields,
  toolNodeFor,
  placeAfterMoves,
  addMadeFile,
  addUse,
  buildSteps,
  inputRefusal,
  madeByOf,
  madeFilesOf,
  dismissSuggestion,
  goesInto,
  parseRuns,
  removeUse,
  runsLabel,
  untilClause,
  untilDetail,
  untilParts,
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
    expect(sessionGroups(steps, sessions, {})).toEqual([
      { sessionId: "s1", number: 1, tool: "Claude Code", model: "Sonnet 5.5", startedAt: "2026-10-04T09:00:00Z", stepNumbers: ["1", "2"] },
      { sessionId: null, number: 2, tool: "Claude Code", model: null, startedAt: "typed here", stepNumbers: ["3"] },
      { sessionId: "s2", number: 3, tool: "ChatGPT", model: "GPT-6 Luna", startedAt: "2026-10-05T09:00:00Z", stepNumbers: ["4"] },
    ]);
  });

  it("reads an old entry with no id or date without failing", () => {
    const steps = buildSteps([fromSession("s1")]);
    const [group] = sessionGroups(steps, [{ client: "claude-code", model: "Sonnet 5.5", prompts: 1, turns: 1 }], {});
    expect(group).toMatchObject({ sessionId: "s1", tool: null, startedAt: null });
  });

  it("takes the tool the maker chose for a session whose client names none (TF-13)", () => {
    const steps = buildSteps([fromSession("s9")]);
    const pasted = [{ id: "s9", client: "unknown", model: null, prompts: 1, turns: 2, started_at: "2026-10-06T09:00:00Z" }];
    expect(sessionGroups(steps, pasted, {})[0].tool).toBeNull();
    expect(sessionGroups(steps, pasted, { s9: "perplexity" })[0].tool).toBe("Perplexity");
    expect(sessionGroups(steps, pasted, { s9: "Some Local Tool" })[0].tool).toBe("Some Local Tool");
  });

  it("lets a client's tool win over a chosen one (TF-13)", () => {
    const steps = buildSteps([fromSession("s1")]);
    expect(sessionGroups(steps, sessions, { s1: "perplexity" })[0].tool).toBe("Claude Code");
  });

  it("splits typed prompts at an agent", () => {
    const steps = buildSteps([
      node({ position: 1 }),
      node({ position: 2, type: "agent_config", payload: { system_prompt: "x", model: "m" } }),
      node({ position: 3 }),
    ]);
    expect(sessionGroups(steps, [], {}).map((g) => g.stepNumbers)).toEqual([["1"], ["3"]]);
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
  it("splits an until detail into its condition and its at most, and writes it back (CA-03 P3)", () => {
    expect(untilParts("until the review has no changes · at most 3 times")).toEqual({ condition: "until the review has no changes", atMost: 3 });
    expect(untilParts("until done · at most 1 time")).toEqual({ condition: "until done", atMost: 1 });
    expect(untilDetail("until the review has no changes", 3)).toBe("until the review has no changes · at most 3 times");
    expect(untilDetail("until done", 1)).toBe("until done · at most 1 time");
    expect(untilDetail("until done", null)).toBe("until done");
    expect(untilClause("every claim has a source")).toBe("until every claim has a source");
    expect(untilClause("Until approved")).toBe("Until approved");
  });

  it("reads an old saved until detail back unchanged (CA-03 P3)", () => {
    for (const saved of ["every item has a price", "until every claim has a source", "approved", "a · b"]) {
      const { condition, atMost } = untilParts(saved);
      expect(atMost).toBeNull();
      expect(untilDetail(condition, atMost)).toBe(saved);
    }
  });

  it("labels each way and reads a bad value as null", () => {
    // CA-03 P3: "When I asked" is the normal case and says nothing.
    expect(runsLabel(null)).toBe("");
    expect(runsLabel({ how: "once" })).toBe("");
    expect(runsLabel({ how: "parallel", count: 3 })).toBe("Several at the same time · 3");
    expect(runsLabel({ how: "parallel" })).toBe("Several at the same time");
    expect(runsLabel({ how: "until" })).toBe("Again until a condition was met");
    expect(runsLabel({ how: "until", detail: "until the review has no changes · at most 3 times" })).toBe("Again until the review has no changes · at most 3 times");
    expect(runsLabel({ how: "until", detail: "every claim has a source" })).toBe("Again until every claim has a source");
    expect(runsLabel({ how: "schedule", detail: "Weekdays 07:30" })).toBe("On a schedule · Weekdays 07:30");
    expect(runsLabel({ how: "schedule" })).toBe("On a schedule");
    expect(runsLabel({ how: "event", detail: "a new supplier email" })).toBe("When something happened · a new supplier email");
    expect(runsLabel({ how: "event" })).toBe("When something happened");
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

describe("made files (TF-07)", () => {
  const maker = (id: string, position: number, over: Partial<NodeTree> = {}) => node({ id, position, ...over });
  const made = (id: string, by: string, title = "brand-guide.md", position = 9) =>
    node({ id, position, type: "document", payload: { title, made_by: by } });

  it("reads made_by and the map of made files, top level only", () => {
    const f = made("f", "s1");
    expect(madeByOf(f)).toBe("s1");
    expect(madeByOf(node({ type: "document", payload: { title: "x" } }))).toBeNull();
    const tree = [maker("s1", 1), f, node({ id: "plain", type: "document", payload: { title: "a.pdf" } }), node({ id: "inner", type: "document", parent_id: "s1", payload: { title: "b", made_by: "s1" } })];
    expect([...madeFilesOf(tree)]).toEqual([["f", "s1"]]);
  });

  it("adds a made file with a name, its step and no media or url", async () => {
    const tree = [maker("s1", 1), maker("s2", 2)];
    await addMadeFile(BUILD, tree, { stepId: "s2", name: "  brand-guide.md ", summary: "The colours" });
    const row = upsertNode.mock.calls[0][0] as { type: string; parent_id: null; position: number; payload: Record<string, unknown> };
    expect(row.type).toBe("document");
    expect(row.parent_id).toBeNull();
    expect(row.payload).toEqual({ title: "brand-guide.md", made_by: "s2", summary: "The colours" });
    expect(row.payload).not.toHaveProperty("media_id");
    expect(row.payload).not.toHaveProperty("url");
  });

  it("refuses a step that is not in the build, an empty or long name, and a repeat in any case", async () => {
    const tree = [maker("s1", 1), made("f", "s1")];
    await expect(addMadeFile(BUILD, tree, { stepId: "nope", name: "a.md" })).rejects.toThrow(/not a step/);
    await expect(addMadeFile(BUILD, tree, { stepId: "f", name: "a.md" })).rejects.toThrow(/not a step/);
    await expect(addMadeFile(BUILD, tree, { stepId: "s1", name: "   " })).rejects.toThrow(/1 to 120/);
    await expect(addMadeFile(BUILD, tree, { stepId: "s1", name: "x".repeat(121) })).rejects.toThrow(/1 to 120/);
    await expect(addMadeFile(BUILD, tree, { stepId: "s1", name: "BRAND-guide.MD" })).rejects.toThrow(/already makes/);
    expect(upsertNode).not.toHaveBeenCalled();
    await addMadeFile(BUILD, tree, { stepId: "s1", name: "x".repeat(120) });
    expect(upsertNode).toHaveBeenCalledTimes(1);
  });

  it("lets two steps make a file of the same name", async () => {
    const tree = [maker("s1", 1), maker("s2", 2), made("f", "s1")];
    await addMadeFile(BUILD, tree, { stepId: "s2", name: "brand-guide.md" });
    expect(upsertNode).toHaveBeenCalledTimes(1);
  });

  describe("inputRefusal", () => {
    const use = { kind: "file" as const, node_id: "f" };
    const tree = [maker("a", 1), maker("b", 2), maker("c", 3), made("f", "b")];
    const steps = buildSteps(tree);
    const map = madeFilesOf(tree);
    const names = new Map([["f", "brand-guide.md"]]);

    it("allows a step after the one that makes it", () => {
      expect(inputRefusal("c", [], use, steps, map, names)).toBeNull();
    });
    it("refuses the step before, and the step itself, in the words of the rule", () => {
      expect(inputRefusal("a", [], use, steps, map, names)).toBe("Only a step after step 2 can use brand-guide.md.");
      expect(inputRefusal("b", [], use, steps, map, names)).toBe("Only a step after step 2 can use brand-guide.md.");
    });
    it("treats a file nobody makes like any other file", () => {
      expect(inputRefusal("a", [], { kind: "file", node_id: "plain" }, steps, map, names)).toBeNull();
      expect(inputRefusal("a", [], use, steps)).toBeNull();
    });
    it("allows an earlier step inside an agent or team only when the maker repeats until a condition is met", () => {
      const mk = (id: string, position: number, runs?: Record<string, string>) =>
        node({ id, parent_id: "tm", position, type: "agent_config", payload: { system_prompt: "x", model: "m", ...(runs ? { runs } : {}) } });
      const looped = [node({ id: "tm", type: "team", position: 1, payload: {}, children: [mk("writer", 1), mk("checker", 2, { how: "until", detail: "ok" }), mk("other", 3)] }), made("g", "checker")];
      const inner = buildSteps(looped);
      const m = madeFilesOf(looped);
      expect(inputRefusal("writer", [], { kind: "file", node_id: "g" }, inner, m)).toBeNull();
      const plain = [node({ id: "tm", type: "team", position: 1, payload: {}, children: [mk("writer", 1), mk("other", 2)] }), made("g", "other")];
      expect(inputRefusal("writer", [], { kind: "file", node_id: "g" }, buildSteps(plain), madeFilesOf(plain))).toMatch(/^Only a step after step/);
    });
    it("is passed by addUse", async () => {
      await expect(addUse(tree[0] as BuildNode, use, steps, map, names)).rejects.toThrow(/Only a step after step 2/);
      await addUse(tree[2] as BuildNode, use, steps, map, names);
      expect(payloadWritten().uses).toEqual([use]);
    });
  });
});


describe("what an agent ran in, its models and its tools (CA-02 P5)", () => {
  it("saves the harness by id, every model with its role and the tools as integration refs", async () => {
    await addAgent(BUILD, [], {
      model: "Opus 5.5",
      harness: "Hermes Agent",
      models: [
        { model: "Opus 5.5", role: "main" },
        { model: "Haiku 5.5", role: "other" },
      ],
      toolRefs: ["t-gmail", "t-copilot", "t-gmail"],
      instructions: "Triage my inbox",
    });
    expect(payloadWritten()).toEqual({
      system_prompt: "Triage my inbox",
      model: "Opus 5.5",
      harness: "hermes-agent",
      models: [
        { model: "Opus 5.5", role: "main" },
        { model: "Haiku 5.5", role: "other" },
      ],
      tools: [{ tool_ref: "t-gmail" }, { tool_ref: "t-copilot" }],
    });
  });

  it("writes an agent with none of them exactly as before", async () => {
    await addAgent(BUILD, [], { model: "Opus 5.5", models: [{ model: "Opus 5.5", role: "main" }], toolRefs: [] });
    expect(payloadWritten()).toEqual({ system_prompt: "", model: "Opus 5.5" });
  });

  it("keeps a typed harness as typed", async () => {
    await addAgent(BUILD, [], { model: "my-llm", harness: " My own runner " });
    expect(payloadWritten()).toMatchObject({ harness: "My own runner" });
  });

  it("refuses a model row with no model, a fifth row, and a first row that is not the main model", async () => {
    await expect(addAgent(BUILD, [], { model: "Opus 5.5", models: [{ model: "Opus 5.5", role: "main" }, { model: " ", role: "plans" }] })).rejects.toThrow(/needs its name/);
    await expect(addTeam(BUILD, [], { model: "Opus 5.5", models: [{ model: "Opus 5.5", role: "main" }, { model: "", role: "acts" }] })).rejects.toThrow(/needs its name/);
    const five = Array.from({ length: 5 }, (_, i) => ({ model: i === 0 ? "Opus 5.5" : "Haiku 5.5", role: "other" }));
    await expect(addAgent(BUILD, [], { model: "Opus 5.5", models: five })).rejects.toThrow(/4 models at most/);
    await expect(addAgent(BUILD, [], { model: "Opus 5.5", models: [{ model: "Sonnet 5.5", role: "main" }, { model: "Opus 5.5", role: "plans" }] })).rejects.toThrow(/main model/);
    await expect(addAgent(BUILD, [], { model: "Opus 5.5", models: [{ model: "Opus 5.5", role: "main" }, { model: "Haiku 5.5", role: " " }] })).rejects.toThrow(/role/);
    expect(upsertNode).not.toHaveBeenCalled();
  });

  it("gives a team's leading agent the setup", async () => {
    upsertNode.mockImplementation(async (row: Record<string, unknown>) => ({ ...row, id: row.type === "team" ? "tm" : "new" }));
    await addTeam(BUILD, [], {
      model: "Fable 5.1",
      harness: "claude-code",
      models: [
        { model: "Fable 5.1", role: "plans" },
        { model: "Sonnet 5.5", role: "acts" },
      ],
    });
    expect(upsertNode.mock.calls[0][0].payload).toEqual({});
    // The first row is always main, whatever role it was handed.
    expect(upsertNode.mock.calls[1][0].payload).toEqual({
      system_prompt: "",
      model: "Fable 5.1",
      harness: "claude-code",
      models: [
        { model: "Fable 5.1", role: "main" },
        { model: "Sonnet 5.5", role: "acts" },
      ],
    });
  });

  it("reads the harness, the models and the tools back onto the step, and nothing for an old agent", () => {
    const tree = [
      node({
        id: "ag",
        type: "agent_config",
        position: 1,
        payload: { system_prompt: "x", model: "Opus 5.5", harness: "hermes-agent", models: [{ model: "Opus 5.5", role: "main" }, { model: "Haiku 5.5", role: "other" }], tools: [{ tool_ref: "t1" }] },
      }),
      node({ id: "old", type: "agent_config", position: 2, payload: { system_prompt: "y", model: "Opus 5.5" } }),
    ];
    const [agent, old] = buildSteps(tree);
    expect(agent).toMatchObject({ harness: "Hermes Agent", models: [{ model: "Opus 5.5", role: "main" }, { model: "Haiku 5.5", role: "other" }], toolRefs: ["t1"] });
    expect(agent.children[0].harness).toBeUndefined();
    expect(old.harness).toBeNull();
    expect(old.models).toBeUndefined();
    expect(old.toolRefs).toBeUndefined();
  });

  it("changes the setup from Details, keeping what it is not given", async () => {
    const agent = node({ id: "ag", type: "agent_config", payload: { system_prompt: "x", model: "Opus 5.5", harness: "hermes-agent", tools: [{ tool_ref: "t1" }] } }) as BuildNode;
    await setAgentSetup(agent, { model: "Sonnet 5.5", models: [] });
    expect(payloadWritten()).toEqual({ system_prompt: "x", model: "Sonnet 5.5", harness: "hermes-agent", tools: [{ tool_ref: "t1" }] });
    upsertNode.mockClear();
    await setAgentSetup(agent, { model: "Opus 5.5", harness: null, toolRefs: [] });
    expect(payloadWritten()).toEqual({ system_prompt: "x", model: "Opus 5.5" });
    await expect(setAgentSetup(node({}) as BuildNode, { model: "x" })).rejects.toThrow(/Only an agent/);
  });

  it("finds the build's integration node for a tool by the registry or by name", () => {
    const tree = [
      node({ id: "t1", type: "integration", payload: { service: "Gmail" } }),
      node({ id: "t2", type: "integration", payload: { service: "My CRM" } }),
    ];
    expect(toolNodeFor(tree, "gmail")).toBe("t1");
    expect(toolNodeFor(tree, "Google Mail")).toBe("t1");
    expect(toolNodeFor(tree, "my crm")).toBe("t2");
    expect(toolNodeFor(tree, "Vercel")).toBeNull();
  });
});


describe("code is a step (CA-02 P7)", () => {
  it("saves the source, its language and the optional file name, tool, model and entrypoint", async () => {
    await addCode(BUILD, [node({ position: 2 })], { source: "export const a = 1;\n", language: "ts", filename: " app.ts ", tool: "Cursor", model: "Opus 5", entrypoint: true });
    expect(upsertNode.mock.calls[0][0]).toMatchObject({ type: "code", parent_id: null, position: 3, title: null });
    expect(payloadWritten()).toEqual({ source: "export const a = 1;\n", language: "ts", filename: "app.ts", tool: "cursor", model: "Opus 5", entrypoint: true });
    upsertNode.mockClear();
    await addCode(BUILD, [], { source: "select 1;", language: "sql" });
    expect(payloadWritten()).toEqual({ source: "select 1;", language: "sql" });
  });

  it("refuses empty source, source over 100,000 characters, a language outside the schema and a long file name or tool", async () => {
    await expect(addCode(BUILD, [], { source: "  \n ", language: "ts" })).rejects.toThrow(/needs its lines/);
    await expect(addCode(BUILD, [], { source: "x".repeat(100_001), language: "ts" })).rejects.toThrow("Code is at most 100,000 characters. Upload it as a file instead.");
    await expect(addCode(BUILD, [], { source: "x", language: "rust" })).rejects.toThrow(/language/);
    await expect(addCode(BUILD, [], { source: "x", language: "ts", filename: "f".repeat(121) })).rejects.toThrow(/120/);
    await expect(addCode(BUILD, [], { source: "x", language: "ts", tool: "t".repeat(41) })).rejects.toThrow(/40/);
    expect(upsertNode).not.toHaveBeenCalled();
    await addCode(BUILD, [], { source: "x".repeat(100_000), language: "other" });
    expect(upsertNode).toHaveBeenCalledTimes(1);
  });

  it("numbers code like any top-level step, with its source as its text and its uses", () => {
    const tree = [
      node({ id: "p1", type: "prompt", position: 1, payload: { text: "Plan the app", tool: "cursor" } }),
      node({ id: "c1", type: "code", position: 2, payload: { source: "a\nb", language: "ts", filename: "app.ts", tool: "cursor", model: "Opus 5", entrypoint: true, uses: [{ kind: "output", node_id: "p1" }] } }),
      node({ id: "f1", type: "document", position: 3, payload: { title: "notes.md" } }),
      node({ id: "c2", type: "code", position: 4, payload: { source: "select 1;", language: "sql" } }),
    ];
    const steps = buildSteps(tree);
    expect(steps.map((step) => [step.id, step.kind, step.number, step.defaultTitle])).toEqual([
      ["p1", "prompt", "1", "Prompt 1"],
      ["c1", "code", "2", "Code 2"],
      ["c2", "code", "3", "Code 3"],
    ]);
    expect(steps[1]).toMatchObject({ text: "a\nb", words: 2, language: "ts", filename: "app.ts", entrypoint: true, tool: "Cursor", model: "Opus 5", uses: [{ kind: "output", node_id: "p1" }] });
    expect(steps[2]).toMatchObject({ filename: null, entrypoint: false });
    expect(goesInto(steps, "p1").map((step) => step.id)).toEqual(["c1"]);
  });
});
