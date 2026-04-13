import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
    case "mention":
      return {
        text: `@${meta.mentioner_username || actor} mentioned you in a ${meta.context || "comment"} on "${meta.content_title || "content"}"`,
        link: n.content_id ? `/content/${n.content_id}` : "/",
      };
    case "split_contest":
      return {
        text: `${meta.contestant_username || actor} proposed a different revenue split (${meta.proposed_percentage}%) for "${meta.content_title || "content"}"`,
        link: n.content_id ? `/content/${n.content_id}` : "/",
      };
    case "split_contest_accepted":
      return { text: `Your proposed split of ${meta.proposed_percentage}% for "${meta.content_title || ""}" was accepted`, link: n.content_id ? `/content/${n.content_id}` : "/" };
    case "split_contest_rejected":
      return { text: `Your proposed split for "${meta.content_title || ""}" was declined. Original split kept at ${meta.original_percentage}%`, link: n.content_id ? `/content/${n.content_id}` : "/" };
    case "bounty_response":
      return { text: `★ ${actor} submitted a Blueprint for your bounty: '${meta.bounty_title || "your bounty"}'`, link: n.content_id ? `/content/${n.content_id}?tab=responses` : "/" };
    case "bounty_me_too":
      return { text: `${meta.count || "Several"} people now have your failure. Your bounty is gaining attention.`, link: n.content_id ? `/content/${n.content_id}` : "/" };
    case "bounty_solution_marked":
      return {
        text: `🏆 Your Blueprint was marked as the solution to '${meta.bounty_title || "a bounty"}'${meta.tip_gbp ? ` — £${meta.tip_gbp} is being sent to you.` : ""}`,
        link: n.content_id ? `/content/${n.content_id}?tab=responses` : "/",
      };
    case "bounty_verified":
      return { text: `${actor} verified your Blueprint worked on their failure. (${meta.verifications || 1} total verifications)`, link: n.content_id ? `/content/${n.content_id}?tab=responses` : "/" };
    case "bounty_solved":
      return { text: `✓ A solution was found for a failure you shared: '${meta.bounty_title || ""}'. See what worked.`, link: n.content_id ? `/content/${n.content_id}?tab=responses` : "/" };
    case "post_reblogged":
      return {
        text: `↺ ${meta.reblogger_username || actor} reblogged your post: '${meta.original_title || meta.source_title || "your post"}'${meta.reblog_title ? ` — "${meta.reblog_title}"` : ""}`,
        link: meta.reblog_id ? `/content/${meta.reblog_id}` : n.content_id ? `/content/${n.content_id}` : "/",
      };
    case "reblog":
      // Legacy reblog notification
      return {
        text: `↺ ${meta.reblogger_username || actor} reblogged '${meta.source_title || "your content"}'`,
        link: n.content_id ? `/content/${n.content_id}` : "/",
      };
    default:
      return { text: "You have a new notification", link: "/" };
  }
}

// ─── Split Contest handling in notifications ──────────────────

