import { useRef, useCallback } from "react";
import { Star, Quote } from "lucide-react";

const BLOCK_TYPE_COLORS: Record<string, string> = {
  prompt: "#A78BFA",
  code: "#60A5FA",
  data: "#34D399",
  model: "#F472B6",
  tool: "#FBBF24",
  default: "#94A3B8",
};

const STAGE_COLOR = "#2EC4B6";

export interface PrimitiveCardData {
  id: string;
  type: "block" | "stage";
  blockType?: string;
  name: string;
  contentPreview: string | { blocks: unknown[]; connections: unknown[] };
  referenceCount: number;
  parent: {
    blueprintId: string;
    blueprintTitle: string;
    slug: string;
    stageId?: string;
  };
}

interface MostReferencedPrimitivesProps {
  primitives: PrimitiveCardData[];
  onPrimitiveClick: (primitive: PrimitiveCardData) => void;
  onViewAllClick: () => void;
}

function StageMiniMap({
  data,
}: {
  data: { blocks: unknown[]; connections: unknown[] };
}) {
  const blocks = data.blocks || [];
  const connections = data.connections || [];

  return (
    <svg
      width="100%"
      height="38"
      viewBox="0 0 100 38"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
    >
      {connections.slice(0, 6).map((_, i) => (
        <line
          key={`conn-${i}`}
          x1={15 + i * 15}
          y1={10 + (i % 3) * 8}
          x2={30 + i * 12}
          y2={15 + ((i + 1) % 3) * 8}
          stroke="rgba(46,196,182,0.3)"
          strokeWidth="1"
        />
      ))}
      {blocks.slice(0, 8).map((_, i) => (
        <rect
          key={`block-${i}`}
          x={10 + (i % 4) * 22}
          y={5 + Math.floor(i / 4) * 18}
          width="16"
          height="12"
          rx="2"
          fill="rgba(46,196,182,0.25)"
          stroke="rgba(46,196,182,0.5)"
          strokeWidth="0.5"
        />
      ))}
    </svg>
  );
}

function CodePreview({ code }: { code: string }) {
  const lines = code.split("\n").slice(0, 2);

  const highlightCode = (line: string) => {
    return line
      .split(
        /(const|let|var|function|return|if|else|for|while|import|export|from|async|await)/g
      )
      .map((part, i) => {
        if (
          /^(const|let|var|function|return|if|else|for|while|import|export|from|async|await)$/.test(
            part
          )
        ) {
          return `<span style="color:#C792EA">${part}</span>`;
        }
        return part
          .split(/("[^"]*"|'[^']*'|`[^`]*`)/g)
          .map((p) => {
            if (/^("[^"]*"|'[^']*'|`[^`]*`)$/.test(p)) {
              return `<span style="color:#C3E88D">${p}</span>`;
            }
            return p
              .split(/(\d+)/g)
              .map((n) =>
                /^\d+$/.test(n) ? `<span style="color:#F78C6C">${n}</span>` : n
              )
              .join("");
          })
          .join("");
      })
      .join("");
  };

  return (
    <div
      style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: "10px",
        lineHeight: 1.4,
        color: "rgba(255,255,255,0.55)",
        overflow: "hidden",
      }}
    >
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          dangerouslySetInnerHTML={{ __html: highlightCode(line) }}
        />
      ))}
    </div>
  );
}

