import { ArrowUpRight, LayoutGrid } from "lucide-react";
import { ShareTrigger } from "@/components/share/ShareTrigger";
import { useShareMenu, virtualAnchorFromPoint } from "@/components/share/ShareMenuProvider";
import { CollectionBookmarkButton } from "@/components/library/CollectionBookmarkButton";

const BLOCK_TYPE_COLORS: Record<string, string> = {
  prompt: "#2EC4B6",
  code: "#FF6B6B",
  result: "#FFE66D",
  text: "#A8DADC",
  note: "#B5838D",
  quote: "#E5989B",
  image: "#6D6875",
  video: "#B185DB",
  agent: "#4ECDC4",
  tool: "#F38181",
  model: "#AA96DA",
  workflow: "#FCBAD3",
  compare: "#95E1D3",
  tutorial: "#F9ED69",
  resource: "#C9B1FF",
  heading: "#F5F5DC",
};

export interface StageBlockPosition {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StageConnection {
  from: string;
  to: string;
}

export interface DiscoverStage {
  id: string;
  name?: string;
  blocks: StageBlockPosition[];
  connections: StageConnection[];
}

export interface StageParent {
  blueprintId: string;
  blueprintTitle: string;
  slug: string;
}

export interface StageAuthor {
  name: string;
  handle: string;
}

interface StageResultCardProps {
  stage: DiscoverStage;
  parent: StageParent;
  author: StageAuthor;
  onClick?: () => void;
}

function getBlockColor(type: string): string {
  return BLOCK_TYPE_COLORS[type.toLowerCase()] || "#888888";
}

function countBlockTypes(blocks: StageBlockPosition[]): Map<string, number> {
  const counts = new Map<string, number>();
  blocks.forEach((block) => {
    const type = block.type.toLowerCase();
    counts.set(type, (counts.get(type) || 0) + 1);
  });
  return counts;
}

function countModels(blocks: StageBlockPosition[]): number {
  return blocks.filter((b) => b.type.toLowerCase() === "model").length;
}

function StageMiniMap({
  blocks,
  connections,
}: {
  blocks: StageBlockPosition[];
  connections: StageConnection[];
}) {
  if (blocks.length === 0) {
    return (
      <div
        className="flex h-[74px] items-center justify-center text-[11px]"
        style={{ color: "rgba(255,255,255,0.30)" }}
      >
        Empty stage
      </div>
    );
  }

  const minX = Math.min(...blocks.map((b) => b.x));
  const maxX = Math.max(...blocks.map((b) => b.x + b.width));
  const minY = Math.min(...blocks.map((b) => b.y));
  const maxY = Math.max(...blocks.map((b) => b.y + b.height));

  const width = maxX - minX || 100;
  const height = maxY - minY || 100;

  const padding = 8;
  const svgWidth = 280;
  const svgHeight = 74;
  const scaleX = (svgWidth - padding * 2) / width;
  const scaleY = (svgHeight - padding * 2) / height;
  const scale = Math.min(scaleX, scaleY, 1);

  const offsetX = padding + (svgWidth - padding * 2 - width * scale) / 2;
  const offsetY = padding + (svgHeight - padding * 2 - height * scale) / 2;

  const blockPositions = new Map<string, { cx: number; cy: number }>();
  blocks.forEach((block) => {
    const cx = offsetX + (block.x - minX + block.width / 2) * scale;
    const cy = offsetY + (block.y - minY + block.height / 2) * scale;
    blockPositions.set(block.id, { cx, cy });
  });

  return (
    <svg width={svgWidth} height={svgHeight} style={{ display: "block" }}>
      {connections.map((conn, i) => {
        const from = blockPositions.get(conn.from);
        const to = blockPositions.get(conn.to);
        if (!from || !to) return null;
        return (
          <line
            key={i}
            x1={from.cx}
            y1={from.cy}
            x2={to.cx}
            y2={to.cy}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={0.75}
          />
        );
      })}
      {blocks.map((block) => {
        const x = offsetX + (block.x - minX) * scale;
        const y = offsetY + (block.y - minY) * scale;
        const w = Math.max(block.width * scale, 8);
        const h = Math.max(block.height * scale, 6);
        return (
          <rect
            key={block.id}
            x={x}
            y={y}
            width={w}
            height={h}
            rx={2}
            fill={getBlockColor(block.type)}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

export function StageResultCard({ stage, parent, author, onClick }: StageResultCardProps) {
  const { openShareMenu } = useShareMenu();
  const blockTypeCounts = countBlockTypes(stage.blocks);
  const modelCount = countModels(stage.blocks);
  const stageName = stage.name || `Stage ${stage.id}`;
  const sortedTypes = Array.from(blockTypeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const initials = author.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <article
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        openShareMenu({
          contentType: "stage",
          contentId: stage.id,
          contentMeta: { title: stageName, parentSlug: parent.blueprintId },
          anchorEl: virtualAnchorFromPoint(e.clientX, e.clientY),
        });
      }}
      className="group relative rounded-xl cursor-pointer transition-all duration-300 hover:bg-white/[0.02]"
      style={{
        padding: "14px 16px",
        marginBottom: "10px",
        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.02) 100%)",
        backdropFilter: "blur(60px)",
        WebkitBackdropFilter: "blur(60px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderTopColor: "rgba(255, 255, 255, 0.06)",
        borderLeftColor: "rgba(255, 255, 255, 0.06)",
        boxShadow: "0 2px 12px rgba(0, 0, 0, 0.20)",
      }}
    >
      {/* Author header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 600, flexShrink: 0,
              background: "rgba(46,196,182,0.15)",
              color: "#2EC4B6",
              border: "1px solid rgba(46,196,182,0.30)",
            }}
          >
            {initials}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
              {author.name}
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.40)" }}>
              @{author.handle}
            </span>
            <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>·</span>
            <span
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "1px 6px", borderRadius: 4,
                fontSize: 9, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.05em",
                background: "rgba(46,196,182,0.15)",
                color: "#2EC4B6",
                border: "1px solid rgba(46,196,182,0.30)",
              }}
            >
              <LayoutGrid size={9} />
              <span>STAGE</span>
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <CollectionBookmarkButton
            contentType="stage"
            contentId={stage.id}
            contentMeta={{ title: stageName, parentSlug: parent.blueprintId }}
          />
          <ShareTrigger
            contentType="stage"
            contentId={stage.id}
            contentMeta={{ title: stageName, parentSlug: parent.blueprintId }}
          />
          <button
            className="flex items-center gap-1 text-[11px] font-medium"
            style={{ color: "rgba(255,255,255,0.55)", background: "transparent", border: "none", cursor: "pointer", flexShrink: 0 }}
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

      {/* Title (Playfair) */}
      <h3 style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 15, fontWeight: 500, color: "rgba(255,255,255,0.90)",
        lineHeight: 1.35, marginTop: 10, marginBottom: 0,
      }}>
        {stageName}
      </h3>

      <p style={{
        marginTop: 6, fontSize: 13,
        color: "rgba(255,255,255,0.50)", lineHeight: 1.6, margin: 0,
      }}>
        From <span style={{ color: "rgba(255,255,255,0.70)" }}>{parent.blueprintTitle}</span>
      </p>

      {/* Mini-map preview */}
      <div
        style={{
          marginTop: 12,
          borderRadius: 10,
          overflow: "hidden",
          background: "rgba(0,0,0,0.25)",
          border: "1px solid rgba(255,255,255,0.04)",
          padding: 8,
        }}
      >
        <StageMiniMap blocks={stage.blocks} connections={stage.connections} />
      </div>

      {/* Block-type chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {sortedTypes.map(([type, count]) => (
          <span
            key={type}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "0.5px solid rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.75)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: getBlockColor(type),
                display: "inline-block",
              }}
            />
            {type}
            {count > 1 && (
              <span style={{ color: "rgba(255,255,255,0.45)" }}>×{count}</span>
            )}
          </span>
        ))}
      </div>

      <div className="mt-3 text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
        {stage.blocks.length} blocks · {stage.connections.length} connections
        {modelCount > 0 && ` · ${modelCount} models`}
      </div>
    </article>
  );
}
