import { Link } from "react-router-dom";

interface FeedItemExpandedProps {
  contentId: string;
  description: string | null;
  whatToExpect: string | null;
  whatToExpectBlocks: any[] | null;
  customTags?: string[];
}

export function FeedItemExpanded({ contentId, description, whatToExpect, whatToExpectBlocks, customTags }: FeedItemExpandedProps) {
  // WTE text
  let wteText: string | null = null;
  if (whatToExpectBlocks && Array.isArray(whatToExpectBlocks) && whatToExpectBlocks.length > 0) {
    const firstText = whatToExpectBlocks.find((b: any) => b.block_type === "text" && b.text_content);
    if (firstText) wteText = (firstText.text_content as string).trim();
  }
  if (!wteText && whatToExpect) {
    wteText = whatToExpect;
  }

  const tags = customTags ?? [];

  return (
    <div className="px-4 pb-3 space-y-2.5">
      {/* Section A — Description */}
      {description && (
        <p className="text-sm text-foreground">{description}</p>
      )}

      {/* Section B — What to Expect */}
      {wteText && (
        <div style={{ marginTop: description ? 10 : 0 }}>
          <p className="text-xs font-medium mb-0.5" style={{ color: "#1F7A6D" }}>What to Expect</p>
          <p className="text-xs text-muted-foreground line-clamp-4">{wteText}</p>
        </div>
      )}

      {/* Section C — Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1" style={{ marginTop: 8 }}>
          {tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--muted-foreground))" }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Read full post link */}
      <Link
        to={`/content/${contentId}`}
        className="text-xs font-medium hover:underline block"
        style={{ color: "#1F7A6D" }}
        onClick={(e) => e.stopPropagation()}
      >
        Read full post →
      </Link>
    </div>
  );
}
