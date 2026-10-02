/* UI-P29 — the Build page's view model: the shapes `BuildView` takes, and the
   pure functions that build them from what the data layer returns.

   NOTHING HERE FETCHES. `BuildPage` loads, these map, `BuildView` draws; the dev
   compare page builds the same shapes from the sample data. */

import type { ReactNode } from "react";

import type { PartViewerMode } from "@/components/brand/PartViewer";
import type { PlaqueBuild } from "@/components/brand/Plaque";
import type { TimelineEvent } from "@/components/brand/Timeline";
import { rewardLabel } from "@/components/bounty/bountyDisplay";
import { collectBreakages, spanLabel, type BreakageEntry } from "@/components/build/BreakageView";
import { gapStatement } from "@/components/build/GapPanel";
import { asPayload, eventLead, payloadNumber, payloadText } from "@/components/build/eventDisplay";
import { creatorLabel } from "@/components/build/rebuildDisplay";
import { collectRunSequence, runSequenceText } from "@/components/build/RunView";
import type { BuildBounty } from "@/lib/bounty";
import {
  LAYER_ATTRIBUTION,
  collectGaps,
  type Build,
  type BuildEvent,
  type BuildLayer,
  type BuildNode,
  type ChangeLine,
  type EventKind,
  type NodeTree,
  type NodeType,
  type RebuildSummary,
} from "@/lib/build";
import type { PortableCost } from "@/lib/build/portable";

/* ── the tabs ── */

/** BuildTabs' six keys, kept whole: Run and Understand stay two tabs. */
export type BuildTabKey = "anatomy" | "watch" | "run" | "understand" | "broke" | "rebuilds";

/**
 * The page's sections, in BuildTabs' order and with its labels
 * (src/components/build/BuildTabs.tsx). Rebuilds is listed only when there is a
 * rebuild to show, which is BuildTabs' own rule.
 */
export const BUILD_TABS: readonly { value: BuildTabKey; label: string }[] = [
  { value: "anatomy", label: "Anatomy" },
  { value: "watch", label: "Watch it get built" },
  { value: "run", label: "Run it yourself" },
  { value: "understand", label: "Understand it" },
  { value: "broke", label: "Where it broke" },
  { value: "rebuilds", label: "Rebuilds" },
];

export function buildTabs(hasRebuilds: boolean): { value: BuildTabKey; label: string }[] {
  return BUILD_TABS.filter((tab) => tab.value !== "rebuilds" || hasRebuilds);
}

/** The layer a tab presets the Run / Understand switch to, or null for the tabs that have none. */
export function tabLayer(tab: BuildTabKey): PartViewerMode | null {
  return tab === "run" || tab === "understand" ? tab : null;
}

/* ── the shapes the view takes ── */

export interface BuildCreditView {
  /** The frozen fork snapshot, when this build is a rebuild. */
  rebuiltFrom: { title: string; handle: string | null } | null;
  /** "@maya", or the maker's name when they have no handle; null when unknown. */
  madeBy: string | null;
}

export interface BuildHeroView {
  title: string;
  outcome: string;
  /** The build's shape, as its tag says it: "agent". */
  shape: string;
  /** `getCreatedVia()` says the whole record arrived through the connector. */
  viaConnector: boolean;
  /** The picture: the resolved cover as an `<img>`, else a `CoverFallback`. Fills the hero. */
  cover: ReactNode;
  credit: BuildCreditView;
  /** "Δ swapped model: …", or null when there is nothing worked out to say. */
  delta: string | null;
}

export interface BuildActionsView {
  /** Puts the build on the clipboard as markdown. Resolves true when it landed. */
  onCopyForAI: () => Promise<boolean>;
  onDownload: () => void;
  onRebuild: () => void;
  lineageTo: string;
}

export type ProofActionKind = "reproduce" | "reconfirm" | "sign-in";

export interface ProofActionView {
  kind: ProofActionKind;
  onPress: () => void;
  pending?: boolean;
}

export interface ProofDetailView {
  label: string;
  value: string;
}

