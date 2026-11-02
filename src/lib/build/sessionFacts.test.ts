// CA-05 P2 — session facts: length, cost, later runs and nobody watching.

import { describe, expect, it } from "vitest";

import { sessionsMetaOf } from "./making";
import { methodOf } from "./forkRules";
import { proposedAccess } from "./sessionAccess";
import { copiedFacts, figureOf, sessionDetailLines } from "./sessionFacts";
import { modelWithId, togetherChanges, togetherLine, extrasOf, extrasRefusal, FACTS_COPY, readResultFile, sessionFactsLine, withExtras } from "./sessionFacts";

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

describe("sessions at the same time", () => {
  const numbers: Record<string, number> = { a: 1, b: 2, c: 3 };
  const numberOf = (key: string) => numbers[key];
  it("says the line from the parts that exist", () => {
    expect(togetherLine(undefined, numberOf)).toBeNull();
    expect(togetherLine({ parallelWith: ["c"], ownCopy: "fix-totals" }, numberOf)).toBe("At the same time as Session 3 · own copy: fix-totals");
    expect(togetherLine({ parallelWith: ["c", "b"] }, numberOf)).toBe("At the same time as Session 2 and Session 3");
    expect(togetherLine({ ownCopy: "fix-totals" }, numberOf)).toBe("Own copy: fix-totals");
    expect(togetherLine({ parallelWith: ["gone"] }, numberOf)).toBeNull();
  });
  it("marks a pair both ways, and changes only the lists that change", () => {
    expect(togetherChanges({}, "b", ["c"])).toEqual({ b: ["c"], c: ["b"] });
    expect(togetherChanges({ b: ["c"], c: ["b"] }, "b", ["c"])).toEqual({});
    expect(togetherChanges({ b: ["c"], c: ["b", "a"], a: ["c"] }, "b", [])).toEqual({ b: [], c: ["a"] });
    expect(togetherChanges({ b: ["b", "c"] }, "b", ["b", "c"])).toEqual({ b: ["c"], c: ["b"] });
  });
});

describe("SV-30 P1: model ID and reasoning effort", () => {
  it("keeps both through the one read and write path, and the display name is unchanged", () => {
    const meta = sessionsMetaOf({ sessions_meta: { "typed-1": { tool: "claude-code", date: "2026-10-20", model: "Claude Opus 4.5", model_id: " claude-opus-4-5-20251101 ", effort: "high" } } })["typed-1"];
    expect(meta.model).toBe("Claude Opus 4.5");
    expect(meta.model_id).toBe("claude-opus-4-5-20251101");
    expect(meta.effort).toBe("high");
    expect(withExtras({ tool: null, date: "" }, { model_id: "m-1", effort: "low" })).toMatchObject({ model_id: "m-1", effort: "low" });
  });
  it("says the ID beside the name, and the effort, on the line", () => {
    expect(modelWithId("Claude Opus 4.5", "claude-opus-4-5-20251101")).toBe("Claude Opus 4.5 (claude-opus-4-5-20251101)");
    expect(modelWithId(null, "claude-opus-4-5-20251101")).toBe("claude-opus-4-5-20251101");
    expect(sessionFactsLine({ model: "Claude Opus 4.5", extras: { model_id: "claude-opus-4-5-20251101", effort: "high" } }, "reader")).toBe("Claude Opus 4.5 (claude-opus-4-5-20251101) · Reasoning effort: high");
  });
  it("refuses an ID over 80 characters and an effort that is not one, and reads them out of range as absent", () => {
    expect(extrasRefusal({ model_id: "x".repeat(81) })).toBe("Model ID: 80 characters max");
    expect(extrasRefusal({ effort: "max" as never })).toContain("Reasoning effort");
    expect(extrasOf({ effort: "max", model_id: 4 })).toEqual({});
  });
});

