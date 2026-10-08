/* UI-P47 — the composer's small rules, pure: what publishing still needs, how
   it is said, how "Who it's for" is parsed and what the status line reads.

   WHAT PUBLISHING NEEDS is `computeCompleteness(...).missing` restricted to
   `MINIMUM_PUBLISHABLE_KEYS`, plus the title. The title counts as missing when
   it is empty or "Untitled build". The order is the canvas's, not the
   registry's: a cover picture or video, a title, a description, a prompt.

   UI-P48 adds the words of Prompts, Your sessions, Made with and More details,
   and the overlay that keeps the composer's own node writes on screen while
   the record is read again (`applyNodeWrites`). */

import { promptModel, promptOrigin } from "@/lib/build/composePrompts";
import { toolLabel, type MadeWithState } from "@/lib/build/making";
import type { SessionSummary } from "@/lib/build/sessions";
import { MINIMUM_PUBLISHABLE_KEYS, type Completeness, type RequirementKey } from "@/lib/build/signals";
import type { BuildNode, NodeTree } from "@/lib/build/types";
import { modelLabel } from "@/lib/models/registry";
import { sessionDate, sessionSource } from "@/pages/site/drafts/draftsModel";

export const UNTITLED = "Untitled build";

/** The most "Who it's for" entries a build carries. */
export const AUDIENCE_MAX = 4;

/** The description's length. `builds.outcome` has no limit of its own, so this is the composer's. */
export const DESCRIPTION_MAX = 200;

export type PublishKey = "evidence" | "title" | "outcome" | "instruction_or_artefact";

/** The canvas's order. */
export const PUBLISH_ORDER: readonly PublishKey[] = ["evidence", "title", "outcome", "instruction_or_artefact"];

/** In plain words. */
export const PUBLISH_WORDS: Record<PublishKey, string> = {
  evidence: "a cover picture or video",
  title: "a title",
  outcome: "a description",
  instruction_or_artefact: "a prompt",
};

export const isUntitled = (title: string | null | undefined): boolean => {
  const trimmed = (title ?? "").trim();
  return trimmed === "" || trimmed === UNTITLED;
};

/**
 * What the build still needs before it can be published, in the canvas's order.
 * `completeness` is null before the draft exists, when everything is missing.
 */
export function missingForPublish(input: {
  title: string | null | undefined;
  completeness: Pick<Completeness, "missing"> | null;
}): PublishKey[] {
  const open = new Set<RequirementKey>(
    input.completeness
      ? input.completeness.missing.map((item) => item.key)
      : (MINIMUM_PUBLISHABLE_KEYS as readonly RequirementKey[]),
  );
  return PUBLISH_ORDER.filter((key) => (key === "title" ? isUntitled(input.title) : open.has(key)));
}

/** "a cover picture or video, a title, a description, a prompt". */
export function missingList(keys: readonly PublishKey[]): string {
  return keys.map((key) => PUBLISH_WORDS[key]).join(", ");
}

/** The toast when Publish is pressed with something missing. */
export function publishToast(keys: readonly PublishKey[]): string {
  return `To publish, add ${missingList(keys)}.`;
}

/** "photographers, families" → ["photographers", "families"]: trimmed, deduplicated, at most four. */
export function parseAudience(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(",")) {
    const entry = part.trim();
    if (!entry) continue;
    const key = entry.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
    if (out.length === AUDIENCE_MAX) break;
  }
  return out;
}

export type SaveState = "idle" | "saved" | "saving" | "error";

/** The save half of the status line. "not saved — " is followed by a button the view draws. */
export const SAVE_WORDS: Record<Exclude<SaveState, "idle">, string> = {
  saved: "saved just now",
  saving: "saving…",
  error: "not saved — ",
};

/** The saving state, from the hook's three facts. An error outranks a save in flight. */
export function saveState(input: { isSaving: boolean; saveError: unknown; lastSavedAt: Date | null }): SaveState {
  if (input.saveError) return "error";
  if (input.isSaving) return "saving";
  return input.lastSavedAt ? "saved" : "idle";
}

/* ── UI-P48: Prompts ── */

/** The characters of a prompt the + button's accessible name keeps. */
export const ADD_PROMPT_LABEL_MAX = 60;

/** "Add to prompts: {first 60 characters}", on one line. */
export function addPromptLabel(text: string): string {
  return `Add to prompts: ${text.replace(/\s+/g, " ").trim().slice(0, ADD_PROMPT_LABEL_MAX).trimEnd()}`;
}

/** The toast once a prompt from a session is in: "Added as prompt 3." */
export const addedToast = (n: number): string => `Added as prompt ${n}.`;

/** What a session prompt carries when it is dragged: "{importId}:{ordinal}". */
export const promptDragData = (importId: string, ordinal: number): string => `${importId}:${ordinal}`;

/** The import and ordinal a drop carries, or null for anything else (a file, a link, a selection of text). */
export function parsePromptDragData(data: string): { importId: string; ordinal: number } | null {
  const text = (data ?? "").trim();
  const at = text.lastIndexOf(":");
  if (at <= 0) return null;
  const importId = text.slice(0, at);
  const ordinal = Number(text.slice(at + 1));
  if (!/^[\w-]+$/.test(importId) || !Number.isInteger(ordinal) || ordinal < 0) return null;
  return { importId, ordinal };
}

