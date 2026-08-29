// One row of the compose tree.
//
// The row is both a draggable — it is the thing being moved — and a droppable,
// because dropping onto a row is what nests a node inside it. Those are two
// separate refs on two nested elements: the outer div receives drops, the drag
// handle inside it starts drags, so grabbing the handle is unambiguous and the
// rest of the row stays clickable for selection.
//
// Everything here is inline style. Tailwind's generated utilities win over
// hand-written classes at build time, so a class would not survive the build.

import { useState } from "react";
import type { CSSProperties } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NodeTree, NodeType } from "@/lib/build";
import type { Bounty } from "@/lib/bounty";
import type { NodeTreatment } from "@/hooks/useRebuildDiff";
import {
  CATEGORY_COLOUR,
  GAP_RED,
  ORANGE,
  TEAL,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  hexToRgba,
  labelText,
} from "@/components/build/tokens";
import { descendantIds, insideDropId, type NodeDrag } from "./useNodeDrag";

/** Matches the active nav treatment used across the application. */
const SELECTED_BACKGROUND = "rgba(232,87,26,0.08)";

/**
 * What a rebuild's tree says about each row, as an accent and a small label.
 *
 * INHERITED IS THE QUIET ONE, and that is the whole design. A rebuild opens
 * holding somebody else's work; the creator's own contribution is what they
 * need to see. So the material they arrived with recedes to a grey barely above
 * the background, and only what they have touched carries colour — orange for a
 * part they changed, teal for a part they added, matching what those two
 * colours already mean everywhere else in the application.
 *
 * Inherited has no pill: a label on every unchanged row is noise on the
 * majority of the tree, and its silence is already the answer.
 */
const REBUILD_TREATMENT: Record<
  NodeTreatment,
  { accent: string; pill: string | null; colour: string }
> = {
  inherited: { accent: "rgba(255,255,255,0.18)", pill: null, colour: TEXT_MUTED },
  changed: { accent: hexToRgba(ORANGE, 0.75), pill: "changed", colour: ORANGE },
  added: { accent: TEAL, pill: "new", colour: TEAL },
};

/** The 10px marker a touched row carries. Inline, like everything on this
 *  route: a class would not survive the build. */
function TreatmentPill({ treatment }: { treatment: NodeTreatment }) {
  const { pill, colour } = REBUILD_TREATMENT[treatment];
  if (!pill) return null;

  return (
    <span
      data-testid="rebuild-node-pill"
      style={{
        ...labelText,
        flexShrink: 0,
        fontSize: 10,
        padding: "1px 6px",
        borderRadius: 100,
        background: hexToRgba(colour, 0.15),
        color: colour,
        whiteSpace: "nowrap",
      }}
    >
      {pill}
    </span>
  );
}

/**
 * The marker on a gap that somebody has been asked to fill (NS-P51).
 *
 * TEAL, BESIDE THE RED, and the pair is the whole point. The red rule down the
 * left of the row is the hole; this is the ask on it, and teal is what the
 * platform already spends on the actionable half of a gap — the same colour the
 * public page's gap renderer uses for "Solve this and the build is finished".
 * A second red mark would say the same thing twice and read as a warning about
 * the bounty rather than as the bounty.
 *
 * It says "bounty" whatever the reward, because an unpriced bounty is a real
 * one. The amount, and whether the ask is still open, are in the title.
 */
function BountyPill({ bounty }: { bounty: Bounty }) {
  const priced =
    bounty.reward_gbp !== null && bounty.reward_gbp !== undefined
      ? `£${bounty.reward_gbp}`
      : "no reward";
  const solved = bounty.status !== "open";

  return (
    <span
      data-testid="bounty-node-pill"
      data-bounty-status={bounty.status}
      title={`This gap has a bounty on it — ${bounty.status}, ${priced}.`}
      style={{
        ...labelText,
        flexShrink: 0,
        fontSize: 10,
        padding: "1px 6px",
        borderRadius: 100,
        background: hexToRgba(TEAL, solved ? 0.08 : 0.15),
        color: TEAL,
        opacity: solved ? 0.6 : 1,
        whiteSpace: "nowrap",
      }}
    >
      bounty
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      style={{
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 120ms ease",
      }}
    >
      <path d="M3 1 L7 5 L3 9" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function Grip() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden="true">
      {[2, 6, 10].map((y) =>
        [2, 7].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="currentColor" />)
      )}
    </svg>
  );
}

export function TypePill({ nodeType, typeKey }: { nodeType?: NodeType; typeKey: string }) {
  const colour =
    nodeType?.colour ?? CATEGORY_COLOUR[nodeType?.category ?? typeKey] ?? CATEGORY_COLOUR.narrative;
  return (
    <span
      style={{
        ...labelText,
        flexShrink: 0,
        fontSize: 11,
        padding: "1px 8px",
        borderRadius: 100,
        background: hexToRgba(colour, 0.15),
        color: colour,
        whiteSpace: "nowrap",
      }}
    >
      {nodeType?.label ?? typeKey}
    </span>
  );
}

const iconButton: CSSProperties = {
  width: 20,
  height: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  background: "transparent",
  border: "none",
  padding: 0,
  borderRadius: 4,
  color: TEXT_MUTED,
  fontFamily: "inherit",
  cursor: "pointer",
};

