/* UX-05 Part 3: /openbuilds/spaces/:slug, the container.

   Round 1 is the space with its people and the reader's role. Round 2, which needs the space's id and order: its topics, in the
   order the space sets, with hidden ones too when the reader moderates it. Pin, Unpin, Hide and Unhide change the list on the
   page at once and ask the database after; a refusal puts the list back and says so. */

import { Suspense, lazy, useEffect, useState } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { SeoHead } from "@/components/SeoHead";
import { toCardData, topicHref } from "@/components/post/postCardModel";
import { useAuth } from "@/contexts/AuthContext";
import { engagementFor, useEngagement } from "@/hooks/useEngagement";
import { reportError } from "@/lib/errors/report";
import { getSpaceCrowd, hidePost, joinSpace, listPostCards, pinPost, unhidePost, unpinPost, type CardsPage } from "@/lib/openbuilds";
import { usePageReady } from "@/lib/routing/pageReady";

import { OpenBuildsFeedLoadingView } from "./OpenBuildsFeedFrame";
import { EmptyLine } from "./OpenBuildsFeedParts";
import { FEED_PAGE, markSeen, mySpacesKey } from "./openBuildsFeedModel";
import type { FeedItem } from "./OpenBuildsFeedView";
import type { PostingWindow } from "./PostingWindows";
import { orderLine, readSpaceTab, spaceCrowdKey, spaceMeta, spacePostsKey, spaceSearch } from "./spaceModel";
import { SpaceView } from "./SpaceView";
import { PostControl } from "@/components/post/postControls";

const PostingWindows = lazy(() => import("./PostingWindows"));

type Patch = { pinned?: boolean; hidden?: { by: string; reason: string | null } | null };

