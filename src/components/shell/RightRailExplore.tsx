import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FollowButton } from "@/components/FollowButton";
import { DIFFICULTY_LABEL_CLASS, displayContentType } from "@/lib/content-types";
import "./right-rail-explore.css";

/* ────────────────────────────────────────────────
   RightRailExplore — the Explore panel content for the right rail.

   Extracted verbatim from NeoScaleShell's inline right-panel JSX and
   Supabase queries so its internals render and behave exactly as
   before. The only removals are the 3D flip calls (doFlip) — clicks
   now navigate directly — and the mouse-tilt effect on the panel.
──────────────────────────────────────────────── */

const POST_TYPE_TILES = [
  { value: 'blueprint', label: 'Blueprints', emoji: '🔷', color: '#8B4513' },
  { value: 'blog',      label: 'Blogs',      emoji: '📝', color: '#3B82F6' },
  { value: 'bounty',    label: 'Bounties',   emoji: '🎯', color: '#F59E0B' },
];

const TILE_HOVER_COLORS = [
  '#8B4513', '#1F7A6D', '#7C3AED', '#3B82F6',
  '#F59E0B', '#22C55E', '#EC4899', '#06B6D4',
  '#A78BFA', '#F97316',
];
const randomTileColor = () =>
  TILE_HOVER_COLORS[Math.floor(Math.random() * TILE_HOVER_COLORS.length)];

// BG-P05. The four `.ns-badge-*` difficulty classes are retired: difficulty is
// not a part category and carries no colour. The trending badge keeps its shape
// (.ns-trending-badge is layout) and loses its fill — one uncoloured mono label,
// defined once in @/lib/content-types.
function diffBadgeClass(_difficulty?: string): string {
  return DIFFICULTY_LABEL_CLASS;
}

