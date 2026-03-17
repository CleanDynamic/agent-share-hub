import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, Bell } from "lucide-react";

const PAGE_SIZE = 50;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function formatNotification(n: any): { text: string; link: string } {
  const meta = n.metadata ?? {};
  const actor = n.actor_display_name || n.actor_username || "Someone";
  const type: string = n.notification_type;

  switch (type) {
    case "new_follower":
      return { text: `${actor} followed you`, link: n.actor_username ? `/creator/${n.actor_username}` : "/" };
    case "new_download":
      return { text: `${actor} downloaded ${meta.content_title || "your content"}`, link: n.content_id ? `/content/${n.content_id}` : "/" };
    case "new_rating":
      return { text: `${actor} rated ${meta.content_title || "your content"} ${"★".repeat(meta.rating || 0)}`, link: n.content_id ? `/content/${n.content_id}` : "/" };
    case "new_comment":
      return { text: `${actor} commented on ${meta.content_title || "your content"}: '${(meta.comment_excerpt || "").slice(0, 80)}...'`, link: n.content_id ? `/content/${n.content_id}` : "/" };
    case "new_purchase":
      return { text: `${actor} purchased ${meta.content_title || "your content"}`, link: n.content_id ? `/content/${n.content_id}` : "/" };
    case "content_approved":
      return { text: `Your post ${meta.content_title || ""} has been approved and is now live`, link: n.content_id ? `/content/${n.content_id}` : "/" };
    case "version_update":
      return { text: `${actor} updated ${meta.content_title || "content"} to v${meta.version_number || "?"}: ${meta.changelog || ""}`, link: n.content_id ? `/content/${n.content_id}` : "/" };
    case "fork":
      return { text: `${actor} forked your post ${meta.original_title || ""}`, link: n.content_id ? `/content/${n.content_id}` : "/" };
    case "collection_follow":
      return { text: `${actor} followed your collection ${meta.collection_title || ""}`, link: "/" };
    case "tip_upvote":
      return { text: `${actor} upvoted your tip on ${meta.content_title || "content"}`, link: n.content_id ? `/content/${n.content_id}` : "/" };
    default:
      return { text: "You have a new notification", link: "/" };
  }
}

const NotificationsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [markingAll, setMarkingAll] = useState(false);

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading,
  } = useInfiniteQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("*")
        .eq("recipient_id", user!.id)
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);
      if (error) throw error;

      // Fetch actor profiles
      const actorIds = [...new Set((data as any[]).map((n: any) => n.actor_id).filter(Boolean))];
      let actorMap = new Map<string, any>();
      if (actorIds.length > 0) {
        const { data: actors } = await supabase
          .from("profiles")
          .select("id, username, display_name")
          .in("id", actorIds);
        (actors ?? []).forEach((a: any) => actorMap.set(a.id, a));
      }

      return (data as any[]).map((n: any) => {
        const actor = actorMap.get(n.actor_id);
        return {
          ...n,
          actor_display_name: actor?.display_name || null,
          actor_username: actor?.username || null,
        };
      });
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
    initialPageParam: 0,
    enabled: !!user,
  });

  const allNotifications = data?.pages.flat() ?? [];

  const markAllRead = useCallback(async () => {
    if (!user) return;
    setMarkingAll(true);
    await supabase
      .from("notifications" as any)
      .update({ is_read: true } as any)
      .eq("recipient_id", user.id)
      .eq("is_read", false);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    setMarkingAll(false);
  }, [user, queryClient]);

  const markRead = useCallback(async (id: string) => {
    await supabase
      .from("notifications" as any)
      .update({ is_read: true } as any)
      .eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [queryClient]);

  const handleClick = (n: any) => {
    if (!n.is_read) markRead(n.id);
    const { link } = formatNotification(n);
    navigate(link);
  };

  return (
    <div className="py-6 px-4 sm:px-6">
      <SeoHead title="Notifications — NeoScale AI" description="Your notifications" path="/notifications" />
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-foreground">Notifications</h1>
          {allNotifications.some((n) => !n.is_read) && (
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="text-sm text-secondary hover:underline disabled:opacity-50"
            >
              {markingAll ? "Marking…" : "Mark all as read"}
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : allNotifications.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-16">No notifications yet.</p>
        ) : (
          <div className="space-y-0">
            {allNotifications.map((n) => {
              const { text } = formatNotification(n);
              const initials = (n.actor_display_name || n.actor_username || "NS").slice(0, 2).toUpperCase();
              const isSystem = !n.actor_id;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex items-start gap-3 w-full text-left px-4 py-3 border-b border-border transition-colors hover:bg-accent/40 ${
                    !n.is_read ? "bg-[hsl(var(--card))]" : ""
                  }`}
                >
                  {/* Unread dot */}
                  <div className="w-2 pt-2 shrink-0">
                    {!n.is_read && <span className="block h-2 w-2 rounded-full bg-primary" />}
                  </div>

                  {/* Avatar */}
                  <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                    <AvatarFallback className={`text-[10px] font-bold ${isSystem ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"}`}>
                      {isSystem ? "NS" : initials}
                    </AvatarFallback>
                  </Avatar>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">{text}</p>
                  </div>

                  {/* Time */}
                  <span className="text-xs text-muted-foreground shrink-0 pt-0.5">
                    {timeAgo(n.created_at)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {hasNextPage && (
          <div className="flex justify-center py-6">
            <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
              {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
