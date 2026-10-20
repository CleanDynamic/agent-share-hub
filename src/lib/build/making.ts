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
import { TOOLS, toolFor, toolName } from "@/lib/tools/registry";
import { updateBuild } from "./builds";
import { listBuildSessions, type SessionSummary } from "./sessions";
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
export interface SessionMeta {
  /** A tool id or a typed name; null for a session typed here with no tool. */
  tool: string | null;
  model?: string | null;
  /** "2026-10-20"; "" on an imported session's entry, whose day is its own. */
  date: string;
  goal?: unknown;
  runs?: unknown;
}

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
}

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
  return goal;
}

/** Why a goal cannot be saved, or null. */
export function goalRefusal(goal: SessionGoal): string | null {
  const condition = goal.condition.trim();
  if (!condition) return "Say what it worked until.";
  if (condition.length > GOAL_CONDITION_MAX) return `The condition is at most ${GOAL_CONDITION_MAX} characters.`;
  for (const n of [goal.atMost, goal.turns]) {
    if (n !== undefined && turnsOf(n) === undefined) return `Turns are whole numbers from ${GOAL_TURNS_MIN} to ${GOAL_TURNS_MAX}.`;
  }
  return null;
}

/** "Worked until the tests pass · at most 40 turns · reached in 12", with the parts that exist. */
export function goalLine(goal: SessionGoal): string {
  const parts = [`Worked until ${goal.condition}`];
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

    await updateBuild(buildId, {
      session_count: sessions.length,
      prompt_count: sessions.reduce((sum, session) => sum + session.promptCount, 0),
      ai_turn_count: sessions.reduce((sum, session) => sum + session.turnCount, 0),
      models_used: modelsUsed,
      making,
      made_with: madeWith,
    } as unknown as BuildPatch);
  } catch (error) {
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
  const { state, making } = await readMadeWith("setMadeWithModel", buildId);
  const next = nextMadeWith(state, model, on, "model");
  await updateBuild(buildId, {
    made_with: next.madeWith,
    making: { ...asObject(making), excluded_models: next.excluded },
  } as unknown as BuildPatch);
  // The choice is written; the stats only summarise it, and the next refresh repairs them.
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
export async function addMadeWithTools(buildId: string, names: readonly string[]): Promise<MadeWithState> {
  const { state } = await readMadeWith("addMadeWithTools", buildId);
  const madeWith = withTools(state.madeWith, names);
  if (madeWith === state.madeWith) return state;
  await updateBuild(buildId, { made_with: madeWith });
  return { madeWith, excluded: state.excluded };
}

/**
 * Add a tool or model typed by hand to Made with, or take one out. `made_with` only.
 * A name the tool list knows is saved as that tool's name ("lovable.dev" as
 * "Lovable"), so its chip draws the tool's logo. Taking one out uses the name
 * as the chip shows it, so an entry saved before this still goes.
 */
export async function setMadeWithEntry(buildId: string, entry: string, on: boolean): Promise<MadeWithState> {
  const { state } = await readMadeWith("setMadeWithEntry", buildId);
  const next = nextMadeWith(state, on ? (toolName(entry) ?? entry) : entry, on, "entry");
  const unchanged = next.madeWith.length === state.madeWith.length && next.madeWith.every((name, i) => name === state.madeWith[i]);
  if (unchanged) return state;
  await updateBuild(buildId, { made_with: next.madeWith });
  return next;
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
    throw buildLayerError("setSessionTool", new Error(`A tool name is at most ${SESSION_TOOL_MAX} characters.`));
  }
  const inBuild = (await listBuildSessions(buildId)).some((session) => session.id === sessionId);
  if (!inBuild) throw buildLayerError("setSessionTool", new Error("That session is not in this build."));

  const { state, making } = await readMadeWith("setSessionTool", buildId);
  const tools = { ...sessionToolsOf(making) };
  if (value) tools[sessionId] = value;
  else delete tools[sessionId];
  await updateBuild(buildId, { making: { ...asObject(making), session_tools: tools } } as unknown as BuildPatch);
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
  if (meta.tool && meta.tool.trim().length > SESSION_TOOL_MAX) return `A tool name is at most ${SESSION_TOOL_MAX} characters.`;
  return null;
}

/**
 * Write what one session carries (`making.sessions_meta[key]`), or take it away (null). Only that key changes; the
 * rest of `making` is kept as it is. A named tool joins Made with, as a session's tool does. Resolves with the
 * session's entries as they stand.
 */
export async function setSessionMeta(buildId: string, key: string, meta: SessionMeta | null): Promise<Record<string, SessionMeta>> {
  if (meta) {
    const why = sessionMetaRefusal(key, meta);
    if (why) throw buildLayerError("setSessionMeta", new Error(why));
  } else if (!key) throw buildLayerError("setSessionMeta", new Error("That session is not saved yet."));
  const { making } = await readMadeWith("setSessionMeta", buildId);
  const entries = { ...sessionsMetaOf(making) };
  if (meta) {
    const tool = meta.tool?.trim() || null;
    entries[key] = { ...meta, tool: tool ? (toolFor(tool)?.id ?? tool) : null };
  } else delete entries[key];
  await updateBuild(buildId, { making: { ...asObject(making), sessions_meta: entries } } as unknown as BuildPatch);
  const tool = meta?.tool?.trim();
  if (tool) await addMadeWithTools(buildId, [toolName(tool) ?? tool]).catch(() => console.warn("[setSessionMeta] Made with not updated", { buildId }));
  return entries;
}

/** A code for the log, and only a code. */
function errorCode(error: unknown): string {
  if (error && typeof error === "object") {
    const { code } = error as { code?: unknown };
    if (typeof code === "string" && code.length > 0) return code;
  }
  return "unknown";
}
