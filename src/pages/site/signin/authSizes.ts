/* UI-P36 — the numbers the reference states for the entrance's controls, by viewport.

   Desktop and phone differ in the field's height (44 and 48), the provider
   buttons (44/14 and 48/15), the primary action (46 and 48), and the rule's gap
   and margin, and the card's column gap (12 and 10). Each piece asks for them
   with `useAuthSizes()`, which reads the app's 768px breakpoint, so the live page
   and the compare page behave alike.

   UI-P57, THE DENSITY PASS. `provider`, `providerFont` and `primary` go to the
   Button, which maps the drawn size itself, so they stay as drawn. `field`, the
   gaps and the rule are drawn straight into the page, so they are the tightened
   board's: the field 44 → 36 (a phone's input keeps 44, the touch target and
   the 48 it was), the gaps 12 / 10 → 9 / 7. The rule's 4px and 2px are under
   the table's floor and stay. */

import { useIsPhone } from "@/components/shell/useMinWidth";

/* The dialog (Reference A): every control 32 high, so fields, providers and the primary are the site's standard height. */
/* Synth 13: one-line fields 40 tall; the main button and the providers 40 tall, radius 20, on every width. */
const DESKTOP = { phone: false, field: 40, provider: 40, providerFont: 15, primary: 40, ruleGap: 8, ruleMargin: "0", gap: 14 } as const;
/* Mobile prompt 27 Part B: on a phone the card is 10 between its parts, the providers and the main button 48. */
const PHONE = { phone: true, field: 48, provider: 48, providerFont: 15, primary: 48, ruleGap: 8, ruleMargin: "0", gap: 10 } as const;

/** The sizes for the viewport the page is being drawn in. */
export function useAuthSizes() {
  return useIsPhone() ? PHONE : DESKTOP;
}

/** The sign-in dialog (G1): 840 by 540, radius 16, a 360 picture column and a 480 form column padded 24, so every control
    in the form column is 432 wide. The picture is 360 by 300, flush to the top. The halftone layer is built around this
    rectangle, so the dialog never grows: a view that does not fit is a design question, not a scroll bar. */
export const DIALOG = {
  /** Synth 13: one 420 card; the old two-column numbers are kept for callers that still read them. */
  width: 420,
  height: 540,
  radius: 16,
  left: 360,
  right: 420,
  pad: 20,
  picture: 300,
  /** A control's height in the form column: Button, Segmented track and field. */
  control: 32,
  /** The label over a field, the divider row, the reserved error line. */
  line: 16,
  /** The remember row and the Back to sign in link. */
  row: 24,
  /** Below this width the picture column is dropped and the form column stands alone. */
  twoColumnsFrom: 840,
} as const;
