/* UI-P29 — the Build page's view model: the shapes `BuildView` takes, and the
   pure functions that build them from what the data layer returns.

   NOTHING HERE FETCHES. `BuildPage` loads, these map, `BuildView` draws; the dev
   compare page builds the same shapes from the sample data. */

import type { ReactNode } from "react";

import type { PartViewerMode } from "@/components/brand/PartViewer";
import type { PlaqueBuild } from "@/components/brand/Plaque";
import type { TimelineEvent } from "@/components/brand/Timeline";
import { eventLead } from "@/components/build/eventDisplay";
import type { BuildEvent, BuildNode, ChangeLine, EventKind, NodeTree, NodeType } from "@/lib/build";
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
