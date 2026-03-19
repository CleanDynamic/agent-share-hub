import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ApprovedTool {
  name: string;
  slug: string;
  description: string | null;
  website_url: string | null;
  category: string | null;
  is_official: boolean;
}

export function useApprovedTools() {
  return useQuery({
    queryKey: ["approved_ai_tools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_tools_registry" as any)
        .select("name, slug, description, website_url, category, is_official")
        .eq("status", "approved")
        .order("is_official", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data as any[]) as ApprovedTool[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

/** Convenience: just the names list for checkboxes/filters */
export function useApprovedToolNames() {
  const query = useApprovedTools();
  return {
    ...query,
    data: query.data?.map((t) => t.name) ?? [],
  };
}

/** Tools grouped by category for sectioned display */
export function useGroupedApprovedTools() {
  const query = useApprovedTools();

  const groups: { label: string; category: string; tools: ApprovedTool[] }[] = [];
  if (query.data) {
    const apiTools = query.data.filter((t) => !t.category || t.category === "api" || t.category === "other");
    const localTools = query.data.filter((t) => t.category === "local_runtime");
    const automationTools = query.data.filter((t) => t.category === "automation");

    if (apiTools.length > 0) groups.push({ label: "API Tools", category: "api", tools: apiTools });
    if (localTools.length > 0) groups.push({ label: "Local Runtimes", category: "local_runtime", tools: localTools });
    if (automationTools.length > 0) groups.push({ label: "Automation", category: "automation", tools: automationTools });
  }

  return { ...query, groups };
}
