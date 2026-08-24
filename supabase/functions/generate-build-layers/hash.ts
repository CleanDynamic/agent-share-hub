// =============================================================================
// NeoScale — generate-build-layers: the node tree hash
// =============================================================================
// generated_from_hash answers one question: is the record this content was
// generated from still the record we have? It has to be stable across two
// invocations that read the same rows in a different order, and it has to move
// when anything a reader would notice moves — a title, a note, a payload
// value, a node's place in the tree.
//
// WHAT IS HASHED: the placed node tree, in tree order. Every node contributes
// its id, its parent, its position, its type, its title, its note, its gap
// flag and its payload canonicalised key-sorted.
//
// WHAT IS NOT HASHED, deliberately:
//
//   TRAY NODES (position IS NULL). Unplaced material is never rendered, never
//   exported and never counted towards completeness, so it cannot change what
//   a layer says. Dragging a node out of the tray places it, which changes its
//   position and moves the hash.
//
//   EVENTS. The handover specifies the hash over the node tree, and this
//   follows it. The consequence is real and NS-P23 should know it: editing
//   only the sequence — folding an event, renaming a phase — does not make a
//   layer regenerate. Layers describe the record's shape; the sequence is a
//   supporting input, not the subject.
//
// The stored hash carries a version prefix so a later change of algorithm is
// legible in the data rather than looking like every build changed at once.
// =============================================================================

import type { NodeRow, TreeNode } from "./types.ts";

const HASH_VERSION = "v1";

/**
 * Deterministic JSON: object keys sorted at every level, so two payloads that
 * differ only in key order hash identically. Arrays keep their order, because
 * in a list field the order is content.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "null";
  }
  if (typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${
      entries
        .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
        .join(",")
    }}`;
  }
  // Functions and symbols cannot reach here from JSON, but be explicit.
  return "null";
}

/** One node's contribution, as one tab-separated line. */
function nodeLine(node: NodeRow, depth: number): string {
  return [
    depth,
    node.id,
    node.parent_id ?? "",
    node.position ?? "",
    node.type,
    node.title ?? "",
    node.note ?? "",
    node.is_gap ? "1" : "0",
    canonicalJson(node.payload ?? {}),
  ].join("\t");
}

/** The exact string that gets hashed. Exported so a mismatch is inspectable. */
export function hashInput(tree: TreeNode[]): string {
  const lines: string[] = [HASH_VERSION];
  const walk = (nodes: TreeNode[], depth: number) => {
    for (const item of nodes) {
      lines.push(nodeLine(item.node, depth));
      walk(item.children, depth + 1);
    }
  };
  walk(tree, 0);
  return lines.join("\n");
}

/** `v1:<sha-256 hex>` over the placed node tree. */
export async function hashNodeTree(tree: TreeNode[]): Promise<string> {
  const bytes = new TextEncoder().encode(hashInput(tree));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${HASH_VERSION}:${hex}`;
}
