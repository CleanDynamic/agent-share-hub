// The making stats: how many sessions, prompts, AI turns and which models a
// build was made with, kept on the build so readers can see them without ever
// being able to read import_sessions.
//
// COUNTS, CLIENT AND MODEL NAMES ONLY. Nothing from a conversation is read
// here or written; listBuildSessions returns summaries, never the proposal.
//
// THE COLUMNS ARE NEWER THAN THE GENERATED TYPES (session_count, prompt_count,
// ai_turn_count, models_used, making), so the patch is cast at the call site
// and the one extra read goes through a narrow cast, as provenance.ts does.

import { supabase } from "@/integrations/supabase/client";
import { normaliseHex } from "@/lib/theme/partColour";
import { TOOLS, toolFor, toolName } from "@/lib/tools/registry";
import { updateBuildInStep } from "./builds";
import { listBuildSessions, type SessionSummary } from "./sessions";
import { openOf, openRefusal, type OpenRequest } from "./openRequest";
import { extrasOf, extrasRefusal, type SessionExtras } from "./sessionFacts";
import { serial } from "./staleWrites";
import { buildLayerError, type BuildPatch } from "./types";

/** The order `TOOL_CLIENTS` lists the clients in. */
const CLIENT_ORDER = ["claude", "claude-code", "chatgpt", "cursor"];

/** The label a client adds to Made with. `web` and `unknown` name no tool. Built from the tool list's `client` entries. */
const TOOL_LABELS: Record<string, string> = Object.fromEntries(
  TOOLS.flatMap((tool) => (tool.client ? [[tool.client, tool.name] as const] : [])).sort(
    ([a], [b]) => CLIENT_ORDER.indexOf(a) - CLIENT_ORDER.indexOf(b),
  ),
);

/** The clients `toolLabel` knows, in order: what a prompt written by hand can name as its tool (DATA §2). */
export const TOOL_CLIENTS: readonly { client: string; label: string }[] = Object.entries(TOOL_LABELS).map(([client, label]) => ({ client, label }));

/** The tool a client adds to Made with, or null for one that names none (web, unknown). */
export function toolLabel(client: string | null | undefined): string | null {
  return client ? (TOOL_LABELS[client] ?? null) : null;
}

export interface MakingSession {
  /** The import session's id and its created_at. Absent on entries written before UI-P62. */
  id?: string;
  started_at?: string;
  client: string | null;
  model: string | null;
  prompts: number;
  turns: number;
}

/**
 * CA-04 P1: what a session carries beyond its steps. A session made in the composer is keyed `typed-<uuid>` and has
 * its tool and its day here; an imported one is keyed by its `import_sessions` id and keeps its own tool and day, so
 * its entry carries only what the maker adds to it (P6's goal).
 */
export interface SessionMeta extends SessionExtras {
  /** A tool id or a typed name; null for a session typed here with no tool. */
  tool: string | null;
  model?: string | null;
  /** "2026-10-20"; "" on an imported session's entry, whose day is its own. */
  date: string;
  goal?: unknown;
  runs?: unknown;
  /** CA-06 P4: the maker's colour for the session, "#RRGGBB". Absent when it has none. */
  colour?: string;
  /** CA-14 P1: the maker's title for the session, 1 to 80 characters, trimmed. Absent when it has none. */
  title?: string;
  /** CA-17 P1: the key of the session's part (a `Workstream`). Absent, or a key not in `making.workstreams`: the first part. */
  workstream?: string;
  /** CA-17 P1: in the same stage as the session above it in its part. */
  withAbove?: boolean;
  /** SV-16: the profile id of the person whose session this is, when not the build's maker. Absent: the maker. */
  contributor_id?: string;
  /** SV-21: the maker opened this session as a request. Filed when the build is published. */
  open?: OpenRequest;
}

/** CA-14 P1: the longest session title. */
export const SESSION_TITLE_MAX = 80;

/** A session title as it is kept: trimmed, empty as none. Anything longer than the limit is left for `sessionMetaRefusal`. */
export const cleanSessionTitle = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

/** CA-04 P6: what a session worked until. Stored in `making.sessions_meta[key].goal`. */
export interface SessionGoal {
  /** The condition, up to 200 characters, as written. */
  condition: string;
  /** At most this many turns, 1 to 500. */
  atMost?: number;
  /** Was it reached? */
  reached?: "reached" | "limit" | "me";
  /** How many turns it took, when it was reached. */
  turns?: number;
  /** SV-30 P2: a metric, where it started and the value to reach. */
  target?: GoalTarget;
}

/** SV-30 P2: a stopping condition with a measure. `source` says whether the achieved value was read from the run or given by the maker. */
export interface GoalTarget {
  metric: string;
  unit?: string;
  baseline: number;
  target: number;
  achieved?: number;
  source: "run" | "maker";
}

export const TARGET_METRIC_MAX = 40;
export const TARGET_UNIT_MAX = 12;

