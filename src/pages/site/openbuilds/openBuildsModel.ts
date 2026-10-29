/* SV-14: OpenBuilds' words and the steps strip, worked out from data. PURE: no React, no Supabase.

   The address holds the tab and the sort (`?type=`, `?sort=`), so changing either is the same page with new parameters.
   A strip is the build's top-level steps around the gap, at most `STRIP_SIZE`, the gap's own step open; each step is
   numbered by its place among the build's top-level steps (`topSteps`, the numbering `buildSteps` gives the composer and
   the build page), so "Step 7" here is "Step 7" there. */

import { REF_KIND } from "@/lib/build/postRefs";
import { kindOfNode, topSteps, type StepKind } from "@/lib/build/graph";
import { rewardLabel } from "@/components/bounty/bountyDisplay";
import type { RequestSize, StepRequestRecord, StepStripNode } from "@/lib/bounty/openBuilds";
import { claimDaysLeft, type MyClaim, type RequestClaim } from "@/lib/bounty/claims";
import { sessionOrderOf, sessionsMetaOf, storedWorkstreamsOf, toolLabel, type SessionMeta } from "@/lib/build/making";
import { numberSessions } from "@/lib/build/sessionNumbers";
import { hasParts, labelsOf, workstreamTitle } from "@/lib/build/workstreams";
import { atHandle, shortAgo, timeLeft } from "@/pages/site/home/homeModel";
import type { FactPart } from "./OpenBuildsView";

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

/** The tabs with at least one live request type. Sessions and Parts went live with SV-21; Briefs, Model tests and Reviews arrive with SV-22.
    Whole-build requests are listed in All only. */
export const LIVE_TABS: readonly OpenBuildsTab[] = ["all", "steps", "sessions", "parts"];

/** The request sizes a tab reads. */
export const sizeOfTab = (tab: OpenBuildsTab): RequestSize => (tab === "steps" ? "step" : tab === "sessions" ? "session" : tab === "parts" ? "part" : "all");

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

export const stepRequestsKey = (sort: OpenBuildsSort, size: RequestSize, viewerId: string | null) => ["bounty", "listStepRequests", sort, size, viewerId] as const;
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

/** One read's rows grouped by build, once. */
export function rowsByBuild(rows: readonly StripNode[]): Map<string, StripNode[]> {
  const byBuild = new Map<string, StripNode[]>();
  for (const row of rows) {
    const list = byBuild.get(row.build_id);
    if (list) list.push(row);
    else byBuild.set(row.build_id, [row]);
  }
  return byBuild;
}

/** The strips of many gaps from one read: each gap's strip from its build's rows. */
export function stripsFor(rows: readonly StripNode[], gaps: readonly { key: string; buildId: string; gapId: string | null; gapTitle: string | null }[]): Map<string, StepStrip> {
  const byBuild = rowsByBuild(rows);
  return new Map(gaps.map((gap) => [gap.key, stripFor(byBuild.get(gap.buildId) ?? [], gap.gapId, gap.gapTitle)]));
}

/** A build's step count: its top-level steps, the numbered ones. */
export const stepCountOf = (rows: readonly StripNode[]): number => topSteps(rows.filter((node) => node.parent_id === null)).length;

/** "1 step", "6 steps". */
export const stepsWords = (n: number) => `${n} ${n === 1 ? "step" : "steps"}`;

/* ── a step request as the view draws it ── */

export interface StepRequestWords {
  id: string;
  title: string;
  reward: { text: string; muted?: boolean };
  meta: string[];
  problem: string | null;
  /** "2 days left", "1 answer": the facts before Me too. */
  facts: string[];
  /** SV-21: "Claimed by @kit · 2 days left · fork in progress" while a claim stands; the claim comes first among the facts. */
  claim: FactPart[] | null;
  answerTo: string;
}

/* ── claims (SV-21) ── */

