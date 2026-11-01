// SV-29 P7: Techniques worked out from the pipeline and evaluation fields.

import { describe, expect, it } from "vitest";

import { productCategoriesTree } from "@/dev/fixtures/pipeline/product-categories";
import { supportBotEvalsTree } from "@/dev/fixtures/pipeline/support-bot-evals";
import { buildSteps } from "@/lib/build/graph";
import type { NodeTree } from "@/lib/build/types";

import { deriveClassification } from "./derive";
import { TECHNIQUE_VALUES } from "./taxonomy";

let counter = 0;
const node = (type: string, payload: Record<string, unknown> = {}): NodeTree => {
  counter += 1;
  return { id: `s${counter}`, build_id: "b1", type, title: null, payload, position: counter, parent_id: null, source_ref: null, is_gap: false, created_at: "2026-10-30T00:00:00Z", children: [] } as unknown as NodeTree;
};
const decision = (extra: Record<string, unknown> = {}, types: string[] = ["choice"]) => node("decision", { provider: "x", model: "y", questions: types.map((type, i) => ({ id: `q${i}`, type, instructions: "?", ...(type === "choice" ? { options: [{ key: "a" }, { key: "b" }] } : null) })), ...extra });
const techniques = (tree: NodeTree[]): string[] => deriveClassification(buildSteps(tree), { tree }).derived.technique?.values ?? [];

describe("the Zero-shot and Reranking values", () => {
  it("are in the taxonomy, with their alternative words", () => {
    const labels = TECHNIQUE_VALUES.map((value) => value.label);
    expect(labels).toEqual(expect.arrayContaining(["Zero-shot", "Reranking"]));
    expect(TECHNIQUE_VALUES.find((value) => value.label === "Reranking")?.synonyms).toEqual(expect.arrayContaining(["rerank"]));
  });
});

describe("each row of the table", () => {
  it("a Retrieval tile is Embeddings", () => {
    expect(techniques([node("retrieval_config", { step: true, k: 5 })])).toContain("embeddings");
  });
  it("a Decision with candidates_from is Reranking", () => {
    expect(techniques([decision({ candidates_from: { step: "r", k: 30 } })])).toContain("reranking");
    expect(techniques([decision()])).not.toContain("reranking");
  });
  it("a Decision with a choice or multi question is Classification", () => {
    expect(techniques([decision()])).toContain("classification");
    expect(techniques([decision({}, ["multi"])])).toContain("classification");
    expect(techniques([decision({}, ["yesno"])])).not.toContain("classification");
  });
  it("a Decision with an extract question is Extraction", () => {
    expect(techniques([decision({}, ["extract"])])).toContain("extraction");
  });
  it("a Decision is Structured output", () => {
    expect(techniques([decision({}, ["yesno"])])).toContain("structured-output");
  });
  it("adaptation zero_shot is Zero-shot, few_shot Few-shot examples and fine_tuned Fine-tuning", () => {
    expect(techniques([decision({ adaptation: { kind: "zero_shot" }, examples: [{ input: "a", output: "b" }] })])).toEqual(expect.arrayContaining(["zero-shot"]));
    expect(techniques([decision({ adaptation: { kind: "zero_shot" }, examples: [{ input: "a", output: "b" }] })])).not.toContain("few-shot-examples");
    expect(techniques([decision({ adaptation: { kind: "few_shot", examples_in_prompt: true }, examples: [{ input: "a", output: "b" }] })])).toContain("few-shot-examples");
    expect(techniques([decision({ adaptation: { kind: "fine_tuned", base_model: "gemma" } })])).toContain("fine-tuning");
  });
  it("a Check with rows, graders or a CI gate is Evaluations", () => {
    expect(techniques([node("eval_run", { tested: "x", passing: "y", scoring: { how: "ab" }, rows: [{ kind: "approach", label: "A" }, { kind: "approach", label: "B" }] })])).toContain("evaluations");
    expect(techniques([node("eval_run", { tested: "x", passing: "y", graders: [{ name: "g", kind: "built_in", sees: [], covers: [] }] })])).toContain("evaluations");
    expect(techniques([node("eval_run", { tested: "x", passing: "y", gate: { runs_in: "ci", on: "merge", rule: { kind: "any_regression" }, runs: 1 } })])).toContain("evaluations");
  });
});

describe("Retrieval (RAG)", () => {
  it("is absent for the product categories fixture, whose candidates feed a Decision", () => {
    const got = techniques(productCategoriesTree);
    expect(got).toEqual(expect.arrayContaining(["embeddings", "reranking", "classification", "structured-output", "zero-shot", "evaluations"]));
    expect(got).not.toContain("retrieval-rag");
  });
  it("is derived when what a Retrieval tile finds feeds an agent that writes text", () => {
    expect(techniques(supportBotEvalsTree)).toContain("retrieval-rag");
  });
});
