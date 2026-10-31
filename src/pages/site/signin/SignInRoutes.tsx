/* UI-P36 — the two route elements the sign-in pages' routes are made of.

   `SignInSite` is the entrance's frame around a page: `SiteFrame` in its `bare`
   variant (the backdrop and the page, no header, breadcrumb, footer or dock),
   a route boundary and a fallback for the page's chunk. These routes sit outside
   `AppShell` (`Layout` hands them straight through), so, like `/rebuild/:slug`,
   their site branch brings its own frame. */

import { Suspense, type ReactNode } from "react";

import { RouteBoundary } from "@/components/routing/RouteBoundary";
import { SiteFrame } from "@/components/shell/SiteFrame";

export function SignInSite({ children }: { children: ReactNode }) {
  return (
    <SiteFrame variant="bare">
      <RouteBoundary>
        <Suspense fallback={<div style={{ minHeight: "100dvh" }} />}>{children}</Suspense>
      </RouteBoundary>
    </SiteFrame>
  );
}
