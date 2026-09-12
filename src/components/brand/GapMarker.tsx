// The gap marker: a part deliberately unsolved, in three placements (BG-P11).
//
// IT IS AN INVITATION AND NOT A DEFECT. The build works; one piece is missing
// on purpose, and the creator wrote it down rather than leaving it out. Every
// choice here follows from that: the ordinary shape of whatever it is marking
// with its edge redrawn, never a warning container; the invitation in words
// before the problem; and no red on anything but the EDGE.
//
// THE CHIP KEEPS ITS TRUE CATEGORY, which is the one rule about this that is
// easy to get wrong and expensive to get wrong. A gap on an agent config is
// still configuration — that is what routes it to people who write agent
// configs — so the chip is `categoryFill(category)` like every other chip on
// the platform and the breakage hue is spent on the dashed edge instead. A red
// chip would say "this part is a breakage", which is a different and untrue
// claim: the part is a configuration, and the thing that is missing is its
// content.
//
// WHAT WAS HERE BEFORE. Three renderings, all of them separately invented: the
// gallery card's frame set its own 1.5px dashed border and printed its own
// reward line, NodeCard drew a 3px SOLID left edge (solid says "this is what it
// is"; dashed says "this is where something goes"), and GapPanel drew a 1px
// solid container in a hexToRgba red with a hand-rolled teal button for its
// primary action. The three are now one edge, one marker and one button.
//
// SOLVED RESOLVES THE DASHES. A filled gap keeps its edge and turns it solid in
// `--evidence`: the shape a reader learned to recognise stays put and its state
// changes, which is what makes the change legible at all.
//
// Styled with inline style objects, like every other surface on the new path:
// Tailwind's generated utilities win over hand-written classes at build time.

