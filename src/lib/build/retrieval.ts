// SV-29 P2: the Retrieval tile: a similarity search that finds candidates for a later step. It is the registry's `retrieval_config`
// node type, a numbered runtime step like Code and Decision. Every key is optional and lives in the node's own `payload`. PURE.

import type { Json } from "@/integrations/supabase/types";

import { clean, registerCleaners } from "./tileExtras";
import { SOURCE_WORD, type FigureSource, type RecallPoint } from "./pipelineFields";

export const RETRIEVAL_TYPE = "retrieval_config";

type Raw = Record<string, unknown>;
const isRecord = (value: unknown): value is Raw => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const EMBEDDING_MODEL_MAX = 80;
export const INDEX_MAX = 40;
export const CORPUS_MAX = 120;
export const QUERY_MAX = 120;
export const RETRIEVAL_K_MIN = 1;
export const RETRIEVAL_K_MAX = 1000;
export const RECALL_MAX = 6;
export const CORPUS_SIZE_MAX = 100_000_000_000;

export interface RetrievalFacts {
  embeddingModel?: string;
  index?: string;
  corpus?: string;
  corpusSize?: number;
  query?: string;
  k?: number;
  recall: RecallPoint[];
  hybrid?: boolean;
}

export const RETRIEVAL_COPY = {
  title: "Add retrieval",
  subtitle: "Finds candidates by similarity search",
  line: "Finds candidates by similarity search",
  embeddingModel: "Embedding model",
  index: "Vector index",
  corpus: "What's indexed",
  corpusSize: "Items indexed",
  query: "Query built from",
  k: "Results returned (top-k)",
  recall: "Recall@k",
  hybrid: "Also keyword search",
  kind: "Retrieval",
} as const;

const whole = (value: unknown, min: number, max: number): number | null => (typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null);

/** The recall figures, read defensively; one per k, ordered by k. `original` is a copy's label for what the original measured. */
export function recallOf(raw: unknown): RecallPoint[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: RecallPoint[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const k = whole(entry.k, RETRIEVAL_K_MIN, RETRIEVAL_K_MAX);
    const value = typeof entry.value === "number" && Number.isFinite(entry.value) && entry.value >= 0 && entry.value <= 1 ? entry.value : null;
    if (k === null || value === null || seen.has(k)) continue;
    seen.add(k);
    out.push({ k, value, source: entry.source === "run" ? "run" : entry.source === "original" ? "original" : "maker" });
  }
  return out.sort((a, b) => a.k - b.k).slice(0, RECALL_MAX);
}

/** A Retrieval tile's facts, read defensively; a payload with none of the keys reads as an empty tile. */
export function retrievalOf(payload: unknown): RetrievalFacts {
  const p = isRecord(payload) ? payload : {};
  const embeddingModel = clean(p.embedding_model, EMBEDDING_MODEL_MAX);
  const index = clean(p.index, INDEX_MAX);
  const corpus = clean(p.corpus, CORPUS_MAX);
  const query = clean(p.query, QUERY_MAX);
  const corpusSize = whole(p.corpus_size, 0, CORPUS_SIZE_MAX);
  const k = whole(p.k, RETRIEVAL_K_MIN, RETRIEVAL_K_MAX);
  return {
    ...(embeddingModel ? { embeddingModel } : null),
    ...(index ? { index } : null),
    ...(corpus ? { corpus } : null),
    ...(corpusSize !== null ? { corpusSize } : null),
    ...(query ? { query } : null),
    ...(k !== null ? { k } : null),
    recall: recallOf(p.recall),
    ...(p.hybrid === true ? { hybrid: true } : null),
  };
}

/** 0.38 is "38%", 0.992 is "99.2%". */
export const recallPercent = (value: number): string => `${Math.round(value * 1000) / 10}%`;

/** "Recall@1 38%, Recall@30 99.2%". */
export const recallText = (recall: readonly RecallPoint[]): string => recall.map((point) => `Recall@${point.k} ${recallPercent(point.value)}`).join(", ");

/** What the figures' source says, in the words the page uses: "From the run", "Maker's figure", or on a copy "The original measured". */
export function recallSource(recall: readonly RecallPoint[]): string | null {
  const sources = [...new Set(recall.map((point) => point.source))];
  return sources.length === 1 ? SOURCE_WORD[sources[0]] : sources.length > 1 ? sources.map((source) => SOURCE_WORD[source]).join(" and ") : null;
}

/** "6,000 categories": the size with what is indexed; either alone when only one is given. */
export function corpusText(facts: Pick<RetrievalFacts, "corpus" | "corpusSize">): string | null {
  if (facts.corpusSize !== undefined) return [facts.corpusSize.toLocaleString("en-GB"), facts.corpus ?? (facts.corpusSize === 1 ? "item" : "items")].join(" ");
  return facts.corpus ?? null;
}

/** "Retrieval · text-embedding-3-small · 6,000 categories · top 30 · Recall@1 38%, Recall@30 99.2%". */
export function retrievalLine(facts: RetrievalFacts): string {
  return [RETRIEVAL_COPY.kind, facts.embeddingModel, corpusText(facts), facts.k ? `top ${facts.k.toLocaleString("en-GB")}` : null, facts.recall.length > 0 ? recallText(facts.recall) : null].filter(Boolean).join(" · ");
}