export interface CompletenessView {
  score: number;
  /** MINIMUM_PUBLISHABLE_SCORE. */
  publishAt: number;
  /** galleryThreshold(shape). */
  galleryAt: number;
  /** The first missing item's copy, or null when nothing is missing. */
  next: string | null;
}

export interface BuildProofView {
  /** The one record the orb, the plaque and the lamp read. */
  build: PlaqueBuild;
  /** "27 Sep", or null when nobody has confirmed it. */
  lastRun: string | null;
  action: ProofActionView;
  /** Made for · Made with · Setup · Monthly · First result · Needs, in that order. */
  details: readonly ProofDetailView[];
  /** The creator's own view only; null for everyone else. */
  completeness: CompletenessView | null;
}

export interface PartRowView {
  id: string;
  /** From 1, in record order. */
  number: number;
  title: string;
  /** The part's category key — its dot, its chip. */
  category: string;
  /** A short meta in mono ("1,240 w", "18 rules"), or null. */
  meta: string | null;
  /** Left open (`collectGaps()`): dashed breakage edge. */
  gap: boolean;
  /** "£150 ask" for a gap with an open reward. */
  ask: string | null;
}

export interface BuildAnatomyView {
  parts: readonly PartRowView[];
  /** How many parts are left open. */
  gaps: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** The whole tree, for "Show the full anatomy". */
  full: ReactNode;
}

export interface BuildViewerView {
  tabs: readonly { value: BuildTabKey; label: string }[];
  tab: BuildTabKey;
  onTabChange: (tab: BuildTabKey) => void;
  mode: PartViewerMode;
  onModeChange: (mode: PartViewerMode) => void;
  /** The layer's line: LAYER_BLURB[mode]. */
  blurb: ReactNode;
  /** What the current tab shows for the selected part. */
  content: ReactNode;
  /** Copies the selected part's content. Resolves true when it landed. */
  onCopy: () => Promise<boolean>;
}

export interface BuildTimelineView {
  /** The kept events, clocked from the first. */
  events: readonly TimelineEvent[];
  /** "26 minutes", or null when there is no span to report. */
  duration: string | null;
  onPlay: () => void;
}

/* ── numbers and words ── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "27 Sep", in UTC so a server and a browser agree. Null for a missing or unreadable date. */
export function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}`;
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

/** "41 ran it". */
export const ranIt = (count: number): string => `${count.toLocaleString("en-GB")} ran it`;

/** "8 parts · 1 left open", or "8 parts" when nothing is open. */
export function anatomySubtitle(parts: number, gaps: number): string {
  const head = plural(parts, "part", "parts");
  return gaps > 0 ? `${head} · ${gaps.toLocaleString("en-GB")} left open` : head;
}

/** "26 minutes · 5 events kept", or the count alone when there is no span. */
export function timelineSubtitle(duration: string | null, kept: number): string {
  const count = plural(kept, "event kept", "events kept");
  return duration ? `${duration} · ${count}` : count;
}

/**
 * An amount in its own currency: "£12", "$9.50". A currency that is not a code
 * the browser knows is written after the figure; none at all leaves the figure.
 * Null for no amount.
 */
export function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string | null {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  const digits = Number.isInteger(amount) ? 0 : 2;
  const code = (currency ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(code)) {
    try {
      return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: code,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(amount);
    } catch {
      /* an unknown code: fall through to the figure and the code */
    }
  }
  const figure = amount.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return code ? `${figure} ${code}` : figure;
}

/** One half of a `PortableCost`, formatted in its currency. */
export function formatCost(cost: PortableCost | null, which: "setup" | "monthly"): string | null {
  if (!cost) return null;
  return formatMoney(cost[which], cost.currency);
}

/** `time_to_first_result` (minutes) as "20 min", "2 h", "1.5 h". */
export function formatFirstResult(minutes: number | null | undefined): string | null {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes < 0) return null;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`;
}

/** What the wall label prints when a fact is missing. */
export const MISSING = "—";

