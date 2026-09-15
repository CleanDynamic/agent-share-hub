import { type } from "@/lib/theme/type";
import { categoryFill } from "@/lib/theme/category";
import { menuPanelStyle } from "@/lib/theme/controls";
import { elevation } from "@/lib/theme/elevation";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";

import { useState, useRef, useEffect } from "react"
import { useNavigate } from 'react-router-dom'
import { Heart, Repeat2, MoreHorizontal } from "lucide-react"
import { AccountHoverCard } from "@/components/account-hover-card"
import { useAuth } from "@/contexts/AuthContext"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useReblogCompose } from "@/contexts/ReblogComposeContext"
import { REBLOG_COMPOSE_ENABLED } from "@/lib/reblog/flags"
import { useToast } from "@/hooks/use-toast"
import { getPrimaryTypeLabel } from "@/lib/content-types"
import ActionXpHint from "@/components/ambient/ActionXpHint"
import { AvatarLevelRing } from "@/components/profile-game/AvatarLevelRing"
import AttributionChip from "@/components/remix/AttributionChip"
import { useLineageParent } from "@/lib/remix/hooks"
import { feedback } from "@/lib/theme/motion";

/**
 * BG-P18. THE FOURTEEN CONTENT-TYPE BADGE COLOURS ARE RETIRED, which the theme
 * states outright: a content type is not a part category, the nine part hues
 * encode meaning and are never borrowed, and anything needing a colour that is
 * not one of the nine resolves to `--text2`. So this map — a hue per type, each
 * at an unmeasured 15% alpha over a ground that no longer exists — collapses to
 * one measured pair.
 *
 * It stays a map-shaped lookup rather than being inlined at the three call
 * sites, because those sites also feed the avatar fallback and would otherwise
 * each have to decide the same thing again. `--recess` under `--text2` is the
 * kit's neutral chip, 4.55:1 on Exhibition and 5.73:1 on Dusk, and it is what
 * `categoryFill` returns for a category the registry does not know — which is
 * exactly what a content type is.
 */
const NEUTRAL_BADGE = {
  bg: "var(--recess)",
  color: "var(--text2)",
  border: "var(--line)",
} as const;

