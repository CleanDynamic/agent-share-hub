import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUploadPicker } from "@/contexts/UploadPickerContext";
import { SeoHead } from "@/components/SeoHead";
import { FeedItem, timeAgo } from "@/components/FeedItem";
import { FeedCard, type FeedPost } from "@/components/feed-card";
import { CollectionFeedCard } from "@/components/CollectionFeedCard";
import { ProjectFeedCard } from "@/components/ProjectFeedCard";
import { ReblogCard } from "@/components/ReblogCard";
import { FeedReblogAdapter, type FeedReblogRow } from "@/components/reblog/FeedReblogAdapter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  FeedShell,
  FeedSkeleton,
  type FeedTabKey,
  type BountyPreview,
} from "@/components/feed/FeedShell";
import { resolvePostType } from "@/lib/content-types";

/**
 * The Builds tab (NS-P41), in its own chunk.
 *
 * Home is the entry bundle, and this tab brings the gallery card, its five
 * bodies and the build data layer with it — none of which the other five tabs
 * touch. Lazy, so a reader who never opens it never downloads it, and so that
 * none of it can reach the initial bundle by being imported here.
 *
 * It owns its own query for the same reason: a hook in this file would pull
 * those modules in whether or not the tab is ever shown.
 */
const BuildsTab = lazy(() => import("@/components/feed/BuildsTab"));

const VALID_TABS: FeedTabKey[] = ["builds", "foryou", "following", "trending", "recent", "bounties"];

function adaptToFeedPost(item: any): FeedPost {
  const p = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
  return {
    id: item.id,
    title: item.title,
    description: item.description ?? undefined,
    content_type: item.content_type ?? "build",
    post_type: resolvePostType(item.post_type ?? null, item.content_type ?? null),
    cover_image_url: item.cover_image_url ?? undefined,
    created_at: item.created_at,
    view_count: item.view_count ?? 0,
    comment_count: item.comment_count ?? 0,
    download_count: item.download_count ?? 0,
    what_to_expect: item.what_to_expect ?? undefined,
    what_to_expect_blocks: item.what_to_expect_blocks ?? undefined,
    ai_tools: (item.ai_tools ?? []) as string[],
    use_cases: (item.use_cases ?? []) as string[],
    custom_tags: item.custom_tags ?? [],
    author: {
      id: (p as any)?.id ?? item.user_id ?? undefined,
      display_name: p?.display_name ?? "Unknown",
      username: p?.username ?? "user",
      avatar_url: p?.avatar_url ?? undefined,
      bio: p?.bio ?? undefined,
      follower_count: p?.follower_count ?? 0,
      following_count: p?.following_count ?? 0,
      joined_date: p?.joined_at ?? undefined,
    },
  };
}

function renderFeedEntry(entry: any) {
  if (entry._feedType === "collection") return <CollectionFeedCard key={`col-${entry.id}`} item={entry} />;
  if (entry._feedType === "project") return <ProjectFeedCard key={`proj-${entry.id}`} item={entry} />;
  if (entry._feedType === "reblog") return <FeedReblogAdapter key={`rb-${entry.id}`} row={entry as FeedReblogRow} />;
  if (entry.is_reblog) return <ReblogCard key={entry.id} item={entry} />;
  return <FeedCard key={entry.id} post={adaptToFeedPost(entry)} />;
}

