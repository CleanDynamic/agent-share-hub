import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function fmtCount(n: number | null | undefined): string {
  if (!n) return "0";
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  if (n < 1_000_000) return Math.round(n / 1000) + "k";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}

/**
 * Counts for the three search-mode tabs.
 * - blueprints: all approved content_items
 * - stages: total stage_count across approved items
 * - blocks: rows in content_blocks for approved items
 */
export function useDiscoverCounts() {
  return useQuery({
    queryKey: ["discover_counts"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const blueprintsP = supabase
        .from("content_items")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved");

      const stagesP = supabase
        .from("content_items")
        .select("stage_count")
        .eq("status", "approved");

      const blocksP = supabase
        .from("content_blocks")
        .select("id", { count: "exact", head: true });

      const [bp, st, bl] = await Promise.all([blueprintsP, stagesP, blocksP]);

      const blueprintsCount = bp.count ?? 0;
      const stagesCount = (st.data ?? []).reduce(
        (sum, r: any) => sum + (Number(r.stage_count) || 0),
        0,
      );
      const blocksCount = bl.count ?? 0;

      return {
        blueprints: fmtCount(blueprintsCount),
        stages: fmtCount(stagesCount),
        blocks: fmtCount(blocksCount),
        raw: {
          blueprints: blueprintsCount,
          stages: stagesCount,
          blocks: blocksCount,
        },
      };
    },
  });
}

/** Top N most-frequent values from an array column on content_items. */
async function fetchTopArrayValues(
  column: "models_referenced" | "tools_referenced" | "tags",
  limit = 30,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("content_items")
    .select(column)
    .eq("status", "approved")
    .limit(2000);

  if (error || !data) return [];

  const counts = new Map<string, number>();
  for (const row of data as any[]) {
    const arr = row[column] as string[] | null;
    if (!Array.isArray(arr)) continue;
    for (const v of arr) {
      if (!v) continue;
      const key = String(v).trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

export function useDiscoverModelOptions() {
  return useQuery({
    queryKey: ["discover_options", "models"],
    queryFn: () => fetchTopArrayValues("models_referenced", 30),
    staleTime: 10 * 60 * 1000,
  });
}

export function useDiscoverToolOptions() {
  return useQuery({
    queryKey: ["discover_options", "tools"],
    queryFn: () => fetchTopArrayValues("tools_referenced", 30),
    staleTime: 10 * 60 * 1000,
  });
}

export function useDiscoverTagSuggestions() {
  return useQuery({
    queryKey: ["discover_options", "tags"],
    queryFn: () => fetchTopArrayValues("tags", 50),
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Live preview of how many results would match the current in-progress
 * filter selection. Approximate — uses overlap operators for array filters.
 */
export function useDiscoverResultCount(params: {
  q: string;
  postTypes: string[];
  blockTypes: string[];
  models: string[];
  tools: string[];
  domain: string | null;
  tags: string[];
  difficulty: string | null;
  timeRange: string | null;
}) {
  return useQuery({
    queryKey: ["discover_result_count", params],
    staleTime: 30 * 1000,
    queryFn: async () => {
      let q: any = supabase
        .from("content_items")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved");

      if (params.q) q = q.ilike("title", `%${params.q}%`);
      if (params.postTypes.length) {
        q = q.in(
          "post_type",
          params.postTypes.map((p) => p.toLowerCase()),
        );
      }
      if (params.models.length)
        q = q.overlaps("models_referenced", params.models);
      if (params.tools.length)
        q = q.overlaps("tools_referenced", params.tools);
      if (params.tags.length) q = q.overlaps("tags", params.tags);
      if (params.domain) q = q.eq("domain" as any, params.domain.toLowerCase());
      if (params.difficulty)
        q = q.eq("difficulty" as any, params.difficulty.toLowerCase());

      if (params.timeRange) {
        const now = Date.now();
        const days =
          params.timeRange === "Past 24h"
            ? 1
            : params.timeRange === "Past week"
              ? 7
              : params.timeRange === "Past month"
                ? 30
                : params.timeRange === "Past 3 months"
                  ? 90
                  : null;
        if (days) {
          const since = new Date(now - days * 86_400_000).toISOString();
          q = q.gte("created_at", since);
        }
      }

      const { count, error } = await q;
      if (error) return 0;
      return count ?? 0;
    },
  });
}
