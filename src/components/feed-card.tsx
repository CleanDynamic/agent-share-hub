import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Heart, MessageCircle, Download, ExternalLink, MoreHorizontal } from "lucide-react"
import { AccountHoverCard } from "@/components/account-hover-card"

// Content type badge colors
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
  default: { bg: "rgba(255, 255, 255, 0.08)", color: "rgba(255, 255, 255, 0.7)", border: "rgba(255, 255, 255, 0.1)" },
}

export interface FeedPost {
  id: string
  title: string
  description?: string
  content_type: string
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
  return `${Math.floor(diffDays / 30)}mo`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
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

  const contentTypeStyle = CONTENT_TYPE_COLORS[post.content_type.toLowerCase()] || CONTENT_TYPE_COLORS.default
  const avatarStyle = post.author.avatar_url ? null : getAvatarStyle(post.author.display_name)
  const initials = getInitials(post.author.display_name)

  // Character limit for initial preview
  const PREVIEW_LIMIT = 500
  const description = post.description ?? ""

  // Initial preview: show up to 500 characters
  const hasMoreContent = description.length > PREVIEW_LIMIT
  const previewText = hasMoreContent
    ? description.slice(0, PREVIEW_LIMIT).trim() + "..."
    : description

  // Remaining text (only shown on Stage 1 expansion)
  const remainingText = hasMoreContent
    ? description.slice(PREVIEW_LIMIT).trim()
    : ""

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
    if (expandStage === 0 && hasMoreContent) {
      setExpandStage(1)
    } else if (expandStage === 0 && !hasMoreContent && hasWTE) {
      setExpandStage(2)
    } else if (expandStage === 1 && hasWTE) {
      setExpandStage(2)
    } else {
      setExpandStage(0)
    }
  }

  const displayContentType = (type: string) => {
    return type.toUpperCase().replace("-", " ")
  }

  return (
    <article
      className="group relative cursor-pointer transition-all duration-300 hover:bg-white/[0.02]"
      style={{
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '12px',
        display: 'block',
        width: '100%',
        boxSizing: 'border-box' as const,
        background: "linear-gradient(135deg, rgba(27, 27, 32, 0.4) 0%, rgba(27, 27, 32, 0.35) 100%)",
        backdropFilter: "blur(60px)",
        WebkitBackdropFilter: "blur(60px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderTopColor: "rgba(255, 255, 255, 0.12)",
        borderLeftColor: "rgba(255, 255, 255, 0.12)",
        boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 8px 32px rgba(0, 0, 0, 0.3)",
        cursor: "pointer",
      }}
      onClick={() => navigate(`/content/${post.id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3" style={{ gap: '12px', marginBottom: '8px' }}>
        <div className="flex items-start gap-2.5">
          {/* Avatar - with hover card */}
          <AccountHoverCard account={post.author}>
            {post.author.avatar_url ? (
              <img
                src={post.author.avatar_url}
                alt={post.author.display_name}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0 hover:opacity-80 transition-opacity"
                style={{ width: '38px', height: '38px', flexShrink: 0 }}
              />
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 hover:opacity-80 transition-opacity"
                style={{
                  width: '38px',
                  height: '38px',
                  flexShrink: 0,
                  background: avatarStyle?.bg,
                  color: avatarStyle?.color,
                  border: `1px solid ${avatarStyle?.border}`,
                }}
              >
                {initials}
              </div>
            )}
          </AccountHoverCard>

          {/* Meta - horizontal alignment */}
          <div className="flex flex-col min-w-0">
            {/* Top line: username, content type, time - all horizontal */}
            <div className="flex items-center gap-2 flex-wrap">
              <AccountHoverCard account={post.author}>
                <span className="font-medium text-white hover:underline" style={{ fontSize: '13px', fontWeight: 600 }}>
                  {post.author.display_name}
                </span>
              </AccountHoverCard>
              <AccountHoverCard account={post.author}>
                <span className="text-white/40 hover:underline" style={{ fontSize: '12px' }}>@{post.author.username}</span>
              </AccountHoverCard>
              <span className="text-white/25">·</span>
              {/* Content Type Badge - inline with username */}
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
                style={{
                  fontSize: '10px',
                  background: contentTypeStyle.bg,
                  color: contentTypeStyle.color,
                  border: `1px solid ${contentTypeStyle.border}`,
                }}
              >
                {displayContentType(post.content_type)}
              </span>
              <span className="text-white/25">·</span>
              <span className="text-white/40" style={{ fontSize: '12px' }}>{getTimeAgo(post.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Menu button */}
        <button
          className="p-1 text-white/30 hover:text-white/60 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Title - smaller, closer to description */}
      <h3 className="font-playfair font-medium text-white mt-2" style={{ marginTop: '8px', marginBottom: '6px', fontSize: '15px', lineHeight: '1.35' }}>
        {post.title}
      </h3>

      {/* Preview text (always visible) - up to 500 chars */}
      {previewText && (
        <p className="text-white/50 leading-relaxed" style={{ marginTop: '8px', marginBottom: '8px', fontSize: '13px', lineHeight: '1.6' }}>{previewText}</p>
      )}

      {/* Cover image (always visible if present) */}
      {post.cover_image_url && (
        <div className="relative mt-4 rounded-xl overflow-hidden">
          <img
            src={post.cover_image_url}
            alt={post.title}
            className="w-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-105"
            style={{ height: '160px', objectFit: 'cover', width: '100%', borderRadius: '8px' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      )}

      {/* STAGE 1: Remaining description reveal (no duplication) */}
      {hasMoreContent && (
        <div
          className="overflow-hidden transition-all"
          style={{
            maxHeight: expandStage >= 1 ? "400px" : "0px",
            opacity: expandStage >= 1 ? 1 : 0,
            transitionDuration: "0.55s",
            transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {/* Continue from where preview left off */}
          <p className="text-white/55 leading-relaxed" style={{ fontSize: '13px', lineHeight: '1.6' }}>{remainingText}</p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {tags.map((tag) => (
                <span key={tag} className="text-xs text-[#2EC4B6]">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STAGE 2: What to expect reveal */}
      {hasWTE && (
        <div
          className="overflow-hidden transition-all"
          style={{
            maxHeight: expandStage >= 2 ? "500px" : "0px",
            opacity: expandStage >= 2 ? 1 : 0,
            transitionDuration: "0.65s",
            transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <hr className="border-t border-white/5 my-3" />
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/28 mb-2">
            What to expect
          </div>
          <p className="text-sm text-white/60 leading-relaxed">{post.what_to_expect}</p>
          {post.what_to_expect_blocks?.map((block, i) => (
            <div key={i} className="mt-2">
              {block.type === "heading" ? (
                <h4 className="text-[13px] font-bold text-white">{block.content}</h4>
              ) : (
                <p className="text-sm text-white/60">{block.content}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Show more / less button */}
      {canExpand && (
        <>
          <hr className="border-t border-white/5 my-3" />
          <button
            className="text-xs text-white/35 hover:text-white/75 transition-colors py-1"
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

      {/* Footer actions */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5" style={{ marginTop: '14px', paddingTop: '12px' }}>
        <div className="flex items-center gap-5">
          <button
            className={`flex items-center gap-1.5 transition-colors ${
              isLiked ? "text-red-500" : "text-white/40 hover:text-red-400"
            }`}
            style={{ fontSize: '12px' }}
            onClick={handleLike}
          >
            <Heart className={`w-4 h-4 ${isLiked ? "fill-current" : ""}`} />
            <span>{likeCount}</span>
          </button>
          <button
            className="flex items-center gap-1.5 text-white/40 hover:text-[#2EC4B6] transition-colors"
            style={{ fontSize: '12px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <MessageCircle className="w-4 h-4" />
            <span>{post.comment_count ?? 0}</span>
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button
            className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors"
            style={{ fontSize: '12px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="w-4 h-4" />
            <span>{post.download_count ?? 0}</span>
          </button>
          <button
            className="text-white/40 hover:text-white/70 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  )
}
