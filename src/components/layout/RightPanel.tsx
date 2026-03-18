import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FollowButton } from "@/components/FollowButton";

/* ---- helpers ---- */
const CATEGORIES: { name: string; difficulty: string; slug: string; isProject?: boolean }[] = [
  { name: "Prompt File", difficulty: "Beginner", slug: "prompt-file" },
  { name: "Prompt Tutorial", difficulty: "Beginner", slug: "prompt-tutorial" },
  { name: "Agent Blueprint", difficulty: "Beginner", slug: "agent-blueprint" },
  { name: "Workflow Template", difficulty: "Intermediate", slug: "workflow-template" },
  { name: "Agent Stack", difficulty: "Advanced", slug: "agent-stack" },
  { name: "Model Config Guide", difficulty: "Beginner", slug: "model-config-guide" },
  { name: "Integration Guide", difficulty: "Beginner", slug: "integration-guide" },
  { name: "Evaluation Framework", difficulty: "Intermediate", slug: "evaluation-framework" },
  { name: "Failure Library", difficulty: "Any", slug: "failure-library" },
  { name: "Projects", difficulty: "", slug: "projects", isProject: true },
];

const diffColor: Record<string, string> = {
  Beginner: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Intermediate: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  Advanced: "text-red-400 bg-red-400/10 border-red-400/20",
  Any: "text-muted-foreground bg-muted border-border",
};

export function RightPanel() {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();

  return (
    <div className="flex flex-col gap-6 p-4 pt-5">
      {/* Position 1 — Auth buttons (guests only) */}
      {!isLoggedIn && (
        <div className="flex flex-col gap-2">
          <Link
            to="/login"
            className="flex items-center justify-center h-9 w-full rounded-[20px] text-sm font-semibold text-foreground border border-border hover:brightness-110 transition-colors"
            style={{ background: "#111118" }}
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="flex items-center justify-center h-9 w-full rounded-[20px] bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Join free
          </Link>
        </div>
      )}

      {/* Position 2 — Trending */}
      <TrendingSection navigate={navigate} />

      {/* Position 2.5 — Curator Picks */}
      <CuratorPicksSection navigate={navigate} />

      {/* Position 2.75 — Featured Collections */}
      <FeaturedCollectionsSection navigate={navigate} />

      {/* Position 3 — Category Directory */}
      <CategoryDirectory navigate={navigate} />

      {/* Position 4 — Who to follow (logged-in only) */}
      {isLoggedIn && user && <WhoToFollow userId={user.id} />}

      {/* Position 5 — Footer links */}
      <div className="mt-auto pt-4 flex items-center gap-3 text-[11px] text-muted-foreground">
        <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
        <span>·</span>
        <Link to="/upload" className="hover:text-foreground transition-colors">Upload</Link>
        <span>·</span>
        <a href="https://twitter.com/neoscaleai" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
          Twitter @neoscaleai
        </a>
      </div>
    </div>
  );
}

/* ---- Section 1: Category Directory ---- */
function CategoryDirectory({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.slug}
          onClick={() =>
            navigate(`/category/${cat.slug}`)
          }
          className="text-left rounded-xl p-3.5 transition-colors hover:brightness-110"
          style={{
            background: "#111118",
            border: `1px solid ${cat.isProject ? "#2EC4B6" : "#1E1E2A"}`,
          }}
        >
          <p className="text-sm font-bold text-foreground leading-tight">{cat.name}</p>
          {cat.difficulty && (
            <span className={`mt-1.5 inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${diffColor[cat.difficulty] || diffColor.Any}`}>
              {cat.difficulty}
            </span>
          )}
        </button>
      ))}
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
      <p className="text-base font-medium text-foreground mb-3">Trending</p>
      <div className="space-y-0.5">
        {trending.map((item, i) => (
          <button
            key={item.id}
            onClick={() => navigate(`/content/${item.id}`)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent/60"
            style={{ height: 56 }}
          >
            <span className="shrink-0 w-6 text-xs text-muted-foreground text-center">#{i + 1}</span>
            <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
              {item.content_type}
            </span>
            <span className="flex-1 truncate text-[13px] font-bold text-foreground">{item.title}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{item.download_count} ↓</span>
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
      // Get IDs the user already follows
      const { data: followRows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);
      const followedIds = (followRows ?? []).map((r) => r.following_id);
      const excludeIds = [userId, ...followedIds];

      let query = supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, follower_count")
        .eq("is_creator", true)
        .order("follower_count", { ascending: false })
        .limit(20);

      const { data } = await query;
      // Filter out followed + self client-side (not in excludes a uuid array in postgrest easily)
      return (data ?? []).filter((p) => !excludeIds.includes(p.id)).slice(0, 3);
    },
    staleTime: 120_000,
  });

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div>
      <p className="text-base font-medium text-foreground mb-3">Who to follow</p>
      <div className="space-y-1">
        {suggestions.map((creator) => {
          const initials = (creator.display_name || creator.username || "?").slice(0, 2).toUpperCase();
          return (
            <div key={creator.id} className="flex items-center gap-3 rounded-lg px-2 py-2" style={{ minHeight: 64 }}>
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
      // Filter to active curators and join content
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

  const TYPE_COLORS: Record<string, string> = {
    "Prompt File": "bg-[#E8571A]/15 text-[#E8571A]",
    "Prompt Tutorial": "bg-[#2EC4B6]/15 text-[#2EC4B6]",
    "Agent Blueprint": "bg-purple-500/15 text-purple-400",
    "Workflow Template": "bg-blue-500/15 text-blue-400",
    "Agent Stack": "bg-red-500/15 text-red-400",
  };

  return (
    <div>
      <p className="text-base font-medium text-foreground mb-3">Curator Picks</p>
      <div className="space-y-2">
        {picks.map((pick: any) => {
          const curator = pick.curators?.profiles;
          const initials = (curator?.display_name || curator?.username || "?").slice(0, 2).toUpperCase();
          return (
            <button
              key={pick.id}
              onClick={() => navigate(`/content/${pick.content_id}`)}
              className="w-full text-left rounded-lg px-2 py-2 transition-colors hover:bg-accent/60"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_COLORS[pick.content?.content_type] || "bg-muted text-muted-foreground"}`}>
                  {pick.content?.content_type}
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
      <p className="text-base font-medium text-foreground mb-3">Featured Collections</p>
      <div className="space-y-0.5">
        {collections.map((col: any) => {
          const owner = col.profiles;
          return (
            <button
              key={col.slug}
              onClick={() => navigate(`/collections/${col.slug}`)}
              className="flex flex-col w-full text-left rounded-lg px-2 py-2 transition-colors hover:bg-accent/60"
              style={{ minHeight: 56 }}
            >
              <span className="text-[13px] font-bold text-foreground truncate">{col.title}</span>
              <span className="text-[11px] text-muted-foreground">by @{owner?.username || "unknown"}</span>
              <span className="text-[11px] text-muted-foreground">{col.item_count} items · {col.follower_count} followers</span>
            </button>
          );
        })}
      </div>
      <Link to="/browse?tab=collections" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-1.5 inline-block">
        Browse all →
      </Link>
    </div>
  );
}
