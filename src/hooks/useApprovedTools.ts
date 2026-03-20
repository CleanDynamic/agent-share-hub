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

// "Any Tool" is not stored in the database — it is hardcoded as the first API option
const ANY_TOOL: ApprovedTool = {
  name: "Any Tool",
  slug: "any-tool",
  description: "Universal compatibility — works with any AI tool",
  website_url: null,
  category: "api",
  is_official: true,
};

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

/** Convenience: just the names list for checkboxes/filters. "Any Tool" is prepended. */
export function useApprovedToolNames() {
  const query = useApprovedTools();
  return {
    ...query,
    data: query.data ? [ANY_TOOL.name, ...query.data.map((t) => t.name)] : [],
  };
}

/** Tools grouped by category for sectioned display */
export function useGroupedApprovedTools() {
  const query = useApprovedTools();

  const groups: { label: string; category: string; tools: ApprovedTool[] }[] = [];
  if (query.data) {
    const apiTools = query.data.filter(
      (t) => !t.category || t.category === "api" || t.category === "ai_chat" || t.category === "other"
    );
    const localTools = query.data.filter((t) => t.category === "local_runtime");
    const automationTools = query.data.filter((t) => t.category === "automation");

    // Always prepend "Any Tool" as the first API option
    groups.push({ label: "API Tools", category: "api", tools: [ANY_TOOL, ...apiTools] });
    if (localTools.length > 0) groups.push({ label: "Local Runtimes", category: "local_runtime", tools: localTools });
    if (automationTools.length > 0) groups.push({ label: "Automation", category: "automation", tools: automationTools });
  }

  return { ...query, groups };
}
