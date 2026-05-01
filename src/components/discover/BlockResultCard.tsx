import { ArrowUpRight } from "lucide-react";
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

export interface DiscoverBlock {
  id: string;
  type: string;
  name?: string;
  content?: string;
  properties?: Record<string, unknown>;
}

export interface BlockParent {
  blueprintId: string;
  blueprintTitle: string;
  stageName: string;
  slug: string;
}

export interface BlockAuthor {
  name: string;
  handle: string;
}

interface BlockResultCardProps {
  block: DiscoverBlock;
  parent: BlockParent;
  author: BlockAuthor;
  referenceCount?: number;
  onClick?: () => void;
}

function getDefaultBlockName(type: string): string {
  return `Untitled ${type}`;
}

function getBlockColor(type: string): string {
  return BLOCK_TYPE_COLORS[type.toLowerCase()] || "#888888";
}

function getContentPreview(block: DiscoverBlock): { content: string; isCode: boolean } {
  const type = block.type.toLowerCase();
  const content = block.content || "";

  switch (type) {
    case "prompt":
      return {
        content: content.split("\n").slice(0, 3).join("\n") || "No prompt content",
        isCode: false,
      };
    case "code":
      return {
        content: content.split("\n").slice(0, 3).join("\n") || "// No code content",
        isCode: true,
      };
    case "result":
      return { content: content.slice(0, 80) || "No result content", isCode: false };
    case "text":
    case "note":
    case "quote":
      return { content: content.slice(0, 100) || "No text content", isCode: false };
    case "agent":
    case "tool":
    case "model": {
      const props = (block.properties || {}) as Record<string, unknown>;
      const modelName = (props.modelName as string) || (props.name as string) || type;
      const toolCount = Array.isArray(props.tools) ? (props.tools as unknown[]).length : 0;
      return {
        content: `${modelName}${toolCount > 0 ? ` · ${toolCount} tools` : ""}`,
        isCode: false,
      };
    }
    case "workflow":
    case "compare":
    case "tutorial":
    case "resource":
    case "heading":
      return { content: content.split("\n")[0] || `${type} block`, isCode: false };
    case "image":
    case "video":
      return { content: `[${type} preview]`, isCode: false };
    default:
      return { content: content.slice(0, 100) || "No content", isCode: false };
  }
}

export function BlockResultCard({
  block,
  parent,
  author,
  referenceCount,
  onClick,
}: BlockResultCardProps) {
  const { openShareMenu } = useShareMenu();
  const color = getBlockColor(block.type);
  const blockName = block.name || getDefaultBlockName(block.type);
  const { content, isCode } = getContentPreview(block);
  const isMediaBlock = ["image", "video"].includes(block.type.toLowerCase());
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
          contentType: "block",
          contentId: block.id,
          contentMeta: { title: blockName, parentSlug: parent.blueprintId },
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
              background: `${color}26`,
              color: color,
              border: `1px solid ${color}4D`,
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
                background: `${color}26`,
                color: color,
                border: `1px solid ${color}4D`,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
              {block.type}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          <CollectionBookmarkButton
            contentType="block"
            contentId={block.id}
            contentMeta={{ title: blockName, parentSlug: parent.blueprintId }}
          />
          <ShareTrigger
            contentType="block"
            contentId={block.id}
            contentMeta={{ title: blockName, parentSlug: parent.blueprintId }}
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
        {blockName}
      </h3>

      <p style={{
        marginTop: 6, fontSize: 13,
        color: "rgba(255,255,255,0.50)", lineHeight: 1.6, margin: 0,
      }}>
        From <span style={{ color: "rgba(255,255,255,0.70)" }}>{parent.blueprintTitle}</span>
        {" · in "}
        <span style={{ color: "rgba(255,255,255,0.70)" }}>{parent.stageName}</span>
      </p>

      {/* Content preview */}
      <div
        style={{
          marginTop: 12,
          borderRadius: 10,
          overflow: "hidden",
          background: "rgba(0,0,0,0.25)",
          border: "1px solid rgba(255,255,255,0.04)",
          padding: 12,
        }}
      >
        {isMediaBlock ? (
          <div className="text-[12px]" style={{ color: "rgba(255,255,255,0.45)" }}>
            {block.type.toLowerCase() === "image" ? "🖼️" : "🎬"} {block.type} thumbnail
          </div>
        ) : (
          <pre
            className="whitespace-pre-wrap text-[12px] leading-relaxed"
            style={{
              color: "rgba(255,255,255,0.75)",
              fontFamily: isCode ? "ui-monospace, SFMono-Regular, monospace" : "Inter, sans-serif",
              margin: 0,
            }}
          >
            {content}
          </pre>
        )}
      </div>

      {referenceCount && referenceCount > 0 && (
        <div className="mt-3 text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
          Used {referenceCount}× in other blueprints
        </div>
      )}
    </article>
  );
}
