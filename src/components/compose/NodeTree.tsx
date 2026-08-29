// The placed tree: the centre panel of the compose workspace.
//
// One DndContext wraps BOTH this and TrayPanel so a node can be dragged from
// the tray into the tree and back. That context is mounted in ComposeFrame
// rather than here, because ComposeFrame is the only ancestor both panels
// share — in single-column mode the tray moves into a Sheet, and a portal
// still carries React context, so the two stay in one drag layer either way.
//
// Three drop targets, as three kinds of droppable:
//   gap     — one insertion point in a sibling list. Gap i is at once "after
//             the node above" and "before the node below", so every place a
//             node can land has exactly one zone and two never overlap.
//   inside  — the row itself: dropping on a node nests the dragged node under
//             it as its last child. Lives on TreeNode.
//   tray    — the whole tray panel. Lives on TrayPanel.

import { useCallback, useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { NodeTree as NodeTreeShape, NodeType } from "@/lib/build";
import type { Bounty } from "@/lib/bounty";
import type { NodeTreatment } from "@/hooks/useRebuildDiff";
import {
  GAP_RED,
  HAIRLINE,
  TEAL,
  TEXT_MUTED,
  TEXT_SECONDARY,
  bodyText,
  hexToRgba,
  labelText,
} from "@/components/build/tokens";
import { AddNodeMenu } from "./AddNodeMenu";
import { TreeNode } from "./TreeNode";
import { MAX_DEPTH, findNode, gapDropId, type NodeDrag } from "./useNodeDrag";

/** Indentation per level, matching the public anatomy tree. */
const INDENT = 18;

function GapZone({
  parentId,
  index,
  drag,
}: {
  parentId: string | null;
  index: number;
  drag: NodeDrag;
}) {
  const { setNodeRef } = useDroppable({ id: gapDropId(parentId, index) });
  const isOver =
    drag.overTarget?.kind === "gap" &&
    drag.overTarget.parentId === parentId &&
    drag.overTarget.index === index;
  const refused = isOver && drag.hoverRejection !== null;

  return (
    <div
      ref={setNodeRef}
      aria-hidden="true"
      style={{ height: 10, display: "flex", alignItems: "center", padding: "0 8px" }}
    >
      <div
        style={{
          height: 2,
          width: "100%",
          borderRadius: 2,
          background: isOver ? (refused ? GAP_RED : TEAL) : "transparent",
          transition: "background 120ms ease",
        }}
      />
    </div>
  );
}

interface LevelProps {
  nodes: NodeTreeShape[];
  parentId: string | null;
  depth: number;
  typesByKey: Map<string, NodeType>;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
  drag: NodeDrag;
  rebuildNodes?: Map<string, NodeTreatment> | null;
  bountyNodes?: Map<string, Bounty> | null;
}

function Level({ nodes, parentId, depth, ...shared }: LevelProps) {
  const {
    typesByKey,
    collapsed,
    onToggle,
    selectedNodeId,
    onSelect,
    drag,
    rebuildNodes,
    bountyNodes,
  } = shared;
  const nested = depth > 1;

  return (
    <ul
      role={nested ? "group" : "tree"}
      style={{
        listStyle: "none",
        margin: nested ? `0 0 0 ${INDENT}px` : 0,
        padding: nested ? "0 0 0 12px" : 0,
        // The hairline connector down the left of every nested level.
        borderLeft: nested ? `1px solid ${HAIRLINE}` : "none",
      }}
    >
      <GapZone parentId={parentId} index={0} drag={drag} />
      {nodes.map((node, index) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = hasChildren && !collapsed.has(node.id);
        return (
          <li
            key={node.id}
            role="treeitem"
            aria-selected={selectedNodeId === node.id}
            aria-expanded={hasChildren ? isExpanded : undefined}
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            <TreeNode
              node={node}
              typesByKey={typesByKey}
              isSelected={selectedNodeId === node.id}
              isExpanded={isExpanded}
              onToggle={onToggle}
              onSelect={onSelect}
              drag={drag}
              rebuildNodes={rebuildNodes}
              bountyNodes={bountyNodes}
            />
            {isExpanded ? (
              <Level nodes={node.children} parentId={node.id} depth={depth + 1} {...shared} />
            ) : null}
            <GapZone parentId={parentId} index={index + 1} drag={drag} />
          </li>
        );
      })}
    </ul>
  );
}

