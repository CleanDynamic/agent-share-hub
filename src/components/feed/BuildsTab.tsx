// The Builds tab: the new path's own feed, in one request per page.
//
// LAZY ON PURPOSE, and default-exported so it can be. Home is the entry
// bundle — the page every visitor loads before anything else — and this tab
// brings the gallery card, its five bodies and the build data layer with it.
// Five of the six tabs need none of that, and the measured gap on this
// application is download weight rather than execution, so the card code is
// fetched when somebody actually opens the tab. That is also why this
// component owns its own query rather than Home owning it: a hook in Home
// would pull the same modules into the entry bundle through the back door.
//
// ONE RPC PER PAGE. get_build_feed returns builds, rebuilds and reproduction
// notes already merged and ordered, so there is nothing to sort here and no
// second query to reconcile with. Paging is keyset — the cursor is the last
// item's own timestamp — so page fifty costs what page one costs and a build
// published while somebody is reading does not shift the window under them.
//
// The media requests are the exception to "one request", and they are the same
// exception the gallery already makes: build-media is a private bucket, so
// every cover needs a signature, and the signature has to carry the transform
// that fetches a card-sized derivative rather than the original. One per cover
// on an open HTTP/2 connection, issued together. See cardMedia.ts.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FeedEmptyState, FeedSkeleton } from "@/components/feed/FeedShell";
import { BuildFeedItemView } from "@/components/feed/BuildFeedItems";
import { cardMedia, useSignedMedia } from "@/components/gallery/cardMedia";
import { TEXT_MUTED, labelText } from "@/components/build/tokens";
import {
  FEED_PAGE_SIZE,
  getBuildFeed,
  type FeedItem,
} from "@/lib/feed/getBuildFeed";

/**
 * How far below the fold the next page starts loading.
 *
 * Roughly two cards' worth. Small enough that a page is not fetched for a
 * reader who never scrolls, large enough that one is in hand before they reach
 * the bottom — the point of infinite scroll is not seeing it work.
 */
const PREFETCH_MARGIN = "600px";

/** Nothing is refetched for half a minute; a feed is not a live ticker. */
const FEED_STALE_MS = 30_000;

export function BuildsTab() {
  const navigate = useNavigate();

  const feed = useInfiniteQuery({
    queryKey: ["home_builds_feed"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      getBuildFeed({ before: pageParam, pageSize: FEED_PAGE_SIZE }),
    // undefined, not null: react-query reads undefined as "there is no next
    // page" and stops asking. getBuildFeed returns null when the page came
    // back short, which is the same fact in the data layer's own vocabulary.
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    staleTime: FEED_STALE_MS,
  });

  const items: FeedItem[] = useMemo(
    () => feed.data?.pages.flatMap((page) => page.items) ?? [],
    [feed.data]
  );

  // Every cover the loaded items may render, collected before any item renders
  // so they are signed together rather than one request per card as it mounts.
  const mediaRows = useMemo(
    () =>
      items.flatMap((item) =>
        item.kind === "repro_note" ? [] : cardMedia(item.build)
      ),
    [items]
  );
  const srcByPath = useSignedMedia(mediaRows);

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = feed;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (feed.isLoading) return <FeedSkeleton />;

  if (feed.isError) {
    return (
      <p
        data-testid="feed-builds-error"
        style={{ ...labelText, color: TEXT_MUTED, marginTop: 48, textAlign: "center" }}
      >
        The feed could not be loaded. {(feed.error as Error).message}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <FeedEmptyState
        activeTab="builds"
        onEmptyCTAClick={() => navigate("/gallery")}
      />
    );
  }

  return (
    <div data-testid="feed-builds">
      {items.map((item) => (
        <BuildFeedItemView key={item.key} item={item} srcByPath={srcByPath} />
      ))}

      {/* The sentinel sits below the last item and is watched rather than
          polled, so scrolling costs nothing until it comes into view. */}
      <ScrollSentinel active={hasNextPage === true} onVisible={loadMore} />

      {isFetchingNextPage ? (
        <p
          data-testid="feed-builds-loading-more"
          style={{ ...labelText, color: TEXT_MUTED, textAlign: "center", padding: "12px 0" }}
        >
          Loading more…
        </p>
      ) : null}

      {hasNextPage === false ? (
        <p
          data-testid="feed-builds-end"
          style={{ ...labelText, color: TEXT_MUTED, textAlign: "center", padding: "16px 0" }}
        >
          That is everything published so far — the gallery has the rest.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Calls back once whatever it is watching comes near the viewport.
 *
 * `active` is false while a page is already in flight and at the end of the
 * feed, so the observer is torn down rather than left firing into a guard.
 */
function ScrollSentinel({
  active,
  onVisible,
}: {
  active: boolean;
  onVisible: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !active) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onVisible();
      },
      { rootMargin: `${PREFETCH_MARGIN} 0px` }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [active, onVisible]);

  return <div ref={ref} data-testid="feed-scroll-sentinel" style={{ height: 1 }} />;
}

export default BuildsTab;
