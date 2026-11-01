// SV-29 P9: a runtime pipeline that picks a product's category from a taxonomy of 6,000. Sample content only: every name and figure
// here is invented for this prompt.
//
// A Code tile that extracts product fields; a Retrieval tile over the categories (top 30, Recall@1 0.38, Recall@30 0.992); a Decision
// that chooses one category from those 30 (single call, zero-shot); a comparison Check of four ways to do it on 1,000 labelled items;
// a volume of 10,000,000 products a day at batch pricing.

import type { NodeTree } from "@/lib/build/types";

import { fixtureNode as node } from "../deployment/node";

const S = "fx-pipeline-s1";

const row = (kind: string, label: string, tiles: string[], value: number, cost: number, outcome: string, reason?: string) => ({
  kind,
  label,
  tiles,
  value: { value, source: "run" },
  cost_per_item: { cost, currency: "USD", source: "maker" },
  outcome,
  ...(reason ? { reason } : null),
});

export const productCategoriesTree: NodeTree[] = [
  node("pc-c1", 0, "code", { session: S, language: "python", filename: "extract_fields.py", source: "def extract(product):\n    return {\"title\": product[\"title\"], \"description\": product[\"description\"]}\n" }, "Extract product fields"),
  node("pc-r1", 1, "retrieval_config", {
    session: S,
    step: true,
    embedding_model: "text-embedding-3-small",
    index: "pgvector",
    corpus: "categories",
    corpus_size: 6000,
    query: "The product's title and description",
    k: 30,
    recall: [
      { k: 1, value: 0.38, source: "run" },
      { k: 30, value: 0.992, source: "run" },
    ],
    uses: [{ kind: "output", node_id: "pc-c1" }],
  }, "Search the categories"),
  node("pc-d1", 2, "decision", {
    session: S,
    provider: "typesafe-jev",
    model: "jev-1.13.0",
    called_from: ["pc-c1"],
    questions: [{ id: "category", type: "choice", instructions: "Which category fits this product best?" }],
    label_set: { size: 6000, structure: "hierarchical", name: "Shopify product taxonomy", version: "Sept 2026" },
    candidates_from: { step: "pc-r1", k: 30 },
    selection: { method: "single_call" },
    adaptation: { kind: "zero_shot" },
    known_limits: ["Sequential narrowing over large label sets degrades accuracy"],
    low_confidence: { threshold: 0.6 },
    run_cost: { per: "item", item_noun: "product", cost: 0.0005, currency: "USD", pricing: "batch", source: "maker" },
    volume: { count: 10_000_000, per: "day" },
    uses: [{ kind: "output", node_id: "pc-r1" }],
  }, "Pick the category"),
  node("pc-k1", 3, "eval_run", {
    session: S,
    tested: "Four ways to pick a product's category, on 1,000 labelled products",
    passing: "The best accuracy at a cost we can run 10,000,000 times a day",
    scoring: { how: "ab" },
    test_set: { size: 1000, labelled_by: "annotators", labelled_at: "2026-09" },
    metric: { id: "accuracy" },
    rows: [
      row("approach", "Retrieval, then Gemma picks", ["pc-r1"], 0.819, 0.0005, "rejected", "Lower accuracy than the decision model for the same cost"),
      row("approach", "Beam search", ["pc-d1"], 0.923, 0.0025, "rejected", "Correct root scored 0.03 against 0.44; the path was pruned at depth 0"),
      row("approach", "Retrieval, then the decision model picks", ["pc-r1", "pc-d1"], 0.972, 0.0005, "chosen"),
      row("approach", "Exhaustive", ["pc-d1"], 0.98, 1.08, "rejected", "Over 2,000 times the cost"),
    ],
    uses: [{ kind: "output", node_id: "pc-d1" }],
  }),
];

export const productCategoriesMaking = { session_order: [S], sessions_meta: { [S]: { tool: "claude-code", date: "2026-10-27" } } };
