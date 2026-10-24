// CA-21 P0: a move written to a build that lives in memory (the dev page and the tests), with the same pure planners the
// composer's writers use: `reassigned` and `planLayout` for tiles and sessions, `nestMoves` for tiles inside tiles, and
// the parts' own changes for a session that crosses parts and for a part. PURE. Nothing is written anywhere.

import { nestMoves } from "./graph";
import { sessionOrderOf, sessionsMetaOf, type Making } from "./making";
import type { Write } from "./moveRules";
import type { NodeMove } from "./nodes";
import { planLayout, reassigned } from "./sessionEdit";
import type { NodeTree } from "./types";
import { droppedWorkstream, moveSessionToWorkstream, moveWorkstream, workstreamPatch } from "./workstreams";

export interface MemoryBuild {
  tree: NodeTree[];
  making: Making;
}

function withMoves(tree: readonly NodeTree[], moves: readonly NodeMove[]): NodeTree[] {
  const by = new Map(moves.map((move) => [move.id, move]));
  const place = (nodes: readonly NodeTree[]): NodeTree[] =>
    nodes.map((node) => {
      const move = by.get(node.id);
      return { ...node, ...(move ? { parent_id: move.parent_id, position: move.position } : null), children: node.children ? node.children : [] };
    });
  const flat = place(tree);
  // A node that moved into or out of a parent is found by its new `parent_id`, so the nested tree is rebuilt from its rows.
  const rows = new Map<string, NodeTree>();
  const walk = (nodes: readonly NodeTree[]) => {
    for (const node of nodes) {
      rows.set(node.id, node);
      walk(node.children ?? []);
    }
  };
  walk(flat);
  const placed = [...rows.values()].map((row) => ({ ...(by.has(row.id) ? { ...row, parent_id: by.get(row.id)?.parent_id ?? null, position: by.get(row.id)?.position ?? row.position } : row), children: [] as NodeTree[] }));
  const byId = new Map(placed.map((row) => [row.id, row]));
  const top: NodeTree[] = [];
  for (const row of placed) {
    const parent = row.parent_id ? byId.get(row.parent_id) : undefined;
    if (parent) parent.children = [...(parent.children ?? []), row];
    else top.push(row);
  }
  for (const row of placed) row.children = [...(row.children ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return top.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

function stacked(tree: readonly NodeTree[], making: Making, order: readonly string[], atEnd: readonly string[] = []): NodeTree[] {
  const plan = planLayout(tree, making, sessionsMetaOf(making), order, atEnd);
  return withMoves(tree, plan.moves);
}

/** The build after `write`. The same build when the write changes nothing. */
export function applyWrite(build: MemoryBuild, write: Write): MemoryBuild {
  const order = sessionOrderOf(build.making);
  if (write.kind === "tile" && write.session) {
    const tree = reassigned(build.tree, write.reassign ? new Map([[write.reassign.id, write.reassign.session]]) : new Map());
    return { ...build, tree: stacked(tree, build.making, order, write.atEnd) };
  }
  if (write.kind === "nested" && write.parent !== undefined && write.index !== undefined) {
    return { ...build, tree: withMoves(build.tree, nestMoves(build.tree, write.id, write.parent, write.index)) };
  }
  if (write.kind === "session") {
    if (write.toPart) {
      const change = moveSessionToWorkstream(build.making, order, write.id, write.toPart, write.before);
      if (!change) return build;
      const making = { ...build.making, ...workstreamPatch(build.making, change) } as Making;
      return { tree: stacked(build.tree, making, change.order), making };
    }
    const making = { ...build.making, session_order: write.order ?? order } as Making;
    return { tree: stacked(build.tree, making, write.order ?? order), making };
  }
  if (write.kind === "part") {
    const change = write.over ? droppedWorkstream(build.making, order, write.id, write.over) : write.by ? moveWorkstream(build.making, order, write.id, write.by) : null;
    if (!change) return build;
    const making = { ...build.making, ...workstreamPatch(build.making, change) } as Making;
    return { tree: stacked(build.tree, making, change.order), making };
  }
  return build;
}
