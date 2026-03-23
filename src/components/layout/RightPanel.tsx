import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FollowButton } from "@/components/FollowButton";
import { Search } from "lucide-react";
import { ORDERED_CONTENT_TYPES, TYPE_COLORS, displayContentType } from "@/lib/content-types";

/* ---- helpers ---- */
const CATEGORIES: { name: string; dbType: string; difficulty: string; slug: string; isProject?: boolean }[] = [
  { name: "Prompt(s)", dbType: "Prompt File", difficulty: "Beginner", slug: "prompt-file" },
  { name: "Agent(s)", dbType: "Agent Blueprint", difficulty: "Beginner", slug: "agent-blueprint" },
  { name: "Model Config Guide", dbType: "Model Config Guide", difficulty: "Beginner", slug: "model-config-guide" },
  { name: "Integration Guide", dbType: "Integration Guide", difficulty: "Beginner", slug: "integration-guide" },
  { name: "Workflow Template", dbType: "Workflow Template", difficulty: "Intermediate", slug: "workflow-template" },
  { name: "Evaluation Framework", dbType: "Evaluation Framework", difficulty: "Intermediate", slug: "evaluation-framework" },
  { name: "Agent Stack", dbType: "Agent Stack", difficulty: "Advanced", slug: "agent-stack" },
  { name: "Failure Library", dbType: "Failure Library", difficulty: "Any", slug: "failure-library" },
  { name: "Blog", dbType: "Blog", difficulty: "Any", slug: "blog" },
  { name: "Projects", dbType: "", difficulty: "Any", slug: "projects", isProject: true },
  { name: "AI Tools Tutorials", dbType: "AI Tools (LLMs)", difficulty: "Any", slug: "ai-tools-llms" },
  { name: "Install Guide", dbType: "AI Agent Install Guide", difficulty: "Any", slug: "install-guide" },
];

const diffColor: Record<string, string> = {
  Beginner: "text-slate-400 bg-[#353439]/40 border-white/8",
  Intermediate: "text-[#55e0d2] bg-[#55e0d2]/10 border-[#55e0d2]/25",
  Advanced: "text-[#ffb59c] bg-[#cb4300]/15 border-[#cb4300]/25",
  Any: "text-slate-500 bg-[#353439]/20 border-white/5",
};

export function RightPanel() {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();

  return (
    <div className="flex flex-col gap-5 p-4 pt-5">
      {/* Position 1 — Search bar */}
      <SearchSection />

      {/* Position 2 — Content type grid */}
      <CategoryDirectory navigate={navigate} />

      {/* Position 3 — Trending */}
      <TrendingSection navigate={navigate} />

      {/* Position 3.5 — Curator Picks */}
      <CuratorPicksSection navigate={navigate} />

      {/* Position 4 — Featured Collections */}
      <FeaturedCollectionsSection navigate={navigate} />

      {/* Position 5 — Who to follow (logged-in only) */}
      {isLoggedIn && user && <WhoToFollow userId={user.id} />}

      {/* Position 6 — Auth buttons (guests only) */}
      {!isLoggedIn && (
        <div className="flex flex-col gap-2">
          <Link
            to="/login"
            className="ns-btn-silver flex items-center justify-center h-9 w-full rounded-xl text-sm font-semibold transition-all"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="ns-btn-primary flex items-center justify-center h-9 w-full rounded-xl text-sm font-semibold transition-all"
          >
            Join free
          </Link>
        </div>
      )}

      {/* Position 7 — Footer links */}
      <div className="mt-auto pt-4 flex flex-col gap-1 text-[11px] text-slate-600">
        <Link to="/about" className="hover:text-foreground transition-colors">About NeoScale AI →</Link>
        <a href="https://twitter.com/neoscaleai" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
          Twitter @neoscaleai →
        </a>
      </div>
    </div>
  );
}