export function RightRailExplore() {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();
  const searchDebounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchPeopleResults, setSearchPeopleResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  /* ── Supabase: trending ── */
  const { data: trendingItems } = useQuery({
    queryKey: ["ns_trending"],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data } = await supabase
        .from("content_items")
        .select("id, title, content_type, difficulty, download_count, view_count, rating_count, comment_count, approved_at, created_at")
        .eq("status", "approved")
        .gte("created_at", weekAgo)
        .order("download_count", { ascending: false })
        .limit(20);
      if (!data) return [];
      return data
        .map((item: any) => {
          const hoursOld = (Date.now() - new Date(item.approved_at || item.created_at).getTime()) / 3600000;
          const score = (item.download_count * 1.5 + item.view_count + item.rating_count * 2 + (item.comment_count || 0) * 1.2)
            / Math.pow(hoursOld + 2, 1.5);
          return { ...item, _score: score };
        })
        .sort((a: any, b: any) => b._score - a._score)
        .slice(0, 5);
    },
    staleTime: 60_000,
  });

  /* ── Supabase: curator picks ── */
  const { data: curatorPicks } = useQuery({
    queryKey: ["ns_curator_picks"],
    queryFn: async () => {
      const { data } = await (supabase
        .from("curator_recommendations")
        .select("id, recommendation_text, content_id, content_items!curator_recommendations_content_id_fkey(id, title, content_type), curators!curator_recommendations_curator_id_fkey(user_id, profiles:profiles!curators_user_id_fkey(avatar_url, display_name))")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(3) as any);
      return data ?? [];
    },
    staleTime: 120_000,
  });

  /* ── Supabase: featured collections ── */
  const { data: featuredCollections } = useQuery({
    queryKey: ["ns_featured_collections"],
    queryFn: async () => {
      const { data } = await supabase
        .from("collections")
        .select("id, title, item_count, slug, owner_id, profiles!collections_owner_id_fkey(display_name, username)")
        .eq("is_public", true)
        .order("follower_count", { ascending: false })
        .limit(3);
      return data ?? [];
    },
    staleTime: 120_000,
  });

  /* ── Supabase: who to follow ── */
  const { data: followSuggestions } = useQuery({
    queryKey: ["ns_who_to_follow", user?.id],
    enabled: isLoggedIn && !!user?.id,
    queryFn: async () => {
      const { data: followRows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user!.id);
      const followedIds = (followRows ?? []).map((r: any) => r.following_id);
      const excludeIds = [user!.id, ...followedIds];
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, follower_count")
        .eq("is_creator", true)
        .not("id", "in", `(${excludeIds.join(",")})`)
        .order("follower_count", { ascending: false })
        .limit(3);
      return data ?? [];
    },
    staleTime: 120_000,
  });

  function handleSearchChange(q: string) {
    setSearchQuery(q);
    setSearchOpen(q.length >= 2);
    clearTimeout(searchDebounce.current);
    if (q.length < 2) { setSearchResults([]); setSearchPeopleResults([]); return; }
    searchDebounce.current = setTimeout(async () => {
      setSearchLoading(true);
      const { data } = await supabase
        .from("content_items")
        .select("id, title, content_type")
        .ilike("title", `%${q}%`)
        .eq("status", "approved")
        .limit(6);
      setSearchResults(data ?? []);
      const { data: pData } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(2);
      if (pData) setSearchPeopleResults(pData);
      else setSearchPeopleResults([]);
      setSearchLoading(false);
    }, 300);
  }

  return (
    <>
      <div className="ns-right-title">Explore</div>

      {/* Working search bar */}
      <div className="ns-right-search" style={{ position: "relative" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          placeholder="Quick search…"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && searchQuery.trim().length >= 1) {
              navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
              setSearchOpen(false);
            }
          }}
        />
      </div>
      {searchOpen && (
        <div className="ns-right-search-results">
          {searchLoading && <div style={{ padding: 8, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Searching…</div>}
          {!searchLoading && searchResults.length === 0 && searchPeopleResults.length === 0 && <div style={{ padding: 8, fontSize: 10, color: "rgba(255,255,255,0.35)" }}>No results</div>}

          {/* People results */}
          {searchPeopleResults && searchPeopleResults.length > 0 && (
            <>
              <div style={{
                fontSize: 9, fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.10em',
                color: 'rgba(255,255,255,0.35)',
                padding: '4px 10px 2px 10px',
              }}>
                People
              </div>
              {searchPeopleResults.slice(0,2).map((p: any) => (
                <div
                  key={p.id}
                  className="ns-search-result"
                  style={{ display: 'flex', alignItems: 'center',
                    gap: 8, padding: '6px 10px' }}
                  onClick={() => {
                    navigate(`/creator/${p.username}`);
                    setSearchOpen(false);
                    setSearchQuery('');
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(139,69,19,0.15)',
                    border: '1px solid rgba(139,69,19,0.25)',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9, fontWeight: 700, color: '#8B4513',
                    flexShrink: 0,
                  }}>
                    {(p.display_name ?? p.username)[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11,
                      color: 'rgba(255,255,255,0.70)',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap' }}>
                      {p.display_name}
                    </div>
                    <div style={{ fontSize: 10,
                      color: 'rgba(255,255,255,0.35)' }}>
                      @{p.username}
                    </div>
                  </div>
                </div>
              ))}
              <div style={{
                fontSize: 9, fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.10em',
                color: 'rgba(255,255,255,0.35)',
                padding: '4px 10px 2px 10px',
                marginTop: 4,
              }}>
                Posts
              </div>
            </>
          )}

          {searchResults.map((r: any) => (
            <div key={r.id} className="ns-search-result" onClick={() => { setSearchOpen(false); setSearchQuery(""); navigate(`/content/${r.id}`); }}>
              <span className="ns-search-result-badge">{displayContentType(r.content_type)}</span>
              <span className="ns-search-result-title">{r.title}</span>
            </div>
          ))}
          {searchQuery.length >= 2 && !searchLoading && (
            <div className="ns-search-result" onClick={() => {
              navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
              setSearchOpen(false);
              setSearchQuery("");
            }}>
              <span style={{ fontSize: 10, color: "#55e0d2" }}>See all results →</span>
            </div>
          )}
        </div>
      )}

      {/* ── Section label */}
      <div style={{
        fontSize: 10, fontWeight: 700,
        color: 'rgba(255,255,255,0.35)',
        letterSpacing: '1.4px',
        textTransform: 'uppercase' as const,
        padding: '0 4px',
        marginBottom: 10,
      }}>
        Browse
      </div>

      {/* ── Post type tile grid — 3 primary tiles */}
      <div className="ns-tile-grid">
        {POST_TYPE_TILES.map(tile => (
          <div
            key={tile.value}
            className="ns-tile"
            style={{
              '--tile-hover-color': tile.color,
            } as React.CSSProperties}
            onMouseEnter={e => {
              const color = randomTileColor();
              (e.currentTarget as HTMLElement).style.setProperty(
                '--tile-hover-color', color
              );
            }}
            onClick={() => navigate("/")}
          >
            <span className="ns-tile-label">{tile.label}</span>
            <span style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.25)',
              marginLeft: 'auto',
              flexShrink: 0,
            }}>→</span>
          </div>
        ))}
      </div>

      <div className="ns-right-divider" />

      {/* Trending */}
      <div className="ns-trending-title">Trending</div>
      <div className="ns-trending-list">
        {(trendingItems ?? []).map((item: any, i: number) => (
          <div
            key={item.id}
            className="ns-trending-item"
            onClick={() => navigate(`/content/${item.id}`)}
          >
            <span className="ns-trending-rank">{i + 1}</span>
            <div className="ns-trending-info">
              <div className="ns-trending-name">{item.title}</div>
              <span className={`ns-trending-badge ${diffBadgeClass(item.difficulty)}`}>
                {item.difficulty || "Any"}
              </span>
            </div>
          </div>
        ))}
        {(!trendingItems || trendingItems.length === 0) && (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", padding: "8px 8px" }}>
            Loading…
          </div>
        )}
      </div>

      {/* Curator Picks */}
      {curatorPicks && curatorPicks.length > 0 && (
        <>
          <div className="ns-section-title">Curator Picks</div>
          {curatorPicks.map((pick: any) => {
            const content = pick.content_items;
            const curator = pick.curators?.profiles;
            return (
              <div key={pick.id} className="ns-curator-item" onClick={() => { if (content) { navigate(`/content/${content.id}`); } }}>
                <div className="ns-curator-avatar">
                  {curator?.avatar_url ? <img src={curator.avatar_url} alt="" /> : <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>✦</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{content?.title}</div>
                  <span className="ns-search-result-badge">{content?.content_type ? displayContentType(content.content_type) : ""}</span>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Featured Collections */}
      {featuredCollections && featuredCollections.length > 0 && (
        <>
          <div className="ns-section-title">Collections</div>
          {featuredCollections.map((col: any) => (
            <div key={col.id} className="ns-collection-item" onClick={() => navigate(`/collection/${col.slug || col.id}`)}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>{col.title}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.30)" }}>
                {(col.profiles as any)?.display_name || (col.profiles as any)?.username || "Creator"} · {col.item_count} items
              </div>
            </div>
          ))}
        </>
      )}

      {/* Who to Follow */}
      {isLoggedIn && followSuggestions && followSuggestions.length > 0 && (
        <>
          <div className="ns-section-title">Who to Follow</div>
          {followSuggestions.map((s: any) => (
            <div key={s.id} className="ns-follow-item">
              <div className="ns-follow-avatar" style={{ cursor: "pointer" }} onClick={() => navigate(`/creator/${s.username}`)}>
                {s.avatar_url ? <img src={s.avatar_url} alt="" /> : <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>{(s.display_name || "?")[0]}</span>}
              </div>
              <div className="ns-follow-info" style={{ cursor: "pointer" }} onClick={() => navigate(`/creator/${s.username}`)}>
                <div className="ns-follow-name">{s.display_name || s.username}</div>
                <div className="ns-follow-handle">@{s.username}</div>
              </div>
              <FollowButton creatorId={s.id} />
            </div>
          ))}
        </>
      )}

      {/* Auth buttons for guests */}
      {!isLoggedIn && (
        <div style={{ marginTop: 16 }}>
          <div className="ns-auth-btns">
            <button className="ns-auth-btn signin" onClick={() => navigate("/login")}>Sign in</button>
            <button className="ns-auth-btn join" onClick={() => navigate("/signup")}>Join free</button>
          </div>
        </div>
      )}

      {/* Footer links */}
      <div className="ns-footer-links">
        <span className="ns-footer-link" onClick={() => navigate("/about")}>About NeoScale AI →</span>
        <a className="ns-footer-link" href="https://twitter.com/neoscaleai" target="_blank" rel="noopener noreferrer">Twitter @neoscaleai →</a>
      </div>
    </>
  );
}

export default RightRailExplore;
