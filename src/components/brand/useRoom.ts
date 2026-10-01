// Which room is painted right now, read from the attribute that paints it.
//
// A few primitives differ by room in SHAPE rather than in colour — the mark's
// halo exists on Dusk and not on Noon — and a token cannot add or remove an
// element. This reads `<html data-theme>` itself, the one source of truth the
// whole system is driven from, so it agrees with the dev compare pages (which
// set the attribute from `?theme=` without touching the stored preference) as
// well as with the real switch. `ThemeContext.resolved` would not: it reports
// the stored choice, and the compare pages deliberately do not write that.

import { useSyncExternalStore } from "react";

export type Room = "noon" | "dusk";

const read = (): Room =>
  typeof document !== "undefined" && document.documentElement.dataset.theme === "dusk"
    ? "dusk"
    : "noon";

function subscribe(onChange: () => void): () => void {
  if (typeof MutationObserver === "undefined" || typeof document === "undefined") return () => {};
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function useRoom(): Room {
  return useSyncExternalStore(subscribe, read, () => "noon");
}
