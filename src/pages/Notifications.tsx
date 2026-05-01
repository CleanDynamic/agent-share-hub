import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, ChevronLeft, Loader2 } from "lucide-react";
import { SeoHead } from "@/components/SeoHead";
import { useAuth } from "@/contexts/AuthContext";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  useNewNotifications,
  type Notification as DataNotification,
} from "@/lib/notifications/index";
import {
  NotificationCard,
  NotificationGroupHeader,
  groupNotificationsByTime,
  type NotificationCardData,
} from "@/components/notifications/NotificationCard";

const PAGE_SIZE = 50;

type FilterKind = "all" | "unread";

// ── Adapter: data-layer Notification → card data shape ─────────────────────
function toCardData(n: DataNotification, pulse = false): NotificationCardData {
  const actor = n.actor
    ? {
        displayName: n.actor.display_name || n.actor.username || "Someone",
        handle: n.actor.username || "",
        avatarUrl: n.actor.avatar_url ?? null,
      }
    : null;

  const target = n.target
    ? {
        contentType: String(n.target.type),
        contentId: n.target.id,
        contentTitle: n.target.title || "",
        slug: n.target.slug ?? null,
      }
    : null;

  return {
    id: n.id,
    kind: n.kind || n.notification_type,
    isRead: n.is_read,
    timestamp: n.created_at,
    actor,
    target,
    body: n.body || "",
    metadata: (n.metadata ?? {}) as NotificationCardData["metadata"],
    pulse,
  };
}

// ── Deep-link resolver ────────────────────────────────────────────────────
function resolveDeepLink(n: NotificationCardData, raw: DataNotification): string {
  const t = raw.target;
  const targetId = t?.id ?? raw.target_id ?? raw.content_id ?? null;
  const targetType = (t?.type ?? raw.target_type) as string | null;

  switch (n.kind) {
    case "new_follower":
      return n.actor?.handle ? `/creator/${n.actor.handle}` : "/";
    case "new_message":
      return targetId && (targetType === "thread" || targetType === "message")
        ? `/messages/${targetId}`
        : "/messages";
    case "mention":
    case "engagement":
    case "reference_received":
    case "bounty_interaction": {
      if (!targetId) return "/";
      if (targetType === "stage") return `/content/${raw.content_id ?? targetId}#stage-${targetId}`;
      if (targetType === "block") return `/content/${raw.content_id ?? targetId}#block-${targetId}`;
      if (targetType === "comment")
        return raw.content_id ? `/content/${raw.content_id}` : "/";
      return `/content/${targetId}`;
    }
    case "system":
      return n.actor?.handle ? `/creator/${n.actor.handle}` : "/";
    default:
      return targetId ? `/content/${targetId}` : "/";
  }
}

// ── Empty states ──────────────────────────────────────────────────────────
function EmptyAll() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "64px 24px",
        color: "rgba(255,255,255,0.55)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
        No notifications yet
      </div>
      <div style={{ marginTop: 8, fontSize: 13 }}>
        When others reference, follow, or message you, you'll see it here.
      </div>
    </div>
  );
}

