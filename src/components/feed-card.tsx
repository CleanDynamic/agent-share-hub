import { useState, useRef, useEffect } from "react"
import { useNavigate } from 'react-router-dom'
import { Heart, Repeat2, MoreHorizontal } from "lucide-react"
import { AccountHoverCard } from "@/components/account-hover-card"
import { useAuth } from "@/contexts/AuthContext"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { ReblogComposer, type ReblogComposerOriginal } from "@/components/ReblogComposer"
import { useToast } from "@/hooks/use-toast"
import { getPrimaryTypeLabel } from "@/lib/content-types"

const CONTENT_TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  prompt: { bg: "rgba(139, 69, 19, 0.15)", color: "#8B4513", border: "rgba(139, 69, 19, 0.3)" },
  prompts: { bg: "rgba(139, 69, 19, 0.15)", color: "#8B4513", border: "rgba(139, 69, 19, 0.3)" },
  agent: { bg: "rgba(31, 122, 109, 0.15)", color: "#1F7A6D", border: "rgba(31, 122, 109, 0.3)" },
  agents: { bg: "rgba(31, 122, 109, 0.15)", color: "#1F7A6D", border: "rgba(31, 122, 109, 0.3)" },
  workflow: { bg: "rgba(139, 92, 246, 0.15)", color: "#8B5CF6", border: "rgba(139, 92, 246, 0.3)" },
  blog: { bg: "rgba(59, 130, 246, 0.15)", color: "#3B82F6", border: "rgba(59, 130, 246, 0.3)" },
  tutorial: { bg: "rgba(34, 197, 94, 0.15)", color: "#22C55E", border: "rgba(34, 197, 94, 0.3)" },
  "failure-library": { bg: "rgba(239, 68, 68, 0.15)", color: "#EF4444", border: "rgba(239, 68, 68, 0.3)" },
  "failure library": { bg: "rgba(239, 68, 68, 0.15)", color: "#EF4444", border: "rgba(239, 68, 68, 0.3)" },
  build: { bg: "rgba(139, 69, 19, 0.15)", color: "#8B4513", border: "rgba(139, 69, 19, 0.3)" },
  technique: { bg: "rgba(31, 122, 109, 0.15)", color: "#1F7A6D", border: "rgba(31, 122, 109, 0.3)" },
  discovery: { bg: "rgba(139, 92, 246, 0.15)", color: "#8B5CF6", border: "rgba(139, 92, 246, 0.3)" },
  discussion: { bg: "rgba(59, 130, 246, 0.15)", color: "#3B82F6", border: "rgba(59, 130, 246, 0.3)" },
  default: { bg: "rgba(255, 255, 255, 0.14)", color: "rgba(255, 255, 255, 0.55)", border: "rgba(255, 255, 255, 0.1)" },
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
  what_to_expect_blocks?: Array<{
    type: string;
    content: string;
    position?: number;
  }>
  bounty_enabled?: boolean
  bounty_amount?: number | null
  bounty_status?: string | null
  bounty_reward_type?: string | null
  bounty_reward_currency?: string | null
  bounty_total_slots?: number
  bounty_solved_count?: number
  bounty_active_solvers?: number
  bounty_deadline?: string | null
  bounty_health_score?: number | null
  bounty_is_meta?: boolean
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

function getDeadlineCountdown(deadline?: string | null): { label: string; urgent: boolean } | null {
  if (!deadline) return null
  const ms = new Date(deadline).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  if (ms <= 0) return { label: "Closed", urgent: true }
  const day = 86_400_000
  const hr = 3_600_000
  const days = Math.floor(ms / day)
  const hours = Math.floor((ms % day) / hr)
  if (days >= 2) return { label: `${days}d left`, urgent: false }
  if (days === 1) return { label: `1d ${hours}h left`, urgent: true }
  return { label: `${Math.max(1, hours)}h left`, urgent: true }
}

