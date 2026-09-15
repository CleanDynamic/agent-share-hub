import { ArrowUpRight, Star, Download, Eye } from "lucide-react";
import { ShareTrigger } from "@/components/share/ShareTrigger";
import { useShareMenu, virtualAnchorFromPoint } from "@/components/share/ShareMenuProvider";
import { CollectionBookmarkButton } from "@/components/library/CollectionBookmarkButton";

export interface BlueprintResultCardData {
  id: string;
  title: string;
  description: string;
  contentType: string;
  difficulty?: string;
  authorName: string;
  authorHandle: string;
  tools?: string[];
  rating?: number;
  ratingCount?: number;
  viewCount?: number;
  downloadCount?: number;
  slug?: string;
}

interface BlueprintResultCardProps {
  blueprint: BlueprintResultCardData;
  onClick?: () => void;
}

export function BlueprintResultCard({ blueprint, onClick }: BlueprintResultCardProps) {
  const { openShareMenu } = useShareMenu();
  const meta = { title: blueprint.title, slug: blueprint.slug };
  return (
    <div
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        openShareMenu({
          contentType: "blueprint",
          contentId: blueprint.id,
          contentMeta: meta,
          anchorEl: virtualAnchorFromPoint(e.clientX, e.clientY),
        });
      }}
      className="cursor-pointer rounded-xl p-5 transition-feedback"
      style={{
        background: "var(--glass)",
        border: "0.5px solid var(--line)",
      }}
      /* The hover step is the BORDER, not a second ground. --glass-hi is the
         top-edge highlight token rather than a surface, and using it here put
         --text2 at 4:1 on Dusk — under the text floor. Lifting the hairline to
         --text2 keeps the card's own ground legal in both rooms and still
         reads as "this row is live". */
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--text2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--line)";
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              background: "color-mix(in srgb, var(--action) 10%, transparent)",
              color: "var(--action)",
            }}
          >
            {blueprint.contentType}
          </span>
          {blueprint.difficulty && (
            <span
              className="text-[11px]"
              style={{ color: "var(--text2)" }}
            >
              {blueprint.difficulty}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <CollectionBookmarkButton
            contentType="blueprint"
            contentId={blueprint.id}
            contentMeta={{ title: blueprint.title, slug: blueprint.slug }}
          />
          <ShareTrigger
            contentType="blueprint"
            contentId={blueprint.id}
            contentMeta={meta}
          />
          <button
            className="flex items-center gap-1 text-[11px] font-medium transition-colors"
            style={{ color: "var(--text2)", background: "transparent", border: "none" }}
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
          >
            Open
            <ArrowUpRight size={12} />
          </button>
        </div>
      </div>

      <h3
        className="mt-3 text-[15px] font-semibold leading-snug"
        style={{ color: "var(--text)" }}
      >
        {blueprint.title}
      </h3>

      <p
        className="mt-1.5 text-[13px] leading-relaxed line-clamp-2"
        style={{ color: "var(--text2)" }}
      >
        {blueprint.description}
      </p>

      {blueprint.tools && blueprint.tools.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {blueprint.tools.slice(0, 5).map((tool) => (
            <span
              key={tool}
              className="rounded px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: "var(--recess)",
                color: "var(--text2)",
                border: "0.5px solid var(--line)",
              }}
            >
              {tool}
            </span>
          ))}
        </div>
      )}

      <div
        className="mt-3 flex items-center gap-4 text-[11px]"
        style={{ color: "var(--text2)" }}
      >
        <span>by @{blueprint.authorHandle}</span>
        {typeof blueprint.rating === "number" && (
          <span className="flex items-center gap-1">
            <Star size={11} /> {blueprint.rating.toFixed(1)}
            {blueprint.ratingCount ? ` (${blueprint.ratingCount})` : ""}
          </span>
        )}
        {typeof blueprint.viewCount === "number" && (
          <span className="flex items-center gap-1">
            <Eye size={11} /> {blueprint.viewCount}
          </span>
        )}
        {typeof blueprint.downloadCount === "number" && (
          <span className="flex items-center gap-1">
            <Download size={11} /> {blueprint.downloadCount}
          </span>
        )}
      </div>
    </div>
  );
}
