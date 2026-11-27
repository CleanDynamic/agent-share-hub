// The row of pills that sits right under the phone's top bar (29b). The row sticks under the bar, and it carries the structural
// line (Raised, 1px) so the bar does not draw a second one. A page turns it on by mounting `usePhoneRowLine()`; the bar reads
// `useHasPhoneRow()`.

import { useEffect, useSyncExternalStore, type CSSProperties } from "react";

import { PHONE_PILL_ROW, PHONE_TOPBAR } from "@/components/shell/chromeSize";
import { t } from "@/lib/theme/tokens";

/** The sticky row's style: under the bar, on Page, the line on its bottom edge. Spread it on the element that holds the pills. */
export const PHONE_ROW_STYLE: CSSProperties = {
  position: "sticky",
  top: `calc(env(safe-area-inset-top) + ${PHONE_TOPBAR}px)`,
  zIndex: 19,
  minHeight: PHONE_PILL_ROW,
  boxSizing: "border-box",
  background: t.bg,
  boxShadow: `inset 0 -1px 0 ${t.control}`,
};

let mounted = 0;
const listeners = new Set<() => void>();
const bump = (by: number) => {
  mounted += by;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Call while a page draws a pill row under the bar. */
export function usePhoneRowLine(active = true): void {
  useEffect(() => {
    if (!active) return;
    bump(1);
    return () => bump(-1);
  }, [active]);
}

/** Whether a page's pill row is under the bar now. */
export function useHasPhoneRow(): boolean {
  return useSyncExternalStore(subscribe, () => mounted > 0, () => false);
}
