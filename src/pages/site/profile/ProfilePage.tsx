/* UX-10 — /profile/:handle (and /profile) in the site frame: the container.

   Loads through `src/lib/` functions only, maps the results to `ProfileView`'s props and renders it. No Supabase call here.

   THE FIRST SCREEN, ONE ROUND. With a handle in the address the profile, the side column's counts (get_profile_side) and the
   feed's first page (get_profile_feed) start together; the route's prefetch starts the same three on the same keys. The feed's
   cards are read inside getProfileFeed, one read per kind. At /profile (your own, no handle yet) the side and the feed wait for
   the profile's handle. The page is ready when the head and the feed's first page are in.

   WHAT A VISITOR SEES is decided in the database: drafts, hidden replies, notes the owner keeps to themselves, a level they hide
   and everything behind a private profile never arrive. Saves are never read.

   REPORT is not offered on a profile: content_reports takes a build, a comment or a topic, not a person (UX-10 report).

   WRITES: follow, a message, the track (as before), a picture or header (useProfilePictures), Customise profile's one Save, Pin
   and Unpin, and a build's own display. None notifies anyone. Nothing here awards XP. */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/brand/Button";
import { CoverFallback } from "@/components/brand/CoverFallback";
import { feedMedia, useSignedMedia, type CardMedia } from "@/components/gallery/cardMedia";
import { MessageComposeModal } from "@/components/messages/MessageComposeModal";
import { PageArrival } from "@/components/shell/PageArrival";
import { useCrumbTitle } from "@/components/shell/useBreadcrumb";
import RespecDialog from "@/components/skilltree/respec-dialog";
import { BADGES } from "@/components/trophies/badge-data";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { engagementFor, useEngagement } from "@/hooks/useEngagement";
import { listBuildMaps, type BuildMap } from "@/lib/build/buildsMaps";
import { copyToClipboard } from "@/lib/deepLink";
import { getCollections, type CollectionPreview } from "@/lib/library";
import { createDirectThread, sendTextMessage } from "@/lib/messaging";
import { listPins, pinToProfile, saveProfile, setBuildDisplay, unpinFromProfile, type ProfileDraft } from "@/lib/profile/customise";
import { followMaker, unfollowMaker } from "@/lib/profile/follow";
import { getProfileFeed, PROFILE_FEED_PAGE, type ProfileFeedPage } from "@/lib/profile/getProfileFeed";
import { getProfileSide } from "@/lib/profile/profileSide";
import { getProfileProgress } from "@/lib/profile/profileProgress";
import { getProfileSummary } from "@/lib/profile/getProfileSummary";
import { DEFAULT_SETTINGS, PINS_MAX, type FeedFilter, type Pin } from "@/lib/profile/settings";
import { respecTrack, setUserTrack, type TrackId } from "@/lib/progress";
import { getMyBadgeKeys } from "@/lib/progress/badges";
import { usePageReady } from "@/lib/routing/pageReady";

import { CustomiseProfile } from "./CustomiseProfile";
import type { FeedEntry } from "./ProfileFeed";
import { ProfileLoadFailed, ProfileNotice, ProfileView, ProfileViewSkeleton } from "./ProfileView";
import { entryOf } from "./profileEntries";
import { emptyFeed, feedOptions, joinedLabel, metaParts, oneLineOf, othersLines, privateLine, recordParts, shownFilter, STANDING_LABEL } from "./profileFeedModel";
import { TRACK_ITEMS, levelView, streakLine, xpLine } from "./profileModel";
import { useProfilePictures } from "./useProfilePictures";

/** A profile does not change while somebody is looking at it. */
const STALE_MS = 60_000;
/** Collections drawn in the side column. */
const COLLECTIONS_SHOWN = 4;
/** The respec cooldown the database enforces. */
const RESPEC_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

export const profileKeys = {
  summary: (lookup: string | null, viewerId: string | null) => ["profile", "getProfileSummary", lookup, viewerId] as const,
  side: (handle: string | null, viewerId: string | null) => ["profile", "getProfileSide", handle, viewerId] as const,
  feed: (handle: string | null, filter: FeedFilter, viewerId: string | null) => ["profile", "getProfileFeed", handle, filter, viewerId] as const,
};

