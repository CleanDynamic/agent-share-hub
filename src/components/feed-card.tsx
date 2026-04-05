import { useState } from "react"
import { useNavigate } from 'react-router-dom'
import { Heart, MessageCircle, Download, ExternalLink, MoreHorizontal } from "lucide-react"
import { AccountHoverCard } from "@/components/account-hover-card"

const CONTENT_TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  prompt: { bg: "rgba(232, 87, 26, 0.15)", color: "#E8571A", border: "rgba(232, 87, 26, 0.3)" },
  prompts: { bg: "rgba(232, 87, 26, 0.15)", color: "#E8571A", border: "rgba(232, 87, 26, 0.3)" },
  agent: { bg: "rgba(46, 196, 182, 0.15)", color: "#2EC4B6", border: "rgba(46, 196, 182, 0.3)" },
  agents: { bg: "rgba(46, 196, 182, 0.15)", color: "#2EC4B6", border: "rgba(46, 196, 182, 0.3)" },
  workflow: { bg: "rgba(139, 92, 246, 0.15)", color: "#8B5CF6", border: "rgba(139, 92, 246, 0.3)" },
  blog: { bg: "rgba(59, 130, 246, 0.15)", color: "#3B82F6", border: "rgba(59, 130, 246, 0.3)" },
  tutorial: { bg: "rgba(34, 197, 94, 0.15)", color: "#22C55E", border: "rgba(34, 197, 94, 0.3)" },
  "failure-library": { bg: "rgba(239, 68, 68, 0.15)", color: "#EF4444", border: "rgba(239, 68, 68, 0.3)" },
  "failure library": { bg: "rgba(239, 68, 68, 0.15)", color: "#EF4444", border: "rgba(239, 68, 68, 0.3)" },
  build: { bg: "rgba(232, 87, 26, 0.15)", color: "#E8571A", border: "rgba(232, 87, 26, 0.3)" },
  technique: { bg: "rgba(46, 196, 182, 0.15)", color: "#2EC4B6", border: "rgba(46, 196, 182, 0.3)" },
  discovery: { bg: "rgba(139, 92, 246, 0.15)", color: "#8B5CF6", border: "rgba(139, 92, 246, 0.3)" },
  discussion: { bg: "rgba(59, 130, 246, 0.15)", color: "#3B82F6", border: "rgba(59, 130, 246, 0.3)" },
  default: { bg: "rgba(255, 255, 255, 0.08)", color: "rgba(255, 255, 255, 0.7)", border: "rgba(255, 255, 255, 0.1)" },
}

export interface FeedPost {
  id: string
  title: string
  description?: string
  content_type: string
  post_type?: string | null
  cover_image_url?: string
  created_at: string
  view_count?: number
  comment_count?: number
  download_count?: number
  what_to_expect?: string
  what_to_expect_blocks?: Array<{ type: string; content: string }>
  ai_tools?: string[]
  use_cases?: string[]
  custom_tags?: string[]
  author: {
    display_name: string
    username: string
    avatar_url?: string
    bio?: string
    follower_count?: number
    following_count?: number
    post_count?: number
    joined_date?: string
  }
}

function getTimeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 30) return `${diffDays}d`
  return `${Math.floor(diffDays / 30)}mo`
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

function getAvatarStyle(name: string) {
  const colors = CONTENT_TYPE_COLORS
  const types = Object.keys(colors).filter((k) => k !== "default")
  const index = name.length % types.length
  return colors[types[index]] || colors.default
}

