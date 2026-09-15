import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FollowButton } from "@/components/FollowButton";
import { displayContentType } from "@/lib/content-types";
import { Skeleton } from "@/components/ui/skeleton";
import { focusRing } from "@/lib/theme/focus";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { eyebrow } from "@/lib/theme/type";
import "./right-rail-explore.css";
import { feedback } from "@/lib/theme/motion";

/* ────────────────────────────────────────────────
   RightRailExplore — the Explore panel content for the right rail.

   Extracted verbatim from the inline right-panel JSX and Supabase
   queries of NeoScaleShell, the frame this application used to render
   in, so its internals behaved exactly as before the move. The only
   removals were the 3D flip calls (doFlip) — clicks navigate directly —
   and the mouse-tilt effect on the panel. That shell was deleted in
   BG-P17; this component and right-rail-explore.css are what is left of
   it, and they are self-contained.
──────────────────────────────────────────────── */

/* ── Browse ──
   BG-P18b. THREE TILES WENT TO TWO ROWS, AND ALL THREE OF THE OLD ONES WENT
   NOWHERE. "Blueprints", "Blogs" and "Bounties" each called `navigate("/")` —
   they were three labelled buttons that reloaded the page the reader was
   already on, which is worse than no rail at all.

   - Blogs is REMOVED. Blog was retired in the NS series; there is no route and
     no content type behind it.
   - Blueprints is REMOVED. `/upload/blueprint` is an authoring route, not a
     browse destination, and there is no mounted route that lists blueprints —
     `App.tsx` has none, and nothing else in the application links to one.
   - Gallery and Bounties are what is left, and they are real: `/gallery` is a
     mounted route, and the open-bounty surface reachable from anywhere today is
     the home feed's own Bounties tab. `/gallery?bounties=1` is NOT wired — the
     gallery's bounty facet is component state, not a URL parameter — so
     pointing at it would have rebuilt the defect this row is fixing. */
const BROWSE_ROWS: { label: string; to: string }[] = [
  { label: 'Gallery', to: '/gallery' },
  { label: 'Bounties', to: '/?tab=bounties' },
];

/* BG-P05 retired the four `.ns-badge-*` difficulty colours and left
   `diffBadgeClass` here to paint the trending row's difficulty chip with the one
   uncoloured mono label that replaced them. BG-P18b removed the chip: a
   trending row is a title and a count, and difficulty is not what makes
   something trend. The helper and its import went with it. */

/** The mono eyebrow the rail's section headings wear, in --text2. */
const SECTION_LABEL = { ...eyebrow, color: t.text2 } as const;

/** 300 minus the rail's 24px leading padding. Nothing in the rail exceeds it. */
const RAIL_CONTENT_WIDTH = 276;

/**
 * A section: a mono heading 8px above its rows, 32px below whatever came before.
 *
 * The 8-to-32 ratio is the whole of the grouping here. A heading nearer its own
 * rows than to the section above it reads as belonging to them, which is
 * proximity doing what a divider used to — `.ns-right-divider` drew a hairline
 * between Browse and Trending because the two sat 14px apart and needed one.
 */
function RailSection({
  heading,
  first,
  children,
}: {
  heading: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: first ? 0 : 32 }}>
      <h2 style={{ ...SECTION_LABEL, letterSpacing: "0.06em", margin: "0 0 8px", padding: "0 12px" }}>
        {heading}
      </h2>
      {children}
    </section>
  );
}

/**
 * One row of the rail: 40px tall, 12px of inline padding, `--r-control`.
 *
 * THE SAME ROW THE LEFT RAIL'S NAV IS, deliberately. Two rails either side of
 * one column with two row shapes between them is two things for a reader to
 * learn; one shape in both is `law-of-similarity` spent on the thing it is for.
 * The trailing glyph is 16px `--text2` — an arrow, not an icon, because every
 * one of these rows goes somewhere.
 */