/* ---- Search ---- */
function SearchSection() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [content, setContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setUsers([]); setContent([]); return; }
    setLoading(true);
    const [uRes, cRes] = await Promise.all([
      supabase.from("profiles").select("id, username, display_name, avatar_url").or(`display_name.ilike.%${q}%,username.ilike.%${q}%`).limit(5),
      supabase.from("content_items").select("id, title, content_type, creator_id, profiles!content_items_creator_id_fkey(username)").ilike("title", `%${q}%`).eq("status", "approved").limit(5),
    ]);
    setUsers(uRes.data ?? []);
    setContent(cRes.data ?? []);
    setLoading(false);
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    setOpen(val.length >= 2);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim().length >= 1) {
      setOpen(false);
      setQuery("");
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const go = (path: string) => { setOpen(false); setQuery(""); navigate(path); };

  const noResults = !loading && users.length === 0 && content.length === 0 && query.length >= 2;

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Search the void..."
          className="h-9 rounded-full glass-pill pl-9 text-sm text-slate-300 placeholder:text-slate-600 border-none"
        />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-xl border border-white/5 shadow-xl" style={{ background: "rgba(8,8,12,0.95)", backdropFilter: "blur(40px)" }}>
          {loading && <p className="p-3 text-xs text-slate-500">Searching…</p>}
          {noResults && <p className="p-3 text-xs text-slate-500">No results for "{query}"</p>}
          {users.length > 0 && (
            <div className="p-2">
              <p className="px-2 pb-1 text-[10px] font-bold uppercase text-slate-500 tracking-widest">Users</p>
              {users.map((u: any) => (
                <button key={u.id} onClick={() => go(`/creator/${u.username}`)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[#353439]/60 transition-colors">
                  <Avatar className="h-6 w-6">
                    {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                    <AvatarFallback className="text-[10px] bg-[#353439] text-slate-300">{(u.display_name || u.username || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-slate-200">{u.display_name || u.username}</span>
                  {u.username && <span className="text-xs text-slate-500">@{u.username}</span>}
                </button>
              ))}
            </div>
          )}
          {content.length > 0 && (
            <div className="p-2 border-t border-white/5">
              <p className="px-2 pb-1 text-[10px] font-bold uppercase text-slate-500 tracking-widest">Content</p>
              {content.map((c: any) => (
                <button key={c.id} onClick={() => go(`/content/${c.id}`)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[#353439]/60 transition-colors">
                  <span className="shrink-0 rounded bg-[#353439] px-1.5 py-0.5 text-[10px] font-medium text-slate-300">{displayContentType(c.content_type)}</span>
                  <span className="truncate text-slate-200">{c.title}</span>
                  {c.profiles?.username && <span className="ml-auto text-xs text-slate-500">@{c.profiles.username}</span>}
                </button>
              ))}
            </div>
          )}
          {query.length >= 2 && !loading && (
            <div className="p-2 border-t border-white/5">
              <button
                onClick={() => go(`/search?q=${encodeURIComponent(query.trim())}`)}
                className="w-full text-center text-xs text-[#55e0d2] hover:underline py-1.5"
              >
                See all results for "{query}"
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- Section 1: Category Directory ---- */
function CategoryDirectory({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const location = useLocation();

  // Determine active slug from URL — single source of truth
  const getActiveSlug = (): string | null => {
    // Match /category/:slug routes
    const catMatch = location.pathname.match(/^\/category\/(.+)$/);
    if (catMatch) return catMatch[1];
    // Match /browse or /category/projects
    if (location.pathname === "/browse") {
      const params = new URLSearchParams(location.search);
      if (params.get("tab") === "projects") return "projects";
    }
    // Any other page: no card active
    return null;
  };
  const activeSlug = getActiveSlug();

  return (
    <div className="grid grid-cols-2 gap-2">
      {CATEGORIES.map((cat) => {
        const isAITools = cat.dbType === "AI Tools (LLMs)";

        // Strict equality — only highlight when slug explicitly matches
        const isActive = activeSlug !== null && activeSlug !== "" && activeSlug === cat.slug;

        const handleClick = () => {
          if (isActive) {
            navigate("/browse");
          } else if (cat.isProject) {
            navigate("/category/projects");
          } else {
            navigate(`/category/${cat.slug}`);
          }
        };

        const accentBorders: Record<string, string> = {
          "prompt-file": "rgba(232, 87, 26, 0.7)",
          "prompt-tutorial": "rgba(46, 196, 182, 0.7)",
          "agent-blueprint": "rgba(124, 58, 237, 0.7)",
          "model-config-guide": "rgba(22, 163, 74, 0.7)",
          "integration-guide": "rgba(217, 119, 6, 0.7)",
          "workflow-template": "rgba(37, 99, 235, 0.7)",
          "evaluation-framework": "rgba(219, 39, 119, 0.7)",
          "agent-stack": "rgba(220, 38, 38, 0.7)",
          "failure-library": "rgba(75, 85, 99, 0.7)",
          "blog": "rgba(244, 114, 182, 0.7)",
          "projects": "rgba(46, 196, 182, 0.7)",
          "ai-tools-llms": "rgba(167, 139, 250, 0.7)",
          "install-guide": "rgba(6, 182, 212, 0.7)",
        };
        const activeBorder = accentBorders[cat.slug] ?? "rgba(232, 87, 26, 0.7)";

        return (
          <button
            key={cat.slug}
            onClick={handleClick}
            className={`glass-level-1 text-left rounded-xl cursor-pointer transition-all duration-200 ${
              isActive ? "" : "hover:bg-[rgba(53,52,57,0.60)]"
            }`}
            style={{
              border: isActive
                ? `1.5px solid ${activeBorder}`
                : "1px solid rgba(255, 255, 255, 0.05)",
              padding: isActive ? "calc(0.875rem - 0.5px)" : "0.875rem",
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.18)"; }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.05)"; }}
          >
            <p className="text-sm font-semibold text-slate-200 leading-tight">{cat.name}</p>
            {cat.difficulty && (
              <span className={`mt-1.5 inline-block rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${diffColor[cat.difficulty] || diffColor.Any}`}>
                {cat.difficulty}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---- Section 2: Trending ---- */
function TrendingSection({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const { data: trending } = useQuery({
    queryKey: ["right_panel_trending"],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data } = await supabase
        .from("content_items")
        .select("id, title, content_type, download_count, view_count, rating_count, comment_count, approved_at, created_at")
        .eq("status", "approved")
        .gte("created_at", weekAgo)
        .order("download_count", { ascending: false })
        .limit(20);
      if (!data) return [];
      return data
        .map((item) => {
          const hoursOld = (Date.now() - new Date(item.approved_at || item.created_at).getTime()) / 3600000;
          const score = (item.download_count * 1.5 + item.view_count + item.rating_count * 2 + (item.comment_count || 0) * 1.2)
            / Math.pow(hoursOld + 2, 1.5);
          return { ...item, _score: score };
        })
        .sort((a, b) => b._score - a._score)
        .slice(0, 5);
    },
    staleTime: 60_000,
  });

  if (!trending || trending.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] text-slate-500 tracking-[0.2em] font-bold uppercase px-1 mb-3">Trending Now</p>
      <div className="space-y-1">
        {trending.map((item, i) => (
          <button
            key={item.id}
            onClick={() => navigate(`/content/${item.id}`)}
            className="glass-level-1 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all hover:scale-[1.02] border border-white/5"
          >
            <span className="shrink-0 w-6 text-xl font-light text-slate-600 text-center">{String(i + 1).padStart(2, "0")}</span>
            <div className="flex-1 overflow-hidden">
              <span className="block text-[8px] uppercase tracking-tighter text-[#55e0d2] bg-[#55e0d2]/10 px-1.5 py-0.5 rounded w-fit mb-1">
                {displayContentType(item.content_type)}
              </span>
              <span className="block truncate text-sm font-medium text-slate-200">{item.title}</span>
              <span className="block text-[10px] text-slate-500 mt-0.5">{item.download_count} downloads</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---- Section 3: Who to Follow ---- */
function WhoToFollow({ userId }: { userId: string }) {
  const { data: suggestions } = useQuery({
    queryKey: ["who_to_follow", userId],
    queryFn: async () => {
      const { data: followRows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);
      const followedIds = (followRows ?? []).map((r) => r.following_id);
      const excludeIds = [userId, ...followedIds];

      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, follower_count")
        .eq("is_creator", true)
        .order("follower_count", { ascending: false })
        .limit(20);
      return (data ?? []).filter((p) => !excludeIds.includes(p.id)).slice(0, 3);
    },
    staleTime: 120_000,
  });

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] text-slate-500 tracking-[0.2em] font-bold uppercase px-1 mb-3">Who to Follow</p>
      <div className="space-y-1">
        {suggestions.map((creator) => {
          const initials = (creator.display_name || creator.username || "?").slice(0, 2).toUpperCase();
          return (
            <div key={creator.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-[#353439]/40 transition-colors" style={{ minHeight: 64 }}>
              <Link to={`/creator/${creator.username}`}>
                <Avatar className="h-10 w-10 shrink-0">
                  {creator.avatar_url && <AvatarImage src={creator.avatar_url} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/creator/${creator.username}`} className="block">
                  <p className="text-[13px] font-bold text-foreground truncate">{creator.display_name || creator.username}</p>
                  {creator.username && <p className="text-xs text-muted-foreground truncate">@{creator.username}</p>}
                </Link>
                <p className="text-[11px] text-muted-foreground">{creator.follower_count} followers</p>
              </div>
              <FollowButton creatorId={creator.id} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- Section: Curator Picks ---- */
function CuratorPicksSection({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const { data: picks } = useQuery({
    queryKey: ["right_panel_curator_picks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("curator_recommendations")
        .select("id, recommendation_text, created_at, content_id, curators!curator_recommendations_curator_id_fkey(id, is_active, user_id, profiles:user_id(username, display_name, avatar_url, follower_count))")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!data) return [];
      const active = (data as any[]).filter((r) => r.curators?.is_active === true);
      if (active.length === 0) return [];
      const contentIds = active.map((r) => r.content_id);
      const { data: items } = await supabase
        .from("content_items")
        .select("id, title, content_type, status")
        .in("id", contentIds)
        .eq("status", "approved");
      const itemMap = Object.fromEntries((items ?? []).map((i) => [i.id, i]));
      return active
        .filter((r) => itemMap[r.content_id])
        .map((r) => ({ ...r, content: itemMap[r.content_id] }))
        .slice(0, 3);
    },
    staleTime: 120_000,
  });

  if (!picks || picks.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] text-slate-500 tracking-[0.2em] font-bold uppercase px-1 mb-3">Curator Picks</p>
      <div className="space-y-2">
        {picks.map((pick: any) => {
          const curator = pick.curators?.profiles;
          const initials = (curator?.display_name || curator?.username || "?").slice(0, 2).toUpperCase();
          return (
            <button
              key={pick.id}
              onClick={() => navigate(`/content/${pick.content_id}`)}
              className="w-full text-left rounded-xl px-3 py-2 transition-colors hover:bg-[#353439]/50 glass-level-1 border border-white/5"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_COLORS[pick.content?.content_type] || "bg-muted text-muted-foreground"}`}>
                  {displayContentType(pick.content?.content_type ?? "")}
                </span>
                <span className="flex-1 truncate text-[13px] font-bold text-foreground">{pick.content?.title}</span>
              </div>
              <p className="text-xs text-foreground italic truncate leading-relaxed">{pick.recommendation_text?.slice(0, 70)}{pick.recommendation_text?.length > 70 ? "…" : ""}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="h-[18px] w-[18px] rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[8px] font-medium shrink-0 overflow-hidden">
                  {curator?.avatar_url ? <img src={curator.avatar_url} alt="" className="h-full w-full object-cover" /> : initials}
                </div>
                <span className="text-[11px] text-muted-foreground">by @{curator?.username}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---- Section: Featured Collections ---- */
function FeaturedCollectionsSection({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const { data: collections } = useQuery({
    queryKey: ["right_panel_featured_collections"],
    queryFn: async () => {
      const { data } = await supabase
        .from("collections")
        .select("slug, title, item_count, follower_count, profiles!collections_owner_id_fkey(display_name, username)")
        .eq("is_public", true)
        .gte("item_count", 3)
        .order("follower_count", { ascending: false })
        .limit(3);
      return data ?? [];
    },
    staleTime: 120_000,
  });

  if (!collections || collections.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] text-slate-500 tracking-[0.2em] font-bold uppercase px-1 mb-3">Featured Collections</p>
      <div className="space-y-1">
        {collections.map((col: any) => {
          const owner = col.profiles;
          return (
            <button
              key={col.slug}
              onClick={() => navigate(`/collections/${col.slug}`)}
              className="flex flex-col w-full text-left rounded-xl px-3 py-2.5 transition-colors hover:bg-[#353439]/50"
              style={{ minHeight: 56 }}
            >
              <span className="text-sm font-semibold text-slate-200 truncate">{col.title}</span>
              <span className="text-[11px] text-slate-500">by @{owner?.username || "unknown"}</span>
              <span className="text-[11px] text-slate-500">{col.item_count} items · {col.follower_count} followers</span>
            </button>
          );
        })}
      </div>
      <Link to="/browse?tab=collections" className="text-[11px] text-slate-500 hover:text-[#55e0d2] transition-colors mt-1.5 inline-block px-1">
        Discover all →
      </Link>
    </div>
  );
}
