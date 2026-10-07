// The tagline (UI-P11): three Sentient lines on filled chips, stepped to the
// right, the middle one ending in the mark.
//
// THE SENTENCE IS ONE HEADING. For a screen reader the whole thing reads
// "Every AI build, hung with its proof." — the lines are joined, the chips are
// `aria-hidden` — because three chips are one claim and a heading that reads as
// three fragments is not. The sentence rides in a visually hidden span, so the
// heading's text is real text and not a label.
//
// THE NUMBERS ARE ALL DERIVED FROM `size`, truncated, and match the reference at
// both of its sizes: padding `trunc(size·.22) trunc(size·.32) trunc(size·.26)`,
// the mark `trunc(size·.6)` after a gap of `trunc(size·.25)`. Sizes and offsets
// the design uses: desktop Home 46 → 0 / 90 / 30; mobile Home 30 → 0 / 44 / 14;
// desktop Sign in 40 → 0 / 70 / 24; mobile Sign in 26 → 0 / 40 / 12.
//
// THOSE ARE THE DRAWN NUMBERS (UI-P54). The density pass renders the type through
// the table (46 → 34) and each derived padding, gap and offset too (10 14 11 →
// 7 10 8; 90 → 65); the mark is an SVG the kit sizes by attribute, which the pass
// left alone, so it keeps `trunc(size·.6)` of the drawn size.
//
// THE LAMP IS `--tagline-lamp`, not `--lit`: amber on a chip that is light on
// Dusk would be swallowed, so the tagline has its own.

import type { CSSProperties } from "react";

import { denseSpace } from "@/lib/theme/density";
import { t } from "@/lib/theme/tokens";
import { display } from "@/lib/theme/type";

import { Mark } from "./Mark";

export type TaglineLines = readonly [string, string, string];
export type TaglineOffsets = readonly [number, number, number];

export interface TaglineProps {
  lines: TaglineLines;
  /** The type size in px as the design drew it: 46, 40, 30 or 26. */
  size: number;
  /** Each chip's left margin in px, as drawn; rendered through the density table. */
  offsets: TaglineOffsets;
  /** The heading level. A page has one, so this is `h1` unless something else is. */
  as?: "h1" | "h2";
}

/** Line 1 is square at its bottom-right corner (the step), line 2 at its top-left (where it hangs off line 1). */
const RADII = ["14px 14px 0 14px", "0 14px 14px 14px", "14px"] as const;

/** The visually hidden pattern, inline: no class may carry it. */
const HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export function Tagline({ lines, size, offsets, as: Heading = "h1" }: TaglineProps) {
  const pad = (share: number) => `${denseSpace(Math.trunc(size * share))}px`;
  const padding = `${pad(0.22)} ${pad(0.32)} ${pad(0.26)}`;
  const gap = denseSpace(Math.trunc(size * 0.25));
  const mark = Math.trunc(size * 0.6);

  return (
    <Heading
      data-ui="tagline"
      style={{
        position: "relative",
        margin: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
      }}
    >
      <span style={HIDDEN}>{lines.join(" ")}</span>
      {lines.map((line, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            ...display(size),
            /* The tagline sets −0.03em at every size, where `display()` steps to
               −0.035em from 44px; and it never wraps, so no balancing. Its
               leading is 1 at every size too: `display()` gives 1.05 below 30px,
               which is the 26px sign-in tagline's chip 1.3px too tall. */
            letterSpacing: "-0.03em",
            lineHeight: 1,
            textWrap: "nowrap",
            marginLeft: denseSpace(offsets[i]),
            background: t.taglineChip,
            color: t.onTaglineChip,
            padding,
            borderRadius: RADII[i],
            display: "flex",
            alignItems: "center",
            gap,
            whiteSpace: "nowrap",
          }}
        >
          {line}
          {i === 1 ? <Mark size={mark} lamp={t.taglineLamp} /> : null}
        </span>
      ))}
    </Heading>
  );
}

export default Tagline;