/** "1 day left", "3 days left". */
export const daysLeftWords = (days: number) => `${days} ${days === 1 ? "day" : "days"} left`;

/** The fact a claim draws: the claimer's handle in text colour, the rest in the fact's own. */
export function claimFact(claim: RequestClaim, now: number): FactPart[] {
  return [
    { text: "Claimed by " },
    { text: claim.handle ? `@${claim.handle}` : "someone", tone: "text" },
    { text: ` · ${daysLeftWords(claimDaysLeft(claim.expiresAt, now))}${claim.forkBuildId ? " · fork in progress" : ""}` },
  ];
}

/** A row of Your claims: "<build> · <gap or Whole build>", the days left, and where Answer goes. */
export const claimRow = (claim: MyClaim, now: number) => ({
  id: claim.requestId,
  label: `${claim.build.title} · ${claim.gapTitle ?? "Whole build"}`,
  detail: daysLeftWords(claimDaysLeft(claim.expiresAt, now)),
  to: `/openbuilds/${claim.requestId}/solve`,
});

/** A whole-build request's title while the bounty has no words of its own: `gap_problem` lives on a gap node, and a
    whole-build request has none. */
export const WHOLE_BUILD_TITLE = "Open request on the whole build";

/** "Step 4 · <gap>" when the strip placed it, else the gap's title; a whole-build request's own title; "£40" or "No
    reward"; "<build> · @maker · <age>", so the build's title sits under a whole-build request's. */
export function stepRequestWords(request: StepRequestRecord, strip: StepStrip, now: number): StepRequestWords {
  const gap = request.bounty.gap_node_id === null ? (request.problem || WHOLE_BUILD_TITLE) : (request.gapTitle ?? "Open request");
  const reward = rewardLabel(request.bounty.reward_gbp);
  return {
    id: request.bounty.id,
    title: strip.number ? `Step ${strip.number} · ${gap}` : gap,
    reward: reward ? { text: reward } : { text: "No reward", muted: true },
    meta: [request.build.title, atHandle(request.maker?.username), request.fromRun ? "From a failed run" : null, shortAgo(request.bounty.created_at, now)].filter((part): part is string => Boolean(part)),
    problem: request.bounty.gap_node_id === null ? null : request.problem || null,
    facts: [timeLeft(request.bounty.closes_at, now), answersWords(request.solutions)].filter(Boolean),
    claim: request.claim ? claimFact(request.claim, now) : null,
    answerTo: `/openbuilds/${request.bounty.id}/solve`,
  };
}


/* ── session and part requests (SV-21) ── */

/** Said on every request for a session or a part: what an offer carries over. It is `addSession`'s rule. */
export const SESSION_OFFER_NOTE = "An offered session copies prompt text, model and source only";

/** The most session tiles a request draws: the open one and its nearest neighbours. */
export const SESSION_TILES_SHOWN = 4;

/** "Claude Code · Opus 5.5", or "Session" when the session names neither. */
const sessionDetail = (meta: SessionMeta | undefined): string => [toolLabel(meta?.tool), meta?.model].filter(Boolean).join(" · ") || "Session";

/** `list` cut to `size` places around `at` (the place of the open one), keeping the order. */
function around<T>(list: readonly T[], at: number, size: number): T[] {
  const start = Math.max(0, Math.min(at - (size - 1), list.length - size));
  return list.slice(start, start + size);
}

export interface SessionRequestWords {
  title: string;
  sessions: { key: string; label: string; detail: string; open?: boolean }[];
}

/**
 * The title and the tiles of a request for a session or a part, from the build's `making`. A session is numbered as
 * everywhere else (`numberSessions`); the part is named only when the build has two or more. A request for a part draws the
 * part's sessions and, last, the one it asks for. A session or part the maker has since removed still has its request: it is
 * drawn as "Session" or "A part" with the problem.
 */
