import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertNode = vi.fn();
vi.mock("./nodes", () => ({
  upsertNode: (...a: unknown[]) => upsertNode(...a),
  getNodeTree: vi.fn(),
  reorderNodes: vi.fn(),
  deleteNode: vi.fn(),
}));
const getNodeType = vi.fn();
vi.mock("./nodeTypes", () => ({ getNodeType: (...a: unknown[]) => getNodeType(...a) }));

import { addDecision, buildSteps, DECISION_TYPE_MISSING, setDecision, setRunsWhen } from "./graph";
import type { BuildNode, NodeTree } from "./types";

const BUILD = "33333333-0000-4000-8000-000000000003";
let seq = 0;
const node = (over: Partial<NodeTree>): NodeTree =>
  ({ id: `n${++seq}`, build_id: BUILD, parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: { text: "one two" }, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-07T09:00:00.000Z", children: [], ...over }) as NodeTree;

const questions = [
  { id: "team", type: "choice" as const, instructions: "Which team?", options: [{ key: "billing" }, { key: "support" }] },
  { id: "tone", type: "score" as const, instructions: "", levels: ["Calm", "Annoyed"] },
];
const decisionPayload = { provider: "typesafe-jev", model: "jev-1.13.0", questions, called_from: ["code1"] };

beforeEach(() => {
  seq = 0;
  upsertNode.mockReset();
  upsertNode.mockImplementation(async (row: unknown) => row);
  getNodeType.mockReset();
  getNodeType.mockResolvedValue({ key: "decision", is_active: true });
});

describe("a decision step (CA-13 P2)", () => {
  it("is a numbered runtime step that reads its questions, and a build without one reads as before", () => {
    const steps = buildSteps([
      node({ id: "p", position: 1 }),
      node({ id: "c", position: 2, type: "code", payload: { source: "x = 1", language: "python", filename: "router.py" } }),
      node({ id: "d", position: 3, type: "decision", payload: decisionPayload }),
    ]);
    expect(steps.map((s) => [s.number, s.kind])).toEqual([["1", "prompt"], ["2", "code"], ["3", "decision"]]);
    expect(steps[2].defaultTitle).toBe("team, tone");
    expect(steps[2].decision?.calledFrom).toEqual(["code1"]);
    expect(steps[2].decision?.questions.map((q) => q.id)).toEqual(["team", "tone"]);
  });

  it("reads 'Runs when' on runtime tiles only, never on a prompt, manual step, file or result", () => {
    const runs_when = { decision: "d", question: "team", is: ["billing"] };
    const steps = buildSteps([
      node({ id: "d", position: 1, type: "decision", payload: decisionPayload }),
      node({ id: "a", position: 2, type: "agent_config", payload: { system_prompt: "x", model: "m", runs_when } }),
      node({ id: "c", position: 3, type: "code", payload: { source: "x", language: "python", runs_when } }),
      node({ id: "p", position: 4, payload: { text: "typed while building", runs_when } }),
      node({ id: "m", position: 5, type: "manual_step", payload: { tool: "Figma", text: "did a thing", runs_when } }),
    ]);
    expect(steps.map((s) => Boolean(s.runsWhen))).toEqual([false, true, true, false, false]);
  });
});

describe("addDecision and setDecision", () => {
  it("is refused until the CA-13 database change is live, in plain words", async () => {
    getNodeType.mockResolvedValue(null);
    await expect(addDecision(BUILD, [], { provider: "typesafe-jev", model: "jev-1.13.0", questions })).rejects.toThrow(DECISION_TYPE_MISSING);
    expect(DECISION_TYPE_MISSING).toBe("Decisions need the CA-13 database change. Ask Lovable to apply it.");
    expect(upsertNode).not.toHaveBeenCalled();
  });

  it("refuses a decision with no questions or a choice with no options, saying which", async () => {
    await expect(addDecision(BUILD, [], { name: "team", provider: "typesafe-jev", model: "", questions: [] })).rejects.toThrow("Decision 'team' has no questions");
    await expect(addDecision(BUILD, [], { name: "team", provider: "typesafe-jev", model: "", questions: [{ id: "team", type: "choice", instructions: "", options: [{ key: "a" }] }] })).rejects.toThrow("Decision 'team' has no options");
  });

  it("writes the typed payload, and a Uses link when the state comes from a step, without needing code", async () => {
    await addDecision(BUILD, [], {
      provider: "Jev",
      model: " jev-1.13.0 ",
      calledFrom: ["code1", "code1"],
      stateFrom: "p1",
      questions,
      answer: { team: { value: "billing", probabilities: { billing: 0.92 } } },
      source: "run",
    });
    const row = upsertNode.mock.calls[0][0] as { type: string; payload: Record<string, unknown> };
    expect(row.type).toBe("decision");
    expect(row.payload).toMatchObject({ provider: "typesafe-jev", model: "jev-1.13.0", called_from: ["code1"], state_from: "p1", source: "run", uses: [{ kind: "output", node_id: "p1" }] });
    expect(row.payload.answer).toEqual({ team: { value: "billing", probabilities: { billing: 0.92 } } });
  });

  it("changes a decision's settings and keeps its 'Runs when' and its place", async () => {
    const existing = node({ id: "d", type: "decision", payload: { ...decisionPayload, runs_when: { decision: "other", question: "x", is: ["y"] }, state_from: "p1", uses: [{ kind: "output", node_id: "p1" }] } }) as unknown as BuildNode;
    await setDecision(existing, { provider: "typesafe-jev", model: "jev-1.14.0", stateFrom: "p2", questions });
    const row = upsertNode.mock.calls[0][0] as { payload: Record<string, unknown> };
    expect(row.payload.model).toBe("jev-1.14.0");
    expect(row.payload.runs_when).toEqual({ decision: "other", question: "x", is: ["y"] });
    expect(row.payload.uses).toEqual([{ kind: "output", node_id: "p2" }]);
  });
});

describe("setRunsWhen", () => {
  const tree = [
    node({ id: "p", position: 1 }),
    node({ id: "d", position: 2, type: "decision", payload: decisionPayload }),
    node({ id: "a", position: 3, type: "agent_config", payload: { system_prompt: "x", model: "m" } }),
    node({ id: "p2", position: 4 }),
  ];
  const steps = buildSteps(tree);
  const ok = { decision: "d", question: "team", is: ["billing"] };

  it("sets and clears the condition on an agent below the decision", async () => {
    await setRunsWhen(tree[2] as unknown as BuildNode, steps, ok);
    expect((upsertNode.mock.calls[0][0] as { payload: Record<string, unknown> }).payload.runs_when).toEqual(ok);
    upsertNode.mockClear();
    await setRunsWhen({ ...tree[2], payload: { ...(tree[2].payload as object), runs_when: ok } } as unknown as BuildNode, steps, null);
    expect((upsertNode.mock.calls[0][0] as { payload: Record<string, unknown> }).payload.runs_when).toBeUndefined();
  });

  it("is refused on a prompt, above its decision, and for a value the question cannot take", async () => {
    await expect(setRunsWhen(tree[3] as unknown as BuildNode, steps, ok)).rejects.toThrow(/Only an agent/);
    await expect(setRunsWhen(tree[0] as unknown as BuildNode, steps, ok)).rejects.toThrow(/Only an agent/);
    await expect(setRunsWhen(tree[1] as unknown as BuildNode, steps, { ...ok, decision: "d" })).rejects.toThrow(/above it/);
    await expect(setRunsWhen(tree[2] as unknown as BuildNode, steps, { ...ok, is: ["nope"] })).rejects.toThrow(/not one the question can take/);
    await expect(setRunsWhen(tree[2] as unknown as BuildNode, steps, { ...ok, decision: "gone" })).rejects.toThrow(/no longer in the build/);
  });
});

import { setRuntimeFields } from "./graph";

describe("runtime facts (CA-13 P5 to P8)", () => {
  const agent = node({ id: "a", type: "agent_config", payload: { system_prompt: "x", model: "m", harness: "deep-agents" } });
  const asNode = (n: NodeTree) => n as unknown as BuildNode;
  const written = () => (upsertNode.mock.calls.at(-1)?.[0] as { payload: Record<string, unknown> }).payload;

  it("reads an agent's helpers, where it is defined, its trace link, answer shape and both costs", () => {
    const [step] = buildSteps([
      node({
        id: "a",
        type: "agent_config",
        payload: {
          system_prompt: "x",
          model: "m",
          helpers: [{ provider: "scaledown", job: "summarize", trigger: { at: 0.8 } }, { job: "nope" }],
          defined_in: ["c1"],
          trace_url: "https://smith.langchain.com/o/1",
          output_shape: { how: "json-schema", schema: "{\"title\":\"Order\"}" },
          build_cost: { ms: 1200, cost: 0.01 },
          run_cost: { per: "call", ms: 120 },
        },
      }),
    ]);
    expect(step.helpers).toHaveLength(1);
    expect(step.definedIn).toEqual(["c1"]);
    expect(step.traceUrl).toBe("https://smith.langchain.com/o/1");
    expect(step.outputShape?.how).toBe("json-schema");
    expect(step.buildCost?.ms).toBe(1200);
    expect(step.runCost).toMatchObject({ per: "call", ms: 120 });
    // The agent's own instructions row carries none of it.
    expect(step.children[0].helpers).toBeUndefined();
    expect(step.children[0].runCost).toBeUndefined();
  });

  it("drops an http trace link and a run cost on a prompt when reading", () => {
    const [prompt, agentStep] = buildSteps([
      node({ id: "p", position: 1, payload: { text: "hi", build_cost: { ms: 5 }, run_cost: { per: "call", ms: 9 }, helpers: [{ provider: "x", job: "summarize" }] } }),
      node({ id: "a2", position: 2, type: "agent_config", payload: { system_prompt: "x", model: "m", trace_url: "http://x.com/t" } }),
    ]);
    expect(prompt.buildCost?.ms).toBe(5);
    expect(prompt.runCost).toBeUndefined();
    expect(prompt.helpers).toBeUndefined();
    expect(agentStep.traceUrl).toBeUndefined();
  });

  it("writes helpers, defined in, a trace link, install and shape on an agent, and takes them off with null", async () => {
    await setRuntimeFields(asNode(agent), { helpers: [{ provider: "scaledown", job: "extract", fields: ["order_id"] }], definedIn: ["c1", "c1"], traceUrl: "https://smith.langchain.com/x", install: " pip install thing ", outputShape: { how: "json-schema", schema: "{}" } });
    expect(written()).toMatchObject({ helpers: [{ provider: "scaledown", job: "extract", fields: ["order_id"] }], defined_in: ["c1"], trace_url: "https://smith.langchain.com/x", install: "pip install thing", output_shape: { how: "json-schema", schema: "{}" } });
    await setRuntimeFields(asNode({ ...agent, payload: written() } as NodeTree), { helpers: null, traceUrl: null });
    expect(written().helpers).toBeUndefined();
    expect(written().trace_url).toBeUndefined();
  });

  it("refuses what does not belong: helpers on a prompt, an http trace link, an incomplete helper or a run cost on a prompt", async () => {
    const prompt = asNode(node({ id: "p", payload: { text: "hi" } }));
    await expect(setRuntimeFields(prompt, { helpers: [{ provider: "scaledown", job: "summarize" }] })).rejects.toThrow(/Only an agent has helpers/);
    await expect(setRuntimeFields(asNode(agent), { traceUrl: "http://x.com" })).rejects.toThrow(/https/);
    await expect(setRuntimeFields(asNode(agent), { helpers: [{ provider: "scaledown", job: "extract" }] })).rejects.toThrow(/fields to pull out/);
    await expect(setRuntimeFields(prompt, { runCost: { per: "call", ms: 1, source: "maker" } })).rejects.toThrow(/Only a runtime tile/);
    await expect(setRuntimeFields(prompt, { outputShape: { how: "json-schema" } })).rejects.toThrow(/needs its schema/);
  });

  it("keeps what it took to make apart from what it costs to run, on a runtime tile", async () => {
    await setRuntimeFields(asNode(agent), { buildCost: { ms: 1000, source: "maker" }, runCost: { per: "hour", cost: 7, currency: "GBP", source: "maker" } });
    expect(written()).toMatchObject({ build_cost: { ms: 1000 }, run_cost: { per: "hour", cost: 7 } });
  });
});
