// A build's comments and its part counts, as the page holds them (RC-P17).
//
// TWO REQUESTS, ISSUED TOGETHER ⟦neoscale-performance⟧: the first page of
// comments (replies and authors included, src/lib/social/comments.ts) and the
// comment count of every part, both asked for once the comments section comes
// within 400px of the viewport. The anatomy's part markers read the same cached
// counts without asking again, so the page never makes a third.
//
// A POSTED, EDITED OR DELETED COMMENT IS WRITTEN INTO THE CACHE, not re-read:
// the database has already answered with the row, and reading the whole list
// again to show one comment would cost the request the section was built to
// avoid. The build's comment count and the part's count move with it.

import { useInfiniteQuery, useQuery, type InfiniteData, type QueryClient } from "@tanstack/react-query";
import {
  listComments,
  listPartCommentCounts,
  nestComments,
  type BuildComment,
  type CommentPage,
} from "@/lib/social";

export const COMMENTS_KEY = "build-comments";
export const PART_COUNTS_KEY = "build-part-comments";

/** A conversation is not a ticker. */
const COMMENTS_STALE_MS = 30_000;

type Pages = InfiniteData<CommentPage, string | undefined>;

/** The comment pages, asked for only once `enabled`. */
export function useCommentPages(buildId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: [COMMENTS_KEY, buildId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => listComments(buildId, { after: pageParam }),
    getNextPageParam: (last: CommentPage) => last.nextAfter ?? undefined,
    enabled,
    staleTime: COMMENTS_STALE_MS,
    refetchOnWindowFocus: false,
  });
}

/**
 * Each part's comment count. `enabled` false reads the cache only: the
 * anatomy's markers show what the comments section asked for, and ask nothing.
 */
export function usePartCommentCounts(buildId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [PART_COUNTS_KEY, buildId],
    queryFn: () => listPartCommentCounts(buildId as string),
    enabled: enabled && Boolean(buildId),
    staleTime: COMMENTS_STALE_MS,
    refetchOnWindowFocus: false,
  });
}

function withRows(page: CommentPage, rows: BuildComment[]): CommentPage {
  return { ...page, rows, comments: nestComments(rows) };
}

/** A new comment, at the end of what the reader has loaded. */
export function appendComment(queryClient: QueryClient, buildId: string, comment: BuildComment): void {
  queryClient.setQueryData<Pages>([COMMENTS_KEY, buildId], (data) => {
    if (!data || data.pages.length === 0) return data;
    const last = data.pages.length - 1;
    return {
      ...data,
      pages: data.pages.map((page, index) => (index === last ? withRows(page, [...page.rows, comment]) : page)),
    };
  });
}

/** An edited comment, in place. */
export function replaceComment(queryClient: QueryClient, buildId: string, comment: BuildComment): void {
  queryClient.setQueryData<Pages>([COMMENTS_KEY, buildId], (data) => {
    if (!data) return data;
    return {
      ...data,
      pages: data.pages.map((page) =>
        page.rows.some((row) => row.id === comment.id)
          ? withRows(page, page.rows.map((row) => (row.id === comment.id ? comment : row)))
          : page,
      ),
    };
  });
}

/**
 * A deleted comment and the replies that went with it. Returns the rows that
 * left, so the caller can move the counts by what the reader could see.
 */
export function removeComment(queryClient: QueryClient, buildId: string, commentId: string): BuildComment[] {
  const removed: BuildComment[] = [];
  queryClient.setQueryData<Pages>([COMMENTS_KEY, buildId], (data) => {
    if (!data) return data;
    return {
      ...data,
      pages: data.pages.map((page) => {
        const gone = page.rows.filter((row) => row.id === commentId || row.parentId === commentId);
        if (gone.length === 0) return page;
        removed.push(...gone);
        return withRows(page, page.rows.filter((row) => !gone.includes(row)));
      }),
    };
  });
  return removed;
}

/** A part gained or lost comments. */
export function bumpPartCount(queryClient: QueryClient, buildId: string, nodeId: string, delta: number): void {
  queryClient.setQueryData<Record<string, number>>([PART_COUNTS_KEY, buildId], (counts) => {
    if (!counts) return counts;
    const next = Math.max(0, (counts[nodeId] ?? 0) + delta);
    const copy = { ...counts };
    if (next === 0) delete copy[nodeId];
    else copy[nodeId] = next;
    return copy;
  });
}
