// The build card (UI-P14): the one card the whole product hangs on its walls.
//
// ONE SURFACE. A picture lamp over a single glass card — `--glass`, a 1px
// `--glass-border`, radius 14, 5px of padding, the card shadow — with a cover
// inside it, and under the cover the record: title, credit, plaque, part chips,
// open ask. It used to be two layers (a frame and a lighter box inset in it, with
// the frame blurred); the step between them is gone, and so is the blur. Panels,
// cards and chips never blur: the header, the build page's plate and, on phones,
// the dock are the page's three blurred surfaces.
//
// THE ORDER IS FIXED, and it is the one thing this card has to get right:
//
//   lamp → cover (with the shape tag) → title → credit and Δ → plaque →
//   part chips → open ask
//
// The title sits under the picture and still wins, by weight (the display role,
// drawn at 19 and rendered at 16 in Figtree 600 since the UI-P52 density pass) and
// by ink (`--text`), where everything under it is 10–11px of `--text2` or mono.
// The density pass took the card's padding and gaps from 7 to 5 and the body's
// from 6 to 4; the cover heights are over the table's band and stay.
// There is no way to render the plaque without the title above it: the title is
// a required prop, and the plaque comes from `build`, which is required too.
//
// THE LAMP IS DATA (RULES §5): `plaqueState(build)` decides it, the same call the
// plaque makes, so the lamp above the card and the claim inside it cannot
// disagree.
//
// THE WHOLE CARD IS ONE LINK to the build, and its accessible name is the title:
// `aria-labelledby` points at the `h3`, so the credit, the counts and the chips
// are the card's description rather than its name, and the cover's alt text
// (which the caller writes: a caption, else "title — kind") describes the
// picture rather than adding a second name for the link.
//
// A GAP IS THE BORDER. An open gap turns the border into 1.5px dashed
// `--cat-breakage` and changes nothing else about the card's colour: the build
// works, one piece is missing on purpose.
//
// This is the pure card. `GalleryCard` is the one that reads a `GalleryBuild`,
// resolves its cover and categories, and hands them here; the catalogue and the
// pages that already hold the pieces render this directly.

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { hoverIsFine, prefersReducedMotion } from "@/lib/theme/controls";
import { feedback } from "@/lib/theme/motion";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { display, DM_MONO, FIGTREE } from "@/lib/theme/type";

import { CategoryChip } from "./CategoryChip";
import { gapEdge } from "./GapMarker";
import { PictureLamp } from "./PictureLamp";
import { Plaque, plaqueState, type PlaqueBuild } from "./Plaque";

/** Cover heights by where the card stands, as the design draws them. */
export const COVER_HEIGHT = {
  /** The catalogue. */
  catalogue: 112,
  /** The gallery wall. */
  wall: 92,
  /** A profile's works. */
  works: 86,
  /** Mobile, two columns. */
  mobile: 96,
} as const;

/** The title's size: 19, or 18 / 17 on a mobile two-column wall. */
export type BuildCardTitleSize = 17 | 18 | 19;

export interface BuildCardProps {
  /** Where the card goes: `/b2/:slug`. */
  to: string;
  title: string;
  /** The cover's picture, filling its box: an `<img>` with `object-fit: cover`, or a `CoverFallback`. */
  cover: ReactNode;
  /** Defaults to the gallery wall's 92. Single-column cards go 120–150. */
  coverHeight?: number;
  /** The shape tag over the cover's top-left: "agent". Absent, no tag. */
  shape?: string | null;
  titleSize?: BuildCardTitleSize;
  /** The line under the title: `<CardCredit>`. */
  credit?: ReactNode;
  /** The change summary on a rebuild, without its "Δ ": "swapped model, added retry". */
  delta?: string | null;
  /** The one record the lamp and the plaque both read. */
  build: PlaqueBuild;
  /** Anything riding at the end of the plaque (the rebuild count). */
  plaqueTrailing?: ReactNode;
  /** Part categories present, in the order to show them. `breakage` is never one. */
  categories?: readonly string[];
  /** "1 part unsolved · £120", when the build has an open ask. */
  openAsk?: string | null;
  /** An open gap: the border goes dashed in `--cat-breakage`. */
  gap?: boolean;
  /** Frozen "now", for a fixture or a test. */
  now?: number;
  /**
   * REPLACES THE COVER BOX. The feed's thread draws its own pictures and
   * unfolds in place, so it takes the cover's place whole — no fixed height, no
   * shape tag, no clipping.
   */
  media?: ReactNode;
  /** After the open ask, last in the body: the engagement row. */
  footer?: ReactNode;
  /** Carried to `data-card-layout`. */
  layout?: string;
  /** Carried to `data-build-shape`. */
  shapeKey?: string;
}

