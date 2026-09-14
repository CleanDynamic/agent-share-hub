"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FeedReblogAdapter, type FeedReblogRow } from "@/components/reblog/FeedReblogAdapter";
import { chipStyle } from "@/lib/theme/controls";
import { t } from "@/lib/theme/tokens";
import { body } from "@/lib/theme/type";

interface Props {
  userId: string;
  activeFilter: string;
  onFilterChange: (f: string) => void;
}

/**
 * Authored zone — Reblogs sub-filter.
 * Fetches the user's reblogs from the reblogs table and renders them
 * via the canonical FeedReblogAdapter (variant="profile-zone").
 */
export function ProfileAuthoredReblogs({ userId, activeFilter, onFilterChange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["profile-authored-reblogs", userId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reblogs")
        .select(`
          id, slug, text, media_kind, media_url, thumbnail_url, created_at,
          like_count, comment_count, reblog_count, bookmark_count,
          parent_reblog_id, root_original_post_id, original_post_id, reblogger_id,
          reblogger:profiles!reblogs_reblogger_id_fkey(id, username, display_name, avatar_url),
          embedded_original:content_items!reblogs_original_post_id_fkey(
            id, slug, title, description, post_type, cover_image_url, created_at, creator_id,
            author:profiles!content_items_creator_id_fkey(username, display_name, avatar_url)
          )
        `)
        .eq("reblogger_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as FeedReblogRow[];
    },
  });

  const chips = [
    { label: "All", value: "all" },
    { label: "Blueprints", value: "blueprint" },
    { label: "Blogs", value: "blog" },
    { label: "Bounties", value: "bounty" },
    { label: "Reblogs", value: "reblog" },
  ];

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-3 overflow-x-auto">
        {chips.map((c) => {
          const active = activeFilter === c.value;
          return (
            <button
              key={c.value}
              onClick={() => onFilterChange(c.value)}
              aria-pressed={active}
              className="px-3 py-1.5 whitespace-nowrap"
              /* The kit's chip, which is what the identical row two components
                 away already wears. This one was a Tailwind emerald — a hue
                 from no palette in this system, on a rounded-full capsule the
                 shape language dropped. */
              style={{
                ...chipStyle("outline", { selectable: true }),
                fontSize: 11,
                ...(active ? { borderColor: t.action, color: t.text } : {}),
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="py-8 text-center" style={{ ...body, fontSize: 14, color: t.text2 }}>Loading reblogs…</div>
      ) : !data || data.length === 0 ? (
        <div className="py-12 text-center" style={{ ...body, fontSize: 14, color: t.text2 }}>
          No reblogs yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((row) => (
            <FeedReblogAdapter key={row.id} row={row} variant="profile-zone" />
          ))}
        </div>
      )}
    </div>
  );
}
