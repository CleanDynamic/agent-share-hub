import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { FeedCard, type FeedPost } from '@/components/feed-card'
import { resolvePostType } from '@/lib/content-types'
import { FollowButton } from '@/components/FollowButton'

const SEARCH_TABS = ['Top', 'Latest', 'People', 'Collections']

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const q = searchParams.get('q') ?? ''
  const [tab, setTab] = useState('Top')
  const [inputVal, setInputVal] = useState(q)

  // Keep input in sync with URL param
  useEffect(() => { setInputVal(q); }, [q]);

  // ── Top posts (relevance — for now, created_at desc
  //    filtered by title/description ILIKE query)
  const { data: topPosts } = useQuery({
    queryKey: ['search_top', q],
    enabled: !!q && tab === 'Top',
    queryFn: async () => {
      const { data } = await supabase
        .from('content_items')
        .select(`
          id, title, description, content_type,
          post_category, difficulty, ai_tools,
          use_cases, custom_tags, download_count,
          view_count, comment_count, cover_image_url,
          created_at, what_to_expect,
          what_to_expect_blocks,
          bounty_enabled, bounty_amount, bounty_status,
          profiles!content_items_creator_id_fkey(
            display_name, username, avatar_url,
            bio, follower_count, following_count, joined_at
          )
        `)
        .eq('status', 'approved')
        .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
        .order('download_count', { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  // ── Latest posts (chronological)
  const { data: latestPosts } = useQuery({
    queryKey: ['search_latest', q],
    enabled: !!q && tab === 'Latest',
    queryFn: async () => {
      const { data } = await supabase
        .from('content_items')
        .select(`
          id, title, description, content_type,
          post_category, difficulty, ai_tools,
          use_cases, custom_tags, download_count,
          view_count, comment_count, cover_image_url,
          created_at, what_to_expect,
          what_to_expect_blocks,
          bounty_enabled, bounty_amount, bounty_status,
          profiles!content_items_creator_id_fkey(
            display_name, username, avatar_url,
            bio, follower_count, following_count, joined_at
          )
        `)
        .eq('status', 'approved')
        .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  // ── People
  const { data: people } = useQuery({
    queryKey: ['search_people', q],
    enabled: !!q && tab === 'People',
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select(`
          id, username, display_name, avatar_url,
          bio, follower_count, following_count, is_creator
        `)
        .or(
          `display_name.ilike.%${q}%,username.ilike.%${q}%`
        )
        .limit(20);
      return data ?? [];
    },
  });

  // ── Collections
  const { data: collections } = useQuery({
    queryKey: ['search_collections', q],
    enabled: !!q && tab === 'Collections',
    queryFn: async () => {
      const { data } = await supabase
        .from('collections')
        .select(`
          id, title, slug, item_count,
          profiles!collections_owner_id_fkey(
            display_name, username
          )
        `)
        .ilike('title', `%${q}%`)
        .eq('is_public', true)
        .limit(12);
      return data ?? [];
    },
  });

  // Helper: adapt a post to FeedPost shape
  const adaptPost = (post: any): FeedPost => {
    const profile = Array.isArray(post.profiles)
      ? post.profiles[0]
      : post.profiles;
    return {
      id: post.id,
      title: post.title ?? '',
      description: post.description ?? undefined,
      content_type: post.content_type ?? 'build',
      post_type: resolvePostType(
        post.post_category ?? null,
        post.content_type ?? null
      ),
      cover_image_url: post.cover_image_url ?? undefined,
      created_at: post.created_at,
      view_count: post.view_count ?? 0,
      comment_count: post.comment_count ?? 0,
      download_count: post.download_count ?? 0,
      what_to_expect: post.what_to_expect ?? undefined,
      what_to_expect_blocks:
        post.what_to_expect_blocks ?? undefined,
      ai_tools: post.ai_tools ?? [],
      use_cases: post.use_cases ?? [],
      custom_tags: post.custom_tags ?? [],
      bounty_enabled: post.bounty_enabled ?? false,
      bounty_amount: post.bounty_amount ?? null,
      author: {
        display_name: profile?.display_name ?? 'Unknown',
        username: profile?.username ?? 'user',
        avatar_url: profile?.avatar_url ?? undefined,
        bio: profile?.bio ?? undefined,
        follower_count: profile?.follower_count ?? 0,
        following_count: profile?.following_count ?? 0,
        joined_date: profile?.joined_at ?? undefined,
      },
    };
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);

  const activePosts =
    tab === 'Top' ? topPosts :
    tab === 'Latest' ? latestPosts : [];

  return (
    <div style={{
      height: '100%', display: 'flex',
      flexDirection: 'column', overflowY: 'auto',
    }}>

      {/* Search input */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky', top: 0,
        background: 'rgba(8,8,12,0.95)',
        backdropFilter: 'blur(20px)',
        zIndex: 10,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 9999, padding: '8px 14px',
        }}>
          <span style={{ fontSize: 13,
            color: 'rgba(255,255,255,0.30)' }}>🔍</span>
          <input
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && inputVal.trim()) {
                setSearchParams({ q: inputVal.trim() });
                setTab('Top');
              }
            }}
            placeholder="Search NeoScale..."
            style={{
              flex: 1, background: 'transparent',
              border: 'none', outline: 'none',
              fontSize: 14, color: '#fff',
              fontFamily: 'Inter, sans-serif',
            }}
          />
          {inputVal && (
            <button
              onClick={() => {
                setInputVal('');
                setSearchParams({});
              }}
              style={{
                background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.30)',
                cursor: 'pointer', fontSize: 16,
              }}
            >×</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      {q && (
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          position: 'sticky', top: 57,
          background: 'rgba(8,8,12,0.95)',
          backdropFilter: 'blur(20px)',
          zIndex: 9,
        }}>
          {SEARCH_TABS.map(t => {
            const isActive = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1, padding: '12px 4px',
                  background: 'none', border: 'none',
                  borderBottom: isActive
                    ? '2px solid #E8571A' : '2px solid transparent',
                  color: isActive
                    ? '#fff' : 'rgba(255,255,255,0.40)',
                  fontSize: 13, fontWeight: isActive ? 700 : 400,
                  cursor: 'pointer',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!q && (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column',
          gap: 12, color: 'rgba(255,255,255,0.25)',
          padding: 40,
        }}>
          <div style={{ fontSize: 32 }}>🔍</div>
          <div style={{
            fontSize: 15, fontFamily:
              "'Playfair Display', Georgia, serif",
          }}>
            Search NeoScale
          </div>
          <div style={{ fontSize: 13, textAlign: 'center',
            lineHeight: 1.6 }}>
            Find posts, techniques, builds, and people
          </div>
        </div>
      )}

      {/* Results — Posts (Top + Latest) */}
      {q && (tab === 'Top' || tab === 'Latest') && (
        <div>
          {(activePosts ?? []).length === 0 ? (
            <div style={{
              padding: '48px 16px', textAlign: 'center',
              color: 'rgba(255,255,255,0.25)', fontSize: 14,
            }}>
              No results for "{q}"
            </div>
          ) : (
            (activePosts ?? []).map(post =>
              <FeedCard
                key={post.id}
                post={adaptPost(post)}
              />
            )
          )}
        </div>
      )}

      {/* Results — People */}
      {q && tab === 'People' && (
        <div style={{
          display: 'flex', flexDirection: 'column',
          gap: 0,
        }}>
          {(people ?? []).length === 0 ? (
            <div style={{
              padding: '48px 16px', textAlign: 'center',
              color: 'rgba(255,255,255,0.25)', fontSize: 14,
            }}>
              No people found for "{q}"
            </div>
          ) : (
            (people ?? []).map((person: any) => (
              <div
                key={person.id}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: 12, padding: '14px 16px',
                  borderBottom:
                    '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                }}
                onClick={() =>
                  navigate(`/creator/${person.username}`)
                }
              >
                {/* Avatar */}
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: 'rgba(232,87,26,0.15)',
                  border: '1px solid rgba(232,87,26,0.30)',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14, fontWeight: 700,
                  color: '#E8571A', flexShrink: 0,
                }}>
                  {person.avatar_url
                    ? <img src={person.avatar_url}
                        style={{ width: 42, height: 42,
                          borderRadius: '50%',
                          objectFit: 'cover' }} />
                    : getInitials(
                        person.display_name ?? person.username
                      )
                  }
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 600,
                    color: 'rgba(255,255,255,0.90)',
                    marginBottom: 2,
                  }}>
                    {person.display_name}
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.40)',
                    marginBottom: person.bio ? 4 : 0,
                  }}>
                    @{person.username}
                    {person.is_creator && (
                      <span style={{
                        marginLeft: 6, fontSize: 10,
                        padding: '1px 6px', borderRadius: 4,
                        background: 'rgba(232,87,26,0.15)',
                        color: '#E8571A', fontWeight: 700,
                      }}>
                        Creator
                      </span>
                    )}
                  </div>
                  {person.bio && (
                    <div style={{
                      fontSize: 12,
                      color: 'rgba(255,255,255,0.45)',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                    }}>
                      {person.bio}
                    </div>
                  )}
                </div>

                {/* Follow */}
                <div onClick={e => e.stopPropagation()}>
                  <FollowButton creatorId={person.id} />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Results — Collections (2-col grid) */}
      {q && tab === 'Collections' && (
        <div style={{
          padding: '12px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
        }}>
          {(collections ?? []).length === 0 ? (
            <div style={{
              gridColumn: '1 / -1',
              padding: '48px 16px', textAlign: 'center',
              color: 'rgba(255,255,255,0.25)', fontSize: 14,
            }}>
              No collections found for "{q}"
            </div>
          ) : (
            (collections ?? []).map((col: any) => {
              const owner = Array.isArray(col.profiles)
                ? col.profiles[0] : col.profiles;
              return (
                <div
                  key={col.id}
                  style={{
                    padding: '12px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 10, cursor: 'pointer',
                  }}
                  onClick={() =>
                    navigate(`/collection/${col.slug}`)
                  }
                >
                  <div style={{
                    fontSize: 14, fontWeight: 600,
                    color: 'rgba(255,255,255,0.85)',
                    marginBottom: 4,
                    fontFamily:
                      "'Playfair Display', Georgia, serif",
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}>
                    {col.title}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.35)',
                    marginBottom: 4,
                  }}>
                    {owner?.display_name ?? 'Unknown'}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.25)',
                  }}>
                    {col.item_count ?? 0} items
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
