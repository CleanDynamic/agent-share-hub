// duplicate and convert (CA-20 P7): the planners, pure.
//
// Both work on a snapshot and give a snapshot, so the writing is `restoreSnapshot`, the same writer undo uses: Duplicate puts new
// rows in with new ids, Convert changes the type and payload of rows that keep their ids, so what points at a tile still does.

import type { Json } from "@/integrations/supabase/types";

import type { BuildSnapshot } from "./buildSnapshot";
import { AGENT_TYPE, FILE_TYPE, MANUAL_LINES_MAX, MANUAL_STEP_TYPE, MANUAL_TEXT_MAX, MANUAL_TOOL_MAX, SYSTEM_PROMPT_TYPE } from "./graph";
import { PROMPT_TYPE } from "./composePrompts";
import type { BuildNode } from "./types";
import { isSummaryPayload } from "./summaryTurn";
import { rewriteDeploymentRefs } from "./deployment";

export const DUPLICATE_COPY = {
  one: (name: string): string => `Duplicated ${name}`,
  several: (count: number): string => `Duplicated ${count} items`,
  suffix: " copy",
} as const;

type Payload = Record<string, unknown>;
const payloadOf = (row: Pick<BuildNode, "payload">): Payload => (row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? (row.payload as Payload) : {});
const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** A node's own id, or what the id becomes in the copy. Ids inside payloads (uses) are kept: the copy uses the same files. */
export interface Duplicated {
  snapshot: BuildSnapshot;
  /** The new top-level ids, in the order of the originals. */
  ids: string[];
}

/** Tiles at the top of the list, not inside another that is also copied. */
function topsOf(rows: readonly BuildNode[], ids: readonly string[]): BuildNode[] {
  const picked = rows.filter((row) => ids.includes(row.id) && row.type !== FILE_TYPE);
  return picked.filter((row) => {
    for (let parent = row.parent_id ? rows.find((r) => r.id === row.parent_id) : undefined; parent; parent = parent.parent_id ? rows.find((r) => r.id === parent.parent_id) : undefined) if (ids.includes(parent.id)) return false;
    return true;
  });
}

/** The copy's title: " copy" after the name the maker gave it, or none when it has no name of its own. */
const copyTitle = (title: string | null): string | null => (title && title.trim() ? `${title}${DUPLICATE_COPY.suffix}` : title);

/** Copy tiles with what is inside them, each directly below its original. Files the tiles make are not copied; group and linked words stay with the original. Pure. */
export function duplicateTiles(snapshot: BuildSnapshot, ids: readonly string[], newId: () => string): Duplicated {
  const rows = snapshot.nodes;
  const tops = topsOf(rows, ids);
  const made: BuildNode[] = [];
  const out: string[] = [];
  const childrenOf = (id: string) => rows.filter((row) => row.parent_id === id).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const copy = (row: BuildNode, parent: string | null, top: boolean): string => {
    const id = newId();
    const payload = JSON.parse(JSON.stringify(row.payload ?? null)) as Json;
    made.push({ ...row, id, parent_id: parent, position: top ? (row.position ?? 0) + 0.5 : (row.position ?? 0), title: top ? copyTitle(row.title) : row.title, source_ref: null, event_id: null, payload });
    for (const inner of childrenOf(row.id)) copy(inner, id, false);
    return id;
  };
  for (const row of tops) out.push(copy(row, row.parent_id, true));

  // SV-27 P3: a deployment line, a served model, a relay's agents, a knowledge base's readers and a channel picked under How did
  // it run? point at the copies of tiles copied together; a tile not copied is still pointed at as it was.
  const copiedIds = new Map<string, string>();
  // `copy` made the rows in this same order: each top, then what is inside it.
  let at = 0;
  const walk = (row: BuildNode) => {
    copiedIds.set(row.id, made[at].id);
    at += 1;
    for (const inner of childrenOf(row.id)) walk(inner);
  };
  for (const row of tops) walk(row);
  for (const row of made) row.payload = rewriteDeploymentRefs(row.payload, copiedIds) as Json;

  // Each top copy sits directly after its original; the siblings are numbered again, so no two share a place.
  const all = [...rows, ...made];
  const parents = new Set(tops.map((row) => row.parent_id));
  const placed = new Map<string, number>();
  for (const parent of parents) {
    const siblings = all.filter((row) => row.parent_id === parent).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    siblings.forEach((row, at) => placed.set(row.id, at));
  }
  const nodes = all.map((row) => (placed.has(row.id) ? { ...row, position: placed.get(row.id) as number } : row));
  return { snapshot: { ...snapshot, nodes }, ids: out };
}

/* ── Convert ── */

export type ConvertTo = "prompt" | "agent" | "manual";

