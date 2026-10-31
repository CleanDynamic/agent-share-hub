// SV-26 P2: draws its child once the browser is idle after the first render, with the child's code fetched then and not before.
// For a listener or a toaster that has nothing to draw when the page opens.

import { Suspense, type ReactNode } from "react";

import { useIdleReady } from "./lazyHost";

export function IdleMount({ children }: { children: ReactNode }) {
  const idle = useIdleReady();
  return idle ? <Suspense fallback={null}>{children}</Suspense> : null;
}
