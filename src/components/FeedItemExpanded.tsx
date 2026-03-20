import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface FeedItemExpandedProps {
  contentId: string;
  description: string | null;
  whatToExpect: string | null;
  whatToExpectBlocks: any[] | null;
}

export function FeedItemExpanded({ contentId, description, whatToExpect, whatToExpectBlocks }: FeedItemExpandedProps) {
  const [hasFetched, setHasFetched] = useState(false);

  const { data: microtags } = useQuery({
    queryKey: ["feed_item_microtags", contentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_microtags")
        .select("tag")
        .eq("content_id", contentId)
        .limit(4);
      if (error) throw error;
      return (data ?? []).map((r) => r.tag);
    },
    enabled: hasFetched,
    staleTime: 5 * 60 * 1000,
  });

  // Trigger fetch on first render
  if (!hasFetched) setHasFetched(true);

  // WTE text
  let wteText: string | null = null;
  if (whatToExpectBlocks && Array.isArray(whatToExpectBlocks) && whatToExpectBlocks.length > 0) {
    const firstText = whatToExpectBlocks.find((b: any) => b.block_type === "text" && b.text_content);
    if (firstText) wteText = (firstText.text_content as string).trim();
  }
  if (!wteText && whatToExpect) {
    wteText = whatToExpect;
  }

  const pillClass = "text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--accent))] text-muted-foreground";

  return (
    <div className="px-4 pb-3 space-y-2.5">
      {/* Section A — Description */}
      {description && (
        <p className="text-sm text-foreground">{description}</p>
      )}

      {/* Section B — What to Expect */}
      {wteText && (
        <div style={{ marginTop: description ? 10 : 0 }}>
          <p className="text-xs font-medium mb-0.5" style={{ color: "#2EC4B6" }}>What to Expect</p>
          <p className="text-xs text-muted-foreground line-clamp-4">{wteText}</p>
        </div>
      )}

      {/* Section C — Microtags */}
      {microtags && microtags.length > 0 && (
        <div className="flex flex-wrap gap-1" style={{ marginTop: 8 }}>
          {microtags.map((tag) => (
            <span key={tag} className={pillClass}>{tag}</span>
          ))}
        </div>
      )}

      {/* Read full post link */}
      <Link
        to={`/content/${contentId}`}
        className="text-xs font-medium hover:underline block"
        style={{ color: "#2EC4B6" }}
        onClick={(e) => e.stopPropagation()}
      >
        Read full post →
      </Link>
    </div>
  );
}
