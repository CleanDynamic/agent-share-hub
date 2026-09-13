// BG-P21 — the build page's buttons, on BG-P07's treatments.
//
// Every control on this route was painted by hand: `labelText` plus a padding,
// an 8px radius, a hexToRgba fill and a two-property transition, copied between
// files and drifting a shade each time. BG-P07 struck the treatments once in
// `src/lib/theme/controls.ts` — primary, secondary, outline, ghost, link — with
// the hover, press, focus and disabled states measured against both rooms. This
// is the two-line adapter that lets a plain `<button>` on this page spend them.
//
//   const rebuild = useActionStyle("default", { disabled: pending });
//   <button {...rebuild.handlers} style={{ ...rebuild.style, padding: "6px 12px" }}>
//
// GEOMETRY STAYS WITH THE CALL SITE. `buttonStyle` decides colour, border,
// radius, transition and the state changes; it sets no padding and no font
// size, so spreading it over an existing control repaints that control without
// moving it. The restyle may not change padding on an element that is already
// laid out, and this is how it does not.
//
// ONE PRIMARY PER VIEW. The `default` variant is the filled `--action` surface
// and the build page spends it exactly once, on "Rebuild this". Everything else
// here is `secondary` (glass on a `--line` border) or `ghost` (no resting fill).
// A second filled button in one view asks the reader twice which thing matters
// most, and the theme names that as the rule rather than as a preference.

import type { CSSProperties } from "react";

import { buttonStyle, type ButtonVariant } from "@/lib/theme/controls";
import { useInteractive, type InteractiveHandlers } from "@/lib/theme/interactive";

export interface ActionStyle {
  /** Spread FIRST, so a call site's own geometry wins over the treatment. */
  readonly style: CSSProperties;
  /** Spread onto the element after its own props. */
  readonly handlers: InteractiveHandlers<HTMLButtonElement>;
}

/**
 * One button's treatment and the handlers that drive its states.
 *
 * `disabled` suppresses the visual state without touching the element's own
 * handlers — a disabled control still reports blur, which is what keeps a
 * keyboard user from being stranded on it.
 */
export function useActionStyle(
  variant: ButtonVariant,
  options: { disabled?: boolean } = {},
): ActionStyle {
  const { disabled } = options;
  const { state, handlers } = useInteractive<HTMLButtonElement>({}, { disabled });
  return { style: buttonStyle(variant, { ...state, disabled }), handlers };
}
