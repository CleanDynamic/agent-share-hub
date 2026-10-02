/* UI-P35 — /notifications in the site frame: the container.

   Loads Activity's data through `src/lib/` functions only, maps it to
   `ActivityView`'s props and renders it. No Supabase call in this file. The
   legacy page (`src/pages/Notifications.tsx`) is not edited: `FrameRoute` picks
   one by the `site_frame` flag.

   EACH PANEL LOADS ON ITS OWN. The list (getNotifications, fifty at a time,
   "Show more" for the next fifty), the unread count, the people who ran the
   viewer's builds this week, and the 90-day runs chart; a slow chart never
   holds the list back, and a refused count is drawn as nothing rather than 0.

   LIVE. One channel (useNotificationChannel): a new notification reads the list
   and the count again, and a run reads the orb and the chart again too. The
   list says "live" and the orb "Listening" only while that channel is up. The
   header's bell and the dock's tile keep their own subscription
   (useUnreadNotifications), which counts the arrival.

   READING. Following a row reads it, and "Mark all read" reads them all: the
   list and the count change at once, the write follows, and the bell and the
   tile are told to read their count again when it lands. A write that fails
   reads everything again from the server. */

import { useCallback, useMemo } from "react";
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import { MEDIA_WIDTH } from "@/components/build/MediaFigure";
import { stillFor, useSignedMedia, type CardMedia } from "@/components/gallery/cardMedia";
import { useAuth } from "@/contexts/AuthContext";
import { refreshUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { countPeopleWhoRanMyBuildsThisWeek, getRunsOfMyBuilds } from "@/lib/build/runs";
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  useNotificationChannel,
  type Notification,
  type NotificationRow,
} from "@/lib/notifications";
import { resolveNotificationCovers } from "@/lib/notifications/covers";
import type { GetNotificationsResult } from "@/lib/notifications/getNotifications";

import { ActivityView, type ActivityListProps, type ActivityLoad, type ActivityRuns } from "./ActivityView";
import { activityRowOf, countKinds, groupByDay, runsLabel, scaleSeries, type ActivityRow } from "./activityModel";

/** Notifications per page. */
const PAGE_SIZE = 50;
/** The chart's window. */
const RUN_DAYS = 90;
/** The list and the count are kept fresh by the channel; this is only for a return visit. */
const STALE_MS = 30_000;
/** The orb and the chart move when a run arrives; otherwise a few minutes is as fresh as they mean to be. */
const FIGURES_STALE_MS = 5 * 60_000;
/** Thumbnails are 76px wide: signed at the smallest slot width the read path has, as Home's are. */
const THUMB_WIDTH = MEDIA_WIDTH.variant;

type Pages = InfiniteData<GetNotificationsResult>;

/** Every loaded notification once, newest first: a row that moved pages between reads is not drawn twice. */
function flatten(data: Pages | undefined): Notification[] {
  const seen = new Set<string>();
  const out: Notification[] = [];
  for (const page of data?.pages ?? []) {
    for (const item of page.notifications) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

/** The loaded pages with `read` applied to every row it picks. */
function markPages(data: Pages | undefined, read: (item: Notification) => boolean): Pages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      notifications: page.notifications.map((item) => (!item.is_read && read(item) ? { ...item, is_read: true } : item)),
    })),
  };
}