function formatBountyReward(p: FeedPost): string | null {
  const rt = (p.bounty_reward_type ?? "").toLowerCase()
  if (rt === "kudos") return "Kudos"
  if (rt === "none") return null
  const amt = p.bounty_amount
  if (typeof amt !== "number" || amt <= 0) {
    if (rt === "token") return "Token"
    return null
  }
  if (rt === "token") return `${amt} ${(p.bounty_reward_currency ?? "TOKEN").toUpperCase()}`
  // Default to currency formatting (cash).
  const cur = (p.bounty_reward_currency ?? "GBP").toUpperCase()
  const symbol = cur === "GBP" ? "£" : cur === "USD" ? "$" : cur === "EUR" ? "€" : ""
  return symbol ? `${symbol}${amt}` : `${amt} ${cur}`
}

function getAvatarStyle(name: string) {
  const colors = CONTENT_TYPE_COLORS
  const types = Object.keys(colors).filter((k) => k !== "default")
  const index = name.length % types.length
  return colors[types[index]] || colors.default
}

export function FeedCard({ post }: { post: FeedPost }) {
  const navigate = useNavigate()
  const { isLoggedIn, user } = useAuth()
  const { toast } = useToast()
  const [expandStage, setExpandStage] = useState(0)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post.view_count ?? 0)
  const [reblogOpen, setReblogOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Reblog count
  const { data: reblogCount } = useQuery({
    queryKey: ["reblog_count", post.id],
    queryFn: async () => {
      const { count } = await (supabase
        .from("content_items")
        .select("id", { count: "exact", head: true }) as any)
        .eq("reblog_of_id", post.id)
        .eq("is_reblog", true)
        .eq("status", "approved");
      return count ?? 0;
    },
    staleTime: 60_000,
    enabled: !!post.id,
  });

  const { data: userHasReblogged } = useQuery({
    queryKey: ["user_has_reblogged", post.id, user?.id],
    queryFn: async () => {
      const { data } = await (supabase
        .from("content_items")
        .select("id") as any)
        .eq("reblog_of_id", post.id)
        .eq("creator_id", user!.id)
        .eq("is_reblog", true)
        .maybeSingle();
      return !!data;
    },
    staleTime: 60_000,
    enabled: !!post.id && !!user?.id,
  });

  const original: ReblogComposerOriginal = {
    id: post.id,
    title: post.title,
    creatorId: "",
    creatorUsername: post.author.username,
    creatorDisplayName: post.author.display_name,
    contentType: post.content_type,
    viewCount: post.view_count ?? 0,
    downloadCount: post.download_count ?? 0,
  };

  const typeInfo = getPrimaryTypeLabel(post.post_type ?? null)
  const badgeKey = typeInfo.label === 'Blog' ? 'blog' : 'build'
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

  // Load initial saved state
  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from('saved_items')
      .select('id')
      .eq('user_id', user.id)
      .eq('content_id', post.id)
      .maybeSingle()
      .then(({ data }) => setSaved(!!data));
  }, [post.id, user?.id]);

  // Close 3-dot menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleStageClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (expandStage === 0 && hasMoreContent) setExpandStage(1)
    else if (expandStage === 0 && !hasMoreContent && hasWTE) setExpandStage(2)
    else if (expandStage === 1 && hasWTE) setExpandStage(2)
    else setExpandStage(0)
  }

  return (
    <article
      className="group relative rounded-xl cursor-pointer transition-all duration-300 hover:bg-white/[0.02]"
      style={{
        padding: "14px 16px",
        marginBottom: "10px",
        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.02) 100%)",
        backdropFilter: "blur(60px)",
        WebkitBackdropFilter: "blur(60px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderTopColor: "rgba(255, 255, 255, 0.14)",
        borderLeftColor: "rgba(255, 255, 255, 0.14)",
        boxShadow: "0 2px 12px rgba(0, 0, 0, 0.20)",
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
                <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
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
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "1px 6px", borderRadius: 4,
                  fontSize: 9, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.05em",
                  background: contentTypeStyle.bg,
                  color: contentTypeStyle.color,
                  border: `1px solid ${contentTypeStyle.border}`,
                }}
              >
                <span>{typeInfo.label.toUpperCase()}</span>
                {typeInfo.sub && (
                  <span style={{
                    color: 'rgba(255,255,255,0.45)',
                    fontWeight: 600,
                    borderLeft: '1px solid rgba(255,255,255,0.15)',
                    paddingLeft: 4,
                  }}>
                    {typeInfo.sub.toUpperCase()}
                  </span>
                )}
              </span>
              {post.bounty_enabled === true && (
                <>
                  <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>·</span>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '1px 8px', borderRadius: 9999,
                    fontSize: 10, fontWeight: 700,
                    background: 'rgba(245,158,11,0.15)',
                    color: '#F59E0B',
                    border: '1px solid rgba(245,158,11,0.30)',
                  }}>
                    🎯 £{post.bounty_amount} Bounty
                  </span>
                </>
              )}
              <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>·</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.40)" }}>
                {getTimeAgo(post.created_at)}
              </span>
            </div>
          </div>
        </div>

        <button
          style={{ padding: 4, color: "rgba(255,255,255,0.35)", background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Title */}
      <h3 style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 15, fontWeight: 500, color: "rgba(255,255,255,0.90)",
        lineHeight: 1.35, marginTop: 10, marginBottom: 0,
      }}>
        {post.title}
      </h3>

      {/* Bounty meta strip — deadline / reward / slots / active solvers */}
      {(post.post_type === "bounty" || post.bounty_enabled) && (() => {
        const countdown = getDeadlineCountdown(post.bounty_deadline)
        const reward = formatBountyReward(post)
        const totalSlots = post.bounty_total_slots ?? 0
        const solvedSlots = post.bounty_solved_count ?? 0
        const slotsPct = totalSlots > 0 ? Math.min(100, Math.round((solvedSlots / totalSlots) * 100)) : null
        const activeSolvers = post.bounty_active_solvers ?? 0
        const showAny = countdown || reward || slotsPct !== null || activeSolvers > 0
        if (!showAny) return null

        return (
          <div
            style={{
              marginTop: 8,
              padding: "8px 10px",
              borderRadius: 8,
              background: "rgba(245,158,11,0.05)",
              border: "1px solid rgba(245,158,11,0.18)",
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 14,
              fontSize: 12,
              color: "rgba(255,255,255,0.75)",
            }}
          >
            {countdown && (
              <span
                title="Deadline"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontWeight: 600,
                  color: countdown.urgent ? "#F87171" : "#F59E0B",
                }}
              >
                ⏳ {countdown.label}
              </span>
            )}
            {reward && (
              <span
                title="Reward"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontWeight: 600,
                  color: "#F59E0B",
                }}
              >
                💰 {reward}
              </span>
            )}
            {slotsPct !== null && (
              <span
                title="Slots solved"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  minWidth: 120,
                  flex: "0 1 160px",
                }}
              >
                <span style={{ flexShrink: 0, color: "rgba(255,255,255,0.55)" }}>
                  Slots {solvedSlots}/{totalSlots}
                </span>
                <span
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    background: "rgba(255, 255, 255, 0.14)",
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      width: `${slotsPct}%`,
                      height: "100%",
                      background: "rgba(34,197,94,0.55)",
                    }}
                  />
                </span>
              </span>
            )}
            {activeSolvers > 0 && (
              <span title="Active solvers" style={{ color: "rgba(255,255,255,0.55)" }}>
                👥 {activeSolvers} solver{activeSolvers === 1 ? "" : "s"}
              </span>
            )}
          </div>
        )
      })()}

      {/* Preview text */}
      {previewText && (
        <p style={{
          marginTop: 6, fontSize: 13,
          color: "rgba(255,255,255,0.50)", lineHeight: 1.6,
        }}>
          {previewText}
        </p>
      )}

      {/* Discussion thread preview */}
      {post.post_type === 'discussion' &&
       post.what_to_expect_blocks &&
       post.what_to_expect_blocks.length > 0 && (
        <div style={{ marginTop: 10, marginBottom: 4 }}>
          {post.what_to_expect_blocks.slice(0, 2).map((thread, i) => (
            <div key={i} style={{
              display: 'flex', gap: 10,
              marginTop: i === 0 ? 0 : 6,
            }}>
              {/* Thread line */}
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', width: 28, flexShrink: 0,
              }}>
                {i === 0 && (
                  <div style={{
                    width: 1, height: 8,
                    background: 'rgba(59,130,246,0.20)',
                  }} />
                )}
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(59,130,246,0.10)',
                  border: '1px solid rgba(59,130,246,0.20)',
                  flexShrink: 0,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 8, color: 'rgba(59,130,246,0.60)',
                  fontWeight: 700,
                }}>
                  {i + 2}
                </div>
              </div>
              <p style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.40)',
                lineHeight: 1.55, margin: 0,
                flex: 1, minWidth: 0,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}>
                {thread.content}
              </p>
            </div>
          ))}
          {post.what_to_expect_blocks.length > 2 && (
            <div style={{
              fontSize: 11, color: 'rgba(59,130,246,0.50)',
              marginTop: 6, paddingLeft: 38,
            }}>
              +{post.what_to_expect_blocks.length - 2} more in thread
            </div>
          )}
        </div>
      )}

      {/* Cover image / video */}
      {post.cover_image_url && (() => {
        const isVideo = /\.(mp4|webm|mov|ogg)$/i.test(
          post.cover_image_url
        ) || post.cover_image_url.includes('/video/');

        return (
          <div style={{
            position: 'relative', marginTop: 14,
            borderRadius: 10, overflow: 'hidden',
          }}>
            {isVideo ? (
              <video
                src={post.cover_image_url}
                autoPlay
                muted
                loop
                playsInline
                style={{
                  width: '100%', height: 160,
                  objectFit: 'cover', display: 'block',
                }}
              />
            ) : (
              <img
                src={post.cover_image_url}
                alt={post.title}
                style={{
                  width: '100%', height: 160,
                  objectFit: 'cover', opacity: 0.85,
                  display: 'block',
                  transition: 'transform 0.7s ease',
                }}
              />
            )}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)',
              pointerEvents: 'none',
            }} />
          </div>
        );
      })()}

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
                <span key={tag} style={{ fontSize: 12, color: "#1F7A6D" }}>#{tag}</span>
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
          <hr style={{ border: "none", borderTop: "1px solid rgba(255, 255, 255, 0.14)", margin: "12px 0" }} />
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.30)", marginBottom: 8 }}>
            What to expect
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
            {post.what_to_expect}
          </p>
          {post.what_to_expect_blocks?.map((block, i) => (
            <div key={i} style={{ marginTop: 8 }}>
              {block.type === "heading"
                ? <h4 style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{block.content}</h4>
                : <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{block.content}</p>
              }
            </div>
          ))}
        </div>
      )}

      {/* Show more/less */}
      {canExpand && (
        <>
          <hr style={{ border: "none", borderTop: "1px solid rgba(255, 255, 255, 0.14)", margin: "10px 0 4px 0" }} />
          <button
            style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}
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
        display: "flex", alignItems: "center",
        marginTop: 14, paddingTop: 10,
        borderTop: "1px solid rgba(255, 255, 255, 0.14)",
      }}>
        {/* Like */}
        <button
          style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 13, background: "none", border: "none", cursor: "pointer",
            color: liked ? "#ef4444" : "rgba(255,255,255,0.40)",
            transition: "color 0.15s",
            padding: '4px 6px', borderRadius: 5,
          }}
          onClick={e => {
            e.stopPropagation();
            setLiked(p => !p);
            setLikeCount(p => liked ? p - 1 : p + 1);
          }}
        >
          <Heart size={15} fill={liked ? "currentColor" : "none"} />
          <span>{likeCount}</span>
        </button>

        {/* Comment */}
        <button
          style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 13, background: "none", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.40)",
            transition: "color 0.15s",
            padding: '4px 6px', borderRadius: 5,
            marginLeft: 14,
          }}
          onClick={e => {
            e.stopPropagation();
            navigate(`/content/${post.id}#comments`);
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>{post.comment_count ?? 0}</span>
        </button>

        {/* Reblog */}
        <button
          style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 13,
            color: userHasReblogged ? "#1F7A6D" : "rgba(255,255,255,0.40)",
            background: "none", border: "none", cursor: "pointer",
            transition: "color 0.15s",
            padding: '4px 6px', borderRadius: 5,
            marginLeft: 14,
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (!isLoggedIn) return
            if (userHasReblogged) {
              toast({ title: "You've already reblogged this" })
            } else {
              setReblogOpen(true)
            }
          }}
          title={userHasReblogged ? "You reblogged this" : "Reblog"}
        >
          <Repeat2 size={15} />
          {(reblogCount ?? 0) > 0 && <span>{reblogCount}</span>}
        </button>

        {/* Save */}
        <button
          onClick={async e => {
            e.stopPropagation();
            if (!user) {
              navigate('/login');
              return;
            }
            if (saved) {
              await (supabase as any)
                .from('saved_items')
                .delete()
                .eq('user_id', user.id)
                .eq('content_id', post.id);
              setSaved(false);
            } else {
              await (supabase as any)
                .from('saved_items')
                .insert({
                  user_id: user.id,
                  content_id: post.id,
                } as any);
              setSaved(true);
            }
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 13, background: 'none', border: 'none',
            cursor: 'pointer',
            color: saved ? '#8B4513' : 'rgba(255,255,255,0.35)',
            transition: 'color 0.15s',
            padding: '4px 6px', borderRadius: 5,
            marginLeft: 14,
          }}
          title={saved ? 'Unsave' : 'Save'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24"
            fill={saved ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>

        {/* Share */}
        <button
          onClick={e => {
            e.stopPropagation();
            const url = `${window.location.origin}/content/${post.id}`;
            navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            });
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 13, background: 'none', border: 'none',
            cursor: 'pointer',
            color: copied ? '#1F7A6D' : 'rgba(255,255,255,0.35)',
            transition: 'color 0.15s',
            padding: '4px 6px', borderRadius: 5,
            marginLeft: 14,
          }}
          title="Copy link"
        >
          <svg width="13" height="13" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
        </button>

        {/* 3-dot menu */}
        <div ref={menuRef} style={{ position: 'relative', marginLeft: 'auto' }}>
          <button
            onClick={e => {
              e.stopPropagation();
              setMenuOpen(o => !o);
            }}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.30)',
              cursor: 'pointer', fontSize: 16,
              padding: '4px 6px', borderRadius: 5,
              display: 'flex', alignItems: 'center',
              letterSpacing: '0.05em',
            }}
          >
            ···
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute',
              bottom: '100%', right: 0,
              marginBottom: 6,
              background: 'rgba(8,8,12,0.98)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 8,
              padding: '4px 0',
              minWidth: 160,
              boxShadow: '0 8px 24px rgba(0,0,0,0.40)',
              zIndex: 100,
            }}>
              {[
                { label: 'Copy link', action: () => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/content/${post.id}`
                  );
                  setMenuOpen(false);
                }},
                { label: 'View author', action: () => {
                  navigate(`/creator/${post.author?.username}`);
                  setMenuOpen(false);
                }},
                { label: 'Report', action: () => {
                  setMenuOpen(false);
                }},
              ].map(item => (
                <button
                  key={item.label}
                  onClick={e => {
                    e.stopPropagation();
                    item.action();
                  }}
                  style={{
                    display: 'block', width: '100%',
                    textAlign: 'left',
                    padding: '8px 14px',
                    background: 'none', border: 'none',
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.55)',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.14)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {reblogOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <ReblogComposer
            original={original}
            open={reblogOpen}
            onOpenChange={setReblogOpen}
          />
        </div>
      )}
    </article>
  )
}
