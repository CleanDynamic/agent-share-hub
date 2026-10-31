// SV-26 P3: a composer window whose code loads the first time it opens, or at idle once the composer is ready, whichever
// comes first. After idle it opens at once with no placeholder (the code is in); before idle it appears when its code arrives.
// It stays mounted once opened, so it closes with the motion it has today. `open` says when it counts as open.
// The first hover or focus of a control in the composer fetches them too (`useWarmWindowsOnIntent`), so a window opened
// before idle is usually already here.

import { Suspense, lazy, useEffect, type ComponentType } from "react";

import { savingData } from "@/lib/routing/idleLoad";
import { useEverOpened } from "@/lib/routing/lazyHost";

const loaders = new Set<() => Promise<unknown>>();

export function lazyWindow<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
  isOpen: (props: P) => boolean,
): ComponentType<P> {
  const Lazy = lazy(load) as unknown as ComponentType<P>;
  loaders.add(load);
  return function Window(props: P) {
    const mounted = useEverOpened(isOpen(props));
    return mounted ? (
      <Suspense fallback={null}>
        <Lazy {...props} />
      </Suspense>
    ) : null;
  };
}

/** Fetch every window's code (once each, the module system caches it). Called at idle after the composer is ready. */
export function preloadComposerWindows(): void {
  for (const load of loaders) void load().catch(() => undefined);
}

/** The controls that open the composer's windows: its buttons, menu items, links and tiles. */
const OPENER = 'button, a[href], [role="button"], [role="menuitem"], [role="tab"], [tabindex="0"]';

/** SV-26 P3: on the first hover or focus of a control while the composer is up, fetch every window's code, once. Nothing
    when the reader asked for less data: each window then loads when it opens. */
export function useWarmWindowsOnIntent(): void {
  useEffect(() => {
    if (savingData()) return;
    const warm = (event: Event) => {
      if (!(event.target instanceof Element) || !event.target.closest(OPENER)) return;
      stop();
      preloadComposerWindows();
    };
    const stop = () => {
      document.removeEventListener("pointerover", warm, true);
      document.removeEventListener("focusin", warm, true);
    };
    document.addEventListener("pointerover", warm, true);
    document.addEventListener("focusin", warm, true);
    return stop;
  }, []);
}
