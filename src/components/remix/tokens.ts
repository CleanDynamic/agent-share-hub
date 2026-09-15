// Shared design-system tokens for the Remix Lineage / Creator Credit surface.
//
// REPOINTING FINISHED — BG-P29. An earlier pass moved the easy half of this
// module onto tokens and left the rest, so it shipped as a mixture: `orange`
// was already `var(--action)` while the gradient beside it still ended in
// `#C44514`, and the three surfaces were still the lavender-greys struck for
// one dark room. A module half on tokens is worse than one wholly off them — it
// reads as finished. The remaining literals are repointed here, and two
// mappings the earlier pass got wrong are corrected:
//
// 1. `--recess` WAS BEING USED AS AN INK. `textMuted`, `textFaint` and `locked`
//    all pointed at it. `--recess` is the token for an inset SURFACE — a
//    screen, a well, a field — and text set in it measures 1.1:1 on the
//    Exhibition ground it is nearly the same value as. The system publishes two
//    text tokens, so all three keys resolve to `--text2`.
//
// 2. TWO CATEGORY HUES WERE BORROWED. `purple` pointed at `--cat-agents` and
//    `green` at `--cat-configuration`. The nine `--cat-*` hues encode part
//    categories and the theme forbids borrowing one for anything that is not a
//    part category. They take the mapping BG-P25 set for the profile surface
//    instead: purple is progress, so `--lit`; "it worked" is `--evidence`.
//
// THIS FOLDER IS LIVE, which is why it is repointed rather than left: three
// routes mount it — `/upload`, `/content/:id` and `/b/:slug/lineage`.
//
// THE CREDIT IS STRUCTURAL, SO ITS PAINT HAD BETTER FOLLOW THE ROOM. The theme
// asks a rebuild credit to look like part of the record rather than like a
// caption; a credit line still wearing the old dark room's ink on an Exhibition
// page read as neither.

import { GLASS_BLUR } from "@/lib/theme/controls"
import { r } from "@/lib/theme/radius"
import { t } from "@/lib/theme/tokens"
import { DM_MONO } from "@/lib/theme/type"

export const tokens = {
  /** The panel tier. Was `rgba(52,52,66,0.55)`. */
  shell: t.glass,
  /** The inset tier. Was `rgba(68,68,84,0.60)`. */
  card: t.glass2,
  /** A field or a well. Was `rgba(82,82,100,0.60)`. */
  input: t.recess,
  // Both steps were one hairline at two strengths; `--line` is a hairline, not
  // a surface.
  borderFaint: `0.5px solid ${t.line}`,
  borderSoft: `0.5px solid ${t.line}`,
  orange: t.action,
  /** Was `linear-gradient(135deg, var(--action) 0%, #C44514 100%)`. */
  orangeGradient: t.action,
  teal: t.evidence,
  amber: t.lit,
  /** Was `--cat-agents`. See note 2 above. */
  purple: t.lit,
  /** Was `--cat-configuration`. See note 2 above. */
  green: t.evidence,
  // Text — see note 1 above.
  text: t.text,
  textMuted: t.text2,
  textFaint: t.text2,
  locked: t.text2,
  // The radius scale. The old `pill` was 100 — the capsule the shape language
  // dropped by decision — and is the chip step now.
  panel: r.panel,
  cardRadius: r.card,
  pill: r.chip,
  // THE one blur value. It was `blur(28px) saturate(160%)`, a second blur value
  // in a system that has exactly one.
  glass: GLASS_BLUR,
} as const;

export const xpColor = tokens.orange;
export const reputationColor = tokens.teal;
export const streakColor = tokens.amber;

/** BG-P03 put DM Mono at the head of the data face's stack; this is that stack. */
export const fontMono = DM_MONO;
