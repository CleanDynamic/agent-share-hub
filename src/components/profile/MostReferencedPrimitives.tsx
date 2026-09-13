// The most-referenced strip — repainted for BG-P25.
//
// SIX HEXES BECOME THE CATEGORY RESOLVER. `BLOCK_TYPE_COLORS` was a private
// six-hue palette for block types, which is the same job the nine part
// categories do — a seventh and eighth palette for one strip is how a system
// loses the ability to say that two things of the same kind look alike. Every
// type now resolves through `categoryFill`, and a type the registry does not
// know lands on the measured fallback pair rather than on a hardcoded slate.
//
// THE REFERENCE COUNT IS AN EVIDENCE TAG, NOT AN AMBER ONE. It was amber type
// on an amber wash, and amber may never be type — `--lit` is 3.01:1 on the
// Exhibition ground, legal as a light and illegal as a word. It is the same
// claim a card's plaque makes (other people used this), so it takes the same
// measured evidence pair the plaque's count does.
//
// THE CODE PREVIEW'S FOUR SYNTAX HEXES ARE GONE. A two-line teaser of somebody
// else's code does not need a syntax theme, and the four it carried were a
// Material Palenight fragment that rendered on one ground only; the preview is
// now one ink on the well, which is what the rest of the strip already was.
// That also removes an `innerHTML` assembled from a database string.

import { useRef, useCallback } from "react";
import { Star, Quote } from "lucide-react";
import { categoryColour, categoryFill } from "@/lib/theme/category";
import { chipType } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { body, data as dataText, DM_MONO, tabular } from "@/lib/theme/type";

/** A block type's hue, through the one resolver. "stage" is a narrative step. */
const typeColourFor = (type: string | undefined, isStage: boolean) =>
  categoryColour(isStage ? "narrative" : type ?? "");

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
          stroke={t.line}
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
          fill={categoryFill("narrative").background}
          stroke={t.line}
          strokeWidth="0.5"
        />
      ))}
    </svg>
  );
}

function CodePreview({ code }: { code: string }) {
  const lines = code.split("\n").slice(0, 2);

  return (
    <div
      style={{
        fontFamily: DM_MONO,
        fontSize: "10px",
        lineHeight: 1.4,
        color: t.text2,
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
        >
          {line}
        </div>
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
  const typeColor = typeColourFor(primitive.blockType?.toLowerCase(), isStage);
  const evidence = categoryFill("evidence");
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
        background: t.glass,
        border: `1px solid ${t.glassBorder}`,
        borderRadius: r.card,
        padding: "12px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 160ms cubic-bezier(.2,.6,.35,1)",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = t.text2;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = t.glassBorder;
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
              borderRadius: r.full,
              backgroundColor: typeColor,
            }}
          />
          <span
            style={{
              ...chipType,
              fontSize: "9px",
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
            /* The evidence pair, both halves. Somebody else used this block —
               the same class of claim the plaque's count carries. */
            backgroundColor: evidence.background,
            padding: "1px 6px",
            borderRadius: r.chip,
          }}
        >
          <Quote size={10} style={{ color: t.text }} />
          <span
            style={{
              ...chipType,
              ...tabular,
              fontSize: "11px",
              color: t.text,
            }}
          >
            {primitive.referenceCount}
          </span>
        </div>
      </div>

      <div
        style={{
          ...body,
          fontSize: "13px",
          fontWeight: 600,
          color: hasName ? t.text : t.text2,
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
          /* A well: the page cut into, which is what `--recess` names. */
          background: t.recess,
          borderRadius: r.media,
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
              ...body,
              fontSize: "10px",
              color: t.text2,
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
          ...dataText,
          fontSize: "10px",
          color: t.text2,
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
        {/* A lamp, not amber type: `--lit` may be a light and may never be a
            word, and an icon is a light. */}
        <Star size={14} style={{ color: t.lit, flexShrink: 0 }} />
        <span
          style={{
            ...body,
            fontSize: "13px",
            fontWeight: 600,
            color: t.text,
            marginLeft: "8px",
          }}
        >
          Most referenced
        </span>
        <span
          style={{
            ...body,
            fontSize: "11px",
            color: t.text2,
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
              ...body,
              fontSize: "11px",
              fontWeight: 500,
              color: t.action,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
              textUnderlineOffset: "3px",
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
            /* The scroller's right edge, fading into the PAGE rather than into
               a fixed near-black — the fade has to end on whatever ground the
               theme is currently painting. */
            background: `linear-gradient(to right, transparent, ${t.bg})`,
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