const CARD_BASE: CSSProperties = {
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gap: 5,
  padding: 5,
  background: t.glass,
  borderRadius: r.card,
  boxShadow: t.shadowCard,
  boxSizing: "border-box",
  textDecoration: "none",
  color: t.text,
};

export function BuildCard({
  to,
  title,
  cover,
  coverHeight = COVER_HEIGHT.wall,
  shape,
  titleSize = 19,
  credit,
  delta,
  build,
  plaqueTrailing,
  categories = [],
  openAsk,
  gap = false,
  now,
  media,
  footer,
  layout,
  shapeKey,
}: BuildCardProps) {
  const titleId = `card-title-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [hover, setHover] = useState(false);
  const lifted = hover && hoverIsFine() && !prefersReducedMotion();
  const chips = categories.filter((category) => category !== "breakage");

  return (
    <div data-ui="build-card" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <PictureLamp state={plaqueState(build, now)} />
      <Link
        to={to}
        aria-labelledby={titleId}
        data-visual-slot="gallery-card"
        data-build-shape={shapeKey}
        data-card-layout={layout}
        data-card-lifted={lifted ? "" : undefined}
        data-gap={gap ? "" : undefined}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          ...CARD_BASE,
          ...(gap
            ? gapEdge("card")
            : { borderWidth: 1, borderStyle: "solid", borderColor: lifted ? t.glassHi : t.glassBorder }),
          transform: lifted ? "translateY(-1px)" : "translateY(0)",
          transition: feedback("transform", "border-color"),
        }}
      >
        {media ?? (
          <div style={{ position: "relative", height: coverHeight, borderRadius: r.media, overflow: "hidden" }}>
            {cover}
            {shape ? (
              <span
                data-ui="shape-tag"
                style={{
                  position: "absolute",
                  top: 6,
                  left: 6,
                  background: t.mediaTag,
                  color: t.text,
                  fontFamily: DM_MONO,
                  fontSize: 10,
                  lineHeight: "normal",
                  padding: "2px 4px",
                  borderRadius: r.chip,
                }}
              >
                {shape}
              </span>
            ) : null}
          </div>
        )}

        <div style={{ padding: "0 5px 5px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <h3
            id={titleId}
            data-card-part="title"
            style={{
              ...display(titleSize),
              textWrap: "nowrap",
              margin: 0,
              color: t.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </h3>

          {credit || delta ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              {credit}
              {delta ? (
                <div
                  data-testid="card-delta"
                  style={{
                    fontFamily: DM_MONO,
                    fontSize: 10,
                    /* The kit's own leading: inherited, the page's 1.55 made this
                       line 2.5px taller than the catalogue's. */
                    lineHeight: "normal",
                    color: t.text2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Δ {delta}
                </div>
              ) : null}
            </div>
          ) : null}

          <Plaque build={build} size="card" trailing={plaqueTrailing} now={now} />

          {chips.length > 0 ? (
            <div data-card-part="chips" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {chips.map((category) => (
                <CategoryChip key={category} category={category} label={category} />
              ))}
            </div>
          ) : null}

          {openAsk ? (
            <p
              data-visual-slot="gap-marker"
              data-testid="gallery-card-bounty"
              data-gap-placement="card"
              data-card-part="reward"
              style={{
                margin: 0,
                fontFamily: DM_MONO,
                fontSize: 10,
                lineHeight: "normal",
                color: t.catBreakage,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {openAsk}
            </p>
          ) : null}

          {footer}
        </div>
      </Link>
    </div>
  );
}

export interface CardCreditProps {
  /** The source's title, on a rebuild. */
  rebuiltFrom?: string | null;
  /** Whose: "@maya". On a rebuild it ends the sentence; otherwise it is the whole line, "by @maya". */
  by?: string | null;
}

/**
 * "by @maya", or "Rebuilt from *Inbox sorter* by @maya": Figtree 11, `--text2`,
 * one line with an ellipsis, the source's title in italic `--text`. Nothing when
 * it has neither half.
 */
export function CardCredit({ rebuiltFrom, by }: CardCreditProps) {
  const source = (rebuiltFrom ?? "").trim();
  const who = (by ?? "").trim();
  if (!source && !who) return null;

  const sentence = source ? `Rebuilt from ${source}${who ? ` by ${who}` : ""}` : `by ${who}`;

  return (
    <div
      data-card-part="credit"
      data-testid={source ? "rebuild-credit-line" : undefined}
      data-rebuild-credit={source ? "" : undefined}
      title={sentence}
      style={{
        fontFamily: FIGTREE,
        fontSize: 11,
        lineHeight: "normal",
        color: t.text2,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {source ? (
        <>
          Rebuilt from <i style={{ color: t.text }}>{source}</i>
          {who ? ` by ${who}` : null}
        </>
      ) : (
        `by ${who}`
      )}
    </div>
  );
}

export default BuildCard;
