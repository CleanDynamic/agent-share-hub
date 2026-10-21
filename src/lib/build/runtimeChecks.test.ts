import { describe, expect, it } from "vitest";

import { buildSteps } from "./graph";
import { NO_CODE_REMINDER, runtimeChecks } from "./runtimeChecks";
import type { NodeTree } from "./types";

const node = (over: Partial<NodeTree>): NodeTree =>
  ({ id: "n", build_id: "b", parent_id: null, position: 1, type: "prompt", title: null, note: null, payload: { text: "x" }, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-07T09:00:00.000Z", children: [], ...over }) as NodeTree;
const q = { id: "team", type: "choice", instructions: "Which?", options: [{ key: "a" }, { key: "b" }] };
const dec = (payload: object = {}) => node({ id: "dec", position: 1, type: "decision", title: "Router", payload: { provider: "typesafe-jev", model: "jev", questions: [q], ...payload } });
const run = (tree: NodeTree[]) => runtimeChecks(buildSteps(tree));

describe("runtime publish checks (CA-13 P18)", () => {
  it("has nothing to say about a build with no runtime tiles", () => {
    expect(run([node({})])).toEqual({ blockers: [], reminders: [] });
  });
  it("blocks a decision with no questions", () => {
    const out = run([dec({ questions: [] })]);
    expect(out.blockers).toHaveLength(1);
  });
  it("blocks a broken Runs when", () => {
    const out = run([dec(), node({ id: "a", position: 2, type: "code", payload: { source: "x", language: "python", runs_when: { decision: "gone", question: "team", is: ["a"] } } })]);
    expect(out.blockers[0]).toContain("no longer in the build");
  });
  it("only reminds about a decision with no code, and about a missing schema", () => {
    const out = run([dec(), node({ id: "ag", position: 2, type: "agent_config", payload: { system_prompt: "x", model: "m", output_shape: { how: "json-schema", where: "Claude API" } } })]);
    expect(out.blockers).toEqual([]);
    expect(out.reminders).toContain(NO_CODE_REMINDER);
    expect(out.reminders.some((line) => line.includes("missing its schema"))).toBe(true);
  });
  it("is quiet when a code tile calls the decision", () => {
    const out = run([node({ id: "c", position: 1, type: "code", payload: { source: "x", language: "python" } }), dec({ called_from: ["c"] })]);
    expect(out.reminders).toEqual([]);
  });
});
