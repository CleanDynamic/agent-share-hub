// SV-30 P8: verification artefacts and review scope.

import { describe, expect, it } from "vitest";

import { rowEvidenceOf, rowsOf, rowsPayload, rowsRefusal } from "./comparison";
import { evidenceText, measurementLine } from "./evidenceKinds";
import { methodOf } from "./forkRules";
import { copiedFacts, extrasOf, extrasRefusal, sessionFactsLine } from "./sessionFacts";
import { reviewLine, reviewOf, reviewRefusal } from "./sessionReview";
import { checkExtrasOf, cleanExtras } from "./tileExtras";

const measured = { metric: "Latency", unit: "ms", before: 120, after: 58, runs: 20 };

describe("SV-30 P8: evidence kinds", () => {
  it("saves each kind and shows it", () => {
    expect(cleanExtras("eval_run", { evidence: { kind: "recording", url: "example.com/walkthrough" } })).toEqual({ evidence: { kind: "recording", url: "https://example.com/walkthrough" } });
    expect(cleanExtras("eval_run", { evidence: { kind: "video", media_id: "m1", name: "demo.mp4" } })).toEqual({ evidence: { kind: "video", media_id: "m1", name: "demo.mp4" } });
    expect(cleanExtras("eval_run", { evidence: { kind: "test_output", text: "42 passed" } })).toEqual({ evidence: { kind: "test_output", text: "42 passed" } });
    expect(cleanExtras("eval_run", { evidence: { kind: "link", url: "https://example.com/r" } })).toEqual({ evidence: { kind: "link", url: "https://example.com/r" } });
    const stored = cleanExtras("eval_run", { evidence: { kind: "measurement", measurement: measured } });
    expect(stored).toEqual({ evidence: { kind: "measurement", measurement: measured } });
    const read = checkExtrasOf(stored);
    expect(evidenceText(read.evidence)).toBe("Latency · Before 120 ms · after 58 ms · 20 runs");
    expect(measurementLine(measured)).toBe("Before 120 ms · after 58 ms · 20 runs");
    expect(evidenceText(checkExtrasOf({ evidence: { kind: "video", media_id: "m1", name: "demo.mp4" } }).evidence)).toBe("Demo video · demo.mp4");
    expect(evidenceText(checkExtrasOf({ evidence: { kind: "test_output", text: "42 passed" } }).evidence)).toBe("Test run output · Pasted output");
  });
  it("reads evidence from before kinds as it was", () => {
    expect(evidenceText(checkExtrasOf({ evidence: { url: "https://example.com/results" } }).evidence)).toBe("https://example.com/results");
    expect(evidenceText(checkExtrasOf({ evidence: { media_id: "m", name: "log.txt" } }).evidence)).toBe("log.txt");
  });
  it("says a Check with no evidence is Stated, no artefact", () => {
    expect(evidenceText(checkExtrasOf({ tested: "x" }).evidence)).toBe("Stated, no artefact");
    expect(evidenceText(null)).toBe("Stated, no artefact");
  });
  it("refuses a measurement that is not whole and a kind that is not one", () => {
    expect(() => cleanExtras("eval_run", { evidence: { kind: "measurement", measurement: { ...measured, runs: 0 } } })).toThrow("Runs is a whole number from 1.");
    expect(() => cleanExtras("eval_run", { evidence: { kind: "measurement", measurement: { ...measured, metric: "" } } })).toThrow("Say what was measured.");
    expect(() => cleanExtras("eval_run", { evidence: { kind: "photo", url: "https://example.com" } })).toThrow("Evidence is a recording");
  });
  it("labels a fork's evidence as the original's", () => {
    expect(methodOf({ evidence: { kind: "measurement", measurement: measured } })).toMatchObject({ from_original: true });
    expect(methodOf({ tested: "x" })).not.toHaveProperty("from_original");
  });
  it("gives a comparison row the same kinds for its source, https only", () => {
    expect(rowEvidenceOf({ kind: "measurement", url: "https://example.com/run" })).toEqual({ kind: "measurement", url: "https://example.com/run" });
    expect(rowEvidenceOf({ kind: "measurement", url: "http://example.com/run" })).toBeNull();
    const rows = rowsOf([
      { kind: "approach", label: "A", tiles: [], evidence: { kind: "test_output", url: "https://example.com/a" } },
      { kind: "approach", label: "B", tiles: [] },
    ]);
    expect(rows[0].evidence).toEqual({ kind: "test_output", url: "https://example.com/a" });
    expect(rowsRefusal(rows)).toBeNull();
    expect(JSON.parse(JSON.stringify(rowsPayload(rows)))[0].evidence.kind).toBe("test_output");
  });
});

describe("SV-30 P8: review scope", () => {
  it("saves each scope, with up to 10 files for the high-blast-radius one", () => {
    expect(reviewOf({ scope: "none" })).toEqual({ scope: "none" });
    expect(reviewOf({ scope: "all", files: ["a.ts"] })).toEqual({ scope: "all" });
    const files = Array.from({ length: 12 }, (_, i) => `src/f${i}.ts`);
    expect(reviewOf({ scope: "high_blast_radius", files })?.files).toHaveLength(10);
    expect(reviewRefusal({ scope: "high_blast_radius", files })).toBe("Files: 10 max");
    expect(reviewOf({ scope: "some" })).toBeNull();
    expect(extrasOf({ review: { scope: "high_blast_radius", files: ["db/migrate.sql"] } }).review).toEqual({ scope: "high_blast_radius", files: ["db/migrate.sql"] });
    expect(extrasRefusal({ review: { scope: "high_blast_radius", files } })).toBe("Files: 10 max");
  });
  it("says it as a fact, never a judgement", () => {
    expect(reviewLine({ scope: "none" })).toBe("Human review: none");
    expect(reviewLine({ scope: "all" })).toBe("Human review: all changes");
    expect(reviewLine({ scope: "high_blast_radius", files: ["db/migrate.sql", "src/core.ts"] })).toBe("Human review: high-blast-radius files only (db/migrate.sql, src/core.ts)");
    expect(sessionFactsLine({ extras: { review: { scope: "none" } } }, "reader")).toBe("Human review: none");
  });
  it("is the original's evidence on a copy, labelled", () => {
    const copy = copiedFacts({ review: { scope: "all" }, effort: "high" });
    expect(copy).toEqual({ effort: "high", review: { scope: "all" }, from_original: true });
    expect(sessionFactsLine({ extras: copy }, "reader")).toContain("The original's: Human review: all changes");
  });
});