export const GOAL_CONDITION_MAX = 200;
export const GOAL_TURNS_MIN = 1;
export const GOAL_TURNS_MAX = 500;
const GOAL_REACHED = ["reached", "limit", "me"] as const;

const turnsOf = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isInteger(value) && value >= GOAL_TURNS_MIN && value <= GOAL_TURNS_MAX ? value : undefined;

/** A stored goal, read defensively; null when there is no condition. */
export function goalOf(value: unknown): SessionGoal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const condition = typeof raw.condition === "string" ? raw.condition.trim() : "";
  if (!condition) return null;
  const goal: SessionGoal = { condition: condition.slice(0, GOAL_CONDITION_MAX) };
  const atMost = turnsOf(raw.atMost);
  if (atMost) goal.atMost = atMost;
  if (GOAL_REACHED.includes(raw.reached as SessionGoal["reached"] & string)) goal.reached = raw.reached as SessionGoal["reached"];
  const turns = turnsOf(raw.turns);
  if (turns && goal.reached === "reached") goal.turns = turns;
  const target = targetOf(raw.target);
  if (target) goal.target = target;
  return goal;
}

const finiteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** A stored target, read defensively; null when it is not whole (a metric, a baseline and a target value). */
export function targetOf(value: unknown): GoalTarget | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const metric = typeof raw.metric === "string" ? raw.metric.trim().slice(0, TARGET_METRIC_MAX) : "";
  if (!metric || !finiteNumber(raw.baseline) || !finiteNumber(raw.target)) return null;
  const unit = typeof raw.unit === "string" ? raw.unit.trim().slice(0, TARGET_UNIT_MAX) : "";
  return {
    metric,
    ...(unit ? { unit } : null),
    baseline: raw.baseline,
    target: raw.target,
    ...(finiteNumber(raw.achieved) ? { achieved: raw.achieved } : null),
    source: raw.source === "run" ? "run" : "maker",
  };
}

/** "2x", "120 ms", "95%": a value with its unit; `x` and `%` sit against the number. */
export function withUnit(value: number, unit?: string): string {
  const said = String(Math.round(value * 1000) / 1000);
  if (!unit) return said;
  return unit === "x" || unit === "%" ? `${said}${unit}` : `${said} ${unit}`;
}

/** Why a goal cannot be saved, or null. */
export function goalRefusal(goal: SessionGoal): string | null {
  const condition = goal.condition.trim();
  if (!condition) return "Say what it worked until.";
  if (condition.length > GOAL_CONDITION_MAX) return `Condition: ${GOAL_CONDITION_MAX} characters max`;
  for (const n of [goal.atMost, goal.turns]) {
    if (n !== undefined && turnsOf(n) === undefined) return `Turns: whole number, ${GOAL_TURNS_MIN} to ${GOAL_TURNS_MAX}`;
  }
  const target = goal.target;
  if (target) {
    if (!target.metric.trim()) return "Say what is measured.";
    if (target.metric.trim().length > TARGET_METRIC_MAX) return `Metric: ${TARGET_METRIC_MAX} characters max`;
    if ((target.unit ?? "").trim().length > TARGET_UNIT_MAX) return `Unit: ${TARGET_UNIT_MAX} characters max`;
    if (!finiteNumber(target.baseline) || !finiteNumber(target.target)) return "Baseline and target are numbers.";
    if (target.achieved !== undefined && !finiteNumber(target.achieved)) return "What it reached is a number.";
    if (target.source !== "run" && target.source !== "maker") return "The figure is from the run or the maker.";
  }
  return null;
}

/** "Worked until the tests pass · at most 40 turns · reached in 12", with the parts that exist. */
export function goalLine(goal: SessionGoal): string {
  const target = goal.target;
  const parts = [target ? `Worked until ${target.metric} ${withUnit(target.target, target.unit)}` : `Worked until ${goal.condition}`];
  if (target) {
    parts.push(`baseline ${withUnit(target.baseline, target.unit)}`);
    if (target.achieved !== undefined) parts.push(`reached ${withUnit(target.achieved, target.unit)}`);
  }
  if (goal.atMost) parts.push(`at most ${goal.atMost} ${goal.atMost === 1 ? "turn" : "turns"}`);
  if (goal.reached === "reached" && goal.turns) parts.push(`reached in ${goal.turns}`);
  return parts.join(" · ");
}