const listText = (values: readonly (string | null)[] | null | undefined): string | null => {
  const kept = (values ?? []).map((value) => (value ?? "").trim()).filter(Boolean);
  return kept.length > 0 ? kept.join(", ") : null;
};

/* ── the tree ── */

/** Every placed node, depth first: the order the record reads in, and the order the parts are numbered. */
export function partsInOrder(tree: readonly NodeTree[]): NodeTree[] {
  const out: NodeTree[] = [];
  const walk = (nodes: readonly NodeTree[]) => {
    for (const node of nodes) {
      out.push(node);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(tree);
  return out;
}

/** The prerequisite type's key in the registry (node_types). */
export const PREREQUISITE_TYPE = "prerequisite";

/** What someone needs before they start: the prerequisite parts' titles, joined. Gaps are not needs met. */
export function needsLine(tree: readonly NodeTree[]): string | null {
  const titles = partsInOrder(tree)
    .filter((node) => node.type === PREREQUISITE_TYPE && !node.is_gap)
    .map((node) => (node.title ?? "").trim())
    .filter(Boolean);
  return titles.length > 0 ? titles.join(" + ") : null;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const wordCount = (text: string): number => (text.trim() ? text.trim().split(/\s+/).length : 0);

/** "Rules" → "rule" for one, "rules" for more. */
function noun(label: string, count: number): string {
  const word = label.trim().toLowerCase();
  if (count !== 1) return word;
  return word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
}

/**
 * The few words a part's row carries after its title, read off its payload:
 *
 *   a list it declares, counted   "18 rules", "3 tools"
 *   else its prose, in words      "1,240 w"
 *   else what kind of part it is  "screenshot"
 *
 * Null when the part has none of these. It never guesses a figure the payload
 * does not hold.
 */
export function partMeta(
  node: Pick<BuildNode, "payload" | "type">,
  nodeType?: Pick<NodeType, "schema" | "label"> | null,
): string | null {
  const payload = asRecord(node.payload);
  const fields = nodeType?.schema?.fields ?? [];

  for (const field of fields) {
    if (field.type !== "list") continue;
    const value = payload[field.key];
    if (Array.isArray(value) && value.length > 0) return `${value.length.toLocaleString("en-GB")} ${noun(field.label, value.length)}`;
  }

  const words = fields
    .filter((field) => field.type === "text")
    .reduce((sum, field) => {
      const value = payload[field.key];
      return sum + (typeof value === "string" ? wordCount(value) : 0);
    }, 0);
  if (words > 0) return `${words.toLocaleString("en-GB")} w`;

  const kind = (nodeType?.label ?? "").trim().toLowerCase();
  return kind || null;
}

/** "£150 ask". */
export const askLabel = (rewardGbp: number): string => `${formatMoney(rewardGbp, "GBP")} ask`;

/* ── the proof panel ── */

/** The header columns the details read. */
export interface DetailSource {
  made_for: string[] | null;
  made_with: string[] | null;
  cost_setup: number | null;
  cost_monthly: number | null;
  currency: string | null;
  time_to_first_result: number | null;
}

/** The cost as the portable file states it: present when either half is. */
export function portableCost(build: Pick<DetailSource, "cost_setup" | "cost_monthly" | "currency">): PortableCost | null {
  if (build.cost_setup === null && build.cost_monthly === null) return null;
  return { setup: build.cost_setup, monthly: build.cost_monthly, currency: build.currency };
}

/** The six facts, in the wall label's order, with "—" for a fact the record does not state. */
export function proofDetails(build: DetailSource, tree: readonly NodeTree[]): ProofDetailView[] {
  const cost = portableCost(build);
  return [
    { label: "Made for", value: listText(build.made_for) ?? MISSING },
    { label: "Made with", value: listText(build.made_with) ?? MISSING },
    { label: "Setup", value: formatCost(cost, "setup") ?? MISSING },
    { label: "Monthly", value: formatCost(cost, "monthly") ?? MISSING },
    { label: "First result", value: formatFirstResult(build.time_to_first_result) ?? MISSING },
    { label: "Needs", value: needsLine(tree) ?? MISSING },
  ];
}

/* ── the credit ── */

/** "@maya" from a username, else the display name, else null. */
export function makerLabel(maker: { username: string | null; displayName: string | null } | null | undefined): string | null {
  const handle = (maker?.username ?? "").trim();
  if (handle) return `@${handle}`;
  const name = (maker?.displayName ?? "").trim();
  return name || null;
}

/** The longest a Δ line's first change may run before it is clipped. */
const DELTA_MAX = 56;

/**
 * The Δ line from `serialiseChangeSet()`'s lines: the first change, and how many
 * more there are. Null when nothing was worked out, or nothing differs.
 */
export function deltaLine(lines: readonly ChangeLine[] | null | undefined): string | null {
  if (!lines || lines.length === 0) return null;
  const first = lines[0].text.replace(/\s+/g, " ").trim();
  const clipped = first.length > DELTA_MAX ? `${first.slice(0, DELTA_MAX - 1).trimEnd()}…` : first;
  const lead = clipped.charAt(0).toLowerCase() + clipped.slice(1);
  const rest = lines.length - 1;
  return rest > 0 ? `Δ ${lead}, and ${rest} more` : `Δ ${lead}`;
}

/* ── the timeline ── */

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * How far into the build an event happened: "04:12" under a hundred minutes,
 * "3h 05" under two days, then "day 3".
 */
export function clockLabel(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 100 * 60) return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
  if (seconds < 48 * 3600) return `${Math.floor(seconds / 3600)}h ${pad(Math.floor((seconds % 3600) / 60))}`;
  return `day ${Math.floor(seconds / 86_400) + 1}`;
}

/** How long the whole build took: "26 minutes", "3 hours", "4 days". */
export function durationLabel(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return "under a minute";
  if (minutes < 100) return plural(minutes, "minute", "minutes");
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return plural(hours, "hour", "hours");
  return plural(Math.floor(hours / 24), "day", "days");
}

const KINDS: ReadonlySet<string> = new Set<EventKind>(["prompt", "milestone", "breakage", "deploy", "note"]);

const time = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const at = Date.parse(iso);
  return Number.isFinite(at) ? at : null;
};

/** The one line an event says: its lead (the replay's), else its phase, else its kind. */
export function eventText(event: BuildEvent): string {
  const lead = eventLead(event)?.text;
  if (lead) return lead.replace(/\s+/g, " ").trim();
  const phase = (event.phase_title ?? "").trim();
  if (phase) return phase;
  return event.kind.charAt(0).toUpperCase() + event.kind.slice(1);
}

/**
 * The timeline from the visible events: the KEPT ones, in ordinal order, each
 * clocked from the first visible event. The duration spans every visible event,
 * because how long a build took does not depend on which steps were kept.
 */
export function timelineFrom(events: readonly BuildEvent[]): { events: TimelineEvent[]; duration: string | null } {
  const ordered = [...events].filter((event) => event.visibility !== "hidden").sort((a, b) => a.ordinal - b.ordinal);
  const times = ordered.map((event) => time(event.occurred_at)).filter((at): at is number => at !== null);
  const start = times.length > 0 ? Math.min(...times) : null;
  const end = times.length > 0 ? Math.max(...times) : null;

  const kept = ordered
    .filter((event) => event.visibility === "kept" && KINDS.has(event.kind))
    .map((event): TimelineEvent => {
      const at = time(event.occurred_at);
      return {
        kind: event.kind as EventKind,
        at: at !== null && start !== null ? clockLabel(at - start) : MISSING,
        text: eventText(event),
      };
    });

  return { events: kept, duration: start !== null && end !== null && end > start ? durationLabel(end - start) : null };
}

/* ══ UI-P30 — the tab bodies and the sections under the first screen ══════════

   Each tab's body takes one of the shapes below. The page maps the record into
   them with the functions under each shape; the dev compare page builds the same
   shapes from the sample data. Every body is drawn inside the part viewer. */

/** The tabs whose body is a reading of the selected part: the viewer keeps its switch, Copy and blurb for these. */
export function tabReadsPart(tab: BuildTabKey): boolean {
  return tab === "anatomy" || tab === "run" || tab === "understand";
}

/** A card on a wall: drawn by the page (a real `GalleryCard`) or by the fixture (a `BuildCard`). */
export interface CardView {
  key: string;
  render: (variant: "desktop" | "phone") => ReactNode;
}

/* ── Watch it get built ── */

/** One step the replay can stand on. */
export interface ReplayEventView {
  id: string;
  ordinal: number;
  kind: EventKind;
  /** How far into the build, from the first visible step: "04:12". */
  at: string;
  /** The step's one line (`eventText`). */
  text: string;
  /** The phase run it sits in: a stable key and, when the creator named it, a title. */
  phaseKey: string;
  phaseTitle: string | null;
}

/** A step somebody rebuilt from: a dot over the scrubber at that step. */
export interface ReplayMarkerView {
  /** Index into the replay's events. */
  index: number;
  /** "@sam rebuilt from here", or "3 people rebuilt from here". */
  label: string;
  rebuilds: readonly { id: string; label: string }[];
}

export interface ReplayView {
  events: readonly ReplayEventView[];
  markers: readonly ReplayMarkerView[];
  /** Jump to this ordinal when it changes (a breakage's "watch it"). */
  focusOrdinal: number | null;
  /** What existed at this index: the part the latest producing step made, drawn. Null before anything was made. */
  produced: (index: number) => { ordinal: number; node: ReactNode } | null;
  /** Rebuild from this step. Absent, the control is not drawn. */
  onFork?: (ordinal: number) => void;
  forkPending?: boolean;
  onOpenRebuild?: (id: string) => void;
}

/**
 * The visible steps in ordinal order, each clocked from the first and placed in
 * its phase run. Hidden steps are the creator's own workings and are not part
 * of the record a reader replays, whoever is reading.
 */
export function replayEvents(events: readonly BuildEvent[]): ReplayEventView[] {
  const ordered = [...events].filter((event) => event.visibility !== "hidden").sort((a, b) => a.ordinal - b.ordinal);
  const times = ordered.map((event) => time(event.occurred_at)).filter((at): at is number => at !== null);
  const start = times.length > 0 ? Math.min(...times) : null;

  /* Contiguous runs of one phase integer, titled by the first title in the run. */
  const runs: { key: string; title: string | null; from: number; to: number }[] = [];
  ordered.forEach((event, index) => {
    const last = runs[runs.length - 1];
    if (last && ordered[last.from].phase === event.phase) {
      last.to = index;
      if (!last.title && (event.phase_title ?? "").trim()) last.title = (event.phase_title ?? "").trim();
      return;
    }
    runs.push({ key: `${event.phase ?? "none"}-${event.id}`, title: (event.phase_title ?? "").trim() || null, from: index, to: index });
  });

  return ordered.map((event, index) => {
    const run = runs.find((candidate) => index >= candidate.from && index <= candidate.to);
    const at = time(event.occurred_at);
    return {
      id: event.id,
      ordinal: event.ordinal,
      kind: (KINDS.has(event.kind) ? event.kind : "note") as EventKind,
      at: at !== null && start !== null ? clockLabel(at - start) : MISSING,
      text: eventText(event),
      phaseKey: run?.key ?? "none",
      phaseTitle: run?.title ?? null,
    };
  });
}

/** "@sam rebuilt from here", or "3 people rebuilt from here" (the replay's own words). */
function markerWords(rebuilds: readonly RebuildSummary[]): string {
  if (rebuilds.length === 1) return `${creatorLabel(rebuilds[0])} rebuilt from here`;
  return `${rebuilds.length.toLocaleString("en-GB")} people rebuilt from here`;
}

/**
 * The steps somebody rebuilt from, as dots over the scrubber. A rebuild of the
 * whole build names no step and gets no dot; one naming a step the reader cannot
 * see (hidden, or since deleted) lands nowhere, which is the honest answer.
 */
export function replayMarkers(events: readonly ReplayEventView[], rebuilds: readonly RebuildSummary[]): ReplayMarkerView[] {
  const indexById = new Map(events.map((event, index) => [event.id, index]));
  const buckets = new Map<number, RebuildSummary[]>();
  for (const rebuild of rebuilds) {
    if (!rebuild.forked_from_event_id) continue;
    const index = indexById.get(rebuild.forked_from_event_id);
    if (index === undefined) continue;
    buckets.set(index, [...(buckets.get(index) ?? []), rebuild]);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, here]) => ({
      index,
      label: markerWords(here),
      rebuilds: here.map((rebuild) => ({ id: rebuild.id, label: `${creatorLabel(rebuild)} rebuilt from here` })),
    }));
}

