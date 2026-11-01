// SV-29 P2: the Retrieval tile.

import { describe, expect, it } from "vitest";

import { buildSteps } from "./graph";
import { runTilesOf } from "./costView";
import { methodOf } from "./forkRules";
import { corpusText, recallOf, recallSource, retrievalLine, retrievalOf, retrievalPayload, retrievalRefusal } from "./retrieval";
import { cleanExtras } from "./tileExtras";

const node = (id: string, position: number, type: string, payload: Record<string, unknown>, parent: string | null = null) => ({ id, build_id: "b", parent_id: parent, position, type, title: null, note: null, payload, source_ref: null, is_gap: false, event_id: null, created_at: "" });

const retrieval = { step: true, embedding_model: "text-embedding-3-small", corpus: "categories", corpus_size: 6000, k: 30, recall: [{ k: 1, value: 0.38, source: "run" }, { k: 30, value: 0.992, source: "run" }] };

describe("the Retrieval tile", () => {
  it("shows as one line", () => {
    expect(retrievalLine(retrievalOf(retrieval))).toBe("Retrieval · text-embedding-3-small · 6,000 categories · top 30 · Recall@1 38%, Recall@30 99.2%");
  });

  it("is numbered in List order, as Code and Decision are", () => {
    const steps = buildSteps([
      node("p", 0, "prompt", { text: "Extract fields" }),
      node("c", 1, "code", { source: "x = 1", language: "python" }),
      node("r", 2, "retrieval_config", retrieval),
      node("d", 3, "decision", { provider: "gemma", model: "g", questions: [{ id: "category", type: "choice", instructions: "", options: [{ key: "a" }, { key: "b" }] }] }),
    ] as never[]);
    expect(steps.map((step) => `${step.number}:${step.kind}`)).toEqual(["1:prompt", "2:code", "3:retrieval", "4:decision"]);
    expect(steps[2].retrieval?.k).toBe(30);
  });

  it("is not a step when it is a configuration saved before (no step mark), or nested in a dataset", () => {
    const steps = buildSteps([node("ds", 0, "dataset", { step: true, description: "d" }), node("old", 1, "retrieval_config", { top_k: 5 }, "ds"), node("old2", 2, "retrieval_config", { top_k: 5 })] as never[]);
    expect(steps.map((step) => step.kind)).toEqual(["dataset"]);
  });

  it("is a runtime tile in the cost view", () => {
    const steps = buildSteps([node("r", 0, "retrieval_config", { ...retrieval, run_cost: { per: "call", cost: 0.0001, currency: "USD", source: "maker" } })] as never[]);
    expect(runTilesOf(steps).map((tile) => tile.id)).toEqual(["r"]);
    expect(runTilesOf(steps)[0].run?.cost).toBe(0.0001);
  });
});

describe("Recall@k", () => {
  it("accepts several k values, each once, ordered by k", () => {
    const out = recallOf([{ k: 30, value: 0.9, source: "run" }, { k: 1, value: 0.3, source: "maker" }, { k: 5, value: 0.6, source: "run" }, { k: 5, value: 0.7, source: "run" }]);
    expect(out.map((point) => point.k)).toEqual([1, 5, 30]);
  });
  it("holds up to six and refuses a share out of 0 to 1", () => {
    expect(retrievalRefusal({ recall: [1, 2, 3, 4, 5, 6, 7].map((k) => ({ k, value: 0.5, source: "run" as const })) })).toMatch(/6 max/);
    expect(retrievalRefusal({ recall: [{ k: 3, value: 1.5, source: "run" }] })).toMatch(/0 to 1/);
    expect(() => cleanExtras("retrieval_config", { k: 1001 })).toThrow();
    expect(() => cleanExtras("retrieval_config", { recall: [{ k: 3, value: 2, source: "run" }] })).toThrow();
  });
  it("says where the figures came from", () => {
    expect(recallSource(retrievalOf(retrieval).recall)).toBe("From the run");
  });
});

describe("saving", () => {
  it("writes step: true and only the keys given", () => {
    expect(retrievalPayload({ corpus: "faq", k: 5 })).toEqual({ step: true, corpus: "faq", k: 5 });
    expect(corpusText({ corpus: "faq" })).toBe("faq");
  });
  it("each key saves through the extras writer", () => {
    expect(cleanExtras("retrieval_config", { index: "pgvector", hybrid: true, query: "title", corpus_size: 10 })).toEqual({ index: "pgvector", hybrid: true, query: "title", corpus_size: 10 });
  });
});

describe("a fork", () => {
  it("keeps the method and labels the recall as the original's", () => {
    const kept = methodOf(retrieval) as typeof retrieval;
    expect(kept.embedding_model).toBe("text-embedding-3-small");
    expect(kept.recall.every((point) => point.source === ("original" as string))).toBe(true);
    expect(recallSource(retrievalOf(kept).recall)).toBe("The original measured");
  });
});

describe("the accuracy ceiling through the steps", () => {
  const decision = (k: number, payload: Record<string, unknown> = retrieval) => [
    node("r", 0, "retrieval_config", payload),
    node("d", 1, "decision", { provider: "gemma", model: "g", candidates_from: { step: "r", k }, questions: [{ id: "category", type: "choice", instructions: "" }] }),
  ] as never[];
  it("is worked out from the retrieval tile's recall at the same k", () => {
    const [, d] = buildSteps(decision(30));
    expect(d.decision?.derived?.candidatesNumber).toBe("1");
    expect(d.decision?.derived?.ceiling?.line).toBe("Accuracy ceiling: 99% (Recall@30 of Step 1)");
  });
  it("is absent when k differs", () => {
    expect(buildSteps(decision(20))[1].decision?.derived?.ceiling).toBeUndefined();
  });
  it("on a copy reads as the original's", () => {
    expect(buildSteps(decision(30, methodOf(retrieval)))[1].decision?.derived?.ceiling?.source).toBe("original");
  });
});