export function FeedCard({ post }: { post: FeedPost }) {
  const navigate = useNavigate()
  const [expandStage, setExpandStage] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post.view_count ?? 0)

  const badgeKey = post.post_type?.toLowerCase() || post.content_type?.toLowerCase() || 'default'
  const contentTypeStyle = CONTENT_TYPE_COLORS[badgeKey] || CONTENT_TYPE_COLORS.default
  const avatarStyle = post.author.avatar_url ? null : getAvatarStyle(post.author.display_name)
  const initials = getInitials(post.author.display_name)

  const PREVIEW_LIMIT = 500
  const description = post.description ?? ""
  const hasMoreContent = description.length > PREVIEW_LIMIT
  const previewText = hasMoreContent
    ? description.slice(0, PREVIEW_LIMIT).trim() + "..."
    : description
  const remainingText = hasMoreContent ? description.slice(PREVIEW_LIMIT).trim() : ""

  const hasWTE = !!(post.what_to_expect || (post.what_to_expect_blocks && post.what_to_expect_blocks.length > 0))
  const canExpand = hasMoreContent || hasWTE
  const tags = [
    ...(post.ai_tools ?? []),
    ...(post.use_cases ?? []),
    ...(post.custom_tags ?? []),
  ].slice(0, 5)

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsLiked(!isLiked)
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1))
  }

  const handleStageClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (expandStage === 0 && hasMoreContent) setExpandStage(1)
    else if (expandStage === 0 && !hasMoreContent && hasWTE) setExpandStage(2)
    else if (expandStage === 1 && hasWTE) setExpandStage(2)
    else setExpandStage(0)
  }

  const displayContentType = (type: string) => {
    return (post.post_type || type).toUpperCase().replace(/-/g, " ")
  }

  return (
    <article
      className="group relative rounded-xl cursor-pointer transition-all duration-300 hover:bg-white/[0.02]"
      style={{
        padding: "14px 16px",
        marginBottom: "10px",
        background: "linear-gradient(135deg, rgba(27, 27, 32, 0.4) 0%, rgba(27, 27, 32, 0.35) 100%)",
        backdropFilter: "blur(60px)",
        WebkitBackdropFilter: "blur(60px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderTopColor: "rgba(255, 255, 255, 0.12)",
        borderLeftColor: "rgba(255, 255, 255, 0.12)",
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 8px 32px rgba(0, 0, 0, 0.3)",
      }}
      onClick={() => navigate(`/content/${post.id}`)}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
          <AccountHoverCard account={post.author}>
            {post.author.avatar_url ? (
              <img
                src={post.author.avatar_url}
                alt={post.author.display_name}
                style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
              />
            ) : (
              <div
                style={{
                  width: 36, height: 36, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 600, flexShrink: 0,
                  background: avatarStyle?.bg,
                  color: avatarStyle?.color,
                  border: `1px solid ${avatarStyle?.border}`,
                }}
              >
                {initials}
              </div>
            )}
          </AccountHoverCard>

          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <AccountHoverCard account={post.author}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                  {post.author.display_name}
                </span>
              </AccountHoverCard>
              <AccountHoverCard account={post.author}>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.40)" }}>
                  @{post.author.username}
                </span>
              </AccountHoverCard>
              <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>·</span>
              <span
                style={{
                  display: "inline-flex", alignItems: "center",
                  padding: "1px 6px", borderRadius: 4,
                  fontSize: 9, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.05em",
                  background: contentTypeStyle.bg,
                  color: contentTypeStyle.color,
                  border: `1px solid ${contentTypeStyle.border}`,
                }}
              >
                {displayContentType(post.content_type)}
              </span>
              <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>·</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.40)" }}>
                {getTimeAgo(post.created_at)}
              </span>
            </div>
          </div>
        </div>

        <button
          style={{ padding: 4, color: "rgba(255,255,255,0.30)", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Title */}
      <h3 style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 15, fontWeight: 500, color: "#fff",
        lineHeight: 1.35, marginTop: 10, marginBottom: 0,
      }}>
        {post.title}
      </h3>

      {/* Preview text */}
      {previewText && (
        <p style={{
          marginTop: 6, fontSize: 13,
          color: "rgba(255,255,255,0.50)", lineHeight: 1.6,
        }}>
          {previewText}
        </p>
      )}

      {/* Cover image */}
      {post.cover_image_url && (
        <div style={{ position: "relative", marginTop: 14, borderRadius: 10, overflow: "hidden" }}>
          <img
            src={post.cover_image_url}
            alt={post.title}
            style={{ width: "100%", height: 160, objectFit: "cover", opacity: 0.8, display: "block" }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent)" }} />
        </div>
      )}

      {/* Stage 1: Remaining description */}
      {hasMoreContent && (
        <div
          style={{
            overflow: "hidden",
            maxHeight: expandStage >= 1 ? "400px" : "0px",
            opacity: expandStage >= 1 ? 1 : 0,
            transition: "max-height 0.55s cubic-bezier(0.4,0,0.2,1), opacity 0.45s ease",
          }}
        >
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
            {remainingText}
          </p>
          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {tags.map((tag) => (
                <span key={tag} style={{ fontSize: 12, color: "#2EC4B6" }}>#{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stage 2: What to expect */}
      {hasWTE && (
        <div
          style={{
            overflow: "hidden",
            maxHeight: expandStage >= 2 ? "500px" : "0px",
            opacity: expandStage >= 2 ? 1 : 0,
            transition: "max-height 0.65s cubic-bezier(0.4,0,0.2,1), opacity 0.50s ease",
          }}
        >
          <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.05)", margin: "12px 0" }} />
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.28)", marginBottom: 8 }}>
            What to expect
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.60)", lineHeight: 1.6 }}>
            {post.what_to_expect}
          </p>
          {post.what_to_expect_blocks?.map((block, i) => (
            <div key={i} style={{ marginTop: 8 }}>
              {block.type === "heading"
                ? <h4 style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{block.content}</h4>
                : <p style={{ fontSize: 13, color: "rgba(255,255,255,0.60)" }}>{block.content}</p>
              }
            </div>
          ))}
        </div>
      )}

      {/* Show more/less */}
      {canExpand && (
        <>
          <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.05)", margin: "10px 0 4px 0" }} />
          <button
            style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}
            onClick={handleStageClick}
          >
            {expandStage === 0 && hasMoreContent && "Show more ↓"}
            {expandStage === 0 && !hasMoreContent && hasWTE && "What to expect ↓"}
            {expandStage === 1 && hasWTE && "What to expect ↓"}
            {expandStage === 1 && !hasWTE && "Show less ↑"}
            {expandStage === 2 && "Show less ↑"}
          </button>
        </>
      )}

      {/* Footer */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginTop: 14, paddingTop: 10,
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <button
            style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 13, background: "none", border: "none", cursor: "pointer",
              color: isLiked ? "#ef4444" : "rgba(255,255,255,0.40)",
              transition: "color 0.15s",
            }}
            onClick={handleLike}
          >
            <Heart size={15} fill={isLiked ? "currentColor" : "none"} />
            <span>{likeCount}</span>
          </button>
          <button
            style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 13, color: "rgba(255,255,255,0.40)",
              background: "none", border: "none", cursor: "pointer",
              transition: "color 0.15s",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <MessageCircle size={15} />
            <span>{post.comment_count ?? 0}</span>
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 13, color: "rgba(255,255,255,0.40)",
              background: "none", border: "none", cursor: "pointer",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Download size={15} />
            <span>{post.download_count ?? 0}</span>
          </button>
          <button
            style={{ color: "rgba(255,255,255,0.40)", background: "none", border: "none", cursor: "pointer" }}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={15} />
          </button>
        </div>
      </div>
    </article>
  )
}
