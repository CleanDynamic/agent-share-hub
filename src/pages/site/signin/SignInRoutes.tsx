/* UI-P36 — the two route elements the sign-in pages' routes are made of.

   `SignInSite` is the entrance's frame around a page: `SiteFrame` in its `bare`
   variant (the backdrop and the page, no header, breadcrumb, footer or dock),
   a route boundary and a fallback for the page's chunk. These routes sit outside
   `AppShell` (`Layout` hands them straight through), so, like `/rebuild/:slug`,
   their site branch brings its own frame.

   `LinkFrameRoute` is `FrameRoute` for the two routes an emailed link can open.
   A link carries a single-use token, so when this address carries one the route
   is held until the `site_frame` flag is known; see `FrameRoute` for why. An
   address without a link (the request form, the pending card) is not held, and
   behaves as every other route does. */

import { Suspense, type ReactNode } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { RouteBoundary } from "@/components/routing/RouteBoundary";
import { FrameRoute, type FrameRouteProps } from "@/components/shell/FrameRoute";
import { SiteFrame } from "@/components/shell/SiteFrame";

import { readEmailLink } from "./authModel";

export function SignInSite({ children }: { children: ReactNode }) {
  return (
    <SiteFrame variant="bare">
      <RouteBoundary>
        <Suspense fallback={<div style={{ minHeight: "100dvh" }} />}>{children}</Suspense>
      </RouteBoundary>
    </SiteFrame>
  );
}

export function LinkFrameRoute(props: Omit<FrameRouteProps, "hold">) {
  const { token } = useParams();
  const [search] = useSearchParams();
  return <FrameRoute {...props} hold={readEmailLink(token, search, window.location.hash).present} />;
}