function SplitContestActions({ notification, onDone }: { notification: any; onDone: () => void }) {
  const { toast } = useToast();
  const [processing, setProcessing] = useState(false);
  const meta = notification.metadata ?? {};

  async function handleAcceptContest() {
    setProcessing(true);
    // Find the contest
    const { data: contests } = await supabase
      .from("collab_split_contests" as any)
      .select("id, content_id, contestant_id, proposed_percentage, original_percentage")
      .eq("content_id", notification.content_id)
      .eq("contestant_id", notification.actor_id)
      .eq("status", "pending")
      .limit(1);

    const contest = (contests as any)?.[0];
    if (!contest) { toast({ title: "Contest not found" }); setProcessing(false); return; }

    // Accept: update contest status, update revenue_splits percentage
    await supabase.from("collab_split_contests" as any).update({ status: "accepted" } as any).eq("id", contest.id);
    await supabase.from("revenue_splits" as any).update({ percentage: contest.proposed_percentage, is_contested: false } as any)
      .eq("content_id", contest.content_id).eq("recipient_id", contest.contestant_id);

    // Notify contestant
    await supabase.from("notifications").insert({
      recipient_id: contest.contestant_id,
      notification_type: "split_contest_accepted",
      content_id: contest.content_id,
      actor_id: notification.recipient_id,
      metadata: { proposed_percentage: contest.proposed_percentage, content_title: meta.content_title },
    } as any);

    toast({ title: "Split updated", description: `Revenue split updated to ${contest.proposed_percentage}%.` });
    onDone();
    setProcessing(false);
  }

  async function handleRejectContest() {
    setProcessing(true);
    const { data: contests } = await supabase
      .from("collab_split_contests" as any)
      .select("id, content_id, contestant_id, original_percentage")
      .eq("content_id", notification.content_id)
      .eq("contestant_id", notification.actor_id)
      .eq("status", "pending")
      .limit(1);

    const contest = (contests as any)?.[0];
    if (!contest) { toast({ title: "Contest not found" }); setProcessing(false); return; }

    await supabase.from("collab_split_contests" as any).update({ status: "rejected" } as any).eq("id", contest.id);
    await supabase.from("revenue_splits" as any).update({ is_contested: false } as any)
      .eq("content_id", contest.content_id).eq("recipient_id", contest.contestant_id);

    await supabase.from("notifications").insert({
      recipient_id: contest.contestant_id,
      notification_type: "split_contest_rejected",
      content_id: contest.content_id,
      actor_id: notification.recipient_id,
      metadata: { original_percentage: contest.original_percentage, content_title: meta.content_title },
    } as any);

    toast({ title: "Proposal declined", description: "Original split kept." });
    onDone();
    setProcessing(false);
  }

  return (
    <div className="flex gap-1.5 mt-2">
      <Button size="sm" className="h-7 text-xs bg-secondary hover:bg-secondary/90 text-secondary-foreground" disabled={processing} onClick={handleAcceptContest}>
        Accept {meta.proposed_percentage}%
      </Button>
      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={processing} onClick={handleRejectContest}>
        Keep original {meta.original_percentage}%
      </Button>
    </div>
  );
}