/** The drop target for a build with nothing placed yet. */
function EmptyTree({ drag }: { drag: NodeDrag }) {
  const { setNodeRef } = useDroppable({ id: gapDropId(null, 0) });
  const isOver = drag.overTarget?.kind === "gap" && drag.overTarget.parentId === null;

  return (
    <div
      ref={setNodeRef}
      style={{
        padding: "28px 18px",
        borderRadius: 12,
        border: `1px dashed ${isOver ? TEAL : HAIRLINE}`,
        background: isOver ? hexToRgba(TEAL, 0.06) : "transparent",
        textAlign: "center",
        transition: "border-color 120ms ease, background 120ms ease",
      }}
    >
      <p style={{ ...bodyText, margin: 0, color: TEXT_MUTED }}>
        Nothing is placed yet. Drag something across from the tray, or add a node.
      </p>
    </div>
  );
}

/** A refused drop says why, here, rather than doing nothing and looking broken. */
function RejectionBanner({ reason, onDismiss }: { reason: string; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 8,
        background: hexToRgba(GAP_RED, 0.1),
        border: `1px solid ${hexToRgba(GAP_RED, 0.3)}`,
      }}
    >
      <span style={{ ...bodyText, margin: 0, flex: 1, color: GAP_RED }}>{reason}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          color: GAP_RED,
          fontFamily: "inherit",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>
  );
}

interface NodeTreeProps {
  tree: NodeTreeShape[];
  nodeTypes: NodeType[];
  selectedNodeId: string | null;
  onSelect: (id: string | null) => void;
  drag: NodeDrag;
  /**
   * The rebuild treatment for every row, or null on an ordinary draft.
   *
   * Passed straight through rather than computed here: one ChangeSet feeds the
   * tree and the top bar's count, so the two can never say different things
   * about the same edit.
   */
  rebuildNodes?: Map<string, NodeTreatment> | null;
  /**
   * The asks already filed on this build, by gap node id.
   *
   * Passed straight through for the same reason: one read feeds this and the
   * publish sheet's bounty section, so a row cannot claim an ask the sheet is
   * about to offer to file again.
   */
  bountyNodes?: Map<string, Bounty> | null;
}

export function NodeTree({
  tree,
  nodeTypes,
  selectedNodeId,
  onSelect,
  drag,
  rebuildNodes,
  bountyNodes,
}: NodeTreeProps) {
  // Collapsed rather than expanded, so a node nested by a drag and a node just
  // added are both visible without anyone having to open their parent.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const onToggle = useCallback((id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const typesByKey = useMemo(
    () => new Map(nodeTypes.map((type) => [type.key, type])),
    [nodeTypes]
  );

  const levelLabel = useMemo(() => {
    const selected = selectedNodeId ? findNode(tree, selectedNodeId) : null;
    if (!selected) return "the top level";
    const parent = selected.parent_id ? findNode(tree, selected.parent_id) : null;
    return parent ? `inside “${parent.title || parent.type}”` : "the top level";
  }, [selectedNodeId, tree]);

  return (
    <div
      data-visual-slot="compose-node-tree"
      style={{ display: "flex", flexDirection: "column", gap: 10, padding: 18 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{ ...labelText, textTransform: "uppercase", color: TEXT_SECONDARY, flex: 1 }}
        >
          Anatomy
        </span>
        <AddNodeMenu
          nodeTypes={nodeTypes}
          onAdd={drag.addNode}
          disabled={drag.isAdding}
          levelLabel={levelLabel}
        />
      </div>

      <p style={{ ...labelText, margin: 0, color: TEXT_MUTED, fontSize: 11 }}>
        Drag a row onto another to nest it. Nesting stops at {MAX_DEPTH} levels.
      </p>

      {drag.rejection ? (
        <RejectionBanner reason={drag.rejection} onDismiss={drag.dismissRejection} />
      ) : null}

      {tree.length === 0 ? (
        <EmptyTree drag={drag} />
      ) : (
        <Level
          nodes={tree}
          parentId={null}
          depth={1}
          typesByKey={typesByKey}
          collapsed={collapsed}
          onToggle={onToggle}
          selectedNodeId={selectedNodeId}
          onSelect={onSelect}
          drag={drag}
          rebuildNodes={rebuildNodes}
          bountyNodes={bountyNodes}
        />
      )}
    </div>
  );
}
