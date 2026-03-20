import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ApprovedTool {
  tag: string;
  slug: string;
  description: string | null;
  url: string | null;
  category: string | null;
  is_official: boolean;
}

export function useApprovedTools() {
  return useQuery({
    queryKey: ["approved_ai_tools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_tools_registry" as any)
        .select("tag, name, slug, description, url, website_url, category, is_official")
        .eq("status", "approved")
        .order("category")
        .order("tag");
      if (error) throw error;
      // Normalise: use tag if set, fallback to name; use url if set, fallback to website_url
      return ((data as any[]) ?? []).map((row) => ({
        tag: row.tag || row.name,
        slug: row.slug,
        description: row.description,
        url: row.url || row.website_url,
        category: row.category,
        is_official: row.is_official,
      })) as ApprovedTool[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

/** Convenience: just the tag names list for checkboxes/filters */
export function useApprovedToolNames() {
  const query = useApprovedTools();
  return {
    ...query,
    data: query.data?.map((t) => t.tag) ?? [],
  };
}

/** Tools grouped by category for sectioned display */
export function useGroupedApprovedTools() {
  const query = useApprovedTools();

  const groups: { label: string; category: string; tools: ApprovedTool[] }[] = [];
  if (query.data) {
    const apiTools = query.data.filter((t) => t.category === "api");
    const localTools = query.data.filter((t) => t.category === "local_runtime");
    const automationTools = query.data.filter((t) => t.category === "automation");
    const otherTools = query.data.filter((t) => !t.category || (t.category !== "api" && t.category !== "local_runtime" && t.category !== "automation"));

    if (apiTools.length > 0) groups.push({ label: "AI Tools", category: "api", tools: apiTools });
    if (localTools.length > 0) groups.push({ label: "Local Runtimes", category: "local_runtime", tools: localTools });
    if (automationTools.length > 0) groups.push({ label: "Automation", category: "automation", tools: automationTools });
    if (otherTools.length > 0) groups.push({ label: "Other", category: "other", tools: otherTools });
  }

  return { ...query, groups };
}