/** "4 rebuilds started from 2 steps in this sequence". */
export function divergenceSummary(markers: readonly ReplayMarkerView[]): string {
  const total = markers.reduce((sum, marker) => sum + marker.rebuilds.length, 0);
  const steps = markers.length === 1 ? "a step" : `${markers.length.toLocaleString("en-GB")} steps`;
  return `${plural(total, "rebuild", "rebuilds")} started from ${steps} in this sequence`;
}

/* ── Run it yourself, and Understand it ── */

export interface RunStepView {
  id: string;
  title: string;
  /** The part's kind, as the registry names it: "Prompt". */
  kind: string;
  /** What "Copy" puts on the clipboard, or null when the step carries nothing to copy. */
  copyText: string | null;
}

export interface RunPrerequisiteView {
  id: string;
  title: string;
  requirement: string | null;
}

export interface LayerStepView {
  n: number;
  title: string;
  body: string;
  /** The part this step names, when it still resolves. */
  part: { id: string; title: string } | null;
}

/** A generated layer as the page reads it: whose words, then the steps. */
export interface LayerStepsView {
  attribution: string;
  steps: readonly LayerStepView[];
}

export interface RunBodyView {
  steps: readonly RunStepView[];
  prerequisites: readonly RunPrerequisiteView[];
  /** The whole sequence as plain text: "Copy all steps". */
  allText: string;
  /** The approved run layer, offered beside the sequence as "In words". */
  words: LayerStepsView | null;
}

