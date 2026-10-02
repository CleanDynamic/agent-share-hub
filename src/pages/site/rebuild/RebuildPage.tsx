/* UI-P31 — /rebuild/:slug in the site frame: the container.

   THE ADDRESS NAMES THE SOURCE, as it always has: the build page's Rebuild tile
   (and a bounty, a shared link) points here with the slug of the build to
   rebuild. What changes is what a reader finds. The old door forked at once and
   handed over to the workspace; this page shows the rebuild as a decision —
   where it sits in the family, what it changed, whether it can hang — with the
   workspace one press away.

     1. the source, by slug (getBuildHeaderBySlug)
     2. the reader's own draft of it (getRebuildDraft); a reader in the middle
        of one comes back to it rather than forking a second copy
     3. none yet: startRebuild(), once per visit — the old door's guard, for the
        old door's reason (a visit that forked twice leaves an orphan draft
        carrying somebody's credit)
     4. both records (getBuild), the change set (changeSet → serialiseChangeSet,
        line for line), the gate (rebuildReadiness) and the family
        (getBuildFamily, with getBuildClocks for the lamps and the sibling
        order; the draft is drawn in under its source, since the family's walk
        never returns a draft below its root)
     5. "Publish rebuild" → publishRebuild(), then the published build's page;
        "Keep as draft" → the draft's workspace

   No Supabase call in this file. Signed out, the intention survives as the
   address: sign in and come back, as the old door did. The legacy route
   (`src/pages/RebuildRoute.tsx`) is not edited: `FrameRoute` picks one by the
   `site_frame` flag. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/brand/Button";
import { useCrumbTitle } from "@/components/shell/useBreadcrumb";
import { useAuth } from "@/contexts/AuthContext";
import {
  changeSet,
  flattenFamily,
  getBuild,
  getBuildClocks,
  getBuildFamily,
  getBuildHeaderBySlug,
  getRebuildDraft,
  publishRebuild,
  rebuildReadiness,
  serialiseChangeSet,
  startRebuild,
  type Build,
  type BuildClock,
  type BuildRecord,
  type RebuildTreeNode,
} from "@/lib/build";
import { deltaLine } from "@/pages/site/build/buildModel";

import { RebuildView, RebuildViewFailed, RebuildViewNotice, RebuildViewSkeleton } from "./RebuildView";
import { changeGroups, familyView, readinessView } from "./rebuildModel";

/** A source does not change while somebody is rebuilding it. */
const SOURCE_STALE = 300_000;
/** The draft is the reader's own and moves when they edit it elsewhere. */
const DRAFT_STALE = 30_000;

const headerKey = (slug: string) => ["build", "getBuildHeaderBySlug", slug] as const;
const draftKey = (sourceId: string | undefined, userId: string | undefined) => ["build", "getRebuildDraft", sourceId, userId] as const;

