// CA-05 P2 — session facts: length, cost, later runs and nobody watching.

import { describe, expect, it } from "vitest";

import { sessionsMetaOf } from "./making";
import { extrasOf, extrasRefusal, FACTS_COPY, readResultFile, sessionFactsLine, withExtras } from "./sessionFacts";

describe("the line", () => {
  it("is absent when nothing is set", () => {
    expect(sessionFactsLine({}, "maker")).toBeNull();
    expect(sessionFactsLine({ extras: {}, words: 99_999 }, "reader")).toBeNull();
  });
  it("says a session is long only over 100,000 words, to the nearest thousand", () => {
    expect(sessionFactsLine({ words: 100_000 }, "maker")).toBeNull();
    expect(sessionFactsLine({ words: 150_200 }, "maker")).toBe("Long session, about 150,000 words. Smaller models may not read it all at once.");
    expect(sessionFactsLine({ extras: { words: 180_000 }, words: 20 }, "reader")).toContain("about 180,000 words");
  });
  it("labels a cost 'about', with tokens when known", () => {
    expect(sessionFactsLine({ extras: { cost: 3.4, currency: "GBP" } }, "maker")).toBe("Cost about £3.40");
    expect(sessionFactsLine({ extras: { cost: 3.4, currency: "GBP", tokens: 1_200_000 } }, "maker")).toBe("Cost about £3.40 and 1.2 million tokens");
    expect(sessionFactsLine({ extras: { tokens: 52_000 } }, "maker")).toBe("52,000 tokens");
    expect(sessionFactsLine({ extras: { cost: 0.5, currency: "USD" } }, "maker")).toBe("Cost about $0.50");
  });
  it("hides the cost from readers unless Show readers is on", () => {
    const extras = { cost: 3.4, currency: "GBP" as const, tokens: 1_200_000, cached: 900_000, background: true };
    expect(sessionFactsLine({ extras }, "reader")).toBe("Ran in the background");
    expect(sessionFactsLine({ extras: { ...extras, showCost: true } }, "reader")).toBe(
      "Cost about £3.40 and 1.2 million tokens · Later runs cost less, because the start is reused. · Ran in the background",
    );
  });
  it("joins the parts that exist with a dot", () => {
    expect(sessionFactsLine({ words: 120_000, extras: { cost: 1, currency: "GBP", background: true } }, "maker")).toBe(
      `${FACTS_COPY.long(120_000)} · Cost about £1.00 · Ran in the background`,
    );
  });
});

describe("the result file", () => {
  const result = { type: "result", subtype: "success", total_cost_usd: 0.4237, usage: { input_tokens: 10, output_tokens: 90, cache_creation_input_tokens: 400, cache_read_input_tokens: 5000 } };
  it("reads cost and tokens, and cached only when the file has it", () => {
    expect(readResultFile(JSON.stringify(result))).toEqual({ cost: 0.42, tokens: 5500, cached: 5000 });
    const none = { ...result, usage: { input_tokens: 10, output_tokens: 90 } };
    expect(readResultFile(JSON.stringify(none))).toEqual({ cost: 0.42, tokens: 100 });
    expect(extrasOf({ ...readResultFile(JSON.stringify(none)) }).cached).toBeUndefined();
  });
  it("finds the result in an array and in JSON lines", () => {
    expect(readResultFile(JSON.stringify([{ type: "system" }, result]))?.cost).toBe(0.42);
    expect(readResultFile(`${JSON.stringify({ type: "assistant" })}\n${JSON.stringify(result)}\n`)?.tokens).toBe(5500);
  });
  it("is null for anything else", () => {
    expect(readResultFile("{}")).toBeNull();
    expect(readResultFile('{"type":"result"}')).toBeNull();
    expect(readResultFile("not json")).toBeNull();
    expect(readResultFile(JSON.stringify({ name: "package", version: "1" }))).toBeNull();
  });
});

describe("storing", () => {
  it("reads defensively", () => {
    expect(extrasOf({ cost: -1, tokens: 1.5, startedWith: "  ", parallelWith: ["a", "a", 3], ownCopy: " fix " })).toEqual({ parallelWith: ["a"], ownCopy: "fix" });
    expect(extrasOf(null)).toEqual({});
    expect(extrasOf({ cost: 2, showCost: true, background: true })).toEqual({ cost: 2, currency: "GBP", showCost: true, background: true });
  });
  it("replaces only its own keys", () => {
    expect(withExtras({ tool: "x", date: "2026-10-01", cost: 1, goal: { condition: "g" } }, { background: true })).toEqual({ tool: "x", date: "2026-10-01", goal: { condition: "g" }, background: true });
  });
  it("refuses what cannot be kept", () => {
    expect(extrasRefusal({ cost: -3 })).toMatch(/number/);
    expect(extrasRefusal({ ownCopy: "x".repeat(81) })).toMatch(/80/);
    expect(extrasRefusal({ cost: 3 })).toBeNull();
  });
});

describe("in builds.making.sessions_meta", () => {
  it("is kept beside the goal when the entry is read", () => {
    const meta = sessionsMetaOf({ sessions_meta: { "typed-a": { tool: "claude-code", date: "2026-10-12", goal: { condition: "x" }, cost: 3.4, tokens: 12, background: true, junk: 1 } } });
    expect(meta["typed-a"]).toMatchObject({ cost: 3.4, currency: "GBP", tokens: 12, background: true, goal: { condition: "x" } });
    expect(meta["typed-a"]).not.toHaveProperty("junk");
  });
});
