/* UX-05 Part 2: /openbuilds, the container.

   Loads through `src/lib/openbuilds` only (UX-04's layer; the prompt calls it `src/lib/posts`), maps the results to
   `OpenBuildsFeedView`'s props, and opens the posting windows. Round 1 starts together: the posts with their cards' extras
   (the posts, then one round for the work, replies and pictures they name, inside `listPostCards`), the reader's spaces and the
   busy spaces. The `n new` counts need the reader's space ids, so they are one read behind and never hold the page.

   WHERE THE READER IS lives in the address (`?scope=everyone`, `?open=1`). Changing either is the same page with new
   parameters: the old list stays until the new arrives, with no fade. */

import { Suspense, lazy, useEffect, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { SeoHead } from "@/components/SeoHead";
import { PageArrival } from "@/components/shell/PageArrival";
import { toCardData } from "@/components/post/postCardModel";
import { useAuth } from "@/contexts/AuthContext";
import { engagementFor, useEngagement } from "@/hooks/useEngagement";
import { reportError } from "@/lib/errors/report";
import { joinSpace, listBusySpaces, listMySpaces, listPostCards, listRecentPostTimes } from "@/lib/openbuilds";
import { usePageReady } from "@/lib/routing/pageReady";

import { OpenBuildsFeedLoadingView } from "./OpenBuildsFeedFrame";
import { OpenBuildsFeedView } from "./OpenBuildsFeedView";
import { FEED_PAGE, busyMeta, busySpacesKey, feedKey, feedSearch, freshCount, mySpacesKey, readFeedAddress, readSeen, recentTimesKey } from "./openBuildsFeedModel";
import type { PostingWindow } from "./PostingWindows";

const PostingWindows = lazy(() => import("./PostingWindows"));

function useReported(error: unknown, context: string) {
  useEffect(() => {
    if (error) reportError(error, { source: "openbuilds", context });
  }, [error, context]);
}

export default function OpenBuildsFeedPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const viewerId = user?.id ?? null;
  const address = readFeedAddress(params, viewerId !== null);
  const now = Date.now();

  /* ── round 1 ── */

  const feed = useInfiniteQuery({
    queryKey: feedKey(address.scope, address.open, viewerId),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listPostCards({ scope: address.scope === "mine" ? "spaces" : "everyone", stillOpen: address.open || undefined, offset: pageParam, limit: FEED_PAGE }),
    getNextPageParam: (last) => last.next ?? undefined,
    placeholderData: keepPreviousData,
    // The key carries the reader: asked once the session is known, never once as nobody first.
    enabled: !authLoading,
  });
  const mine = useQuery({ queryKey: mySpacesKey(viewerId), queryFn: listMySpaces, enabled: viewerId !== null });
  const busy = useQuery({ queryKey: busySpacesKey, queryFn: () => listBusySpaces({ limit: 8 }) });
  const spaceIds = (mine.data ?? []).map((space) => space.id);
  const times = useQuery({ queryKey: recentTimesKey(spaceIds), queryFn: () => listRecentPostTimes(spaceIds), enabled: spaceIds.length > 0 });

  const arriving = authLoading || feed.isPending || (viewerId !== null && mine.isPending) || busy.isPending;
  useReported(feed.error, "openbuilds-feed");
  useReported(mine.error, "openbuilds-my-spaces");
  useReported(busy.error, "openbuilds-busy-spaces");
  usePageReady("openbuilds", !arriving);

  /* ── the windows ── */

  const [win, setWin] = useState<PostingWindow | null>(null);
  const signIn = () => navigate(`/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`);
  const onPost = () => (viewerId ? setWin({ kind: "post" }) : signIn());
  const onMakeSpace = () => (viewerId ? setWin({ kind: "make-space" }) : signIn());

  const join = async (spaceId: string) => {
    if (!viewerId) return signIn();
    try {
      await joinSpace(spaceId);
      void qc.invalidateQueries({ queryKey: mySpacesKey(viewerId) });
    } catch (error) {
      reportError(error, { source: "openbuilds", context: "joinSpace" });
      toast.error(error instanceof Error && error.message ? error.message : "Couldn't join. Try again.");
    }
  };

  /* ── the view's props ── */

  const pages = feed.data?.pages ?? [];
  const posts = pages.flatMap((page) => page.posts.map((post) => ({ post, extras: page.extras })));
  const buildIds = posts.flatMap(({ post, extras }) => {
    const id = toCardData(post, { work: extras.work, signed: extras.signed, digests: extras.digests, now, hrefOf: () => "" }).engagementBuild?.id;
    return id ? [id] : [];
  });
  const engagement = useEngagement(buildIds);
  const items = posts.map(({ post, extras }) => {
    const card = toCardData(post, { work: extras.work, signed: extras.signed, digests: extras.digests, now, hrefOf: (target) => `/openbuilds/posts/${target.id}` });
    return { card, engagement: card.engagementBuild ? engagementFor(engagement, card.engagementBuild.id) : undefined };
  });

  const memberIds = new Set(spaceIds);
  const busyRows = (busy.data ?? [])
    .filter((entry) => !memberIds.has(entry.space.id) && entry.space.whoCanPost !== "invite")
    .slice(0, 5)
    .map((entry) => ({ id: entry.space.id, slug: entry.space.slug, name: entry.space.name, meta: busyMeta(entry.creatorHandle, entry.members), onJoin: () => void join(entry.space.id) }));

  const move = (next: Parameters<typeof feedSearch>[1]) => setParams(feedSearch(params, next, viewerId !== null), { replace: true });

  return (
    <>
      <SeoHead title="OpenBuilds · buildgallery" description="Post anything, reply with anything. Spaces are made and run by the people in them." path="/openbuilds" />
      <PageArrival loading={arriving} placeholder={<OpenBuildsFeedLoadingView />}>
        {arriving ? (
          <OpenBuildsFeedLoadingView />
        ) : (
          <OpenBuildsFeedView
            signedIn={viewerId !== null}
            scope={address.scope}
            onScope={(scope) => move({ scope })}
            open={address.open}
            onOpen={(open) => move({ open })}
            onPost={onPost}
            onMakeSpace={onMakeSpace}
            signInTo={`/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`}
            spaces={{
              status: mine.isError ? "error" : "ready",
              onRetry: () => void mine.refetch(),
              rows: (mine.data ?? []).map((space) => ({ id: space.id, slug: space.slug, name: space.name, fresh: freshCount(times.data?.[space.id], readSeen(space.slug)) })),
            }}
            posts={{
              status: feed.isError ? "error" : "ready",
              onRetry: () => void feed.refetch(),
              items,
              more: feed.hasNextPage ? { loading: feed.isFetchingNextPage, onMore: () => void feed.fetchNextPage() } : undefined,
            }}
            busy={busyRows}
          />
        )}
      </PageArrival>
      {win ? (
        <Suspense fallback={null}>
          <PostingWindows window={win} onClose={() => setWin(null)} />
        </Suspense>
      ) : null}
    </>
  );
}
