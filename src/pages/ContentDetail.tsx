import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDownloadLabel, triggerDownload } from "@/lib/download";
import { BookmarkButton } from "@/components/BookmarkButton";
import { AddToCollectionButton } from "@/components/AddToCollectionButton";
import { AddToLibraryButton } from "@/components/AddToLibraryButton";
import { ContentCard } from "@/components/ContentCard";
import { TipSelector } from "@/components/TipSelector";
import { GuestDownloadModal } from "@/components/GuestDownloadModal";
import { AccountGateModal } from "@/components/AccountGateModal";
import { ContentBlockViewer } from "@/components/ContentBlockViewer";
import { StarRating } from "@/components/StarRating";
import { CommentsSection } from "@/components/CommentsSection";
import { ChangelogTab } from "@/components/ChangelogTab";
import { TipsTab } from "@/components/TipsTab";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Lock, Loader2, ArrowLeft, User, Heart, Calendar, Users, CheckCircle2, Eye, GitFork, ExternalLink, Clock } from "lucide-react";
import { VersionHistory } from "@/components/VersionHistory";
import { ForkModal } from "@/components/ForkModal";
import { DependencyDisplay } from "@/components/DependencyDisplay";
import { CompatibilityBadge } from "@/components/CompatibilityBadge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const TYPE_COLORS: Record<string, string> = {
  "Prompt File": "bg-[#E8571A]/15 text-[#E8571A] border-[#E8571A]/30",
  "Prompt Tutorial": "bg-[#2EC4B6]/15 text-[#2EC4B6] border-[#2EC4B6]/30",
  "Agent Blueprint": "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "Workflow Template": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Agent Stack": "bg-red-500/15 text-red-400 border-red-500/30",
  "Model Config Guide": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Integration Guide": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "Evaluation Framework": "bg-pink-500/15 text-pink-400 border-pink-500/30",
  "Failure Library": "bg-muted text-muted-foreground border-border",
};