function PrimitiveCard({
  primitive,
  onClick,
}: {
  primitive: PrimitiveCardData;
  onClick: () => void;
}) {
  const isStage = primitive.type === "stage";
  const typeColor = isStage
    ? STAGE_COLOR
    : BLOCK_TYPE_COLORS[primitive.blockType?.toLowerCase() || ""] ||
      BLOCK_TYPE_COLORS.default;
  const typeLabel = isStage
    ? "STAGE"
    : (primitive.blockType?.toUpperCase() || "BLOCK");
  const hasName = primitive.name && primitive.name.trim() !== "";
  const displayName = hasName
    ? primitive.name
    : `Untitled ${isStage ? "stage" : primitive.blockType?.toLowerCase() || "block"}`;

  return (
    <div
      onClick={onClick}
      style={{
        width: "280px",
        height: "130px",
        background: "rgba(22,22,30,0.40)",
        border: "0.5px solid rgba(255,255,255,0.06)",
        borderRadius: "8px",
        padding: "12px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 0.15s ease",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(245,158,11,0.30)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
      }}
    >
      <div
        style={{
          height: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: typeColor,
            }}
          />
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "9px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: typeColor,
            }}
          >
            {typeLabel}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            background: "rgba(245,158,11,0.08)",
            padding: "1px 6px",
            borderRadius: "100px",
          }}
        >
          <Quote size={10} style={{ color: "rgba(245,158,11,0.85)" }} />
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "11px",
              fontWeight: 600,
              color: "rgba(245,158,11,0.85)",
            }}
          >
            {primitive.referenceCount}
          </span>
        </div>
      </div>

      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: "13px",
          fontWeight: 600,
          color: hasName ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.50)",
          fontStyle: hasName ? "normal" : "italic",
          marginTop: "8px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {displayName}
      </div>

      <div
        style={{
          height: "50px",
          background: "rgba(0,0,0,0.20)",
          borderRadius: "4px",
          padding: "6px 8px",
          marginTop: "8px",
          overflow: "hidden",
        }}
      >
        {isStage && typeof primitive.contentPreview === "object" ? (
          <StageMiniMap
            data={
              primitive.contentPreview as {
                blocks: unknown[];
                connections: unknown[];
              }
            }
          />
        ) : primitive.blockType?.toLowerCase() === "code" ? (
          <CodePreview code={String(primitive.contentPreview)} />
        ) : (
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "10px",
              fontWeight: 400,
              color: "rgba(255,255,255,0.55)",
              lineHeight: 1.4,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {String(primitive.contentPreview)}
          </div>
        )}
      </div>

      <div
        style={{
          height: "16px",
          marginTop: "auto",
          fontFamily: "Inter, sans-serif",
          fontSize: "10px",
          fontWeight: 400,
          color: "rgba(255,255,255,0.40)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        From{" "}
        <span
          style={{ cursor: "pointer" }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {primitive.parent.blueprintTitle}
        </span>
      </div>
    </div>
  );
}

export function MostReferencedPrimitives({
  primitives,
  onPrimitiveClick,
  onViewAllClick,
}: MostReferencedPrimitivesProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handlePrimitiveClick = useCallback(
    (primitive: PrimitiveCardData) => {
      onPrimitiveClick(primitive);
    },
    [onPrimitiveClick]
  );

  // Hide entirely when no referenced primitives.
  if (!primitives || primitives.length === 0) {
    return null;
  }

  return (
    <div style={{ width: "100%", marginTop: "24px" }}>
      <div
        style={{
          height: "32px",
          display: "flex",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <Star size={14} style={{ color: "#F59E0B", flexShrink: 0 }} />
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "13px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.85)",
            marginLeft: "8px",
          }}
        >
          Most referenced
        </span>
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: "11px",
            fontWeight: 400,
            color: "rgba(255,255,255,0.45)",
            marginLeft: "8px",
          }}
        >
          Blocks and stages from this creator that others use
        </span>
        <div style={{ flex: 1 }} />
        {primitives.length > 5 && (
          <button
            onClick={onViewAllClick}
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "11px",
              fontWeight: 500,
              color: "rgba(46,196,182,0.85)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            View all
          </button>
        )}
      </div>

      <div style={{ position: "relative" }}>
        <div
          ref={scrollContainerRef}
          style={{
            display: "flex",
            gap: "12px",
            overflowX: "auto",
            overflowY: "hidden",
            paddingBottom: "8px",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
          className="hide-scrollbar"
        >
          {primitives.map((primitive) => (
            <PrimitiveCard
              key={primitive.id}
              primitive={primitive}
              onClick={() => handlePrimitiveClick(primitive)}
            />
          ))}
        </div>

        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "48px",
            height: "100%",
            background:
              "linear-gradient(to right, transparent, rgba(8,8,12,0.85))",
            pointerEvents: "none",
          }}
        />
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