/** The feed's first page, as the page and the route's prefetch read it. */
export const feedQuery = (handle: string, filter: FeedFilter) => ({
  queryFn: ({ pageParam }: { pageParam: string | null }) => getProfileFeed(handle, { filter, cursor: pageParam }),
  initialPageParam: null as string | null,
  getNextPageParam: (last: ProfileFeedPage) => last.next ?? undefined,
});

export function ProfilePage() {
  const { handle: handleParam } = useParams<{ handle?: string }>();
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
  const lookup = handleParam ?? user?.id ?? null;
  const viewerId = user?.id ?? null;

  useEffect(() => {
    if (!authLoading && !handleParam && !isLoggedIn) navigate("/login", { replace: true });
  }, [authLoading, handleParam, isLoggedIn, navigate]);

  /* ── round one: the profile, its side column and the feed's first page, together ── */

  const summaryKey = profileKeys.summary(lookup, viewerId);
  const summaryQuery = useQuery({
    queryKey: summaryKey,
    enabled: Boolean(lookup),
    queryFn: () => getProfileSummary(lookup as string, viewerId),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });
  const summary = summaryQuery.data ?? null;
  const handle = handleParam ?? summary?.handle ?? null;
  const isOwn = Boolean(summary?.isOwnProfile);
  const settings = summary?.settings ?? DEFAULT_SETTINGS;
  const locked = Boolean(summary?.isPrivate && !isOwn && !summary?.isFollowing);

  useCrumbTitle(summary ? summary.displayName : summaryQuery.isPending ? null : summaryQuery.isError && !(summaryQuery.error instanceof Error && summaryQuery.error.message.startsWith("Profile not found")) ? "Profile" : "Not found");

  const sideKey = profileKeys.side(handle, viewerId);
  const sideQuery = useQuery({
    queryKey: sideKey,
    enabled: Boolean(handle) && !authLoading,
    queryFn: () => getProfileSide(handle as string),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });
  const side = sideQuery.data ?? null;

  const filter = shownFilter(params.get("show"), settings.feedFilter, side?.counts ?? null);
  const feedKey = profileKeys.feed(handle, filter, viewerId);
  const feed = useInfiniteQuery({
    queryKey: feedKey,
    enabled: Boolean(handle) && !authLoading,
    ...feedQuery(handle ?? "", filter),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
    // A new filter keeps the old cards until the new ones arrive; nothing fades.
    placeholderData: keepPreviousData,
  });
  const items = useMemo(() => (feed.data?.pages ?? []).flatMap((page) => page.items), [feed.data]);
  const extras = feed.data?.pages[0]?.extras;

  /* ── what the cards need beyond the feed: pictures signed once, the engagement row, the Maps ── */

  const builds = items.flatMap((item) => (item.kind === "build" ? [item.build] : []));
  const media = (() => {
    const rows: CardMedia[] = [];
    const seen = new Set<string>();
    for (const build of builds) for (const row of feedMedia(build)) if (!seen.has(row.id)) (seen.add(row.id), rows.push(row));
    return rows;
  })();
  const srcByPath = useSignedMedia(media);
  const engagement = useEngagement(builds.map((build) => build.id));
  const mapIds = builds.map((build) => build.id).sort().join(",");
  const mapsQuery = useQuery({
    queryKey: ["build", "listBuildMaps", mapIds],
    enabled: mapIds.length > 0,
    queryFn: () => listBuildMaps(mapIds.split(",")),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });
  const maps = new Map<string, BuildMap>((mapsQuery.data ?? []).map((map) => [map.buildId, map]));

  /* ── your own profile: progress, marks, pins ── */

  const makerId = summary?.id ?? null;
  const progressKey = ["profile", "getProfileProgress", makerId] as const;
  const progressQuery = useQuery({
    queryKey: progressKey,
    enabled: Boolean(makerId) && isOwn,
    queryFn: () => getProfileProgress(makerId as string),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });
  const marksQuery = useQuery({
    queryKey: ["progress", "getMyBadgeKeys", makerId],
    enabled: Boolean(makerId) && !locked,
    queryFn: () => getMyBadgeKeys(makerId as string, BADGES.map((badge) => badge.id)),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });
  const collectionsQuery = useQuery({
    queryKey: ["library", "getCollections", makerId, viewerId, COLLECTIONS_SHOWN],
    enabled: Boolean(makerId) && !locked,
    queryFn: () => getCollections({ userId: makerId as string, viewerId, limit: COLLECTIONS_SHOWN + 1 }),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });
  const pinsQuery = useQuery({
    queryKey: ["profile", "listPins", makerId],
    enabled: Boolean(makerId) && isOwn,
    queryFn: () => listPins(makerId as string),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });

  const refreshProfile = () => {
    void qc.invalidateQueries({ queryKey: ["profile"] });
  };
  const pictures = useProfilePictures({ onSaved: refreshProfile });

  /* ── follow ── */

  const writeFollow = async (following: boolean) => {
    if (!summary || !viewerId) {
      navigate("/login");
      return;
    }
    setFollowBusy(true);
    qc.setQueryData(summaryKey, (prev: typeof summary) =>
      prev ? { ...prev, isFollowing: following, counts: { ...prev.counts, followers: Math.max(0, prev.counts.followers + (following ? 1 : -1)) } } : prev,
    );
    try {
      await (following ? followMaker(viewerId, summary.id) : unfollowMaker(viewerId, summary.id));
      // A private profile opens once followed.
      if (summary.isPrivate) refreshProfile();
    } catch {
      void qc.invalidateQueries({ queryKey: summaryKey });
      toast({ title: following ? "Could not follow" : "Could not unfollow", variant: "destructive" });
    } finally {
      setFollowBusy(false);
    }
  };

  /* ── message ── */

  const onComposeSubmit = async (firstMessage: string) => {
    if (!summary) return;
    setComposeBusy(true);
    try {
      const threadId = await createDirectThread(summary.id);
      if (firstMessage.trim()) await sendTextMessage(threadId, firstMessage.trim());
      setComposeOpen(false);
      navigate(`/messages/${threadId}`);
    } catch (err) {
      toast({ title: "Could not start conversation", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setComposeBusy(false);
    }
  };

  /* ── the track (Your progress) ── */

  const currentTrack = progressQuery.data?.track ?? null;
  const lastRespecAt = progressQuery.data?.lastRespecAt ?? null;
  const canRespec = !lastRespecAt || Date.now() - new Date(lastRespecAt).getTime() >= RESPEC_COOLDOWN_MS;
  const nextRespecDate = lastRespecAt && !canRespec ? new Date(new Date(lastRespecAt).getTime() + RESPEC_COOLDOWN_MS).toLocaleDateString("en-GB") : undefined;
  const changeTrack = async (next: TrackId, switching: boolean) => {
    try {
      await (switching ? respecTrack(next) : setUserTrack(next));
      await qc.invalidateQueries({ queryKey: progressKey });
    } catch {
      toast({ title: "Could not change your track", variant: "destructive" });
    }
  };
  const onTrack = (next: TrackId) => {
    if (!isOwn || next === currentTrack) return;
    /* The first choice is free; every switch after it is confirmed, and has a cooldown. */
    if (currentTrack === null) void changeTrack(next, false);
    else setPendingTrack(next);
  };

  /* ── pins and a build's display ── */

  const pinOf = (entry: FeedEntry): Pin => ({ kind: entry.kind === "build" ? "build" : entry.kind, id: entry.id });
  const pinWrite = async (write: () => Promise<void>, failed: string) => {
    try {
      await write();
      refreshProfile();
    } catch (error) {
      toast({ title: failed, description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    }
  };

  /* ── usePageReady: the head and the first feed page ── */

  const waiting = authLoading || !lookup || summaryQuery.isPending;
  usePageReady("profile", !waiting && (locked || !summary || !feed.isPending));

  const arrive = (node: ReactNode) => (
    <PageArrival loading={waiting} placeholder={<ProfileViewSkeleton />}>
      {node}
    </PageArrival>
  );
  if (waiting) return arrive(<ProfileViewSkeleton />);

  /* getProfileSummary throws "Profile not found" for a handle nobody has: that is a missing page, not a failed read. */
  const missing = summaryQuery.error instanceof Error && summaryQuery.error.message.startsWith("Profile not found");
  if (summaryQuery.isError && !summary && !missing) {
    return arrive(<ProfileLoadFailed onRetry={() => void summaryQuery.refetch()} error={summaryQuery.error} />);
  }
  if (!summary || !handle) {
    return arrive(
      <ProfileNotice
        line="Profile not found"
        detail="The handle may have changed, or the link is broken."
        action={
          <Button variant="secondary" size={36} onClick={() => navigate("/builds")}>
            Back to Builds
          </Button>
        }
      />,
    );
  }

  /* ── mapped for the view ── */

  const now = Date.now();
  const maker = { id: summary.id, handle: summary.handle, name: summary.displayName, avatarUrl: summary.avatarUrl };
  const entries = extras
    ? items.map((item) =>
        entryOf(item, {
          maker,
          ownerDisplay: settings.buildDisplay,
          extras,
          srcByPath,
          engagement: (id) => engagementFor(engagement, id),
          maps,
          mapsFailed: mapsQuery.isError,
          now,
        }),
      )
    : [];
  const pinnedCount = pinsQuery.data?.length ?? entries.filter((entry) => entry.pinned).length;
  const links = (summary.links ?? []).length > 0 ? (summary.links ?? []) : summary.website?.startsWith("https://") ? [summary.website] : [];
  const level = isOwn ? (progressQuery.data ? levelView(progressQuery.data) : null) : null;

  const head = {
    userId: summary.id,
    name: summary.displayName,
    handle: summary.handle,
    avatarUrl: summary.avatarUrl,
    avatarAlt: summary.avatarAlt ?? null,
    header: summary.coverUrl ? { url: summary.coverUrl, crop: summary.bannerCrop ?? null, alt: summary.bannerAlt ?? null } : null,
    meta: metaParts({ handle: summary.handle, place: summary.location, joined: joinedLabel(summary.joinedAt), followers: summary.counts.followers, following: summary.counts.following }),
    level: isOwn ? (level?.level ?? side?.level ?? null) : (side?.level ?? null),
    oneLine: oneLineOf(summary.customBio),
    links,
    record: side
      ? recordParts(summary.handle, {
          builds: side.counts.builds,
          reproducedByOthers: side.reproducedByOthers,
          rebuiltFrom: side.rebuiltFrom,
          firstRebuildSlug: side.firstRebuildSlug,
          topicsAndReplies: side.counts.topics + side.counts.replies,
        })
      : [],
    isOwn,
    privateLine: locked ? privateLine(summary.handle) : null,
    following: Boolean(summary.isFollowing),
    followBusy,
    onFollow: () => void writeFollow(true),
    onUnfollow: () => void writeFollow(false),
    onMessage: () => (isLoggedIn ? setComposeOpen(true) : navigate("/login")),
    onEdit: () => setEditOpen(true),
    onCopyLink: () => {
      void copyToClipboard(`${window.location.origin}/profile/${summary.handle}`).then((ok) => toast({ title: ok ? "Link copied" : "Could not copy the link" }));
    },
    onChangeHeader: (from: HTMLElement | null) => pictures.change("banner", from),
    onChangePicture: (from: HTMLElement | null) => pictures.change("avatar", from),
    uploading: pictures.uploading,
  };

  const onFilter = (next: FeedFilter) => {
    const nextParams = new URLSearchParams(params);
    if (next === settings.feedFilter) nextParams.delete("show");
    else nextParams.set("show", next);
    setParams(nextParams, { replace: false });
  };

  const collections = (collectionsQuery.data?.collections ?? []).filter((collection) => !collection.isDefault).slice(0, COLLECTIONS_SHOWN);

  const viewProps = {
    head,
    feed: locked
      ? null
      : {
          filter,
          options: feedOptions(side?.counts ?? null),
          onFilter,
          entries,
          status: (feed.isError && entries.length === 0 ? "error" : feed.isPending ? "loading" : "ready") as "error" | "loading" | "ready",
          onRetry: () => void feed.refetch(),
          empty: emptyFeed(filter, isOwn),
          hasMore: Boolean(feed.hasNextPage),
          loadingMore: feed.isFetchingNextPage,
          onMore: () => void feed.fetchNextPage(),
          isOwn,
          canPin: pinnedCount < PINS_MAX,
          onPin: (entry: FeedEntry) => void pinWrite(() => pinToProfile(summary.id, pinOf(entry)), "Could not pin"),
          onUnpin: (entry: FeedEntry) => void pinWrite(() => unpinFromProfile(summary.id, pinOf(entry)), "Could not unpin"),
          onDisplay: (buildId: string, display: "first_post" | "map") => void pinWrite(() => setBuildDisplay(buildId, display), "Could not change how it shows"),
          now,
        },
    side: locked
      ? null
      : {
          order: settings.sideSections,
          about: summary.about ?? null,
          worksIn: side?.worksIn ?? [],
          spaces: (side?.spaces ?? []).map((space) => ({ slug: space.slug, name: space.name, standing: STANDING_LABEL[space.standing] })),
          others: side ? othersLines(summary.handle, side) : [],
          collections: collections.map((collection: CollectionPreview) => ({
            key: collection.id,
            to: isOwn ? `/library/collections/${collection.id}` : `/library/${summary.handle}/collections/${collection.id}`,
            title: collection.name,
            count: `${collection.itemCount.toLocaleString("en-GB")} ${collection.itemCount === 1 ? "build" : "builds"}`,
            covers: collection.coverItems.slice(0, 4).map((item) =>
              item.cover_image_url ? (
                <img key={item.id} src={item.cover_image_url} alt="" loading="lazy" decoding="async" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <CoverFallback key={item.id} seed={item.id} radius={0} />
              ),
            ),
          })),
          marks: BADGES.filter((badge) => marksQuery.data?.has(badge.id)).map((badge) => badge.name),
          progress:
            isOwn && level
              ? {
                  level: level.level,
                  xpLine: xpLine(level),
                  streak: level.streakDays > 0 ? streakLine(level, true) : null,
                  track: currentTrack,
                  tracks: TRACK_ITEMS,
                  onTrack: (next: TrackId) => onTrack(next),
                }
              : null,
        },
  };

  const draft: ProfileDraft = {
    displayName: summary.displayName,
    oneLine: summary.customBio ?? "",
    location: summary.location ?? "",
    links: summary.links ?? [],
    about: summary.about ?? "",
    settings,
    pins: pinsQuery.data ?? entries.filter((entry) => entry.pinned).map(pinOf),
  };
  const pinLabels = new Map(entries.map((entry) => [`${pinOf(entry).kind}:${entry.id}`, entry.heading]));

  return arrive(
    <>
      <SeoHead
        title={`${summary.displayName} (@${summary.handle})`}
        description={summary.customBio ?? summary.derivedBio ?? `Profile of ${summary.displayName}`}
        path={handleParam ? `/profile/${handleParam}` : "/profile"}
        noIndex={locked}
      />
      <ProfileView {...viewProps} />

      {isOwn ? pictures.element : null}
      {isOwn && editOpen ? (
        <CustomiseProfile
          open
          onClose={() => setEditOpen(false)}
          initial={draft}
          pinLabels={pinLabels}
          pictures={{ avatar: { url: summary.avatarUrl }, header: { url: summary.coverUrl } }}
          onPicture={(action, which, from) => {
            if (action === "change") pictures.change(which, from);
            else if (action === "remove") pictures.remove(which);
            else {
              const url = which === "avatar" ? summary.avatarUrl : summary.coverUrl;
              if (url) pictures.recrop(which, { url, crop: which === "avatar" ? (summary.avatarCrop ?? null) : (summary.bannerCrop ?? null), alt: which === "avatar" ? (summary.avatarAlt ?? null) : (summary.bannerAlt ?? null) }, from);
            }
          }}
          onSave={async (next) => {
            await saveProfile(next);
            refreshProfile();
          }}
        />
      ) : null}

      {!isOwn ? (
        <MessageComposeModal open={composeOpen} onOpenChange={setComposeOpen} recipientLabel={summary.displayName ?? `@${summary.handle}`} onSubmit={onComposeSubmit} submitting={composeBusy} />
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
    </>,
  );
}

export { PROFILE_FEED_PAGE };
export default ProfilePage;
