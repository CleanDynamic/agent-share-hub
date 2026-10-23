// A refined glyph (UI-P82).
//
// A 16px line glyph on a 16 grid: stroke 1.3, square caps, no fill, drawn in `currentColor` unless a colour is given.
// The drawing is the refined boards' own ("Glyphs · 16 px · square caps" on foundations.html, and the page boards that
// use the rest). `size` sets the svg's width and height and leaves the viewBox at 16, so the stroke scales with the
// drawing the way the boards' 10 to 19px marks do.
//
// `more` and `grip` are the glyphs at a different stroke, 2: they are 0.01 segments, and a square cap on a segment that
// short is a dot only as wide as the stroke.
//
// `fill` is for a toggle's on state (a liked heart, a saved mark): the same shape, filled. It defaults to none.
//
// Always `aria-hidden`: a glyph never names anything, the control around it does (RULES §4). `color` takes a token
// (`t.label`) or `currentColor`, never a literal. A call site that still holds a lucide icon under the current look
// uses `Icon`, which chooses between the two.

import { GLYPHS, GLYPH_STROKES, type GlyphName } from "./glyphs";

export type { GlyphName } from "./glyphs";

export interface GlyphProps {
  name: GlyphName;
  /** Width and height in px; the drawing scales with it. */
  size?: number;
  /** A colour token, or `currentColor`. */
  color?: string;
  /** A colour token, or `currentColor`, to fill the shape with. Absent: no fill. */
  fill?: string;
}

/** The glyphs that are dots only. */
const DOTS_ONLY: readonly GlyphName[] = ["more", "grip"];

export function Glyph({ name, size = 16, color = "currentColor", fill = "none" }: GlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={fill}
      stroke={color}
      strokeWidth={DOTS_ONLY.includes(name) ? 2 : (GLYPH_STROKES[name] ?? 1.3)}
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d={GLYPHS[name]} />
    </svg>
  );
}

export default Glyph;