/** An approved layer's steps, each naming its part when the part is still in the record. */
export function layerSteps(layer: Pick<BuildLayer, "content">, resolveNode: (id: string) => BuildNode | undefined): LayerStepsView {
  return {
    attribution: LAYER_ATTRIBUTION,
    steps: (layer.content?.steps ?? []).map((step) => {
      const node = step.node_ref ? resolveNode(step.node_ref) : undefined;
      return {
        n: step.n,
        title: (step.title ?? "").trim(),
        body: (step.body ?? "").trim(),
        part: node ? { id: node.id, title: (node.title ?? "").trim() } : null,
      };
    }),
  };
}

/**
 * The sequence a reader follows, read the way RunView reads it — the registry's
 * copyable parts as steps, the prerequisites as a checklist, no notes — with
 * the run layer, when one is approved, offered as "In words".
 */
export function runBody(
  build: Build,
  tree: NodeTree[],
  nodeTypes: readonly NodeType[],
  runLayer: Pick<BuildLayer, "content"> | null,
  resolveNode: (id: string) => BuildNode | undefined,
): RunBodyView {
  const typesByKey = new Map(nodeTypes.map((type) => [type.key, type]));
  const { steps, prerequisites } = collectRunSequence(tree, typesByKey);
  return {
    steps: steps.map((step) => ({
      id: step.node.id,
      title: (step.node.title ?? "").trim() || "Untitled step",
      kind: step.nodeType?.label ?? step.node.type,
      copyText: step.copyText,
    })),
    prerequisites: prerequisites.map((item) => ({
      id: item.node.id,
      title: (item.node.title ?? "").trim() || "Untitled",
      requirement: item.requirement,
    })),
    allText: runSequenceText(build, prerequisites, steps),
    words: runLayer ? layerSteps(runLayer, resolveNode) : null,
  };
}

