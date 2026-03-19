import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface FeedItemExpandedProps {
  contentId: string;
  whatToExpect: string | null;
  whatToExpectBlocks: any[] | null;
}

export function FeedItemExpanded({ contentId, whatToExpect, whatToExpectBlocks }: FeedItemExpandedProps) {
  const [hasFetched, setHasFetched] = useState(false);

  const { data: blocks, isLoading } = useQuery({
    queryKey: ["feed_item_blocks", contentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_blocks")
        .select("id, block_type, text_content, is_preview, position")
        .eq("content_id", contentId)
        .order("position", { ascending: true })
        .limit(2);
      if (error) throw error;
      return data ?? [];
    },
    enabled: hasFetched,
    staleTime: 5 * 60 * 1000,
  });

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
      {/* Section A — What to Expect */}
      {wteText && (
        <div>
          <p className="text-xs font-medium mb-0.5" style={{ color: "#2EC4B6" }}>What to Expect</p>
          <p className="text-xs text-muted-foreground line-clamp-3">{wteText}</p>
        </div>
      )}

      {/* Section B — Blueprint blocks */}
      {isLoading ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">Loading...</span>
        </div>
      ) : blocks && blocks.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-foreground mb-1.5">Blueprint:</p>
          <div className="space-y-1.5">
            {blocks.map((block, i) => (
              <div key={block.id} className="flex items-start gap-2">
                <span
                  className="shrink-0 flex items-center justify-center rounded-full text-[10px] font-bold text-primary-foreground"
                  style={{ width: 18, height: 18, background: "#E8571A", fontSize: 10 }}
                >
                  {i + 1}
                </span>
                {block.is_preview ? (
                  <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
                    {block.text_content || `[${block.block_type}]`}
                  </p>
                ) : (
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground line-clamp-2" style={{ filter: "blur(4px)", userSelect: "none" }}>
                      {block.text_content || "This content is hidden until you view the full post."}
                    </p>
                    <Link
                      to={`/content/${contentId}`}
                      className="text-[11px] hover:underline"
                      style={{ color: "#2EC4B6" }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Reveal on post →
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Section C — Microtags */}
      {microtags && microtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
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