/** "Session 2 · Opus 5.5", or "Written by you". */
export function promptSourceLine(
  node: Pick<BuildNode, "source_ref" | "payload">,
  sessions: readonly Pick<SessionSummary, "id" | "modelName" | "client">[],
): string {
  const origin = promptOrigin(node);
  if (!origin) return "Written by you";
  const at = sessions.findIndex((session) => session.id === origin.importSessionId);
  if (at === -1) {
    const model = promptModel(node);
    return model ? `From a session · ${model}` : "From a session";
  }
  return `Session ${at + 1} · ${sessionSource(sessions[at])}`;
}

/**
 * The composer's own node writes laid over the tree the record holds. Pure.
 *
 * A written node replaces the node with its id, or joins the top level when
 * the tree does not hold it yet; null removes it. The top level is then put
 * back in position order. Returns the same array when nothing differs, so the
 * caller can tell a no-op from a change.
 */
export function applyNodeWrites(tree: NodeTree[], writes: ReadonlyMap<string, BuildNode | null>): NodeTree[] {
  if (writes.size === 0) return tree;
  const same = (a: BuildNode, b: BuildNode) =>
    a.position === b.position &&
    a.parent_id === b.parent_id &&
    a.type === b.type &&
    a.title === b.title &&
    a.is_gap === b.is_gap &&
    JSON.stringify(a.payload) === JSON.stringify(b.payload) &&
    JSON.stringify(a.source_ref) === JSON.stringify(b.source_ref);

  let changed = false;
  const seen = new Set<string>();
  const next: NodeTree[] = [];
  for (const node of tree) {
    seen.add(node.id);
    if (!writes.has(node.id)) {
      next.push(node);
      continue;
    }
    const written = writes.get(node.id);
    if (!written) {
      changed = true;
      continue;
    }
    if (same(node, written)) next.push(node);
    else {
      changed = true;
      next.push({ ...written, children: node.children });
    }
  }
  for (const [id, written] of writes) {
    if (!written || seen.has(id) || written.parent_id !== null) continue;
    changed = true;
    next.push({ ...written, children: [] });
  }
  if (!changed) return tree;
  return next.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

/* ── UI-P48: Your sessions ── */

/** "Sonnet 5.5 · Today": the model (or the client), then the day. */
export function sessionMetaLine(session: Pick<SessionSummary, "modelName" | "client" | "createdAt">, now: number): string {
  return [sessionSource(session), sessionDate(session.createdAt, now)].filter(Boolean).join(" · ");
}

/** "Add to this build: {first 60 characters}", the + on a session not in a build yet. */
export function addSessionLabel(firstPrompt: string): string {
  return `Add to this build: ${firstPrompt.replace(/\s+/g, " ").trim().slice(0, ADD_PROMPT_LABEL_MAX).trimEnd()}`;
}

/** "Session added. Sonnet 5.5 is now under Made with.", naming what the refresh really added. */
export function sessionAddedToast(session: Pick<SessionSummary, "modelName" | "client">, excluded: readonly string[]): string {
  const model = session.modelName && !excluded.some((name) => name.toLowerCase() === session.modelName?.toLowerCase()) ? session.modelName : null;
  const named = model ?? toolLabel(session.client);
  return named ? `Session added. ${named} is now under Made with.` : "Session added.";
}

/* ── UI-P48: Made with ── */

export interface MadeWithChip {
  key: string;
  /** "Claude Code", or null for a session that names no tool. */
  tool: string | null;
  /** "Sonnet 5.5", or null. */
  model: string | null;
  /** "Claude Code · Sonnet 5.5". */
  label: string;
  /** In Made with. An unticked model is out of it, and drawn struck through. */
  on: boolean;
  /**
   * `model`: a session's model, which unticking leaves out; `tool`: a session
   * whose model is not known, with nothing to untick; `entry`: typed by hand.
   */
  kind: "model" | "tool" | "entry";
}

const lower = (value: string) => value.trim().toLowerCase();

/**
 * The Made with line: one chip per session ("{tool} · {model}", deduplicated),
 * then whatever `made_with` holds that no session accounts for, as typed.
 */
export function madeWithChips(
  sessions: readonly Pick<SessionSummary, "client" | "modelName">[],
  state: MadeWithState,
): MadeWithChip[] {
  const excluded = new Set(state.excluded.map(lower));
  const chips: MadeWithChip[] = [];
  const covered = new Set<string>();

  for (const session of sessions) {
    const tool = toolLabel(session.client);
    const model = session.modelName?.trim() || null;
    if (!tool && !model) continue;
    const label = [tool, model].filter(Boolean).join(" · ");
    if (tool) covered.add(lower(tool));
    if (model) covered.add(lower(model));
    if (chips.some((chip) => chip.label === label)) continue;
    chips.push({
      key: `session:${label}`,
      tool,
      model,
      label,
      on: model ? !excluded.has(lower(model)) : true,
      kind: model ? "model" : "tool",
    });
  }

  for (const entry of state.madeWith) {
    const name = entry.trim();
    if (!name || covered.has(lower(name)) || covered.has(lower(modelLabel(name)))) continue;
    covered.add(lower(name));
    chips.push({ key: `entry:${lower(name)}`, tool: null, model: null, label: name, on: true, kind: "entry" });
  }
  return chips;
}

/** The longest tool or model name typed by hand; the session column's own limit. */
export const MADE_WITH_ENTRY_MAX = 64;

/* ── UI-P48: More details ── */

/**
 * A typed amount: null when blank (the column is cleared), a number when it is
 * one and not negative, and undefined while it is not one (nothing is
 * written). Minutes are whole: the column is an integer.
 */
export function parseAmount(text: string, { whole = false }: { whole?: boolean } = {}): number | null | undefined {
  const trimmed = (text ?? "").trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return undefined;
  return whole ? Math.round(value) : value;
}
