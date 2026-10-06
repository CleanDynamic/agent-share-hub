/* UI-P47 — which composer a /compose/:buildId address opens.

   THE NEW COMPOSER FOR AN ORDINARY DRAFT; THE LEGACY SCREEN, EXACTLY AS TODAY,
   FOR A REBUILD (`parent_build_id` set), ANY URL WITH A `from` PARAMETER, OR AN ARRIVAL FROM THE
   LEGACY INTAKE (a paste or a claim, whose summary travels in router state). The
   rebuild flow, with its note and `publishRebuild`, stays on the legacy screen
   in this wave, and so does Build File intake and the conversions that arrive
   with `?from=`.

   MOUNTING. The routes stay where they were in App.tsx, outside the app's shell,
   so the legacy screens keep their own chrome untouched. The new composer is
   wrapped in `SiteFrame` here, the way `AppShell` wraps a page, so it sits in
   the site frame; `ProtectedRoute` sends a signed-out visitor to /login.

   `/compose/new` is this same route with `:buildId` = "new": creating the draft
   then replaces the URL by changing a parameter, which is why the page does not
   remount and the field the creator is typing in keeps its focus. */

import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams, useSearchParams } from "react-router-dom";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SiteFrame } from "@/components/shell/SiteFrame";
import { useAuth } from "@/contexts/AuthContext";
import { composeBuildQueryKey } from "@/hooks/useComposeBuild";
import { getBuild } from "@/lib/build";

const Compose = lazy(() => import("@/pages/Compose"));
const ComposePage = lazy(() => import("./ComposePage"));

const BARE = <div style={{ position: "fixed", inset: 0, background: "var(--bg)" }} />;

export default function ComposeRoute() {
  const { buildId } = useParams<{ buildId: string }>();
  const [params] = useSearchParams();
  const { isLoggedIn, loading } = useAuth();

  const isNew = buildId === "new";
  // A paste or a claim from the legacy intake arrives with its summary in router state ("2 items are in your
  // tray"); only the legacy screen shows it, so that arrival stays there.
  const arrival = Boolean((useLocation().state as { intake?: unknown } | null)?.intake);
  const fromElsewhere = params.has("from") || arrival;

  // The same query, with the same options, as the composer's own, so a draft is read once.
  const record = useQuery({
    queryKey: composeBuildQueryKey(buildId),
    queryFn: () => getBuild(buildId as string),
    enabled: Boolean(buildId) && !isNew && !fromElsewhere && !loading && isLoggedIn,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  if (fromElsewhere || record.data?.build.parent_build_id) {
    return (
      <Suspense fallback={BARE}>
        <Compose />
      </Suspense>
    );
  }

  if (record.isLoading) return BARE;

  return (
    <SiteFrame>
      <ProtectedRoute>
        {/* No RouteBoundary: it keys on the pathname, and the URL changing from /compose/new to
            /compose/{id} on the first change must not remount the page under the creator's cursor. */}
        <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
          <ComposePage />
        </Suspense>
      </ProtectedRoute>
    </SiteFrame>
  );
}
