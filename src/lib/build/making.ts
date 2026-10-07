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
import { updateBuild } from "./builds";
import { listBuildSessions, type SessionSummary } from "./sessions";
import { buildLayerError, type BuildPatch } from "./types";

/** The label a client adds to Made with. `web` and `unknown` name no tool. */
const TOOL_LABELS: Record<string, string> = {
  claude: "Claude",
  "claude-code": "Claude Code",
  chatgpt: "ChatGPT",
  cursor: "Cursor",
};

/** The tool a client adds to Made with, or null for one that names none (web, unknown). */
export function toolLabel(client: string | null | undefined): string | null {
  return client ? (TOOL_LABELS[client] ?? null) : null;
}

export interface MakingSession {
  client: string | null;
  model: string | null;
  prompts: number;
  turns: number;
}

/** builds.making. `excluded_models` is the maker's to change (UI-P48). */
export interface Making {
  sessions: MakingSession[];
  excluded_models: string[];
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
      sessions: sessions.map((session) => ({
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

/** Add a tool or model typed by hand to Made with, or take one out. `made_with` only. */
export async function setMadeWithEntry(buildId: string, entry: string, on: boolean): Promise<MadeWithState> {
  const { state } = await readMadeWith("setMadeWithEntry", buildId);
  const next = nextMadeWith(state, entry, on, "entry");
  const unchanged = next.madeWith.length === state.madeWith.length && next.madeWith.every((name, i) => name === state.madeWith[i]);
  if (unchanged) return state;
  await updateBuild(buildId, { made_with: next.madeWith });
  return next;
}

/** A code for the log, and only a code. */
function errorCode(error: unknown): string {
  if (error && typeof error === "object") {
    const { code } = error as { code?: unknown };
    if (typeof code === "string" && code.length > 0) return code;
  }
  return "unknown";
}