function EmptyUnread() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "64px 24px",
        color: "rgba(255,255,255,0.65)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <CheckCircle
        size={28}
        style={{ color: "#2EC4B6", margin: "0 auto 10px", display: "block" }}
      />
      <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
        All caught up
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter: FilterKind = searchParams.get("filter") === "unread" ? "unread" : "all";

  const [items, setItems] = useState<DataNotification[]>([]);
  const [pulses, setPulses] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [allCount, setAllCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const refreshCounts = useCallback(async () => {
    if (!user?.id) return;
    const [allRes, unreadRes] = await Promise.all([
      getNotifications({ userId: user.id, filter: "all", limit: 1, offset: 0 }),
      getNotifications({ userId: user.id, filter: "unread", limit: 1, offset: 0 }),
    ]);
    setAllCount(allRes.total);
    setUnreadCount(unreadRes.total);
  }, [user?.id]);

  const loadInitial = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await getNotifications({
        userId: user.id,
        filter,
        limit: PAGE_SIZE,
        offset: 0,
      });
      setItems(res.notifications);
      setHasMore(res.notifications.length >= PAGE_SIZE);
      setPulses(new Set());
      void refreshCounts();
    } finally {
      setLoading(false);
    }
  }, [user?.id, filter, refreshCounts]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    if (!user?.id || loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    try {
      const res = await getNotifications({
        userId: user.id,
        filter,
        limit: PAGE_SIZE,
        offset: items.length,
      });
      setItems((prev) => [...prev, ...res.notifications]);
      setHasMore(res.notifications.length >= PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }, [user?.id, filter, items.length, hasMore, loading, loadingMore]);

  // Infinite scroll sentinel
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  // Realtime: prepend new notifications + pulse
  const handleNew = useCallback(
    async (row: any) => {
      if (!user?.id) return;
      // Re-fetch first page so the new row is fully resolved (actor + target).
      const res = await getNotifications({
        userId: user.id,
        filter,
        limit: PAGE_SIZE,
        offset: 0,
      });
      setItems((prev) => {
        // De-dupe against existing rows beyond the first page.
        const seen = new Set(res.notifications.map((n) => n.id));
        const tail = prev.filter((n) => !seen.has(n.id));
        return [...res.notifications, ...tail];
      });
      setPulses((prev) => {
        const next = new Set(prev);
        next.add(row.id);
        return next;
      });
      void refreshCounts();
      // Clear pulse marker after the animation window.
      setTimeout(() => {
        setPulses((prev) => {
          const next = new Set(prev);
          next.delete(row.id);
          return next;
        });
      }, 1100);
    },
    [user?.id, filter, refreshCounts]
  );
  useNewNotifications(user?.id, handleNew);

  // ── Card actions ────────────────────────────────────────────────────────
  const handleClick = useCallback(
    (n: NotificationCardData) => {
      const raw = items.find((x) => x.id === n.id);
      if (!raw) return;
      const link = resolveDeepLink(n, raw);
      // Optimistically mark read locally + on server.
      if (!n.isRead) {
        setItems((prev) =>
          prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
        void markNotificationRead(n.id).catch(() => void refreshCounts());
      }
      navigate(link);
    },
    [items, navigate, refreshCounts]
  );

  const handleMarkRead = useCallback(
    (id: string) => {
      setItems((prev) =>
        prev.map((x) => (x.id === id ? { ...x, is_read: true } : x))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      void markNotificationRead(id).catch(() => void refreshCounts());
    },
    [refreshCounts]
  );

  const handleMarkAll = useCallback(async () => {
    if (!user?.id) return;
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead(user.id);
    } catch {
      void refreshCounts();
    }
  }, [user?.id, refreshCounts]);

  // ── Build view-model groups ─────────────────────────────────────────────
  const groups = useMemo(() => {
    const cards = items.map((n) => toCardData(n, pulses.has(n.id)));
    return groupNotificationsByTime(cards);
  }, [items, pulses]);

  const orderedKeys = useMemo(() => {
    const order = ["Today", "Yesterday", "This week", "Earlier"];
    return order.filter((k) => groups.has(k));
  }, [groups]);

  const setFilter = (next: FilterKind) => {
    const params = new URLSearchParams(searchParams);
    if (next === "unread") params.set("filter", "unread");
    else params.delete("filter");
    setSearchParams(params, { replace: true });
  };

  const tabBase: React.CSSProperties = {
    height: 40,
    padding: "0 14px",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "Inter, sans-serif",
    fontSize: 13,
    fontWeight: 500,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    color: "rgba(255,255,255,0.55)",
    borderBottom: "2px solid transparent",
  };
  const tabActive: React.CSSProperties = {
    color: "rgba(255,255,255,0.95)",
    borderBottom: "2px solid #2EC4B6",
  };
  const countPill: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    padding: "1px 6px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.75)",
  };

  const showEmpty = !loading && items.length === 0;

  return (
    <div style={{ padding: "8px 0 32px" }}>
      <SeoHead title="Notifications" description="Your latest activity and mentions." path="/notifications" />

      {/* Back link */}
      <Link
        to="/"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontFamily: "Inter, sans-serif",
          fontSize: 12,
          color: "rgba(255,255,255,0.55)",
          textDecoration: "none",
          marginBottom: 12,
        }}
      >
        <ChevronLeft size={14} />
        Back
      </Link>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <h1
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 22,
            fontWeight: 700,
            color: "rgba(255,255,255,0.95)",
            margin: 0,
          }}
        >
          Notifications
        </h1>
        <button
          type="button"
          onClick={handleMarkAll}
          disabled={unreadCount === 0}
          style={{
            background: "transparent",
            border: "none",
            color:
              unreadCount === 0 ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.65)",
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
            fontWeight: 500,
            cursor: unreadCount === 0 ? "default" : "pointer",
            padding: "4px 6px",
          }}
        >
          Mark all as read
        </button>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          borderBottom: "0.5px solid rgba(255,255,255,0.10)",
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={filter === "all"}
          onClick={() => setFilter("all")}
          style={{ ...tabBase, ...(filter === "all" ? tabActive : {}) }}
        >
          All
          <span style={countPill}>{allCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filter === "unread"}
          onClick={() => setFilter("unread")}
          style={{ ...tabBase, ...(filter === "unread" ? tabActive : {}) }}
        >
          Unread
          <span style={countPill}>{unreadCount}</span>
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "48px 0",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : showEmpty ? (
        filter === "unread" ? (
          <EmptyUnread />
        ) : (
          <EmptyAll />
        )
      ) : (
        <div>
          {orderedKeys.map((key) => (
            <div key={key}>
              <NotificationGroupHeader label={key} />
              {groups.get(key)!.map((card) => (
                <NotificationCard
                  key={card.id}
                  notification={card}
                  onClick={handleClick}
                  onMarkAsRead={handleMarkRead}
                />
              ))}
            </div>
          ))}
          <div ref={sentinelRef} style={{ height: 1 }} />
          {loadingMore && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "16px 0",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              <Loader2 size={16} className="animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