describe("SV-30 P4: environment, isolation and access", () => {
  const facts = { environment: "cloud_sandbox", isolation: "worktree", can_install: true, access: [{ system: "code", scope: "write" }, { system: "tests", scope: "write" }, { system: "prod_logs", scope: "read" }, { system: "deploy", scope: "write" }, { system: "feature_flags", scope: "write" }] };
  it("saves each key through the one path, and says them as facts", () => {
    expect(extrasOf({ ...facts })).toEqual(facts);
    expect(sessionFactsLine({ extras: facts as never }, "reader")).toBe("Cloud sandbox · Isolation: git worktree · Could install packages");
    expect(sessionDetailLines({ extras: facts as never }, "reader")).toEqual(["Access: code (write) · tests (write) · production logs (read) · deploy (write) · feature flags (write)"]);
    expect(sessionsMetaOf({ sessions_meta: { "typed-1": { tool: null, date: "2026-10-20", ...facts } } })["typed-1"]).toMatchObject(facts);
  });
  it("reads nothing it does not know and keeps a system once", () => {
    expect(extrasOf({ environment: "laptop", isolation: "jail", can_install: "yes", access: [{ system: "code", scope: "admin" }, { system: "fax", scope: "read" }] })).toEqual({});
    expect(extrasOf({ access: [{ system: "code", scope: "read" }, { system: "code", scope: "write" }] }).access).toEqual([{ system: "code", scope: "write" }]);
  });
  it("proposes systems from the tools a session set up, and sets none itself", () => {
    expect(proposedAccess(["GitHub", "Supabase", "Slack", "Linear"])).toEqual(["code", "issues", "database"]);
    expect(extrasOf({})).toEqual({});
  });
  it("is kept on a fork, as method: the keys are not evidence", () => {
    expect(Object.keys(methodOf({ environment: "local", isolation: "none", access: [] }))).toEqual(["environment", "isolation", "access"]);
  });
});

describe("SV-30: what a copy of a session keeps", () => {
  it("keeps how it was run and leaves the run's own figures with the original", () => {
    const run = { model_id: "m-1", effort: "high", environment: "cloud_sandbox", isolation: "worktree", can_install: true, access: [{ system: "code", scope: "write" }], cost: 3.4, currency: "GBP", tokens: 5000, background: true, ms: 60000 };
    expect(copiedFacts(run)).toEqual({ model_id: "m-1", effort: "high", environment: "cloud_sandbox", isolation: "worktree", can_install: true, access: [{ system: "code", scope: "write" }] });
    expect(copiedFacts(undefined)).toEqual({});
    // What it produced is the original's evidence: kept, labelled, and not shown to readers until the copier ticks Show readers.
    const outputs = [{ kind: "pull_request", url: "https://github.com/acme/app/pull/9" }];
    expect(copiedFacts({ outputs, showOutputs: true, environment: "local" })).toEqual({ environment: "local", outputs, from_original: true });
    expect(sessionDetailLines({ extras: { ...copiedFacts({ outputs }), showOutputs: true } as never }, "reader")).toEqual(["Produced, the original's: 1 pull request"]);
  });
});

describe("SV-30 P6: how the session was driven", () => {
  it("saves messages and compactions, and says them beside the other figures", () => {
    expect(extrasOf({ messages: 3714, compactions: 2 })).toEqual({ messages: 3714, compactions: 2 });
    expect(sessionFactsLine({ extras: { messages: 3714, compactions: 2, tokens: 52_000, showCost: true, background: true } }, "reader")).toBe("52,000 tokens · Ran in the background");
    expect(sessionDetailLines({ extras: { messages: 3714, compactions: 2 } }, "reader")).toEqual(["Length: 3,714 messages · 2 compactions"]);
    expect(sessionDetailLines({ extras: { compactions: 1 } }, "maker")).toEqual(["Length: 1 compaction"]);
  });
  it("uses what the run showed when the maker gave no figure, and the maker's own figure over it", () => {
    expect(sessionDetailLines({ run: { messages: 90, compactions: 2 } }, "reader")).toEqual(["Length: 90 messages · 2 compactions"]);
    expect(sessionDetailLines({ extras: { messages: 12 }, run: { messages: 90 } }, "reader")).toEqual(["Length: 12 messages"]);
    expect(figureOf(undefined, 2)).toEqual({ value: 2, from: "run" });
    expect(figureOf(5, 2)).toEqual({ value: 5, from: "maker" });
    expect(figureOf(undefined, 0)).toBeNull();
  });
  it("refuses a count that is not a whole number", () => {
    expect(extrasRefusal({ messages: 1.5 })).toBe("Messages is a whole number.");
    expect(extrasRefusal({ compactions: -1 })).toBe("Compactions is a whole number.");
  });
});