export const CONVERT_COPY = {
  menu: "Convert to…",
  targets: { prompt: "Prompt", agent: "Agent", manual: "Manual step" } as Record<ConvertTo, string>,
  title: (name: string, to: string): string => `Convert ${name} to ${/^[aeiou]/i.test(to) ? "an" : "a"} ${to.toLowerCase()}?`,
  lost: (fields: readonly string[]): string => `These won't carry over: ${fields.join(", ")}.`,
  convert: "Convert",
  done: (name: string, to: string): string => `Converted ${name} to ${/^[aeiou]/i.test(to) ? "an" : "a"} ${to.toLowerCase()}`,
  needsTool: "Name the tool first",
  tooLong: "Too long for a manual step",
} as const;

const TYPE_OF: Record<ConvertTo, string> = { prompt: PROMPT_TYPE, agent: AGENT_TYPE, manual: MANUAL_STEP_TYPE };
const SOURCE_KIND: Record<string, ConvertTo | "system"> = { [PROMPT_TYPE]: "prompt", [AGENT_TYPE]: "agent", [MANUAL_STEP_TYPE]: "manual", [SYSTEM_PROMPT_TYPE]: "system" };

/** Whether a tile can be converted at all. */
export const canConvert = (row: Pick<BuildNode, "type">): boolean => row.type in SOURCE_KIND;

/** The targets a row can go to: every other of the three. SV-07 P7: a Summary tile, a prompt row, can also become a prompt. */
export const targetsOf = (row: Pick<BuildNode, "type"> & { payload?: unknown }): ConvertTo[] =>
  (["prompt", "agent", "manual"] as const).filter((to) => TYPE_OF[to] !== row.type || (to === "prompt" && isSummaryPayload(row.payload)));

/** What the words and the tool of a tile are, whatever it is. */
function partsOf(row: BuildNode): { words: string; tool: string; lost: string[] } {
  const p = payloadOf(row);
  switch (SOURCE_KIND[row.type]) {
    case "agent": {
      const lost: string[] = [];
      if (Array.isArray(p.tools) && p.tools.length > 0) lost.push("Tools");
      if (text(p.memory)) lost.push("Memory");
      return { words: text(p.system_prompt), tool: text(p.harness), lost };
    }
    case "manual":
      return { words: text(p.text), tool: text(p.tool), lost: [] };
    case "system":
      return { words: text(p.text), tool: "", lost: [] };
    default: {
      const lost: string[] = [];
      if (text(p.model)) lost.push("Model");
      const settings = p.settings && typeof p.settings === "object" ? Object.values(p.settings as Payload).some((v) => v !== null && v !== undefined && v !== "") : false;
      if (settings || text(p.effort)) lost.push("Effort");
      return { words: text(p.text), tool: text(p.tool), lost };
    }
  }
}

export interface ConvertPlan {
  /** Why it cannot be done, in words for the menu. */
  refusal: string | null;
  /** What does not come across, for the window that asks. */
  lost: string[];
  row: BuildNode | null;
}

/** A row as another kind of tile. It keeps its id, its place, its title, its session, its colour and its uses. Pure. */
export function convertRow(row: BuildNode, to: ConvertTo, model: string): ConvertPlan {
  const { words, tool, lost: dropped } = partsOf(row);
  const p = payloadOf(row);
  // SV-07 P7: a Summary tile made a prompt keeps everything it holds, and is read as a prompt from now on.
  if (to === "prompt" && row.type === TYPE_OF.prompt && isSummaryPayload(p)) return { refusal: null, lost: [], row: { ...row, payload: { ...p, as_prompt: true } as Json } };
  const kept: Payload = {};
  for (const key of ["session", "colour", "uses"]) if (key in p && p[key] !== undefined) kept[key] = p[key];
  let payload: Payload;
  const lost = [...dropped];
  if (to === "agent") {
    payload = { ...kept, system_prompt: words, model, harness: tool || null, models: [], tools: [] };
  } else if (to === "manual") {
    const lines = words.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!tool || tool.length > MANUAL_TOOL_MAX) return { refusal: CONVERT_COPY.needsTool, lost, row: null };
    if (lines.length === 0 || lines.length > MANUAL_LINES_MAX || lines.some((line) => line.length > MANUAL_TEXT_MAX)) return { refusal: CONVERT_COPY.tooLong, lost, row: null };
    payload = { ...kept, tool, text: lines.join("\n") };
  } else {
    payload = { ...kept, text: words, ...(tool ? { tool } : null), ...(SOURCE_KIND[row.type] === "agent" && text(p.model) ? { model: text(p.model) } : null) };
  }
  return { refusal: null, lost: [...new Set(lost)], row: { ...row, type: TYPE_OF[to], payload: payload as Json } };
}

/** The snapshot with these rows converted. */
export function convertTiles(snapshot: BuildSnapshot, plans: ReadonlyMap<string, BuildNode>): BuildSnapshot {
  return { ...snapshot, nodes: snapshot.nodes.map((row) => plans.get(row.id) ?? row) };
}
