import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * useRightRailData
 *
 * Shared data layer for the desktop right rail and the mobile/tablet
 * RightRailDrawer. Returns lightweight collections only — sections that
 * have no data simply render empty. Errors are swallowed (best-effort).
 */
export interface BrowseItem { label: string; path: string }
export interface TrendingItem { id: string; title: string; author: string; referenceCount: number }
export interface CuratorPick { id: string; title: string; author: string; description?: string }
export interface CollectionEntry { id: string; title: string; itemCount: number }
export interface UserToFollow { id: string; name: string; username: string; avatar?: string }

const BROWSE: BrowseItem[] = [
  { label: "Blueprints", path: "blueprint" },
  { label: "Writing", path: "writing" },
  { label: "Community", path: "community" },
  { label: "Bounties", path: "bounties" },
];

export function useRightRailData(enabled = true) {
  const { user, isLoggedIn } = useAuth();

  const trending = useQuery<TrendingItem[]>({
    queryKey: ["rr_trending"],
    enabled,
    staleTime: 120_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("content_items")
        .select("id, title, view_count, profiles!content_items_creator_id_fkey(display_name, username)")
        .eq("status", "published")
        .order("view_count", { ascending: false })
        .limit(5);
      return (data ?? []).map((row: any) => ({
        id: row.id,
        title: row.title ?? "Untitled",
        author: row.profiles?.display_name || row.profiles?.username || "Creator",
        referenceCount: row.view_count ?? 0,
      }));
    },
  });

  const curatorPicks = useQuery<CuratorPick[]>({
    queryKey: ["rr_curator_picks"],
    enabled,
    staleTime: 120_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("curator_recommendations")
        .select(
          "id, recommendation_text, content_items!curator_recommendations_content_id_fkey(id, title), curators!curator_recommendations_curator_id_fkey(profiles:profiles!curators_user_id_fkey(display_name, username))",
        )
        .limit(5);
      return (data ?? []).map((row: any) => ({
        id: row.id,
        title: row.content_items?.title ?? "Untitled",
        author:
          row.curators?.profiles?.display_name ||
          row.curators?.profiles?.username ||
          "Curator",
        description: row.recommendation_text ?? undefined,
      }));
    },
  });

  const collections = useQuery<CollectionEntry[]>({
    queryKey: ["rr_collections"],
    enabled,
    staleTime: 120_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("collections")
        .select("id, title, item_count")
        .eq("visibility", "public")
        .order("item_count", { ascending: false })
        .limit(5);
      return (data ?? []).map((row: any) => ({
        id: row.id,
        title: row.title ?? "Untitled",
        itemCount: row.item_count ?? 0,
      }));
    },
  });

  const whoToFollow = useQuery<UserToFollow[]>({
    queryKey: ["rr_who_to_follow", user?.id],
    enabled: enabled && isLoggedIn && !!user?.id,
    staleTime: 120_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, follower_count")
        .neq("id", user!.id)
        .order("follower_count", { ascending: false })
        .limit(5);
      return (data ?? []).map((row: any) => ({
        id: row.id,
        name: row.display_name || row.username || "Creator",
        username: row.username || "",
        avatar: row.avatar_url || undefined,
      }));
    },
  });

  return {
    browseItems: BROWSE,
    trendingItems: trending.data ?? [],
    curatorPicks: curatorPicks.data ?? [],
    collections: collections.data ?? [],
    whoToFollow: whoToFollow.data ?? [],
    isLoading:
      trending.isLoading || curatorPicks.isLoading ||
      collections.isLoading || whoToFollow.isLoading,
  };
}
