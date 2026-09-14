import React, { useEffect, useRef, useState } from "react";
import { Target, ArrowRight, AlertCircle } from "lucide-react";
import { type } from "@/lib/theme/type";
import { colourAlpha } from "@/lib/theme/tokens";

function relativeOpenedLabel(iso: string | null | undefined): string {
  if (!iso) return "Opened";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Opened just now";
  if (mins < 60) return `Opened ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Opened ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `Opened ${days}d ago`;
  return `Opened ${new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

/**
 * BG-P26. The eight block types, resolved into part categories.
 *
 * These were #A855F7, #3B82F6, #22C55E, #EC4899, #F97316, #EAB308 and #14B8A6 —
 * seven of the fourteen legacy content-type badge colours, which the theme
 * retires outright. Anything needing a colour resolves into one of the nine
 * part hues, or into `--text2` when nothing fits, and each of these has an
 * obvious home: a prompt is an instruction, a result is evidence, an api call
 * is data, and the three media types are media.
 *
 * Unlike the old hexes these keep their hue but change value between the rooms,
 * and each is measured at 4.83:1 or better on its own ground.
 */
const BLOCK_TYPE_COLORS: Record<string, string> = {
  prompt: "var(--cat-instruction)",
  code: "var(--cat-configuration)",
  result: "var(--cat-evidence)",
  image: "var(--cat-media)",
  video: "var(--cat-media)",
  audio: "var(--cat-media)",
  text: "var(--cat-narrative)",
  api: "var(--cat-data)",
};

export interface BlueprintContent {
  id: string;
  title: string;
  author: string;
  coverImage?: string | null;
  useCase?: string | null;
  blockTypes: { type: string; color: string }[];
  stageCount: number;
  blockCount: number;
  readTime: string;
}

export interface StageContent {
  id: string;
  name: string;
  blueprintTitle: string;
  blockCount: number;
  connectionCount: number;
  blocks: { x: number; y: number; type: string }[];
  connections: { from: number; to: number }[];
}

export interface BlockContent {
  id: string;
  name: string;
  type: string;
  stageName: string;
  blueprintTitle: string;
  preview: string;
  thumbnail?: string | null;
  referenceCount?: number;
}

export type ContentVariant = "blueprint" | "stage" | "block";
export type ContentShareValue = BlueprintContent | StageContent | BlockContent;

export type ReadState = "sending" | "delivered" | "seen" | "opened" | null;

export interface ContentShareBubbleProps {
  variant: ContentVariant;
  content: ContentShareValue;
  senderNote?: string | null;
  isFromCurrentUser: boolean;
  timestamp: string;
  readState?: ReadState;
  /** ISO timestamp the recipient first viewed the share (sender side only). */
  viewedAt?: string | null;
  isBroken?: boolean;
  onContentClick: (content: ContentShareValue) => void;
  /**
   * Recipient-only callback fired automatically after either:
   *  - hovering the bubble for >2 seconds, or
   *  - having the bubble fully on-screen for >5 seconds.
   * Should be idempotent (will fire at most once per mount).
   */
  onViewed?: () => void;
}

function StageMiniMap({
  blocks,
  connections,
}: {
  blocks: { x: number; y: number; type: string }[];
  connections: { from: number; to: number }[];
}) {
  const w = 240;
  const h = 96;
  return (
    <svg width={w} height={h} className="block">
      {connections.map((conn, i) => {
        const f = blocks[conn.from];
        const t = blocks[conn.to];
        if (!f || !t) return null;
        return (
          <line
            key={i}
            x1={f.x}
            y1={f.y}
            x2={t.x}
            y2={t.y}
            stroke="var(--line)"
            strokeWidth={1}
          />
        );
      })}
      {blocks.map((b, i) => (
        <circle
          key={i}
          cx={b.x}
          cy={b.y}
          r={5}
          fill={BLOCK_TYPE_COLORS[b.type?.toLowerCase()] || "var(--text2)"}
          stroke="var(--bg)"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}

function BlockTypeChips({ types }: { types: { type: string; color: string }[] }) {
  const display = types.slice(0, 6);
  return (
    <div className="flex flex-wrap gap-1">
      {display.map((t, i) => (
        <span
          key={i}
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: `${colourAlpha(t.color, 0.133)}`,
            color: t.color,
            fontFamily: "Figtree, sans-serif",
          }}
        >
          {t.type}
        </span>
      ))}
    </div>
  );
}

export function ContentShareBubble({
  variant,
  content,
  senderNote,
  isFromCurrentUser,
  timestamp,
  readState,
  viewedAt,
  isBroken,
  onContentClick,
  onViewed,
}: ContentShareBubbleProps) {
  const [hovered, setHovered] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const firedRef = useRef(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, forceTick] = useState(0);

  const fireViewed = () => {
    if (firedRef.current) return;
    if (!onViewed) return;
    firedRef.current = true;
    try { onViewed(); } catch { /* noop */ }
  };

  // Hover-2s trigger (recipient only)
  useEffect(() => {
    if (isFromCurrentUser || !onViewed || firedRef.current) return;
    if (!hovered) {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      return;
    }
    hoverTimerRef.current = setTimeout(fireViewed, 2000);
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered, isFromCurrentUser, onViewed]);

  // IntersectionObserver-5s on-screen fallback (recipient only)
  useEffect(() => {
    if (isFromCurrentUser || !onViewed || firedRef.current) return;
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.85 && document.hasFocus()) {
          if (visibleTimerRef.current) return;
          visibleTimerRef.current = setTimeout(() => {
            fireViewed();
            visibleTimerRef.current = null;
          }, 5000);
        } else if (visibleTimerRef.current) {
          clearTimeout(visibleTimerRef.current);
          visibleTimerRef.current = null;
        }
      },
      { threshold: [0, 0.85, 1] }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (visibleTimerRef.current) clearTimeout(visibleTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFromCurrentUser, onViewed]);

  // Re-render the relative "Opened Xm ago" label every 30s
  useEffect(() => {
    if (!viewedAt) return;
    const t = setInterval(() => forceTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, [viewedAt]);

  const bubbleBg = isFromCurrentUser
    ? "color-mix(in srgb, var(--evidence) 12%, transparent)"
    : "var(--recess)";
  const hoverBg = isFromCurrentUser
    ? "color-mix(in srgb, var(--evidence) 16%, transparent)"
    : "var(--recess)";
  const borderRadius = isFromCurrentUser
    ? "14px 4px 14px 14px"
    : "4px 14px 14px 14px";

  const renderReadState = () => {
    if (!isFromCurrentUser || !readState) return null;
    const openedText = relativeOpenedLabel(viewedAt ?? null);
    const cfg: Record<string, { text: string; color: string }> = {
      sending: { text: "Sending…", color: "var(--text2)" },
      delivered: { text: "Delivered", color: "var(--text2)" },
      seen: { text: `Seen ${timestamp}`, color: "color-mix(in srgb, var(--evidence) 65%, transparent)" },
      opened: { text: openedText, color: "var(--evidence)" },
    };
    const c = cfg[readState];
    if (!c) return null;
    return (
      <div
        className="text-[10px] mt-1 text-right"
        style={{ color: c.color, fontFamily: "Figtree, sans-serif" }}
      >
        {c.text}
      </div>
    );
  };

  if (isBroken) {
    return (
      <div className={`flex flex-col ${isFromCurrentUser ? "items-end" : "items-start"}`}>
        <div
          className="max-w-[320px] px-3 py-2.5 flex items-center gap-2"
          style={{
            backgroundColor: bubbleBg,
            borderRadius,
            color: "var(--text2)",
            fontFamily: "Figtree, sans-serif",
            fontSize: 12,
          }}
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>This content is no longer available.</span>
        </div>
        {renderReadState()}
      </div>
    );
  }

  const renderBlueprint = () => {
    const bp = content as BlueprintContent;
    return (
      <>
        {bp.coverImage ? (
          <div
            className="w-full h-[120px] bg-cover bg-center"
            style={{ backgroundImage: `url(${bp.coverImage})` }}
          />
        ) : (
          <div
            className="w-full h-[80px]"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--evidence) 18%, transparent), color-mix(in srgb, var(--action) 18%, transparent))",
            }}
          />
        )}
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: "color-mix(in srgb, var(--evidence) 18%, transparent)",
                color: "var(--evidence)",
                fontFamily: "Figtree, sans-serif",
                letterSpacing: "0.04em",
              }}
            >
              BLUEPRINT
            </span>
            <span
              className="text-[11px] truncate"
              style={{ color: "var(--text2)", fontFamily: "Figtree, sans-serif" }}
            >
              by @{bp.author}
            </span>
          </div>
          <p
            className="text-[14px] font-semibold leading-snug line-clamp-2"
            style={{ color: "var(--text)", ...type.cardTitle,}}
          >
            {bp.title}
          </p>
          {bp.useCase && (
            <div
              className="flex items-start gap-1.5 text-[11px] leading-snug"
              style={{ color: "var(--text2)", fontFamily: "Figtree, sans-serif" }}
            >
              <Target className="h-3 w-3 mt-0.5 shrink-0" />
              <span className="line-clamp-2">{bp.useCase}</span>
            </div>
          )}
          {bp.blockTypes.length > 0 && <BlockTypeChips types={bp.blockTypes} />}
          <div
            className="text-[10px] pt-1"
            style={{ color: "var(--text2)", fontFamily: "Figtree, sans-serif" }}
          >
            {bp.stageCount} stages · {bp.blockCount} blocks · {bp.readTime}
          </div>
        </div>
      </>
    );
  };

  const renderStage = () => {
    const s = content as StageContent;
    return (
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: "color-mix(in srgb, var(--cat-agents) 18%, transparent)",
              color: "color-mix(in srgb, var(--cat-agents) 95%, transparent)",
              fontFamily: "Figtree, sans-serif",
              letterSpacing: "0.04em",
            }}
          >
            STAGE
          </span>
          <span
            className="text-[11px] truncate"
            style={{ color: "var(--text2)", fontFamily: "Figtree, sans-serif" }}
          >
            from {s.blueprintTitle}
          </span>
        </div>
        <p
          className="text-[14px] font-semibold leading-snug"
          style={{ color: "var(--text)", ...type.cardTitle,}}
        >
          {s.name}
        </p>
        <div
          className="rounded-md overflow-hidden"
          style={{ backgroundColor: "var(--recess)" }}
        >
          <StageMiniMap blocks={s.blocks} connections={s.connections} />
        </div>
        <div
          className="text-[10px]"
          style={{ color: "var(--text2)", fontFamily: "Figtree, sans-serif" }}
        >
          {s.blockCount} blocks · {s.connectionCount} connections
        </div>
      </div>
    );
  };

  const renderBlock = () => {
    const b = content as BlockContent;
    const typeColor = BLOCK_TYPE_COLORS[b.type?.toLowerCase()] || "var(--text2)";
    const isMedia = ["image", "video"].includes((b.type || "").toLowerCase());
    return (
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: `${colourAlpha(typeColor, 0.133)}`,
              color: typeColor,
              fontFamily: "Figtree, sans-serif",
              letterSpacing: "0.04em",
            }}
          >
            {(b.type || "BLOCK").toUpperCase()}
          </span>
          <span
            className="text-[11px] truncate"
            style={{ color: "var(--text2)", fontFamily: "Figtree, sans-serif" }}
          >
            from {b.stageName} in {b.blueprintTitle}
          </span>
        </div>
        <p
          className="text-[14px] font-semibold leading-snug"
          style={{ color: "var(--text)", ...type.cardTitle,}}
        >
          {b.name}
        </p>
        <div
          className="rounded-md p-2 overflow-hidden"
          style={{
            backgroundColor: "var(--recess)",
            maxHeight: 96,
          }}
        >
          {isMedia && b.thumbnail ? (
            <img
              src={b.thumbnail}
              alt=""
              className="rounded w-full h-[80px] object-cover"
            />
          ) : (
            <pre
              className="text-[11px] whitespace-pre-wrap break-words line-clamp-4"
              style={{
                color: "var(--text2)",
                fontFamily: "JetBrains Mono, ui-monospace, monospace",
                margin: 0,
              }}
            >
              {b.preview}
            </pre>
          )}
        </div>
        {b.referenceCount && b.referenceCount > 0 ? (
          <div
            className="text-[10px]"
            style={{ color: "var(--text2)", fontFamily: "Figtree, sans-serif" }}
          >
            Used {b.referenceCount}× in other blueprints
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div ref={rootRef} className={`flex flex-col ${isFromCurrentUser ? "items-end" : "items-start"}`}>
      <div
        role="button"
        tabIndex={0}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onContentClick(content)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onContentClick(content);
          }
        }}
        className="relative max-w-[320px] overflow-hidden cursor-pointer transition-colors"
        style={{
          backgroundColor: hovered ? hoverBg : bubbleBg,
          borderRadius,
          border: "1px solid var(--recess)",
        }}
      >
        {senderNote && (
          <div
            className="px-3 pt-2.5 pb-1 text-[13px] leading-snug whitespace-pre-wrap break-words"
            style={{
              color: "var(--text)",
              fontFamily: "Figtree, sans-serif",
            }}
          >
            {senderNote}
          </div>
        )}
        <div className="relative">
          {variant === "blueprint" && renderBlueprint()}
          {variant === "stage" && renderStage()}
          {variant === "block" && renderBlock()}
          <div
            className="absolute bottom-2 right-2 transition-opacity"
            style={{ opacity: hovered ? 1 : 0.6 }}
          >
            <ArrowRight className="h-3.5 w-3.5" style={{ color: "var(--text2)" }} />
          </div>
        </div>
      </div>
      {renderReadState()}
    </div>
  );
}

export default ContentShareBubble;
