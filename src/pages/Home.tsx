import { Suspense, lazy, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { SeoHead } from "@/components/SeoHead";
import {
  FeedEmptyState,
  FeedShell,
  FeedSkeleton,
  type FeedTabKey,
} from "@/components/feed/FeedShell";
import { SuggestedMakers } from "@/components/feed/SuggestedMakers";
import { countFollowing } from "@/lib/profile/followCount";

/* ────────────────────────────────────────────────────────────────────────────
   RC-P11 — Home: what happened since the reader was last here.

   TWO TABS ON ONE FEED ⟦hicks-law › Budgets: Home, exactly 2 tabs⟧. Following
   and Everyone both render BuildsTab, which reads get_build_feed one request
   per page; Following passes onlyFollowing. Home is time-ordered and says so by
   having no ranking at all: ranking belongs to the Gallery (CONTRACT §14).

   REMOVED, NOT HIDDEN ⟦hicks-law › Remedies 1 Remove⟧: For You, Trending,
   Recent and Bounties, whose queries read content_items, collections, projects
   and reblogs and merged them in the browser — about fifteen queries on a cold
   load, all of them empty after the clear — along with the realtime channel on
   content_items inserts, its new-posts pill and the active-bounties strip.
   There is no Supabase query in this file.

   THE DEFAULT IS THE LIKELY ONE ⟦hicks-law › Remedies 2 Default⟧: Following for
   a signed-in reader who follows at least one maker, Everyone otherwise. That
   costs one HEAD count, and until it (and the session) has answered, neither
   tab is fetched, so a reader never loads Everyone on the way to Following.
   ?tab= still names a tab outright.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The feed, in its own chunk.
 *
 * Home is the entry bundle, and the tab brings the gallery card, its five
 * bodies and the build data layer with it. Lazy, so none of it reaches the
 * initial bundle by being imported here, and it owns its query for the same
 * reason.
 */
const BuildsTab = lazy(() => import("@/components/feed/BuildsTab"));

const VALID_TABS: FeedTabKey[] = ["following", "everyone"];

const isTab = (value: string | null): value is FeedTabKey =>
  value !== null && (VALID_TABS as string[]).includes(value);

/** Whether a reader follows anyone changes rarely within a visit. */
const FOLLOWS_STALE_MS = 60 * 1000;

const Home = () => {
  const { isLoggedIn, profile, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const follows = useQuery({
    queryKey: ["home_following_count", user?.id],
    enabled: !!user,
    queryFn: () => countFollowing(user!.id),
    staleTime: FOLLOWS_STALE_MS,
  });

  const followsAnyone = !!user && (follows.data ?? 0) > 0;

  const urlTab = searchParams.get("tab");
  const activeTab: FeedTabKey = isTab(urlTab) ? urlTab : followsAnyone ? "following" : "everyone";

  /* Until the default is known, neither tab asks for anything. */
  const deciding = !isTab(urlTab) && (authLoading || (!!user && follows.isLoading));

  const setActiveTab = (tab: FeedTabKey) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  /* Why the tab would be empty decides what it says (STATES.md row 19). The
     suggestion row is the product's one, and it appears only here: Following,
     for a reader who follows nobody. */
  const empty =
    activeTab === "everyone" ? (
      <FeedEmptyState kind="everyone" />
    ) : followsAnyone ? (
      <FeedEmptyState kind="following-quiet" />
    ) : (
      <FeedEmptyState kind="following-none">
        <SuggestedMakers excludeId={user?.id ?? null} />
      </FeedEmptyState>
    );

  const feedCards = deciding
    ? [<FeedSkeleton key="deciding" />]
    : [
        <Suspense key={activeTab} fallback={<FeedSkeleton />}>
          <BuildsTab onlyFollowing={activeTab === "following"} empty={empty} />
        </Suspense>,
      ];

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

  return (
    <>
      <SeoHead
        title="buildgallery.ai — The AI Agent Tactics Forum"
        description="Download AI assistants, blueprints and workflows. Works with ChatGPT, Claude, Gemini and any AI tool."
        path="/"
      />
      <FeedShell
        currentUser={currentUser}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        feedCards={feedCards}
        onComposeClick={() => navigate("/compose/new")}
      />
    </>
  );
};

export default Home;