/** The lines under the headline: the index, the query, and keyword search, each only when said. */
export function retrievalDetails(facts: RetrievalFacts): string[] {
  return [
    facts.index ? `${RETRIEVAL_COPY.index}: ${facts.index}` : null,
    facts.query ? `${RETRIEVAL_COPY.query}: ${facts.query}` : null,
    facts.hybrid ? RETRIEVAL_COPY.hybrid : null,
  ].filter((line): line is string => line !== null);
}

/** Whether a node of this type is a Retrieval tile (a step) rather than a configuration saved before: the tile says `step: true`. */
export const isRetrievalTile = (payload: unknown): boolean => isRecord(payload) && payload.step === true;

/** Why the tile cannot be saved, or null. Fixed words only. */
export function retrievalRefusal(input: { k?: number; corpusSize?: number; recall?: readonly RecallPoint[]; corpus?: string; embeddingModel?: string; index?: string; query?: string }): string | null {
  if (input.k !== undefined && whole(input.k, RETRIEVAL_K_MIN, RETRIEVAL_K_MAX) === null) return `Results returned: ${RETRIEVAL_K_MIN} to ${RETRIEVAL_K_MAX.toLocaleString("en-GB")}`;
  if (input.corpusSize !== undefined && whole(input.corpusSize, 0, CORPUS_SIZE_MAX) === null) return "Items indexed: a whole number";
  if ((input.embeddingModel ?? "").trim().length > EMBEDDING_MODEL_MAX) return `Embedding model: ${EMBEDDING_MODEL_MAX} characters max`;
  if ((input.index ?? "").trim().length > INDEX_MAX) return `Vector index: ${INDEX_MAX} characters max`;
  if ((input.corpus ?? "").trim().length > CORPUS_MAX) return `What's indexed: ${CORPUS_MAX} characters max`;
  if ((input.query ?? "").trim().length > QUERY_MAX) return `Query built from: ${QUERY_MAX} characters max`;
  if (input.recall) {
    if (input.recall.length > RECALL_MAX) return `Recall@k: ${RECALL_MAX} max`;
    const ks = new Set<number>();
    for (const point of input.recall) {
      if (whole(point.k, RETRIEVAL_K_MIN, RETRIEVAL_K_MAX) === null) return `Recall@k: k is ${RETRIEVAL_K_MIN} to ${RETRIEVAL_K_MAX.toLocaleString("en-GB")}`;
      if (typeof point.value !== "number" || !Number.isFinite(point.value) || point.value < 0 || point.value > 1) return "Recall@k: a share from 0 to 1";
      if (ks.has(point.k)) return `Recall@${point.k} is given twice`;
      ks.add(point.k);
    }
  }
  return null;
}

/** The payload keys a Retrieval tile writes, each only when given. `step: true` makes it a tile. */
export function retrievalPayload(input: Partial<Omit<RetrievalFacts, "recall">> & { recall?: readonly RecallPoint[] }): Record<string, Json> {
  const out: Record<string, Json> = { step: true };
  if (input.embeddingModel?.trim()) out.embedding_model = input.embeddingModel.trim();
  if (input.index?.trim()) out.index = input.index.trim();
  if (input.corpus?.trim()) out.corpus = input.corpus.trim();
  if (input.corpusSize !== undefined) out.corpus_size = input.corpusSize;
  if (input.query?.trim()) out.query = input.query.trim();
  if (input.k !== undefined) out.k = input.k;
  if (input.recall && input.recall.length > 0) out.recall = recallOf(input.recall) as unknown as Json;
  if (input.hybrid) out.hybrid = true;
  return out;
}

registerCleaners(RETRIEVAL_TYPE, {
  embedding_model: (value) => {
    const said = clean(value);
    if (said.length > EMBEDDING_MODEL_MAX) throw new Error(`Embedding model: ${EMBEDDING_MODEL_MAX} characters max`);
    return said || null;
  },
  index: (value) => {
    const said = clean(value);
    if (said.length > INDEX_MAX) throw new Error(`Vector index: ${INDEX_MAX} characters max`);
    return said || null;
  },
  corpus: (value) => {
    const said = clean(value);
    if (said.length > CORPUS_MAX) throw new Error(`What's indexed: ${CORPUS_MAX} characters max`);
    return said || null;
  },
  corpus_size: (value) => {
    if (value === null || value === undefined || value === "") return null;
    const n = whole(value, 0, CORPUS_SIZE_MAX);
    if (n === null) throw new Error("Items indexed: a whole number");
    return n;
  },
  query: (value) => {
    const said = clean(value);
    if (said.length > QUERY_MAX) throw new Error(`Query built from: ${QUERY_MAX} characters max`);
    return said || null;
  },
  k: (value) => {
    if (value === null || value === undefined || value === "") return null;
    const n = whole(value, RETRIEVAL_K_MIN, RETRIEVAL_K_MAX);
    if (n === null) throw new Error(`Results returned: ${RETRIEVAL_K_MIN} to ${RETRIEVAL_K_MAX.toLocaleString("en-GB")}`);
    return n;
  },
  recall: (value) => {
    if (value === null || value === undefined) return null;
    const why = retrievalRefusal({ recall: Array.isArray(value) ? (value as RecallPoint[]) : [] });
    if (why) throw new Error(why);
    const kept = recallOf(value);
    return kept.length > 0 ? (kept as unknown as Json) : null;
  },
  hybrid: (value) => (value === true ? true : null),
});

export type { FigureSource };