export default function SpacePage() {
  const { slug = "" } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const viewerId = user?.id ?? null;
  const tab = readSpaceTab(params);
  const now = Date.now();

  const crowd = useQuery({ queryKey: spaceCrowdKey(slug, viewerId), queryFn: () => getSpaceCrowd(slug, viewerId), enabled: !authLoading });
  const space = crowd.data?.space ?? null;
  const moderator = crowd.data?.role === "moderator";

  const feed = useInfiniteQuery({
    queryKey: spacePostsKey(space?.id ?? "", space?.postOrder ?? "newest", moderator),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => listPostCards({ scope: "everyone", spaceId: space!.id, order: space!.postOrder, includeHidden: moderator, offset: pageParam, limit: FEED_PAGE }),
    getNextPageParam: (last) => last.next ?? undefined,
    placeholderData: keepPreviousData,
    enabled: space !== null,
  });

  const arriving = authLoading || crowd.isPending || (space !== null && feed.isPending);
  useEffect(() => {
    if (crowd.error) reportError(crowd.error, { source: "openbuilds", context: "space-crowd" });
    if (feed.error) reportError(feed.error, { source: "openbuilds", context: "space-posts" });
  }, [crowd.error, feed.error]);
  usePageReady("openbuilds", !arriving);
  // Looking at a space is what clears its `n new`.
  useEffect(() => {
    if (space) markSeen(space.slug);
  }, [space]);

  const [win, setWin] = useState<PostingWindow | null>(null);
  const signIn = () => navigate(`/login?redirect=${encodeURIComponent(`${location.pathname}${location.search}`)}`);

  const join = async () => {
    if (!viewerId) return signIn();
    if (!space) return;
    try {
      await joinSpace(space.id);
      void qc.invalidateQueries({ queryKey: spaceCrowdKey(slug, viewerId) });
      void qc.invalidateQueries({ queryKey: mySpacesKey(viewerId) });
    } catch (error) {
      reportError(error, { source: "openbuilds", context: "joinSpace" });
      toast.error(error instanceof Error && error.message ? error.message : "Couldn't join. Try again.");
    }
  };

  /* ── moderation: shown at once, put back if refused ── */

  const key = spacePostsKey(space?.id ?? "", space?.postOrder ?? "newest", moderator);
  const change = (postId: string, patch: Patch) =>
    qc.setQueryData<InfiniteData<CardsPage, number>>(key, (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          posts: page.posts.map((post) =>
            post.id !== postId
              ? post
              : {
                  ...post,
                  ...(patch.pinned !== undefined ? { pinnedBy: patch.pinned ? (viewerId ?? "") : null, pinnedAt: patch.pinned ? new Date().toISOString() : null } : null),
                  ...(patch.hidden !== undefined ? { hiddenBy: patch.hidden ? patch.hidden.by : null, hiddenReason: patch.hidden ? patch.hidden.reason : null } : null),
                },
          ),
        })),
      },
    );
  const moderate = async (postId: string, patch: Patch, undo: Patch, write: () => Promise<void>) => {
    change(postId, patch);
    try {
      await write();
      void qc.invalidateQueries({ queryKey: ["posts", "listPostCards"] });
    } catch (error) {
      change(postId, undo);
      reportError(error, { source: "openbuilds", context: "moderatePost" });
      toast.error(error instanceof Error && error.message ? error.message : "That didn't save. Try again.");
    }
  };

  /* ── the view's props ── */

  const handles = new Map((crowd.data?.moderators ?? []).map((person) => [person.id, person.handle]));
  const pages = feed.data?.pages ?? [];
  const posts = pages.flatMap((page) => page.posts.map((post) => ({ post, extras: page.extras })));
  const view = space?.defaultView === "wall" ? ("wall" as const) : ("thread" as const);
  const contextFor = (extras: CardsPage["extras"]) => ({ work: extras.work, signed: extras.signed, digests: extras.digests, now, hrefOf: (target: { id: string }) => topicHref(target.id, { view }), moderator: () => moderator, handleOf: (id: string) => handles.get(id) ?? null });
  const buildIds = posts.flatMap(({ post, extras }) => {
    const id = toCardData(post, contextFor(extras)).engagementBuild?.id;
    return id ? [id] : [];
  });
  const engagement = useEngagement(buildIds);
  const items: FeedItem[] = posts.map(({ post, extras }) => {
    const card = toCardData(post, contextFor(extras));
    return {
      card,
      engagement: card.engagementBuild ? engagementFor(engagement, card.engagementBuild.id) : undefined,
      moderation: moderator
        ? {
            onPin: () => void moderate(post.id, { pinned: true }, { pinned: false }, () => pinPost(post.id)),
            onUnpin: () => void moderate(post.id, { pinned: false }, { pinned: true }, () => unpinPost(post.id)),
            onHide: (reason: string) => void moderate(post.id, { hidden: { by: viewerId ?? "", reason: reason || null } }, { hidden: null }, () => hidePost(post.id, reason || undefined)),
            onUnhide: () => void moderate(post.id, { hidden: null }, { hidden: { by: post.hiddenBy ?? "", reason: post.hiddenReason } }, () => unhidePost(post.id)),
          }
        : undefined,
    };
  });

  if (!arriving && (crowd.isError || !crowd.data)) {
    return crowd.isError ? (
      <EmptyLine line="This space didn't load.">
        <PostControl onClick={() => void crowd.refetch()}>Retry</PostControl>
      </EmptyLine>
    ) : (
      <EmptyLine line="There is no space at this address.">
        <PostControl to="/openbuilds">OpenBuilds</PostControl>
      </EmptyLine>
    );
  }

  return (
    <>
      <SeoHead title={`${space?.name ?? "Space"} · OpenBuilds`} description={space?.description || "A space on OpenBuilds."} path={`/openbuilds/spaces/${slug}`} />
      {arriving || !crowd.data || !space ? (
        <OpenBuildsFeedLoadingView />
      ) : (
        <SpaceView
          name={space.name}
          description={space.description}
          meta={spaceMeta(crowd.data)}
          orderLine={orderLine(space.postOrder, crowd.data.creator.handle)}
          rules={space.rules}
          role={crowd.data.role}
          tab={tab}
          onTab={(next) => setParams(spaceSearch(params, next), { replace: true })}
          onJoin={() => void join()}
          onPost={() => setWin({ kind: "post", spaceSlug: space.slug })}
          onSettings={() => setWin({ kind: "settings", slug: space.slug })}
          posts={{ status: feed.isError ? "error" : "ready", items, onRetry: () => void feed.refetch(), more: feed.hasNextPage ? { loading: feed.isFetchingNextPage, onMore: () => void feed.fetchNextPage() } : undefined }}
        />
      )}
      {win ? (
        <Suspense fallback={null}>
          <PostingWindows window={win} onClose={() => setWin(null)} onReopen={setWin} />
        </Suspense>
      ) : null}
    </>
  );
}

