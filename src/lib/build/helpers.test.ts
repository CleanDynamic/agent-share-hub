import { describe, expect, it } from "vitest";

import { beforeAfterLine, helperChip, helperDidLine, helpersOf, helpersRefusal, helperSavingsLine, smallerBy, type Helper } from "./helpers";

const raw = [
  { provider: "scaledown", job: "summarize", model: "openai:gpt-6-sol", trigger: { at: 0.8, keep: 0.1 }, did: { times: 6, source: "run" } },
  { provider: "scaledown", job: "compress", tools: ["fetch_docs"], did: { before: 18402, after: 3110, unit: "characters", source: "maker" } },
  { provider: "scaledown", job: "extract", fields: ["order_id", "issue_type"], did: { values: { order_id: "4821" }, source: "run" } },
  { provider: "scaledown", job: "classify", labels: ["progress", "looping"], stopAt: 0.8, did: { times: 1, stopped: { label: "looping", score: 0.86 }, source: "run" } },
  { provider: "typesafe", job: "decide", questions: "dec1" },
];

describe("helpers (CA-13 P6)", () => {
  it("reads defensively: a bad job or no provider is skipped, and there are twelve at most", () => {
    expect(helpersOf(raw)).toHaveLength(5);
    expect(helpersOf([{ job: "summarize" }, { provider: "x", job: "nope" }, null, "x"])).toEqual([]);
    expect(helpersOf(Array.from({ length: 20 }, () => ({ provider: "scaledown", job: "summarize" })))).toHaveLength(12);
    expect(helpersOf("nope")).toEqual([]);
  });

  it("words each chip as the prompt does", () => {
    const helpers = helpersOf(raw);
    expect(helpers.map((h) => helperChip(h, (id) => (id === "dec1" ? "team" : undefined)))).toEqual(["Summarize at 80%", "Compress fetch_docs", "Extract order_id, issue_type", "Stop if looping", "Decide: team"]);
  });

  it("gives each chip's quiet second line from what it did", () => {
    const helpers = helpersOf(raw);
    expect(helpers.map((h) => helperDidLine(h))).toEqual(["6 times", "83% smaller", "order_id = 4821", "stopped once, looping 0.86", null]);
  });

  it("works the percentage out, never typed: 18,402 to 3,110 is 83% smaller", () => {
    expect(smallerBy(18402, 3110)).toBe(83);
    expect(smallerBy(100, 150)).toBeNull();
    expect(smallerBy(undefined, 5)).toBeNull();
    expect(beforeAfterLine(helpersOf(raw)[1].did)).toBe("18,402 → 3,110 characters (83% smaller)");
    expect(beforeAfterLine({ times: 3, source: "run" })).toBeNull();
  });

  it("says what helpers saved only when before and after are in tokens", () => {
    const tokens: Helper[] = [{ provider: "scaledown", job: "compress", did: { before: 400_000, after: 90_000, unit: "tokens", source: "maker" } }];
    expect(helperSavingsLine(tokens)).toBe("Helpers cut about 310k tokens a run");
    expect(helperSavingsLine(helpersOf(raw))).toBeNull();
  });

  it("refuses a helper with no job or provider, or missing its few fields, in plain words", () => {
    expect(helpersRefusal([{ provider: "", job: "summarize" }])).toBe("The summarize helper needs its provider");
    expect(helpersRefusal([{ provider: "scaledown", job: "extract" }])).toBe("The extract helper needs the fields to pull out");
    expect(helpersRefusal([{ provider: "scaledown", job: "classify" }])).toBe("The classify helper needs its labels");
    expect(helpersRefusal([{ provider: "typesafe", job: "decide" }])).toBe("The decide helper needs a decision");
    expect(helpersRefusal(helpersOf(raw))).toBeNull();
  });
});
