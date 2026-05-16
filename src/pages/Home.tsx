import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import { FeedItem, timeAgo } from "@/components/FeedItem";
import { CollectionFeedCard } from "@/components/CollectionFeedCard";
import { ProjectFeedCard } from "@/components/ProjectFeedCard";
import { ReblogCard } from "@/components/ReblogCard";
import { FeedReblogAdapter, type FeedReblogRow } from "@/components/reblog/FeedReblogAdapter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Download, Loader2, Upload, Search as SearchIcon } from "lucide-react";
import { ActiveCompetitionsSection } from "@/components/home/ActiveCompetitionsSection";

const PAGE_SIZE = 20;



function renderFeedEntry(entry: any) {
  if (entry._feedType === "collection") return <CollectionFeedCard key={`col-${entry.id}`} item={entry} />;
  if (entry._feedType === "project") return <ProjectFeedCard key={`proj-${entry.id}`} item={entry} />;
  if (entry._feedType === "reblog") return <FeedReblogAdapter key={`rb-${entry.id}`} row={entry as FeedReblogRow} />;
  if (entry.is_reblog) return <ReblogCard key={entry.id} item={entry} />;
  return <FeedItem key={entry.id} item={entry} />;
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
        <Button size="sm" className="ns-btn-primary border-secondary text-secondary" asChild>
          <Link to="/signup">Join free</Link>
        </Button>
      </div>
    </div>
  );
}

