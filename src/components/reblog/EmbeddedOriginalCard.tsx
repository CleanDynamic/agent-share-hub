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
  /* BG-P18. Three more of the retired content-type colours. A post type is not
     a part category and carries no hue, so all three resolve to the kit's
     neutral chip pair — `--text2` on `--recess`, measured in both themes. */
  blueprint: { color: "var(--text2)", bg: "var(--recess)" },
  blog: { color: "var(--text2)", bg: "var(--recess)" },
  bounty: { color: "var(--text2)", bg: "var(--recess)" },
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
        color: "var(--text2)",
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
        /* The quoted post is a surface cut INTO the reblog card, so `--recess`
           rather than a second glass: a card inside a card at the same tone
           reads as one confusing object. `--r-media` is the step below the
           card's own, which is the relationship. */
        background: "var(--recess)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-media)",
        padding,
        cursor: "pointer",
        transition: "background 0.15s ease, border-color 0.15s ease",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "var(--text2)";
        el.style.background = "var(--glass-2)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "var(--line)";
        el.style.background = "var(--recess)";
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
                color: "var(--text)",
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
                color: "var(--text2)",
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
              color: "var(--text)",
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
                color: "var(--text2)",
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