export function RebuildPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const { user, isLoggedIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const signedIn = !authLoading && isLoggedIn;

  /* ── 1. the source ── */

  const sourceHeader = useQuery<Build | null>({
    queryKey: headerKey(slug),
    queryFn: () => getBuildHeaderBySlug(slug),
    enabled: Boolean(slug) && signedIn,
    staleTime: SOURCE_STALE,
    refetchOnWindowFocus: false,
  });
  const source = sourceHeader.data ?? null;
  useCrumbTitle(source ? source.title : sourceHeader.isPending ? null : sourceHeader.isError ? "Build" : "Not found");

  /* ── 2. the reader's draft of it, and 3. a new one when there is none ── */

  const draftHeader = useQuery<Build | null>({
    queryKey: draftKey(source?.id, user?.id),
    queryFn: () => getRebuildDraft({ sourceBuildId: (source as Build).id, creatorId: (user as { id: string }).id }),
    enabled: Boolean(source && user),
    staleTime: DRAFT_STALE,
    refetchOnWindowFocus: false,
  });

  const started = useRef(false);
  const [startError, setStartError] = useState<Error | null>(null);
  useEffect(() => {
    if (!source || !user || started.current) return;
    if (draftHeader.isPending || draftHeader.isError || draftHeader.data) return;
    started.current = true;
    startRebuild({ sourceBuildId: source.id })
      .then((draft) => queryClient.setQueryData(draftKey(source.id, user.id), draft))
      .catch((cause: unknown) => setStartError(cause instanceof Error ? cause : new Error(String(cause))));
  }, [source, user, draftHeader.isPending, draftHeader.isError, draftHeader.data, queryClient]);

  const draft = draftHeader.data ?? null;

  /* ── 4. the records, the family and its clocks ── */

  const sourceRecord = useQuery<BuildRecord | null>({
    queryKey: ["build", "getBuild", source?.id],
    queryFn: () => getBuild((source as Build).id),
    enabled: Boolean(source),
    staleTime: SOURCE_STALE,
    refetchOnWindowFocus: false,
  });
  const draftRecord = useQuery<BuildRecord | null>({
    queryKey: ["build", "getBuild", draft?.id],
    queryFn: () => getBuild((draft as Build).id),
    enabled: Boolean(draft),
    staleTime: DRAFT_STALE,
  });

  const rootId = source ? (source.root_build_id ?? source.id) : null;
  const family = useQuery<RebuildTreeNode | null>({
    queryKey: ["build", "getBuildFamily", rootId, source?.id],
    queryFn: () => getBuildFamily({ rootId: rootId as string, currentId: (source as Build).id }),
    enabled: Boolean(source),
    staleTime: SOURCE_STALE,
    refetchOnWindowFocus: false,
  });
  const familyIds = useMemo(() => {
    const ids = flattenFamily(family.data ?? null).map((node) => node.id);
    return draft ? [...ids, draft.id] : ids;
  }, [family.data, draft]);
  const clocks = useQuery<Map<string, BuildClock>>({
    queryKey: ["build", "getBuildClocks", familyIds.join(",")],
    queryFn: () => getBuildClocks(familyIds),
    enabled: familyIds.length > 0,
    staleTime: SOURCE_STALE,
    refetchOnWindowFocus: false,
  });

  const familyTree = useMemo(
    () =>
      familyView(family.data ?? null, {
        clocks: clocks.data,
        draft: draft && source ? { id: draft.id, slug: draft.slug, title: draft.title, parentId: source.id } : null,
      }),
    [family.data, clocks.data, draft, source],
  );

  /* ── the diff and the gate, computed from the two records ── */

  const computed = useMemo(() => {
    const before = sourceRecord.data;
    const after = draftRecord.data;
    if (!before || !after) return null;
    const changes = changeSet(before, after);
    return {
      changes,
      groups: changeGroups(before, after, changes),
      delta: deltaLine(serialiseChangeSet(changes)),
      readiness: readinessView(rebuildReadiness(before, after, changes), changes),
    };
  }, [sourceRecord.data, draftRecord.data]);

  /* ── 5. the decision ── */

  const publish = useMutation({
    mutationFn: (header: Build) =>
      // The rebuilder's note is whatever they wrote in the workspace: kept, not cleared.
      publishRebuild({ id: header.id, status: header.status, published_at: header.published_at }, header.rebuild_note),
    // A draft that has just gone live is not a reason to fork another: the
    // reader's draft query would come back empty after this, and nothing may
    // read that as "start one".
    onMutate: () => {
      started.current = true;
    },
    onSuccess: (row) => {
      if (source && user) queryClient.setQueryData(draftKey(source.id, user.id), row);
      void queryClient.invalidateQueries({ queryKey: ["build", "getBuildBySlug", row.slug] });
      if (source) void queryClient.invalidateQueries({ queryKey: ["build", "listRebuilds", source.id] });
      navigate(`/b2/${row.slug}`);
    },
  });

  /* ── the states ── */

  if (authLoading) return <RebuildViewSkeleton label="Checking your session" />;

  // The intention survives as an address, so signing in comes back to it.
  if (!isLoggedIn) {
    const back = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(back)}`} replace />;
  }

  const backToBuild = (
    <Button variant="secondary" size={36} fontSize={13} onClick={() => navigate(`/b2/${slug}`)}>
      Back to the build
    </Button>
  );

  if (sourceHeader.isError) {
    return <RebuildViewFailed panel="The rebuild" onRetry={() => void sourceHeader.refetch()} error={sourceHeader.error} />;
  }

  if (!sourceHeader.isPending && !source) {
    return (
      <RebuildViewNotice
        line="No build at this address."
        detail={`Nothing is published at /b2/${slug}. It may have been unpublished, or the link may be wrong.`}
        action={
          <Button variant="secondary" size={36} fontSize={13} onClick={() => navigate("/gallery")}>
            See the gallery
          </Button>
        }
      />
    );
  }

  if (startError || draftHeader.isError) {
    return (
      <RebuildViewFailed
        panel="Your draft"
        error={startError ?? draftHeader.error}
        onRetry={() => {
          started.current = false;
          setStartError(null);
          void draftHeader.refetch();
        }}
      />
    );
  }

  if (sourceRecord.isError || draftRecord.isError) {
    return (
      <RebuildViewFailed
        panel="The rebuild"
        error={sourceRecord.error ?? draftRecord.error}
        onRetry={() => {
          void sourceRecord.refetch();
          void draftRecord.refetch();
        }}
      />
    );
  }

  if (!source || !draft || !computed || !sourceRecord.data || !draftRecord.data) {
    return <RebuildViewSkeleton label={source ? `Setting up your rebuild of ${source.title}` : "Loading the rebuild"} />;
  }

  /* ── mapped for the view ── */

  const creditTitle = (draft.source_title_at_fork ?? "").trim() || source.title;
  const creditHandle = (draft.source_handle_at_fork ?? "").trim() || null;
  const workspace = `/compose/${draft.id}?from=rebuild`;

  return (
    <>
      <SeoHead
        title={`Rebuilding ${source.title} — buildgallery`}
        description={`A rebuild of ${source.title}: what it changed, and whether it can hang.`}
        path={`/rebuild/${slug}`}
        noIndex
      />
      <RebuildView
        fit="content"
        draftTitle={(draft.title ?? "").trim() || "Untitled rebuild"}
        source={{ title: creditTitle, maker: creditHandle ? `@${creditHandle}` : null }}
        family={familyTree}
        changes={computed.groups}
        readiness={computed.readiness}
        credit={{ title: creditTitle, handle: creditHandle, delta: computed.delta }}
        onPublish={() => {
          if (computed.readiness.ready && !publish.isPending) publish.mutate(draftRecord.data?.build ?? draft);
        }}
        onKeepDraft={() => navigate(workspace)}
        workspaceTo={workspace}
        publishing={publish.isPending}
        publishFailure={
          publish.isError
            ? {
                onRetry: () => {
                  if (computed.readiness.ready) publish.mutate(draftRecord.data?.build ?? draft);
                },
                error: publish.error,
              }
            : null
        }
      />
    </>
  );
}

export default RebuildPage;
