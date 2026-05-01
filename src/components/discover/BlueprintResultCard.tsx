import { ArrowUpRight, Star, Download, Eye } from "lucide-react";
import { ShareTrigger } from "@/components/share/ShareTrigger";
import { useShareMenu, virtualAnchorFromPoint } from "@/components/share/ShareMenuProvider";

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
      className="cursor-pointer rounded-xl p-5 transition-all"
      style={{
        background: "rgba(22, 22, 30, 0.30)",
        border: "0.5px solid rgba(255, 255, 255, 0.05)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(22, 22, 30, 0.50)";
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.10)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(22, 22, 30, 0.30)";
        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.05)";
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              background: "rgba(232,87,26,0.10)",
              color: "#E8571A",
            }}
          >
            {blueprint.contentType}
          </span>
          {blueprint.difficulty && (
            <span
              className="text-[11px]"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              {blueprint.difficulty}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <ShareTrigger
            contentType="blueprint"
            contentId={blueprint.id}
            contentMeta={meta}
          />
          <button
            className="flex items-center gap-1 text-[11px] font-medium transition-colors"
            style={{ color: "rgba(255,255,255,0.55)", background: "transparent", border: "none" }}
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
        style={{ color: "rgba(255,255,255,0.95)" }}
      >
        {blueprint.title}
      </h3>

      <p
        className="mt-1.5 text-[13px] leading-relaxed line-clamp-2"
        style={{ color: "rgba(255,255,255,0.65)" }}
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
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.65)",
                border: "0.5px solid rgba(255,255,255,0.06)",
              }}
            >
              {tool}
            </span>
          ))}
        </div>
      )}

      <div
        className="mt-3 flex items-center gap-4 text-[11px]"
        style={{ color: "rgba(255,255,255,0.45)" }}
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