interface TreeNodeProps {
  node: NodeTree;
  typesByKey: Map<string, NodeType>;
  isSelected: boolean;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  drag: NodeDrag;
  /**
   * Draft node id -> what it is against the build this one was forked from.
   *
   * Null on an ordinary draft, which is most of them, and the row then looks
   * exactly as it did before NS-P38. A non-null map means this IS a rebuild, so
   * a node the map does not name is inherited and unchanged rather than
   * untreated — that is the quiet grey, and it has to be said for every row the
   * creator has not touched.
   */
  rebuildNodes?: Map<string, NodeTreatment> | null;
  /**
   * Gap node id -> the ask filed against it, from useBuildBounties.
   *
   * Absent while the read is open and on a build that carries none, and the row
   * then looks exactly as it did before NS-P51. Passed as the whole map rather
   * than a boolean so the pill can say what kind of ask it is without a second
   * prop being threaded down here every time it learns something new.
   */
  bountyNodes?: Map<string, Bounty> | null;
}

export function TreeNode({
  node,
  typesByKey,
  isSelected,
  isExpanded,
  onToggle,
  onSelect,
  drag,
  rebuildNodes,
  bountyNodes,
}: TreeNodeProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const nodeType = typesByKey.get(node.type);
  const hasChildren = node.children.length > 0;
  const descendants = descendantIds(node).length;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: node.id,
  });
  const { setNodeRef: setDropRef } = useDroppable({ id: insideDropId(node.id) });

  const isNestTarget =
    drag.overTarget?.kind === "inside" && drag.overTarget.nodeId === node.id;
  const nestRefused = isNestTarget && drag.hoverRejection !== null;

  const treatment: NodeTreatment | null = rebuildNodes
    ? (rebuildNodes.get(node.id) ?? "inherited")
    : null;

  const bounty = bountyNodes?.get(node.id) ?? null;

  // The selected treatment wins over the gap treatment: a creator who has just
  // clicked a row needs to see which row that was more than they need the flag.
  // Both still win over the rebuild treatment, which takes the slot that was
  // transparent before it — the diff is context for the work, and neither
  // "this is the row you are editing" nor "this one is a hole" gives way to it.
  const accent = isSelected
    ? ORANGE
    : node.is_gap
      ? GAP_RED
      : treatment
        ? REBUILD_TREATMENT[treatment].accent
        : "transparent";

  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px 6px 8px",
    borderRadius: 8,
    borderLeft: `2px solid ${accent}`,
    background: isSelected
      ? SELECTED_BACKGROUND
      : isNestTarget
        ? hexToRgba(nestRefused ? GAP_RED : TEAL, 0.08)
        : "transparent",
    outline: isNestTarget ? `1px dashed ${nestRefused ? GAP_RED : TEAL}` : "none",
    outlineOffset: -1,
    opacity: isDragging ? 0.4 : 1,
    transition: "background 120ms ease, outline-color 120ms ease",
  };

  const deleteNode = () => drag.removeNode(node.id);

  return (
    <>
      <div
        ref={setDropRef}
        style={rowStyle}
        data-node-id={node.id}
        data-rebuild={treatment ?? undefined}
      >
        <button
          type="button"
          ref={setDragRef}
          {...listeners}
          {...attributes}
          aria-label={`Drag ${node.title || node.type}`}
          style={{ ...iconButton, cursor: "grab", touchAction: "none" }}
        >
          <Grip />
        </button>

        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            aria-label={isExpanded ? "Collapse" : "Expand"}
            style={{ ...iconButton, color: TEXT_SECONDARY }}
          >
            <Chevron open={isExpanded} />
          </button>
        ) : (
          <span style={{ width: 20, flexShrink: 0 }} aria-hidden="true" />
        )}

        <button
          type="button"
          onClick={() => onSelect(node.id)}
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "transparent",
            border: "none",
            padding: 0,
            textAlign: "left",
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          <TypePill nodeType={nodeType} typeKey={node.type} />
          <span
            style={{
              fontSize: 13,
              fontWeight: 300,
              color: node.title ? TEXT_PRIMARY : TEXT_MUTED,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {node.title || `Untitled ${nodeType?.label ?? node.type}`}
          </span>
        </button>

        {bounty ? <BountyPill bounty={bounty} /> : null}

        {treatment ? <TreatmentPill treatment={treatment} /> : null}

        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Actions for ${node.title || node.type}`}
              style={{ ...iconButton, color: TEXT_SECONDARY, fontSize: 14, lineHeight: 1 }}
            >
              ⋯
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            data-visual-slot="modal-surface"
            style={{ fontFamily: "inherit" }}
          >
            <DropdownMenuItem
              onSelect={() => drag.moveToTray(node.id)}
              style={{ ...labelText, color: TEXT_PRIMARY, cursor: "pointer" }}
            >
              Move to tray
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                // A leaf goes straight away; anything with descendants asks
                // first, because the cascade takes them all.
                if (descendants > 0) setConfirmOpen(true);
                else deleteNode();
              }}
              style={{ ...labelText, color: GAP_RED, cursor: "pointer" }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent data-visual-slot="modal-surface" style={{ fontFamily: "inherit" }}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete “{node.title || node.type}” and everything under it?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This node has {descendants === 1 ? "1 node" : `${descendants} nodes`} nested
              under it. Deleting it removes{" "}
              {descendants === 1 ? "both of them" : `all ${descendants + 1} of them`}. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction onClick={deleteNode} style={{ background: GAP_RED, color: "#fff" }}>
              Delete {descendants + 1} nodes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
