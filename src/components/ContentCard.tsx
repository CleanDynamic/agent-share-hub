import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Lock, Loader2, Eye, Star, StarHalf, GitFork, Link2, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CompatibilityBadge } from "@/components/CompatibilityBadge";
import { formatDistanceToNow } from "date-fns";
import { getDownloadLabel, triggerDownload } from "@/lib/download";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BookmarkButton } from "@/components/BookmarkButton";
import { AddToCollectionButton } from "@/components/AddToCollectionButton";
import { AddToLibraryButton } from "@/components/AddToLibraryButton";
import { GuestDownloadModal } from "@/components/GuestDownloadModal";
import { AccountGateModal } from "@/components/AccountGateModal";
import { useAuth } from "@/contexts/AuthContext";

export interface ContentCardProps {
  id: string;
  content_type: string;
  title: string;
  description: string;
  difficulty: string;
  ai_tools: string[];
  download_count: number;
  monetisation_type: string;
  price_gbp?: number;
  file_url?: string | null;
  creator_username?: string;
  avg_rating?: number;
  rating_count?: number;
  view_count?: number;
  is_fork?: boolean;
  has_preview?: boolean;
  dependency_count?: number;
  dependency_titles?: string[];
  compatibility_status?: string | null;
  last_verified_at?: string | null;
  creator_id?: string;
  last_changelog_at?: string | null;
  is_pwyw?: boolean;
  pwyw_avg_paid_gbp?: number;
  pwyw_purchase_count?: number;
  pwyw_floor_gbp?: number;
  collaborators?: { id: string; display_name: string | null; username: string | null; avatar_url: string | null; is_primary_author: boolean }[];
}

function roundedStars(avg: number, count: number): number {
  if (count === 0) return 0;
  if (avg >= 4.5) return 5;
  if (avg >= 4.1) return 4.5;
  if (avg >= 3.5) return 4;
  if (avg >= 3.1) return 3.5;
  if (avg >= 2.5) return 3;
  if (avg >= 2.1) return 2.5;
  if (avg >= 1.5) return 2;
  if (avg >= 1.1) return 1.5;
  return 1;
}

