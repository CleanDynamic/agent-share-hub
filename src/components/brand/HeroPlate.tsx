// The hero plate (UI-P11): the large composition piece in two variants.
//
//   featured  Gallery's featured build — a picture lamp over a framed row: the
//             cover, and an inverse panel carrying the title, the outcome and the
//             plaque. A numbered square straddles the bottom edge.
//   build     the Build page's title plate — a frosted plate laid over the cover
//             with the mark square at its left. UI-P29 places it; this builds the
//             plate only, absolutely positioned 16px in from the left, right and
//             bottom of whatever positioned box the page puts it in. On a phone
//             (`size="phone"`, UI-P29) the plate sits 10px in, the title is 32px,
//             the credit and the Δ stack, and there is no mark square.
//
// THE PLATE IS ONE OF THREE BLURRED SURFACES. The `build` variant is the only
// blurred element in this file, and `GLASS_BLUR` is the one blur the codebase
// has. A page has three: the header, this plate, and on phones the dock.
//
// THE FEATURED PLATE IS INVERSE, NOT DARK. `--inverse` is near-black on Noon and
// near-white on Dusk, so the panel is the one light-on-dark thing in the room in
// either theme; its ink is `--on-inverse` and `--on-inverse-2`, and its
// reproduction tag is `--inverse-evidence-fill` (`Plaque tone="inverse"`).
//
// WHAT IS PASSED IN. The cover is a node, because the caller resolves it
// (`resolveCover()`, else `CoverFallback` seeded with the build id). The plaque
// and the picture lamp both read the one `build` record, so the lamp above the
// plate and the count inside it cannot disagree.

import type { CSSProperties, ReactNode } from "react";

import { GLASS_BLUR } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { display, DM_MONO, FIGTREE } from "@/lib/theme/type";

import { Mark } from "./Mark";
import { PictureLamp } from "./PictureLamp";
import { Plaque, plaqueState, type PlaqueBuild } from "./Plaque";

export interface FeaturedHeroPlateProps {
  variant: "featured";
  /** The picture: the build's cover, or a `CoverFallback`. Fills its half of the row. */
  cover: ReactNode;
  title: string;
  /** What the build does, in a sentence. */
  outcome: string;
  /** The one record the lamp and the plaque both read. */
  build: PlaqueBuild;
  /** The build's place in the ranking. Shown zero-padded to two digits. */
  rank: number;
  /** The line at the top of the inverse panel. */
  eyebrow?: string;
  /** Frozen "now", for a fixture or a test. */
  now?: number;
  style?: CSSProperties;
}

export interface BuildHeroPlateProps {
  variant: "build";
  title: string;
  outcome: string;
  /** "Rebuilt from *Inbox sorter* by @kofi · made by @maya" — the caller writes the credit. */
  credit: ReactNode;
  /** The change summary, drawn after the credit in mono: "Δ swapped model, added retry step". */
  delta?: string;
  /** `phone`: the 390 board's plate — 10px in, 32px title, credit and Δ stacked, no mark square. */
  size?: "desktop" | "phone";
  style?: CSSProperties;
}

export type HeroPlateProps = FeaturedHeroPlateProps | BuildHeroPlateProps;

/** The default top line of the featured plate. */
export const FEATURED_EYEBROW = "MOST REPRODUCED THIS MONTH";

