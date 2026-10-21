import { describe, expect, it } from "vitest";

import { buildSteps } from "./graph";
import { runtimeFolder } from "./runtimeFolder";
import type { NodeTree } from "./types";

const BUILD = "33333333-0000-4000-8000-000000000003";
const node = (over: Partial<NodeTree>): NodeTree =>
  ({ id: "n", build_id: BUILD, parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: { text: "x" }, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-07T09:00:00.000Z", children: [], ...over }) as NodeTree;

const questions = [{ id: "team", type: "choice", instructions: "Which team?", options: [{ key: "billing" }, { key: "support" }] }];
const tree = [
  node({ id: "code1", position: 1, type: "code", payload: { source: "client.decide(q)", language: "python", filename: "router.py" } }),
  node({ id: "dec", position: 2, type: "decision", title: "Ticket router", payload: { provider: "typesafe-jev", model: "jev-1.13.0", questions, answer: { team: { value: "billing" } }, run_cost: { ms: 90, cost: 0.0001 }, trace_url: "https://smith.example/t/1" } }),
  node({ id: "ag", position: 3, type: "agent_config", title: "Refunder", payload: { system_prompt: "Refund.", model: "m", harness: "deep-agents", output_shape: { how: "json-schema", where: "Claude API", schema: '{"title":"Refund","type":"object"}' } } }),
];

describe("the run folder (CA-13 P17)", () => {
  const { entries } = runtimeFolder(buildSteps(tree));
  const text = (path: string) => new TextDecoder().decode(entries.find((entry) => entry.path === path)?.data);

  it("lists the code, decision, agent, schema, env and readme files", () => {
    expect(entries.map((entry) => entry.path).sort()).toEqual([".env.example", "README.md", "agents/refunder.py", "decisions/ticket-router.json", "router.py", "schemas/refund.schema.json"].sort());
  });

  it("names keys without values, and carries no trace link, cost or run figure", () => {
    expect(text(".env.example")).toBe("TYPESAFE_API_KEY=\n");
    const all = entries.map((entry) => new TextDecoder().decode(entry.data)).join("\n");
    expect(all).not.toMatch(/smith\.example|0\.0001|"ms"|run_cost|build_cost/);
    expect(JSON.parse(text("decisions/ticket-router.json")).answer).toBeUndefined();
  });

  it("starts the agent file with a comment and the readme says what you need and the check", () => {
    expect(text("agents/refunder.py").split("\n")[0]).toMatch(/^#/);
    expect(text("README.md")).toContain("What you need");
    expect(text("README.md")).toContain("On this example, your copy should answer team = billing.");
  });
});
