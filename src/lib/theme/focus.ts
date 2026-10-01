// buildgallery.ai — the focus ring. One definition, used everywhere.
//
// 2px of `--focus-ring` with a 2px offset, the same shape in both themes.
// Nothing invents its own: a keyboard user learns one mark, and a second ring
// somewhere else on the page is a second thing to learn for no gain.
//
// INK ON NOON, LAMP GOLD ON DUSK (UI-P04). A focus ring is UI state, which the
// spec floors at 3.0:1. The lamp gold clears that on Dusk, at 7.65:1 against the
// ground, and does not on Noon: `--lit` measures 1.87:1 there. The offset cannot
// rescue it, because the band the offset leaves is `--bg` and so is everything
// outside the ring, so both of the ring's edges are read against the same
// colour. So the ring has its own token, `--focus-ring`: the ink on Noon
// (13.41:1 against the ground, and 11.48:1 or better on every ground a control
// sits on) and the lamp gold on Dusk. Width and offset are the same in both
// rooms; only the colour moves. It is exported as one object rather than as a
// colour someone spends on their own, so it cannot drift into a second ring.
//
// WHY `outline` AND NOT `box-shadow`. An outline is not part of the box model,
// so a ring drawn this way cannot shift a layout when it appears — which is the
// failure mode of a focus style implemented as a border. It also survives
// `overflow: hidden` on an ancestor, where a shadow ring is clipped away.
//
// USAGE. Spread it into the focus-visible branch of a control's style, never
// into its resting style:
//
//   import { focusRing } from "@/lib/theme/focus";
//   <button style={{ ...base, ...(focused ? focusRing : null) }}>
//
// `:focus-visible` rather than `:focus` is the rule — a mouse click on a button
// should not draw the ring. Where a component can express the pseudo-class
// (a stylesheet rule already in `index.css`), prefer that to tracking focus in
// React state.

// BG-P30 — `outline: "none"` IN AN INLINE STYLE DELETES THIS RING, and it is
// the one way to lose it that nothing in the cascade can defend against. The
// ring reaches a raw field through `index.css`'s
// `input:focus-visible { outline: 2px solid var(--focus-ring) }`, whose specificity
// beats the `outline: none` in the resting `input, textarea, select` rule above
// it — but an inline declaration outranks both, so a field carrying
// `outline: "none"` in its style object has no focus indicator at all, in
// either room, for a keyboard user.
//
// The audit sweep found two such fields on the compose intake and a static scan
// found thirty-four more across eighteen files: every one a field or a control,
// every one silently unfocusable-looking. All thirty-six declarations are gone,
// and none of them was doing anything else: the resting rule already sets
// `outline: none`, so removing the inline copy changes nothing until the
// control is focused from a keyboard, at which point the shared ring appears.
//
// If a control needs to suppress a ring, it is not this one and the answer is
// not an inline `outline: none`.

import type { CSSProperties } from "react";
import { t } from "./tokens";

/** The ring's width, and the width of the `--bg` band under it. Both 2px. */
export const FOCUS_RING_WIDTH = "2px";
export const FOCUS_RING_OFFSET = "2px";

/**
 * The one focus ring. The same shape in Noon and Dusk; the colour is
 * `--focus-ring`, the ink on Noon and the lamp gold on Dusk.
 */
export const focusRing = {
  outlineWidth: FOCUS_RING_WIDTH,
  outlineStyle: "solid",
  outlineColor: t.focusRing,
  outlineOffset: FOCUS_RING_OFFSET,
} as const satisfies CSSProperties;