function Featured({ cover, title, outcome, build, rank, eyebrow = FEATURED_EYEBROW, now, style }: FeaturedHeroPlateProps) {
  return (
    <div
      data-ui="hero-plate"
      data-variant="featured"
      style={{
        position: "relative",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        minHeight: 0,
        ...style,
      }}
    >
      <PictureLamp state={plaqueState(build, now)} />
      <div
        style={{
          display: "flex",
          flexGrow: 1,
          minHeight: 0,
          borderRadius: r.panel,
          overflow: "hidden",
          boxShadow: t.shadowCard,
          border: `1px solid ${t.glassBorder}`,
        }}
      >
        <div style={{ flexGrow: 1.2, flexBasis: 0, position: "relative", minWidth: 0 }}>{cover}</div>
        <div
          style={{
            flexGrow: 1,
            flexBasis: 0,
            minWidth: 0,
            background: t.inverse,
            color: t.onInverse,
            padding: "13px 14px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 9 }}>
            <span
              style={{
                fontFamily: DM_MONO,
                fontSize: 10,
                letterSpacing: ".08em",
                color: t.onInverse2,
              }}
            >
              {eyebrow}
            </span>
            <Mark size={18} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <h2 style={{ ...display(32), margin: 0, color: "inherit" }}>{title}</h2>
            <div style={{ fontFamily: FIGTREE, fontSize: 12, lineHeight: 1.45, color: t.onInverse2 }}>{outcome}</div>
            <Plaque build={build} size="card" tone="inverse" now={now} />
          </div>
        </div>
      </div>
      {/* The rank square straddles the bottom edge: 14px of it hangs below. */}
      <div
        data-ui="hero-plate-rank"
        style={{
          position: "absolute",
          left: 20,
          bottom: -14,
          width: 84,
          height: 84,
          borderRadius: 14,
          background: t.inverse,
          color: t.onInverse,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: t.shadowSquare,
        }}
      >
        <span style={{ fontFamily: DM_MONO, fontSize: 10, letterSpacing: ".1em", opacity: 0.7 }}>NO.</span>
        <span style={{ ...display(40), letterSpacing: "-0.04em" }}>{String(rank).padStart(2, "0")}</span>
      </div>
    </div>
  );
}

/** The phone's plate: the same frosted surface, closer to the edge, with the credit and the Δ on lines of their own. */
function PhonePlate({ title, outcome, credit, delta, style }: BuildHeroPlateProps) {
  return (
    <div
      data-ui="hero-plate"
      data-variant="build"
      data-size="phone"
      style={{
        position: "absolute",
        left: 10,
        right: 10,
        bottom: 10,
        padding: 12,
        borderRadius: 14,
        background: t.plate,
        border: `1px solid ${t.headerBorder}`,
        backdropFilter: GLASS_BLUR,
        WebkitBackdropFilter: GLASS_BLUR,
        ...style,
      }}
    >
      <h1 style={{ ...display(32, { mobilePageHeading: true }), margin: 0, color: t.text }}>{title}</h1>
      {outcome ? (
        <div style={{ fontFamily: FIGTREE, fontSize: 12, lineHeight: 1.45, color: t.text2, marginTop: 6 }}>{outcome}</div>
      ) : null}
      <div style={{ fontFamily: FIGTREE, fontSize: 12, lineHeight: "normal", color: t.text2, marginTop: 6 }}>{credit}</div>
      {delta ? (
        <div style={{ fontFamily: DM_MONO, fontSize: 11, lineHeight: "normal", color: t.text2, marginTop: 2 }}>{delta}</div>
      ) : null}
    </div>
  );
}

function BuildPlate(props: BuildHeroPlateProps) {
  if (props.size === "phone") return <PhonePlate {...props} />;
  const { title, outcome, credit, delta, style } = props;
  return (
    <>
      <div
        data-ui="hero-plate"
        data-variant="build"
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 16,
          /* UI-P54, the density pass: 18px 20px → 13px 14px. The left padding
             is the room the mark square needs, so it is derived from the square
             rather than shrunk with the rest: the square sits 14px into the
             plate and is 88 wide (over the table's band, so kept), and the gap
             after it goes 18 → 13 — 115. The tightened board shrinks this
             padding to 86 as well and its square covers the title's first
             letters; that is the one place this plate departs from it. */
          padding: "13px 14px 13px 115px",
          borderRadius: r.panel,
          background: t.plate,
          border: `1px solid ${t.headerBorder}`,
          backdropFilter: GLASS_BLUR,
          WebkitBackdropFilter: GLASS_BLUR,
          ...style,
        }}
      >
        <h1 style={{ ...display(44), margin: 0, color: t.text }}>{title}</h1>
        <div
          style={{
            fontFamily: FIGTREE,
            fontSize: 12,
            lineHeight: 1.45,
            color: t.text2,
            marginTop: 6,
            maxWidth: 560,
          }}
        >
          {outcome}
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginTop: 7,
            fontFamily: FIGTREE,
            fontSize: 12,
            color: t.text2,
          }}
        >
          {credit}
          {delta ? <span style={{ fontFamily: DM_MONO, fontSize: 11 }}>{delta}</span> : null}
        </div>
      </div>
      <div
        data-ui="hero-plate-mark"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 30,
          bottom: 30,
          width: 88,
          height: 88,
          borderRadius: 14,
          background: t.inverse,
          color: t.onInverse,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: t.shadowSquare,
        }}
      >
        <Mark size={50} />
      </div>
    </>
  );
}

export function HeroPlate(props: HeroPlateProps) {
  return props.variant === "featured" ? <Featured {...props} /> : <BuildPlate {...props} />;
}

export default HeroPlate;
