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

   THE CHECK IS LIGHT (SV-03 P3): `getBuildParent` reads the build's id and its
   parent and nothing else. The composer's record is not what the route waits for,
   so the composer's code (`preloadComposer`) and its first-screen reads
   (`startComposerReads`, on the keys the page's hooks use) start the moment the
   route matches, at the same time as the check, and the page finds them ready.

   ITS IMPORTS STAY NARROW. App.tsx imports this file eagerly, so it names the
   modules it needs (`getBuildParent` from builds.ts, the preloader) rather than
   `useComposeBuild` or the `@/lib/build` barrel, either of which put the whole
   build layer into every visitor's first download. The reads themselves are in
   composerOpen.ts, imported when they are started.

   SIGNED OUT goes to /login, as the old screens do. */

import { SkipToBuild } from "./buildFocus";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useLocation, useParams } from "react-router-dom";

import { SiteFrame } from "@/components/shell/SiteFrame";
import { useAuth } from "@/contexts/AuthContext";
import { composeBuildQueryKey } from "@/hooks/composeBuildQueryKey";
import { fetchNodeTypes } from "@/hooks/useNodeType";
import { getBuild, getBuildParent } from "@/lib/build/builds";
import { SANDBOX_COMPOSER_ENABLED } from "@/lib/build/flags";

import { ComposeSkeleton } from "./ComposeSkeleton";
import { preloadComposer } from "./preload";

/** Its own chunk: the composer is heavy, and nothing else should pay for it. */
const ComposePage = lazy(() => import("./ComposePage"));
/** UI-P63: the new composer, its own chunk, only fetched while the switch is on. */
const SandboxPage = lazy(() => preloadComposer() as Promise<{ default: React.ComponentType }>);

/** The route's own check, under its own key: it is not the composer's record any more. */
const composeParentKey = (buildId: string | undefined) => ["build", "getBuildParent", buildId] as const;

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

  const queryClient = useQueryClient();
  const reads = Boolean(buildId) && isLoggedIn && !hasFrom && !startedNew;
  /* Its data starts first, once the session says who is asking: the small module that holds the reads is asked for before
     the composer's page, so the page's download (the heavy one) does not queue in front of it. The keys are the page's. */
  useEffect(() => {
    if (!reads || !buildId) return;
    void import("./composerOpen").then(({ startComposerReads }) => startComposerReads(queryClient, buildId));
  }, [reads, buildId, queryClient]);
  /* The composer's code starts now, whoever is signed in: it is the same file for everybody. */
  useEffect(() => {
    void preloadComposer();
  }, []);

  const check = useQuery({
    queryKey: composeParentKey(buildId),
    queryFn: () => getBuildParent(buildId as string),
    enabled: reads,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  /* THE PAGE MOUNTS WHEN ITS RECORD IS IN. The composer is a heavy first render; mounted while the record is still being read it
     holds the main thread, and the reads that follow the record's header (nodes, tray, events) wait behind it. So the route
     stands the skeleton in its place until the record has arrived (the page's own query is this one: same key, same function). */
  const record = useQuery({
    queryKey: composeBuildQueryKey(buildId),
    queryFn: () => getBuild(buildId as string, { nodeTypes: () => fetchNodeTypes(queryClient) }),
    enabled: reads,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const waitingForRecord = reads && record.isPending && record.fetchStatus !== "idle";

  if (loading) return FALLBACK;
  if (!isLoggedIn) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`} replace />;
  }
  if (hasFrom) return <>{legacy}</>;
  if (buildId && !startedNew) {
    if (check.isPending && check.fetchStatus !== "idle") return FALLBACK;
    if (check.data?.parent_build_id) return <>{legacy}</>;
  }

  return (
    <SiteFrame wide={SANDBOX_COMPOSER_ENABLED} skipLink={SANDBOX_COMPOSER_ENABLED ? <SkipToBuild /> : undefined}>
      {/* No RouteBoundary: it is keyed by pathname, and the first change replaces
          /compose/new with /compose/{id}, which would remount the page under the
          creator's cursor. */}
      <Suspense fallback={SANDBOX_COMPOSER_ENABLED ? <ComposeSkeleton /> : <div style={{ minHeight: "60vh" }} />}>
        {waitingForRecord ? <ComposeSkeleton /> : SANDBOX_COMPOSER_ENABLED ? <SandboxPage /> : <ComposePage />}
      </Suspense>
    </SiteFrame>
  );
}

export default ComposeRoute;
