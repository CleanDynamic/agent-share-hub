import { describe, expect, it } from "vitest";

import { buildSteps } from "./graph";
import { decorateRun, decoratedText, hasRuntimeFacts, type RunItemIn } from "./runSequence";
import type { Json } from "@/integrations/supabase/types";
import type { NodeTree } from "./types";

const BUILD = "33333333-0000-4000-8000-000000000003";
const node = (over: Partial<NodeTree>): NodeTree =>
  ({ id: "n", build_id: BUILD, parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: { text: "x" }, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-07T09:00:00.000Z", children: [], ...over }) as NodeTree;

const questions = [{ id: "team", type: "choice", instructions: "Which team?", options: [{ key: "billing" }, { key: "support" }, { key: "kitchen" }] }];
const answer = { team: { value: "billing", probabilities: { billing: 0.92, support: 0.08 } } };
const when = (key: string) => ({ decision: "dec", question: "team", is: [key] });

const tree = (over: { calledFrom?: string[]; helpers?: Json[]; money?: boolean } = {}) => [
  node({ id: "p1", position: 1, payload: { text: "Make a router" } }),
  node({ id: "code1", position: 2, type: "code", payload: { source: "client.decide(questions)", language: "python", filename: "router.py" } }),
  node({ id: "dec", position: 3, type: "decision", payload: { provider: "typesafe-jev", model: "jev-1.13.0", called_from: over.calledFrom ?? [], questions, answer, source: "run", state_sample: "I was charged twice.", run_cost: { per: "call", ms: 120, cost: 0.0001, currency: "GBP" } } }),
  node({ id: "b1", position: 4, type: "agent_config", payload: { system_prompt: "Refund them.", model: "m", runs_when: when("billing"), ...(over.helpers ? { helpers: over.helpers } : null) } }),
  node({ id: "b2", position: 5, type: "code", payload: { source: "refund()", language: "python", runs_when: when("billing"), build_cost: { ms: 1200, cost: 0.01 } } }),
  node({ id: "s1", position: 6, type: "agent_config", payload: { system_prompt: "Help them.", model: "m", runs_when: when("support") } }),
  node({ id: "end", position: 7, payload: { text: "Reply to the customer" } }),
];

const copyables = (steps: ReturnType<typeof buildSteps>): RunItemIn[] => steps.map((s) => ({ id: s.id, title: s.title ?? s.defaultTitle, kind: s.kind, copyText: s.text || null }));
const run = (over: Parameters<typeof tree>[0] = {}, groups = []) => {
  const steps = buildSteps(tree(over));
  return { steps, items: decorateRun(copyables(steps), steps, groups) };
};

describe("the run view's steps (CA-13 P13)", () => {
  it("is untouched for a build with no decision, branch, helper or answer shape", () => {
    expect(hasRuntimeFacts(buildSteps([node({ id: "a" }), node({ id: "b", position: 2, type: "code", payload: { source: "x", language: "python" } })]))).toBe(false);
    expect(hasRuntimeFacts(buildSteps(tree()))).toBe(true);
  });

  it("with no code, a Decision is its own step: the call, the request with the key as a placeholder, and what the original answered", () => {
    const { items } = run();
    const decision = items.find((item) => item.id === "dec")!;
    expect(decision.number).toBe("3");
    expect(decision.copyText).toContain("Call Jev 1.13 with this message and these questions");
    expect(decision.copyText).toContain("I was charged twice.");
    expect(decision.copyText).toContain("$TYPESAFE_API_KEY");
    expect(decision.copyText).toContain("On the example, the original answered: team → billing (92% sure).");
  });

  it("puts the maker's code first: a Code tile that calls the Decision is the step, and the Decision sits inside it as what it sets up", () => {
    const { items } = run({ calledFrom: ["code1"] });
    expect(items.map((item) => item.id)).not.toContain("dec");
    const code = items.find((item) => item.id === "code1")!;
    expect(code.copyText).toBe("client.decide(questions)");
    expect(code.setsUp).toEqual(["Decision 'team' (Jev 1.13): team"]);
    expect(items.map((item) => item.number)).toEqual(["1", "2", "2a", "2b", "2c", "3"]);
  });

  it("numbers branch steps 4a, 4b under their condition, headed 'If team is billing:' and 'If team is support:', then 'Then, in every case:'", () => {
    const { items } = run();
    expect(items.map((item) => [item.id, item.number, item.heading ?? null])).toEqual([
      ["p1", "1", null],
      ["code1", "2", null],
      ["dec", "3", null],
      ["b1", "3a", "If team is billing:"],
      ["b2", "3b", null],
      ["s1", "3c", "If team is support:"],
      ["end", "4", "Then, in every case:"],
    ]);
  });

  it("the copied text uses the same words, in order", () => {
    const { items } = run();
    const text = decoratedText("Router", [], items);
    const at = (needle: string) => text.indexOf(needle);
    expect(at("If team is billing:")).toBeGreaterThan(at("3. "));
    expect(at("3a. ")).toBeGreaterThan(at("If team is billing:"));
    expect(at("If team is support:")).toBeGreaterThan(at("3b. "));
    expect(at("Then, in every case:")).toBeGreaterThan(at("3c. "));
    expect(at("4. ")).toBeGreaterThan(at("Then, in every case:"));
  });

  it("an agent with helpers and no code copies its instructions, its helpers one line each, and the labelled starting point", () => {
    const { items } = run({ helpers: [{ provider: "scaledown", job: "summarize", trigger: { at: 0.8 } }, { provider: "scaledown", job: "compress", tools: ["fetch_docs"] }] });
    const agent = items.find((item) => item.id === "b1")!;
    expect(agent.copyText).toContain("Refund them.");
    expect(agent.copyText).toContain("Helpers it used:\n- Summarize at 80%\n- Compress fetch_docs");
    expect(agent.copyText).toContain("Written from the settings on this page, not the maker's own code");
    expect(agent.copyText).toContain("create_deep_agent(");
  });

  it("an agent defined in a Code tile is folded into that code, and its helpers show as what the code sets up", () => {
    const steps = buildSteps([
      node({ id: "code1", position: 1, type: "code", payload: { source: "agent = create_deep_agent()", language: "python", filename: "kitchen_agent.py" } }),
      node({ id: "ag", position: 2, type: "agent_config", title: "Kitchen agent", payload: { system_prompt: "x", model: "m", defined_in: ["code1"], helpers: [{ provider: "scaledown", job: "summarize", trigger: { at: 0.8 } }] } }),
    ]);
    const items = decorateRun(copyables(steps), steps, []);
    expect(items.map((item) => item.id)).toEqual(["code1"]);
    expect(items[0].setsUp).toEqual(["Agent 'Kitchen agent' with helpers: Summarize at 80%"]);
  });

  it("a step with an answer shape copies its prompt, then 'Answer in this shape:' and the schema, plus the fragment for its provider", () => {
    const schema = JSON.stringify({ title: "Order", type: "object" });
    const steps = buildSteps([node({ id: "p", payload: { text: "Extract the order", output_shape: { how: "json-schema", where: "Claude API", schema } } })]);
    const [item] = decorateRun(copyables(steps), steps, []);
    expect(item.copyText).toContain("Extract the order");
    expect(item.copyText).toContain(`Answer in this shape:\n${schema}`);
    expect(item.copyText).toContain("output_config");
  });

  it("never puts a cost or a time in the copied text, and shows the original's as quiet lines only when the maker shows costs", () => {
    const hidden = run();
    for (const item of hidden.items) {
      expect(item.copyText ?? "").not.toMatch(/£|\bms\b|took the original|The original took/);
      expect(item.quiet).toBeUndefined();
    }
    const steps = buildSteps(tree());
    const shown = decorateRun(copyables(steps), steps, [{ sessionId: "s", number: 1, tool: null, model: null, startedAt: null, stepNumbers: [], extras: { showCost: true } }]);
    expect(shown.find((item) => item.id === "dec")?.quiet).toEqual(["Each call took the original 120 ms · £0.0001"]);
    expect(shown.find((item) => item.id === "b2")?.quiet).toEqual(["The original took 1.2 s · £0.01 to make"]);
    for (const item of shown) expect(item.copyText ?? "").not.toMatch(/£0\.0001|1\.2 s/);
  });
});
