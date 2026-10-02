/* UI-P36 — the numbers the reference states for the entrance's controls, by viewport.

   Desktop and phone differ in the field's height (44 and 48), the provider
   buttons (44/14 and 48/15), the primary action (46 and 48), and the rule's gap
   and margin, and the card's column gap (12 and 10). Each piece asks for them
   with `useAuthSizes()`, which reads the app's 768px breakpoint, so the live page
   and the compare page behave alike. */

import { useIsPhone } from "@/components/shell/useMinWidth";

const DESKTOP = { phone: false, field: 44, provider: 44, providerFont: 14, primary: 46, ruleGap: 12, ruleMargin: "4px 0", gap: 12 } as const;
const PHONE = { phone: true, field: 48, provider: 48, providerFont: 15, primary: 48, ruleGap: 10, ruleMargin: "2px 0", gap: 10 } as const;

/** The sizes for the viewport the page is being drawn in. */
export function useAuthSizes() {
  return useIsPhone() ? PHONE : DESKTOP;
}
