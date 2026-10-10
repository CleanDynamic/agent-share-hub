/* UI-P47 — which composer a /compose address opens.

   THE NEW COMPOSER is for ordinary drafts, inside the site frame. THE LEGACY
   SCREEN (`Compose`, passed in as `legacy` and rendered exactly as before, with
   its own chrome) keeps every flow the new one does not handle: a rebuild (the
   draft has a `parent_build_id`) and anything arriving with a `from` parameter
   (`?from=rebuild`, conversions, Build File intake), and a draft arriving from
   the intake step with its proposal in router state.

   THE CHOICE IS MADE ONCE PER VISIT. /compose/new becomes /compose/{id} when the
   first change makes the draft; this component stays mounted across that, and
   must not go back and check the build it has just made (which would unmount the
   page under the creator's cursor). A rebuild is only ever opened by an address,
   never reached from /compose/new, so a visit that began on the new composer
   stays on it.

   THE CHECK READS THE QUERY THE COMPOSER LOADS ANYWAY (`composeBuildQueryKey`),
   so choosing the screen costs no second request.

   ITS IMPORTS STAY NARROW. App.tsx imports this file eagerly, so it names the
   modules it needs (the key, `getBuild` from builds.ts) rather than
   `useComposeBuild` or the `@/lib/build` barrel, either of which put the whole
   build layer into every visitor's first download.

   SIGNED OUT goes to /login, as the old screens do. */

import { lazy, Suspense, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation, useParams } from "react-router-dom";

import { SiteFrame } from "@/components/shell/SiteFrame";
import { useAuth } from "@/contexts/AuthContext";
import { composeBuildQueryKey } from "@/hooks/composeBuildQueryKey";
import { getBuild } from "@/lib/build/builds";
import type { BuildRecord } from "@/lib/build/types";

/** Its own chunk: the composer is heavy, and nothing else should pay for it. */
const ComposePage = lazy(() => import("./ComposePage"));

const FALLBACK = <div style={{ position: "fixed", inset: 0, background: "var(--bg)" }} />;

export function ComposeRoute({ legacy }: { legacy: ReactNode }) {
  const { buildId } = useParams<{ buildId: string }>();
  const location = useLocation();
  const { isLoggedIn, loading } = useAuth();

  /* An arrival from intake (a transcript, a repo or a Build File, which carry
     `state.intake`) opens the legacy workspace: its tray and proposal review are
     where those drafts are finished, and this wave does not draw them. */
  const fromIntake = Boolean((location.state as { intake?: unknown } | null)?.intake);
  const hasFrom = new URLSearchParams(location.search).has("from") || fromIntake;
  const [startedNew] = useState(() => !buildId);

  const check = useQuery<BuildRecord | null>({
    queryKey: composeBuildQueryKey(buildId),
    queryFn: () => getBuild(buildId as string),
    enabled: Boolean(buildId) && isLoggedIn && !hasFrom && !startedNew,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  if (loading) return FALLBACK;
  if (!isLoggedIn) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`} replace />;
  }
  if (hasFrom) return <>{legacy}</>;
  if (buildId && !startedNew) {
    if (check.isPending && check.fetchStatus !== "idle") return FALLBACK;
    if (check.data?.build.parent_build_id) return <>{legacy}</>;
  }

  return (
    <SiteFrame>
      {/* No RouteBoundary: it is keyed by pathname, and the first change replaces
          /compose/new with /compose/{id}, which would remount the page under the
          creator's cursor. */}
      <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
        <ComposePage />
      </Suspense>
    </SiteFrame>
  );
}

export default ComposeRoute;
