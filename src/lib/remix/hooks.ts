import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LineageParentInfo {
  parentId: string;
  authorHandle?: string;
  title?: string;
  deleted: boolean;
}

/** Returns the immediate lineage parent of a post, if any. */
export function useLineageParent(postId: string | null | undefined) {
  return useQuery<LineageParentInfo | null>({
    queryKey: ["remix", "parent", postId],
    enabled: !!postId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: lineage } = await (supabase as any)
        .from("post_lineage")
        .select("parent_post_id")
        .eq("post_id", postId)
        .maybeSingle();
      if (!lineage?.parent_post_id) return null;
      const parentId = lineage.parent_post_id as string;
      const { data: parent } = await (supabase as any)
        .from("content_items")
        .select("id, title, status, creator_id, profiles!content_items_creator_id_fkey(username)")
        .eq("id", parentId)
        .maybeSingle();
      if (!parent) return { parentId, deleted: true };
      const deleted = parent.status === "deleted" || parent.status === "removed";
      const handle = (parent as any).profiles?.username as string | undefined;
      return {
        parentId,
        authorHandle: handle,
        title: parent.title as string,
        deleted,
      };
    },
  });
}

/** Returns the number of direct remixes for a post. */
export function useRemixCount(postId: string | null | undefined) {
  return useQuery<number>({
    queryKey: ["remix", "count", postId],
    enabled: !!postId,
    staleTime: 60_000,
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("post_lineage")
        .select("*", { count: "exact", head: true })
        .eq("parent_post_id", postId);
      return count ?? 0;
    },
  });
}
