import { ArrowUpRight, LayoutGrid } from "lucide-react";

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
  const blockTypeCounts = countBlockTypes(stage.blocks);
  const modelCount = countModels(stage.blocks);
  const stageName = stage.name || `Stage ${stage.id}`;
  const sortedTypes = Array.from(blockTypeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl p-4 transition-all"
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
          <LayoutGrid size={14} style={{ color: "rgba(255,255,255,0.55)" }} />
          <span
            className="text-[13px] font-semibold"
            style={{ color: "rgba(255,255,255,0.95)" }}
          >
            {stageName}
          </span>
        </div>
        <button
          className="flex items-center gap-1 text-[11px] font-medium"
          style={{ color: "rgba(255,255,255,0.55)", background: "transparent", border: "none" }}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          View in blueprint
          <ArrowUpRight size={12} />
        </button>
      </div>

      <div
        className="mt-3 rounded-md p-2"
        style={{
          background: "rgba(0,0,0,0.25)",
          border: "0.5px solid rgba(255,255,255,0.04)",
        }}
      >
        <StageMiniMap blocks={stage.blocks} connections={stage.connections} />
      </div>

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

      <div className="mt-3 text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>
        {stage.blocks.length} blocks · {stage.connections.length} connections
        {modelCount > 0 && ` · ${modelCount} models`}
      </div>

      <div className="mt-2 text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
        From <span style={{ color: "rgba(255,255,255,0.65)" }}>{parent.blueprintTitle}</span>
        {" · by "}
        <span style={{ color: "rgba(255,255,255,0.65)" }}>@{author.handle}</span>
      </div>
    </div>
  );
}
