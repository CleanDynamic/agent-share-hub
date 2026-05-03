import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  MoreHorizontal,
  BadgeCheck,
  Sparkles,
  ChevronRight,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
interface PostMeta {
  id: string;
  slug: string;
  postType: "blueprint" | "blog" | "bounty";
  title: string;
  description: string;
  coverUrl?: string;
  publishedAt: Date;
  readingMinutes: number;
  domain: string;
  difficulty: string;
  tags: string[];
  stageCount?: number;
  blockCount?: number;
  connectionCount?: number;
  bountyMeta?: {
    reward: number;
    daysLeft: number;
    isSolved: boolean;
    slotsTotal: number;
    slotsFilled: number;
  };
  derivedAuthorBio: string;
}

interface Author {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string;
  isVerified: boolean;
  level: number;
  customBio?: string;
  derivedBio: string;
  isTrustedSolver: boolean;
  isFollowing: boolean;
  isFollowedByCurrentUser: boolean;
  stats: {
    blueprintCount: number;
    followerCount: number;
    bountiesSolved: number;
  };
}

export interface RelatedPostCardData {
  id: string;
  slug: string;
  title: string;
  coverUrl?: string;
  postType: "blueprint" | "blog" | "bounty";
  author: { displayName: string; avatarUrl: string };
  readingMinutes: number;
}

export interface ContentDetailShellProps {
  post: PostMeta;
  author: Author;
  bountySolvers: unknown[];
  isOwnPost: boolean;
  relatedPosts: RelatedPostCardData[];
  onBack: () => void;
  onAuthorClick: (authorId: string) => void;
  onFollow: (authorId: string) => void;
  onUnfollow: (authorId: string) => void;
  onPostMenu: () => void;
  onScrollProgress?: (pct: number) => void;
  onScrollActivity?: () => void;
  resultsSlot?: React.ReactNode;
  bountyExtrasSlot?: React.ReactNode;
  /** When provided, replaces the default byline (author row + follow button). */
  bylineSlot?: React.ReactNode;
  children?: React.ReactNode;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays <= 0) return "Published today";
  if (diffDays === 1) return "Published 1d ago";
  if (diffDays < 30) return `Published ${diffDays}d ago`;
  const m = Math.floor(diffDays / 30);
  return m === 1 ? "Published 1mo ago" : `Published ${m}mo ago`;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const TYPE_COLOR: Record<PostMeta["postType"], string> = {
  blueprint: "#E8571A",
  blog: "#2EC4B6",
  bounty: "#F59E0B",
};

function PostTypePill({
  postType,
  bountyMeta,
}: {
  postType: PostMeta["postType"];
  bountyMeta?: PostMeta["bountyMeta"];
}) {
  const labels: Record<PostMeta["postType"], { label: string; sub?: string }> = {
    blueprint: { label: "BLUEPRINT", sub: "BUILD" },
    blog: { label: "BLOG" },
    bounty: { label: "BOUNTY" },
  };
  const cfg = labels[postType];
  const color = TYPE_COLOR[postType];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1,
          color,
          background: `${color}1f`,
          border: `1px solid ${color}40`,
          padding: "4px 10px",
          borderRadius: 4,
        }}
      >
        {cfg.label}
        {cfg.sub && (
          <span style={{ opacity: 0.6, marginLeft: 6 }}>| {cfg.sub}</span>
        )}
      </span>
      {postType === "bounty" && bountyMeta?.isSolved && (
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 10,
            fontWeight: 700,
            color: "#2EC4B6",
            background: "rgba(46,196,182,0.14)",
            border: "1px solid rgba(46,196,182,0.30)",
            padding: "3px 8px",
            borderRadius: 4,
          }}
        >
          SOLVED
        </span>
      )}
      {postType === "bounty" && !bountyMeta?.isSolved && bountyMeta && (
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            color: "rgba(255,255,255,0.55)",
          }}
        >
          Open · {bountyMeta.slotsFilled} of {bountyMeta.slotsTotal} slots
        </span>
      )}
    </div>
  );
}

