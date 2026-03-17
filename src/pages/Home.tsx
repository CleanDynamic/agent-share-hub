import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { BookmarkButton } from "@/components/BookmarkButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Download, Eye, Star, StarHalf, Loader2, MessageSquare, Upload, Search as SearchIcon,
} from "lucide-react";

/* ---- shared helpers ---- */
const PAGE_SIZE = 20;

const TYPE_COLORS: Record<string, string> = {
  "Prompt File": "bg-[#E8571A]/15 text-[#E8571A] border-[#E8571A]/30",
  "Prompt Tutorial": "bg-[#2EC4B6]/15 text-[#2EC4B6] border-[#2EC4B6]/30",
  "Agent Blueprint": "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "Workflow Template": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Agent Stack": "bg-red-500/15 text-red-400 border-red-500/30",
  "Model Config Guide": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Integration Guide": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "Evaluation Framework": "bg-pink-500/15 text-pink-400 border-pink-500/30",
  "Failure Library": "bg-muted text-muted-foreground border-border",
};

function difficultyColor(level: string) {
  switch (level) {
    case "Beginner": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "Intermediate": return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "Advanced": return "bg-red-500/15 text-red-400 border-red-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function roundedStars(avg: number, count: number): number {
  if (count === 0) return 0;
  if (avg >= 4.5) return 5;
  if (avg >= 4.1) return 4.5;
  if (avg >= 3.5) return 4;
  if (avg >= 3.1) return 3.5;
  if (avg >= 2.5) return 3;
  if (avg >= 2.1) return 2.5;
  if (avg >= 1.5) return 2;
  if (avg >= 1.1) return 1.5;
  return 1;
}

function MiniStars({ value }: { value: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(value)) stars.push(<Star key={i} className="h-3 w-3 fill-primary text-primary" />);
    else if (i - 0.5 === value) stars.push(<StarHalf key={i} className="h-3 w-3 fill-primary text-primary" />);
    else stars.push(<Star key={i} className="h-3 w-3 text-muted-foreground/30" />);
  }
  return <div className="flex gap-0.5">{stars}</div>;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function formatNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/* ---- Feed Item Component ---- */
function FeedItem({ item, rank }: { item: any; rank?: number }) {
  const profile = item.profiles as any;
  const starVal = roundedStars(Number(item.avg_rating) || 0, item.rating_count ?? 0);
  const initials = (profile?.display_name || profile?.username || "?").slice(0, 2).toUpperCase();

  return (
    <div className="px-4 py-3 border-b border-border">
      {/* Top line */}
      <div className="flex items-center gap-2 mb-1.5">
        {rank != null && (
          <span className="text-lg font-bold text-primary w-7 shrink-0">{String(rank).padStart(2, "0")}</span>
        )}
        <Link to={`/creator/${profile?.username}`}>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">{initials}</AvatarFallback>
          </Avatar>
        </Link>
        <Link to={`/creator/${profile?.username}`} className="text-sm font-semibold text-foreground hover:underline truncate">
          {profile?.display_name || profile?.username || "Unknown"}
        </Link>
        <span className="text-[13px] text-muted-foreground truncate">@{profile?.username}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-[13px] text-muted-foreground shrink-0">{timeAgo(item.created_at)}</span>
        <div className="ml-auto shrink-0">
          <BookmarkButton contentId={item.id} />
        </div>
      </div>

      {/* Badges */}
      <div className="flex gap-1.5 mb-1">
        <Badge variant="outline" className={`text-[10px] font-medium ${TYPE_COLORS[item.content_type] ?? TYPE_COLORS["Failure Library"]}`}>
          {item.content_type}
        </Badge>
        <Badge variant="outline" className={`text-[10px] font-medium ${difficultyColor(item.difficulty)}`}>
          {item.difficulty}
        </Badge>
      </div>

      {/* Title */}
      <p className="text-base font-bold text-foreground leading-snug">{item.title}</p>

      {/* Description */}
      {item.description && (
        <p className="text-sm text-muted-foreground truncate mt-0.5">{item.description}</p>
      )}

      {/* Stats + action */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{formatNum(item.view_count ?? 0)}</span>
          <span className="flex items-center gap-1"><Download className="h-3.5 w-3.5" />{formatNum(item.download_count)}</span>
          {(item.rating_count ?? 0) > 0 ? <MiniStars value={starVal} /> : null}
          <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{item.comment_count ?? 0}</span>
        </div>
        <Button variant="outline" size="sm" className="border-secondary text-secondary hover:bg-secondary/10 text-xs h-7" asChild>
          <Link to={`/content/${item.id}`}>View</Link>
        </Button>
      </div>
    </div>
  );
}

/* ---- Trending Feed Item (uses highest stat) ---- */
function TrendingFeedItem({ item, rank }: { item: any; rank: number }) {
  const profile = item.profiles as any;
  const initials = (profile?.display_name || profile?.username || "?").slice(0, 2).toUpperCase();
  const views = item.view_count ?? 0;
  const downloads = item.download_count ?? 0;
  const highestStat = views >= downloads ? `${formatNum(views)} views` : `${formatNum(downloads)} downloads`;

  return (
    <div className="px-4 py-3 border-b border-border">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-lg font-bold text-primary w-7 shrink-0">{String(rank).padStart(2, "0")}</span>
        <Link to={`/creator/${profile?.username}`}>
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">{initials}</AvatarFallback>
          </Avatar>
        </Link>
        <Link to={`/creator/${profile?.username}`} className="text-sm font-semibold text-foreground hover:underline truncate">
          {profile?.display_name || profile?.username || "Unknown"}
        </Link>
        <span className="text-[13px] text-muted-foreground truncate">@{profile?.username}</span>
        <div className="ml-auto shrink-0">
          <BookmarkButton contentId={item.id} />
        </div>
      </div>

      <div className="flex gap-1.5 mb-1">
        <Badge variant="outline" className={`text-[10px] font-medium ${TYPE_COLORS[item.content_type] ?? TYPE_COLORS["Failure Library"]}`}>
          {item.content_type}
        </Badge>
        <Badge variant="outline" className={`text-[10px] font-medium ${difficultyColor(item.difficulty)}`}>
          {item.difficulty}
        </Badge>
      </div>

      <p className="text-base font-bold text-foreground leading-snug">{item.title}</p>
      {item.description && <p className="text-sm text-muted-foreground truncate mt-0.5">{item.description}</p>}

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-muted-foreground">{highestStat}</span>
        <Button variant="outline" size="sm" className="border-secondary text-secondary hover:bg-secondary/10 text-xs h-7" asChild>
          <Link to={`/content/${item.id}`}>View</Link>
        </Button>
      </div>
    </div>
  );
}

/* ---- Sign-in prompt ---- */
function SignInPrompt() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 gap-4">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
        <span className="text-muted-foreground text-lg">?</span>
      </div>
      <p className="text-sm text-muted-foreground text-center">Sign in to see your personalised feed</p>
      <div className="flex items-center gap-3">
        <Button size="sm" asChild><Link to="/login">Sign in</Link></Button>
        <span className="text-xs text-muted-foreground">or</span>
        <Button size="sm" variant="outline" className="border-secondary text-secondary" asChild>
          <Link to="/signup">Join free</Link>
        </Button>
      </div>
    </div>
  );
}

