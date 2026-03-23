import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { FeedItem } from "@/components/FeedItem";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const PAGE_SIZE = 20;
const ALL = "__all__";

const CONTENT_TYPES = [
  "Prompt File", "Agent Blueprint", "Workflow Template",
  "Agent Stack", "Model Config Guide", "Integration Guide", "Evaluation Framework", "Failure Library",
];

const TIME_RANGES = [
  { label: "Last 24h", value: "24h" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "All time", value: "all" },
];

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
        .select("id, title, description, content_type, difficulty, ai_tools, avg_rating, rating_count, download_count, view_count, comment_count, cover_image_url, created_at, what_to_expect_blocks, what_to_expect, other_tool_name, custom_tags, profiles!content_items_creator_id_fkey(display_name, username)")
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
          <div className="space-y-0">
            {[1, 2, 3, 4, 5].map((n) => <div key={n} className="h-24 bg-card rounded-xl animate-pulse" />)}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No content found for the selected filters.</p>
        ) : (
          <div>
            {items.map((item: any) => <FeedItem key={item.id} item={item} />)}
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