// ─── Pending Collab Invites with split contest step ──────────

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

      const contentIds = [...new Set(data.map((i: any) => i.content_id))];
      const inviterIds = [...new Set(data.map((i: any) => i.inviter_id))];

      const [contentRes, inviterRes] = await Promise.all([
        supabase.from("content_items").select("id, title, content_type").in("id", contentIds),
        supabase.from("profiles").select("id, username, display_name").in("id", inviterIds),
      ]);

      // Also fetch any revenue splits for these content items for this user
      const { data: splits } = await supabase
        .from("revenue_splits" as any)
        .select("content_id, percentage")
        .eq("recipient_id", user!.id)
        .in("content_id", contentIds);

      const contentMap = new Map((contentRes.data ?? []).map((c: any) => [c.id, c]));
      const inviterMap = new Map((inviterRes.data ?? []).map((p: any) => [p.id, p]));
      const splitMap = new Map(((splits as any) ?? []).map((s: any) => [s.content_id, s.percentage]));

      return data.map((inv: any) => ({
        ...inv,
        content: contentMap.get(inv.content_id),
        inviter: inviterMap.get(inv.inviter_id),
        splitPercentage: splitMap.get(inv.content_id) ?? null,
      }));
    },
    enabled: !!user?.id,
  });

  const [processing, setProcessing] = useState<string | null>(null);
  const [contestStep, setContestStep] = useState<string | null>(null); // invite id showing contest step
  const [proposedPct, setProposedPct] = useState<number>(0);
  const [contestReason, setContestReason] = useState("");

  async function handleAccept(invite: any) {
    // If there's a split, show the contest step first
    if (invite.splitPercentage !== null && contestStep !== invite.id) {
      setContestStep(invite.id);
      setProposedPct(invite.splitPercentage);
      return;
    }

    setProcessing(invite.id);
    await supabase.from("collab_invites").update({ status: "accepted", responded_at: new Date().toISOString() } as any).eq("id", invite.id);

    await supabase.from("content_collaborators").insert({
      content_id: invite.content_id,
      collaborator_id: user!.id,
      is_primary_author: false,
    } as any);

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
    setContestStep(null);
    setProcessing(null);
  }

  async function handleAcceptSplit(invite: any) {
    // Accept the invite AND the split
    await handleAccept({ ...invite, splitPercentage: null }); // bypass contest step
  }

  async function handleProposeDifferent(invite: any) {
    if (proposedPct < 1 || proposedPct > 89) {
      toast({ title: "Invalid percentage", description: "Must be 1–89%", variant: "destructive" });
      return;
    }

    setProcessing(invite.id);

    // First accept the invite
    await supabase.from("collab_invites").update({ status: "accepted", responded_at: new Date().toISOString() } as any).eq("id", invite.id);

    await supabase.from("content_collaborators").insert({
      content_id: invite.content_id,
      collaborator_id: user!.id,
      is_primary_author: false,
    } as any);

    // Insert contest
    await supabase.from("collab_split_contests" as any).insert({
      content_id: invite.content_id,
      contestant_id: user!.id,
      original_percentage: invite.splitPercentage,
      proposed_percentage: proposedPct,
      reason: contestReason.trim() || null,
    } as any);

    // Mark split as contested
    await supabase.from("revenue_splits" as any).update({ is_contested: true } as any)
      .eq("content_id", invite.content_id).eq("recipient_id", user!.id);

    // Notify uploader
    await supabase.from("notifications").insert({
      recipient_id: invite.inviter_id,
      notification_type: "split_contest",
      content_id: invite.content_id,
      actor_id: user!.id,
      metadata: {
        contestant_username: user!.email?.split("@")[0] || "",
        original_percentage: invite.splitPercentage,
        proposed_percentage: proposedPct,
        reason: contestReason.trim() || null,
        content_title: invite.content?.title || "",
      },
    } as any);

    // Also notify inviter about acceptance
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

    toast({ title: "Proposal submitted", description: "The uploader will review your proposed split." });
    queryClient.invalidateQueries({ queryKey: ["pending_collab_invites"] });
    setContestStep(null);
    setContestReason("");
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
        <div key={inv.id} className="py-2 border-b border-border last:border-0">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              {inv.content && <Badge variant="outline" className="text-[10px] mr-2">{inv.content.content_type}</Badge>}
              <span className="text-sm text-foreground">{inv.content?.title || "Unknown content"}</span>
              <span className="text-xs text-muted-foreground ml-2">from @{inv.inviter?.username || "unknown"}</span>
            </div>
            {contestStep !== inv.id && (
              <div className="flex gap-1.5 shrink-0">
                <Button size="sm" className="h-7 text-xs bg-secondary hover:bg-secondary/90 text-secondary-foreground" disabled={processing === inv.id} onClick={() => handleAccept(inv)}>
                  {processing === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                  Accept
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={processing === inv.id} onClick={() => handleDecline(inv)}>
                  <X className="h-3 w-3 mr-1" /> Decline
                </Button>
              </div>
            )}
          </div>

          {/* Split contest step */}
          {contestStep === inv.id && inv.splitPercentage !== null && (
            <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-3">
              <p className="text-sm text-foreground">
                Your split: <span className="font-semibold">{inv.splitPercentage}%</span> of creator earnings.
                Accept this, or propose a different amount?
              </p>
              <div className="flex gap-2">
                <Button size="sm" className="h-8 text-xs bg-secondary hover:bg-secondary/90 text-secondary-foreground" disabled={processing === inv.id} onClick={() => handleAcceptSplit(inv)}>
                  Accept split
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setContestStep(`${inv.id}_propose`)}>
                  Propose different amount
                </Button>
              </div>
            </div>
          )}

          {/* Propose different amount form */}
          {contestStep === `${inv.id}_propose` && (
            <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground shrink-0">Proposed %:</label>
                <Input type="number" min={1} max={89} value={proposedPct} onChange={(e) => setProposedPct(Number(e.target.value) || 0)} className="w-20 h-8 text-sm bg-background border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Reason (optional):</label>
                <Textarea value={contestReason} onChange={(e) => setContestReason(e.target.value.slice(0, 300))} rows={2} placeholder="Why you're proposing a different split..." maxLength={300} className="mt-1 text-sm bg-background border-border" />
                <span className="text-[10px] text-muted-foreground">{contestReason.length}/300</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="h-8 text-xs bg-secondary hover:bg-secondary/90 text-secondary-foreground" disabled={processing === inv.id} onClick={() => handleProposeDifferent(inv)}>
                  {processing === inv.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Submit proposal
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setContestStep(inv.id)}>
                  Back
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Notifications Page ─────────────────────────────────

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
    <div style={{ paddingTop: 28, paddingBottom: 40, paddingLeft: 24, paddingRight: 24 }}>
      <SeoHead title="Notifications — NeoScale AI" description="Your notifications" path="/notifications" />
      <div className="mx-auto max-w-2xl">
        {allNotifications.some((n) => !n.is_read) && (
          <div className="flex justify-end" style={{ marginBottom: 12 }}>
            <button onClick={markAllRead} disabled={markingAll} style={{ fontSize: 13, color: '#1F7A6D', background: 'none', border: 'none', cursor: 'pointer', opacity: markingAll ? 0.5 : 1 }}>
              {markingAll ? "Marking…" : "Mark all as read"}
            </button>
          </div>
        )}

        <PendingCollabInvites />

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : allNotifications.length === 0 ? (
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center', paddingTop: 64, paddingBottom: 64 }}>No notifications yet.</p>
        ) : (
          <div className="space-y-0">
            {allNotifications.map((n) => {
              const { text } = formatNotification(n);
              const initials = (n.actor_display_name || n.actor_username || "NS").slice(0, 2).toUpperCase();
              const isSystem = !n.actor_id;
              const isSplitContest = n.notification_type === "split_contest" && !n.is_read;

              return (
                <div key={n.id}>
                  <button
                    onClick={() => !isSplitContest && handleClick(n)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: !n.is_read ? 'rgba(255,255,255,0.01)' : 'transparent',
                      border: 'none',
                      borderBottomWidth: 1,
                      borderBottomStyle: 'solid',
                      borderBottomColor: 'rgba(255,255,255,0.04)',
                      cursor: isSplitContest ? 'default' : 'pointer',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = !n.is_read ? 'rgba(255,255,255,0.01)' : 'transparent'; }}
                  >
                    <div className="shrink-0" style={{ width: 8, paddingTop: 6 }}>
                      {!n.is_read && <span style={{ display: 'block', width: 6, height: 6, borderRadius: '50%', background: '#1F7A6D' }} />}
                    </div>
                    <Avatar className="shrink-0" style={{ width: 28, height: 28, marginTop: 2 }}>
                      <AvatarFallback style={{ fontSize: 10, fontWeight: 700, background: isSystem ? 'rgba(139,69,19,0.15)' : 'rgba(255,255,255,0.06)', color: isSystem ? '#8B4513' : 'rgba(255,255,255,0.45)' }}>
                        {isSystem ? "NS" : initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.80)', lineHeight: 1.4 }}>{text}</p>
                      {isSplitContest && (
                        <SplitContestActions notification={n} onDone={() => {
                          markRead(n.id);
                          queryClient.invalidateQueries({ queryKey: ["notifications"] });
                        }} />
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', flexShrink: 0, paddingTop: 2 }}>
                      {timeAgo(n.created_at)}
                    </span>
                  </button>
                </div>
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
