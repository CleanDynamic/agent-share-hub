import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Heart, MessageCircle, Repeat2, ExternalLink }
  from 'lucide-react'
import { AccountHoverCard }
  from '@/components/account-hover-card'
import { supabase } from '@/integrations/supabase/client'

export interface ReblogPost {
  // The reblog itself
  id: string
  created_at: string
  description?: string        // reblogger's comment
  view_count?: number
  comment_count?: number
  download_count?: number
  reblog_count?: number
  author: {                   // the reblogger
    display_name: string
    username: string
    avatar_url?: string
    bio?: string
    follower_count?: number
    following_count?: number
    joined_date?: string
  }
  // The original post (embedded)
  original: {
    id: string
    title: string
    description?: string
    content_type: string
    post_type?: string | null
    cover_image_url?: string
    created_at: string
    original_author: {
      display_name: string
      username: string
    }
  } | null
  reblogOfId?: string | null
}

function getTimeAgo(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 30) return `${diffDays}d`
  return `${Math.floor(diffDays / 30)}mo`
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('')
    .toUpperCase().slice(0, 2)
}

export function ReblogFeedCard({ post }: { post: ReblogPost }) {
  const navigate = useNavigate()
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(
    post.view_count ?? 0
  )

  const { data: originalPost } = useQuery({
    queryKey: ['reblog_original', post.reblogOfId],
    enabled: !!post.reblogOfId && !post.original,
    queryFn: async () => {
      const { data } = await supabase
        .from('content_items')
        .select(`
          id, title, description, content_type,
          cover_image_url,
          profiles!content_items_creator_id_fkey(
            display_name, username
          )
        `)
        .eq('id', post.reblogOfId!)
        .single();
      if (!data) return null;
      const p = Array.isArray(data.profiles)
        ? data.profiles[0] : data.profiles;
      return {
        id: data.id,
        title: data.title,
        description: data.description ?? undefined,
        content_type: data.content_type,
        post_type: (data as any).post_category ?? null,
        cover_image_url: data.cover_image_url ?? undefined,
        created_at: '',
        original_author: {
          display_name: p?.display_name ?? 'Unknown',
          username: p?.username ?? 'user',
        },
      };
    },
  });

  const resolvedOriginal = post.original ?? originalPost ?? null;

  const initials = getInitials(post.author.display_name)

  return (
    <article
      style={{
        padding: '14px 16px',
        marginBottom: 0,
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background =
          'rgba(0,0,0,0.02)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background =
          'transparent'
      }}
      onClick={() => navigate(`/content/${post.id}`)}
    >
      {/* Reblog indicator row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        marginBottom: 10, paddingLeft: 44,
      }}>
        <Repeat2 size={12} color="rgba(255,255,255,0.28)" />
        <span style={{
          fontSize: 12, color: 'rgba(0,0,0,0.30)',
        }}>
          {post.author.display_name} reblogged
        </span>
      </div>

      {/* Reblogger header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        gap: 10, marginBottom: 10,
      }}>
        {/* Avatar */}
        <AccountHoverCard account={post.author}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(46,196,182,0.15)',
            border: '1px solid rgba(46,196,182,0.30)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12, fontWeight: 600,
            color: '#2EC4B6', flexShrink: 0,
          }}>
            {post.author.avatar_url
              ? <img src={post.author.avatar_url}
                  alt={post.author.display_name}
                  style={{ width: 36, height: 36,
                    borderRadius: '50%', objectFit: 'cover' }}
                />
              : initials
            }
          </div>
        </AccountHoverCard>

        {/* Meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            gap: 6, flexWrap: 'wrap',
          }}>
            <AccountHoverCard account={post.author}>
              <span style={{
                fontSize: 13, fontWeight: 600,
                color: 'rgba(0,0,0,0.85)',
              }}>
                {post.author.display_name}
              </span>
            </AccountHoverCard>
            <span style={{
              fontSize: 12, color: 'rgba(0,0,0,0.40)',
            }}>
              @{post.author.username}
            </span>
            <span style={{
              color: 'rgba(0,0,0,0.20)', fontSize: 10,
            }}>·</span>
            <span style={{
              fontSize: 12, color: 'rgba(0,0,0,0.40)',
            }}>
              {getTimeAgo(post.created_at)}
            </span>
          </div>

          {/* Reblogger's comment */}
          {post.description && (
            <p style={{
              fontSize: 14, lineHeight: 1.65,
              color: 'rgba(0,0,0,0.70)',
              margin: '8px 0 0 0',
              fontFamily: 'Inter, sans-serif',
            }}>
              {post.description}
            </p>
          )}
        </div>
      </div>

      {/* Quoted original post */}
      {resolvedOriginal && (
        <div
          style={{
            marginLeft: 46,
            border: '1px solid rgba(0,0,0,0.10)',
            borderRadius: 12,
            overflow: 'hidden',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style
              .borderColor = 'rgba(0,0,0,0.15)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style
              .borderColor = 'rgba(0,0,0,0.10)'
          }}
          onClick={e => {
            e.stopPropagation()
            navigate(`/content/${resolvedOriginal.id}`)
          }}
        >
          {/* Cover image if present */}
          {resolvedOriginal.cover_image_url && (
            <div style={{
              height: 120, overflow: 'hidden',
              position: 'relative',
            }}>
              <img
                src={resolvedOriginal.cover_image_url}
                alt={resolvedOriginal.title}
                style={{
                  width: '100%', height: '100%',
                  objectFit: 'cover', opacity: 0.75,
                }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                background:
                  'linear-gradient(to top, rgba(0,0,0,0.60), transparent)',
              }} />
            </div>
          )}

          {/* Original post meta */}
          <div style={{ padding: '10px 12px' }}>
            {/* Original author + type */}
            <div style={{
              display: 'flex', alignItems: 'center',
              gap: 6, marginBottom: 6,
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: 'rgba(0,0,0,0.08)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9, fontWeight: 700,
                color: 'rgba(0,0,0,0.50)',
                flexShrink: 0,
              }}>
                {getInitials(
                  resolvedOriginal.original_author.display_name
                )}
              </div>
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: 'rgba(0,0,0,0.55)',
              }}>
                {resolvedOriginal.original_author.display_name}
              </span>
              <span style={{
                color: 'rgba(0,0,0,0.20)', fontSize: 10,
              }}>·</span>
              <span style={{
                fontSize: 9, fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'rgba(0,0,0,0.35)',
                padding: '1px 6px', borderRadius: 4,
                background: 'rgba(0,0,0,0.06)',
              }}>
                {(resolvedOriginal.post_type
                  || resolvedOriginal.content_type)
                  ?.toUpperCase().replace(/-/g,' ')}
              </span>
            </div>

            {/* Original title */}
            <div style={{
              fontSize: 14, fontWeight: 700,
              color: 'rgba(0,0,0,0.85)',
              lineHeight: 1.3, marginBottom: 4,
              fontFamily: "'Playfair Display', Georgia, serif",
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}>
              {resolvedOriginal.title}
            </div>

            {/* Original description preview */}
            {resolvedOriginal.description && (
              <p style={{
                fontSize: 12,
                color: 'rgba(0,0,0,0.40)',
                lineHeight: 1.55, margin: 0,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}>
                {resolvedOriginal.description}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 12, paddingLeft: 46,
      }}>
        <div style={{ display: 'flex', alignItems: 'center',
          gap: 20 }}>
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 13, background: 'none', border: 'none',
              cursor: 'pointer',
              color: isLiked
                ? '#ef4444' : 'rgba(255,255,255,0.35)',
              transition: 'color 0.15s',
            }}
            onClick={e => {
              e.stopPropagation()
              setIsLiked(!isLiked)
              setLikeCount(p => isLiked ? p - 1 : p + 1)
            }}
          >
            <Heart size={14}
              fill={isLiked ? 'currentColor' : 'none'} />
            <span>{likeCount}</span>
          </button>
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 13, color: 'rgba(0,0,0,0.40)',
              background: 'none', border: 'none',
              cursor: 'pointer',
            }}
            onClick={e => e.stopPropagation()}
          >
            <MessageCircle size={14} />
            <span>{post.comment_count ?? 0}</span>
          </button>
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 13, color: 'rgba(0,0,0,0.40)',
              background: 'none', border: 'none',
              cursor: 'pointer',
            }}
            onClick={e => e.stopPropagation()}
          >
            <Repeat2 size={14} />
            <span>{post.reblog_count ?? 0}</span>
          </button>
        </div>
        <button
          style={{
            color: 'rgba(0,0,0,0.35)',
            background: 'none', border: 'none',
            cursor: 'pointer',
          }}
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink size={14} />
        </button>
      </div>
    </article>
  )
}