function difficultyColor(level: string) {
  switch (level) {
    case "Beginner": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "Intermediate": return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "Advanced": return "bg-red-500/15 text-red-400 border-red-500/30";
    default: return "bg-muted text-muted-foreground border-border";
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

const ContentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { isLoggedIn, user } = useAuth();
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
  const [activeTab, setActiveTab] = useState<"content" | "changelog" | "tips" | "comments">("content");
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

  function handleTabChange(tab: "content" | "changelog" | "tips" | "comments") {
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
        .limit(3);
      if (error) throw error;
      return data;
    },
    enabled: !!item?.content_type && !!id,
  });

  const isSub = item?.monetisation_type === "subscription";
  const isPaid = item?.monetisation_type === "paid";

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
        <p className="text-sm text-muted-foreground">This content doesn't exist or has been removed.</p>
        <Button variant="outline" size="sm" asChild>
          <Link to="/browse"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Browse</Link>
        </Button>
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
    <div className="py-8 sm:py-12 px-4 sm:px-6 pb-24 lg:pb-12">
      <SeoHead
        title={`${item.title} — NeoScale AI`}
        description={item.description || `${item.content_type} for ${(item.ai_tools ?? []).join(", ") || "any AI tool"}`}
        path={`/content/${item.id}`}
        jsonLd={jsonLd}
      />
      <div className="mx-auto max-w-4xl">
        <Link to="/browse" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to Browse
        </Link>

        {paymentSuccess && (
          <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">Payment successful. Your download is ready.</p>
          </div>
        )}
        {tipSuccess && (
          <div className="flex items-center gap-3 p-4 mb-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">Thanks for supporting the creator.</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge variant="outline" className={`text-[10px] font-medium ${TYPE_COLORS[item.content_type] ?? TYPE_COLORS["Failure Library"]}`}>
            {item.content_type}
          </Badge>
          <Badge variant="outline" className={`text-[10px] font-medium ${difficultyColor(item.difficulty)}`}>
            {item.difficulty}
          </Badge>
          {!isPaid && !isSub && (
            <Badge variant="outline" className="text-[10px] font-medium bg-secondary/15 text-secondary border-secondary/30">Free</Badge>
          )}
          {isPaid && (
            <Badge variant="outline" className="text-[10px] font-medium bg-primary/15 text-primary border-primary/30">
              £{(item.price_gbp ?? 0).toFixed(2)}
            </Badge>
          )}
          {isSub && (
            <Badge variant="outline" className="text-[10px] font-medium bg-secondary/15 text-secondary border-secondary/30">Subscribers only</Badge>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{item.title}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{item.description}</p>

        <div className="flex flex-wrap items-center gap-4 mb-2 text-sm text-muted-foreground">
          {creator && (
            <Link to={`/creator/${creator.username}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <User className="h-3.5 w-3.5" />
              <span>By {creator.display_name || creator.username}</span>
            </Link>
          )}
          <div className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            <span>{viewCount.toLocaleString()} views</span>
          </div>
          <div className="flex items-center gap-1">
            <Download className="h-3.5 w-3.5" />
            <span>{count.toLocaleString()} downloads</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatDate(item.approved_at ?? item.created_at)}</span>
          </div>
          {(item as any).fork_count > 0 && (
            <button
              onClick={() => setForksModalOpen(true)}
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <GitFork className="h-3.5 w-3.5" />
              <span>{(item as any).fork_count} fork{(item as any).fork_count !== 1 ? "s" : ""}</span>
            </button>
          )}
        </div>

        {/* Fork attribution */}
        {forkOrigin && (
          <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            Forked from{" "}
            <Link to={`/creator/${forkOrigin.profiles?.username}`} className="text-primary hover:underline">
              {forkOrigin.profiles?.display_name || forkOrigin.profiles?.username}
            </Link>'s{" "}
            <Link to={`/content/${forkOrigin.id}`} className="text-primary hover:underline">
              {forkOrigin.title}
            </Link>
          </p>
        )}

        <div className="mb-8" />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {item.ai_tools && item.ai_tools.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Works with</h3>
                <div className="flex flex-wrap gap-2">
                  {item.ai_tools.map((tool) => (
                    <span key={tool} className="text-xs px-2 py-1 rounded-lg bg-accent text-muted-foreground">{tool}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Dependencies */}
            <DependencyDisplay contentId={item.id} />

            {/* Compatibility status */}
            <CompatibilityBadge
              contentId={item.id}
              creatorId={item.creator_id}
              compatibilityStatus={(item as any).compatibility_status}
              lastVerifiedAt={(item as any).last_verified_at}
              variant="detail"
            />

            {isSub && !subscriberUnlocked && creator && (
              <div className="border border-border rounded-xl p-5 bg-card">
                <div className="flex items-center gap-3 mb-3">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Subscriber-only content</p>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  This content is for subscribers of {creator.display_name || creator.username}.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/creator/${creator.username}`}>
                    <Users className="mr-2 h-3.5 w-3.5" /> Subscribe to unlock
                  </Link>
                </Button>
              </div>
            )}

            {(!isSub || subscriberUnlocked) && (
              <ContentBlockViewer
                contentId={item.id}
                contentTitle={item.title}
                monetisationType={item.monetisation_type}
                creatorId={item.creator_id}
                useInstructions={item.use_instructions}
                onTriggerPaywall={handleDownload}
                isEligible={isEligible}
              />
            )}

            {item.what_to_expect && (!isSub || subscriberUnlocked) && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-3">What to Expect</h2>
                <div className="border border-border rounded-xl p-5 bg-card">
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.what_to_expect}</p>
                </div>
              </div>
            )}

            {item.use_cases && item.use_cases.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Use Cases</h3>
                <div className="flex flex-wrap gap-2">
                  {item.use_cases.map((uc) => (
                    <span key={uc} className="text-xs px-2 py-1 rounded-lg border border-border text-muted-foreground">{uc}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Comments section */}
            {(!isSub || subscriberUnlocked) && (
              <CommentsSection
                contentId={item.id}
                contentTitle={item.title}
                commentCount={(item as any).comment_count ?? 0}
                isEligible={isEligible}
              />
            )}

            {/* Version History */}
            {(!isSub || subscriberUnlocked) && (
              <VersionHistory contentId={item.id} currentVersion={item.current_version} />
            )}
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block space-y-4">
            <div className="border border-border rounded-xl p-5 bg-card space-y-3">
              {isSub && !subscriberUnlocked ? (
                <>
                  <Button size="lg" className="w-full" disabled>
                    <Lock className="mr-2 h-4 w-4" /> Subscribers only
                  </Button>
                  {creator && (
                    <Button variant="outline" size="sm" className="w-full border-secondary text-secondary hover:bg-secondary/10" asChild>
                      <Link to={`/creator/${creator.username}`}>
                        <Users className="mr-2 h-3.5 w-3.5" /> Subscribe to unlock
                      </Link>
                    </Button>
                  )}
                </>
              ) : (
                <Button size="lg" className="w-full" onClick={handleDownload} disabled={downloading}>
                  {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isPaid ? <Lock className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
                  {subscriberUnlocked ? "Download" : label}
                </Button>
              )}

              {/* Add to Library */}
              <AddToLibraryButton
                contentId={item.id}
                currentVersion={item.current_version}
                contentTitle={item.title}
                variant="full"
              />

              {/* Bookmark + Collection buttons */}
              <div className="flex justify-center gap-2">
                <BookmarkButton contentId={item.id} />
                <AddToCollectionButton contentId={item.id} contentTitle={item.title} />
              </div>
              {isPaid && (
                <p className="text-[11px] text-muted-foreground text-center">£{(item.price_gbp ?? 0).toFixed(2)} — one-time payment</p>
              )}

              {/* Star Rating — below download button, above creator card */}
              <div className="pt-2 border-t border-border">
                <StarRating
                  contentId={item.id}
                  contentTitle={item.title}
                  avgRating={Number((item as any).avg_rating) || 0}
                  ratingCount={(item as any).rating_count ?? 0}
                  isEligible={isEligible}
                />
              </div>

              {item.donation_enabled && creator && (
                <TipSelector
                  creatorId={creator.id}
                  creatorDisplayName={creator.display_name || creator.username}
                  successUrl={`${window.location.origin}/content/${item.id}?tip=success`}
                  cancelUrl={`${window.location.origin}/content/${item.id}`}
                />
              )}

              {/* Fork button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs text-muted-foreground border-border hover:text-foreground"
                      onClick={() => {
                        if (!isLoggedIn) { window.location.href = "/signup"; return; }
                        setForkModalOpen(true);
                      }}
                    >
                      <GitFork className="h-3.5 w-3.5 mr-1" /> Fork this ↗
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Clone to your drafts and make it your own</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {creator && (
              <Link
                to={`/creator/${creator.username}`}
                className="block border border-border rounded-xl p-5 bg-card hover:border-primary/30 transition-colors"
              >
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Created by</p>
                <p className="text-sm font-semibold text-foreground">{creator.display_name || creator.username}</p>
                {creator.bio && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{creator.bio}</p>}
                {creatorStats && (
                  <div className="flex gap-3 mt-3 text-xs text-muted-foreground">
                    <span>{creatorStats.totalItems} published</span>
                    <span>{creatorStats.totalDownloads.toLocaleString()} downloads</span>
                  </div>
                )}
              </Link>
            )}
          </div>
        </div>

        {/* Mobile sticky bar */}
        <div className="fixed bottom-0 left-0 right-0 lg:hidden border-t border-border bg-background p-4 z-30">
          {isSub && !subscriberUnlocked ? (
            <Button size="lg" className="w-full" disabled>
              <Lock className="mr-2 h-4 w-4" /> Subscribers only
            </Button>
          ) : (
            <div className="space-y-2">
              <Button size="lg" className="w-full" onClick={handleDownload} disabled={downloading}>
                {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isPaid ? <Lock className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}
                {subscriberUnlocked ? "Download" : label}
              </Button>
              {item.donation_enabled && creator && (
                <TipSelector
                  creatorId={creator.id}
                  creatorDisplayName={creator.display_name || creator.username}
                  successUrl={`${window.location.origin}/content/${item.id}?tip=success`}
                  cancelUrl={`${window.location.origin}/content/${item.id}`}
                />
              )}
            </div>
          )}
        </div>

        {/* Related content */}
        {related && related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-semibold text-foreground mb-4">Related Content</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 lg:grid lg:grid-cols-3 lg:overflow-visible scrollbar-hide">
              {related.map((r) => (
                <div key={r.id} className="min-w-[280px] lg:min-w-0">
                  <ContentCard
                    id={r.id}
                    content_type={r.content_type}
                    title={r.title}
                    description={r.description ?? ""}
                    difficulty={r.difficulty}
                    ai_tools={r.ai_tools ?? []}
                    download_count={r.download_count}
                    monetisation_type={r.monetisation_type}
                    price_gbp={r.price_gbp ?? undefined}
                    avg_rating={Number((r as any).avg_rating) || 0}
                    rating_count={(r as any).rating_count ?? 0}
                    view_count={(r as any).view_count ?? 0}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
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

      {/* Forks list modal */}
      <Dialog open={forksModalOpen} onOpenChange={setForksModalOpen}>
        <DialogContent className="bg-card border-border sm:max-w-sm">
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
    </div>
  );
};

export default ContentDetail;
