import { describe, expect, it } from "vitest";

import type { SessionGroup, Step } from "./graph";
import { buildPatterns, patternsLine } from "./patterns";

const step = (id: string, kind: Step["kind"], extra: Partial<Step> = {}): Step =>
  ({ id, kind, number: id, title: null, defaultTitle: id, text: "", words: 0, model: null, sessionId: null, tool: null, runs: null, uses: [], children: [], ...extra }) as Step;
const group = (extras: SessionGroup["extras"]): SessionGroup => ({ sessionId: "s", number: 1, tool: "Claude Code", model: null, startedAt: "2026-10-01T10:00:00", stepNumbers: ["1"], extras });
const decision = step("d", "decision");

describe("buildPatterns (CA-13 P10)", () => {
  it("finds nothing in a build that uses none", () => {
    expect(buildPatterns([step("1", "prompt"), step("2", "agent")])).toEqual([]);
  });

  it("calls a decision with a branch a router, and a decision alone only structured output", () => {
    expect(buildPatterns([decision])).toEqual(["structured-output"]);
    expect(buildPatterns([decision, step("2", "agent", { runsWhen: { decision: "d", question: "team", is: ["billing"] } })])).toEqual(["router", "structured-output"]);
  });

  it("does not call a condition on a decision that is not in the build a router", () => {
    expect(buildPatterns([step("2", "agent", { runsWhen: { decision: "gone", question: "team", is: ["billing"] } })])).toEqual([]);
  });

  it("calls an agent with a helper long-running, even inside a team", () => {
    const helper = { provider: "scaledown", job: "summarize" as const };
    expect(buildPatterns([step("1", "agent", { helpers: [helper] })])).toEqual(["long-running"]);
    expect(buildPatterns([step("1", "team", { children: [step("1.1", "agent", { helpers: [helper] })] })])).toEqual(["long-running"]);
  });

  it("calls a background session that ran over an hour long-running, and a short or watched one not", () => {
    expect(buildPatterns([step("1", "prompt")], [group({ background: true, ms: 3_600_001 })])).toEqual(["long-running"]);
    expect(buildPatterns([step("1", "prompt")], [group({ background: true, ms: 3_600_000 })])).toEqual([]);
    expect(buildPatterns([step("1", "prompt")], [group({ ms: 9_000_000 })])).toEqual([]);
  });

  it("calls any step with an answer shape structured output", () => {
    expect(buildPatterns([step("1", "prompt", { outputShape: { how: "json-schema", schema: "{}" } })])).toEqual(["structured-output"]);
  });

  it("words them for the facts line", () => {
    expect(patternsLine(["router", "long-running"])).toBe("Uses a router · Long-running agent");
    expect(patternsLine([])).toBe("");
  });
});
