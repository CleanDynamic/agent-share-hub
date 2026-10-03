/* UI-P34 — /profile/:handle (and /profile) in the site frame: the container.

   Loads the Profile's data through `src/lib/` functions only, maps it to
   `ProfileView`'s props and renders it. No Supabase call in this file. The legacy
   page (`src/pages/Profile.tsx`) is not edited: `FrameRoute` picks one by the
   `site_frame` flag.

   EACH PANEL LOADS ON ITS OWN. A slow level never holds the banner back, and a
   panel whose read fails says so in its own place — or, for the grid and the
   marks, draws what it can and nothing false: a refused read is never drawn as
   a start at zero.

   WHAT IS READABLE FOR WHOM. The level, streak, activity and creator marks live
   in tables their owner reads (`user_progress`, `streak_days`, `user_badges`).
   On somebody else's profile they come back empty under row-level security; the
   panels then draw the level and track the visible-surfaces function gives, no
   XP, no streak and no marks, rather than inventing figures.

   THE TRACK. On your own profile the four tracks change through `setUserTrack`
   (the first choice) and `respecTrack` (every switch after, behind the existing
   confirmation, with its 30-day cooldown). Nothing here awards XP: the only writes are
   follow, the track, and a message. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/brand/Button";
import { CoverFallback } from "@/components/brand/CoverFallback";
import { GalleryCard } from "@/components/gallery/GalleryCard";
import { cardMedia, coverMedia, mediaAlt, stillFor, useSignedMedia } from "@/components/gallery/cardMedia";
import { EditProfileSheet } from "@/components/profile/EditProfileSheet";
import { MessageComposeModal } from "@/components/messages/MessageComposeModal";
import { useCrumbTitle } from "@/components/shell/useBreadcrumb";
import RespecDialog from "@/components/skilltree/respec-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { engagementFor, useEngagement } from "@/hooks/useEngagement";
import type { GalleryBuild } from "@/lib/build/gallery";
import { isPermissionError } from "@/lib/errors/permission";
import { getCollections, type CollectionPreview } from "@/lib/library";
import { createDirectThread, sendTextMessage } from "@/lib/messaging";
import { followMaker, unfollowMaker } from "@/lib/profile/follow";
import { getMakerFigures } from "@/lib/profile/figures";
import { getProfileProgress } from "@/lib/profile/profileProgress";
import { getProfileSummary } from "@/lib/profile/getProfileSummary";
import {
  countMakerWorks,
  listMakerBuilds,
  listMakerReproducedBuilds,
  type MakerBuildsCursor,
  type MakerBuildsPage,
  type ReproducedBuildsCursor,
} from "@/lib/profile/makerBuilds";
import { getStreakDays, respecTrack, setUserTrack, type TrackId } from "@/lib/progress";
import { getMyBadgeKeys } from "@/lib/progress/badges";

import { ProfileLoadFailed, ProfileNotice, ProfileView, ProfileViewSkeleton } from "./ProfileView";
import type { ProfileMakerView } from "./ProfileBanner";
import {
  ACTIVITY_DAYS,
  BADGE_SLUGS,
  activityDays,
  buildsCount,
  levelView,
  marksView,
  sinceLabel,
  worksTabOf,
  type CollectionTileView,
  type FiguresView,
  type WorkCard,
  type WorksTab,
  type WorksView,
} from "./profileModel";

/** A profile does not change while somebody is looking at it. */
const STALE_MS = 60_000;
/** Collections in one page of the Collections tab. */
const COLLECTIONS_PAGE = 24;
/** The respec cooldown the database enforces. */
const RESPEC_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

const EMPTY_BUILDS: GalleryBuild[] = [];

/** A list of build pages as one list of builds, one card for a build that appears twice. */
function flatten(pages: ReadonlyArray<{ builds: GalleryBuild[] }> | undefined): GalleryBuild[] {
  const seen = new Set<string>();
  const out: GalleryBuild[] = [];
  for (const page of pages ?? []) {
    for (const build of page.builds) {
      if (seen.has(build.id)) continue;
      seen.add(build.id);
      out.push(build);
    }
  }
  return out.length > 0 ? out : EMPTY_BUILDS;
}

