/* SV-14: OpenBuilds' words and the steps strip, worked out from data. PURE: no React, no Supabase.

   The address holds the tab and the sort (`?type=`, `?sort=`), so changing either is the same page with new parameters.
   A strip is the build's top-level steps around the gap, at most `STRIP_SIZE`, the gap's own step open; each step is
   numbered by its place among the build's top-level steps (`topSteps`, the numbering `buildSteps` gives the composer and
   the build page), so "Step 7" here is "Step 7" there. */

import { REF_KIND } from "@/lib/build/postRefs";
import { kindOfNode, topSteps, type StepKind } from "@/lib/build/graph";
import { rewardLabel } from "@/components/bounty/bountyDisplay";
import type { StepRequestRecord, StepStripNode } from "@/lib/bounty/openBuilds";
import { atHandle, shortAgo, timeLeft } from "@/pages/site/home/homeModel";

/* ── the address ── */

export type OpenBuildsTab = "all" | "steps" | "sessions" | "parts" | "briefs" | "model-tests" | "reviews";
export type OpenBuildsSort = "needed" | "newest" | "closing" | "reward";

export const OPEN_BUILDS_TABS: readonly { value: OpenBuildsTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "steps", label: "Steps" },
  { value: "sessions", label: "Sessions" },
  { value: "parts", label: "Parts" },
  { value: "briefs", label: "Briefs" },
  { value: "model-tests", label: "Model tests" },
  { value: "reviews", label: "Reviews" },
];

/** The tabs with at least one live request type. Sessions and Parts arrive with SV-21; Briefs, Model tests and Reviews with SV-22. */
export const LIVE_TABS: readonly OpenBuildsTab[] = ["all", "steps"];

export const OPEN_BUILDS_SORTS: readonly { value: OpenBuildsSort; label: string }[] = [
  { value: "needed", label: "Most needed" },
  { value: "newest", label: "Newest" },
  { value: "closing", label: "Closing soon" },
  { value: "reward", label: "Reward" },
];

export interface OpenBuildsAddress {
  tab: OpenBuildsTab;
  sort: OpenBuildsSort;
}

const DEFAULT_ADDRESS: OpenBuildsAddress = { tab: "all", sort: "needed" };

export function readAddress(params: URLSearchParams, live: readonly OpenBuildsTab[] = LIVE_TABS): OpenBuildsAddress {
  const tab = params.get("type") as OpenBuildsTab | null;
  const sort = params.get("sort") as OpenBuildsSort | null;
  return {
    tab: tab && live.includes(tab) ? tab : DEFAULT_ADDRESS.tab,
    sort: sort && OPEN_BUILDS_SORTS.some((option) => option.value === sort) ? sort : DEFAULT_ADDRESS.sort,
  };
}

/** The address with `next` in it; a default value leaves the address. Other parameters stay. */
export function addressSearch(params: URLSearchParams, next: Partial<OpenBuildsAddress>): URLSearchParams {
  const out = new URLSearchParams(params);
  const set = (key: string, value: string, fallback: string) => (value === fallback ? out.delete(key) : out.set(key, value));
  if (next.tab) set("type", next.tab, DEFAULT_ADDRESS.tab);
  if (next.sort) set("sort", next.sort, DEFAULT_ADDRESS.sort);
  return out;
}

/* ── the reads' keys, shared by the page and the route table's prefetch ── */

/** How many top contributors the side column shows, and over how many days. */
export const CONTRIBUTORS_SHOWN = 3;
export const CONTRIBUTORS_DAYS = 30;

export const stepRequestsKey = (sort: OpenBuildsSort, viewerId: string | null) => ["bounty", "listStepRequests", sort, viewerId] as const;
export const contributorsKey = ["bounty", "listTopSolvers", CONTRIBUTORS_SHOWN, CONTRIBUTORS_DAYS] as const;

/* ── words ── */

/** "1 answer", "3 answers". */
export const answersWords = (n: number) => `${n} ${n === 1 ? "answer" : "answers"}`;

/** "2 answers to review", "Nothing to review". */
export const toReviewWords = (n: number) => (n === 0 ? "Nothing to review" : `${answersWords(n)} to review`);

