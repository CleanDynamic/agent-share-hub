// The composer's prompts (UI-P48): the prompts someone needs to get the same
// result, in order.
//
// A PROMPT IS A PLACED, TOP-LEVEL NODE OF TYPE `prompt`, and the list is those
// nodes in `position` order. Each is placed as every node the composer adds is
// (`placeTopNode`): one past the highest top-level position, so it counts
// towards publishing and never collides.
//
// FROM A SESSION, a prompt keeps the event's own source_ref and adds
// `import_session_id`, the import it was picked from. That pair, the import and
// the event's index, is what makes a prompt already added: the same prompt is
// never placed twice. Its payload is what the build page's prompt renderer
// reads, the text as the block and the model on the caption line; a session
// whose model is not known yet leaves the model out rather than writing null.
//
// WRITTEN BY HAND, a prompt carries no source_ref. `payload.text` is required
// by the node type, so nothing is written until there is text, and a prompt is
// never saved empty.
//
// ORDER. Moving swaps a prompt with the previous or next PROMPT, so the other
// top-level nodes (the cover's evidence node) keep their places. reorderNodes
// does the swap: it parks both rows before placing them, because the unique
// index on (build_id, parent_id, position) is not deferrable.

import type { Json } from "@/integrations/supabase/types";
import { nodeRow, placeTopNode } from "./composeCover";
import { reorderNodes, upsertNode, type NodeMove } from "./nodes";
import type { SessionPrompt } from "./sessions";
import { buildLayerError, type BuildNode, type NodeTree } from "./types";

export const PROMPT_TYPE = "prompt";

/** A prompt from a session: the event's source_ref and the import it came from. */
export interface PromptSourceRef {
  source: string;
  session_id: string;
  index: number;
  import_session_id: string;
}

/** Where a prompt was picked from. */
export interface PromptOrigin {
  importSessionId: string;
  index: number;
}

type Payload = Record<string, Json | undefined>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const payloadOf = (node: Pick<BuildNode, "payload">): Payload => (isRecord(node.payload) ? (node.payload as Payload) : {});

/** The build's prompts: the top-level `prompt` nodes, in position order. */
export function promptNodes<T extends Pick<BuildNode, "parent_id" | "position" | "type">>(tree: readonly T[]): T[] {
  return tree
    .filter((node) => node.parent_id === null && node.type === PROMPT_TYPE && typeof node.position === "number")
    .sort((a, b) => (a.position as number) - (b.position as number));
}

/** A prompt's text, or "". */
export function promptText(node: Pick<BuildNode, "payload">): string {
  const text = payloadOf(node).text;
  return typeof text === "string" ? text : "";
}

/** The model a prompt names, or null. */
export function promptModel(node: Pick<BuildNode, "payload">): string | null {
  const model = payloadOf(node).model;
  return typeof model === "string" && model.trim() ? model : null;
}

/** Where a prompt was picked from, or null for one written by hand. */
export function promptOrigin(node: Pick<BuildNode, "source_ref">): PromptOrigin | null {
  const ref = node.source_ref;
  if (!isRecord(ref)) return null;
  const { import_session_id: importSessionId, index } = ref;
  if (typeof importSessionId !== "string" || typeof index !== "number") return null;
  return { importSessionId, index };
}

/**
 * True when this event of this import is already in the build, anywhere in the
 * tree: a prompt the maker has since nested is still added.
 */
export function isPromptAdded(tree: readonly NodeTree[], importSessionId: string, index: number): boolean {
  for (const node of tree) {
    const origin = promptOrigin(node);
    if (origin && origin.importSessionId === importSessionId && origin.index === index) return true;
    if (node.children?.length && isPromptAdded(node.children, importSessionId, index)) return true;
  }
  return false;
}

/** `{ text, model }`, the model left out while it is not known. */
function promptPayload(text: string, model: string | null): Json {
  return model ? { text, model } : { text };
}

export interface SessionPromptInput {
  buildId: string;
  /** The tree as the composer knows it: where the next position is read from. */
  tree: readonly NodeTree[];
  importSessionId: string;
  /** The session's model, by name; null while it is not known. */
  model: string | null;
  prompt: SessionPrompt;
}

/** Place a prompt picked from a session. Refuses one that is already in the build. */
export async function addSessionPrompt({ buildId, tree, importSessionId, model, prompt }: SessionPromptInput): Promise<BuildNode> {
  if (isPromptAdded(tree, importSessionId, prompt.sourceRef.index)) {
    throw buildLayerError("addSessionPrompt", new Error("That prompt is already in this build."));
  }
  const sourceRef: PromptSourceRef = { ...prompt.sourceRef, import_session_id: importSessionId };
  return placeTopNode(buildId, tree, {
    type: PROMPT_TYPE,
    title: null,
    payload: promptPayload(prompt.text, model),
    source_ref: sourceRef as unknown as Json,
  });
}

/** Place a prompt the maker wrote. Refuses one with no text. */
export async function addWrittenPrompt({ buildId, tree, text }: { buildId: string; tree: readonly NodeTree[]; text: string }): Promise<BuildNode> {
  if (!text.trim()) throw buildLayerError("addWrittenPrompt", new Error("A prompt needs its text."));
  return placeTopNode(buildId, tree, { type: PROMPT_TYPE, title: null, payload: { text }, source_ref: null });
}

/** Save a prompt's text, keeping everything else it carries. Refuses an empty one. */
export async function savePromptText(node: BuildNode, text: string): Promise<BuildNode> {
  if (!text.trim()) throw buildLayerError("savePromptText", new Error("A prompt needs its text."));
  return upsertNode({ ...nodeRow(node), payload: { ...payloadOf(node), text } as Json });
}

/** Name the model a prompt ran on, once its session's model is known. */
export async function setPromptModel(node: BuildNode, model: string | null): Promise<BuildNode> {
  const payload = { ...payloadOf(node) };
  if (model) payload.model = model;
  else delete payload.model;
  return upsertNode({ ...nodeRow(node), payload: payload as Json });
}

/** The two moves that swap prompt `index` with the one before or after it; none at either end. */
export function swapMoves(prompts: readonly Pick<BuildNode, "id" | "position">[], index: number, direction: -1 | 1): NodeMove[] {
  const here = prompts[index];
  const there = prompts[index + direction];
  if (!here || !there || typeof here.position !== "number" || typeof there.position !== "number") return [];
  return [
    { id: here.id, parent_id: null, position: there.position },
    { id: there.id, parent_id: null, position: here.position },
  ];
}

/** Swap a prompt with its neighbour. Resolves with the moves written; none at either end. */
export async function movePrompt(
  buildId: string,
  prompts: readonly Pick<BuildNode, "id" | "position">[],
  index: number,
  direction: -1 | 1,
): Promise<NodeMove[]> {
  const moves = swapMoves(prompts, index, direction);
  if (moves.length > 0) await reorderNodes(buildId, moves);
  return moves;
}