export function ActivityPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const navigate = useNavigate();
  const qc = useQueryClient();

  /* ── the list ── */

  const listKey = useMemo(() => ["notifications", "getNotifications", userId] as const, [userId]);
  const listQuery = useInfiniteQuery({
    queryKey: listKey,
    enabled: Boolean(userId),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getNotifications({ userId: userId as string, limit: PAGE_SIZE, offset: pageParam }),
    getNextPageParam: (last, pages) =>
      last.notifications.length >= PAGE_SIZE ? pages.reduce((sum, page) => sum + page.notifications.length, 0) : undefined,
    staleTime: STALE_MS,
  });
  const notifications = useMemo(() => flatten(listQuery.data), [listQuery.data]);

  const unreadKey = useMemo(() => ["notifications", "getUnreadCount", userId] as const, [userId]);
  const unreadQuery = useQuery({
    queryKey: unreadKey,
    enabled: Boolean(userId),
    queryFn: () => getUnreadCount(userId as string),
    staleTime: STALE_MS,
  });

  /* ── the thumbnails: one read for every build the list names, one signing pass ── */

  const buildIds = useMemo(
    () => [...new Set(notifications.map((item) => item.build?.id).filter((id): id is string => Boolean(id)))].sort(),
    [notifications],
  );
  const coversQuery = useQuery({
    queryKey: ["notifications", "resolveNotificationCovers", buildIds],
    enabled: buildIds.length > 0,
    queryFn: () => resolveNotificationCovers(buildIds),
    staleTime: FIGURES_STALE_MS,
    placeholderData: (previous) => previous,
  });
  const coverRows = useMemo(() => {
    const rows: CardMedia[] = [];
    const seen = new Set<string>();
    for (const media of coversQuery.data?.values() ?? []) {
      if (!media || seen.has(media.id)) continue;
      seen.add(media.id);
      rows.push({ ...media, slotWidth: THUMB_WIDTH });
    }
    return rows;
  }, [coversQuery.data]);
  const signed = useSignedMedia(coverRows);

  const rows = useMemo(
    () =>
      notifications.map((item) =>
        activityRowOf(item, stillFor(signed, item.build ? (coversQuery.data?.get(item.build.id) ?? null) : null)),
      ),
    [notifications, coversQuery.data, signed],
  );

  /* ── the right column ── */

  const peopleQuery = useQuery({
    queryKey: ["build", "countPeopleWhoRanMyBuildsThisWeek", userId],
    enabled: Boolean(userId),
    queryFn: () => countPeopleWhoRanMyBuildsThisWeek(userId as string),
    staleTime: FIGURES_STALE_MS,
  });

  const runsQuery = useQuery({
    queryKey: ["build", "getRunsOfMyBuilds", userId, RUN_DAYS],
    enabled: Boolean(userId),
    queryFn: () => getRunsOfMyBuilds(userId as string, RUN_DAYS),
    staleTime: FIGURES_STALE_MS,
  });

  /* ── live ── */

  const arrived = useCallback(
    (row: NotificationRow) => {
      void qc.invalidateQueries({ queryKey: ["notifications", "getNotifications", userId] });
      void qc.invalidateQueries({ queryKey: ["notifications", "getUnreadCount", userId] });
      if (row.notification_type === "reproduced") {
        void qc.invalidateQueries({ queryKey: ["build", "countPeopleWhoRanMyBuildsThisWeek", userId] });
        void qc.invalidateQueries({ queryKey: ["build", "getRunsOfMyBuilds", userId] });
      }
    },
    [qc, userId],
  );
  const live = useNotificationChannel(userId, arrived) === "live";

  /* ── reading ── */

  const resync = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["notifications", "getNotifications", userId] });
    void qc.invalidateQueries({ queryKey: ["notifications", "getUnreadCount", userId] });
    refreshUnreadNotifications();
  }, [qc, userId]);

  const open = useCallback(
    (row: ActivityRow) => {
      if (!row.unread) return;
      qc.setQueryData<Pages>(listKey, (data) => markPages(data, (item) => item.id === row.id));
      qc.setQueryData<number>(unreadKey, (count) => (typeof count === "number" ? Math.max(0, count - 1) : count));
      markNotificationRead(row.id).then(refreshUnreadNotifications, resync);
    },
    [qc, listKey, unreadKey, resync],
  );

  const markAll = useCallback(() => {
    if (!userId) return;
    qc.setQueryData<Pages>(listKey, (data) => markPages(data, () => true));
    qc.setQueryData<number>(unreadKey, 0);
    markAllNotificationsRead(userId).then(refreshUnreadNotifications, resync);
  }, [qc, userId, listKey, unreadKey, resync]);

  /* ── the view ── */

  // Read on every render, so the days and the times move on with the clock.
  const now = Date.now();
  const groups = groupByDay(rows, new Date(now));
  const kindCounts = useMemo(() => countKinds(rows), [rows]);

  const list: ActivityListProps = {
    status: listQuery.data ? "ready" : listQuery.isError ? "error" : "loading",
    groups,
    hasMore: Boolean(listQuery.hasNextPage),
    loadingMore: listQuery.isFetchingNextPage,
    onMore: () => void listQuery.fetchNextPage(),
    onRetry: () => void listQuery.refetch(),
  };

  const runs: ActivityLoad<ActivityRuns> = runsQuery.data
    ? {
        status: "ready",
        data: {
          values: scaleSeries(runsQuery.data.series),
          markerIndex: runsQuery.data.rebuildLiveIndex,
          label: runsLabel(runsQuery.data.series, runsQuery.data.rebuildLiveIndex),
        },
      }
    : runsQuery.isError
      ? { status: "error", onRetry: () => void runsQuery.refetch() }
      : { status: "loading" };

  return (
    <>
      <SeoHead title="Activity — buildgallery" description="What happened to your builds." path="/notifications" noIndex />
      <ActivityView
        now={now}
        list={list}
        unread={typeof unreadQuery.data === "number" ? unreadQuery.data : null}
        live={live}
        kindCounts={kindCounts}
        peopleThisWeek={typeof peopleQuery.data === "number" ? peopleQuery.data : null}
        runs={runs}
        onOpen={open}
        onMarkAllRead={markAll}
        onNavigate={(to) => navigate(to)}
      />
    </>
  );
}

export default ActivityPage;