import type { CSSProperties, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { CategoryChip } from "./CategoryChip";
import { chipStyle } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { body as bodyText, data as dataText, eyebrow as eyebrowText, tabular } from "@/lib/theme/type";

/**
 * Where the marker is standing.
 *
 *   card    on a build card. The EDGE is the whole treatment and this renders
 *           the mono line under the chips — "1 part unsolved · £150". No
 *           container, because a container inside a card is a second card.
 *   row     in a part list, under or beside the part it is about. A dashed left
 *           edge, the part's own chip, and what state the ask is in.
 *   panel   the full ask: the invitation, the problem in the creator's words,
 *           the reward, the deadline, the solution count and ONE primary action.
 */
export type GapPlacement = "card" | "row" | "panel";

/** Unsolved; unsolved with money on it; filled. */
export type GapState = "unsolved" | "funded" | "solved";

/** The invitation. A constant because it is the design, not a string. */
export const GAP_INVITATION = "This part is unsolved — the build works without it.";

/**
 * And what the same sentence becomes once somebody has answered it.
 *
 * The shape does not change when a gap is filled and neither does the claim it
 * makes about the build: the build always worked without this part. What
 * changes is the tense, which is the whole point of a gap reading as an
 * invitation — it was answered, rather than fixed.
 */
export const GAP_SOLVED = "This part was unsolved — somebody answered it.";

/** What the row says, per state. Never an apology, never a defect. */
const ROW_WORD: Record<GapState, string> = {
  unsolved: "unsolved",
  funded: "unsolved",
  solved: "solved",
};

/** The edge's weight. The theme's own number, and the same in all three. */
const EDGE_WIDTH = 1.5;

/** A tag's padding, matching CategoryChip's so a row of them is one row. */
const PAD = "2px 8px";

/**
 * The state, from the two facts that decide it.
 *
 * A gap with a reward on it is "funded" rather than a second kind of thing: it
 * is the same ask with money attached, and the only visible difference is that
 * the reward is there to print.
 */
export function gapState(solved: boolean, reward?: string | null): GapState {
  if (solved) return "solved";
  return reward ? "funded" : "unsolved";
}

/**
 * The edge a host surface spends, as a style object.
 *
 * EXPORTED BECAUSE THE EDGE IS NOT ALWAYS THIS COMPONENT'S ELEMENT. On a card
 * the border belongs to the card's own frame and on a node it belongs to the
 * node's article — neither may be wrapped in a marker without changing the
 * surface's structure, which this prompt is not allowed to do. So the edge is a
 * value those surfaces apply to the element they already have.
 *
 * LONGHANDS RATHER THAN THE `border` SHORTHAND. A shorthand whose colour is a
 * `var()` is valid CSS that jsdom's cssstyle drops whole, taking the width and
 * the style with it — so the dashes would vanish from every unit test that
 * renders one. Split, the geometry survives the test environment and the colour
 * is the token in a browser. See the same note in NodeCard.tsx.
 */
export function gapEdge(placement: GapPlacement, state: GapState = "unsolved"): CSSProperties {
  // Solid in --evidence once it is filled: the shape stays, the state changes.
  const style = state === "solved" ? ("solid" as const) : ("dashed" as const);
  const colour = state === "solved" ? t.evidence : t.catBreakage;

  if (placement === "row") {
    return { borderLeftWidth: EDGE_WIDTH, borderLeftStyle: style, borderLeftColor: colour };
  }

  return {
    borderWidth: EDGE_WIDTH,
    borderStyle: style,
    borderColor: colour,
    ...(placement === "panel" ? { borderRadius: r.panel } : null),
  };
}

export interface GapMarkerProps {
  placement?: GapPlacement;
  state?: GapState;
  /**
   * The host surface's own testid for this marker.
   *
   * Kept as a prop rather than fixed, because the three placements landed on
   * surfaces that already had established testids — `gap-panel` on the build
   * page and `gallery-card-bounty` on a card — and a consolidation that
   * silently renamed the selectors every spec uses would be a consolidation
   * that broke the suite for no reader's benefit.
   */
  testId?: string;
  /**
   * The part's OWN category, never breakage.
   *
   * Absent on a build-level ask, which names no part — and then no chip
   * renders, because inventing a category to fill the slot would route the ask
   * to the wrong solvers, which is the whole job the chip does.
   */
  category?: string | null;
  /** The chip's words. The registry's label for the part's type. */
  categoryLabel?: string | null;
  /** What is missing, in the creator's words. Absent is an ordinary state. */
  problem?: string | null;
  /** What the creator says when they have not written the problem down. */
  problemFallback?: string;
  /** rewardLabel's string, or null. Never composed here. */
  reward?: string | null;
  /** deadlineLabel's string, or null. */
  deadline?: string | null;
  /** solutionCountLabel's string, or null. */
  solutions?: string | null;
  /** The card placement's whole line: "1 part unsolved · £150". */
  summary?: string | null;
  /** Who filled it, once it is filled. */
  solvedNote?: ReactNode;
  /**
   * The panel's ONE primary action, rendered as the BG-P07 primary button.
   *
   * A description rather than a rendered node, so the panel cannot be handed a
   * second primary or a button that is not the kit's.
   */
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    testId?: string;
  };
  /** Everything else the panel offers. Secondary and tertiary only. */
  secondaryActions?: ReactNode;
  /** Anything the panel hangs at the bottom — an error, a mounted sheet. */
  children?: ReactNode;
}