function RailRow({
  label,
  trailing,
  onClick,
  testId,
}: {
  label: React.ReactNode;
  trailing?: React.ReactNode;
  onClick: () => void;
  testId?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        height: 40,
        padding: "0 12px",
        border: "none",
        borderRadius: r.control,
        background: hovered ? t.recess : "transparent",
        color: t.text,
        font: "inherit",
        fontSize: 15,
        fontWeight: 500,
        textAlign: "left",
        cursor: "pointer",
        transition: feedback("background-color"),
      }}
    >
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <span style={{ flexShrink: 0, fontSize: 16, lineHeight: 1, color: t.text2 }}>
        {trailing ?? "→"}
      </span>
    </button>
  );
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
  /* The ring belongs on the wrapper, which is the element that looks like the
     field — the inner input is transparent and borderless. A wrapper cannot
     carry :focus-visible for a child in CSS without a new rule, so it is
     tracked here and applied inline. `:focus-visible` is asked of the input
     itself, so a mouse click does not leave a ring behind and a Tab does. */
  const [searchFocused, setSearchFocused] = useState(false);

  /* ── Supabase: trending ── */
  const { data: trendingItems, isLoading: trendingLoading, isError: trendingError } = useQuery({
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
      {/* BG-P18b. The "EXPLORE" eyebrow that stood here is gone. It labelled the
          rail, and a rail does not need naming to a reader who can see what is
          in it — what it actually did was push the one control in the rail 26px
          down and make the section headings below it read as its children. The
          field leads now, and the headings label sections rather than
          subsections. */}

      {/* Working search bar */}
      <div
        className="ns-right-search"
        style={{ position: "relative", ...(searchFocused ? focusRing : null) }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          placeholder="Search builds"
          value={searchQuery}
          onFocus={(e) => setSearchFocused(e.currentTarget.matches(":focus-visible"))}
          onBlur={() => setSearchFocused(false)}
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
          {searchLoading && <div style={{ padding: 8, fontSize: 10, color: t.text2 }}>Searching…</div>}
          {!searchLoading && searchResults.length === 0 && searchPeopleResults.length === 0 && <div style={{ padding: 8, fontSize: 10, color: t.text2 }}>No results</div>}

          {/* People results */}
          {searchPeopleResults && searchPeopleResults.length > 0 && (
            <>
              <div style={{
                ...SECTION_LABEL,
                fontSize: 10,
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
                    background: t.recess,
                    border: `1px solid ${t.line}`,
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9, fontWeight: 500, color: t.text,
                    flexShrink: 0,
                  }}>
                    {(p.display_name ?? p.username)[0].toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11,
                      color: t.text,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap' }}>
                      {p.display_name}
                    </div>
                    <div style={{ fontSize: 10,
                      fontFamily: eyebrow.fontFamily,
                      color: t.text2 }}>
                      @{p.username}
                    </div>
                  </div>
                </div>
              ))}
              <div style={{
                ...SECTION_LABEL,
                fontSize: 10,
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
              <span style={{ fontSize: 10, color: t.action }}>See all results →</span>
            </div>
          )}
        </div>
      )}

      <RailSection heading="Browse" first>
        {BROWSE_ROWS.map((row) => (
          <RailRow
            key={row.to}
            label={row.label}
            testId={`rail-browse-${row.label.toLowerCase()}`}
            onClick={() => navigate(row.to)}
          />
        ))}
      </RailSection>

      {/* ── Trending ──
          THREE STATES, AND THE EMPTY ONE IS SILENCE. It said "Loading…" while
          the query was in flight, which is a word standing in for a shape — the
          rail is 276px of known geometry and a placeholder can say so. When the
          query comes back with nothing, the whole section including its heading
          is gone: a heading over a sentence explaining that there is nothing
          under it is two lines spent saying less than no lines would. The
          failure keeps its sentence, because "we could not find out" and "there
          is nothing" are different facts. The query itself is untouched. */}
      {trendingLoading ? (
        <RailSection heading="Trending">
          <div aria-hidden data-testid="rail-trending-skeleton">
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 40, display: "flex", alignItems: "center", padding: "0 12px" }}>
                <Skeleton style={{ height: 16, width: `${72 - i * 8}%`, borderRadius: r.chip }} />
              </div>
            ))}
          </div>
        </RailSection>
      ) : trendingError ? (
        <RailSection heading="Trending">
          <p style={{ margin: 0, padding: "0 12px", fontSize: 15, color: t.text2 }}>
            Trending could not be loaded.
          </p>
        </RailSection>
      ) : trendingItems && trendingItems.length > 0 ? (
        <RailSection heading="Trending">
          {trendingItems.map((item: any) => (
            <RailRow
              key={item.id}
              label={item.title}
              onClick={() => navigate(`/content/${item.id}`)}
              trailing={
                <span
                  style={{
                    ...SECTION_LABEL,
                    letterSpacing: 0,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {item.download_count ?? 0}
                </span>
              }
            />
          ))}
        </RailSection>
      ) : null}

      {/* ── Curator Picks, Collections, Who to Follow ──
          Not named by this prompt, so their rows and their queries are as they
          were. What changed is the heading: `.ns-section-title` and
          `RailSection` were two spellings of the same mono eyebrow at two
          different spacings, and the rail now has one. */}
      {curatorPicks && curatorPicks.length > 0 && (
        <RailSection heading="Curator Picks">
          {curatorPicks.map((pick: any) => {
            const content = pick.content_items;
            const curator = pick.curators?.profiles;
            return (
              <div key={pick.id} className="ns-curator-item" onClick={() => { if (content) { navigate(`/content/${content.id}`); } }}>
                <div className="ns-curator-avatar">
                  {curator?.avatar_url ? <img src={curator.avatar_url} alt="" /> : <span style={{ fontSize: 12, color: t.text2, display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>✦</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{content?.title}</div>
                  <span className="ns-search-result-badge">{content?.content_type ? displayContentType(content.content_type) : ""}</span>
                </div>
              </div>
            );
          })}
        </RailSection>
      )}

      {featuredCollections && featuredCollections.length > 0 && (
        <RailSection heading="Collections">
          {featuredCollections.map((col: any) => (
            <div key={col.id} className="ns-collection-item" onClick={() => navigate(`/collection/${col.slug || col.id}`)}>
              <div style={{ fontSize: 15, color: t.text, fontWeight: 500 }}>{col.title}</div>
              <div style={{ fontSize: 12, fontFamily: eyebrow.fontFamily, color: t.text2 }}>
                {(col.profiles as any)?.display_name || (col.profiles as any)?.username || "Creator"} · {col.item_count} items
              </div>
            </div>
          ))}
        </RailSection>
      )}

      {isLoggedIn && followSuggestions && followSuggestions.length > 0 && (
        <RailSection heading="Who to Follow">
          {followSuggestions.map((s: any) => (
            <div key={s.id} className="ns-follow-item">
              <div className="ns-follow-avatar" style={{ cursor: "pointer" }} onClick={() => navigate(`/creator/${s.username}`)}>
                {s.avatar_url ? <img src={s.avatar_url} alt="" /> : <span style={{ fontSize: 12, color: t.text2, display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>{(s.display_name || "?")[0]}</span>}
              </div>
              <div className="ns-follow-info" style={{ cursor: "pointer" }} onClick={() => navigate(`/creator/${s.username}`)}>
                <div className="ns-follow-name">{s.display_name || s.username}</div>
                <div className="ns-follow-handle">@{s.username}</div>
              </div>
              <FollowButton creatorId={s.id} />
            </div>
          ))}
        </RailSection>
      )}

      {/* ── The footer, pushed to the bottom of the rail ──
          BG-P18b REMOVED THE "Sign in" / "Join free" PAIR THAT STOOD ABOVE THIS.
          The identical pair is in the left rail, 900px to the left of it and on
          the same screen at every width this rail renders at — and the same two
          controls twice tells a visitor they are two different things. The left
          rail keeps them: it is where the account lives, and it is where the one
          `--action` fill on this page belongs.

          A flexible spacer above, so the links sit at the foot of the rail
          rather than under whichever section happened to load. "X", not
          "Twitter": the platform's current name. The rail's own 24px bottom
          padding is the gap under them. */}
      <div style={{ flex: 1, minHeight: 24 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 12px" }}>
        <span className="ns-footer-link" onClick={() => navigate("/about")}>About buildgallery.ai →</span>
        <a
          className="ns-footer-link"
          href="https://x.com/neoscaleai"
          target="_blank"
          rel="noopener noreferrer"
        >
          @neoscaleai on X →
        </a>
      </div>
    </>
  );
}

export default RightRailExplore;
