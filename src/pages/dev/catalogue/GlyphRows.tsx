/* UI-P82 — the glyph set, drawn in the Controls section under the refined look.

   The first row is foundations.html's "Glyphs · 16 px · square caps" as the board draws it: the same sixteen in the
   board's order, 24 apart, each an svg in a span coloured --text, under the same label and hairline. The second row is
   the eight the board leaves out. The board's span is 21px tall and this one 16: the board is a standalone file whose
   svgs stay inline, so each span keeps room for a descender, and the app's reset makes them blocks. The drawing is the
   same 16 by 16 box on both.

   Refined only. The current look has no glyphs to show, and its Controls section is compared against the current
   catalogue, which has no such row. */

import { Glyph, type GlyphName } from "@/components/brand/Glyph";
import { GLYPH_NAMES } from "@/components/brand/glyphs";
import { t } from "@/lib/theme/tokens";
import { eyebrow } from "@/lib/theme/type";

import { Example } from "./parts";

/** foundations.html's row, in the board's order. */
const BOARD_ROW: readonly GlyphName[] = [
  "search",
  "bell",
  "moon",
  "sun",
  "plus",
  "x",
  "pencil",
  "file",
  "layers",
  "panel",
  "larr",
  "rarr",
  "check",
  "chev",
  "image",
  "play",
];

/** The rest of the set, in the table's order. */
const OTHERS = GLYPH_NAMES.filter((name) => !BOARD_ROW.includes(name));

function GlyphRow({ names }: { names: readonly GlyphName[] }) {
  return (
    <Example caption={names.join(" · ")}>
      <div data-ui="glyph-row" style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {names.map((name) => (
          <span key={name} data-glyph={name} title={name} style={{ color: t.text }}>
            <Glyph name={name} />
          </span>
        ))}
      </div>
    </Example>
  );
}

export function GlyphRows() {
  return (
    <div
      data-ui="glyphs"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        paddingTop: 16,
        borderTop: `1px solid ${t.hairline}`,
      }}
    >
      <span style={{ ...eyebrow, margin: 0, lineHeight: "normal", color: t.label }}>Glyphs · 16 px · square caps</span>
      <GlyphRow names={BOARD_ROW} />
      <GlyphRow names={OTHERS} />
    </div>
  );
}
