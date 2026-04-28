import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch top tags across all approved content_items.
 * Cached for 1 hour — tags don't change frequently.
 */
export function useTagSuggestions(limit = 50) {
  return useQuery({
    queryKey: ["publish_tag_suggestions"],
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("tags, custom_tags")
        .eq("status", "approved")
        .limit(1000);
      if (error) throw error;

      const counts = new Map<string, number>();
      for (const row of data || []) {
        const allTags = [
          ...((row as any).tags || []),
          ...((row as any).custom_tags || []),
        ];
        for (const t of allTags) {
          if (typeof t !== "string") continue;
          const norm = t.trim().toLowerCase();
          if (!norm) continue;
          counts.set(norm, (counts.get(norm) || 0) + 1);
        }
      }
      return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([tag, usageCount]) => ({ tag, usageCount }));
    },
  });
}

/**
 * Live slug availability check.
 * Returns 'idle' | 'checking' | 'available' | 'taken' | 'unsupported'.
 * `unsupported` happens when the slug column doesn't exist yet.
 */
export function useSlugAvailability(slug: string, currentItemId: string | undefined) {
  const [state, setState] = useState<
    "idle" | "checking" | "available" | "taken" | "unsupported"
  >("idle");

  useEffect(() => {
    const trimmed = slug.trim().toLowerCase();
    if (!trimmed || trimmed.length < 3) {
      setState("idle");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(trimmed)) {
      setState("idle");
      return;
    }

    setState("checking");
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        let q = (supabase.from("content_items") as any)
          .select("id", { count: "exact", head: true })
          .eq("slug", trimmed);
        if (currentItemId) q = q.neq("id", currentItemId);
        const { error, count } = await q;
        if (cancelled) return;
        if (error) {
          // Column doesn't exist yet (added in step 2.5). Treat as available.
          setState("unsupported");
          return;
        }
        setState((count ?? 0) > 0 ? "taken" : "available");
      } catch {
        if (!cancelled) setState("unsupported");
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [slug, currentItemId]);

  return state;
}