export function sessionRequestWords(request: StepRequestRecord): SessionRequestWords | null {
  const target = request.target;
  if (!target) return null;
  const problem = request.problem;
  const meta = sessionsMetaOf(target.making);
  const order = sessionOrderOf(target.making);
  const keys = [...new Set([...order, ...Object.keys(meta)])];
  const parts = storedWorkstreamsOf(target.making);
  const labels = labelsOf(target.making);
  const numbers = numberSessions(keys.map((key) => ({ key, firstTile: null })), order, { meta, workstreams: parts });
  const partIndex = (key: string | undefined) => parts.findIndex((part) => part.key === key);
  const partTitle = (index: number) => (index >= 0 ? workstreamTitle(parts[index], index, labels) : null);
  const nameOf = (key: string) => `Session ${numbers.numberOf.get(key) ?? ""}`.trim();
  const join = (...pieces: (string | null | undefined)[]) => pieces.filter((piece): piece is string => Boolean(piece)).join(" · ");

  if (target.size === "session") {
    const at = partIndex(numbers.partOf.get(target.key));
    const sameKeys = numbers.keys.filter((key) => numbers.partOf.get(key) === numbers.partOf.get(target.key));
    const present = sameKeys.includes(target.key);
    const shown = present ? around(sameKeys, sameKeys.indexOf(target.key), SESSION_TILES_SHOWN) : sameKeys.slice(-(SESSION_TILES_SHOWN - 1));
    const tiles = shown.map((key) => ({ key, label: nameOf(key), detail: key === target.key ? "Open" : sessionDetail(meta[key]), ...(key === target.key ? { open: true } : null) }));
    if (!present) tiles.push({ key: target.key, label: "Session", detail: "Open", open: true });
    return { title: join(hasParts(parts) ? partTitle(at) : null, present ? nameOf(target.key) : "Session", problem), sessions: tiles };
  }

  const at = partIndex(target.key);
  const inPart = numbers.keys.filter((key) => numbers.partOf.get(key) === target.key);
  const tiles = inPart.slice(-(SESSION_TILES_SHOWN - 1)).map((key) => ({ key, label: nameOf(key), detail: sessionDetail(meta[key]) }));
  tiles.push({ key: "next", label: "Next session", detail: "Open", open: true } as (typeof tiles)[number]);
  return { title: join(partTitle(at) ?? "A part", problem), sessions: tiles };
}

/* ── offering a session (SV-21) ── */

/** "3 Oct". */
const dayOf = (iso: string): string => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? "" : at.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
};

/** The least a session is read as here: what the library list holds. */
export interface OfferableSession {
  id: string;
  client: string | null;
  modelName: string | null;
  firstPrompt: string | null;
  promptCount: number;
  createdAt: string;
}

/** A session in the offer dialog: its first prompt for a name, and "<app> · <model> · <day> · n prompts" beneath, "No app chosen" when the app is not known. */
export const offerChoice = (session: OfferableSession): { id: string; name: string; detail: string } => ({
  id: session.id,
  name: session.firstPrompt?.trim().slice(0, 120) || "Untitled session",
  detail: [toolLabel(session.client) ?? "No app chosen", session.modelName, dayOf(session.createdAt), `${session.promptCount} ${session.promptCount === 1 ? "prompt" : "prompts"}`].filter(Boolean).join(" · "),
});

/** One offer as the request draws it: "@kit · Claude Code · Opus 5.5 · 6 prompts", or "You offered …" for the offerer's own. */
export function offerLine(offer: { handle: string | null; userId: string; session: { model: string | null; prompts: readonly unknown[] } }, viewerId: string | null): string {
  const n = offer.session.prompts.length;
  const who = offer.userId === viewerId ? "You offered a session" : `${atHandle(offer.handle) ?? "Someone"} offered a session`;
  return [who, offer.session.model, `${n} ${n === 1 ? "prompt" : "prompts"}`].filter(Boolean).join(" · ");
}
