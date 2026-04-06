import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, Link, useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDownloadLabel, triggerDownload } from "@/lib/download";
import { BookmarkButton } from "@/components/BookmarkButton";
import { AddToCollectionButton } from "@/components/AddToCollectionButton";

import { TipSelector } from "@/components/TipSelector";
import { GuestDownloadModal } from "@/components/GuestDownloadModal";
import { AccountGateModal } from "@/components/AccountGateModal";
import { ContentBlockViewer } from "@/components/ContentBlockViewer";
import { StarRating } from "@/components/StarRating";
import { RatingDisplay } from "@/components/RatingDisplay";
import { CommentsSection } from "@/components/CommentsSection";
import { ChangelogTab } from "@/components/ChangelogTab";
import { TipsTab } from "@/components/TipsTab";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Lock, Loader2, ArrowLeft, User, Heart, Calendar, Users, CheckCircle2, Eye, GitFork, ExternalLink, Clock, ShieldCheck } from "lucide-react";
import { VersionHistory } from "@/components/VersionHistory";
import { ForkModal } from "@/components/ForkModal";
import { DependencyDisplay } from "@/components/DependencyDisplay";
import { CompatibilityBadge } from "@/components/CompatibilityBadge";
import { CompatibilityTable } from "@/components/CompatibilityTable";
import { PwywPriceSelector } from "@/components/PwywPriceSelector";
import { MentionText } from "@/components/MentionText";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { TYPE_COLORS, displayContentType, resolvePostType } from "@/lib/content-types";
import { BountyResponseComposer } from "@/components/BountyResponseComposer";
import { insertNotification } from "@/lib/notifications";
import { ReblogDetailView } from "@/components/ReblogDetailView";
import { ReblogCard } from "@/components/ReblogCard";

