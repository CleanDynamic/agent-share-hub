import { useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, Eye, Star, StarHalf, Loader2 } from "lucide-react";

const PAGE_SIZE = 20;
const ALL = "__all__";

const CONTENT_TYPES = [
  "Prompt File", "Prompt Tutorial", "Agent Blueprint", "Workflow Template",
  "Agent Stack", "Model Config Guide", "Integration Guide", "Evaluation Framework", "Failure Library",
];

const TIME_RANGES = [
  { label: "Last 24h", value: "24h" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "All time", value: "all" },
];

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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days !== 1 ? "s" : ""} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? "s" : ""} ago`;
}

function getTimeFilter(range: string): string | null {
  const now = Date.now();
  if (range === "24h") return new Date(now - 24 * 60 * 60 * 1000).toISOString();
  if (range === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (range === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  return null;
}

export default function RecentPage() {
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [timeRange, setTimeRange] = useState("all");

  const {
    data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading,
  } = useInfiniteQuery({
    queryKey: ["recent_content", typeFilter, timeRange],
    queryFn: async ({ pageParam = 0 }) => {
      let q = supabase
        .from("content_items")
        .select("id, title, description, content_type, difficulty, ai_tools, avg_rating, rating_count, download_count, view_count, created_at, profiles!content_items_creator_id_fkey(display_name, username)")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (typeFilter !== ALL) q = q.eq("content_type", typeFilter);
      const minDate = getTimeFilter(timeRange);
      if (minDate) q = q.gte("created_at", minDate);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
    initialPageParam: 0,
  });

  const items = data?.pages.flat() ?? [];

  return (
    <div className="py-8 sm:py-12 px-4 sm:px-6">
      <SeoHead title="Recently Uploaded — NeoScale AI" description="The latest content from the NeoScale AI community" path="/recent" />
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="relative flex h-[6px] w-[6px]">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-primary" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Recently Uploaded</h1>
            <span className="text-xs text-muted-foreground ml-1">Updated live</span>
          </div>
          <p className="text-sm text-muted-foreground">The latest content from the NeoScale AI community</p>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-card border-border">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value={ALL}>All types</SelectItem>
              {CONTENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex gap-1.5 flex-wrap">
            {TIME_RANGES.map((tr) => (
              <button
                key={tr.value}
                onClick={() => setTimeRange(tr.value)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  timeRange === tr.value
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {tr.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feed */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-16 bg-card rounded-xl animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No content found for the selected filters.</p>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item: any) => {
              const tools = item.ai_tools ?? [];
              const displayTools = tools.slice(0, 3);
              const moreCount = tools.length - 3;
              const starVal = roundedStars(Number(item.avg_rating) || 0, item.rating_count ?? 0);
              const profile = item.profiles as any;

              return (
                <div key={item.id} className="flex items-center gap-3 sm:gap-4 py-4">
                  {/* Time ago */}
                  <span className="text-[10px] sm:text-xs text-muted-foreground w-16 sm:w-24 flex-shrink-0 text-right">
                    {timeAgo(item.created_at)}
                  </span>

                  {/* Badges */}
                  <div className="hidden sm:flex flex-col gap-1 flex-shrink-0 w-28">
                    <Badge variant="outline" className={`text-[10px] font-medium w-fit ${TYPE_COLORS[item.content_type] ?? TYPE_COLORS["Failure Library"]}`}>
                      {item.content_type}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] font-medium w-fit ${difficultyColor(item.difficulty)}`}>
                      {item.difficulty}
                    </Badge>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="sm:hidden flex flex-wrap gap-1 mb-1">
                      <Badge variant="outline" className={`text-[9px] font-medium ${TYPE_COLORS[item.content_type] ?? TYPE_COLORS["Failure Library"]}`}>
                        {item.content_type}
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      by{" "}
                      <Link to={`/creator/${profile?.username}`} className="hover:text-foreground">
                        {profile?.display_name || profile?.username || "Unknown"}
                      </Link>
                    </p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground truncate hidden sm:block mt-0.5">{item.description}</p>
                    )}
                  </div>

                  {/* AI tools */}
                  <div className="hidden lg:flex flex-wrap gap-1 flex-shrink-0 max-w-[160px]">
                    {displayTools.map((t: string) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{t}</span>
                    ))}
                    {moreCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">+{moreCount}</span>}
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0 text-[10px] text-muted-foreground">
                    {(item.rating_count ?? 0) > 0 ? (
                      <>
                        <MiniStars value={starVal} />
                        <span>{item.rating_count} ratings</span>
                      </>
                    ) : (
                      <span>No ratings</span>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-0.5"><Download className="h-2.5 w-2.5" />{item.download_count}</span>
                      <span className="flex items-center gap-0.5"><Eye className="h-2.5 w-2.5" />{item.view_count ?? 0}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <BookmarkButton contentId={item.id} />
                    <Button variant="outline" size="sm" className="border-secondary text-secondary hover:bg-secondary/10 text-xs h-8" asChild>
                      <Link to={`/content/${item.id}`}>View</Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load more */}
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
