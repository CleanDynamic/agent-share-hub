import { describe, expect, it } from "vitest";

import { differenceSentence, matchSteps, shareRoot, totalsOf, totalsRows, type CompareSide } from "./compare";
import type { SessionGroup, Step } from "./graph";

const step = (id: string, kind: Step["kind"], extra: Partial<Step> = {}): Step =>
  ({ id, kind, number: id, title: null, defaultTitle: id, text: "", words: 0, model: null, sessionId: null, tool: null, runs: null, uses: [], children: [], ...extra }) as Step;
const group = (extras: SessionGroup["extras"]): SessionGroup => ({ sessionId: "s", number: 1, tool: "Claude Code", model: null, startedAt: "2026-10-01T10:00:00", stepNumbers: ["1"], extras });
const side = (steps: Step[], groups: SessionGroup[] = [], models: string[] = []): CompareSide => ({ title: "x", steps, groups, models });

describe("matchSteps (CA-13 P9)", () => {
  it("matches steps by kind and order, and shows the rest as gaps", () => {
    const a = [step("a1", "prompt"), step("a2", "agent"), step("a3", "prompt")];
    const b = [step("b1", "prompt"), step("b2", "decision"), step("b3", "agent"), step("b4", "prompt")];
    const rows = matchSteps(a, b);
    expect(rows.map((row) => [row.a?.id ?? null, row.b?.id ?? null])).toEqual([["a1", "b1"], [null, "b2"], ["a2", "b3"], ["a3", "b4"]]);
  });

  it("is all gaps when nothing matches, and empty for two empty builds", () => {
    expect(matchSteps([step("a", "prompt")], [step("b", "agent")])).toHaveLength(2);
    expect(matchSteps([], [])).toEqual([]);
  });
});

describe("totals and the differences in words", () => {
  const original = side([step("1", "prompt", { buildCost: { tokensIn: 2_000_000, source: "maker" } }), step("2", "agent"), step("3", "prompt")], [group({ ms: 7_200_000, showCost: true, cost: 10, currency: "GBP" })], ["Opus 5.5"]);
  const copy = side(
    [
      step("1", "prompt", { buildCost: { tokensIn: 1_200_000, source: "maker" } }),
      step("2", "decision"),
      step("3", "agent", { runsWhen: { decision: "2", question: "team", is: ["billing"] } }),
      step("4", "prompt"),
    ],
    [group({ ms: 3_600_000, cost: 4, currency: "GBP" })],
    ["Sonnet 5.5"],
  );

  it("says what the copy did differently, as 'This one …'", () => {
    const sentence = differenceSentence(totalsOf(copy), totalsOf(original));
    expect(sentence).toContain("This one used a router");
    expect(sentence).toContain("used 40% fewer tokens");
    expect(sentence).toContain("took 50% less time");
    expect(sentence).toContain("has 1 more step");
    expect(sentence.endsWith(".")).toBe(true);
  });

  it("keeps to build and to run in separate rows, and hides money the maker did not show", () => {
    const rows = totalsRows(totalsOf(copy), totalsOf(original));
    expect(rows.map((row) => row.label)).toEqual(["To build · time", "To build · tokens", "To build · cost", "To run", "Steps", "Models used"]);
    const cost = rows.find((row) => row.label === "To build · cost");
    expect(cost).toMatchObject({ a: "–", b: "£10.00" });
    expect(rows.find((row) => row.label === "Models used")).toMatchObject({ a: "Sonnet 5.5", b: "Opus 5.5" });
  });

  it("says they look alike when nothing differs, and ignores a figure only one of them has", () => {
    expect(differenceSentence(totalsOf(side([step("1", "prompt")])), totalsOf(side([step("1", "prompt")])))).toBe("These two look alike on every figure given.");
    expect(differenceSentence(totalsOf(side([step("1", "prompt", { buildCost: { tokensIn: 5, source: "maker" } })])), totalsOf(side([step("1", "prompt")])))).toBe("These two look alike on every figure given.");
  });

  it("compares only builds that share a root", () => {
    expect(shareRoot({ id: "a", root_build_id: "r" }, { id: "b", root_build_id: "r" })).toBe(true);
    expect(shareRoot({ id: "r", root_build_id: null }, { id: "b", root_build_id: "r" })).toBe(true);
    expect(shareRoot({ id: "a", root_build_id: "x" }, { id: "b", root_build_id: "r" })).toBe(false);
    expect(shareRoot({ id: "a", root_build_id: null }, { id: "a", root_build_id: null })).toBe(false);
  });
});
