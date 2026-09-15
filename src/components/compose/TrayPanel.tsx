// The unassigned tray: the left panel of the compose workspace.
//
// A tray node is one with position IS NULL. It is captured but not placed: it
// does not render publicly, it is not exported, and it does not count towards
// the build.
//
// THE PANEL EARNS ITS SPACE (NS-P30)
// ----------------------------------
// An empty tray is not a feature to advertise. It collapses to one slim muted
// line — "Not placed yet · 0" — and says nothing else, because a creator who
// has never put anything here does not need a paragraph about it. The privacy
// promise appears only once there is something for it to be a promise about,
// and it is worded as a plain statement rather than a policy:
//
//   "Nothing here is in your post yet. It stays private until you place it."
//
// The one thing an empty tray still does is answer a drag. The whole panel is
// one droppable, and while a node is held over it the drop hint comes back:
// that is a reply to the creator's own gesture, not an idle invitation.
//
// NS-P34 will land Build File imports here. `justArrived` is the seam it needs
// and nothing sets it today — a positive count renders one line above the
// list, an absent or zero count renders nothing at all.
//
// BG-P23 — REPAINTED, AND THE GLASS IS GONE. Every item used to be `cardGlass`,
// which is `--glass-2` plus a `--glass-border`: three blurred surfaces per tray
// and a blurred panel behind them, in the one place the theme forbids glass
// outright. A working surface carries depth with `--recess` and hairlines so the
// content is what stands out, and this panel is now flat. The item's own prose
// also came off weight 300, which is below the theme's floor for anything under
// 18px — a label nobody can read is not a quieter label.

import type { CSSProperties } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { Json } from "@/integrations/supabase/types";
import type { BuildNode, NodeType } from "@/lib/build";
import { r } from "@/lib/theme/radius";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { body, data as dataType, eyebrow } from "@/lib/theme/type";
import { TypePill } from "./TreeNode";
import { TRAY_DROP_ID, type NodeDrag } from "./useNodeDrag";
import { feedback } from "@/lib/theme/motion";

/** Long enough to recognise the thing, short enough to stay one or two lines. */
const SUMMARY_LIMIT = 110;

/**
 * The privacy line, reworded (BG-P23) and held as a constant because it is a
 * promise rather than a caption.
 *
 * It said "These aren't in your post. They stay private until you place them."
 * Plural agreement with a one-item tray was the smaller problem; the larger one
 * is that the composer now has a POST at the top of it, so "your post" names a
 * thing on screen and the sentence can point at it plainly.
 */
const TRAY_PRIVACY = "Nothing here is in your post yet. It stays private until you place it.";

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
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "10px 10px 10px 8px",
    /* An item is a row, so `--r-control`. Flat on the ground with one hairline;
       selection is a `--action` left edge over a low-alpha `--action` ground,
       the same two moves the tree's selected row makes, so the two panels agree
       about what "chosen" looks like. */
    borderRadius: r.control,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: t.line,
    borderLeftWidth: 2,
    borderLeftColor: isSelected ? t.action : t.line,
    background: isSelected ? tokenAlpha("action", 0.1) : t.bg,
    opacity: isDragging ? 0.6 : 1,
    cursor: "grab",
    touchAction: "none",
    textAlign: "left",
    fontFamily: "inherit",
    width: "100%",
    /* transform and opacity only; a colour change is cheap but a shadow is not. */
    transition: feedback("opacity"),
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
            ...body,
            fontSize: 13,
            fontWeight: 400,
            lineHeight: 1.5,
            color: summary ? t.text : t.text2,
          }}
        >
          {summary ?? `Untitled ${nodeType?.label ?? node.type}`}
        </span>
        {/* Where it was captured from is data about the row, so mono. */}
        {source ? (
          <span style={{ ...dataType, fontSize: 11, color: t.text2 }}>{source}</span>
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
  /**
   * How many nodes have just arrived from an import, for the one-line banner.
   *
   * The seam for NS-P34's Build File drop and nothing else. It is a count, not
   * a flag, because the banner names the number; an absent or zero count is the
   * ordinary tray and renders no banner at all. Whoever sets it owns clearing
   * it — this panel never writes it, so the banner stays up until the surface
   * that raised it decides the arrival has been seen.
   */
  justArrived?: number;
}

export function TrayPanel({
  tray,
  nodeTypes,
  selectedNodeId,
  onSelect,
  drag,
  justArrived,
}: TrayPanelProps) {
  const { setNodeRef } = useDroppable({ id: TRAY_DROP_ID });
  const typesByKey = new Map(nodeTypes.map((type) => [type.key, type]));
  const isOver = drag.overTarget?.kind === "tray";
  const hasItems = tray.length > 0;
  // Guarded rather than trusted: a caller counting wrong must not put "0 items
  // arrived" or "-1 items arrived" on the panel.
  const arrived =
    typeof justArrived === "number" && Number.isFinite(justArrived)
      ? Math.max(0, Math.trunc(justArrived))
      : 0;

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
        /* The drop answer is a ground, not a glow: --recess is the token for a
           surface the page is cut into, which is what a target should look like
           while something is held over it. */
        background: isOver ? t.recess : "transparent",
        transition: feedback("background-color"),
      }}
    >
      {/* The whole panel when the tray is empty: a count, in the quietest
          weight the token set has, naming what it is in words a creator would
          use rather than the word "tray". */}
      {/* Mono, and tabular, because this is a count: the digit must not shift
          the label as the tray fills. --text2 in both states — the theme
          publishes two text tokens, not three, and the collapsed header was
          reaching for a third rung that was never legible. */}
      <span
        data-testid="tray-header"
        style={{
          ...eyebrow,
          color: hasItems ? t.text : t.text2,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {`Not placed yet · ${tray.length}`}
      </span>

      {arrived > 0 ? (
        <p
          data-testid="tray-arrival"
          style={{
            ...body,
            margin: 0,
            padding: "8px 10px",
            borderRadius: r.chip,
            /* --evidence-fill is the measured ground for "this happened". The
               ink on it is --text, which the theme measures at 11.89 on
               Exhibition and higher on Dusk — --evidence on that fill is 4.44 in
               the light room, under the 4.5 text floor, so it carries the border
               instead, where the floor is 3.0. */
            border: `1px solid ${t.evidence}`,
            background: t.evidenceFill,
            fontSize: 12,
            lineHeight: 1.5,
            color: t.text,
          }}
        >
          {`${arrived} ${arrived === 1 ? "item" : "items"} arrived — drag the keepers into your build`}
        </p>
      ) : null}

      {hasItems ? (
        /* Shown only against something: an empty tray needs no promise about
           material it does not hold. */
        <p
          style={{
            ...body,
            margin: 0,
            padding: "8px 10px",
            borderRadius: r.chip,
            border: `1px solid ${t.line}`,
            background: t.recess,
            fontSize: 12,
            lineHeight: 1.5,
            color: t.text2,
          }}
        >
          {TRAY_PRIVACY}
        </p>
      ) : null}

      {hasItems ? (
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
      ) : isOver ? (
        // Nothing at rest, but a drag still gets an answer: this hint is a reply
        // to a gesture the creator is already making, not an idle invitation.
        <p style={{ ...body, fontSize: 13, lineHeight: 1.6, margin: 0, color: t.text2 }}>
          Drop it here to unplace it.
        </p>
      ) : null}
    </div>
  );
}