const CONTENT_TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> =
  new Proxy({} as Record<string, { bg: string; color: string; border: string }>, {
    get: () => NEUTRAL_BADGE,
  });

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
    id?: string
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
  const { isLoggedIn, user, profile } = useAuth()
  const { toast } = useToast()
  const [expandStage, setExpandStage] = useState(0)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(post.view_count ?? 0)
  const [likeXpTrigger, setLikeXpTrigger] = useState(0)
  const [saveXpTrigger, setSaveXpTrigger] = useState(0);

  const { openReblog } = useReblogCompose()
  const [saved, setSaved] = useState(false)
  const { data: lineageParent } = useLineageParent(post.id)

  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Reblog count (new reblogs table)
  const { data: reblogCount } = useQuery({
    queryKey: ["reblog_count", post.id],
    queryFn: async () => {
      const { count } = await (supabase
        .from("reblogs")
        .select("id", { count: "exact", head: true }) as any)
        .eq("original_post_id", post.id)
        .is("deleted_at", null);
      return count ?? 0;
    },
    staleTime: 60_000,
    enabled: !!post.id,
  });

  const { data: userHasReblogged } = useQuery({
    queryKey: ["user_has_reblogged", post.id, user?.id],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await (supabase
        .from("reblogs")
        .select("id") as any)
        .eq("original_post_id", post.id)
        .eq("reblogger_id", user!.id)
        .is("deleted_at", null)
        .gte("created_at", since)
        .maybeSingle();
      return !!data;
    },
    staleTime: 60_000,
    enabled: !!post.id && !!user?.id,
  });

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
      className="group relative cursor-pointer"
      style={{
        padding: "14px 16px",
        marginBottom: "10px",
        /* BG-P18. `--glass` on a `--line` hairline at `--r-card`, which is the
           theme's card and what puts this one in the same room as the build
           card beside it in the feed. Not `--card-frame`: that token is half of
           the build card's two-layer pair and means "the record".

           THREE THINGS WENT, AND ALL THREE WERE COSTING SOMETHING. The 135°
           gradient between two near-identical whites was invisible and is one
           more thing to keep in step with a theme. `blur(60px)` was not the
           system's blur — there is exactly one, 16px — and fifty of them on a
           loaded feed is fifty compositing layers on the cold-load page, which
           is the measured cost `neoscale-performance` names first. The 20% black
           shadow was `raised` on a surface the theme puts at `flat`; a feed of
           cards each casting a shadow is a feed of stickers. */
        background: t.glass,
        ...elevation.flat,
        borderRadius: r.card,
        transition: feedback("border-color"),
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--text2)" }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line)" }}
      onClick={() => navigate(`/content/${post.id}`)}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
          <AccountHoverCard account={post.author}>
            <AvatarLevelRing userId={post.author.id} size={36}>
              {post.author.avatar_url ? (
                <img
                  src={post.author.avatar_url}
                  alt={post.author.display_name}
                  style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%", height: "100%", borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 600,
                    background: avatarStyle?.bg,
                    color: avatarStyle?.color,
                    border: `1px solid ${avatarStyle?.border}`,
                  }}
                >
                  {initials}
                </div>
              )}
            </AvatarLevelRing>
          </AccountHoverCard>

          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <AccountHoverCard account={post.author}>
                <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                  {post.author.display_name}
                </span>
              </AccountHoverCard>
              <AccountHoverCard account={post.author}>
                <span style={{ fontSize: 12, color: t.text2 }}>
                  @{post.author.username}
                </span>
              </AccountHoverCard>
              <span style={{ color: t.text2, fontSize: 10 }}>·</span>
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
                    color: t.text2,
                    fontWeight: 600,
                    borderLeft: `1px solid ${t.line}`,
                    paddingLeft: 4,
                  }}>
                    {typeInfo.sub.toUpperCase()}
                  </span>
                )}
              </span>
              {post.bounty_enabled === true && (
                <>
                  <span style={{ color: t.text2, fontSize: 10 }}>·</span>
                  {/* The breakage category's measured pair, which is where a
                      bounty's hue is legal as ink, and `--r-chip` rather than
                      999px — the capsule rule was dropped. */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '1px 8px', borderRadius: r.chip,
                    fontSize: 10, fontWeight: 700,
                    ...categoryFill('breakage'),
                  }}>
                    🎯 £{post.bounty_amount} Bounty
                  </span>
                </>
              )}
              <span style={{ color: t.text2, fontSize: 10 }}>·</span>
              <span style={{ fontSize: 12, color: t.text2 }}>
                {getTimeAgo(post.created_at)}
              </span>
            </div>
          </div>
        </div>

        <button
          style={{ padding: 4, color: t.text2, background: "none", border: "none", cursor: "pointer", flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Title */}
      <h3 style={{
        ...type.cardTitle,
          color: t.text,
         marginTop: 10, marginBottom: 0,
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
              borderRadius: r.chip,
              /* No tinted ground and no coloured edge: the theme is explicit
                 that a bounty reads as an invitation, and a wash behind one
                 reads as an error box. The recess says "a strip cut into the
                 card" and the figures carry the hue. */
              background: t.recess,
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 14,
              fontSize: 12,
              color: t.text,
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
                  color: countdown.urgent ? "var(--cat-breakage)" : "var(--text2)",
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
                  ...categoryFill('breakage'),
                  padding: '1px 8px',
                  borderRadius: r.chip,
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
                <span style={{ flexShrink: 0, color: t.text2 }}>
                  Slots {solvedSlots}/{totalSlots}
                </span>
                <span
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    background: t.recess,
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      width: `${slotsPct}%`,
                      height: "100%",
                      /* Progress is carried by `--lit` as LIGHT, which is the
                       theme's rule for every bar, level and streak. */
                    background: "var(--lit)",
                    }}
                  />
                </span>
              </span>
            )}
            {activeSolvers > 0 && (
              <span title="Active solvers" style={{ color: t.text2 }}>
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
          color: t.text2, lineHeight: 1.6,
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
                    background: t.line,
                  }} />
                )}
                <div style={{
                  width: 20, height: 20, borderRadius: r.full,
                  /* A discussion is not a part category, so it gets no hue —
                     the theme's answer for everything the nine do not name. */
                  background: t.recess,
                  border: `1px solid ${t.line}`,
                  flexShrink: 0,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 8, color: t.text2,
                  fontWeight: 700,
                }}>
                  {i + 2}
                </div>
              </div>
              <p style={{
                fontSize: 12,
                color: t.text2,
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
              fontSize: 11, color: t.text2,
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
            borderRadius: r.media, overflow: 'hidden',
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
                  /* Was 0.85, which is a dark-theme trick: knocking a
                     photograph back reads as haze on Exhibition's light ground
                     rather than as restraint. */
                  objectFit: 'cover',
                  display: 'block',
                  transition: 'transform 0.7s ease',
                }}
              />
            )}
            <div style={{
              position: 'absolute', inset: 0,
              /* Struck from `--porthole`, the darkest surface token in each
                 theme, so the scrim belongs to the room rather than sitting on
                 top of it — the same derivation `SCRIM` uses. */
              background: 'linear-gradient(to top, color-mix(in srgb, var(--porthole) 50%, transparent), transparent)',
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
          <p style={{ fontSize: 13, color: t.text2, lineHeight: 1.6 }}>
            {remainingText}
          </p>
          {tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {tags.map((tag) => (
                <span key={tag} style={{ fontSize: 12, color: t.text2 }}>#{tag}</span>
              ))}
            </div>
          )}
          {lineageParent && (
            <div style={{ marginTop: tags.length > 0 ? 8 : 10 }}>
              <AttributionChip
                authorHandle={lineageParent.authorHandle}
                title={lineageParent.title}
                deleted={lineageParent.deleted}
              />
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
          <hr style={{ border: "none", borderTop: `1px solid ${t.line}`, margin: "12px 0" }} />
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: t.text2, marginBottom: 8 }}>
            What to expect
          </div>
          <p style={{ fontSize: 13, color: t.text2, lineHeight: 1.6 }}>
            {post.what_to_expect}
          </p>
          {post.what_to_expect_blocks?.map((block, i) => (
            <div key={i} style={{ marginTop: 8 }}>
              {block.type === "heading"
                ? <h4 style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{block.content}</h4>
                : <p style={{ fontSize: 13, color: t.text2 }}>{block.content}</p>
              }
            </div>
          ))}
        </div>
      )}

      {/* Show more/less */}
      {canExpand && (
        <>
          <hr style={{ border: "none", borderTop: `1px solid ${t.line}`, margin: "10px 0 4px 0" }} />
          <button
            style={{ fontSize: 12, color: t.text2, background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}
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
        borderTop: `1px solid ${t.line}`,
      }}>
        {/* Like */}
        <ActionXpHint amount={1} trigger={likeXpTrigger}>
        <button
          style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 13, background: "none", border: "none", cursor: "pointer",
            /* One accent for "you did this", across all four toggles: the
               theme allows one and the nine category hues mean something else.
               A second red here would also read as breakage, which a like is
               not. */
            color: liked ? t.action : t.text2,
            transition: "color 0.15s",
            padding: '4px 6px', borderRadius: r.chip,
          }}
          onClick={e => {
            e.stopPropagation();
            const willLike = !liked;
            setLiked(p => !p);
            setLikeCount(p => liked ? p - 1 : p + 1);
            if (willLike) setLikeXpTrigger(n => n + 1);
          }}
        >
          <Heart size={15} fill={liked ? "currentColor" : "none"} />
          <span>{likeCount}</span>
        </button>
        </ActionXpHint>

        {/* Comment */}
        <button
          style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 13, background: "none", border: "none", cursor: "pointer",
            color: t.text2,
            transition: "color 0.15s",
            padding: '4px 6px', borderRadius: r.chip,
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

        {/* Reblog — NS-P42: composing is retired; see lib/reblog/flags.ts. */}
        {REBLOG_COMPOSE_ENABLED && (
        <button
          style={{
            display: "flex", alignItems: "center", gap: 6,
            minHeight: 44,
            fontSize: 13,
            color: userHasReblogged ? t.action : t.text2,
            background: "none", border: "none", cursor: "pointer",
            transition: "color 0.15s, background 0.15s",
            padding: '4px 8px', borderRadius: r.chip,
            marginLeft: 14,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--recess)" }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none" }}
          onClick={(e) => {
            e.stopPropagation()
            if (!isLoggedIn) { navigate('/login'); return }
            openReblog({
              id: post.id,
              title: post.title,
              description: post.description,
              post_type: post.post_type ?? post.content_type,
              cover_image_url: post.cover_image_url,
              created_at: post.created_at,
              author: {
                display_name: post.author.display_name,
                username: post.author.username,
                avatar_url: post.author.avatar_url,
              },
            })
          }}
          title={post.author.username && profile?.username === post.author.username ? "Reblog your own post" : (userHasReblogged ? "You reblogged this" : "Reblog")}
        >
          <Repeat2 size={15} style={{ color: userHasReblogged ? t.action : "currentColor" }} />
          {(reblogCount ?? 0) > 0 && <span style={{ color: userHasReblogged ? t.action : undefined }}>{reblogCount}</span>}
        </button>
        )}

        {/* Save */}
        <ActionXpHint amount={1} trigger={saveXpTrigger}>
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
              setSaveXpTrigger(n => n + 1);
            }
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 13, background: 'none', border: 'none',
            cursor: 'pointer',
            color: saved ? t.action : t.text2,
            transition: 'color 0.15s',
            padding: '4px 6px', borderRadius: r.chip,
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
        </ActionXpHint>

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
            /* `--evidence` is the token for "it worked", which is the whole
               of what a copy confirmation says. */
            color: copied ? t.evidence : t.text2,
            transition: 'color 0.15s',
            padding: '4px 6px', borderRadius: r.chip,
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
              color: t.text2,
              cursor: 'pointer', fontSize: 16,
              padding: '4px 6px', borderRadius: r.chip,
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
              /* BG-P07's own menu surface, so this popover and every Radix menu
                 in the app are one decision rather than two that look alike. */
              ...menuPanelStyle,
              padding: '4px 0',
              minWidth: 160,
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
                    color: t.text2,
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--recess)';
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

    </article>
  )
}
