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
    staleTime: 10 * 60 * 1000, // 10 minutes — cached per session
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