/* ── the steps strip ── */

/** The most tiles a strip draws. */
export const STRIP_SIZE = 5;

/** A node as the strips read returns it (`listStepRequests`). */
export type StripNode = StepStripNode;

export interface StripTile {
  id: string;
  /** "4": its place among the build's top-level steps. */
  number: string;
  /** "Prompt", "Code". */
  kind: string;
  title: string;
  /** The step the gap is, or is in. */
  open: boolean;
}

export interface StepStrip {
  /** The gap's step number, or null when the gap could not be placed among the top-level steps. */
  number: string | null;
  tiles: StripTile[];
}

const kindWord = (kind: StepKind | undefined): string => (kind ? (REF_KIND[kind] ?? "Step") : "Step");

/**
 * The strip for one gap: the build's top-level steps around it, at most `STRIP_SIZE`, its own step open. A gap that is a
 * top-level step, or sits straight inside one, is placed; one nested deeper is not (one request cannot name its
 * ancestors), and its strip is the gap tile alone, unnumbered.
 */
export function stripFor(nodes: readonly StripNode[], gapId: string | null, gapTitle: string | null): StepStrip {
  const tops = topSteps(nodes.filter((node) => node.parent_id === null));
  const gap = gapId ? nodes.find((node) => node.id === gapId) : undefined;
  const at = gap ? tops.findIndex((node) => node.id === gap.id || node.id === gap.parent_id) : -1;
  if (at < 0) {
    return { number: null, tiles: gapId ? [{ id: gapId, number: "", kind: kindWord(gap ? kindOfNode(gap) : undefined), title: gapTitle ?? "Open step", open: true }] : [] };
  }
  const start = Math.max(0, Math.min(at - Math.floor(STRIP_SIZE / 2), tops.length - STRIP_SIZE));
  const shown = tops.slice(start, start + STRIP_SIZE);
  const tiles = shown.map((node, index) => {
    const open = start + index === at;
    const kind = kindWord(kindOfNode(node));
    return {
      id: node.id,
      number: String(start + index + 1),
      kind,
      title: (open ? (gapTitle ?? gap?.title) : node.title)?.trim() || kind,
      open,
    };
  });
  return { number: String(at + 1), tiles };
}

/** The strips of many gaps from one read: the rows grouped by build once, then each gap's strip from its build's rows. */
export function stripsFor(rows: readonly StripNode[], gaps: readonly { key: string; buildId: string; gapId: string | null; gapTitle: string | null }[]): Map<string, StepStrip> {
  const byBuild = new Map<string, StripNode[]>();
  for (const row of rows) {
    const list = byBuild.get(row.build_id);
    if (list) list.push(row);
    else byBuild.set(row.build_id, [row]);
  }
  return new Map(gaps.map((gap) => [gap.key, stripFor(byBuild.get(gap.buildId) ?? [], gap.gapId, gap.gapTitle)]));
}

/* ── a step request as the view draws it ── */

export interface StepRequestWords {
  id: string;
  title: string;
  reward: { text: string; muted?: boolean };
  meta: string[];
  problem: string | null;
  /** "2 days left", "1 answer": the facts before Me too. */
  facts: string[];
  answerTo: string;
}

/** "Step 4 · <gap>" when the strip placed it, else the gap's title; "£40" or "No reward"; "<build> · @maker · <age>". */
export function stepRequestWords(request: StepRequestRecord, strip: StepStrip, now: number): StepRequestWords {
  const gap = request.gapTitle ?? "Open request";
  const reward = rewardLabel(request.bounty.reward_gbp);
  return {
    id: request.bounty.id,
    title: strip.number ? `Step ${strip.number} · ${gap}` : gap,
    reward: reward ? { text: reward } : { text: "No reward", muted: true },
    meta: [request.build.title, atHandle(request.maker?.username), shortAgo(request.bounty.created_at, now)].filter((part): part is string => Boolean(part)),
    problem: request.problem || null,
    facts: [timeLeft(request.bounty.closes_at, now), answersWords(request.solutions)].filter(Boolean),
    answerTo: `/openbuilds/${request.bounty.id}/solve`,
  };
}