function MiniStars({ value }: { value: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(value)) stars.push(<Star key={i} className="h-3 w-3 fill-primary text-primary" />);
    else if (i - 0.5 === value) stars.push(<StarHalf key={i} className="h-3 w-3 fill-primary text-primary" />);
    else stars.push(<Star key={i} className="h-3 w-3 text-muted-foreground/30" />);
  }
  return <div className="flex gap-0.5">{stars}</div>;
}

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
    case "Beginner":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "Intermediate":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "Advanced":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function ContentCard({
  id,
  content_type,
  title,
  description,
  difficulty,
  ai_tools,
  download_count: initialCount,
  monetisation_type,
  price_gbp,
  file_url,
  creator_username,
  avg_rating = 0,
  rating_count = 0,
  view_count = 0,
  is_fork = false,
  has_preview = false,
  dependency_count = 0,
  dependency_titles = [],
  compatibility_status = null,
  last_verified_at = null,
  creator_id,
  last_changelog_at = null,
  is_pwyw = false,
  pwyw_avg_paid_gbp = 0,
  pwyw_purchase_count = 0,
  pwyw_floor_gbp = 0,
  collaborators = [],
}: ContentCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isLoggedIn } = useAuth();
  const [count, setCount] = useState(initialCount);
  const [downloading, setDownloading] = useState(false);
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [accountGateOpen, setAccountGateOpen] = useState(false);
  const isPaid = monetisation_type === "paid";
  const isSub = monetisation_type === "subscription";
  const label = getDownloadLabel(content_type, monetisation_type, price_gbp);

  async function doDownload() {
    setDownloading(true);
    const result = await triggerDownload(id, file_url ?? null);
    if (result.error) {
      toast({ title: "Download failed", description: result.error, variant: "destructive" });
    } else if (result.newCount !== undefined) {
      setCount(result.newCount);
    }
    setDownloading(false);
  }

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();

    if (isSub) {
      navigate(`/content/${id}`);
      return;
    }

    if (isPaid) {
      if (!isLoggedIn) {
        setAccountGateOpen(true);
        return;
      }
      setDownloading(true);
      try {
        const priceInPence = Math.round((price_gbp ?? 0) * 100);
        const { data, error } = await supabase.functions.invoke("create-checkout-session", {
          body: {
            content_id: id,
            price_amount: priceInPence,
            success_url: `${window.location.origin}/content/${id}?payment=success`,
            cancel_url: `${window.location.origin}/content/${id}`,
          },
        });
        if (error || !data?.url) {
          toast({ title: "Checkout failed", description: "Could not start payment. Please try again.", variant: "destructive" });
        } else {
          window.location.href = data.url;
        }
      } catch {
        toast({ title: "Checkout failed", description: "Something went wrong.", variant: "destructive" });
      }
      setDownloading(false);
      return;
    }

    // Free content
    if (!isLoggedIn) {
      setGuestModalOpen(true);
      return;
    }

    await doDownload();
  }

  return (
    <>
      <div
        onClick={() => navigate(`/content/${id}`)}
        className="relative w-full text-left border border-border rounded-xl p-5 bg-card hover:border-primary/40 transition-colors flex flex-col group cursor-pointer"
      >
        {/* Actions — library + bookmark + collection */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 min-h-[44px]">
          <AddToLibraryButton contentId={id} contentTitle={title} />
          <AddToCollectionButton contentId={id} contentTitle={title} />
          <BookmarkButton contentId={id} />
        </div>
        {/* Top row */}
        <div className="flex items-start justify-between mb-3 pr-6">
          <Badge
            variant="outline"
            className={`text-[10px] font-medium ${TYPE_COLORS[content_type] ?? TYPE_COLORS["Failure Library"]}`}
          >
            {content_type}
          </Badge>
        {isSub ? (
            <Badge variant="outline" className="text-[10px] font-medium bg-secondary/15 text-secondary border-secondary/30">
              Subscribers only
            </Badge>
          ) : is_pwyw ? (
            <Badge variant="outline" className="text-[10px] font-medium bg-[#2EC4B6]/15 text-[#2EC4B6] border-[#2EC4B6]/30">
              Pay what you want
            </Badge>
          ) : isPaid ? (
            <Badge variant="outline" className="text-[10px] font-medium bg-orange-500/15 text-orange-400 border-orange-500/30">
              £{(price_gbp ?? 0).toFixed(2)}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] font-medium bg-secondary/15 text-secondary border-secondary/30">
              Free
            </Badge>
          )}
        </div>

        {/* Collaborator avatars */}
        {collaborators.length > 1 && (
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex -space-x-2">
              {collaborators.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  className="h-5 w-5 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[8px] font-medium text-muted-foreground overflow-hidden"
                  onClick={(e) => { e.stopPropagation(); window.location.href = `/creator/${c.username}`; }}
                >
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (c.display_name || c.username || "?")[0].toUpperCase()
                  )}
                </div>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {collaborators.find(c => c.is_primary_author)?.display_name || collaborators[0]?.display_name}
              {collaborators.length === 2
                ? ` + ${collaborators.find(c => !c.is_primary_author)?.display_name || "1 other"}`
                : ` + ${collaborators.length - 1} others`}
            </span>
          </div>
        )}

        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors mb-1 flex items-center gap-1.5">
          {title}
          {is_fork && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-normal">
              <GitFork className="h-2.5 w-2.5" /> Fork
            </span>
          )}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed mb-1 flex-1">{description}</p>
        {is_pwyw && (
          <p className="text-[10px] text-muted-foreground mb-0.5">
            {pwyw_purchase_count && pwyw_purchase_count > 0
              ? `avg. £${(pwyw_avg_paid_gbp ?? 0).toFixed(2)}`
              : "Be the first to pay"}
            {(pwyw_floor_gbp ?? 0) > 0 && ` · min. £${(pwyw_floor_gbp ?? 0).toFixed(2)}`}
          </p>
        )}
        {has_preview && (
          <p className="text-[11px] font-medium mb-1" style={{ color: "#2EC4B6" }}>Preview available</p>
        )}
        {last_changelog_at && (
          <p className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            Updated {formatDistanceToNow(new Date(last_changelog_at), { addSuffix: true })}
          </p>
        )}

        {/* AI tools */}
        <div className="flex flex-wrap gap-1 mb-3">
          {ai_tools.map((tool) => (
            <span key={tool} className="text-[10px] px-1.5 py-0.5 rounded-md bg-accent text-muted-foreground">
              {tool}
            </span>
          ))}
        </div>

        {/* Rating + status indicators */}
        <div className="flex items-center gap-1.5 mb-3">
          {rating_count > 0 ? (
            <>
              <MiniStars value={roundedStars(avg_rating, rating_count)} />
              <span className="text-[10px] text-muted-foreground">({rating_count})</span>
            </>
          ) : (
            <span className="text-[10px] text-muted-foreground">No ratings</span>
          )}
        </div>

        {/* Deps + Compatibility indicators */}
        <div className="flex items-center gap-2 mb-3">
          {dependency_count > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground cursor-default" onClick={e => e.stopPropagation()}>
                    <Link2 className="h-2.5 w-2.5" /> Deps: {dependency_count}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">{dependency_titles.join(", ") || "Has dependencies"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {compatibility_status && compatibility_status !== "unverified" && (
            <CompatibilityBadge
              contentId={id}
              creatorId={creator_id ?? ""}
              compatibilityStatus={compatibility_status}
              lastVerifiedAt={last_verified_at}
              variant="card"
            />
          )}
        </div>

        {/* Bottom */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <Badge variant="outline" className={`text-[10px] font-medium ${difficultyColor(difficulty)}`}>
            {difficulty}
          </Badge>
          <div className="flex items-center gap-2">
            {!isSub && (
              <div className="flex items-center gap-2 text-muted-foreground text-[10px]">
                <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{view_count.toLocaleString()}</span>
                <span>·</span>
                <span className="flex items-center gap-0.5"><Download className="h-3 w-3" />{count.toLocaleString()}</span>
              </div>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-primary hover:text-primary h-7 px-2"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isSub ? (
                <><Lock className="h-3 w-3 mr-1" />Subscribers only</>
              ) : isPaid ? (
                <><Lock className="h-3 w-3 mr-1" />{label}</>
              ) : (
                label
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Guest ad modal for free content */}
      <GuestDownloadModal
        open={guestModalOpen}
        onOpenChange={setGuestModalOpen}
        contentId={id}
        onDownload={doDownload}
      />

      {/* Account gate for paid content */}
      <AccountGateModal
        open={accountGateOpen}
        onOpenChange={setAccountGateOpen}
        contentId={id}
        mode="purchase"
      />
    </>
  );
}
