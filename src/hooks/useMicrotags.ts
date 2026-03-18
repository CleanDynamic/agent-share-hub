import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MicrotagDef {
  tag: string;
  description: string | null;
}

export function useMicrotagDefinitions() {
  return useQuery({
    queryKey: ["microtag_definitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("microtag_definitions")
        .select("tag, description")
        .order("tag");
      if (error) throw error;
      return (data ?? []) as MicrotagDef[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useContentMicrotags(contentId: string | undefined) {
  return useQuery({
    queryKey: ["content_microtags", contentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_microtags")
        .select("tag")
        .eq("content_id", contentId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.tag);
    },
    enabled: !!contentId,
  });
}
