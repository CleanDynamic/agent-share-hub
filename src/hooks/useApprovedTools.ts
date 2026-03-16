import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useApprovedTools() {
  return useQuery({
    queryKey: ["approved_ai_tools"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_tools_registry" as any)
        .select("name")
        .eq("status", "approved")
        .order("name");
      if (error) throw error;
      return (data as any[]).map((row) => row.name as string);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
