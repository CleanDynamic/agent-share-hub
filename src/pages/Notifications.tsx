// Notifications (RC-P19).
//
// ONE LIST, NO FILTER TABS ⟦hicks-law⟧: the newest first, grouped by day
// under the eyebrow the scale already has, with "Mark all as read" above it.
// A row is who, what, which build and when (NotificationRow); a page of rows
// costs one request for the rows, one for their actors and one for every
// build they name ⟦neoscale-performance⟧. Build notifications are written by
// the database (20261001200000_rc_build_notifications.sql); a new one arrives
// over realtime and the first page is read again.
//
// STATES (STATES.md rows 19–21): skeleton rows at the row's own shape while
// the list loads; one sentence and one action when there is nothing; one
// sentence and a secondary "Try again" when it could not be read.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { NotificationGroupHeader } from "@/components/notifications/NotificationCard";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import { ShellHeader } from "@/components/shell/ShellHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { isPermissionError } from "@/lib/errors/permission";
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  useNewNotifications,
  type Notification,
} from "@/lib/notifications";
import { skeletonStyle } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { SPACE } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { body } from "@/lib/theme/type";

const PAGE_SIZE = 50;

const DAY_ORDER = ["Today", "Yesterday", "This week", "Earlier"] as const;

/** Today, yesterday, this week, earlier: the day a notification arrived. */
export function groupByDay(items: Notification[], now = new Date()): Map<string, Notification[]> {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekStart = new Date(today.getTime() - today.getDay() * 86400000);
  const groups = new Map<string, Notification[]>();
  for (const item of items) {
    const at = new Date(item.created_at);
    const key = at >= today ? "Today" : at >= yesterday ? "Yesterday" : at >= weekStart ? "This week" : "Earlier";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<unknown>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [unread, setUnread] = useState(0);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const refreshUnread = useCallback(async () => {
    if (!user?.id) return;
    try {
      setUnread(await getUnreadCount(user.id));
    } catch {
      /* the count is a convenience; the list says what is unread */
    }
  }, [user?.id]);

  const loadFirst = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setFailure(null);
    try {
      const page = await getNotifications({ userId: user.id, limit: PAGE_SIZE, offset: 0 });
      setItems(page.notifications);
      setHasMore(page.notifications.length >= PAGE_SIZE);
      void refreshUnread();
    } catch (error) {
      setFailure(error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, refreshUnread]);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (!user?.id || loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await getNotifications({ userId: user.id, limit: PAGE_SIZE, offset: items.length });
      setItems((current) => [...current, ...page.notifications]);
      setHasMore(page.notifications.length >= PAGE_SIZE);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [user?.id, loading, loadingMore, hasMore, items.length]);

  useEffect(() => {
    const element = sentinel.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "200px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [loadMore]);

  // A new notification: read the first page again, keep what was below it.
  const arrived = useCallback(async () => {
    if (!user?.id) return;
    try {
      const page = await getNotifications({ userId: user.id, limit: PAGE_SIZE, offset: 0 });
      setItems((current) => {
        const fresh = new Set(page.notifications.map((item) => item.id));
        return [...page.notifications, ...current.filter((item) => !fresh.has(item.id))];
      });
      void refreshUnread();
    } catch {
      /* the next visit reads it */
    }
  }, [user?.id, refreshUnread]);
  useNewNotifications(user?.id, arrived);

  const open = useCallback(
    (notification: Notification) => {
      if (notification.is_read) return;
      setItems((current) => current.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item)));
      setUnread((count) => Math.max(0, count - 1));
      void markNotificationRead(notification.id).catch(() => void refreshUnread());
    },
    [refreshUnread],
  );

  const markAll = useCallback(async () => {
    if (!user?.id) return;
    setItems((current) => current.map((item) => ({ ...item, is_read: true })));
    setUnread(0);
    try {
      await markAllNotificationsRead(user.id);
    } catch {
      void refreshUnread();
    }
  }, [user?.id, refreshUnread]);

  const groups = useMemo(() => groupByDay(items), [items]);

  return (
    <div style={{ paddingBottom: SPACE.md }}>
      <SeoHead title="Notifications — buildgallery" description="What happened to your builds." path="/notifications" noIndex />
      <ShellHeader
        onBack={() => navigate(-1)}
        secondaryAction={{ label: "Mark all as read", onClick: () => void markAll(), disabled: unread === 0 }}
      />

      <div data-testid="notifications" style={{ padding: "0 20px" }}>
        {loading ? (
          <div data-testid="notifications-loading" aria-hidden style={{ display: "flex", flexDirection: "column", gap: SPACE.xs }}>
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} style={{ display: "flex", gap: SPACE.sm, padding: `${SPACE.sm}px 0` }}>
                <div style={{ ...skeletonStyle(), width: 36, height: 36, borderRadius: r.full, flexShrink: 0 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: SPACE.xs, flex: 1 }}>
                  <div style={{ ...skeletonStyle(), height: 16, width: ["64%", "48%", "72%", "56%", "44%"][index] }} />
                  <div style={{ ...skeletonStyle(), height: 12, width: 80 }} />
                </div>
              </div>
            ))}
          </div>
        ) : failure ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: SPACE.xs, paddingBlock: SPACE.md }}>
            <p style={{ ...body, color: t.text, margin: 0 }}>
              {isPermissionError(failure) ? "You don't have access to this." : "Something went wrong."}
            </p>
            <Button type="button" variant="outline" onClick={() => void loadFirst()} style={{ background: "transparent", minHeight: 44 }}>
              Try again
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div
            data-testid="notifications-empty"
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: SPACE.sm, paddingBlock: SPACE.md }}
          >
            <p style={{ ...body, color: t.text2, margin: 0 }}>
              When someone runs, rebuilds, likes or comments on your builds, you will hear about it here.
            </p>
            <Button asChild variant="default" style={{ minHeight: 44 }}>
              <Link to="/gallery">Browse the gallery</Link>
            </Button>
          </div>
        ) : (
          <>
            {DAY_ORDER.filter((day) => groups.has(day)).map((day) => (
              <section key={day} aria-label={day}>
                <NotificationGroupHeader label={day} />
                <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {groups.get(day)!.map((item, index) => (
                    <li key={item.id} style={{ borderTop: index === 0 ? undefined : `1px solid ${t.line}` }}>
                      <NotificationRow notification={item} onOpen={open} />
                    </li>
                  ))}
                </ol>
              </section>
            ))}
            <div ref={sentinel} style={{ height: 1 }} />
            {loadingMore ? (
              <p style={{ ...body, color: t.text2, margin: 0, paddingBlock: SPACE.sm }}>Loading more…</p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