/** builds.making. `excluded_models` is the maker's to change (UI-P48); so is `session_tools` (TF-13), and so is `sessions_meta` (CA-04). */
export interface Making {
  sessions: MakingSession[];
  excluded_models: string[];
  /** Import session id to the tool the maker gave a session whose client names none: a tool id or a typed name. */
  session_tools?: Record<string, string>;
  /** CA-04 P1: a session's key to what it carries. */
  sessions_meta?: Record<string, SessionMeta>;
  /** CA-14 P1: the sessions' keys in the maker's order. Kept beside `build_sessions.position` so a draft without that table still has an order. */
  session_order?: string[];
  /** CA-14 P1: the keys of the sessions the maker has folded. Kept beside `build_sessions.collapsed`. */
  sessions_collapsed?: string[];
  /** CA-17 P1: the build's parts, in the maker's order. Absent or empty: one part, and nothing about parts is drawn. */
  workstreams?: Workstream[];
  /** CA-17 P1: how parts are labelled, for the whole build. Absent: numbers. */
  part_labels?: PartLabels;
  /** CA-17 P1: the map of sessions. Absent: see `mapOf`. */
  map?: MapSettings;
}

/**
 * CA-17 P1: a part of a build, a group of sessions. On screen it is a "Part"; in code it is a workstream, because "part"
 * already means a tile or a session here (`postRefs.ts`, `partColour.ts`, `usePartRef`).
 */
export interface Workstream {
  /** `ws-<uuid>`. */
  key: string;
  /** 1 to 60 characters, trimmed. */
  name?: string;
  /** The maker's colour, "#RRGGBB". */
  colour?: string;
  /** The key of a session of another part: this part begins after it. */
  startsAfter?: string;
  collapsed?: boolean;
  /** SV-21: the maker opened this part as a request. Filed when the build is published. */
  open?: OpenRequest;
}

export const WORKSTREAM_PREFIX = "ws-";
export const WORKSTREAM_NAME_MAX = 60;
/** Letters stop at Z. */
export const WORKSTREAM_MAX = 26;

export type PartLabels = "letters" | "numbers";

/** CA-17 P1: the map of sessions, kept on the build. */
export interface MapSettings {
  on: boolean;
  direction: "horizontal" | "vertical";
  /** Readers see the map only when this is true. */
  onBuildPage: boolean;
  /** SV-27 P10: Sessions (the default) or Architecture; absent reads as the default the build's shape gives. */
  view?: MapView;
}

/** SV-27 P10: what the Map draws. */
export type MapView = "sessions" | "architecture";

/** A new part's key. */
export function newWorkstreamKey(): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  return `${WORKSTREAM_PREFIX}${uuid}`;
}

/** A part's name as it is kept: trimmed, empty as none. Anything longer than the limit is left for `workstreamsRefusal`. */
export const cleanWorkstreamName = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

/**
 * `making.workstreams`, read defensively: an entry with no key, a repeated key, or past the 26th is skipped; a name
 * longer than the limit is cut; a colour that is not one is left off; any other key is ignored (never removed from storage).
 */
export function storedWorkstreamsOf(making: unknown): Workstream[] {
  const raw = asObject(making).workstreams;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Workstream[] = [];
  for (const value of raw) {
    if (out.length >= WORKSTREAM_MAX) break;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const entry = value as Record<string, unknown>;
    const key = typeof entry.key === "string" ? entry.key.trim() : "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const part: Workstream = { key };
    const name = cleanWorkstreamName(entry.name);
    if (name) part.name = name.slice(0, WORKSTREAM_NAME_MAX);
    const colour = normaliseHex(entry.colour);
    if (colour) part.colour = colour;
    if (typeof entry.startsAfter === "string" && entry.startsAfter.trim()) part.startsAfter = entry.startsAfter.trim();
    if (entry.collapsed === true) part.collapsed = true;
    const open = openOf(entry.open);
    if (open) part.open = open;
    out.push(part);
  }
  return out;
}

/** Why a list of parts cannot be saved, or null. Pure, so the composer can say no first. */
export function workstreamsRefusal(list: readonly Workstream[]): string | null {
  if (list.length > WORKSTREAM_MAX) return `Parts: ${WORKSTREAM_MAX} max`;
  const keys = new Set<string>();
  for (const part of list) {
    if (!part.key) return "That part is not saved yet.";
    if (keys.has(part.key)) return "Two parts have the same key.";
    keys.add(part.key);
    if (part.name !== undefined && part.name.trim().length > WORKSTREAM_NAME_MAX) return `Part name: ${WORKSTREAM_NAME_MAX} characters max`;
    if (part.colour !== undefined && !normaliseHex(part.colour)) return "A colour is written like #7FA7D9.";
    const open = openRefusal(part.open);
    if (open) return open;
  }
  return null;
}

/** `making.part_labels`: "letters" or "numbers"; anything else, or nothing, is numbers. */
export function partLabelsOf(making: unknown): PartLabels {
  return asObject(making).part_labels === "letters" ? "letters" : "numbers";
}

/** `making.map`, read defensively; null when there is none (or it does not read), which `mapOf`'s callers treat by who is looking. */
export function mapOf(making: unknown): MapSettings | null {
  const raw = asObject(asObject(making).map);
  if (typeof raw.on !== "boolean") return null;
  return {
    on: raw.on,
    direction: raw.direction === "vertical" ? "vertical" : "horizontal",
    onBuildPage: raw.onBuildPage === true,
    ...(raw.view === "sessions" || raw.view === "architecture" ? { view: raw.view } : null),
  };
}

