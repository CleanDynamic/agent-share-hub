// The unassigned tray: the left panel of the compose workspace.
//
// A tray node is one with position IS NULL. It is captured but not placed: it
// does not render publicly, it is not exported, and it does not count towards
// the build. The line at the top of this panel says exactly that and never goes
// away, because it is what lets a creator drop something in without first
// deciding where it belongs.
//
// The whole panel is one droppable, so dragging a node anywhere over the tray
// unplaces it. Each item is draggable back out into the tree.

import type { CSSProperties } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { Json } from "@/integrations/supabase/types";
import type { BuildNode, NodeType } from "@/lib/build";
import {
  HAIRLINE,
  ORANGE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  cardGlass,
  hexToRgba,
  labelText,
} from "@/components/build/tokens";
import { TypePill } from "./TreeNode";
import { TRAY_DROP_ID, type NodeDrag } from "./useNodeDrag";

/** Long enough to recognise the thing, short enough to stay one or two lines. */
const SUMMARY_LIMIT = 110;

function isRecord(value: unknown): value is Record<string, Json> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * A line of the node's own content, for a node that has no title yet.
 *
 * The first non-empty string in the payload rather than a named field: the
 * payload shape differs per node type, and this panel must not hold a second,
 * drifting copy of the registry's schemas.
 */
export function payloadSummary(payload: Json | null): string | null {
  if (!isRecord(payload)) return null;
  for (const value of Object.values(payload)) {
    if (typeof value === "string" && value.trim().length > 0) {
      const text = value.trim().replace(/\s+/g, " ");
      return text.length > SUMMARY_LIMIT ? `${text.slice(0, SUMMARY_LIMIT - 1)}…` : text;
    }
  }
  return null;
}

/** "from transcript, turn 4" — where the node was captured from. */
export function describeSource(sourceRef: Json | null): string | null {
  if (!isRecord(sourceRef)) return null;

  const named = ["source", "kind", "origin"]
    .map((key) => sourceRef[key])
    .find((value): value is string => typeof value === "string" && value.length > 0);
  if (!named) return null;

  const turn = ["turn", "message", "step"]
    .map((key) => sourceRef[key])
    .find((value): value is number => typeof value === "number");
  if (turn !== undefined) return `from ${named}, turn ${turn}`;

  const index = sourceRef.index;
  if (typeof index === "number") return `from ${named}, item ${index}`;

  return `from ${named}`;
}

function TrayItem({
  node,
  nodeType,
  isSelected,
  onSelect,
}: {
  node: BuildNode;
  nodeType?: NodeType;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: node.id });

  const summary = node.title?.trim() || payloadSummary(node.payload);
  const source = describeSource(node.source_ref);

  const style: CSSProperties = {
    ...cardGlass,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "10px 10px 10px 8px",
    borderLeft: `2px solid ${isSelected ? ORANGE : "transparent"}`,
    background: isSelected ? "rgba(232,87,26,0.08)" : cardGlass.background,
    opacity: isDragging ? 0.4 : 1,
    cursor: "grab",
    touchAction: "none",
    textAlign: "left",
    fontFamily: "inherit",
    width: "100%",
    transition: "background 120ms ease",
  };

  return (
    <li style={{ listStyle: "none" }}>
      <button
        type="button"
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        onClick={() => onSelect(node.id)}
        style={style}
      >
        <TypePill nodeType={nodeType} typeKey={node.type} />
        <span
          style={{
            fontSize: 13,
            fontWeight: 300,
            lineHeight: 1.5,
            color: summary ? TEXT_PRIMARY : TEXT_MUTED,
          }}
        >
          {summary ?? `Untitled ${nodeType?.label ?? node.type}`}
        </span>
        {source ? (
          <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>{source}</span>
        ) : null}
      </button>
    </li>
  );
}

interface TrayPanelProps {
  tray: BuildNode[];
  nodeTypes: NodeType[];
  selectedNodeId: string | null;
  onSelect: (id: string | null) => void;
  drag: NodeDrag;
}

export function TrayPanel({ tray, nodeTypes, selectedNodeId, onSelect, drag }: TrayPanelProps) {
  const { setNodeRef } = useDroppable({ id: TRAY_DROP_ID });
  const typesByKey = new Map(nodeTypes.map((type) => [type.key, type]));
  const isOver = drag.overTarget?.kind === "tray";

  return (
    <div
      ref={setNodeRef}
      data-visual-slot="compose-tray"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 18,
        minHeight: "100%",
        background: isOver ? hexToRgba(TEAL, 0.06) : "transparent",
        transition: "background 120ms ease",
      }}
    >
      <span style={{ ...labelText, textTransform: "uppercase", color: TEXT_SECONDARY }}>
        Tray
      </span>

      {/* Permanent, not a hint that fades: it is the promise that makes the
          tray usable without a decision. */}
      <p
        style={{
          margin: 0,
          padding: "8px 10px",
          borderRadius: 8,
          border: `1px solid ${HAIRLINE}`,
          background: "rgba(255,255,255,0.02)",
          fontSize: 12,
          fontWeight: 500,
          letterSpacing: "0.04em",
          lineHeight: 1.5,
          color: TEXT_SECONDARY,
        }}
      >
        Anything left here stays private and is never published.
      </p>

      {tray.length === 0 ? (
        <p style={{ fontSize: 13, fontWeight: 300, lineHeight: 1.6, margin: 0, color: TEXT_MUTED }}>
          {isOver
            ? "Drop it here to unplace it."
            : "Nothing unplaced. Drag a node here to take it out of the build without losing it."}
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {tray.map((node) => (
            <TrayItem
              key={node.id}
              node={node}
              nodeType={typesByKey.get(node.type)}
              isSelected={selectedNodeId === node.id}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
