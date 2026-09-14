"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, FileX } from "lucide-react";
import { type } from "@/lib/theme/type";

export interface Excerpt {
  text: string;
  sourceBlockId?: string;
  sourceBlockTypeLabel?: string;
}

export interface SourcePost {
  id: string;
  slug: string;
  postType: "blueprint" | "blog" | "bounty";
  title: string;
  authorDisplayName: string;
  authorHandle: string;
  authorAvatarUrl?: string;
  publishedAt: string;
  coverUrl?: string;
}

export interface EmbeddedExcerptCardProps {
  excerpt: Excerpt;
  sourcePost: SourcePost | null;
  isExcerptStillValid: boolean;
  isSourceAvailable: boolean;
  onClick?: () => void;
}

const POST_TYPE_STYLES: Record<
  SourcePost["postType"],
  { bg: string; text: string; label: string }
> = {
  blueprint: { bg: "color-mix(in srgb, var(--action) 18%, transparent)", text: "var(--action)", label: "Blueprint" },
  blog: { bg: "rgba(45, 185, 160, 0.18)", text: "#2DB9A0", label: "Blog" },
  bounty: { bg: "rgba(234, 179, 8, 0.18)", text: "#EAB308", label: "Bounty" },
};

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHrs = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHrs < 24) return `${diffHrs}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function EmbeddedExcerptCard({
  excerpt,
  sourcePost,
  isExcerptStillValid,
  isSourceAvailable,
  onClick,
}: EmbeddedExcerptCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (!isSourceAvailable || !sourcePost) {
    return (
      <div
        className="flex items-start gap-3 rounded-xl"
        style={{
          padding: "14px 16px",
          background: "rgba(82, 82, 100, 0.25)",
          border: "0.5px solid var(--line)",
        }}
      >
        <FileX size={16} style={{ color: "var(--text2)", marginTop: 2 }} />
        <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5 }}>
          <div
            style={{
              fontStyle: "italic",
              color: "var(--text2)",
              marginBottom: 4,
            }}
          >
            “{excerpt.text.slice(0, 200)}{excerpt.text.length > 200 ? "…" : ""}”
          </div>
          This excerpt is from a post that has been deleted or made private.
        </div>
      </div>
    );
  }

  const pill = POST_TYPE_STYLES[sourcePost.postType];
  const tooLong = excerpt.text.length > 360;
  const displayText = tooLong && !expanded ? excerpt.text.slice(0, 360) + "…" : excerpt.text;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="group"
      style={{
        background: "rgba(82, 82, 100, 0.40)",
        border: "0.5px solid var(--line)",
        borderRadius: 10,
        padding: "14px 16px",
        cursor: onClick ? "pointer" : "default",
        transition: "background 150ms ease, filter 150ms ease",
      }}
    >
      {/* Top row */}
      <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
        {sourcePost.authorAvatarUrl ? (
          <img
            src={sourcePost.authorAvatarUrl}
            alt=""
            style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "var(--recess)",
            }}
          />
        )}
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text)",
          }}
        >
          {sourcePost.authorDisplayName}
        </span>
        <span style={{ fontSize: 12, color: "var(--text2)" }}>
          @{sourcePost.authorHandle}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            padding: "2px 8px",
            borderRadius: 999,
            background: pill.bg,
            color: pill.text,
          }}
        >
          {pill.label.toUpperCase()}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "var(--text2)" }}>
          {formatTimestamp(sourcePost.publishedAt)}
        </span>
      </div>

      {/* Quote block */}
      <div
        style={{
          borderLeft: "2px solid var(--action)",
          paddingLeft: 12,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            ...type.cardTitle,
            fontStyle: "italic",

            color: "var(--text)",
            whiteSpace: "pre-wrap",
          }}
        >
          {displayText}
        </div>
        {tooLong && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="flex items-center gap-1"
            style={{
              marginTop: 6,
              background: "none",
              border: "none",
              padding: 0,
              fontSize: 12,
              fontWeight: 500,
              color: "var(--action)",
              cursor: "pointer",
            }}
          >
            {expanded ? (
              <>
                Show less <ChevronUp size={12} />
              </>
            ) : (
              <>
                Show more <ChevronDown size={12} />
              </>
            )}
          </button>
        )}
      </div>

      {!isExcerptStillValid && (
        <div
          className="flex items-center gap-1.5"
          style={{ marginBottom: 8, fontSize: 11, color: "rgba(234, 179, 8, 0.85)" }}
        >
          <AlertTriangle size={12} />
          <span>Excerpt may have been edited since this was quoted</span>
        </div>
      )}

      {/* Context line */}
      <div className="flex items-center gap-2">
        <span
          style={{
            fontSize: 12,
            color: "var(--text2)",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          From:{" "}
          <span style={{ color: "var(--text)", fontWeight: 500 }}>
            {sourcePost.title}
          </span>
          {excerpt.sourceBlockTypeLabel && (
            <span style={{ color: "var(--text2)" }}>
              {` in ${excerpt.sourceBlockTypeLabel}`}
            </span>
          )}
        </span>
        {sourcePost.coverUrl && (
          <img
            src={sourcePost.coverUrl}
            alt=""
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        )}
      </div>
    </div>
  );
}
