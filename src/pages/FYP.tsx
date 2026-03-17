import { useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Star, StarHalf, Loader2, Users } from "lucide-react";

const PAGE_SIZE = 50;

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

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`h-3 w-3 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
      ))}
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function interactionLabel(type: string, meta: any): string {
  switch (type) {
    case "downloaded": return "downloaded";
    case "rated": return `rated ★${meta?.rating ?? "?"}`;
    case "commented": return "commented on";
    case "bookmarked": return "saved";
    case "added_to_collection": return `added to ${meta?.collection_title ?? "a collection"}:`;
    default: return type;
  }
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

interface FeedItem {
  id: string;
  interaction_type: string;
  interaction_meta: any;
  created_at: string;
  actor_display_name: string | null;
  actor_username: string | null;
  content_id: string;
  content_title: string;
  content_description: string | null;
  content_type: string;
  content_difficulty: string;
  content_avg_rating: number;
  content_rating_count: number;
  content_download_count: number;
  content_creator_display_name: string | null;
  content_creator_username: string | null;
}

export default function FYPPage() {
  const { isLoggedIn, user } = useAuth();

  // Check if user follows anyone
  const { data: followingIds } = useQuery({
    queryKey: ["fyp_following", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user!.id);
      return (data ?? []).map((r) => r.following_id);
    },
    enabled: !!user,
  });

  const hasFollowing = (followingIds?.length ?? 0) > 0;

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading,
  } = useInfiniteQuery({
    queryKey: ["fyp_feed", user?.id, followingIds],
    queryFn: async ({ pageParam = 0 }) => {
      if (!followingIds || followingIds.length === 0) return [];

      // Fetch interactions from people user follows
      const { data: interactions, error } = await supabase
        .from("user_interactions" as any)
        .select("id, user_id, content_id, interaction_type, interaction_meta, created_at")
        .in("user_id", followingIds)
        .in("interaction_type", ["downloaded", "rated", "commented", "bookmarked"])
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (error) throw error;
      const rows = (interactions as any[]) ?? [];
      if (rows.length === 0) return [];

      // Deduplicate: keep only most recent per user_id+content_id
      const seen = new Map<string, any>();
      for (const r of rows) {
        const key = `${r.user_id}__${r.content_id}`;
        if (!seen.has(key)) seen.set(key, r);
      }
      const deduped = Array.from(seen.values());

      // Fetch content details
      const contentIds = [...new Set(deduped.map((r: any) => r.content_id))];
      const { data: contents } = await supabase
        .from("content_items")
        .select("id, title, description, content_type, difficulty, avg_rating, rating_count, download_count, profiles!content_items_creator_id_fkey(display_name, username)")
        .in("id", contentIds)
        .eq("status", "approved");

      const contentMap = new Map((contents ?? []).map((c: any) => [c.id, c]));

      // Fetch actor profiles
      const actorIds = [...new Set(deduped.map((r: any) => r.user_id))];
      const { data: actors } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .in("id", actorIds);

      const actorMap = new Map((actors ?? []).map((a) => [a.id, a]));

      return deduped
        .map((r: any): FeedItem | null => {
          const content = contentMap.get(r.content_id);
          if (!content) return null;
          const actor = actorMap.get(r.user_id);
          const cp = (content as any).profiles as any;
          return {
            id: r.id,
            interaction_type: r.interaction_type,
            interaction_meta: r.interaction_meta,
            created_at: r.created_at,
            actor_display_name: actor?.display_name ?? null,
            actor_username: actor?.username ?? null,
            content_id: r.content_id,
            content_title: (content as any).title,
            content_description: (content as any).description,
            content_type: (content as any).content_type,
            content_difficulty: (content as any).difficulty,
            content_avg_rating: Number((content as any).avg_rating) || 0,
            content_rating_count: (content as any).rating_count ?? 0,
            content_download_count: (content as any).download_count ?? 0,
            content_creator_display_name: cp?.display_name ?? null,
            content_creator_username: cp?.username ?? null,
          };
        })
        .filter(Boolean) as FeedItem[];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
    initialPageParam: 0,
    enabled: !!user && hasFollowing,
  });

  const feedItems = data?.pages.flat() ?? [];

  // ─── Not logged in ────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="py-20 px-6 flex flex-col items-center gap-4 text-center">
        <SeoHead title="For You — NeoScale AI" description="Your personalised feed" path="/fyp" noIndex />
        <h1 className="text-2xl font-bold text-foreground">Sign in to see your personalised feed.</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          Follow creators and see what they download, rate, and comment on.
        </p>
        <div className="flex gap-3 mt-2">
          <Button asChild><Link to="/login">Sign in</Link></Button>
          <Button variant="outline" asChild><Link to="/signup">Create account</Link></Button>
        </div>
      </div>
    );
  }

  // ─── Follows nobody ───────────────────────────────────
  if (!hasFollowing && !isLoading) {
    return (
      <div className="py-20 px-6 flex flex-col items-center gap-4 text-center">
        <SeoHead title="For You — NeoScale AI" description="Your personalised feed" path="/fyp" noIndex />
        <Users className="h-10 w-10 text-muted-foreground" />
        <h1 className="text-2xl font-bold text-foreground">For You</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          You are not following anyone yet. Follow some creators to see what they're up to.
        </p>
        <Button asChild><Link to="/browse">Discover creators</Link></Button>
      </div>
    );
  }

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6">
      <SeoHead title="For You — NeoScale AI" description="Your personalised feed" path="/fyp" noIndex />
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">For You</h1>
          <p className="text-sm text-muted-foreground mt-1">What the people you follow are doing</p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-20 bg-card rounded-xl animate-pulse" />)}
          </div>
        ) : feedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            No recent activity from people you follow.
          </p>
        ) : (
          <div className="space-y-4">
            {feedItems.map((item) => {
              const starVal = roundedStars(item.content_avg_rating, item.content_rating_count);

              return (
                <div key={item.id} className="border border-border rounded-xl bg-card p-4">
                  {/* Top line: actor + action + time */}
                  <div className="flex items-center gap-2 mb-3">
                    <Link
                      to={`/creator/${item.actor_username}`}
                      className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0"
                    >
                      <span className="text-[10px] font-bold text-primary">
                        {getInitials(item.actor_display_name || item.actor_username)}
                      </span>
                    </Link>
                    <div className="flex-1 min-w-0 text-sm">
                      <Link to={`/creator/${item.actor_username}`} className="font-medium text-foreground hover:underline">
                        {item.actor_display_name || item.actor_username || "Someone"}
                      </Link>
                      {" "}
                      <span className="text-muted-foreground">{interactionLabel(item.interaction_type, item.interaction_meta)}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo(item.created_at)}</span>
                  </div>

                  {/* Content card */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge variant="outline" className={`text-[9px] font-medium ${TYPE_COLORS[item.content_type] ?? TYPE_COLORS["Failure Library"]}`}>
                          {item.content_type}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold text-foreground truncate">{item.content_title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        by {item.content_creator_display_name || item.content_creator_username || "Unknown"}
                      </p>
                    </div>

                    <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0 text-[10px] text-muted-foreground">
                      {item.content_rating_count > 0 && <MiniStars value={starVal} />}
                      <span className="flex items-center gap-0.5"><Download className="h-2.5 w-2.5" />{item.content_download_count}</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <BookmarkButton contentId={item.content_id} />
                      <Button variant="outline" size="sm" className="border-secondary text-secondary hover:bg-secondary/10 text-xs h-8" asChild>
                        <Link to={`/content/${item.content_id}`}>View</Link>
                      </Button>
                    </div>
                  </div>

                  {/* Comment quote */}
                  {item.interaction_type === "commented" && item.interaction_meta?.comment_id && (
                    <div className="mt-3 pl-3 border-l-2 border-border">
                      <p className="text-xs text-muted-foreground italic">
                        {(item.interaction_meta?.content_title ?? "").slice(0, 120)}
                        {(item.interaction_meta?.content_title ?? "").length > 120 ? "…" : ""}
                      </p>
                    </div>
                  )}

                  {/* Rating display */}
                  {item.interaction_type === "rated" && item.interaction_meta?.rating && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Gave it</span>
                      <RatingStars rating={item.interaction_meta.rating} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {hasNextPage && (
          <div className="flex justify-center mt-8">
            <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
              {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Load more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
