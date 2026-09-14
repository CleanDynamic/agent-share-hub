import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Bell, CheckCircle, Loader2 } from "lucide-react";
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
import { ShellHeader } from "@/components/shell/ShellHeader";
import { t as tok, tokenAlpha, tokenVar, type TokenName } from "@/lib/theme/tokens";
import { r } from "@/lib/theme/radius";
import { Skeleton } from "@/components/ui/skeleton";

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
    case "post_reblogged":
    case "reblog_reblogged": {
      const slug = (n.metadata as any)?.reblog_slug;
      return slug ? `/b/${slug}` : targetId ? `/b/${targetId}` : "/";
    }
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
/**
 * BG-P26. This used to take a hex and build its ground by string concatenation
 * — `${color}1F` — which is only meaningful for a literal hex. A semantic token
 * is a `var()` reference whose value is not known until the browser resolves it
 * against `<html data-theme>`, so the alpha has to be deferred too: `tokenAlpha`
 * emits a `color-mix`, which is the same trick the rest of the kit uses.
 */
function EmptyStateBadge({ icon, token }: { icon: React.ReactNode; token: TokenName }) {
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: tokenAlpha(token, 0.12),
        border: `1px solid ${tokenAlpha(token, 0.33)}`,
        color: tokenVar(token),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: "0 auto 14px",
      }}
    >
      {icon}
    </div>
  );
}

function EmptyAll() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "72px 24px",
        maxWidth: 360,
        margin: "0 auto",
        color: tok.text2,
        fontFamily: "Figtree, sans-serif",
      }}
    >
      <EmptyStateBadge icon={<Bell size={20} />} token="text2" />
      <div style={{ fontSize: 15, fontWeight: 600, color: tok.text }}>
        You're all clear
      </div>
      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5 }}>
        Follows, references, mentions and messages will land here.
      </div>
    </div>
  );
}

function EmptyUnread() {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "72px 24px",
        maxWidth: 360,
        margin: "0 auto",
        color: tok.text2,
        fontFamily: "Figtree, sans-serif",
      }}
    >
      {/* Caught up is a good state, so the badge takes `--evidence` — the token
          this system uses for "it worked" — rather than the teal it was pinned
          to. The empty-all badge above stays neutral: nothing has happened, and
          nothing has gone right either. */}
      <EmptyStateBadge icon={<CheckCircle size={20} />} token="evidence" />
      <div style={{ fontSize: 15, fontWeight: 600, color: tok.text }}>
        All caught up
      </div>
      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5 }}>
        Nothing new since your last visit.
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

  const showEmpty = !loading && items.length === 0;

  return (
    <div style={{ padding: "0 0 32px" }}>
      <SeoHead title="Notifications" description="Your latest activity and mentions." path="/notifications" />

      <ShellHeader
        onBack={() => navigate(-1)}
        tabs={[
          { id: "all", label: "All", count: allCount },
          { id: "unread", label: "Unread", count: unreadCount },
        ]}
        activeTab={filter}
        onTabChange={(id) => setFilter(id as FilterKind)}
        secondaryAction={{
          label: "Mark all as read",
          onClick: handleMarkAll,
          disabled: unreadCount === 0,
        }}
      />

      <div style={{ padding: "0 20px" }}>

      {/* List */}
      {loading ? (
        /* BG-P26. Skeleton rows at the real row shape — badge, two lines of
           text, a timestamp — so the stream does not jump when the rows land.
           A spinner says "wait"; a skeleton says what is coming. */
        <div aria-busy="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="mb-2 flex gap-3 px-4 py-3"
              style={{
                borderRadius: r["r-control"],
                border: `0.5px solid ${tok.line}`,
                borderLeft: "2px solid transparent",
              }}
            >
              <Skeleton style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                <Skeleton
                  style={{
                    width: ["64%", "48%", "72%", "56%", "44%", "68%"][i],
                    height: 11,
                    borderRadius: r["r-chip"],
                  }}
                />
                <Skeleton style={{ width: "86%", height: 9, borderRadius: r["r-chip"] }} />
                <Skeleton style={{ width: 52, height: 9, borderRadius: r["r-chip"] }} />
              </div>
            </div>
          ))}
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
                color: tok.text2,
              }}
            >
              <Loader2 size={16} className="animate-spin" />
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

