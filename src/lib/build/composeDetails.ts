// The composer's More details (UI-P48): where it broke, and one part left open.
//
// WHERE IT BROKE is one placed `breakage` node, the first at the top level:
// `payload.symptom` is "What broke" (required by the type) and
// `payload.resolution` is "How you fixed it". It is created once "What broke"
// has text, updated as either changes, and deleted when "What broke" is
// emptied. Its title is the symptom's first 80 characters, the rule the gap
// below is given, so the build page's "Where it broke" names it rather than
// calling it untitled.
//
// ONE PART LEFT OPEN is one placed `gap` node, the first open one at the top
// level: `is_gap = true`, `payload.problem` (required) and the problem's first
// 80 characters as its title. Switching it off, or emptying the problem,
// deletes it. A gap counts for nothing towards completeness (signals.ts); a
// reward is added on Bounties after publishing.

import type { Json } from "@/integrations/supabase/types";
import { nodeRow, placeTopNode } from "./composeCover";
import { deleteNode, upsertNode } from "./nodes";
import type { BuildNode, NodeTree } from "./types";

export const BREAKAGE_TYPE = "breakage";
export const GAP_TYPE = "gap";

/** The most of a symptom or problem a title keeps. */
export const DETAIL_TITLE_MAX = 80;

type Payload = Record<string, Json | undefined>;

const payloadOf = (node: Pick<BuildNode, "payload"> | null): Payload =>
  node && node.payload && typeof node.payload === "object" && !Array.isArray(node.payload) ? (node.payload as Payload) : {};

const textAt = (node: Pick<BuildNode, "payload"> | null, key: string): string => {
  const value = payloadOf(node)[key];
  return typeof value === "string" ? value : "";
};

const topLevel = (tree: readonly NodeTree[], wanted: (node: NodeTree) => boolean): NodeTree | null =>
  [...tree]
    .filter((node) => node.parent_id === null && typeof node.position === "number" && wanted(node))
    .sort((a, b) => (a.position as number) - (b.position as number))[0] ?? null;

/** The composer's breakage node: the first at the top level. */
export function composerBreakage(tree: readonly NodeTree[]): NodeTree | null {
  return topLevel(tree, (node) => node.type === BREAKAGE_TYPE);
}

/** The composer's gap: the first open `gap` node at the top level. */
export function composerGap(tree: readonly NodeTree[]): NodeTree | null {
  return topLevel(tree, (node) => node.type === GAP_TYPE && node.is_gap);
}

/** "What broke" and "How you fixed it", as the node holds them. */
export function breakageFields(node: Pick<BuildNode, "payload"> | null): { symptom: string; resolution: string } {
  return { symptom: textAt(node, "symptom"), resolution: textAt(node, "resolution") };
}

/** What a gap says is left open. */
export function gapProblemText(node: Pick<BuildNode, "payload"> | null): string {
  return textAt(node, "problem");
}

/** A title from a symptom or a problem: its first 80 characters. */
export function detailTitle(text: string): string {
  return text.trim().slice(0, DETAIL_TITLE_MAX).trimEnd();
}

export interface BreakageInput {
  buildId: string;
  tree: readonly NodeTree[];
  /** The composer's breakage node, when there is one. */
  current: BuildNode | null;
  symptom: string;
  resolution: string;
}

/**
 * Write "Where it broke": create, update, or (when "What broke" is empty)
 * delete. Resolves with the node as it now stands, or null when there is none.
 */
export async function saveBreakage({ buildId, tree, current, symptom, resolution }: BreakageInput): Promise<BuildNode | null> {
  if (!symptom.trim()) {
    if (current) await deleteNode(current.id);
    return null;
  }
  const payload: Payload = { ...payloadOf(current), symptom };
  if (resolution.trim()) payload.resolution = resolution;
  else delete payload.resolution;
  const title = detailTitle(symptom);
  if (current) return upsertNode({ ...nodeRow(current), title, payload: payload as Json });
  return placeTopNode(buildId, tree, { type: BREAKAGE_TYPE, title, payload: payload as Json });
}

export interface GapInput {
  buildId: string;
  tree: readonly NodeTree[];
  /** The composer's gap, when there is one. */
  current: BuildNode | null;
  problem: string;
}

/**
 * Write the part left open: create, update, or (when the problem is empty)
 * delete. Resolves with the node as it now stands, or null when there is none.
 */
export async function saveGap({ buildId, tree, current, problem }: GapInput): Promise<BuildNode | null> {
  if (!problem.trim()) {
    if (current) await deleteNode(current.id);
    return null;
  }
  const title = detailTitle(problem);
  if (current) {
    return upsertNode({ ...nodeRow(current), title, is_gap: true, payload: { ...payloadOf(current), problem } as Json });
  }
  return placeTopNode(buildId, tree, { type: GAP_TYPE, title, is_gap: true, payload: { problem } });
}