export function ProfilePage() {
  const { handle } = useParams<{ handle?: string }>();
  const { user, isLoggedIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();

  const [editOpen, setEditOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeBusy, setComposeBusy] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [pendingTrack, setPendingTrack] = useState<TrackId | null>(null);

  /* Who we are looking at. No handle is your own profile, which needs a session. */
  const lookup = handle ?? user?.id ?? null;
  const viewerId = user?.id ?? null;

  useEffect(() => {
    if (!authLoading && !handle && !isLoggedIn) navigate("/login", { replace: true });
  }, [authLoading, handle, isLoggedIn, navigate]);

  /* ── who ── */

  const summaryKey = useMemo(() => ["profile", "getProfileSummary", lookup, viewerId] as const, [lookup, viewerId]);
  const summaryQuery = useQuery({
    queryKey: summaryKey,
    enabled: Boolean(lookup),
    queryFn: () => getProfileSummary(lookup as string, viewerId),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });
  const summary = summaryQuery.data ?? null;
  const makerId = summary?.id ?? null;
  const isOwn = Boolean(summary?.isOwnProfile);

  useCrumbTitle(summary ? summary.displayName : summaryQuery.isPending ? null : summaryQuery.isError && !(summaryQuery.error instanceof Error && summaryQuery.error.message.startsWith("Profile not found")) ? "Profile" : "Not found");

  /* ── the panels, each on its own ── */

  const figuresQuery = useQuery({
    queryKey: ["profile", "getMakerFigures", makerId],
    enabled: Boolean(makerId),
    queryFn: () => getMakerFigures(makerId as string),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });
  const countsQuery = useQuery({
    queryKey: ["profile", "countMakerWorks", makerId],
    enabled: Boolean(makerId),
    queryFn: () => countMakerWorks(makerId as string),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });
  const progressKey = useMemo(() => ["profile", "getProfileProgress", makerId] as const, [makerId]);
  const progressQuery = useQuery({
    queryKey: progressKey,
    enabled: Boolean(makerId),
    queryFn: () => getProfileProgress(makerId as string),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });
  const streakQuery = useQuery({
    queryKey: ["progress", "getStreakDays", makerId, ACTIVITY_DAYS],
    enabled: Boolean(makerId),
    queryFn: () => getStreakDays(makerId as string, ACTIVITY_DAYS),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });
  const marksQuery = useQuery({
    queryKey: ["progress", "getMyBadgeKeys", makerId],
    enabled: Boolean(makerId),
    queryFn: () => getMyBadgeKeys(makerId as string, BADGE_SLUGS),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });

  /* The banner's picture is the cover of their most-reproduced build: the first of the gallery's order. */
  const bannerQuery = useQuery({
    queryKey: ["profile", "listMakerBuilds", makerId, "banner"],
    enabled: Boolean(makerId),
    queryFn: () => listMakerBuilds(makerId as string, { limit: 1 }),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });
  const bannerBuild = bannerQuery.data?.builds[0] ?? null;

  /* ── the works: the open tab's list, read when the tab is open ── */

  const tab: WorksTab = worksTabOf(params.get("tab"));
  const onTab = useCallback(
    (next: WorksTab) => {
      const nextParams = new URLSearchParams(params);
      if (next === "builds") nextParams.delete("tab");
      else nextParams.set("tab", next);
      setParams(nextParams, { replace: false });
    },
    [params, setParams],
  );

  const buildsList = useInfiniteQuery({
    queryKey: ["profile-builds", makerId, tab === "rebuilds" ? "rebuilds" : "builds"],
    enabled: Boolean(makerId) && (tab === "builds" || tab === "rebuilds"),
    initialPageParam: null as MakerBuildsCursor | null,
    queryFn: ({ pageParam }): Promise<MakerBuildsPage<MakerBuildsCursor>> =>
      listMakerBuilds(makerId as string, { rebuildsOnly: tab === "rebuilds", after: pageParam }),
    getNextPageParam: (last) => last.next ?? undefined,
    refetchOnWindowFocus: false,
  });
  const reproducedList = useInfiniteQuery({
    queryKey: ["profile-builds", makerId, "reproduced"],
    enabled: Boolean(makerId) && tab === "reproduced",
    initialPageParam: null as ReproducedBuildsCursor | null,
    queryFn: ({ pageParam }): Promise<MakerBuildsPage<ReproducedBuildsCursor>> =>
      listMakerReproducedBuilds(makerId as string, { after: pageParam }),
    getNextPageParam: (last) => last.next ?? undefined,
    refetchOnWindowFocus: false,
  });
  const collectionsList = useInfiniteQuery({
    queryKey: ["library", "getCollections", makerId, viewerId],
    enabled: Boolean(makerId),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getCollections({ userId: makerId as string, viewerId, limit: COLLECTIONS_PAGE, offset: pageParam }),
    getNextPageParam: (last, all) => {
      const loaded = all.length * COLLECTIONS_PAGE;
      return loaded < last.total ? loaded : undefined;
    },
    refetchOnWindowFocus: false,
  });

  const list = tab === "reproduced" ? reproducedList : tab === "collections" ? collectionsList : buildsList;
  const builds = useMemo(
    () => (tab === "collections" ? EMPTY_BUILDS : flatten(tab === "reproduced" ? reproducedList.data?.pages : buildsList.data?.pages)),
    [tab, buildsList.data, reproducedList.data],
  );

  /* One signing pass for the cards on screen and the banner, one engagement call for the cards. */
  const mediaRows = useMemo(() => [...builds, ...(bannerBuild ? [bannerBuild] : [])].flatMap(cardMedia), [builds, bannerBuild]);
  const srcByPath = useSignedMedia(mediaRows);
  const engagement = useEngagement(useMemo(() => builds.map((build) => build.id), [builds]));

  /* ── mapped for the view ── */

  const maker: ProfileMakerView | null = summary
    ? (() => {
        const media = bannerBuild ? coverMedia(bannerBuild) : null;
        const src = bannerBuild ? stillFor(srcByPath, media) : null;
        return {
          id: summary.id,
          name: summary.displayName,
          handle: summary.handle,
          bio: summary.customBio ?? summary.derivedBio ?? null,
          place: summary.location,
          since: sinceLabel(summary.joinedAt),
          avatarUrl: summary.avatarUrl,
          cover:
            bannerBuild && src ? (
              <img
                src={src}
                alt={mediaAlt(bannerBuild, media)}
                style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <CoverFallback seed={summary.id} radius={0} />
            ),
        };
      })()
    : null;

  const level = progressQuery.data ? levelView(progressQuery.data) : null;

  const figures: FiguresView | null = figuresQuery.data
    ? {
        buildsHung: figuresQuery.data.buildsHung,
        reproducedByOthers: figuresQuery.data.reproducedByOthers,
        rebuildsOfWork: figuresQuery.data.rebuildsOfWork,
        bountiesSolved: figuresQuery.data.bountiesSolved,
        bountyEarningsGbp: figuresQuery.data.bountyEarningsGbp,
        // No creator-mark threshold is defined for any figure (`getCreatorMarks` reads earned rows, not targets), so no Stat draws a bar.
      }
    : null;

  const collectionPages = collectionsList.data?.pages;
  const collectionRows = useMemo(
    () => (collectionPages ?? []).flatMap((page) => page.collections).filter((collection) => !collection.isDefault),
    [collectionPages],
  );
  const defaultsSeen = (collectionPages ?? []).flatMap((page) => page.collections).length - collectionRows.length;
  const collectionsTotal = collectionPages ? Math.max(0, collectionPages[0].total - defaultsSeen) : undefined;

  const counts: WorksView["counts"] = {
    builds: figuresQuery.data?.buildsHung,
    rebuilds: countsQuery.data?.rebuilds,
    reproduced: countsQuery.data?.reproduced,
    collections: collectionsTotal,
  };

  const cards: WorkCard[] = builds.map((build) => ({
    key: build.id,
    render: (variant) => (
      <GalleryCard
        build={build}
        srcByPath={srcByPath}
        engagement={engagementFor(engagement, build.id)}
        coverHeight={variant === "phone" ? 90 : 86}
        titleSize={17}
      />
    ),
  }));

  const collections: CollectionTileView[] = collectionRows.map((collection: CollectionPreview) => ({
    key: collection.id,
    to: isOwn ? `/library/collections/${collection.id}` : `/library/${summary?.handle ?? ""}/collections/${collection.id}`,
    title: collection.name,
    count: buildsCount(collection.itemCount),
    covers: collection.coverItems.slice(0, 4).map((item) =>
      item.cover_image_url ? (
        <img key={item.id} src={item.cover_image_url} alt="" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <CoverFallback key={item.id} seed={item.id} radius={0} />
      ),
    ),
  }));

  const listError = list.error;
  const works: WorksView = {
    tab,
    onTab,
    counts,
    status: listError && (tab === "collections" ? collectionRows.length === 0 : builds.length === 0) ? "error" : list.isPending ? "loading" : "ready",
    errorKind: listError && isPermissionError(listError) ? "permission" : "error",
    error: listError,
    cards,
    collections,
    hasMore: Boolean(list.hasNextPage),
    loadingMore: list.isFetchingNextPage,
    onMore: () => void list.fetchNextPage(),
    onRetry: () => void list.refetch(),
  };

  const activity = streakQuery.data ? activityDays(streakQuery.data, new Date()) : null;

  const marks = marksQuery.data ? marksView(marksQuery.data) : null;

  /* A read that failed says so in its own panel — never as an empty grid or a start at zero — and the rest carry on. */
  const failure = (query: { isError: boolean; data: unknown; error: unknown; refetch: () => unknown }) =>
    query.isError && query.data === undefined ? { onRetry: () => void query.refetch(), error: query.error } : undefined;
  const failed = {
    level: failure(progressQuery),
    figures: failure(figuresQuery),
    activity: failure(streakQuery),
    marks: failure(marksQuery),
  };

  /* ── follow ── */

  const patchSummary = useCallback(
    (following: boolean) =>
      qc.setQueryData(summaryKey, (prev: typeof summary) =>
        prev
          ? {
              ...prev,
              isFollowing: following,
              counts: { ...prev.counts, followers: Math.max(0, prev.counts.followers + (following ? 1 : -1)) },
            }
          : prev,
      ),
    [qc, summaryKey],
  );

  const writeFollow = useCallback(
    async (following: boolean) => {
      if (!summary || !viewerId) {
        navigate("/login");
        return;
      }
      setFollowBusy(true);
      patchSummary(following);
      try {
        await (following ? followMaker(viewerId, summary.id) : unfollowMaker(viewerId, summary.id));
      } catch {
        void qc.invalidateQueries({ queryKey: summaryKey });
        toast({ title: following ? "Could not follow" : "Could not unfollow", variant: "destructive" });
      } finally {
        setFollowBusy(false);
      }
    },
    [summary, viewerId, navigate, patchSummary, qc, summaryKey, toast],
  );

  /* ── message ── */

  const onMessage = useCallback(() => {
    if (!summary) return;
    if (!isLoggedIn) {
      navigate("/login");
      return;
    }
    setComposeOpen(true);
  }, [summary, isLoggedIn, navigate]);

  const onComposeSubmit = useCallback(
    async (firstMessage: string) => {
      if (!summary) return;
      setComposeBusy(true);
      try {
        const threadId = await createDirectThread(summary.id);
        if (firstMessage.trim()) await sendTextMessage(threadId, firstMessage.trim());
        setComposeOpen(false);
        navigate(`/messages/${threadId}`);
      } catch (err) {
        toast({
          title: "Could not start conversation",
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive",
        });
      } finally {
        setComposeBusy(false);
      }
    },
    [summary, navigate, toast],
  );

  /* ── the track ── */

  const currentTrack = progressQuery.data?.track ?? null;
  const lastRespecAt = progressQuery.data?.lastRespecAt ?? null;
  const canRespec = !lastRespecAt || Date.now() - new Date(lastRespecAt).getTime() >= RESPEC_COOLDOWN_MS;
  const nextRespecDate =
    lastRespecAt && !canRespec ? new Date(new Date(lastRespecAt).getTime() + RESPEC_COOLDOWN_MS).toLocaleDateString("en-GB") : undefined;

  const changeTrack = useCallback(
    async (next: TrackId, switching: boolean) => {
      try {
        await (switching ? respecTrack(next) : setUserTrack(next));
        await qc.invalidateQueries({ queryKey: progressKey });
      } catch {
        toast({ title: "Could not change your track", variant: "destructive" });
      }
    },
    [qc, progressKey, toast],
  );

  const onTrack = useCallback(
    (next: TrackId) => {
      if (!isOwn || next === currentTrack) return;
      /* The first choice is free; every switch after it is confirmed, and has a cooldown. */
      if (currentTrack === null) void changeTrack(next, false);
      else setPendingTrack(next);
    },
    [isOwn, currentTrack, changeTrack],
  );

  /* ── the states ── */

  /* No lookup yet is a session still arriving, or a signed-out reader on their way to /login. */
  if (authLoading || !lookup || summaryQuery.isPending) return <ProfileViewSkeleton />;

  /* getProfileSummary throws "Profile not found" for a handle nobody has: that is a missing page, not a failed read. */
  const missing = summaryQuery.error instanceof Error && summaryQuery.error.message.startsWith("Profile not found");
  if (summaryQuery.isError && !summary && !missing) {
    return <ProfileLoadFailed onRetry={() => void summaryQuery.refetch()} error={summaryQuery.error} />;
  }

  if (!summary || !maker) {
    return (
      <ProfileNotice
        line="Profile not found"
        detail="The handle may have changed, or the link is broken."
        action={
          <Button variant="secondary" size={36} onClick={() => navigate("/gallery")}>
            Back to the gallery
          </Button>
        }
      />
    );
  }

  return (
    <>
      <SeoHead
        title={`${summary.displayName} (@${summary.handle})`}
        description={summary.customBio ?? summary.derivedBio ?? `Profile of ${summary.displayName}`}
        path={handle ? `/profile/${handle}` : "/profile"}
      />
      <ProfileView
        fit="content"
        maker={maker}
        isOwn={isOwn}
        following={Boolean(summary.isFollowing)}
        followBusy={followBusy}
        onFollow={() => void writeFollow(true)}
        onUnfollow={() => void writeFollow(false)}
        onMessage={onMessage}
        onEdit={() => setEditOpen(true)}
        level={level}
        onTrack={isOwn ? onTrack : undefined}
        figures={figures}
        works={works}
        activity={activity}
        marks={marks}
        failed={failed}
      />

      {isOwn && viewerId ? (
        <EditProfileSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          userId={viewerId}
          initial={{
            displayName: summary.displayName,
            customBio: summary.customBio,
            coverUrl: summary.coverUrl,
            location: summary.location,
            website: summary.website,
          }}
          onSaved={() => void qc.invalidateQueries({ queryKey: summaryKey })}
        />
      ) : null}

      {!isOwn ? (
        <MessageComposeModal
          open={composeOpen}
          onOpenChange={setComposeOpen}
          recipientLabel={summary.displayName ?? `@${summary.handle}`}
          onSubmit={onComposeSubmit}
          submitting={composeBusy}
        />
      ) : null}

      {pendingTrack && currentTrack ? (
        <RespecDialog
          currentTrack={currentTrack}
          canRespec={canRespec}
          nextRespecDate={nextRespecDate}
          onConfirm={() => {
            const next = pendingTrack;
            setPendingTrack(null);
            void changeTrack(next, true);
          }}
          onCancel={() => setPendingTrack(null)}
        />
      ) : null}
    </>
  );
}

export default ProfilePage;
