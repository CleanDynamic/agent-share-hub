// SV-29 P1: the Decision tile's pipeline fields.

import { describe, expect, it } from "vitest";

import { decisionOf } from "./decision";
import { draftToInput, emptyDraft, decisionMissing } from "./decisionDraft";
import { rewritePayload } from "./fork";
import { methodOf } from "./forkRules";
import { accuracyCeiling, candidatesLine, labelSetLine, pipelinePatchRefusal, selectionLabel } from "./pipelineFields";
import { cleanExtras } from "./tileExtras";

const choice = { id: "category", type: "choice", instructions: "Pick the category" };
const base = { provider: "gemma", model: "gemma-3", questions: [{ ...choice, options: [{ key: "a" }, { key: "b" }] }] };

describe("the six pipeline keys", () => {
  it("each saves and reads back", () => {
    const patch = {
      label_set: { size: 6000, structure: "hierarchical", name: "Shopify product taxonomy", version: "Sept 2026" },
      candidates_from: { step: "node-4", k: 30 },
      selection: { method: "beam_search", beam_width: 5 },
      adaptation: { kind: "fine_tuned", base_model: "gemma-3-4b" },
      known_limits: ["Sequential narrowing over large label sets degrades accuracy"],
    };
    const cleaned = cleanExtras("decision", patch);
    const facts = decisionOf({ ...base, ...cleaned });
    expect(facts?.labelSet).toEqual({ size: 6000, structure: "hierarchical", name: "Shopify product taxonomy", version: "Sept 2026" });
    expect(labelSetLine(facts!.labelSet!)).toBe("Label set: Shopify product taxonomy, Sept 2026 · 6,000 labels · hierarchical");
    expect(candidatesLine(facts!.candidatesFrom!, "4")).toBe("Candidates: top 30 from Step 4");
    expect(selectionLabel(facts!.selection!)).toBe("Walks the tree (beam search, width 5)");
    expect(facts?.adaptation).toEqual({ kind: "fine_tuned", baseModel: "gemma-3-4b" });
    expect(facts?.knownLimits).toEqual(["Sequential narrowing over large label sets degrades accuracy"]);
  });

  it("reads a decision saved before as it was", () => {
    const facts = decisionOf(base);
    expect(facts?.labelSet).toBeUndefined();
    expect(facts?.candidatesFrom).toBeUndefined();
    expect(facts?.adaptation).toBeUndefined();
  });

  it("refuses values out of range", () => {
    expect(() => cleanExtras("decision", { candidates_from: { step: "x", k: 1 } })).toThrow();
    expect(() => cleanExtras("decision", { candidates_from: { step: "x", k: 1001 } })).toThrow();
    expect(() => cleanExtras("decision", { selection: { method: "beam_search", beam_width: 51 } })).toThrow();
    expect(() => cleanExtras("decision", { known_limits: ["a", "b", "c", "d", "e", "f"] })).toThrow();
    expect(() => cleanExtras("decision", { known_limits: ["x".repeat(121)] })).toThrow();
    expect(() => cleanExtras("decision", { adaptation: { kind: "fine_tuned" } })).toThrow();
  });

  it("null takes a key off", () => {
    expect(cleanExtras("decision", { label_set: null, adaptation: null })).toEqual({ label_set: null, adaptation: null });
  });
});

describe("candidates", () => {
  it("do not need fixed options, and the form accepts none", () => {
    const draft = emptyDraft();
    draft.provider = "gemma";
    draft.questions = [{ ...draft.questions[0], id: "category", options: [{ key: "", line: "" }, { key: "", line: "" }] }];
    expect(decisionMissing(draft)).toBe("Options");
    draft.pipeline = { ...draft.pipeline, candidatesStep: "node-4", candidatesK: "30" };
    expect(decisionMissing(draft)).toBeNull();
    const made = draftToInput(draft);
    expect("input" in made && made.input.candidatesFrom).toEqual({ step: "node-4", k: 30 });
  });

  it("are refused for a decision with no choice, multiple choice or ranking question", () => {
    const why = pipelinePatchRefusal({ questions: [{ id: "ok", type: "yesno", instructions: "" }] }, { candidates_from: { step: "x", k: 30 } });
    expect(why).toMatch(/single choice/);
    expect(pipelinePatchRefusal({ questions: [choice] }, { candidates_from: { step: "x", k: 30 } })).toBeNull();
  });
});

describe("adaptation", () => {
  it("few-shot without examples is refused, with examples it sets examples_in_prompt", () => {
    expect(pipelinePatchRefusal({ questions: [choice] }, { adaptation: { kind: "few_shot" } })).toMatch(/needs examples/);
    expect(pipelinePatchRefusal({ questions: [choice], examples: [{ input: "a", output: "b" }] }, { adaptation: { kind: "few_shot" } })).toBeNull();
    expect(cleanExtras("decision", { adaptation: "few_shot" }).adaptation).toEqual({ kind: "few_shot", examples_in_prompt: true });
  });

  it("is never inferred from examples", () => {
    expect(decisionOf({ ...base, examples: [{ input: "a", output: "b" }] })?.adaptation).toBeUndefined();
  });

  it("few-shot in the form without examples is refused", () => {
    const draft = emptyDraft();
    draft.provider = "gemma";
    draft.questions = [{ ...draft.questions[0], id: "q", options: [{ key: "a", line: "" }, { key: "b", line: "" }] }];
    draft.pipeline = { ...draft.pipeline, adaptation: "few_shot" };
    expect(draftToInput(draft)).toEqual({ error: "Few-shot needs examples: add them under Examples." });
  });
});

describe("the accuracy ceiling", () => {
  const retrieval = { number: "4", recall: [{ k: 1, value: 0.38, source: "run" as const }, { k: 30, value: 0.992, source: "run" as const }] };
  it("shows with a matching k", () => {
    expect(accuracyCeiling({ step: "r", k: 30 }, retrieval)?.line).toBe("Accuracy ceiling: 99% (Recall@30 of Step 4)");
  });
  it("is not shown when k differs or no recall is measured", () => {
    expect(accuracyCeiling({ step: "r", k: 20 }, retrieval)).toBeNull();
    expect(accuracyCeiling({ step: "r", k: 30 }, { number: "4", recall: [] })).toBeNull();
    expect(accuracyCeiling({ step: "r", k: 30 }, undefined)).toBeNull();
  });
});

describe("a fork", () => {
  it("keeps all six as method and rewrites the candidates' step", () => {
    const payload = { ...base, label_set: { size: 10, structure: "flat" }, candidates_from: { step: "old-retrieval", k: 30 }, selection: { method: "single_call" }, adaptation: { kind: "zero_shot" }, known_limits: ["x"] };
    const kept = methodOf(payload);
    expect(kept.label_set).toEqual(payload.label_set);
    expect(kept.known_limits).toEqual(["x"]);
    const out = rewritePayload(kept as never, undefined, new Map([["old-retrieval", "new-retrieval"]])) as Record<string, unknown>;
    expect(out.candidates_from).toEqual({ step: "new-retrieval", k: 30 });
    expect(out.adaptation).toEqual({ kind: "zero_shot" });
  });
});