/* ── Where it broke ── */

export interface BreakageRowView {
  key: string;
  /** The part's name, or "Breakage at step 11" for one recorded only in the sequence. */
  name: string;
  /** What happened: the symptom, else the step's own line. */
  happened: string | null;
  /** The fix, when one was written down. */
  fix: string | null;
  /** "step 11", "steps 6–9", or null when no step was recorded. */
  span: string | null;
  /** The ordinal the replay opens at. */
  start: number | null;
  /** "6 attempts", when they were counted. */
  attempts: string | null;
}

export interface OpenGapView {
  /** The gap part's id. */
  id: string;
  title: string;
  /** What is missing, in the creator's words. */
  problem: string | null;
  /** "£150", when an open bounty rewards it. */
  reward: string | null;
  /** An open bounty to solve. */
  solvable: boolean;
}

export interface BreakageBodyView {
  rows: readonly BreakageRowView[];
  gaps: readonly OpenGapView[];
  onOpenReplay?: (ordinal: number) => void;
  onSolve?: (gapId: string) => void;
}

/** One breakage as a row: the written-up part's symptom and resolution, else the step's own line. */
export function breakageRow(entry: BreakageEntry, span: string | null): BreakageRowView {
  const payload = entry.node ? asPayload(entry.node.payload) : asPayload(entry.event?.payload);
  const attempts = payloadNumber(payload, "attempts");
  const lead = entry.event ? eventLead(entry.event)?.text ?? null : null;
  return {
    key: entry.key,
    name: (entry.title ?? "").trim() || "Untitled breakage",
    happened: payloadText(payload, "symptom") ?? (entry.node ? null : lead),
    fix: payloadText(payload, "resolution"),
    span,
    start: entry.start,
    attempts: typeof attempts === "number" && attempts > 0 ? plural(attempts, "attempt", "attempts") : null,
  };
}

