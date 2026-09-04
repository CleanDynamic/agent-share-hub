"use client";

import React from "react";

export interface EmbeddedOriginalCardPost {
  id: string;
  slug: string;
  postType: "blueprint" | "blog" | "bounty";
  title: string;
  description?: string;
  authorDisplayName: string;
  authorHandle: string;
  authorAvatarUrl: string;
  publishedAt: string;
  coverUrl?: string;
  blueprintMeta?: { stageCount: number; blockCount: number };
  blogMeta?: { readingMinutes: number };
  bountyMeta?: {
    rewardAmount: number;
    rewardCurrency: string;
    deadline: string;
    status: "open" | "solved";
  };
}

export interface EmbeddedOriginalCardProps {
  variant: "compose" | "feed";
  post: EmbeddedOriginalCardPost;
  onClick: () => void;
}

const PILL_COLORS: Record<
  EmbeddedOriginalCardPost["postType"],
  { color: string; bg: string }
> = {
  blueprint: { color: "#E8571A", bg: "rgba(232, 87, 26, 0.14)" },
  blog: { color: "#2EC4B6", bg: "rgba(46, 196, 182, 0.14)" },
  bounty: { color: "#F59E0B", bg: "rgba(245, 158, 11, 0.14)" },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PostTypePill({ postType }: { postType: EmbeddedOriginalCardPost["postType"] }) {
  const { color, bg } = PILL_COLORS[postType];
  return (
    <span
      style={{
        fontFamily: "Figtree, sans-serif",
        fontSize: "9px",
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color,
        backgroundColor: bg,
        padding: "2px 6px",
        borderRadius: "100px",
        lineHeight: "14px",
        whiteSpace: "nowrap",
      }}
    >
      {postType}
    </span>
  );
}

function MetaRow({
  post,
}: {
  post: EmbeddedOriginalCardPost;
  variant: "compose" | "feed";
}) {
  const items: string[] = [];

  if (post.postType === "blueprint" && post.blueprintMeta) {
    items.push(`${post.blueprintMeta.stageCount} stages`);
    items.push(`${post.blueprintMeta.blockCount} blocks`);
    items.push(`published ${formatDate(post.publishedAt)}`);
  } else if (post.postType === "blog" && post.blogMeta) {
    items.push(`${post.blogMeta.readingMinutes} min read`);
    items.push(`published ${formatDate(post.publishedAt)}`);
  } else if (post.postType === "bounty" && post.bountyMeta) {
    if (post.bountyMeta.status === "solved") {
      items.push("Solved");
    } else {
      items.push(
        `${post.bountyMeta.rewardAmount} ${post.bountyMeta.rewardCurrency}`
      );
      items.push(formatDate(post.bountyMeta.deadline));
    }
  } else {
    items.push(`published ${formatDate(post.publishedAt)}`);
  }

  return (
    <div
      style={{
        marginTop: "6px",
        height: "16px",
        fontFamily: "Figtree, sans-serif",
        fontSize: "10px",
        fontWeight: 400,
        color: "rgba(255, 255, 255, 0.45)",
        display: "flex",
        alignItems: "center",
        gap: "0px",
        overflow: "hidden",
      }}
    >
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span style={{ margin: "0 5px", opacity: 0.7 }}>·</span>
          )}
          <span style={{ whiteSpace: "nowrap" }}>{item}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

export function EmbeddedOriginalCard({
  variant,
  post,
  onClick,
}: EmbeddedOriginalCardProps) {
  const isCompose = variant === "compose";
  const hasCover = !!post.coverUrl;

  const padding = isCompose ? "12px 14px" : "14px 16px";
  const titleSize = isCompose ? "13px" : "14px";
  const descClamp = isCompose ? 1 : 2;

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        background: "rgba(82, 82, 100, 0.40)",
        border: "0.5px solid rgba(255, 255, 255, 0.10)",
        borderRadius: "10px",
        padding,
        cursor: "pointer",
        transition: "background 0.15s ease, border-color 0.15s ease",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "rgba(255, 255, 255, 0.16)";
        el.style.background = "rgba(82, 82, 100, 0.55)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "rgba(255, 255, 255, 0.10)";
        el.style.background = "rgba(82, 82, 100, 0.40)";
      }}
      aria-label={`Original post: ${post.title} by ${post.authorDisplayName}`}
    >
      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              height: "20px",
            }}
          >
            <img
              src={post.authorAvatarUrl}
              alt={`${post.authorDisplayName}'s avatar`}
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "Figtree, sans-serif",
                fontSize: "12px",
                fontWeight: 600,
                color: "rgba(255, 255, 255, 0.85)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {post.authorDisplayName}
            </span>
            <span
              style={{
                fontFamily: "Figtree, sans-serif",
                fontSize: "11px",
                fontWeight: 400,
                color: "rgba(255, 255, 255, 0.45)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {post.authorHandle}
            </span>
            <PostTypePill postType={post.postType} />
          </div>

          <div
            style={{
              marginTop: "6px",
              fontFamily: "Figtree, sans-serif",
              fontSize: titleSize,
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.95)",
              lineHeight: "1.35",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {post.title}
          </div>

          {post.description && (
            <div
              style={{
                marginTop: "2px",
                fontFamily: "Figtree, sans-serif",
                fontSize: "11px",
                fontWeight: 400,
                color: "rgba(255, 255, 255, 0.65)",
                lineHeight: "1.4",
                display: "-webkit-box",
                WebkitLineClamp: descClamp,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {post.description}
            </div>
          )}

          <MetaRow post={post} variant={variant} />
        </div>

        {hasCover && (
          <img
            src={post.coverUrl}
            alt={`Cover for ${post.title}`}
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "6px",
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
        )}
      </div>
    </div>
  );
}
