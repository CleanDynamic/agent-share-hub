import { ArrowUpRight } from "lucide-react";

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
  const color = getBlockColor(block.type);
  const blockName = block.name || getDefaultBlockName(block.type);
  const { content, isCode } = getContentPreview(block);
  const isMediaBlock = ["image", "video"].includes(block.type.toLowerCase());

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
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: color,
              display: "inline-block",
            }}
          />
          <span
            className="text-[11px] font-medium uppercase tracking-wide"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            {block.type}
          </span>
          <span style={{ color: "rgba(255,255,255,0.30)" }}>·</span>
          <span
            className="text-[12px] font-semibold"
            style={{ color: "rgba(255,255,255,0.90)" }}
          >
            {blockName}
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
        className="mt-3 rounded-md p-3"
        style={{
          background: "rgba(0,0,0,0.25)",
          border: "0.5px solid rgba(255,255,255,0.04)",
        }}
      >
        {isMediaBlock ? (
          <div
            className="text-[12px]"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
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

      <div className="mt-3 text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
        From <span style={{ color: "rgba(255,255,255,0.65)" }}>{parent.blueprintTitle}</span>
        {" · in "}
        <span style={{ color: "rgba(255,255,255,0.65)" }}>{parent.stageName}</span>
        {" · by "}
        <span style={{ color: "rgba(255,255,255,0.65)" }}>@{author.handle}</span>
      </div>

      {referenceCount && referenceCount > 0 && (
        <div className="mt-2 text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
          Used {referenceCount}× in other blueprints
        </div>
      )}
    </div>
  );
}
