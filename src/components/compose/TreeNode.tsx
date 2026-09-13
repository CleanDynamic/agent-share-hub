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
import { prefersReducedMotion } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t, tokenAlpha } from "@/lib/theme/tokens";
import { body, data as dataType, eyebrow } from "@/lib/theme/type";
import { CategoryChip } from "@/components/brand/CategoryChip";
import { gapEdge } from "@/components/brand/GapMarker";
import { descendantIds, insideDropId, type NodeDrag } from "./useNodeDrag";

/**
 * The chosen row: a low-alpha `--action` ground under an `--action` left edge.
 *
 * It was `rgba(232,87,26,0.08)` — the legacy orange, struck for one dark room
 * and black-on-black in the light one. The same pair now dresses the tray's
 * selected item, so the two panels of the workspace agree about what "this is
 * the row you are editing" looks like.
 */
const SELECTED_BACKGROUND = tokenAlpha("action", 0.1);

/**
 * The row's feedback: 200ms, transform and opacity only, nothing for a creator
 * who asked for less motion. Read at render, so an OS setting changed
 * mid-session takes effect on the next paint.
 */
function rowTransition(): string | undefined {
  return prefersReducedMotion()
    ? undefined
    : "transform 200ms cubic-bezier(.2,.6,.35,1), opacity 200ms cubic-bezier(.2,.6,.35,1)";
}

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
  inherited: { accent: t.line, pill: null, colour: t.text2 },
  changed: { accent: t.action, pill: "changed", colour: t.action },
  added: { accent: t.evidence, pill: "new", colour: t.evidence },
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
        ...dataType,
        flexShrink: 0,
        fontSize: 10,
        padding: "1px 6px",
        /* --r-chip. Nothing is a pill: the capsule rule was removed with the
           rest of the shape language, and 100px on a badge is off-brand now. */
        borderRadius: r.chip,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: colour,
        background: "transparent",
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
 * EVIDENCE, BESIDE THE BREAKAGE, and the pair is the whole point. The red rule down the
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
        ...dataType,
        flexShrink: 0,
        fontSize: 10,
        padding: "1px 6px",
        // --r-chip. Nothing is a pill, whatever this one is called.
        borderRadius: r.chip,
        background: t.evidenceFill,
        color: t.text,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: t.evidence,
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

/**
 * BG-P11: the shared chip, which also takes this off `border-radius: 100` —
 * the capsule the theme dropped by decision. The name stays `TypePill` because
 * four files import it under that name and renaming it is a change of its own.
 *
 * BG-P05's rule is unchanged: the chip is the node's CATEGORY in one of the
 * nine hues rather than `node_types.colour`, falling back to the type key so a
 * node whose registry row has not loaded still resolves, and to --cat-fallback
 * when neither is one of the nine.
 */
export function TypePill({ nodeType, typeKey }: { nodeType?: NodeType; typeKey: string }) {
  return (
    <CategoryChip
      category={nodeType?.category ?? typeKey}
      label={nodeType?.label ?? typeKey}
      style={{ flexShrink: 0 }}
    />
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
  borderRadius: r.chip,
  color: t.text2,
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
    ? t.action
    : node.is_gap
      ? t.catBreakage
      : treatment
        ? REBUILD_TREATMENT[treatment].accent
        : "transparent";

  /* A GAP'S EDGE IS DASHED, and that is the whole difference between a hole and
     a fault. It is GapMarker's `gapEdge("row")` rather than a dash written out
     here, so the composer, the public part list and the card cannot drift to
     three different dashes — the same reason NodeCard takes it. Selected still
     wins: a creator who has just clicked a row needs to see which row that was,
     and a selected gap keeps its category chip saying what kind of hole it is.

     THE LEFT CORNERS GO SQUARE WHENEVER AN ACCENT SHOWS, and that is a fix
     rather than a liberty. `--r-control` is 12px and a tree row is about 30px
     tall, so a rounded left edge leaves roughly six straight pixels between two
     curves — a solid rule survives that, but a DASHED one lands its dashes on
     the curve and renders as a small broken parenthesis floating beside the
     row. Squaring the two corners the accent runs down turns it back into an
     edge; every other corner keeps the scale. A row with no accent is rounded
     all the way round, as before. */
  const gapAccent = !isSelected && node.is_gap;
  const accented = accent !== "transparent";

  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px 6px 8px",
    /* A row is a row: --r-control. The ground is --bg, so the tree reads as the
       working surface it is rather than as a stack of cards. */
    borderRadius: r.control,
    borderTopLeftRadius: accented ? 0 : r.control,
    borderBottomLeftRadius: accented ? 0 : r.control,
    /* LONGHANDS, NOT `borderLeft`. A CSS shorthand whose value contains a
       `var()` is dropped wholesale by jsdom's parser, so the accent that says
       "selected" or "unsolved" would be invisible to every unit test even though
       a browser paints it — which is how an untested repaint slips through.
       WorkspaceBar, controls.ts and GapMarker take the same position. */
    ...(gapAccent
      ? gapEdge("row")
      : { borderLeftWidth: 2, borderLeftStyle: "solid" as const, borderLeftColor: accent }),
    background: isSelected
      ? SELECTED_BACKGROUND
      : isNestTarget
        ? tokenAlpha(nestRefused ? "cat-breakage" : "action", 0.1)
        : "transparent",
    outlineWidth: isNestTarget ? 1 : 0,
    outlineStyle: isNestTarget ? "dashed" : "none",
    outlineColor: nestRefused ? t.catBreakage : t.action,
    outlineOffset: -1,
    /* 0.6, not 0.4: the row being dragged still has to be readable, because it
       is the thing the creator is aiming. */
    opacity: isDragging ? 0.6 : 1,
    transition: rowTransition(),
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
            style={{ ...iconButton, color: t.text2 }}
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
              ...body,
              fontSize: 13,
              fontWeight: 400,
              color: node.title ? t.text : t.text2,
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
              style={{ ...iconButton, color: t.text2, fontSize: 14, lineHeight: 1 }}
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
              style={{ ...body, fontSize: 13, color: t.text, cursor: "pointer" }}
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
              style={{ ...body, fontSize: 13, color: t.catBreakage, cursor: "pointer" }}
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
            {/* --on-action is the measured ink for a filled control; "#fff" was
                a guess that happened to pass on one ground. */}
            <AlertDialogAction
              onClick={deleteNode}
              style={{ background: t.catBreakage, color: t.onAction }}
            >
              Delete {descendants + 1} nodes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
