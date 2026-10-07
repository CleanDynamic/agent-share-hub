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

const DESKTOP = { phone: false, field: 36, provider: 44, providerFont: 14, primary: 46, ruleGap: 9, ruleMargin: "4px 0", gap: 9 } as const;
const PHONE = { phone: true, field: 44, provider: 48, providerFont: 15, primary: 48, ruleGap: 7, ruleMargin: "2px 0", gap: 7 } as const;

/** The sizes for the viewport the page is being drawn in. */
export function useAuthSizes() {
  return useIsPhone() ? PHONE : DESKTOP;
}
