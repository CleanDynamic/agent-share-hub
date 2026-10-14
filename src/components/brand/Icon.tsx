// The icon switch (UI-P82).
//
// `<Icon lucide={Search} glyph="search" />` draws the glyph under the refined look and the lucide icon under the
// current one, so a primitive keeps a single call site while the two looks differ. Under the current look it is the
// lucide icon with the props it was given, so adopting it changes nothing before UI-P98.
//
// Under the refined look a glyph is drawn from `size` and `color` alone: its stroke, caps and fill belong to the set,
// so the other lucide props (`strokeWidth`, `style`, `className`) do not reach it. A lucide icon with no glyph is drawn
// at stroke 1.3 with square caps whatever stroke it was given, so it sits beside the glyphs without a mismatch.
//
// Icons are decorative. A lucide icon is `aria-hidden` unless the caller says otherwise, as a glyph always is; the
// control around it carries the name (RULES §4).

import type { LucideIcon, LucideProps } from "lucide-react";

import { useLook } from "@/lib/theme/look";

import { Glyph, type GlyphName } from "./Glyph";

/** The stroke the refined look draws a lucide icon at when it has no glyph. */
const REFINED_STROKE = 1.3;

export interface IconProps extends Omit<LucideProps, "ref" | "size" | "absoluteStrokeWidth"> {
  /** What the current look draws. */
  lucide: LucideIcon;
  /** What the refined look draws in its place. Absent: the lucide icon, at stroke 1.3 with square caps. */
  glyph?: GlyphName;
  /** Width and height in px. A glyph defaults to 16, a lucide icon to its own 24. */
  size?: number;
}

export function Icon({ lucide: Lucide, glyph, size, color, ...rest }: IconProps) {
  const refined = useLook() === "refined";
  if (refined && glyph) return <Glyph name={glyph} size={size} color={color} />;
  if (refined) {
    return (
      <Lucide aria-hidden="true" size={size} color={color} {...rest} strokeWidth={REFINED_STROKE} strokeLinecap="square" />
    );
  }
  return <Lucide aria-hidden="true" size={size} color={color} {...rest} />;
}

export default Icon;
