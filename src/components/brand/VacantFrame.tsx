// The vacant frame (UI-P15): the bounty card — an empty frame on the wall where
// one part of a working build is missing, with a reward.
//
// THE FRAME IS THE GAP. A picture lamp over a card with a 1.5px dashed
// `--cat-breakage` border (the same dashed edge a build card takes for an open
// gap), a cover with the MISSING window centred on it, then the build's title
// and the reward, then the gap's own category and what is happening around it.
//
// THE LAMP IS ALWAYS DIM. On a build card the lamp reports the build's freshness;
// here it marks the missing part, so it is `stale` whatever the build's state —
// lit would say the thing was complete.
//
// THE CHIP KEEPS ITS TRUE CATEGORY, as everywhere a gap is shown: a gap on a
// configuration is still configuration, and the breakage hue is spent on the
// edge instead.
//
// A LINK OR A SELECTION. Given `to` the whole card is a link (to the solve view)
// named by the title; given `onSelect` it is a button that selects the bounty —
// the Bounties page on desktop, where a click chooses the ask rather than leaves
// the board. `selected` swaps the ground to `--row-highlight`.

import { useId, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { MissingWindow } from "@/components/bounty/MissingWindow";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { display, DM_MONO } from "@/lib/theme/type";

import { CategoryChip } from "./CategoryChip";
import { gapEdge } from "./GapMarker";
import { PictureLamp } from "./PictureLamp";

export interface VacantFrameProps {
  /** The build's title. */
  title: string;
  /** The picture the window is laid on: the build's cover or a `CoverFallback`, filling its box. */
  cover: ReactNode;
  /** The missing part's name: "Duplicate detector". */
  part: string;
  /** The reward as money, "£400". Absent for an unpriced ask: nothing is drawn. */
  reward?: string | null;
  /** The gap's own category and its label. Absent on a build-level ask, which names no part. */
  category?: string | null;
  categoryLabel?: string | null;
  /** "9 days": what is left, without the "closes in". */
  closesIn?: string | null;
  solutions: number;
  meToo: number;
  /** The card is a link to the solve view. */
  to?: string;
  /** Or a button that selects the bounty. */
  onSelect?: () => void;
  selected?: boolean;
}

const FRAME: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 7,
  borderRadius: r.card,
  boxShadow: t.shadowCard,
  boxSizing: "border-box",
  textAlign: "left",
  textDecoration: "none",
  color: t.text,
};

/** "5 solutions · 14 me too", after the deadline when there is one. */
export function vacantMeta({
  closesIn,
  solutions,
  meToo,
}: Pick<VacantFrameProps, "closesIn" | "solutions" | "meToo">): string {
  const parts: string[] = [];
  if (closesIn) parts.push(closesIn);
  parts.push(solutions === 1 ? "1 solution" : `${solutions} solutions`);
  parts.push(`${meToo} me too`);
  return parts.join(" · ");
}

export function VacantFrame({
  title,
  cover,
  part,
  reward,
  category,
  categoryLabel,
  closesIn,
  solutions,
  meToo,
  to,
  onSelect,
  selected = false,
}: VacantFrameProps) {
  const titleId = `vacant-title-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const { state, handlers } = useInteractive<HTMLElement>();

  const style: CSSProperties = {
    ...FRAME,
    ...gapEdge("card"),
    background: selected ? t.rowHighlight : t.glass,
    ...ring(state.focusVisible),
  };

  const press = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect?.();
    }
  };

  const inner = (
    <>
      <div style={{ position: "relative", height: 104, borderRadius: r.media, overflow: "hidden" }}>
        {cover}
        <MissingWindow part={part} />
      </div>
      <div style={{ padding: "0 5px 5px", display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
          <h3
            id={titleId}
            style={{
              ...display(18),
              textWrap: "nowrap",
              margin: 0,
              color: t.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {title}
          </h3>
          {reward ? (
            <span data-testid="vacant-reward" style={{ fontFamily: DM_MONO, fontSize: 18, color: t.text, flexShrink: 0 }}>
              {reward}
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {category && categoryLabel ? <CategoryChip category={category} label={categoryLabel} /> : null}
          <span style={{ fontFamily: DM_MONO, fontSize: 10, color: t.text2 }}>
            {vacantMeta({ closesIn, solutions, meToo })}
          </span>
        </div>
      </div>
    </>
  );

  return (
    <div
      data-ui="vacant-frame"
      data-variant={selected ? "selected" : undefined}
      style={{ display: "flex", flexDirection: "column", minWidth: 0 }}
    >
      {/* Always dim: the lamp marks the missing part, not the build's freshness. */}
      <PictureLamp state="stale" />
      {to ? (
        <Link to={to} aria-labelledby={titleId} {...handlers} style={style}>
          {inner}
        </Link>
      ) : (
        // A div, not a button: the card holds a heading and blocks, which a
        // button's content model does not allow. `role="button"` makes its
        // children presentational, so its name is the title by `aria-labelledby`.
        <div
          role="button"
          tabIndex={0}
          aria-labelledby={titleId}
          aria-pressed={selected}
          onClick={onSelect}
          onKeyDown={press}
          {...handlers}
          style={{ ...style, cursor: "pointer" }}
        >
          {inner}
        </div>
      )}
    </div>
  );
}

export default VacantFrame;