/**
 * SV-27 P10: the view the Map opens on: the stored one, else Architecture for a build with deployment tiles and one session,
 * else Sessions.
 */
export function mapViewOf(making: unknown, hasDeployment: boolean, sessions: number): MapView {
  const stored = mapOf(making)?.view;
  if (stored) return stored;
  return hasDeployment && sessions <= 1 ? "architecture" : "sessions";
}

/** Whether `making` has a `map` key at all, whatever it holds. A build that predates the map has none. */
export const hasMapKey = (making: unknown): boolean => Object.prototype.hasOwnProperty.call(asObject(making), "map");

/**
 * The map as its maker sees it. Stored settings are used as they are. A published build whose `making` has no `map` key
 * predates the map: its maker sees it as created, with "Show on build page" ticked, and nothing is written to it. A draft
 * with none has no map yet (null): "Create a map" makes one.
 */
export function makerMapOf(making: unknown, published: boolean): MapSettings | null {
  const stored = mapOf(making);
  if (stored) return stored;
  return published && !hasMapKey(making) ? { on: true, direction: "horizontal", onBuildPage: true } : null;
}

/** Whether readers see the map: only when it is on and on the build page. A build with no `map` key keeps showing it, as it always did. */
export function readerSeesMap(making: unknown): boolean {
  if (!hasMapKey(making)) return true;
  const stored = mapOf(making);
  return Boolean(stored?.on && stored.onBuildPage);
}

/** The direction readers see: the maker's, horizontal when none is stored. */
export const readerMapDirection = (making: unknown): MapSettings["direction"] => mapOf(making)?.direction ?? "horizontal";

/** Why the map settings cannot be saved, or null. */
export function mapRefusal(map: MapSettings): string | null {
  if (typeof map.on !== "boolean" || typeof map.onBuildPage !== "boolean") return "The map settings are on or off.";
  if (map.direction !== "horizontal" && map.direction !== "vertical") return "The map runs horizontally or vertically.";
  if (map.view !== undefined && map.view !== "sessions" && map.view !== "architecture") return "The map shows sessions or the architecture.";
  return null;
}

/** The key of a session made in the composer starts with this. */
export const TYPED_SESSION_PREFIX = "typed-";
/** An old build's prompts typed by hand, read as one session per unbroken run, are keyed with this and a number. Never stored. */
export const LEGACY_SESSION_PREFIX = "typed-legacy-";

export const isLegacySession = (key: string | null | undefined): boolean => Boolean(key?.startsWith(LEGACY_SESSION_PREFIX));
/** A session made in the composer and saved: its key is stable. */
export const isTypedSession = (key: string | null | undefined): boolean => Boolean(key?.startsWith(TYPED_SESSION_PREFIX)) && !isLegacySession(key);

/** A new session's key. */
export function newSessionKey(): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  return `${TYPED_SESSION_PREFIX}${uuid}`;
}

/** Today, as a session's day is saved. */
export const todayDay = (now: Date = new Date()): string => now.toISOString().slice(0, 10);

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** builds.making.sessions_meta, read defensively: entries without a day are skipped, and only the known keys are kept. */
export function sessionsMetaOf(making: unknown): Record<string, SessionMeta> {
  const raw = asObject(asObject(making).sessions_meta);
  const out: Record<string, SessionMeta> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const entry = asObject(value);
    const date = typeof entry.date === "string" && ISO_DAY.test(entry.date) ? entry.date : "";
    // A session made here has a day; an imported one keeps its own, and its entry may have none.
    if (!date && isTypedSession(key)) continue;
    const tool = typeof entry.tool === "string" && entry.tool.trim() ? entry.tool.trim() : null;
    const meta: SessionMeta = { tool, date };
    if (typeof entry.model === "string" && entry.model.trim()) meta.model = entry.model.trim();
    if (entry.goal !== undefined) meta.goal = entry.goal;
    if (entry.runs !== undefined) meta.runs = entry.runs;
    // CA-06 P4: kept only as a colour reads; anything else is left where it is, never shown.
    const colour = normaliseHex(entry.colour);
    if (colour) meta.colour = colour;
    // CA-14 P1: a title longer than the limit (written by hand) is cut when read, never shown whole.
    const title = cleanSessionTitle(entry.title);
    if (title) meta.title = title.slice(0, SESSION_TITLE_MAX);
    // CA-17 P1: the part it is in and whether it shares the stage above; read as they are, resolved where they are used.
    if (typeof entry.workstream === "string" && entry.workstream.trim()) meta.workstream = entry.workstream.trim();
    if (entry.withAbove === true) meta.withAbove = true;
    // SV-16: kept only as a uuid; anything else is left where it is, never shown.
    if (typeof entry.contributor_id === "string" && UUID.test(entry.contributor_id)) meta.contributor_id = entry.contributor_id;
    // SV-21: read as written, so a write of any other fact of the session keeps it.
    const open = openOf(entry.open);
    if (open) meta.open = open;
    // CA-05: cost, tokens, background, started with, at the same time as, own copy.
    Object.assign(meta, extrasOf(entry));
    out[key] = meta;
  }
  return out;
}