/* ---- Recent tab data ---- */
function useRecentTab(enabled: boolean) {
  const bp = useQuery({
    queryKey: ["home_recent_blueprints"],
    enabled,
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
  const col = useQuery({
    queryKey: ["home_recent_collections"],
    enabled,
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
  const proj = useQuery({
    queryKey: ["home_recent_projects"],
    enabled,
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
  const rb = useQuery({
    queryKey: ["home_recent_reblogs"],
    enabled,
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
        .is("hidden_at", null)
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

  const isLoading = bp.isLoading || col.isLoading || proj.isLoading || rb.isLoading;
  const merged = [...(bp.data ?? []), ...(col.data ?? []), ...(proj.data ?? []), ...(rb.data ?? [])]
    .sort((a, b) => b._sortDate - a._sortDate);
  return { cards: merged.map(renderFeedEntry), isLoading, isEmpty: !isLoading && merged.length === 0 };
}

/* ---- For You tab data ---- */
function useForYouTab(enabled: boolean) {
  const { user } = useAuth();
  const followIdsQ = useQuery({
    queryKey: ["fyp_follow_ids_home", user?.id],
    enabled: enabled && !!user,
    queryFn: async () => {
      const { data } = await supabase.from("follows").select("following_id").eq("follower_id", user!.id);
      return (data ?? []).map(r => r.following_id);
    },
  });
  const followIds = followIdsQ.data;

  const interactionsQ = useInfiniteQuery({
    queryKey: ["fyp_interactions_home", followIds],
    enabled: enabled && !!followIds && followIds.length > 0,
    initialPageParam: 0,
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
  });

  const rawItems = interactionsQ.data?.pages.flat() ?? [];
  const seen = new Map<string, any>();
  for (const item of rawItems) {
    const key = `${item.user_id}-${item.content_id}`;
    if (!seen.has(key)) seen.set(key, item);
  }
  const deduped = Array.from(seen.values());
  const contentIds = [...new Set(deduped.map(i => i.content_id))];

  const contentQ = useQuery({
    queryKey: ["fyp_content_home", contentIds.join(",")],
    enabled: enabled && contentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("content_items")
        .select("id, title, description, content_type, difficulty, ai_tools, use_cases, custom_use_case_description, avg_rating, rating_count, download_count, view_count, comment_count, cover_image_url, created_at, what_to_expect_blocks, what_to_expect, other_tool_name, custom_tags, profiles!content_items_creator_id_fkey(display_name, username)")
        .in("id", contentIds);
      return data ?? [];
    },
  });

  const contentMap = new Map((contentQ.data ?? []).map(c => [c.id, c]));
  const isLoading = followIdsQ.isLoading || interactionsQ.isLoading || contentQ.isLoading;

  const cards = deduped.map((interaction: any) => {
    const content = contentMap.get(interaction.content_id);
    if (!content) return null;
    const actor = interaction.profiles as any;
    const initials = (actor?.display_name || actor?.username || "??").slice(0, 2).toUpperCase();
    const label = interaction.interaction_type === "downloaded" ? "downloaded"
      : interaction.interaction_type === "rated" ? `rated ★${(interaction.interaction_meta as any)?.rating ?? "?"}`
      : interaction.interaction_type === "commented" ? "commented on"
      : "saved";
    return (
      <div key={interaction.id}>
        <div className="px-6 pt-3 pb-1 flex items-center gap-2 text-xs text-muted-foreground">
          <Link to={`/creator/${actor?.username}`}>
            <Avatar className="h-5 w-5">
              <AvatarFallback className="bg-accent text-[8px]">{initials}</AvatarFallback>
            </Avatar>
          </Link>
          <Link to={`/creator/${actor?.username}`} className="font-medium text-foreground hover:underline">
            {actor?.display_name || actor?.username}
          </Link>
          <span>{label}</span>
          <span className="ml-auto">{timeAgo(interaction.created_at)}</span>
        </div>
        <FeedCard post={adaptToFeedPost(content)} />
      </div>
    );
  }).filter(Boolean) as React.ReactNode[];

  return { cards, isLoading, isEmpty: !isLoading && cards.length === 0 };
}

/* ---- Following tab data ---- */
function useFollowingTab(enabled: boolean) {
  const { user } = useAuth();
  const followIdsQ = useQuery({
    queryKey: ["home_follow_ids", user?.id],
    enabled: enabled && !!user,
    queryFn: async () => {
      const { data } = await supabase.from("follows").select("following_id").eq("follower_id", user!.id);
      return (data ?? []).map(r => r.following_id);
    },
  });
  const followIds = followIdsQ.data;
  const on = enabled && !!followIds && followIds.length > 0;

  const bp = useQuery({
    queryKey: ["home_following_bp", followIds],
    enabled: on,
    queryFn: async () => {
      const { data } = await supabase
        .from("content_items")
        .select("id, title, description, content_type, creator_id, difficulty, ai_tools, use_cases, custom_use_case_description, avg_rating, rating_count, download_count, view_count, comment_count, cover_image_url, created_at, what_to_expect_blocks, what_to_expect, other_tool_name, tool_subtype, model_parameters, custom_tags, profiles!content_items_creator_id_fkey(display_name, username)")
        .in("creator_id", followIds!)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(40);
      return (data ?? []).map((d: any) => ({ ...d, _feedType: "blueprint" as const, _sortDate: new Date(d.created_at).getTime() }));
    },
  });
  const col = useQuery({
    queryKey: ["home_following_col", followIds],
    enabled: on,
    queryFn: async () => {
      const { data } = await supabase
        .from("collections")
        .select("id, title, description, slug, item_count, follower_count, created_at, profiles:owner_id(display_name, username)")
        .in("owner_id", followIds!)
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []).map((d: any) => ({ ...d, _feedType: "collection" as const, _sortDate: new Date(d.created_at).getTime() }));
    },
  });
  const proj = useQuery({
    queryKey: ["home_following_proj", followIds],
    enabled: on,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, title, description, cover_image_url, view_count, created_at, approved_at, package_price_enabled, package_price_gbp, profiles:creator_id(display_name, username), project_components(id)")
        .in("creator_id", followIds!)
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
  });

  const isLoading = followIdsQ.isLoading || bp.isLoading || col.isLoading || proj.isLoading;
  const merged = [...(bp.data ?? []), ...(col.data ?? []), ...(proj.data ?? [])]
    .sort((a, b) => b._sortDate - a._sortDate);
  return { cards: merged.map(renderFeedEntry), isLoading, isEmpty: !isLoading && merged.length === 0 };
}

/* ---- Trending tab data ---- */
function useTrendingTab(enabled: boolean) {
  const { data, isLoading } = useQuery({
    queryKey: ["home_trending"],
    enabled,
    staleTime: 60_000,
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
        pool = [...pool, ...((month ?? []).filter(m => !ids.includes(m.id)))];
      }
      return pool
        .map((item: any) => {
          const hoursOld = (Date.now() - new Date(item.approved_at || item.created_at).getTime()) / 3600000;
          const score = (item.download_count * 1.5 + item.view_count + item.rating_count * 2 + item.comment_count * 1.2)
            / Math.pow(hoursOld + 2, 1.5);
          return { ...item, _score: score };
        })
        .sort((a, b) => b._score - a._score)
        .slice(0, 20);
    },
  });

  const cards = (data ?? []).map((item: any) => <FeedCard key={item.id} post={adaptToFeedPost(item)} />);
  return { cards, isLoading, isEmpty: !isLoading && cards.length === 0 };
}

/* ---- Bounties tab data + active bounties strip ---- */
function useBountiesData(enabled: boolean) {
  return useQuery({
    queryKey: ["home_active_bounties"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, slug, title, description, content_type, difficulty, ai_tools, use_cases, custom_use_case_description, avg_rating, rating_count, download_count, view_count, comment_count, cover_image_url, created_at, what_to_expect_blocks, what_to_expect, other_tool_name, custom_tags, bounty_status, bounty_reward_amount, bounty_reward_currency, bounty_deadline, profiles!content_items_creator_id_fkey(display_name, username)")
        .eq("status", "approved")
        .eq("bounty_status", "open")
        .order("bounty_deadline", { ascending: true })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "soon";
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "ending";
  const d = Math.floor(ms / 86400000);
  if (d >= 1) return `${d}d`;
  const h = Math.floor(ms / 3600000);
  if (h >= 1) return `${h}h`;
  return `${Math.max(1, Math.floor(ms / 60000))}m`;
}

/* ---- Main Home ---- */
const Home = () => {
  const { isLoggedIn, profile, user } = useAuth();
  const navigate = useNavigate();
  const { openUploadTypePicker } = useUploadPicker();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlTab = searchParams.get("tab") as FeedTabKey | null;
  const activeTab: FeedTabKey = urlTab && VALID_TABS.includes(urlTab) ? urlTab : "foryou";

  const setActiveTab = (t: FeedTabKey) => {
    const sp = new URLSearchParams(searchParams);
    sp.set("tab", t);
    setSearchParams(sp, { replace: true });
  };

  const recent = useRecentTab(activeTab === "recent");
  const foryou = useForYouTab(activeTab === "foryou");
  const following = useFollowingTab(activeTab === "following");
  const trending = useTrendingTab(activeTab === "trending");
  const bountiesQ = useBountiesData(true); // also used by the strip

  const tabData =
    // NS-P41, first because it is the first tab. It renders as a single entry
    // in the existing content area and reports neither loading nor empty:
    // BuildsTab does both itself, with the same skeleton and the same empty
    // state this shell would have drawn, because it is the thing that knows
    // when its own lazily loaded page has arrived.
    activeTab === "builds" ? {
        cards: [
          <Suspense key="builds-tab" fallback={<FeedSkeleton />}>
            <BuildsTab />
          </Suspense>,
        ],
        isLoading: false,
        isEmpty: false,
      }
    : activeTab === "recent" ? recent
    : activeTab === "following" ? following
    : activeTab === "trending" ? trending
    : activeTab === "bounties" ? {
        cards: (bountiesQ.data ?? []).map((item: any) => <FeedCard key={item.id} post={adaptToFeedPost(item)} />),
        isLoading: bountiesQ.isLoading,
        isEmpty: !bountiesQ.isLoading && (bountiesQ.data ?? []).length === 0,
      }
    : foryou;

  const activeBounties: BountyPreview[] = (bountiesQ.data ?? []).slice(0, 8).map((b: any) => {
    const amt = b.bounty_reward_amount ? Number(b.bounty_reward_amount) : null;
    const cur = b.bounty_reward_currency ?? "GBP";
    const reward = amt
      ? new Intl.NumberFormat("en-GB", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(amt)
      : "Reward";
    return {
      id: b.id,
      slug: b.slug,
      title: b.title,
      reward,
      endsIn: formatDeadline(b.bounty_deadline),
    };
  });

  /* ---- Realtime new-posts pill ---- */
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const [newPostCount, setNewPostCount] = useState(0);
  const [liveActive, setLiveActive] = useState(navigator.onLine);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    const onOnline = () => setLiveActive(true);
    const onOffline = () => setLiveActive(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const channelName = `home_feed_${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "content_items", filter: "status=eq.approved" },
        () => {
          if (window.scrollY < 200) {
            // at top: refetch silently
            queryClient.invalidateQueries({ queryKey: ["home_recent_blueprints"] });
            queryClient.invalidateQueries({ queryKey: ["home_trending"] });
          } else {
            setHasNewPosts(true);
            setNewPostCount((n) => n + 1);
          }
        }
      )
      .subscribe((status) => {
        setLiveActive(navigator.onLine && status === "SUBSCRIBED");
      });
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const onLoadNewPosts = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setHasNewPosts(false);
    setNewPostCount(0);
    queryClient.invalidateQueries({ queryKey: ["home_recent_blueprints"] });
    queryClient.invalidateQueries({ queryKey: ["home_recent_collections"] });
    queryClient.invalidateQueries({ queryKey: ["home_recent_projects"] });
    queryClient.invalidateQueries({ queryKey: ["home_recent_reblogs"] });
    queryClient.invalidateQueries({ queryKey: ["home_trending"] });
    queryClient.invalidateQueries({ queryKey: ["fyp_interactions_home"] });
  };

  const currentUser = useMemo(() => {
    if (!isLoggedIn) return null;
    const displayName = profile?.display_name || profile?.username || "Friend";
    const initials = (profile?.display_name || profile?.username || "NS").slice(0, 2).toUpperCase();
    return {
      displayName,
      handle: profile?.username || "",
      avatarUrl: profile?.avatar_url || undefined,
      initials,
    };
  }, [isLoggedIn, profile]);

  const onEmptyCTAClick = () => {
    if (activeTab === "foryou" || activeTab === "following") navigate("/discover");
    else if (activeTab === "bounties") openUploadTypePicker("bounty");
  };

  // Sign-in nudge when guest hits a logged-in-only tab
  if (!isLoggedIn && (activeTab === "foryou" || activeTab === "following")) {
    // still render shell; show empty-like sign-in CTA via the empty state
  }

  return (
    <>
      <SeoHead
        title="NeoScale AI — The AI Agent Tactics Forum"
        description="Download AI assistants, blueprints and workflows. Works with ChatGPT, Claude, Gemini and any AI tool."
        path="/"
      />
      <FeedShell
        currentUser={currentUser}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeBounties={activeBounties}
        onBountySeeAll={() => navigate("/discover?type=bounty")}
        onBountyClick={(b) => navigate(b.slug ? `/post/${b.slug}` : `/content/${b.id}`)}
        feedCards={tabData.cards}
        isLoading={tabData.isLoading}
        hasNewPosts={hasNewPosts}
        newPostCount={newPostCount}
        onLoadNewPosts={onLoadNewPosts}
        onComposeClick={() => openUploadTypePicker()}
        isEmpty={tabData.isEmpty}
        onEmptyCTAClick={onEmptyCTAClick}
        liveActive={liveActive}
      />
    </>
  );
};

export default Home;
