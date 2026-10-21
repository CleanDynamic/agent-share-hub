/* The creator's whole session library: the composer's "Your sessions".

   A SESSION BELONGS TO THE ACCOUNT, NOT TO A BUILD. This list is every finished
   session the creator has sent — waiting, in this draft, in other drafts, or
   marked expired — newest first (listLibrarySessions), CA-12: in pages of 100
   with "Show more". Nothing finished is hidden and none expires. Putting one into
   a draft does not take it out of the list on any other draft.

   A CONNECTOR WRITES TO IT FROM OUTSIDE THE BROWSER, so it is read again the
   way useWaitingSessions is: whenever the panel opens, whenever the reader
   comes back to the tab, and every WAITING_REFRESH_MS while it is on screen.
   The cached list shows at once meanwhile. CA-10: every 60 s, and only while
   the panel is on screen (`active`), as useWaitingSessions. A poll reads again
   every page opened so far, one request each, so it stays one request until the
   maker presses "Show more". */

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { LIBRARY_PAGE, listLibrarySessions, listUnfinishedSessions } from "@/lib/build/sessions";

import { WAITING_REFRESH_MS, type SessionsPolling } from "./useWaitingSessions";

export const librarySessionsKey = ["build", "listLibrarySessions"] as const;
export const unfinishedSessionsKey = ["build", "listUnfinishedSessions"] as const;

export function useLibrarySessions({ active = true, withUnfinished = true }: SessionsPolling & { withUnfinished?: boolean } = {}) {
  const pages = useInfiniteQuery({
    queryKey: librarySessionsKey,
    queryFn: ({ pageParam }) => listLibrarySessions({ offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasMore ? all.length * LIBRARY_PAGE : undefined),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    // A poll asks again for every page read so far; with one page that is one request.
    refetchInterval: active ? WAITING_REFRESH_MS : false,
    refetchIntervalInBackground: false,
  });
  const unfinished = useQuery({
    queryKey: unfinishedSessionsKey,
    queryFn: () => listUnfinishedSessions(),
    enabled: withUnfinished,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: active ? WAITING_REFRESH_MS : false,
    refetchIntervalInBackground: false,
  });
  const data = pages.data ? pages.data.pages.flatMap((page) => page.sessions) : undefined;
  return {
    data,
    isError: pages.isError,
    isLoadingError: pages.isLoadingError,
    error: pages.error,
    refetch: () => {
      if (withUnfinished) void unfinished.refetch();
      return pages.refetch();
    },
    hasMore: Boolean(pages.hasNextPage),
    loadingMore: pages.isFetchingNextPage,
    fetchMore: () => void pages.fetchNextPage(),
    unfinished: unfinished.data ?? NONE_UNFINISHED,
  };
}

const NONE_UNFINISHED: Awaited<ReturnType<typeof listUnfinishedSessions>> = [];