export function GapMarker({
  placement = "row",
  state = "unsolved",
  testId,
  category,
  categoryLabel,
  problem,
  problemFallback,
  reward,
  deadline,
  solutions,
  summary,
  solvedNote,
  primaryAction,
  secondaryActions,
  children,
}: GapMarkerProps) {
  const chip =
    category && categoryLabel ? (
      // NEVER OVERRIDDEN TO RED. See the note at the top of this file.
      <CategoryChip category={category} label={categoryLabel} />
    ) : null;

  if (placement === "card") {
    // The card's edge is the treatment; this is the line under the chips. No
    // container — a container inside a card is a second card.
    if (!summary) return null;
    return (
      <p
        data-visual-slot="gap-marker"
        data-testid={testId}
        data-gap-placement="card"
        data-gap-state={state}
        data-card-part="reward"
        style={{
          ...dataText,
          ...tabular,
          margin: 0,
          color: state === "solved" ? t.evidence : t.catBreakage,
        }}
      >
        {summary}
      </p>
    );
  }

  if (placement === "row") {
    return (
      <span
        data-visual-slot="gap-marker"
        data-testid={testId}
        data-gap-placement="row"
        data-gap-state={state}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}
      >
        {chip}
        {/* THE STATE WORD IS A TAG ON ITS OWN MEASURED GROUND, not a bare hue.
            It was the hue as text, which is the pairing `critique-color` caught:
            the nine were each measured against `--bg`, and a part row sits on
            `--recess` or on a card's glass, where breakage-as-text falls to
            4.23–4.47 against a 4.5 floor. The measured pair is legal on any
            ground because the fill is opaque — the theme's own first remedy,
            reuse a legal pairing, rather than moving the hue. */}
        <span
          data-gap-word=""
          style={{
            ...chipStyle("category", { category: state === "solved" ? "evidence" : "breakage" }),
            padding: PAD,
            whiteSpace: "nowrap",
          }}
        >
          {ROW_WORD[state]}
        </span>
        {reward ? (
          <span
            data-gap-reward=""
            style={{
              ...chipStyle("category", { category: "breakage" }),
              ...tabular,
              padding: PAD,
            }}
          >
            {reward}
          </span>
        ) : null}
        {solvedNote}
      </span>
    );
  }

  return (
    <div
      data-visual-slot="gap-marker"
      data-testid={testId}
      data-gap-placement="panel"
      data-gap-state={state}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "12px 14px",
        ...gapEdge("panel", state),
        /* NO TINTED GROUND. The dashed edge is the whole treatment the theme
           names, and a red wash behind an invitation reads as an error box —
           which is the one thing this must never read as. */
        background: "transparent",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span
          data-gap-eyebrow=""
          style={{ ...eyebrowText, color: state === "solved" ? t.evidence : t.catBreakage }}
        >
          {state === "solved" ? "Solved" : "Open bounty"}
        </span>
        {chip}
      </div>

      <p style={{ ...bodyText, margin: 0, color: t.text }}>
        {state === "solved" ? GAP_SOLVED : GAP_INVITATION}
      </p>

      <p
        data-testid="gap-problem-statement"
        /* Both the creator's words and the stand-in are `--text2`: the
           invitation above is the panel's lead and these qualify it. The
           legacy palette had a third, dimmer grey for the stand-in; this theme
           has two text tokens and the sentence carries the difference. */
        style={{ ...bodyText, margin: 0, color: t.text2, whiteSpace: "pre-wrap" }}
      >
        {problem || problemFallback}
      </p>

      {/* The facts that are only sometimes true. None is invented: an unpriced
          ask shows no reward and one with no deadline shows no date. */}
      {reward || deadline ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {reward ? (
            <span
              data-testid="gap-reward"
              style={{
                /* The BREAKAGE category's own measured pair, which is where the
                   hue is legal as ink: on the ground that was measured under
                   it. The fill is opaque, so it holds on a glass card, a recess
                   or the page alike. */
                ...chipStyle("category", { category: "breakage" }),
                ...tabular,
                padding: PAD,
              }}
            >
              {reward}
            </span>
          ) : null}
          {deadline ? (
            <span
              data-testid="gap-deadline"
              style={{ ...chipStyle("neutral"), ...tabular, padding: PAD }}
            >
              {deadline}
            </span>
          ) : null}
        </div>
      ) : null}

      {primaryAction || secondaryActions || solutions ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {primaryAction ? (
            <Button
              type="button"
              size="sm"
              data-testid={primaryAction.testId}
              disabled={primaryAction.disabled}
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </Button>
          ) : null}
          {secondaryActions}
          {solutions ? (
            <span
              data-testid="gap-solution-count"
              style={{ ...dataText, color: t.text2 }}
            >
              {solutions}
            </span>
          ) : null}
        </div>
      ) : null}

      {solvedNote}
      {children}
    </div>
  );
}

export default GapMarker;