/** Every recorded breakage, merged and in event order (collectBreakages), as rows. */
export function breakageRows(tree: NodeTree[], events: BuildEvent[], nodeTypes: NodeType[]): BreakageRowView[] {
  return collectBreakages(tree, events, nodeTypes).map((entry) => breakageRow(entry, spanLabel(entry)));
}

/**
 * Every gap still open, in record order. A gap an open bounty pays for carries
 * its reward and can be solved; one with no bounty is still a hole worth naming.
 */
export function openGaps(tree: readonly NodeTree[], bountyByNode: ReadonlyMap<string, BuildBounty>): OpenGapView[] {
  return collectGaps(tree).map((node) => {
    const entry = bountyByNode.get(node.id);
    const open = entry?.bounty.status === "open";
    return {
      id: node.id,
      title: (node.title ?? "").trim() || "Untitled part",
      problem: gapStatement(node) || null,
      reward: open ? rewardLabel(entry?.bounty.reward_gbp) : null,
      solvable: open,
    };
  });
}

/* ── Result ── */

/**
 * The date a piece of evidence carries: when the run was made (`run_at`), else
 * the step it was recorded at, else when the part was placed. "29 Sep".
 */
export function evidenceDate(node: Pick<BuildNode, "payload" | "event_id" | "created_at">, events: readonly BuildEvent[]): string | null {
  const ranAt = payloadText(node.payload, "run_at");
  if (ranAt && shortDate(ranAt)) return shortDate(ranAt);
  const linked = node.event_id ? events.find((event) => event.id === node.event_id) : undefined;
  return shortDate(linked?.occurred_at) ?? shortDate(node.created_at);
}

/* ── Rebuilds ── */

export interface RebuildsBodyView {
  cards: readonly CardView[];
  /** The cards are still being read. */
  loading: boolean;
  /** The family tree: `/b2/:slug/lineage`. */
  lineageTo: string;
}

/* ── Under the first screen ── */

/** One row of where next, as a panel of cards. */
export interface WhereNextRowView {
  key: string;
  heading: string;
  cards: readonly CardView[];
}