interface MakingRow {
  made_with: string[] | null;
  making: unknown;
}

interface BuildsMakingTable {
  select: (columns: string) => {
    eq: (
      column: string,
      value: string,
    ) => { maybeSingle: () => PromiseLike<{ data: MakingRow | null; error: unknown }> };
  };
}

function buildsMaking(): BuildsMakingTable {
  return (supabase as unknown as { from: (table: string) => BuildsMakingTable }).from("builds");
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function excludedModels(making: unknown): string[] {
  if (!making || typeof making !== "object" || Array.isArray(making)) return [];
  return asStrings((making as { excluded_models?: unknown }).excluded_models);
}

/** builds.making.session_tools, read defensively: it is a json column the maker can write. */
export function sessionToolsOf(making: unknown): Record<string, string> {
  const raw = asObject(asObject(making).session_tools);
  const out: Record<string, string> = {};
  for (const [id, tool] of Object.entries(raw)) if (typeof tool === "string" && tool.trim()) out[id] = tool.trim();
  return out;
}

function has(list: string[], value: string): boolean {
  const wanted = value.toLowerCase();
  return list.some((entry) => entry.toLowerCase() === wanted);
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * Recompute a build's making stats from its sessions and write them.
 *
 * `made_with` only ever grows here: a tool label or model name is added if it
 * is missing (a model not at all when the maker excluded it), and nothing is
 * removed — unticking under Made with does that.
 *
 * Never throws after the read. By then the session is already attached or its
 * model saved, and the stats are a summary of that; a failure is logged with a
 * code and the build id, never with a value, and the next refresh repairs it.
 */
export async function refreshMakingStats(buildId: string): Promise<void> {
  const sessions: SessionSummary[] = await listBuildSessions(buildId);

  try {
    // SV-07 P1: read and written in one step of the build's write queue, so a save made meanwhile is not written over.
    const making = await serial(buildId, async () => {
      const { data, error } = await buildsMaking()
        .select("made_with, making")
        .eq("id", buildId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("build not readable");

      const excluded = excludedModels(data.making);
      const isExcluded = (name: string) => has(excluded, name);

      const modelsUsed: string[] = [];
      const madeWith = asStrings(data.made_with);

      for (const session of sessions) {
        const tool = session.client ? TOOL_LABELS[session.client] : undefined;
        if (tool && !has(madeWith, tool)) madeWith.push(tool);

        const model = session.modelName;
        if (model && !isExcluded(model)) {
          if (!has(modelsUsed, model)) modelsUsed.push(model);
          if (!has(madeWith, model)) madeWith.push(model);
        }
      }

      const making: Making = {
        // Keys this function does not own (session_tools) are kept as they are.
        ...asObject(data.making),
        sessions: sessions.map((session) => ({
          id: session.id,
          started_at: session.createdAt,
          client: session.client,
          model: session.modelName,
          prompts: session.promptCount,
          turns: session.turnCount,
        })),
        excluded_models: excluded,
      };

      await updateBuildInStep(buildId, {
        // SV-23 P1: session_count is written with the other stored counts (`buildCountsWrite`), which count the sessions the composer shows.
        prompt_count: sessions.reduce((sum, session) => sum + session.promptCount, 0),
        ai_turn_count: sessions.reduce((sum, session) => sum + session.turnCount, 0),
        models_used: modelsUsed,
        making,
        made_with: madeWith,
      } as unknown as BuildPatch);
      return making;
    });
    // CA-13 P11: the patterns the build uses follow it. A failure here never fails the save that called this.
    void import("./patternsWrite").then((module) => module.refreshPatterns(buildId, making)).catch(() => undefined);
    // SV-23 P1: the stored counts follow it the same way, counted with the composer's own functions, so a session added away from the
    // composer (an offer accepted on OpenBuilds, Drafts, the upload page) updates them too.
    void import("./buildCountsWrite").then((module) => module.refreshStoredCounts(buildId, making)).catch(() => undefined);
  } catch (error) {
    // eslint-disable-next-line no-console -- a deliberate, structured log that its tests assert (SV-26)
    console.warn("[refreshMakingStats] making stats not written", {
      code: errorCode(error),
      buildId,
    });
  }
}

// -----------------------------------------------------------------------------
// Made with, as the composer changes it (UI-P48)
// -----------------------------------------------------------------------------

/** What Made with holds, and the models the maker left out of it. */
export interface MadeWithState {
  madeWith: string[];
  excluded: string[];
}

/** Whether a Made with change is a session's model or an entry typed by hand. */
export type MadeWithKind = "model" | "entry";

async function readMadeWith(operation: string, buildId: string): Promise<{ state: MadeWithState; making: unknown }> {
  const { data, error } = await buildsMaking().select("made_with, making").eq("id", buildId).maybeSingle();
  if (error) throw buildLayerError(operation, error);
  if (!data) throw buildLayerError(operation, new Error("That build is no longer available."));
  return { state: { madeWith: asStrings(data.made_with), excluded: excludedModels(data.making) }, making: data.making };
}

/** What a step of `makingStep` writes (null: nothing) and what it resolves with. */
export interface MakingWrite<T> {
  patch: BuildPatch | null;
  result: T;
}

/**
 * SV-07 P1: read `made_with` and `making`, change them and write them in ONE step of the build's write queue (`serial`), so two
 * saves close together can't both start from the same old copy and the second write the first away. `change` sees the build as
 * it stands at the start of the step and changes only its own path of it.
 */
export function makingStep<T>(
  buildId: string,
  operation: string,
  change: (now: { making: Record<string, unknown>; state: MadeWithState }) => MakingWrite<T> | Promise<MakingWrite<T>>,
): Promise<T> {
  return serial(buildId, async () => {
    const { state, making } = await readMadeWith(operation, buildId);
    const { patch, result } = await change({ making: asObject(making), state });
    if (patch) await updateBuildInStep(buildId, patch);
    return result;
  });
}

/** builds.made_with and builds.making.excluded_models, as the composer's Made with line reads them. */
export async function getMadeWith(buildId: string): Promise<MadeWithState> {
  return (await readMadeWith("getMadeWith", buildId)).state;
}

/**
 * Tick or untick one name. Pure.
 *
 * A MODEL unticked goes into `excluded_models` and out of `made_with`; ticked,
 * the reverse, so the next refresh adds it again. An ENTRY typed by hand has no
 * exclusion to remember: unticked it leaves `made_with`, ticked it comes back.
 * Matching ignores case, as refreshMakingStats does, and order is kept.
 */
export function nextMadeWith(state: MadeWithState, name: string, on: boolean, kind: MadeWithKind): MadeWithState {
  const value = name.trim();
  if (!value) return state;
  const without = (list: string[]) => list.filter((entry) => entry.toLowerCase() !== value.toLowerCase());
  const withIt = (list: string[]) => (has(list, value) ? list : [...list, value]);
  return {
    madeWith: on ? withIt(state.madeWith) : without(state.madeWith),
    excluded: kind === "entry" ? state.excluded : on ? without(state.excluded) : withIt(state.excluded),
  };
}

/**
 * Leave a session's model out of Made with, or put it back, then refresh the
 * stats, which leave an excluded model out of `models_used` (UI-P43d).
 * Resolves with Made with as it stands afterwards, tool labels the refresh
 * added included.
 */
export async function setMadeWithModel(buildId: string, model: string, on: boolean): Promise<MadeWithState> {
  await makingStep(buildId, "setMadeWithModel", ({ state, making }) => {
    const next = nextMadeWith(state, model, on, "model");
    return { patch: { made_with: next.madeWith, making: { ...making, excluded_models: next.excluded } } as unknown as BuildPatch, result: next };
  });
  // The choice is written; the stats only summarise it, and the next refresh repairs them.
  // eslint-disable-next-line no-console -- a deliberate, structured log that its tests assert (SV-26)
  await refreshMakingStats(buildId).catch(() => console.warn("[setMadeWithModel] making stats not refreshed", { buildId }));
  return getMadeWith(buildId);
}

/**
 * Made with plus each name it lacks, in the order given. Pure. Matching ignores
 * case and the list's own order is kept. Nothing is ever removed. The same list
 * comes back when nothing is missing.
 */
export function withTools(madeWith: readonly string[], names: readonly string[]): string[] {
  const out = [...madeWith];
  for (const raw of names) {
    const name = raw.trim();
    if (name && !has(out, name)) out.push(name);
  }
  return out.length === madeWith.length ? (madeWith as string[]) : out;
}

/**
 * Put the tools a step names into Made with. One read, and one write only when
 * something was added. Like refreshMakingStats it only ever grows `made_with`:
 * unticking under Made with is still the only way out. Resolves with Made with
 * as it stands.
 */
export function addMadeWithTools(buildId: string, names: readonly string[]): Promise<MadeWithState> {
  return makingStep(buildId, "addMadeWithTools", ({ state }) => {
    const madeWith = withTools(state.madeWith, names);
    if (madeWith === state.madeWith) return { patch: null, result: state };
    return { patch: { made_with: madeWith }, result: { madeWith, excluded: state.excluded } };
  });
}

/**
 * Add a tool or model typed by hand to Made with, or take one out. `made_with` only.
 * A name the tool list knows is saved as that tool's name ("lovable.dev" as
 * "Lovable"), so its chip draws the tool's logo. Taking one out uses the name
 * as the chip shows it, so an entry saved before this still goes.
 */
export function setMadeWithEntry(buildId: string, entry: string, on: boolean): Promise<MadeWithState> {
  return makingStep(buildId, "setMadeWithEntry", ({ state }) => {
    const next = nextMadeWith(state, on ? (toolName(entry) ?? entry) : entry, on, "entry");
    const unchanged = next.madeWith.length === state.madeWith.length && next.madeWith.every((name, i) => name === state.madeWith[i]);
    return unchanged ? { patch: null, result: state } : { patch: { made_with: next.madeWith }, result: next };
  });
}

/** The longest tool name a maker can type for a session (the tool picker's own limit). */
export const SESSION_TOOL_MAX = 40;

/**
 * Give a session whose client names no tool its tool, or take it back (null).
 * `tool` is a tool id or a name typed by hand. Only `making.session_tools` is
 * written, never `import_sessions.client`, and the rest of `making` is kept.
 * The tool's name then joins Made with. Refuses a session that is not in this
 * build. Resolves with Made with as it stands.
 */
export async function setSessionTool(buildId: string, sessionId: string, tool: string | null): Promise<MadeWithState> {
  const value = tool?.trim() || null;
  if (value && value.length > SESSION_TOOL_MAX) {
    throw buildLayerError("setSessionTool", new Error(`Tool name: ${SESSION_TOOL_MAX} characters max`));
  }
  const inBuild = (await listBuildSessions(buildId)).some((session) => session.id === sessionId);
  if (!inBuild) throw buildLayerError("setSessionTool", new Error("That session is not in this build."));

  const state = await makingStep(buildId, "setSessionTool", ({ state, making }) => {
    const tools = { ...sessionToolsOf(making) };
    if (value) tools[sessionId] = value;
    else delete tools[sessionId];
    return { patch: { making: { ...making, session_tools: tools } } as unknown as BuildPatch, result: state };
  });
  return value ? addMadeWithTools(buildId, [toolName(value) ?? value]) : state;
}

/**
 * CA-04 P1: what a session carries, checked. A session made here needs its day; its tool, when given, is a tool id
 * or a typed name of at most 40 characters, and is kept as `toolFor` knows it. Pure, so the composer can say no first.
 */
export function sessionMetaRefusal(key: string, meta: SessionMeta): string | null {
  if (!key || isLegacySession(key)) return "That session is not saved yet.";
  if (isTypedSession(key) && !ISO_DAY.test(meta.date)) return "A session's day is written as 2026-10-12.";
  if (meta.date && !ISO_DAY.test(meta.date)) return "A session's day is written as 2026-10-12.";
  if (meta.tool && meta.tool.trim().length > SESSION_TOOL_MAX) return `Tool name: ${SESSION_TOOL_MAX} characters max`;
  if (meta.title !== undefined && meta.title.trim().length > SESSION_TITLE_MAX) return `Session title: ${SESSION_TITLE_MAX} characters max`;
  if (meta.workstream !== undefined && (typeof meta.workstream !== "string" || !meta.workstream.trim())) return "A session's part is a part of this build.";
  if (meta.withAbove !== undefined && typeof meta.withAbove !== "boolean") return "Same stage as the session above is on or off.";
  if (meta.contributor_id !== undefined && !UUID.test(meta.contributor_id)) return "A session's contributor is a person.";
  const open = openRefusal(meta.open);
  if (open) return open;
  return extrasRefusal(meta);
}

/**
 * Write what one session carries (`making.sessions_meta[key]`), or take it away (null). Only that key changes; the
 * rest of `making` is kept as it is. A named tool joins Made with, as a session's tool does. Resolves with the
 * session's entries as they stand. SV-07 P1: a change to the entry is given as a function of the entry as it is stored
 * when the write's step starts, so a part or a fact saved meanwhile is never put back as the page last saw it.
 */
export async function setSessionMeta(
  buildId: string,
  key: string,
  meta: SessionMeta | null | ((current: SessionMeta | undefined) => SessionMeta | null),
): Promise<Record<string, SessionMeta>> {
  const refuse = (value: SessionMeta | null) => {
    if (value) {
      const why = sessionMetaRefusal(key, value);
      if (why) throw buildLayerError("setSessionMeta", new Error(why));
    } else if (!key) throw buildLayerError("setSessionMeta", new Error("That session is not saved yet."));
  };
  if (typeof meta !== "function") refuse(meta);
  // Only this session's entry changes, on `making` as it stands when the step starts.
  let written: SessionMeta | null = null;
  const entries = await makingStep(buildId, "setSessionMeta", ({ making }) => {
    const entries = { ...sessionsMetaOf(making) };
    const value = typeof meta === "function" ? meta(entries[key]) : meta;
    if (typeof meta === "function") refuse(value);
    written = value;
    if (value) {
      const tool = value.tool?.trim() || null;
      const { title: _title, ...rest } = value;
      const title = cleanSessionTitle(value.title);
      entries[key] = { ...rest, tool: tool ? (toolFor(tool)?.id ?? tool) : null, ...(title ? { title } : null) };
    } else delete entries[key];
    return { patch: { making: { ...making, sessions_meta: entries } } as unknown as BuildPatch, result: entries };
  });
  const tool = (written as SessionMeta | null)?.tool?.trim();
  // eslint-disable-next-line no-console -- a deliberate, structured log that its tests assert (SV-26)
  if (tool) await addMadeWithTools(buildId, [toolName(tool) ?? tool]).catch(() => console.warn("[setSessionMeta] Made with not updated", { buildId }));
  return entries;
}

/** CA-14 P1: `making.session_order`, read defensively: the keys that are strings, once each. */
export function sessionOrderOf(making: unknown): string[] {
  return [...new Set(asStrings(asObject(making).session_order))];
}

/** CA-14 P1: `making.sessions_collapsed`, read defensively. */
export function sessionsCollapsedOf(making: unknown): string[] {
  return [...new Set(asStrings(asObject(making).sessions_collapsed))];
}

/** CA-14 P1: the draft's `making`, as it stands. */
export async function readMaking(buildId: string): Promise<unknown> {
  return (await readMadeWith("readMaking", buildId)).making;
}

/**
 * CA-14 P1: change some keys of `making` and keep the rest as it is. Resolves with the whole `making` as written. SV-07 P1: a
 * patch worked out from `making` is given as a function of it, so it is worked out from `making` as it stands inside the step;
 * a function that answers null writes nothing.
 */
export function patchMaking(
  buildId: string,
  patch: Record<string, unknown> | ((making: Record<string, unknown>) => Record<string, unknown> | null),
): Promise<Record<string, unknown>> {
  return makingStep(buildId, "patchMaking", ({ making }) => {
    const change = typeof patch === "function" ? patch(making) : patch;
    if (!change) return { patch: null, result: making };
    const next = { ...making, ...change };
    return { patch: { making: next } as unknown as BuildPatch, result: next };
  });
}

/**
 * CA-17 P1: save the build's parts (all of them, in order). Refused with a plain message when they do not read. SV-07 P1: a
 * change to the parts as they are stored is given as a function of them, and made on them as they stand inside the step.
 */
export async function setWorkstreams(buildId: string, list: readonly Workstream[] | ((stored: Workstream[]) => readonly Workstream[])): Promise<Record<string, unknown>> {
  return patchMaking(buildId, (making) => {
    const next = typeof list === "function" ? list(storedWorkstreamsOf(making)) : list;
    const why = workstreamsRefusal(next);
    if (why) throw buildLayerError("setWorkstreams", new Error(why));
    return { workstreams: next.map((part) => ({ ...part })) };
  });
}

/**
 * SV-21 P3: open a session as a request with a problem, or take the request away (null). One session's entry changes, as
 * `setSessionMeta` does it, on the entry as stored when the step starts. A session with no entry yet gets one that holds only
 * the request.
 */
export function setSessionOpen(buildId: string, key: string, open: OpenRequest | null): Promise<Record<string, SessionMeta>> {
  return setSessionMeta(buildId, key, (current) => {
    const { open: _was, ...rest } = current ?? { tool: null, date: "" };
    return open ? { ...rest, open: { problem: open.problem.trim() } } : current ? rest : null;
  });
}

/** SV-21 P3: open a part as a request with a problem, or take the request away (null). Only that part changes. */
export function setPartOpen(buildId: string, partKey: string, open: OpenRequest | null): Promise<Record<string, unknown>> {
  return setWorkstreams(buildId, (stored) =>
    stored.map((part) => {
      if (part.key !== partKey) return part;
      const { open: _was, ...rest } = part;
      return open ? { ...rest, open: { problem: open.problem.trim() } } : rest;
    }),
  );
}

/** CA-17 P1: number or letter the parts, for the whole build. */
export async function setPartLabels(buildId: string, labels: PartLabels): Promise<Record<string, unknown>> {
  return patchMaking(buildId, { part_labels: labels });
}

/** CA-17 P1: save the map's settings. */
export async function setMapSettings(buildId: string, map: MapSettings): Promise<Record<string, unknown>> {
  const why = mapRefusal(map);
  if (why) throw buildLayerError("setMapSettings", new Error(why));
  return patchMaking(buildId, (making) => {
    // SV-27 P10: a change that does not say the view keeps the stored one.
    const view = map.view ?? mapOf(making)?.view;
    return { map: { on: map.on, direction: map.direction, onBuildPage: map.onBuildPage, ...(view ? { view } : null) } };
  });
}

/** A code for the log, and only a code. */
function errorCode(error: unknown): string {
  if (error && typeof error === "object") {
    const { code } = error as { code?: unknown };
    if (typeof code === "string" && code.length > 0) return code;
  }
  return "unknown";
}
