// SV-04: the page area's one Suspense boundary, under the frame.
//
// Every page inside the frame suspends here and nowhere else. Its fallback is the matched route's `Placeholder` from the
// route table (RoutePlaceholder), so a page opened for the first time shows its own loading shape while its code arrives.
// Navigation runs as a transition (`v7_startTransition` on the router), and React keeps a boundary that is already showing
// a page on screen during a transition: the old page stays while the next one's code loads, and the fallback is only ever
// seen on the first page of a visit.
//
// Unless a change has waited too long (go.ts, PLACEHOLDER_AFTER_MS), or Back has gone to a page whose code is not in: then
// the new page's placeholder takes the page area until the address arrives there, the same shape the boundary would show.

import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { useForcedPlaceholder } from "@/lib/routing/go";
import { RoutePlaceholder } from "@/lib/routing/RoutePlaceholder";

export function FrameOutlet() {
  const { pathname } = useLocation();
  const forced = useForcedPlaceholder();
  if (forced !== null && forced !== pathname) return <RoutePlaceholder pathname={forced} />;
  return (
    <Suspense fallback={<RoutePlaceholder />}>
      <Outlet />
    </Suspense>
  );
}

export default FrameOutlet;