/* ---- Tab: Recent ---- */
function RecentTab() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["home_recent"],
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, title, description, content_type, difficulty, ai_tools, avg_rating, rating_count, download_count, view_count, comment_count, created_at, profiles!content_items_creator_id_fkey(display_name, username)")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);
      if (error) throw error;
      return data ?? [];
    },
    getNextPageParam: (last, all) => last.length < PAGE_SIZE ? undefined : all.flat().length,
    initialPageParam: 0,
  });

  const items = data?.pages.flat() ?? [];

  return (
    <div>
      {/* Live indicator */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <span className="relative flex h-[6px] w-[6px]">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-primary" />
        </span>
        <span className="text-xs text-muted-foreground">Updated live</span>
      </div>

      {isLoading ? (
        <div className="space-y-0">{[1,2,3,4,5].map(n => <div key={n} className="h-32 animate-pulse bg-card/30 border-b border-border" />)}</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-16 text-center">No content yet.</p>
      ) : (
        items.map((item: any) => <FeedItem key={item.id} item={item} />)
      )}

      {hasNextPage && (
        <div className="flex justify-center py-6">
          <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Load more
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---- Tab: For You (reuses FYP logic inline to avoid importing the page) ---- */
function ForYouTab() {
  const { isLoggedIn, user } = useAuth();
  if (!isLoggedIn) return <SignInPrompt />;

  const { data: followIds } = useQuery({
    queryKey: ["fyp_follow_ids_home", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("follows").select("following_id").eq("follower_id", user!.id);
      return (data ?? []).map(r => r.following_id);
    },
    enabled: !!user,
  });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["fyp_interactions_home", followIds],
    queryFn: async ({ pageParam = 0 }) => {
      if (!followIds || followIds.length === 0) return [];
      const { data, error } = await supabase
        .from("user_interactions")
        .select("id, user_id, content_id, interaction_type, interaction_meta, created_at, profiles!user_interactions_user_id_fkey(display_name, username, avatar_url)")
        .in("user_id", followIds)
        .in("interaction_type", ["downloaded", "rated", "commented", "bookmarked"])
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + 49);
      if (error) throw error;
      return data ?? [];
    },
    getNextPageParam: (last, all) => last.length < 50 ? undefined : all.flat().length,
    initialPageParam: 0,
    enabled: !!followIds && followIds.length > 0,
  });

  // Deduplicate by user_id+content_id, keep most recent
  const rawItems = data?.pages.flat() ?? [];
  const seen = new Map<string, any>();
  for (const item of rawItems) {
    const key = `${item.user_id}-${item.content_id}`;
    if (!seen.has(key)) seen.set(key, item);
  }
  const dedupedInteractions = Array.from(seen.values());

  // Fetch content for interactions
  const contentIds = [...new Set(dedupedInteractions.map(i => i.content_id))];
  const { data: contentItems } = useQuery({
    queryKey: ["fyp_content_home", contentIds.join(",")],
    queryFn: async () => {
      if (contentIds.length === 0) return [];
      const { data } = await supabase
        .from("content_items")
        .select("id, title, description, content_type, difficulty, avg_rating, rating_count, download_count, view_count, comment_count, created_at, profiles!content_items_creator_id_fkey(display_name, username)")
        .in("id", contentIds);
      return data ?? [];
    },
    enabled: contentIds.length > 0,
  });

  if (followIds && followIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 gap-3">
        <p className="text-sm text-muted-foreground text-center">You are not following anyone yet.<br/>Follow some creators to see what they're up to.</p>
        <Button size="sm" variant="outline" asChild><Link to="/browse">Discover creators</Link></Button>
      </div>
    );
  }

  const contentMap = new Map((contentItems ?? []).map(c => [c.id, c]));

  return (
    <div>
      {isLoading ? (
        <div className="space-y-0">{[1,2,3,4,5].map(n => <div key={n} className="h-32 animate-pulse bg-card/30 border-b border-border" />)}</div>
      ) : dedupedInteractions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-16 text-center">No recent activity from people you follow.</p>
      ) : (
        dedupedInteractions.map((interaction: any) => {
          const content = contentMap.get(interaction.content_id);
          if (!content) return null;
          const actorProfile = interaction.profiles as any;
          const actorInitials = (actorProfile?.display_name || actorProfile?.username || "?").slice(0, 2).toUpperCase();
          const actionLabel = interaction.interaction_type === "downloaded" ? "downloaded"
            : interaction.interaction_type === "rated" ? `rated ★${(interaction.interaction_meta as any)?.rating ?? "?"}`
            : interaction.interaction_type === "commented" ? "commented on"
            : "saved";

          return (
            <div key={interaction.id} className="border-b border-border">
              <div className="px-4 pt-3 pb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Link to={`/creator/${actorProfile?.username}`}>
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="bg-accent text-[8px]">{actorInitials}</AvatarFallback>
                  </Avatar>
                </Link>
                <Link to={`/creator/${actorProfile?.username}`} className="font-medium text-foreground hover:underline">
                  {actorProfile?.display_name || actorProfile?.username}
                </Link>
                <span>{actionLabel}</span>
                <span className="ml-auto">{timeAgo(interaction.created_at)}</span>
              </div>
              <FeedItem item={content} />
            </div>
          );
        })
      )}

      {hasNextPage && (
        <div className="flex justify-center py-6">
          <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Load more
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---- Tab: Following ---- */
function FollowingTab() {
  const { isLoggedIn, user } = useAuth();
  if (!isLoggedIn) return <SignInPrompt />;

  const { data: followIds } = useQuery({
    queryKey: ["home_follow_ids", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("follows").select("following_id").eq("follower_id", user!.id);
      return (data ?? []).map(r => r.following_id);
    },
    enabled: !!user,
  });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["home_following_feed", followIds],
    queryFn: async ({ pageParam = 0 }) => {
      if (!followIds || followIds.length === 0) return [];
      const { data, error } = await supabase
        .from("content_items")
        .select("id, title, description, content_type, difficulty, ai_tools, avg_rating, rating_count, download_count, view_count, comment_count, created_at, creator_id, profiles!content_items_creator_id_fkey(display_name, username)")
        .in("creator_id", followIds)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);
      if (error) throw error;
      return data ?? [];
    },
    getNextPageParam: (last, all) => last.length < PAGE_SIZE ? undefined : all.flat().length,
    initialPageParam: 0,
    enabled: !!followIds && followIds.length > 0,
  });

  if (followIds && followIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 gap-3">
        <p className="text-sm text-muted-foreground text-center">You are not following anyone.<br/>Follow creators to see their posts here.</p>
        <Button size="sm" variant="outline" asChild><Link to="/browse">Discover creators</Link></Button>
      </div>
    );
  }

  const items = data?.pages.flat() ?? [];

  return (
    <div>
      {isLoading ? (
        <div className="space-y-0">{[1,2,3,4,5].map(n => <div key={n} className="h-32 animate-pulse bg-card/30 border-b border-border" />)}</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-16 text-center">No posts from people you follow yet.</p>
      ) : (
        items.map((item: any) => <FeedItem key={item.id} item={item} />)
      )}

      {hasNextPage && (
        <div className="flex justify-center py-6">
          <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Load more
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---- Tab: Trending ---- */
function TrendingTab() {
  const { data: items, isLoading } = useQuery({
    queryKey: ["home_trending"],
    queryFn: async () => {
      const d7 = new Date(Date.now() - 7 * 86400000).toISOString();
      const d30 = new Date(Date.now() - 30 * 86400000).toISOString();

      const { data: week } = await supabase
        .from("content_items")
        .select("id, title, description, content_type, difficulty, ai_tools, avg_rating, rating_count, download_count, view_count, comment_count, created_at, profiles!content_items_creator_id_fkey(display_name, username)")
        .eq("status", "approved")
        .gte("created_at", d7)
        .limit(50);

      let pool = week ?? [];

      if (pool.length < 5) {
        const ids = pool.map(p => p.id);
        const { data: month } = await supabase
          .from("content_items")
          .select("id, title, description, content_type, difficulty, ai_tools, avg_rating, rating_count, download_count, view_count, comment_count, created_at, profiles!content_items_creator_id_fkey(display_name, username)")
          .eq("status", "approved")
          .gte("created_at", d30)
          .limit(50);
        const extras = (month ?? []).filter(m => !ids.includes(m.id));
        pool = [...pool, ...extras];
      }

      return pool
        .map((item) => {
          const hoursOld = (Date.now() - new Date(item.approved_at || item.created_at).getTime()) / 3600000;
          const score = (item.download_count * 1.5 + item.view_count + item.rating_count * 2 + item.comment_count * 1.2)
            / Math.pow(hoursOld + 2, 1.5);
          return { ...item, _score: score };
        })
        .sort((a, b) => b._score - a._score)
        .slice(0, 20);
    },
    staleTime: 60_000,
  });

  return (
    <div>
      {isLoading ? (
        <div className="space-y-0">{[1,2,3,4,5].map(n => <div key={n} className="h-32 animate-pulse bg-card/30 border-b border-border" />)}</div>
      ) : !items || items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-16 text-center">No trending content yet.</p>
      ) : (
        items.map((item: any, i: number) => <TrendingFeedItem key={item.id} item={item} rank={i + 1} />)
      )}
    </div>
  );
}

/* ---- How It Works (guests only) ---- */
function HowItWorks() {
  const steps = [
    { icon: <SearchIcon className="h-8 w-8 text-primary" />, label: "STEP 1", title: "Find what you need", sub: "Search or filter by what you want your AI to do." },
    { icon: <Download className="h-8 w-8 text-primary" />, label: "STEP 2", title: "Download or read it", sub: "Get the prompt, blueprint, or workflow instantly." },
    { icon: <Upload className="h-8 w-8 text-primary" />, label: "STEP 3", title: "Use it in your AI tool", sub: "Paste it into ChatGPT, Claude, Gemini, or any AI." },
  ];
  return (
    <div className="px-4 py-6 border-b border-border">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {steps.map((s) => (
          <div key={s.label} className="flex flex-col items-center text-center gap-2">
            {s.icon}
            <span className="text-[11px] font-semibold text-primary tracking-[0.1em]">{s.label}</span>
            <p className="text-base font-bold text-foreground">{s.title}</p>
            <p className="text-[13px] text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Main Home Page ---- */
const TABS = ["Recent", "For You", "Following", "Trending"] as const;
type Tab = typeof TABS[number];

const Home = () => {
  const [activeTab, setActiveTab] = useState<Tab>("Recent");
  const { isLoggedIn, profile } = useAuth();
  const navigate = useNavigate();

  const initials = profile?.display_name
    ? profile.display_name.slice(0, 2).toUpperCase()
    : profile?.username?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <div>
      <SeoHead
        title="NeoScale AI — The AI Agent Tactics Forum"
        description="Download AI assistants, blueprints and workflows. Works with ChatGPT, Claude, Gemini and any AI tool."
        path="/"
      />

      {/* Compose area (logged-in only) */}
      {isLoggedIn && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Avatar className="h-10 w-10 shrink-0">
            {profile?.avatar_url && <img src={profile.avatar_url} className="h-full w-full rounded-full object-cover" />}
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">{initials}</AvatarFallback>
          </Avatar>
          <button
            onClick={() => navigate("/upload")}
            className="flex-1 h-10 rounded-full bg-card border border-border px-4 text-left text-sm text-muted-foreground hover:border-primary/40 transition-colors"
          >
            Share something...
          </button>
          <button onClick={() => navigate("/upload")} className="p-2 text-primary hover:text-primary/80 transition-colors">
            <Upload className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* How It Works (guests only, scrolls away above sticky tabs) */}
      {!isLoggedIn && <HowItWorks />}

      {/* Tab bar (sticky) */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-center py-3.5 text-[15px] font-medium transition-colors relative ${
                activeTab === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "Recent" && <RecentTab />}
      {activeTab === "For You" && <ForYouTab />}
      {activeTab === "Following" && <FollowingTab />}
      {activeTab === "Trending" && <TrendingTab />}
    </div>
  );
};

export default Home;