function difficultyColor(level: string) {
  switch (level) {
    case "Beginner": return "bg-surface-container-highest/40 text-slate-400 border-white/8";
    case "Intermediate": return "bg-primary-container/20 text-primary border-primary/20";
    case "Advanced": return "bg-secondary-container/18 text-secondary-fixed-dim border-secondary-container/25";
    default: return "bg-surface-container-highest/50 text-tertiary border-white/10";
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function DetailSkeleton() {
  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-4 w-24 rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>
        <Skeleton className="h-8 w-3/4 rounded-md" />
        <Skeleton className="h-4 w-1/2 rounded-md" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-4 w-24 rounded-md" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-8 w-32 rounded-md" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-8 w-36 rounded-md" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

const buildTOC = (blocks: any[]) => {
  return blocks
    .filter(b => b.subheading || b.block_type)
    .map((b, i) => ({
      id: `block-${b.id}`,
      label: b.subheading || (b.block_type ?? "").replace(/_/g, ' '),
      index: i + 1,
      blockType: b.block_type,
    }));
};

const ContentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { isLoggedIn, user, profile } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [localCount, setLocalCount] = useState<number | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentHandled, setPaymentHandled] = useState(false);
  const [tipSuccess, setTipSuccess] = useState(false);
  const [tipHandled, setTipHandled] = useState(false);
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [accountGateOpen, setAccountGateOpen] = useState(false);
  const [accountGateMode, setAccountGateMode] = useState<"purchase" | "subscription">("purchase");
  const [forkModalOpen, setForkModalOpen] = useState(false);
  const [forksModalOpen, setForksModalOpen] = useState(false);
  const [curatorModalOpen, setCuratorModalOpen] = useState(false);
  const [curatorText, setCuratorText] = useState("");
  const [curatorSubmitting, setCuratorSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"failure" | "content" | "changelog" | "tips" | "comments" | "responses" | "reblogs">("changelog");
  const [composerOpen, setComposerOpen] = useState(false);
  const [hasMeToo, setHasMeToo] = useState(false);
  const [bountySort, setBountySort] = useState<"top" | "newest" | "verified">("top");
  const viewTracked = useRef(false);

  const { data: item, isLoading, error } = useQuery({
    queryKey: ["content_detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("*, profiles!content_items_creator_id_fkey(id, username, display_name, bio)")
        .eq("id", id!)
        .eq("status", "approved")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const creator = item?.profiles as { id: string; username: string; display_name: string | null; bio: string | null } | null;

  // ─── TOC blocks (lightweight fetch for table of contents) ──
  const { data: tocBlocks } = useQuery({
    queryKey: ["toc_blocks", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_blocks")
        .select("id, block_type, subheading, position")
        .eq("content_id", id!)
        .order("position");
      return (data ?? []) as any[];
    },
    enabled: !!id,
  });
  const toc = useMemo(() => buildTOC(tocBlocks ?? []), [tocBlocks]);

  // ─── View tracking ──────────────────────────────────────
  useEffect(() => {
    if (!item || viewTracked.current) return;
    viewTracked.current = true;

    // Increment view_count
    supabase.rpc("increment_content_view_count", { _content_id: item.id });

    // Insert content_views row
    supabase.from("content_views" as any).insert({
      content_id: item.id,
      user_id: user?.id ?? null,
    } as any);

    // Insert user_interaction for logged-in users
    if (user) {
      supabase.from("user_interactions" as any).insert({
        user_id: user.id,
        content_id: item.id,
        interaction_type: "viewed_block",
        interaction_meta: { title: item.title },
      } as any);
    }
  }, [item, user]);

  // Check if this item has a library update for the current user
  const { data: hasLibraryUpdate, refetch: refetchLibraryUpdate } = useQuery({
    queryKey: ["library_update_check", id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_library")
        .select("has_update")
        .eq("user_id", user!.id)
        .eq("content_id", id!)
        .maybeSingle();
      return (data as any)?.has_update === true;
    },
    enabled: !!user?.id && !!id,
  });

  const dismissLibraryUpdate = useCallback(async () => {
    if (!user || !item) return;
    await supabase
      .from("user_library")
      .update({ has_update: false, last_seen_version: item.current_version } as any)
      .eq("user_id", user.id)
      .eq("content_id", item.id);
    refetchLibraryUpdate();
  }, [user, item, refetchLibraryUpdate]);

  // Handle tab for bounty posts — default to responses
  useEffect(() => {
    if (!item) return;
    if ((item as any).bounty_enabled) {
      if (searchParams.get("tab") === "responses" || activeTab === "changelog") {
        setActiveTab("responses");
      }
    }
  }, [item]);

  function handleTabChange(tab: "failure" | "content" | "changelog" | "tips" | "comments" | "responses" | "reblogs") {
    setActiveTab(tab);
    if (tab === "changelog" && hasLibraryUpdate) {
      dismissLibraryUpdate();
    }
  }

  const { data: creatorStats } = useQuery({
    queryKey: ["creator_total_downloads", creator?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("download_count")
        .eq("creator_id", creator!.id)
        .eq("status", "approved");
      if (error) throw error;
      return {
        totalDownloads: (data ?? []).reduce((s, r) => s + r.download_count, 0),
        totalItems: data?.length ?? 0,
      };
    },
    enabled: !!creator?.id,
  });

  const { data: related } = useQuery({
    queryKey: ["related_content", item?.content_type, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("*")
        .eq("content_type", item!.content_type)
        .eq("status", "approved")
        .neq("id", id!)
        .order("download_count", { ascending: false })
        .limit(4);
      if (error) throw error;
      return data;
    },
    enabled: !!item?.content_type && !!id,
  });

  // Reblogs of this post
  const { data: reblogs } = useQuery({
    queryKey: ["post_reblogs", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("content_items")
        .select("*, profiles!content_items_creator_id_fkey(id, username, display_name)")
        .eq("reblog_of_id", id!)
        .eq("is_reblog", true)
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
    enabled: !!id,
  });

  const isSub = item?.monetisation_type === "subscription";
  const isPaid = item?.monetisation_type === "paid";
  const isPwyw = !!(item as any)?.is_pwyw;

  // Revenue splits
  const { data: revenueSplits } = useQuery({
    queryKey: ["revenue_splits", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("revenue_splits")
        .select("percentage, recipient_id, profiles!revenue_splits_recipient_id_fkey(username, display_name, avatar_url)")
        .eq("content_id", id!);
      return (data as any[]) ?? [];
    },
    enabled: !!id,
  });

  // Collaborators
  const { data: collaborators, refetch: refetchCollabs } = useQuery({
    queryKey: ["content_collaborators", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_collaborators")
        .select("collaborator_id, is_primary_author, profiles!content_collaborators_collaborator_id_fkey(id, username, display_name, avatar_url)")
        .eq("content_id", id!);
      return (data as any[]) ?? [];
    },
    enabled: !!id,
  });

  // Pending collab invites
  const { data: pendingInvites } = useQuery({
    queryKey: ["pending_collab_invites", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("collab_invites")
        .select("invitee_id, profiles!collab_invites_invitee_id_fkey(username, display_name)")
        .eq("content_id", id!)
        .eq("status", "pending");
      return (data as any[]) ?? [];
    },
    enabled: !!id,
  });

  const { data: hasActiveSubscription } = useQuery({
    queryKey: ["subscription_check", creator?.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("subscriber_id", user.id)
        .eq("creator_id", creator!.id)
        .eq("status", "active")
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
    enabled: isSub && !!creator?.id,
  });

  // Check if user has downloaded this content (used for eligibility)
  const { data: hasDownloaded } = useQuery({
    queryKey: ["user_has_downloaded", id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("downloads")
        .select("id")
        .eq("content_id", id!)
        .eq("user_id", user.id)
        .limit(1);
      return (data?.length ?? 0) > 0;
    },
    enabled: !!id && !!user,
  });

  const subscriberUnlocked = isSub && hasActiveSubscription === true;
  const isFreeContent = item?.monetisation_type === "free" || item?.monetisation_type === "donation";
  const isEligible = isLoggedIn && (isFreeContent || hasDownloaded === true || subscriberUnlocked);

  // Fork origin data
  const { data: forkOrigin } = useQuery({
    queryKey: ["fork_origin", item?.fork_of_content_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_items")
        .select("id, title, profiles!content_items_creator_id_fkey(username, display_name)")
        .eq("id", item!.fork_of_content_id!)
        .maybeSingle();
      return data as any;
    },
    enabled: !!item?.fork_of_content_id,
  });

  // Forks of this content
  const { data: forks } = useQuery({
    queryKey: ["content_forks", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_items")
        .select("id, title, profiles!content_items_creator_id_fkey(username, display_name)")
        .eq("fork_of_content_id", id!)
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      return (data as any[]) ?? [];
    },
    enabled: !!id,
  });

  // Curator recommendations
  const { data: curatorRecs, refetch: refetchCuratorRecs } = useQuery({
    queryKey: ["curator_recs", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("curator_recommendations")
        .select("id, recommendation_text, created_at, curators!curator_recommendations_curator_id_fkey(id, user_id, profiles:user_id(username, display_name, avatar_url, follower_count))")
        .eq("content_id", id!)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      return (data as any[]) ?? [];
    },
    enabled: !!id,
  });

  const isBounty = !!(item as any)?.bounty_enabled;
  const isPoster = item?.creator_id === user?.id;

  // Bounty responses query
  const { data: bountyResponses, refetch: refetchResponses } = useQuery({
    queryKey: ["bounty_responses", id, bountySort],
    queryFn: async () => {
      let q = supabase
        .from("bounty_responses" as any)
        .select("*, profiles!bounty_responses_responder_id_fkey(id, username, display_name, avatar_url)")
        .eq("bounty_content_id", id!);
      if (bountySort === "verified") q = (q as any).gt("verified_count", 0);
      if (bountySort === "newest") q = (q as any).order("created_at", { ascending: false });
      else q = (q as any).order("is_solution", { ascending: false }).order("score", { ascending: false });
      const { data } = await q;
      return (data as any[]) ?? [];
    },
    enabled: isBounty && !!id,
  });

  // Me-too status
  const { data: meTooData, refetch: refetchMeToo } = useQuery({
    queryKey: ["bounty_me_too_status", id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("bounty_me_too" as any)
        .select("id")
        .eq("content_id", id!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
    enabled: isBounty && !!user?.id && !!id,
  });

  // User's own verification status per response
  const { data: myVerifications, refetch: refetchVerifications } = useQuery({
    queryKey: ["bounty_my_verifications", id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("bounty_response_verifications" as any)
        .select("response_id")
        .eq("user_id", user!.id);
      return new Set((data as any[]).map((r: any) => r.response_id));
    },
    enabled: isBounty && !!user?.id,
  });

  // User's own upvoted responses
  const { data: myUpvotedResponses } = useQuery({
    queryKey: ["bounty_my_upvotes", id, user?.id],
    queryFn: async () => {
      // We track upvotes via a simple count on bounty_responses — no separate table
      // Just return empty set for now
      return new Set<string>();
    },
    enabled: isBounty && !!user?.id,
  });

  const isCurator = (profile as any)?.is_curator === true;

  const count = localCount ?? item?.download_count ?? 0;
  const viewCount = (item as any)?.view_count ?? 0;
  const label = item ? getDownloadLabel(item.content_type, item.monetisation_type, item.price_gbp ?? undefined) : "";

  useEffect(() => {
    if (searchParams.get("payment") === "success" && item && !paymentHandled) {
      setPaymentSuccess(true);
      setPaymentHandled(true);
      setSearchParams({}, { replace: true });
      (async () => {
        setDownloading(true);
        const result = await triggerDownload(item.id, item.file_url);
        if (result.error) {
          toast({ title: "Download failed", description: result.error, variant: "destructive" });
        } else if (result.newCount !== undefined) {
          setLocalCount(result.newCount);
        }
        setDownloading(false);
      })();
    }
    if (searchParams.get("tip") === "success" && !tipHandled) {
      setTipSuccess(true);
      setTipHandled(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, item, paymentHandled, tipHandled]);

  async function doDownload() {
    if (!item) return;
    setDownloading(true);
    const result = await triggerDownload(item.id, item.file_url);
    if (result.error) {
      toast({ title: "Download failed", description: result.error, variant: "destructive" });
    } else if (result.newCount !== undefined) {
      setLocalCount(result.newCount);
    }
    setDownloading(false);
  }

  async function handleDownload() {
    if (!item) return;
    if (isPaid) {
      if (!isLoggedIn) { setAccountGateMode("purchase"); setAccountGateOpen(true); return; }
      setDownloading(true);
      try {
        const priceInPence = Math.round((item.price_gbp ?? 0) * 100);
        const { data, error } = await supabase.functions.invoke("create-checkout-session", {
          body: {
            content_id: item.id, price_amount: priceInPence,
            success_url: `${window.location.origin}/content/${item.id}?payment=success`,
            cancel_url: `${window.location.origin}/content/${item.id}`,
          },
        });
        if (error || !data?.url) {
          toast({ title: "Checkout failed", description: "Could not start payment.", variant: "destructive" });
        } else { window.location.href = data.url; }
      } catch {
        toast({ title: "Checkout failed", description: "Something went wrong.", variant: "destructive" });
      }
      setDownloading(false);
      return;
    }
    if (isSub && !subscriberUnlocked) {
      if (!isLoggedIn) { setAccountGateMode("subscription"); setAccountGateOpen(true); }
      return;
    }
    if (!isLoggedIn) { setGuestModalOpen(true); return; }
    await doDownload();
  }

  if (isLoading) return <DetailSkeleton />;

  if (!item || error) {
    return (
      <div className="py-20 px-6 flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">This blueprint doesn't exist or has been removed.</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/browse"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Discover</Link>
        </Button>
      </div>
    );
  }

  // Reblog posts get their own detail layout
  if ((item as any).is_reblog) {
    return (
      <div className="py-6 sm:py-10 px-4 sm:px-6 pb-24 lg:pb-12">
        <div className="mx-auto max-w-3xl">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center text-[13px] text-muted-foreground hover:text-foreground mb-4 transition-colors cursor-pointer"
          >
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
          </button>
          <ReblogDetailView item={item} />
        </div>
      </div>
    );
  }

  const SITE_URL = import.meta.env.VITE_SITE_URL || "https://neoscale.ai";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": item.title,
    "description": item.description || "",
    "applicationCategory": "AIApplication",
    "offers": {
      "@type": "Offer",
      "price": item.monetisation_type === "paid" ? String(item.price_gbp ?? 0) : "0",
      "priceCurrency": "GBP",
    },
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflowY: 'auto',
      padding: '0',
    }}>
      <SeoHead
        title={`${item.title} — NeoScale AI`}
        description={item.description || `${item.content_type} for ${(item.ai_tools ?? []).join(", ") || "any AI tool"}`}
        path={`/content/${item.id}`}
        jsonLd={jsonLd}
      />
      <div style={{ padding: '20px 24px 0 24px' }}>
        {/* Back button */}
        {(() => {
          const state = location.state as { from?: string; name?: string } | null;
          let backLabel = "Back";
          if (state?.from === "browse") backLabel = "Back to Discover";
          else if (state?.from === "feed") backLabel = "Back to Feed";
          else if (state?.from === "profile" && state.name) backLabel = `Back to ${state.name}`;
          else if (state?.from === "category" && state.name) backLabel = `Back to ${state.name}`;
          else if (state?.from === "related") backLabel = "Back";
          return (
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center transition-colors"
              style={{
                fontSize: 13,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.45)',
                marginBottom: 16,
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                padding: 0,
              }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.75)'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)'}
            >
              <ArrowLeft style={{ width: 14, height: 14, marginRight: 4 }} /> {backLabel}
            </button>
          );
        })()}

        {paymentSuccess && (
          <div className="flex items-center gap-3 p-4 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">Payment successful. Your download is ready.</p>
          </div>
        )}
        {tipSuccess && (
          <div className="flex items-center gap-3 p-4 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">Thanks for supporting the creator.</p>
          </div>
        )}

        {/* BOUNTY HEADER BANNER */}
        {isBounty && (() => {
          const status = (item as any).bounty_status ?? "open";
          const tipGbp = (item as any).bounty_tip_gbp as number | null;
          const closesAt = (item as any).bounty_closes_at as string | null;
          const meTooCount = (item as any).bounty_me_too_count ?? 0;
          const hasMeTooLocal = meTooData ?? false;
          const isExpired = closesAt && new Date(closesAt) < new Date();
          const daysLeft = closesAt && !isExpired
            ? Math.ceil((new Date(closesAt).getTime() - Date.now()) / 86400000)
            : null;
          const statusConfig = {
            open:    { bg: "rgba(220,38,38,0.08)",  border: "#EF4444", text: "#EF4444",  emoji: "🔴" },
            claimed: { bg: "rgba(217,119,6,0.08)",  border: "#F59E0B", text: "#F59E0B", emoji: "🟡" },
            solved:  { bg: "rgba(22,163,74,0.08)",  border: "#22C55E", text: "#22C55E",  emoji: "🟢" },
          }[status] ?? { bg: "rgba(220,38,38,0.08)", border: "#EF4444", text: "#EF4444", emoji: "🔴" };

          async function toggleMeToo() {
            if (!user) return;
            if (hasMeTooLocal) {
              await supabase.from("bounty_me_too" as any).delete().eq("content_id", id!).eq("user_id", user.id);
            } else {
              await supabase.from("bounty_me_too" as any).insert({ content_id: id!, user_id: user.id } as any);
              // Notify poster at milestones
              const newCount = meTooCount + 1;
              if ([5, 10, 25, 50].includes(newCount) && item) {
                await insertNotification({
                  recipient_id: item.creator_id,
                  actor_id: user.id,
                  notification_type: "bounty_me_too",
                  content_id: id!,
                  metadata: { bounty_title: item.title, count: newCount },
                });
              }
            }
            refetchMeToo();
          }

          return (
            <div
              className="rounded-xl mb-4 px-4 py-3"
              style={{ background: statusConfig.bg, borderBottom: `2px solid ${statusConfig.border}` }}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: statusConfig.text }}>
                    {statusConfig.emoji} {status.toUpperCase()} · BOUNTY
                  </span>
                  {tipGbp && tipGbp > 0 && (
                    <span className="text-[11px] text-amber-400 font-medium">💰 £{tipGbp} tip for the solver</span>
                  )}
                  {daysLeft !== null && (
                    <span className="text-[11px] text-muted-foreground">⏱ Closes in {daysLeft} day{daysLeft !== 1 ? "s" : ""}</span>
                  )}
                  {isExpired && status === "open" && (
                    <span className="text-[11px] text-muted-foreground">⏱ Expired — still accepting responses</span>
                  )}
                </div>
                {isLoggedIn && !isPoster && (
                  <button
                    onClick={toggleMeToo}
                    className={`text-[11px] px-3 py-1.5 rounded-full border transition-colors ${
                      hasMeTooLocal
                        ? "bg-[#2EC4B6]/15 text-[#2EC4B6] border-[#2EC4B6]/30"
                        : "bg-transparent text-muted-foreground border-border hover:border-muted-foreground/60"
                    }`}
                  >
                    {hasMeTooLocal ? `You have this too ✓` : `🙋 ${meTooCount > 0 ? meTooCount + " others have this" : "I have this too"}`}
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Two-column layout */}
      <div style={{
        display: 'flex',
        gap: 0,
        alignItems: 'flex-start',
        padding: '0 0 40px 0',
      }}>

        {/* ── MAIN CONTENT ── */}
        <div style={{
          flex: 1,
          minWidth: 0,
          padding: '20px 24px 40px 24px',
        }}>

        {/* 1. Cover image */}
        {(item as any).cover_image_url && (
          <img
            src={(item as any).cover_image_url}
            alt={item.title}
            loading="eager"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            className="w-full object-cover rounded-xl mb-4"
            style={{ maxHeight: 200 }}
          />
        )}

        {/* 2. Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-2.5">
          <Badge variant="outline" className={`text-[10px] font-medium ${TYPE_COLORS[item.content_type] ?? TYPE_COLORS["Failure Library"]}`}>
            {displayContentType(item.content_type)}
          </Badge>
          <Badge variant="outline" className={`text-[10px] font-medium ${difficultyColor(item.difficulty)}`}>
            {item.difficulty}
          </Badge>
          {item.is_verified && (
            <Badge variant="outline" className="text-[10px] font-medium bg-emerald-500/15 text-emerald-400 border-emerald-500/30">✓ Verified</Badge>
          )}
          {!isPaid && !isSub && (
            <Badge variant="outline" className="text-[10px] font-medium bg-secondary/15 text-secondary border-secondary/30">Free</Badge>
          )}
          {isPaid && (
            <Badge variant="outline" className="text-[10px] font-medium bg-primary/15 text-primary border-primary/30">£{(item.price_gbp ?? 0).toFixed(2)}</Badge>
          )}
          {isSub && (
            <Badge variant="outline" className="text-[10px] font-medium bg-secondary/15 text-secondary border-secondary/30">Subscribers only</Badge>
          )}
        </div>

        {/* 3. Title */}
        <h1 className="text-[26px] font-bold text-foreground leading-[1.25] mb-2">{item.title}</h1>

        {/* 3.5 Rating display (read-only, hidden for blogs) */}
        {item.content_type !== "Blog" && (
          <RatingDisplay
            avgRating={Number((item as any).avg_rating) || 0}
            ratingCount={(item as any).rating_count ?? 0}
          />
        )}

        {/* 4. Description */}
        {item.description && (
          <p className="text-[16px] text-[#CCCCCC] leading-[1.5] font-normal mt-2 mb-3"><MentionText text={item.description} /></p>
        )}

        {/* BOUNTY — Failure detail + gap */}
        {isBounty && (item as any).bounty_gap && (
          <div
            className="rounded-xl px-4 py-3 mb-4"
            style={{ background: "rgba(46,196,182,0.05)", borderLeft: "2px solid #2EC4B6" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">What a good solution needs:</p>
            <p className="text-sm text-foreground leading-relaxed">{(item as any).bounty_gap}</p>
          </div>
        )}

        {/* 5. Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 text-[13px] text-muted-foreground">
          {creator && (
            <>
              {collaborators && collaborators.length > 1 ? (
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {collaborators.slice(0, 4).map((c: any) => (
                      <Link
                        key={c.collaborator_id}
                        to={`/creator/${c.profiles?.username}`}
                        className="h-5 w-5 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[8px] font-medium text-muted-foreground overflow-hidden hover:z-10 relative"
                      >
                        {c.profiles?.avatar_url ? (
                          <img src={c.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          (c.profiles?.display_name || c.profiles?.username || "?")[0].toUpperCase()
                        )}
                      </Link>
                    ))}
                  </div>
                  <span>
                    {collaborators.map((c: any, i: number) => (
                      <span key={c.collaborator_id}>
                        {i > 0 && ", "}
                        <Link to={`/creator/${c.profiles?.username}`} className="hover:text-foreground transition-colors">
                          {c.profiles?.display_name || c.profiles?.username}
                        </Link>
                      </span>
                    ))}
                  </span>
                </div>
              ) : (
                <Link to={`/creator/${creator.username}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                  <User className="h-3 w-3" />
                  <span>By {creator.display_name || creator.username}</span>
                </Link>
              )}
              <span className="text-muted-foreground/40">·</span>
            </>
          )}

          {pendingInvites && pendingInvites.length > 0 && (
            <>
              {pendingInvites.map((inv: any) => (
                <span key={inv.invitee_id} className="italic text-muted-foreground/60">
                  {inv.profiles?.display_name || inv.profiles?.username} (pending)
                </span>
              ))}
              <span className="text-muted-foreground/40">·</span>
            </>
          )}

          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{viewCount.toLocaleString()} views</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="flex items-center gap-1"><Download className="h-3 w-3" />{count.toLocaleString()} downloads</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(item.approved_at ?? item.created_at)}</span>
          {(item as any).fork_count > 0 && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <button onClick={() => setForksModalOpen(true)} className="flex items-center gap-1 hover:text-foreground transition-colors">
                <GitFork className="h-3 w-3" />{(item as any).fork_count} fork{(item as any).fork_count !== 1 ? "s" : ""}
              </button>
            </>
          )}
          {user && collaborators?.some((c: any) => c.collaborator_id === user.id && !c.is_primary_author) && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="text-[11px] text-muted-foreground hover:text-destructive transition-colors">Leave collab</button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Leave collaboration?</AlertDialogTitle>
                    <AlertDialogDescription>This content will no longer appear on your profile.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={async () => {
                      await supabase.from("content_collaborators").delete().eq("collaborator_id", user.id).eq("content_id", item.id);
                      refetchCollabs();
                      toast({ title: "Left collaboration" });
                    }}>Leave</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>

        {/* Fork attribution */}
        {forkOrigin && (
          <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            Forked from{" "}
            <Link to={`/creator/${forkOrigin.profiles?.username}`} className="mention-link">@{forkOrigin.profiles?.username}</Link>'s{" "}
            <Link to={`/content/${forkOrigin.id}`} className="text-primary hover:underline">{forkOrigin.title}</Link>
          </p>
        )}

        {/* TABLE OF CONTENTS */}
        {toc.length > 1 && (
          <div style={{
            padding: '14px 16px',
            marginBottom: 28,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10,
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.10em',
              color: 'rgba(255,255,255,0.30)',
              marginBottom: 10,
            }}>
              Contents
            </div>
            <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {toc.map(entry => (
                <li key={entry.id}>
                  <a
                    href={`#${entry.id}`}
                    onClick={e => {
                      e.preventDefault();
                      document.getElementById(entry.id)
                        ?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 0',
                      textDecoration: 'none',
                      color: 'rgba(255,255,255,0.55)',
                      fontSize: 13,
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#fff')}
                    onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)')}
                  >
                    <span style={{
                      fontSize: 11,
                      color: 'rgba(255,255,255,0.25)',
                      minWidth: 16,
                      textAlign: 'right',
                    }}>
                      {entry.index}.
                    </span>
                    <span style={{ textTransform: 'capitalize' }}>
                      {entry.label}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* 7. WHAT TO EXPECT — always visible, never blurred */}
        <WhatToExpectSection item={item} />

        {/* 8. BLUEPRINT — inline, always visible */}
        {(!isSub || subscriberUnlocked) && (
          <div className="mb-4">
            {item.content_type !== "Blog" && (
              <h2 className="text-lg font-semibold text-foreground mb-3">Blueprint:</h2>
            )}
            <ContentBlockViewer
              contentId={item.id}
              contentTitle={item.title}
              monetisationType={item.monetisation_type}
              creatorId={item.creator_id}
              useInstructions={item.use_instructions}
              onTriggerPaywall={handleDownload}
              isEligible={isEligible}
              contentType={item.content_type}
            />
          </div>
        )}

        {/* 9a. Local model CTA */}
        {item.content_type === "AI Tools (LLMs)" && (item as any).tool_subtype === "local" && (item as any).tool_url && (
          <div className="rounded-xl border border-border bg-card p-4 mb-3">
            <Button
              className="w-full bg-[hsl(var(--secondary))] hover:bg-[hsl(var(--secondary))]/90 text-secondary-foreground"
              onClick={() => window.open((item as any).tool_url, "_blank")}
            >
              <ExternalLink className="mr-2 h-4 w-4" /> View Model →
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-2">The blueprint below explains how to run this locally</p>
          </div>
        )}

        {/* 9. ACTION BOX — inline, full width */}
        <div className="rounded-xl border border-border bg-card mb-4" style={{ padding: "12px 16px" }}>
          {/* Single row: ratings left, icons right */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <StarRating
                contentId={item.id}
                contentTitle={item.title}
                avgRating={Number((item as any).avg_rating) || 0}
                ratingCount={(item as any).rating_count ?? 0}
                isEligible={isEligible}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <BookmarkButton contentId={item.id} />
              <AddToCollectionButton contentId={item.id} contentTitle={item.title} />
            </div>
          </div>

          {/* Secondary links row */}
          <div className="flex flex-wrap items-center gap-4 mt-2">
            {isPaid && (
              <span className="text-[11px] text-muted-foreground">£{(item.price_gbp ?? 0).toFixed(2)} — one-time payment</span>
            )}
            {item.donation_enabled && creator && (
              <TipSelector
                creatorId={creator.id}
                creatorDisplayName={creator.display_name || creator.username}
                successUrl={`${window.location.origin}/content/${item.id}?tip=success`}
                cancelUrl={`${window.location.origin}/content/${item.id}`}
              />
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="text-[12px] text-[hsl(var(--secondary))] hover:underline transition-colors flex items-center gap-1"
                    onClick={() => {
                      if (!isLoggedIn) { window.location.href = "/signup"; return; }
                      setForkModalOpen(true);
                    }}
                  >
                    <GitFork className="h-3 w-3" /> Fork this ↗
                  </button>
                </TooltipTrigger>
                <TooltipContent><p>Clone to your drafts and make it your own</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {isCurator && (
              <button
                className="text-[12px] text-[hsl(var(--secondary))] hover:underline flex items-center gap-1"
                onClick={() => setCuratorModalOpen(true)}
              >
                <ShieldCheck className="h-3 w-3" /> Add recommendation
              </button>
            )}
          </div>
        </div>

        {/* Curator Picks — inline */}
        {curatorRecs && curatorRecs.length > 0 && (
          <div className="mb-4">
            <CuratorPicksCard recs={curatorRecs} />
          </div>
        )}

        {/* 9. CREATED BY — inline horizontal card */}
        {creator && (
          <div className="flex items-center gap-3 py-3 mb-4 border-t border-b border-border">
            <Link to={`/creator/${creator.username}`} className="shrink-0">
              <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground overflow-hidden">
                {(creator.display_name || creator.username || "?")[0].toUpperCase()}
              </div>
            </Link>
            <div className="flex-1 min-w-0">
              <Link to={`/creator/${creator.username}`} className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
                {creator.display_name || creator.username}
              </Link>
              <p className="text-xs text-muted-foreground">@{creator.username}</p>
              {creator.bio && <p className="text-[13px] text-muted-foreground line-clamp-1 mt-0.5">{creator.bio}</p>}
              {revenueSplits && revenueSplits.length > 0 && revenueSplits.some((s: any) => s.is_contested) && (
                <p className="text-xs text-amber-400 mt-1">Revenue split pending agreement</p>
              )}
            </div>
            <div className="shrink-0 text-right">
              {creatorStats && (
                <p className="text-[11px] text-muted-foreground mb-1">{creatorStats.totalItems} published · {creatorStats.totalDownloads.toLocaleString()} downloads</p>
              )}
            </div>
          </div>
        )}

        {/* 8. Works With — pill fallback + compatibility table */}
        {item.ai_tools && item.ai_tools.length > 0 && (
          <div className="mb-3">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Works with</h3>
            <div className="flex flex-wrap gap-2">
              {item.ai_tools.map((tool) => {
                const label = tool === "Other" && (item as any)?.other_tool_name ? (item as any).other_tool_name : tool;
                return <span key={tool} className="text-xs px-2 py-1 rounded-lg bg-accent text-muted-foreground">{label}</span>;
              })}
            </div>
          </div>
        )}

        {/* Compatibility Table */}
        <CompatibilityTable contentId={item.id} creatorId={item.creator_id} />

        {/* 8b. Model specs for local AI Tools */}
        {item.content_type === "AI Tools (LLMs)" && (item as any).tool_subtype === "local" && (
          <div className="mb-3 space-y-2">
            {((item as any).model_parameters || (item as any).model_base_architecture || (item as any).model_format || (item as any).model_license) && (
              <div>
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Model Specs</h3>
                <div className="flex flex-wrap gap-2">
                  {(item as any).model_parameters && (
                    <span className="text-xs px-2 py-1 rounded-lg bg-accent text-muted-foreground">{(item as any).model_parameters} params</span>
                  )}
                  {(item as any).model_base_architecture && (
                    <span className="text-xs px-2 py-1 rounded-lg bg-accent text-muted-foreground">{(item as any).model_base_architecture}</span>
                  )}
                  {(item as any).model_format && (
                    <span className="text-xs px-2 py-1 rounded-lg bg-accent text-muted-foreground">{(item as any).model_format}</span>
                  )}
                  {(item as any).model_license && (
                    <span className="text-xs px-2 py-1 rounded-lg bg-accent text-muted-foreground">{(item as any).model_license}</span>
                  )}
                </div>
              </div>
            )}
            {(item as any).model_run_with && (item as any).model_run_with.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Runs On</h3>
                <div className="flex flex-wrap gap-2">
                  {((item as any).model_run_with as string[]).map((p) => (
                    <span key={p} className="text-xs px-2 py-1 rounded-lg bg-accent text-muted-foreground">{p}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 9. Use Cases — moved above tabs */}
        {item.use_cases && item.use_cases.length > 0 && (
          <div className="mb-3">
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Use Cases</h3>
            <div className="flex flex-wrap gap-2">
              {item.use_cases.map((uc) => (
                <span key={uc} className="text-xs px-2 py-1 rounded-lg border border-border text-muted-foreground">{uc}</span>
              ))}
            </div>
          </div>
        )}

        {/* 10. Tags */}
        <div className="mb-3">
          <DetailMicrotags contentId={item.id} itemTags={(item as any).custom_tags ?? (item as any).tags} />
        </div>

        {/* Dependencies */}
        <DependencyDisplay contentId={item.id} />

        {/* Compatibility */}
        <CompatibilityBadge
          contentId={item.id}
          creatorId={item.creator_id}
          compatibilityStatus={(item as any).compatibility_status}
          lastVerifiedAt={(item as any).last_verified_at}
          variant="detail"
        />

        {/* 11. Version History compact row */}
        <div className="mb-5">
          <VersionHistory contentId={item.id} currentVersion={item.current_version} />
        </div>

        {/* Subscriber gate */}
        {isSub && !subscriberUnlocked && creator && (
          <div className="border border-border rounded-xl p-5 bg-card mb-4">
            <div className="flex items-center gap-3 mb-3">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Subscriber-only content</p>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              This content is for subscribers of {creator.display_name || creator.username}.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/creator/${creator.username}`}><Users className="mr-2 h-3.5 w-3.5" /> Subscribe to unlock</Link>
            </Button>
          </div>
        )}

        {/* 12. Tab strip */}
        {(!isSub || subscriberUnlocked) && (
          <>
            <div
              className="flex items-center gap-1 sticky top-0 z-20 overflow-x-auto"
              style={{
                background: 'rgba(8,8,12,0.80)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                paddingBottom: 12,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                marginBottom: 20,
              }}
            >
              {isBounty ? (
                <>
                  {(["responses", "failure", "changelog", "comments"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => handleTabChange(tab)}
                      className="transition-colors whitespace-nowrap"
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        padding: '6px 16px',
                        borderRadius: 100,
                        border: 'none',
                        background: activeTab === tab ? 'rgba(232,87,26,0.08)' : 'transparent',
                        color: activeTab === tab ? '#E8571A' : 'rgba(255,255,255,0.45)',
                        cursor: 'pointer',
                      }}
                    >
                      {tab === "responses" && `Responses (${(bountyResponses ?? []).length})`}
                      {tab === "failure" && "Failure"}
                      {tab === "changelog" && "Changelog"}
                      {tab === "comments" && `Comments (${(item as any).comment_count ?? 0})`}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {(["changelog", "tips", "comments", "reblogs"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => handleTabChange(tab)}
                      className="transition-colors whitespace-nowrap"
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        padding: '6px 16px',
                        borderRadius: 100,
                        border: 'none',
                        background: activeTab === tab ? 'rgba(232,87,26,0.08)' : 'transparent',
                        color: activeTab === tab ? '#E8571A' : 'rgba(255,255,255,0.45)',
                        cursor: 'pointer',
                      }}
                    >
                      {tab === "changelog" && (
                        <>Changelog{hasLibraryUpdate && <span style={{ marginLeft: 4, color: '#E8571A' }}>●</span>}</>
                      )}
                      {tab === "tips" && "Tips"}
                      {tab === "comments" && `Comments (${(item as any).comment_count ?? 0})`}
                      {tab === "reblogs" && `Reblogs (${(item as any).reblog_count ?? reblogs?.length ?? 0})`}
                    </button>
                  ))}
                </>
              )}
            </div>

            {/* 13. Tab content */}
            <div className="mt-0">

              {activeTab === "changelog" && (
                <div className="py-4">
                  <ChangelogTab
                    contentId={item.id}
                    contentTitle={item.title}
                    creatorId={item.creator_id}
                    currentVersion={item.current_version}
                  />
                </div>
              )}

              {activeTab === "tips" && (
                <div className="py-4">
                  <TipsTab contentId={item.id} isEligible={isEligible} />
                </div>
              )}

              {activeTab === "comments" && (
                <div className="py-4">
                  <CommentsSection
                    contentId={item.id}
                    contentTitle={item.title}
                    commentCount={(item as any).comment_count ?? 0}
                    isEligible={isEligible}
                  />
                </div>
              )}

              {/* Reblogs tab */}
              {activeTab === "reblogs" && (
                <div className="py-4">
                  {(!reblogs || reblogs.length === 0) ? (
                    <div className="flex flex-col items-center gap-3 py-10 text-center">
                      <p className="text-sm text-muted-foreground">No reblogs yet. Be the first.</p>
                    </div>
                  ) : (
                    <div className="space-y-0 -mx-4 sm:-mx-6">
                      {reblogs.map((reblog: any) => (
                        <ReblogCard key={reblog.id} item={reblog} compact context="browse" />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* BOUNTY — Failure tab (blueprint blocks) */}
              {activeTab === "failure" && (
                <div className="py-4">
                  <p className="text-sm text-muted-foreground mb-3">The failure this bounty is based on:</p>
                  <ContentBlockViewer
                    contentId={item.id}
                    contentTitle={item.title}
                    monetisationType={item.monetisation_type}
                    creatorId={item.creator_id}
                    useInstructions={item.use_instructions}
                    onTriggerPaywall={handleDownload}
                    isEligible={isEligible}
                    contentType={item.content_type}
                  />
                </div>
              )}

              {/* BOUNTY — Responses tab */}
              {activeTab === "responses" && (
                <div className="py-4 space-y-4">
                  {/* Solved banner */}
                  {(item as any).bounty_status === "solved" && (item as any).bounty_solved_response_id && (() => {
                    const winner = (bountyResponses ?? []).find((r: any) => r.id === (item as any).bounty_solved_response_id);
                    return (
                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                        <span>✓ Solved — {winner?.profiles?.display_name || winner?.profiles?.username || "Someone"}'s Blueprint was marked as the solution by the poster.</span>
                      </div>
                    );
                  })()}

                  {/* Sort + submit row */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold text-foreground mr-2">{(bountyResponses ?? []).length} Responses</span>
                      {(["top", "newest", "verified"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setBountySort(s)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                            bountySort === s
                              ? "bg-primary/15 text-primary border-primary/30"
                              : "bg-card text-muted-foreground border-border hover:border-muted-foreground/40"
                          }`}
                        >
                          {s === "top" ? "Top" : s === "newest" ? "Newest" : "Verified only"}
                        </button>
                      ))}
                    </div>
                    {isLoggedIn && !isPoster && (item as any).bounty_status !== "solved" &&
                      !(bountyResponses ?? []).some((r: any) => r.responder_id === user?.id) && (
                      <button
                        onClick={() => setComposerOpen(true)}
                        className="text-sm font-semibold px-4 py-2 rounded-xl"
                        style={{ background: "#E8571A", color: "white" }}
                      >
                        Submit a Blueprint →
                      </button>
                    )}
                    {isLoggedIn && (bountyResponses ?? []).some((r: any) => r.responder_id === user?.id) && (
                      <p className="text-xs text-muted-foreground">You've already submitted a response.</p>
                    )}
                  </div>

                  {/* Response cards */}
                  {(bountyResponses ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">No responses yet. Be the first to solve this!</p>
                  )}
                  {(bountyResponses ?? []).map((resp: any) => {
                    const respProfile = resp.profiles as any;
                    const isVerified = (myVerifications ?? new Set()).has(resp.id);
                    const isSolution = resp.is_solution;

                    async function handleVerify() {
                      if (!user) return;
                      if (isVerified) {
                        await supabase.from("bounty_response_verifications" as any).delete().eq("response_id", resp.id).eq("user_id", user.id);
                      } else {
                        await supabase.from("bounty_response_verifications" as any).insert({ response_id: resp.id, user_id: user.id } as any);
                        await insertNotification({
                          recipient_id: resp.responder_id,
                          actor_id: user.id,
                          notification_type: "bounty_verified",
                          content_id: id!,
                          metadata: { bounty_title: item.title, verifications: (resp.verified_count ?? 0) + 1 },
                        });
                      }
                      refetchVerifications();
                      refetchResponses();
                    }

                    async function handleMarkSolution() {
                      if (!isPoster) return;
                      await supabase.from("bounty_responses" as any).update({ is_solution: true } as any).eq("id", resp.id);
                      await insertNotification({
                        recipient_id: resp.responder_id,
                        actor_id: user!.id,
                        notification_type: "bounty_solution_marked",
                        content_id: id!,
                        metadata: { bounty_title: item.title, tip_gbp: (item as any).bounty_tip_gbp },
                      });
                      refetchResponses();
                    }

                    return (
                      <div
                        key={resp.id}
                        id={`response-${resp.id}`}
                        className="rounded-xl border bg-card overflow-hidden"
                        style={isSolution ? {
                          borderColor: "#22C55E",
                          borderLeftWidth: 3,
                          boxShadow: "0 0 12px rgba(34,197,94,0.15)",
                        } : {}}
                      >
                        {isSolution && (
                          <div className="px-4 py-2 text-xs font-bold text-green-400 border-b border-green-500/20" style={{ background: "rgba(34,197,94,0.06)" }}>
                            ⭐ Marked as solution by @{creator?.username}
                          </div>
                        )}
                        <div className="p-4 space-y-3">
                          {/* ROW 1 — Responder header */}
                          <div className="flex items-center gap-2">
                            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground shrink-0">
                              {(respProfile?.display_name || respProfile?.username || "?")[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-foreground truncate">{respProfile?.display_name || respProfile?.username}</p>
                              <p className="text-xs text-muted-foreground">@{respProfile?.username}</p>
                            </div>
                            {isSolution && (
                              <span className="text-xs font-bold px-2 py-1 rounded-full bg-green-500/15 text-green-400 shrink-0">✓ Solution</span>
                            )}
                          </div>

                          {/* ROW 2 — How it fixes */}
                          <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", borderLeft: "2px solid #2EC4B6" }}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">How this fixes it:</p>
                            <p className="text-sm text-foreground leading-relaxed">{resp.how_it_fixes}</p>
                          </div>

                          {/* ROW 3 — Tested on */}
                          {resp.tested_on && resp.tested_on.length > 0 && (
                            <div className="flex items-center flex-wrap gap-1.5">
                              <span className="text-[11px] text-muted-foreground">Tested on:</span>
                              {resp.tested_on.map((t: string) => (
                                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{t}</span>
                              ))}
                            </div>
                          )}

                          {/* ROW 4 — Linked Blueprint or inline blocks */}
                          {resp.inline_title && (
                            <div className="rounded-lg border border-border bg-background px-3 py-2">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Blueprint</p>
                              <p className="text-sm font-semibold text-foreground">{resp.inline_title}</p>
                              {resp.inline_blocks && Array.isArray(resp.inline_blocks) && resp.inline_blocks.map((b: any, i: number) => (
                                <p key={i} className="text-sm text-muted-foreground mt-1 leading-relaxed">{b.text_content}</p>
                              ))}
                            </div>
                          )}
                          {resp.blueprint_content_id && (
                            <Link
                              to={`/content/${resp.blueprint_content_id}`}
                              className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 hover:border-primary/30 transition-colors"
                            >
                              <span className="text-xs font-medium text-foreground flex-1">View linked Blueprint →</span>
                            </Link>
                          )}

                          {/* ROW 5 — Footer */}
                          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-border">
                            <button
                              onClick={handleVerify}
                              disabled={!isLoggedIn}
                              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                                isVerified
                                  ? "bg-[#2EC4B6]/15 text-[#2EC4B6] border-[#2EC4B6]/30"
                                  : "bg-card text-muted-foreground border-border hover:border-muted-foreground/40"
                              }`}
                            >
                              {isVerified ? `✓ Verified` : "✓ This worked for me"}
                              {(resp.verified_count ?? 0) > 0 && (
                                <span className="ml-1.5 opacity-70">{resp.verified_count} verified</span>
                              )}
                            </button>
                            {isPoster && (item as any).bounty_status !== "solved" && (
                              <button
                                onClick={handleMarkSolution}
                                className="text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
                              >
                                Mark as Solution ★
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* 14. Related Content — horizontal scroll at bottom */}
        {related && related.length > 0 && (
          <div className="mt-8">
            <h2 className="text-base font-semibold text-foreground mb-3">Related</h2>
            <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
              {related.slice(0, 4).map((r) => {
                const accent = TYPE_COLORS[r.content_type]?.match(/text-\[([^\]]+)\]/)?.[1] || "#9999AA";
                return (
                  <Link
                    key={r.id}
                    to={`/content/${r.id}`}
                    state={{ from: "related" }}
                    className="w-[200px] flex-shrink-0 rounded-[10px] border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors group"
                  >
                    <div className="h-[90px] w-full overflow-hidden">
                      {(r as any).cover_image_url ? (
                        <img src={(r as any).cover_image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-accent/50">
                          <span className="text-2xl font-bold text-muted-foreground">{r.content_type[0]}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <div className="flex gap-1 mb-1">
                        <Badge variant="outline" className={`text-[9px] font-medium ${TYPE_COLORS[r.content_type] ?? ""}`}>
                          {displayContentType(r.content_type)}
                        </Badge>
                        <Badge variant="outline" className={`text-[9px] font-medium ${difficultyColor(r.difficulty)}`}>
                          {r.difficulty}
                        </Badge>
                      </div>
                      <p className="text-[13px] font-semibold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">{r.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1"><Eye className="h-3 w-3" />{(r.view_count ?? 0).toLocaleString()}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        </div>
        {/* ── END MAIN CONTENT ── */}

        {/* ── RIGHT SIDEBAR ── */}
        <div style={{
          width: 260,
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          padding: '20px 16px 20px 0',
          maxHeight: '100vh',
          overflowY: 'auto',
        }}>

          {/* Primary CTA */}
          {isBounty && isLoggedIn && !isPoster && (item as any).bounty_status !== "solved" &&
           !(bountyResponses ?? []).some((r: any) => r.responder_id === user?.id) ? (
            <button
              onClick={() => setComposerOpen(true)}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: 100,
                background: '#E8571A',
                border: '1px solid rgba(255,255,255,0.10)',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Submit a Blueprint →
            </button>
          ) : (
            <button
              onClick={handleDownload}
              disabled={downloading}
              data-visual-slot="btn-primary"
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: 100,
                background: 'linear-gradient(160deg,#111 0%,#1C1C1C 50%,#0A0A0A 100%)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 600,
                cursor: downloading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {label}
            </button>
          )}

          <hr style={{
            border: 'none',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            margin: '16px 0',
          }} />

          {/* Author card */}
          {creator && (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.10em',
                color: 'rgba(255,255,255,0.28)',
                marginBottom: 10,
              }}>
                Author
              </div>
              <Link
                to={`/creator/${creator.username}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textDecoration: 'none',
                }}
              >
                <div style={{
                  height: 36,
                  width: 36,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.80)',
                  flexShrink: 0,
                }}>
                  {(creator.display_name || creator.username || "?")[0].toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.90)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {creator.display_name || creator.username}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.45)',
                  }}>
                    @{creator.username}
                  </div>
                </div>
              </Link>
            </div>
          )}

          <hr style={{
            border: 'none',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            margin: '0 0 16px 0',
          }} />

          {/* Details */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.10em',
              color: 'rgba(255,255,255,0.28)',
              marginBottom: 10,
            }}>
              Details
            </div>
            {[
              { label: 'Type', value: resolvePostType((item as any).post_type ?? null, item?.content_type ?? null) },
              { label: 'Difficulty', value: item?.difficulty },
              { label: 'Published', value: formatDate(item?.approved_at ?? item?.created_at) },
            ].filter(r => r.value).map(r => (
              <div key={r.label} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '5px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)' }}>
                  {r.label}
                </span>
                <span style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.65)',
                  textAlign: 'right',
                  textTransform: 'capitalize',
                }}>
                  {r.value}
                </span>
              </div>
            ))}
          </div>

          <hr style={{
            border: 'none',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            margin: '0 0 16px 0',
          }} />

          {/* Stats */}
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.10em',
              color: 'rgba(255,255,255,0.28)',
              marginBottom: 10,
            }}>
              Stats
            </div>
            {[
              { label: '↓ Downloads', value: count.toLocaleString() },
              { label: '★ Rating', value: (item as any)?.avg_rating ? `${Number((item as any).avg_rating).toFixed(1)} (${(item as any).rating_count ?? 0})` : '—' },
              { label: '👁 Views', value: ((item as any)?.view_count ?? 0).toLocaleString() },
            ].map(r => (
              <div key={r.label} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '5px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)' }}>
                  {r.label}
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
                  {r.value}
                </span>
              </div>
            ))}
          </div>

          {/* Bookmark + Collection buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <BookmarkButton contentId={item.id} />
            <AddToCollectionButton contentId={item.id} contentTitle={item.title} />
          </div>

        </div>
        {/* ── END SIDEBAR ── */}

      </div>
      {/* ── END TWO-COLUMN LAYOUT ── */}

        {/* Mobile sticky bar */}
        <div className="fixed bottom-0 left-0 right-0 lg:hidden border-t border-border bg-background p-4 z-30">
          <div className="space-y-2">
            {item.donation_enabled && creator && (
              <TipSelector
                creatorId={creator.id}
                creatorDisplayName={creator.display_name || creator.username}
                successUrl={`${window.location.origin}/content/${item.id}?tip=success`}
                cancelUrl={`${window.location.origin}/content/${item.id}`}
              />
            )}
          </div>
        </div>

      <GuestDownloadModal
        open={guestModalOpen}
        onOpenChange={setGuestModalOpen}
        contentId={item.id}
        onDownload={doDownload}
      />
      <AccountGateModal
        open={accountGateOpen}
        onOpenChange={setAccountGateOpen}
        contentId={item.id}
        mode={accountGateMode}
      />

      {/* Fork modal */}
      {creator && (
        <ForkModal
          open={forkModalOpen}
          onOpenChange={setForkModalOpen}
          originalItem={item as any}
          originalCreatorUsername={creator.username}
        />
      )}

      {/* Bounty response composer */}
      {composerOpen && isBounty && creator && (
        <BountyResponseComposer
          bountyContentId={item.id}
          bountyTitle={item.title}
          bountyCreatorId={item.creator_id}
          onClose={() => setComposerOpen(false)}
          onSubmitted={() => { setComposerOpen(false); refetchResponses(); }}
        />
      )}

      {/* Forks list modal */}
      <Dialog open={forksModalOpen} onOpenChange={setForksModalOpen}>
        <DialogContent
          className="sm:max-w-sm"
          data-visual-slot="modal-surface"
          style={{ background: '#0E0E16', border: '1px solid var(--border)' }}
        >
          <DialogHeader>
            <DialogTitle>Forks of this content</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {forks && forks.length > 0 ? forks.map((f: any) => (
              <Link
                key={f.id}
                to={`/content/${f.id}`}
                onClick={() => setForksModalOpen(false)}
                className="block p-3 rounded-lg border border-border hover:border-primary/30 transition-colors"
              >
                <p className="text-sm font-medium text-foreground">{f.title}</p>
                <p className="text-xs text-muted-foreground">by {f.profiles?.display_name || f.profiles?.username}</p>
              </Link>
            )) : (
              <p className="text-sm text-muted-foreground">No public forks yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Curator recommendation modal */}
      <Dialog open={curatorModalOpen} onOpenChange={setCuratorModalOpen}>
        <DialogContent
          className="sm:max-w-md"
          data-visual-slot="modal-surface"
          style={{ background: '#0E0E16', border: '1px solid var(--border)' }}
        >
          <DialogHeader>
            <DialogTitle>Write a recommendation</DialogTitle>
            <DialogDescription>Appears as a highlighted quote on this post page.</DialogDescription>
          </DialogHeader>
          <Textarea value={curatorText} onChange={(e) => setCuratorText(e.target.value.slice(0, 300))} placeholder="Why do you recommend this?" rows={4} maxLength={300} />
          <p className="text-xs text-muted-foreground text-right">{curatorText.length}/300</p>
          <Button onClick={async () => {
            if (!user || !item || curatorText.trim().length === 0) return;
            setCuratorSubmitting(true);
            const { data: curatorRow } = await supabase.from("curators").select("id").eq("user_id", user.id).maybeSingle();
            if (!curatorRow) { setCuratorSubmitting(false); return; }
            await supabase.from("curator_recommendations").insert({ curator_id: curatorRow.id, content_id: item.id, recommendation_text: curatorText.trim() } as any);
            await supabase.from("user_interactions" as any).insert({ user_id: user.id, content_id: item.id, interaction_type: "curated", interaction_meta: { content_title: item.title, recommendation_excerpt: curatorText.trim().slice(0, 80) } } as any);
            refetchCuratorRecs();
            setCuratorModalOpen(false);
            setCuratorText("");
            setCuratorSubmitting(false);
            toast({ title: "Recommendation published." });
          }} disabled={curatorSubmitting || curatorText.trim().length === 0}>
            {curatorSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Publish
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ---- Curator Picks Card for sidebar ---- */
function CuratorPicksCard({ recs }: { recs: any[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? recs : recs.slice(0, 2);
  return (
    <div className="border border-border rounded-xl p-5 bg-card space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Curator Picks</p>
      {visible.map((rec: any) => {
        const curator = rec.curators?.profiles;
        const initials = (curator?.display_name || curator?.username || "?").slice(0, 2).toUpperCase();
        return (
          <div key={rec.id} className="border-l-[3px] border-[#2EC4B6] pl-3">
            <p className="text-sm text-foreground italic leading-relaxed">{rec.recommendation_text}</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-medium shrink-0 overflow-hidden">
                {curator?.avatar_url ? <img src={curator.avatar_url} alt="" className="h-full w-full object-cover" /> : initials}
              </div>
              <div>
                <Link to={`/creator/${curator?.username}`} className="text-xs font-medium text-foreground hover:text-primary transition-colors">
                  {curator?.display_name || curator?.username}
                </Link>
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-md bg-[#2EC4B6]/15 text-[#2EC4B6] border border-[#2EC4B6]/30 font-medium">Curator</span>
                <p className="text-[11px] text-muted-foreground">{curator?.follower_count ?? 0} followers</p>
              </div>
            </div>
          </div>
        );
      })}
      {recs.length > 2 && !showAll && (
        <button onClick={() => setShowAll(true)} className="text-xs text-primary hover:underline">See more</button>
      )}
    </div>
  );
}

function DetailMicrotags({ contentId, itemTags }: { contentId: string; itemTags?: string[] }) {
  const navigate = useNavigate();
  // Show item-level tags (new free-text tags) + legacy microtags
  const { data: microTags } = useQuery({
    queryKey: ["content_microtags_detail", contentId],
    queryFn: async () => {
      const { data } = await supabase.from("content_microtags").select("tag").eq("content_id", contentId);
      return (data ?? []).map((r: any) => r.tag);
    },
  });
  const allTags = [...(itemTags ?? []), ...(microTags ?? [])];
  if (allTags.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tags</h3>
      <div className="flex flex-wrap gap-2">
        {allTags.map((tag) => (
          <span
            key={tag}
            onClick={() => navigate(`/browse?tag=${encodeURIComponent(tag)}`)}
            className="text-[11px] px-2 py-1 rounded-lg bg-[hsl(240,14%,15%)] text-[hsl(240,7%,60%)] cursor-pointer hover:text-foreground transition-colors"
          >
            #{tag}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---- What to Expect Section — always visible, never blurred ---- */
function WhatToExpectSection({ item }: { item: any }) {
  const blocks = item.what_to_expect_blocks as any[] | null;
  const fallbackText = item.what_to_expect as string | null;

  if (!blocks?.length && !fallbackText) return null;

  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-foreground mb-2.5">What to Expect</h2>
      <div
        className="rounded-xl p-4 space-y-3"
        style={{
          backgroundColor: "rgba(46,196,182,0.04)",
          borderLeft: "2px solid rgba(46,196,182,0.3)",
        }}
      >
        {blocks && blocks.length > 0 ? (
          blocks
            .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
            .map((block: any, idx: number) => (
              <WhatToExpectBlock key={block.id || idx} block={block} />
            ))
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed">{fallbackText}</p>
        )}
      </div>
    </div>
  );
}

function WhatToExpectBlock({ block }: { block: any }) {
  const fmt = block.formatting_type || "paragraph";
  const text = block.text_content || "";

  if (block.block_type === "image" && block.image_url) {
    return (
      <div>
        <img src={block.image_url} alt={block.image_description || ""} className="w-full rounded-lg" />
        {block.image_description && <p className="text-xs text-muted-foreground mt-1">{block.image_description}</p>}
      </div>
    );
  }

  if (fmt === "sublist" || fmt === "sub_list") {
    const subBlocks = (block.sub_blocks as string[]) || [];
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{text}</p>
        {subBlocks.map((sub, i) => (
          <p key={i} className="text-sm text-muted-foreground" style={{ paddingLeft: 24 }}>
            <span className="text-muted-foreground/60">↳</span> {sub}
          </p>
        ))}
      </div>
    );
  }

  const lines = text.split("\n").filter((l: string) => l.trim());

  if (fmt === "bullets") {
    return (
      <ul className="space-y-1">
        {lines.map((line: string, i: number) => (
          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--secondary))] shrink-0" />
            {line}
          </li>
        ))}
      </ul>
    );
  }

  if (fmt === "numbered") {
    return (
      <ol className="space-y-1">
        {lines.map((line: string, i: number) => (
          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
            <span className="text-muted-foreground/60 shrink-0 font-medium">{i + 1}.</span>
            {line}
          </li>
        ))}
      </ol>
    );
  }

  // paragraph
  return <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{text}</p>;
}

export default ContentDetail;