function MetaSeparator() {
  return (
    <span style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
  );
}

function RelatedPostCard({ post }: { post: RelatedPostCardData }) {
  const color = TYPE_COLOR[post.postType] ?? "#888";
  return (
    <a
      href={`/content/${post.slug || post.id}`}
      style={{
        display: "block",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 12,
        overflow: "hidden",
        textDecoration: "none",
        transition: "border-color 120ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
      }}
    >
      {post.coverUrl && (
        <div
          style={{
            aspectRatio: "16/9",
            background: `url(${post.coverUrl}) center/cover`,
          }}
        />
      )}
      <div style={{ padding: 12 }}>
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
            color,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {post.postType}
        </div>
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            fontWeight: 600,
            color: "rgba(255,255,255,0.88)",
            marginBottom: 8,
            lineHeight: 1.35,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {post.title}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            color: "rgba(255,255,255,0.45)",
          }}
        >
          {post.author.avatarUrl && (
            <img
              src={post.author.avatarUrl}
              alt=""
              style={{ width: 16, height: 16, borderRadius: "50%" }}
            />
          )}
          <span>{post.author.displayName}</span>
          <span>· {post.readingMinutes} min</span>
        </div>
      </div>
    </a>
  );
}

// ─── Main Shell ─────────────────────────────────────────────────────────────
export function ContentDetailShell({
  post,
  author,
  isOwnPost,
  relatedPosts,
  onBack,
  onAuthorClick,
  onFollow,
  onUnfollow,
  onPostMenu,
  onScrollProgress,
  onScrollActivity,
  resultsSlot,
  bountyExtrasSlot,
  bylineSlot,
  children,
}: ContentDetailShellProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showStickyTitle, setShowStickyTitle] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [authorCardExpanded, setAuthorCardExpanded] = useState(false);
  const [isFollowing, setIsFollowing] = useState(author.isFollowedByCurrentUser);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastReportRef = useRef(0);

  useEffect(() => {
    setIsFollowing(author.isFollowedByCurrentUser);
  }, [author.isFollowedByCurrentUser]);

  useEffect(() => {
    const onScroll = () => {
      const el = containerRef.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      const pct = max > 0 ? (el.scrollTop / max) * 100 : 0;
      const clamped = Math.max(0, Math.min(100, pct));
      setScrollProgress(clamped);
      if (titleRef.current) {
        const r = titleRef.current.getBoundingClientRect();
        setShowStickyTitle(r.bottom < 56);
      }
      const now = Date.now();
      if (onScrollProgress && now - lastReportRef.current > 1000) {
        lastReportRef.current = now;
        onScrollProgress(clamped);
      }
      onScrollActivity?.();
    };
    const el = containerRef.current;
    el?.addEventListener("scroll", onScroll);
    onScroll();
    return () => el?.removeEventListener("scroll", onScroll);
  }, [onScrollProgress]);

  const handleFollow = () => {
    if (isFollowing) onUnfollow(author.id);
    else onFollow(author.id);
    setIsFollowing(!isFollowing);
  };

  const isBlog = post.postType === "blog";
  const titleFont = isBlog ? "Playfair Display, serif" : "Inter, sans-serif";
  const descStyle: React.CSSProperties = isBlog
    ? { fontStyle: "italic", fontFamily: "Inter, sans-serif" }
    : { fontFamily: "Inter, sans-serif" };

  return (
    <div
      ref={containerRef}
      style={{
        height: "100%",
        overflowY: "auto",
        background: "transparent",
        position: "relative",
      }}
    >
      {/* PAGE STATUS BAR */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          background: "rgba(7,7,13,0.72)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.65)",
            fontSize: 13,
            fontFamily: "Inter, sans-serif",
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div
          style={{
            flex: 1,
            textAlign: "center",
            fontFamily: titleFont,
            fontSize: 13,
            fontWeight: 600,
            color: "rgba(255,255,255,0.85)",
            opacity: showStickyTitle ? 1 : 0,
            transition: "opacity 200ms ease",
            padding: "0 24px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {post.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 80,
              height: 3,
              borderRadius: 2,
              background: "rgba(255,255,255,0.06)",
              overflow: "hidden",
            }}
            aria-label="Reading progress"
          >
            <div
              style={{
                width: `${scrollProgress}%`,
                height: "100%",
                background: TYPE_COLOR[post.postType],
                transition: "width 150ms linear",
              }}
            />
          </div>
          <button
            onClick={onPostMenu}
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.55)",
              cursor: "pointer",
              padding: 4,
            }}
            aria-label="Post menu"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>

      {/* POST HEADER REGION */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px 0" }}>
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <PostTypePill postType={post.postType} bountyMeta={post.bountyMeta} />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", fontFamily: "Inter, sans-serif" }}>
            {formatRelativeTime(post.publishedAt)}
          </span>
        </div>

        {post.coverUrl && (
          <div
            style={{
              borderRadius: 12,
              overflow: "hidden",
              marginBottom: 24,
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <img
              src={post.coverUrl}
              alt={post.title}
              style={{ width: "100%", display: "block" }}
            />
          </div>
        )}

        <h1
          ref={titleRef}
          style={{
            fontFamily: titleFont,
            fontSize: isBlog ? 36 : 32,
            fontWeight: 700,
            color: "rgba(255,255,255,0.95)",
            lineHeight: 1.2,
            margin: "0 0 16px",
          }}
        >
          {post.title}
        </h1>

        {post.description && (
          <div style={{ marginBottom: 20 }}>
            <p
              style={{
                ...descStyle,
                fontSize: 16,
                color: "rgba(255,255,255,0.70)",
                lineHeight: 1.55,
                margin: 0,
                display: descriptionExpanded ? "block" : "-webkit-box",
                WebkitLineClamp: descriptionExpanded ? undefined : 4,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {post.description}
            </p>
            {post.description.length > 280 && !descriptionExpanded && (
              <button
                onClick={() => setDescriptionExpanded(true)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  marginTop: 4,
                  fontFamily: "Inter, sans-serif",
                  fontSize: 13,
                  fontWeight: 500,
                  color: TYPE_COLOR[post.postType],
                }}
              >
                Read more
              </button>
            )}
          </div>
        )}

        {/* Byline */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <button
            onClick={() => onAuthorClick(author.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <img
              src={author.avatarUrl}
              alt={author.displayName}
              style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.10)" }}
            />
            <div style={{ textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.90)" }}>
                  {author.displayName}
                </span>
                {author.isVerified && <BadgeCheck size={14} color="#2EC4B6" />}
              </div>
              <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
                @{author.handle}
              </span>
            </div>
          </button>
          {!isOwnPost && (
            <button
              onClick={handleFollow}
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 12,
                fontWeight: 500,
                color: isFollowing ? "rgba(255,255,255,0.60)" : "#E8571A",
                backgroundColor: isFollowing ? "rgba(255,255,255,0.06)" : "rgba(232,87,26,0.14)",
                border: "none",
                borderRadius: 100,
                padding: "6px 14px",
                cursor: "pointer",
              }}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          )}
        </div>

        {author.derivedBio && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 16,
              fontFamily: "Inter, sans-serif",
              fontSize: 12,
              color: "rgba(255,255,255,0.50)",
              fontStyle: "italic",
            }}
          >
            <Sparkles size={12} />
            <span>{author.derivedBio}</span>
          </div>
        )}

        {/* Meta row */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            paddingTop: 16,
            paddingBottom: 24,
            borderTop: "1px solid rgba(255,255,255,0.05)",
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
            color: "rgba(255,255,255,0.55)",
          }}
        >
          <span>{post.readingMinutes} min read</span>
          <MetaSeparator />
          <span>{post.domain}</span>
          <MetaSeparator />
          <span>{post.difficulty}</span>
          {post.tags.slice(0, 5).map((t, i) => (
            <React.Fragment key={t + i}>
              <MetaSeparator />
              <span style={{ color: "rgba(255,255,255,0.45)" }}>#{t}</span>
            </React.Fragment>
          ))}
          {post.tags.length > 5 && (
            <>
              <MetaSeparator />
              <span style={{ color: "rgba(255,255,255,0.40)" }}>+{post.tags.length - 5}</span>
            </>
          )}
          {post.postType === "blueprint" && post.stageCount != null && (
            <>
              <MetaSeparator />
              <span>
                {post.stageCount} stages · {post.blockCount ?? 0} blocks · {post.connectionCount ?? 0} connections
              </span>
            </>
          )}
          {post.postType === "bounty" && post.bountyMeta && (
            <>
              <MetaSeparator />
              <span>
                Reward: ${post.bountyMeta.reward} · {post.bountyMeta.daysLeft} days left
              </span>
            </>
          )}
        </div>
      </div>

      {/* RESULTS CAROUSEL */}
      {resultsSlot && (
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 24px 24px" }}>
          {resultsSlot}
        </div>
      )}

      {/* ARTICLE BODY */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 32px" }}>
        {children}
        {post.postType === "bounty" && bountyExtrasSlot}
      </div>

      {/* AUTHOR INFO CARD */}
      <div style={{ maxWidth: 720, margin: "32px auto", padding: "0 24px" }}>
        <div
          onClick={() => setAuthorCardExpanded(!authorCardExpanded)}
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12,
            padding: 16,
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src={author.avatarUrl}
                alt={author.displayName}
                style={{ width: 44, height: 44, borderRadius: "50%" }}
              />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.92)" }}>
                    {author.displayName}
                  </span>
                  {author.isVerified && <BadgeCheck size={14} color="#2EC4B6" />}
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Lv.{author.level}</span>
                  {author.isTrustedSolver && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#2EC4B6",
                        background: "rgba(46,196,182,0.12)",
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}
                    >
                      Trusted Solver
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.50)" }}>@{author.handle}</div>
              </div>
            </div>
            {!isOwnPost && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleFollow();
                }}
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 12,
                  fontWeight: 500,
                  color: isFollowing ? "rgba(255,255,255,0.60)" : "#E8571A",
                  backgroundColor: isFollowing ? "rgba(255,255,255,0.06)" : "rgba(232,87,26,0.14)",
                  border: "none",
                  borderRadius: 100,
                  padding: "6px 14px",
                  cursor: "pointer",
                }}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            )}
          </div>
          {authorCardExpanded && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.70)", lineHeight: 1.5, margin: "0 0 8px" }}>
                {author.customBio || author.derivedBio}
              </p>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.50)", display: "flex", gap: 8 }}>
                <span>{author.stats.blueprintCount} blueprints</span>
                <span>·</span>
                <span>{formatCount(author.stats.followerCount)} followers</span>
                <span>·</span>
                <span>{author.stats.bountiesSolved} bounties solved</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RELATED POSTS */}
      {relatedPosts.length > 0 && (
        <div style={{ maxWidth: 960, margin: "32px auto 0", padding: "0 24px" }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontFamily: "Inter, sans-serif", fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.88)", margin: 0 }}>
              Related {post.postType === "bounty" ? "bounties" : post.postType === "blog" ? "blogs" : "blueprints"}
            </h3>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.45)", margin: "4px 0 0" }}>
              From similar topics or referencing this content
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            {relatedPosts.map((rp) => (
              <RelatedPostCard key={rp.id} post={rp} />
            ))}
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div style={{ maxWidth: 960, margin: "48px auto 0", padding: "32px 24px 64px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 16, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>
              Want to publish on NeoScale?
            </div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: "rgba(255,255,255,0.50)" }}>
              Share your blueprints, blogs, and bounties with the community.
            </div>
          </div>
          <a
            href="/upload"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: "#E8571A",
              textDecoration: "none",
            }}
          >
            Start creating
            <ChevronRight size={14} />
          </a>
        </div>
        <div style={{ display: "flex", gap: 16, fontFamily: "Inter, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.40)" }}>
          <button style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0 }}>
            Report this post
          </button>
          <button style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0 }}>
            Suggest edit
          </button>
        </div>
      </div>
    </div>
  );
}

export default ContentDetailShell;