/* ---- Tab: Recent ---- */
function RecentTab() {
  const { data: blueprints, isLoading: bpLoading } = useQuery({
    queryKey: ["home_recent_blueprints"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, title, description, content_type, creator_id, difficulty, ai_tools, use_cases, custom_use_case_description, avg_rating, rating_count, download_count, view_count, comment_count, cover_image_url, created_at, what_to_expect_blocks, what_to_expect, other_tool_name, tool_subtype, model_parameters, custom_tags, profiles!content_items_creator_id_fkey(display_name, username)")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((d: any) => ({ ...d, _feedType: "blueprint" as const, _sortDate: new Date(d.created_at).getTime() }));
    },
  });

  const { data: collections, isLoading: colLoading } = useQuery({
    queryKey: ["home_recent_collections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("id, title, description, slug, item_count, follower_count, created_at, profiles:owner_id(display_name, username)")
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((d: any) => ({ ...d, _feedType: "collection" as const, _sortDate: new Date(d.created_at).getTime() }));
    },
  });

  const { data: projects, isLoading: projLoading } = useQuery({
    queryKey: ["home_recent_projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, description, cover_image_url, view_count, created_at, approved_at, package_price_enabled, package_price_gbp, profiles:creator_id(display_name, username), project_components(id, linked_content_id, inline_content_id)")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        ...d,
        _feedType: "project" as const,
        _sortDate: new Date(d.approved_at || d.created_at).getTime(),
        _component_count: (d.project_components ?? []).length,
      }));
    },
  });

  const { data: reblogs, isLoading: rbLoading } = useQuery({
    queryKey: ["home_recent_reblogs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reblogs")
        .select(`
          id, slug, text, media_kind, media_url, thumbnail_url, created_at,
          like_count, comment_count, reblog_count, bookmark_count,
          parent_reblog_id, root_original_post_id, original_post_id, reblogger_id,
          reblogger:profiles!reblogs_reblogger_id_fkey(id, username, display_name, avatar_url),
          embedded_original:content_items!reblogs_original_post_id_fkey(
            id, slug, title, description, post_type, cover_image_url, created_at, creator_id,
            author:profiles!content_items_creator_id_fkey(username, display_name, avatar_url)
          )
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        ...d,
        _feedType: "reblog" as const,
        _sortDate: new Date(d.created_at).getTime(),
      }));
    },
  });

  const isLoading = bpLoading || colLoading || projLoading || rbLoading;
  const merged = [...(blueprints ?? []), ...(collections ?? []), ...(projects ?? []), ...(reblogs ?? [])]
    .sort((a, b) => b._sortDate - a._sortDate);

  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <span className="relative flex h-[6px] w-[6px]">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-primary" />
        </span>
        <span className="text-xs text-muted-foreground">Updated live</span>
      </div>

      {isLoading ? (
        <div className="space-y-0">{[1,2,3,4,5].map(n => <div key={n} className="h-24 animate-pulse bg-card/30 border-b border-border" />)}</div>
      ) : merged.length === 0 ? (
        <p className="text-sm text-muted-foreground py-16 text-center">No content yet.</p>
      ) : (
        merged.map((entry: any) => renderFeedEntry(entry))
      )}
    </div>
  );
}

/* ---- Tab: For You ---- */
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

  const rawItems = data?.pages.flat() ?? [];
  const seen = new Map<string, any>();
  for (const item of rawItems) {
    const key = `${item.user_id}-${item.content_id}`;
    if (!seen.has(key)) seen.set(key, item);
  }
  const dedupedInteractions = Array.from(seen.values());

  const contentIds = [...new Set(dedupedInteractions.map(i => i.content_id))];
  const { data: contentItems } = useQuery({
    queryKey: ["fyp_content_home", contentIds.join(",")],
    queryFn: async () => {
      if (contentIds.length === 0) return [];
      const { data } = await supabase
        .from("content_items")
        .select("id, title, description, content_type, difficulty, ai_tools, use_cases, custom_use_case_description, avg_rating, rating_count, download_count, view_count, comment_count, cover_image_url, created_at, what_to_expect_blocks, what_to_expect, other_tool_name, custom_tags, profiles!content_items_creator_id_fkey(display_name, username)")
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
        <div className="space-y-0">{[1,2,3,4,5].map(n => <div key={n} className="h-24 animate-pulse bg-card/30 border-b border-border" />)}</div>
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
            <div key={interaction.id}>
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

  const { data: bpData, isLoading: bpLoading } = useQuery({
    queryKey: ["home_following_bp", followIds],
    queryFn: async () => {
      if (!followIds || followIds.length === 0) return [];
      const { data } = await supabase
        .from("content_items")
        .select("id, title, description, content_type, creator_id, difficulty, ai_tools, use_cases, custom_use_case_description, avg_rating, rating_count, download_count, view_count, comment_count, cover_image_url, created_at, what_to_expect_blocks, what_to_expect, other_tool_name, tool_subtype, model_parameters, custom_tags, profiles!content_items_creator_id_fkey(display_name, username)")
        .in("creator_id", followIds)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(40);
      return (data ?? []).map((d: any) => ({ ...d, _feedType: "blueprint" as const, _sortDate: new Date(d.created_at).getTime() }));
    },
    enabled: !!followIds && followIds.length > 0,
  });

  const { data: colData, isLoading: colLoading } = useQuery({
    queryKey: ["home_following_col", followIds],
    queryFn: async () => {
      if (!followIds || followIds.length === 0) return [];
      const { data } = await supabase
        .from("collections")
        .select("id, title, description, slug, item_count, follower_count, created_at, profiles:owner_id(display_name, username)")
        .in("owner_id", followIds)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []).map((d: any) => ({ ...d, _feedType: "collection" as const, _sortDate: new Date(d.created_at).getTime() }));
    },
    enabled: !!followIds && followIds.length > 0,
  });

  const { data: projData, isLoading: projLoading } = useQuery({
    queryKey: ["home_following_proj", followIds],
    queryFn: async () => {
      if (!followIds || followIds.length === 0) return [];
      const { data } = await supabase
        .from("projects")
        .select("id, title, description, cover_image_url, view_count, created_at, approved_at, package_price_enabled, package_price_gbp, profiles:creator_id(display_name, username), project_components(id)")
        .in("creator_id", followIds)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []).map((d: any) => ({
        ...d,
        _feedType: "project" as const,
        _sortDate: new Date(d.approved_at || d.created_at).getTime(),
        _component_count: (d.project_components ?? []).length,
      }));
    },
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

  const isLoading = bpLoading || colLoading || projLoading;
  const merged = [...(bpData ?? []), ...(colData ?? []), ...(projData ?? [])]
    .sort((a, b) => b._sortDate - a._sortDate);

  return (
    <div>
      {isLoading ? (
        <div className="space-y-0">{[1,2,3,4,5].map(n => <div key={n} className="h-24 animate-pulse bg-card/30 border-b border-border" />)}</div>
      ) : merged.length === 0 ? (
        <p className="text-sm text-muted-foreground py-16 text-center">No posts from people you follow yet.</p>
      ) : (
        merged.map((entry: any) => renderFeedEntry(entry))
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
        .select("id, title, description, content_type, difficulty, ai_tools, use_cases, custom_use_case_description, avg_rating, rating_count, download_count, view_count, comment_count, cover_image_url, created_at, approved_at, what_to_expect_blocks, what_to_expect, other_tool_name, custom_tags, profiles!content_items_creator_id_fkey(display_name, username)")
        .eq("status", "approved")
        .gte("created_at", d7)
        .limit(50);

      let pool = week ?? [];

      if (pool.length < 5) {
        const ids = pool.map(p => p.id);
        const { data: month } = await supabase
          .from("content_items")
          .select("id, title, description, content_type, difficulty, ai_tools, use_cases, custom_use_case_description, avg_rating, rating_count, download_count, view_count, comment_count, cover_image_url, created_at, approved_at, what_to_expect_blocks, what_to_expect, other_tool_name, custom_tags, profiles!content_items_creator_id_fkey(display_name, username)")
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
        <div className="space-y-0">{[1,2,3,4,5].map(n => <div key={n} className="h-24 animate-pulse bg-card/30 border-b border-border" />)}</div>
      ) : !items || items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-16 text-center">No trending content yet.</p>
      ) : (
        items.map((item: any, i: number) => <FeedItem key={item.id} item={item} rank={i + 1} />)
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
const TABS = ["For You", "Following", "Trending", "Recent"] as const;
type Tab = typeof TABS[number];

const Home = () => {
  const [activeTab, setActiveTab] = useState<Tab>("For You");
  const { isLoggedIn, profile } = useAuth();
  const navigate = useNavigate();

  const initials = profile?.display_name
    ? profile.display_name.slice(0, 2).toUpperCase()
    : profile?.username?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <div style={{ paddingTop: 28 }}>
      <SeoHead
        title="NeoScale AI — The AI Agent Tactics Forum"
        description="Download AI assistants, blueprints and workflows. Works with ChatGPT, Claude, Gemini and any AI tool."
        path="/"
      />

      {isLoggedIn && (
        <div
          className="flex items-center gap-3 mx-6 mt-7 mb-5"
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: 14,
            padding: '12px 16px',
          }}
        >
          <Avatar className="shrink-0" style={{ width: 34, height: 34 }}>
            {profile?.avatar_url && <img src={profile.avatar_url} className="h-full w-full rounded-full object-cover" />}
            <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">{initials}</AvatarFallback>
          </Avatar>
          <button
            onClick={() => navigate("/upload")}
            className="flex-1 text-left transition-colors"
            style={{ fontSize: 14, fontWeight: 300, color: 'rgba(255,255,255,0.28)', background: 'none', border: 'none', padding: 0 }}
          >
            Share something...
          </button>
          <button
            onClick={() => navigate("/upload")}
            className="shrink-0 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(139,69,19,0.9)', color: '#fff', border: 'none',
            }}
          >
            <Upload className="h-4 w-4" />
          </button>
        </div>
      )}

      {!isLoggedIn && <HowItWorks />}

      <ActiveCompetitionsSection />

      <div
        className="sticky top-0 z-10"
        style={{ background: "rgba(8,8,12,0.80)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
      >
        <div
          className="flex items-center gap-1 px-6"
          style={{ paddingBottom: 12, borderBottom: '1px solid rgba(255, 255, 255, 0.14)', marginBottom: 20 }}
        >
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="transition-colors"
              style={{
                fontSize: 13,
                fontWeight: 500,
                padding: '6px 16px',
                borderRadius: 100,
                border: 'none',
                background: activeTab === tab ? 'rgba(139,69,19,0.08)' : 'transparent',
                color: activeTab === tab ? '#8B4513' : 'rgba(255,255,255,0.45)',
                cursor: 'pointer',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Recent" && <RecentTab />}
      {activeTab === "For You" && <ForYouTab />}
      {activeTab === "Following" && <FollowingTab />}
      {activeTab === "Trending" && <TrendingTab />}
    </div>
  );
};

export default Home;
