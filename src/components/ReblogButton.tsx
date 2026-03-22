import { useState } from "react";
import { Repeat2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ReblogModal, type ReblogSource } from "@/components/ReblogModal";
import { formatNum } from "@/components/FeedItem";

interface ReblogButtonProps {
  source: ReblogSource;
  /** Stop click propagation so parent card click doesn't fire */
  stopPropagation?: boolean;
}

export function ReblogButton({ source, stopPropagation = true }: ReblogButtonProps) {
  const { isLoggedIn, user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  // Derive the canonical source id for count/check queries
  const sourceId =
    source.type === "content" ? source.id
    : source.type === "collection" ? source.id
    : source.type === "project" ? source.id
    : source.reblogId;

  const sourceColumn =
    source.type === "content" ? "reblog_of_content_id"
    : source.type === "collection" ? "reblog_of_collection_id"
    : source.type === "project" ? "reblog_of_project_id"
    : "quoted_reblog_id";

  // Count of all reblogs of this source
  const { data: countData } = useQuery({
    queryKey: ["reblog_count", sourceColumn, sourceId],
    queryFn: async () => {
      const { count } = await supabase
        .from("content_items")
        .select("id", { count: "exact", head: true })
        .eq(sourceColumn as any, sourceId)
        .eq("is_reblog" as any, true);
      return count ?? 0;
    },
    enabled: !!sourceId,
    staleTime: 30_000,
  });

  // Whether the current user has already reblogged this
  const { data: hasReblogged } = useQuery({
    queryKey: ["user_has_reblogged", sourceColumn, sourceId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_items")
        .select("id")
        .eq(sourceColumn as any, sourceId)
        .eq("creator_id", user!.id)
        .eq("is_reblog", true)
        .maybeSingle();
      return !!data;
    },
    enabled: !!sourceId && !!user?.id,
    staleTime: 30_000,
  });

  const count = countData ?? 0;
  const teal = "#2EC4B6";
  const color = hasReblogged ? teal : undefined;

  const handleClick = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    if (!isLoggedIn) return; // could open AccountGateModal if needed
    setOpen(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-[3px] shrink-0 hover:text-foreground transition-colors text-xs"
        style={{ color: color ?? undefined }}
        title={hasReblogged ? "You reblogged this" : "Reblog"}
      >
        <Repeat2 className="h-3.5 w-3.5" style={{ color: color ?? "currentColor" }} />
        {count > 0 && <span style={{ color: color ?? "currentColor" }}>{formatNum(count)}</span>}
      </button>

      {open && (
        <ReblogModal
          open={open}
          onOpenChange={setOpen}
          source={source}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["reblog_count", sourceColumn, sourceId] });
            qc.invalidateQueries({ queryKey: ["user_has_reblogged", sourceColumn, sourceId, user?.id] });
          }}
        />
      )}
    </>
  );
}
