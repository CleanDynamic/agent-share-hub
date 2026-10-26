// SV-04: the page area's one Suspense boundary, under the frame.
//
// Every page inside the frame suspends here and nowhere else. Its fallback is the matched route's `Placeholder` from the
// route table (RoutePlaceholder), so a page opened for the first time shows its own loading shape while its code arrives.
// Navigation runs as a transition (`v7_startTransition` on the router), and React keeps a boundary that is already showing
// a page on screen during a transition: the old page stays while the next one's code loads, and the fallback is only ever
// seen on the first page of a visit.

import { Suspense } from "react";
import { Outlet } from "react-router-dom";

import { RoutePlaceholder } from "@/lib/routing/RoutePlaceholder";

export function FrameOutlet() {
  return (
    <Suspense fallback={<RoutePlaceholder />}>
      <Outlet />
    </Suspense>
  );
}

export default FrameOutlet;
