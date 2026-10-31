// SV-26 P3: a composer window whose code loads the first time it opens, or at idle once the composer is ready, whichever
// comes first. After idle it opens at once with no placeholder (the code is in); before idle it appears when its code arrives.
// It stays mounted once opened, so it closes with the motion it has today. `open` says when it counts as open.

import { Suspense, lazy, type ComponentType } from "react";

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
