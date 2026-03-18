import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Bell, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
    case "collab_invite":
      return { text: `${meta.inviter_username || actor} invited you to co-author "${meta.content_title || "content"}"`, link: n.content_id ? `/content/${n.content_id}` : "/" };
    case "collab_accepted":
      return { text: `${meta.accepter_username || actor} accepted your co-author invite for "${meta.content_title || ""}"`, link: n.content_id ? `/content/${n.content_id}` : "/" };
    case "collab_declined":
      return { text: `${actor} declined your co-author invite`, link: "/" };
    case "compatibility_warning":
      return { text: `Your post "${meta.content_title || ""}" hasn't been verified in ${meta.days_since_verified || "90+"} days`, link: n.content_id ? `/content/${n.content_id}` : "/" };
    default:
      return { text: "You have a new notification", link: "/" };
  }
}

function PendingCollabInvites() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: invites, isLoading } = useQuery({
    queryKey: ["pending_collab_invites", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collab_invites")
        .select("id, content_id, inviter_id, invited_at")
        .eq("invitee_id", user!.id)
        .eq("status", "pending")
        .order("invited_at", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch content titles and inviter info
      const contentIds = [...new Set(data.map((i: any) => i.content_id))];
      const inviterIds = [...new Set(data.map((i: any) => i.inviter_id))];

      const [contentRes, inviterRes] = await Promise.all([
        supabase.from("content_items").select("id, title, content_type").in("id", contentIds),
        supabase.from("profiles").select("id, username, display_name").in("id", inviterIds),
      ]);

      const contentMap = new Map((contentRes.data ?? []).map((c: any) => [c.id, c]));
      const inviterMap = new Map((inviterRes.data ?? []).map((p: any) => [p.id, p]));

      return data.map((inv: any) => ({
        ...inv,
        content: contentMap.get(inv.content_id),
        inviter: inviterMap.get(inv.inviter_id),
      }));
    },
    enabled: !!user?.id,
  });

  const [processing, setProcessing] = useState<string | null>(null);

  async function handleAccept(invite: any) {
    setProcessing(invite.id);
    await supabase.from("collab_invites").update({ status: "accepted", responded_at: new Date().toISOString() } as any).eq("id", invite.id);

    // Insert self as collaborator
    await supabase.from("content_collaborators").insert({
      content_id: invite.content_id,
      collaborator_id: user!.id,
      is_primary_author: false,
    } as any);

    // Insert inviter as primary author if not exists
    const { data: existing } = await supabase
      .from("content_collaborators")
      .select("id")
      .eq("content_id", invite.content_id)
      .eq("collaborator_id", invite.inviter_id)
      .maybeSingle();
    if (!existing) {
      await supabase.from("content_collaborators").insert({
        content_id: invite.content_id,
        collaborator_id: invite.inviter_id,
        is_primary_author: true,
      } as any);
    }

    // Notify inviter
    await supabase.from("notifications").insert({
      recipient_id: invite.inviter_id,
      notification_type: "collab_accepted",
      content_id: invite.content_id,
      actor_id: user!.id,
      metadata: {
        accepter_username: user!.email?.split("@")[0] || "",
        content_title: invite.content?.title || "",
      },
    } as any);

    toast({ title: "Invite accepted", description: "You are now a co-author." });
    queryClient.invalidateQueries({ queryKey: ["pending_collab_invites"] });
    setProcessing(null);
  }

  async function handleDecline(invite: any) {
    setProcessing(invite.id);
    await supabase.from("collab_invites").update({ status: "declined", responded_at: new Date().toISOString() } as any).eq("id", invite.id);

    await supabase.from("notifications").insert({
      recipient_id: invite.inviter_id,
      notification_type: "collab_declined",
      actor_id: user!.id,
      metadata: { content_title: invite.content?.title || "" },
    } as any);

    toast({ title: "Invite declined" });
    queryClient.invalidateQueries({ queryKey: ["pending_collab_invites"] });
    setProcessing(null);
  }

  if (isLoading || !invites || invites.length === 0) return null;

  return (
    <div className="mb-6 border border-secondary/40 rounded-xl bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Pending co-author invites</h2>
      {invites.map((inv: any) => (
        <div key={inv.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
          <div className="flex-1 min-w-0">
            {inv.content && (
              <Badge variant="outline" className="text-[10px] mr-2">{inv.content.content_type}</Badge>
            )}
            <span className="text-sm text-foreground">{inv.content?.title || "Unknown content"}</span>
            <span className="text-xs text-muted-foreground ml-2">from @{inv.inviter?.username || "unknown"}</span>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button
              size="sm"
              className="h-7 text-xs bg-secondary hover:bg-secondary/90 text-secondary-foreground"
              disabled={processing === inv.id}
              onClick={() => handleAccept(inv)}
            >
              {processing === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={processing === inv.id}
              onClick={() => handleDecline(inv)}
            >
              <X className="h-3 w-3 mr-1" /> Decline
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
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

        {/* Pending collab invites */}
        <PendingCollabInvites />

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
                  <div className="w-2 pt-2 shrink-0">
                    {!n.is_read && <span className="block h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                    <AvatarFallback className={`text-[10px] font-bold ${isSystem ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground"}`}>
                      {isSystem ? "NS" : initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">{text}</p>
                  </div>
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
