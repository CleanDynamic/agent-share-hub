import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { SeoHead } from "@/components/SeoHead";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { EditProfileSheet } from "@/components/profile/EditProfileSheet";
import {
  AuthorStatsPanel,
  AuthorStatsPanelSkeleton,
} from "@/components/profile/AuthorStatsPanel";
import {
  MostReferencedPrimitives,
  type PrimitiveCardData,
} from "@/components/profile/MostReferencedPrimitives";
import {
  ProfileContentZones,
  type Zone,
} from "@/components/profile/ProfileContentZones";
import { ProfileAuthoredReblogs } from "@/components/profile/ProfileAuthoredReblogs";
import { MatchBanner } from "@/components/profile/MatchBanner";
import { ProfileWelcomeCoachmark } from "@/components/profile/ProfileWelcomeCoachmark";
import { MakeCollectionDialog } from "@/components/profile/MakeCollectionDialog";
import { getProfileSummary } from "@/lib/profile/getProfileSummary";
import { getAuthorStats } from "@/lib/profile/getAuthorStats";
import { getMostReferenced } from "@/lib/profile/getMostReferenced";
import { getZoneContent } from "@/lib/profile/getZoneContent";
import type { Primitive, ZoneItem } from "@/lib/profile/types";
import { createDirectThread, sendTextMessage } from "@/lib/messaging";
import { MessageComposeModal } from "@/components/messages/MessageComposeModal";

const PAGE_SIZE = 20;
const VALID_ZONES: Zone[] = ["authored", "curated", "activity", "network"];

const BUCKET = "profile-assets";

function ProfileSkeleton() {
  return (
    <div className="w-full max-w-[880px] mx-auto px-4 py-6 space-y-4">
      <Skeleton className="h-52 w-full rounded-xl" />
      <div className="px-2 -mt-12 flex items-end gap-4">
        <Skeleton className="h-24 w-24 rounded-full" />
        <div className="space-y-2 pb-2 flex-1">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export default function Profile() {
  const { handle } = useParams<{ handle?: string }>();
  const { user, isLoggedIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [makeCollectionOpen, setMakeCollectionOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeBusy, setComposeBusy] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement | null>(null);
  const coverFileRef = useRef<HTMLInputElement | null>(null);

  // Resolve "who" we're viewing. No handle → own profile (requires auth).
  const lookup = handle ?? user?.id ?? null;

  useEffect(() => {
    if (!authLoading && !handle && !isLoggedIn) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, handle, isLoggedIn, navigate]);

  const queryKey = useMemo(
    () => ["profile-summary", lookup, user?.id ?? null] as const,
    [lookup, user?.id]
  );

  const {
    data: summary,
    isLoading,
    error,
  } = useQuery({
    queryKey,
    enabled: !!lookup,
    queryFn: () => getProfileSummary(lookup!, user?.id ?? null),
  });

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey });
  }, [qc, queryKey]);

  // Author stats — fetched in parallel once we know the profile id.
  const { data: authorStats, isLoading: statsLoading } = useQuery({
    queryKey: ["author-stats", summary?.id ?? null],
    enabled: !!summary?.id,
    queryFn: () => getAuthorStats(summary!.id),
  });

  const { data: reblogCount } = useQuery({
    queryKey: ["profile-reblog-count", summary?.id ?? null],
    enabled: !!summary?.id,
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("reblogs")
        .select("id", { count: "exact", head: true })
        .eq("reblogger_id", summary!.id)
        .is("deleted_at", null)
        .is("hidden_at", null);
      return count ?? 0;
    },
  });

  // Most-referenced primitives strip.
  const { data: mostReferenced } = useQuery({
    queryKey: ["most-referenced", summary?.id ?? null],
    enabled: !!summary?.id,
    queryFn: () => getMostReferenced(summary!.id, 8),
  });

  const referencedCards = useMemo<PrimitiveCardData[]>(() => {
    return (mostReferenced ?? []).map((p: Primitive) => ({
      id: p.blockId,
      type: "block",
      blockType: p.blockType,
      name: p.parent?.title ?? "",
      contentPreview: p.preview,
      referenceCount: p.referenceCount,
      parent: {
        blueprintId: p.parent?.contentId ?? "",
        blueprintTitle: p.parent?.title ?? "Untitled",
        slug: p.parent?.slug ?? "",
      },
    }));
  }, [mostReferenced]);

  const handlePrimitiveClick = useCallback(
    (primitive: PrimitiveCardData) => {
      if (primitive.parent.slug) {
        navigate(`/p/${primitive.parent.slug}#block-${primitive.id}`);
      } else if (primitive.parent.blueprintId) {
        navigate(`/p/${primitive.parent.blueprintId}#block-${primitive.id}`);
      }
    },
    [navigate]
  );

  const handleViewAllReferenced = useCallback(() => {
    toast({ title: "Full list coming soon" });
  }, [toast]);

  // ── Zones: URL-driven state ────────────────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  const rawZone = searchParams.get("zone");
  const activeZone: Zone = (VALID_ZONES.includes(rawZone as Zone)
    ? rawZone
    : "authored") as Zone;
  const activeFilter = searchParams.get("filter") ?? "all";
  const sort = searchParams.get("sort") ?? "recent";

  const updateParams = useCallback(
    (next: { zone?: Zone; filter?: string; sort?: string }) => {
      const params = new URLSearchParams(searchParams);
      if (next.zone !== undefined) params.set("zone", next.zone);
      if (next.filter !== undefined) {
        if (next.filter === "all") params.delete("filter");
        else params.set("filter", next.filter);
      }
      if (next.sort !== undefined) {
        if (next.sort === "recent") params.delete("sort");
        else params.set("sort", next.sort);
      }
      setSearchParams(params, { replace: false });
    },
    [searchParams, setSearchParams]
  );

  const handleZoneChange = useCallback(
    (z: Zone) => updateParams({ zone: z, filter: "all" }),
    [updateParams]
  );
  const handleFilterChange = useCallback(
    (f: string) => updateParams({ filter: f }),
    [updateParams]
  );
  const handleSortChange = useCallback(
    (s: string) => updateParams({ sort: s }),
    [updateParams]
  );

  // ── Zone content (paginated) ────────────────────────────────────────────
  const zoneQuery = useInfiniteQuery({
    queryKey: ["zone-content", summary?.id ?? null, activeZone, activeFilter, sort],
    enabled: !!summary?.id,
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getZoneContent({
        userId: summary!.id,
        zone: activeZone,
        filter: activeFilter,
        sort,
        offset: pageParam as number,
        limit: PAGE_SIZE,
      }),
    getNextPageParam: (last, all) =>
      last.hasMore ? all.length * PAGE_SIZE : undefined,
  });

  const zoneItems: ZoneItem[] = useMemo(
    () => (zoneQuery.data?.pages ?? []).flatMap((p) => p.items),
    [zoneQuery.data]
  );

  // Network filter is client-side (kind matches "follower" / "following" / "collaborator").
  const visibleZoneItems = useMemo(() => {
    if (activeZone === "network" && activeFilter !== "all") {
      return zoneItems.filter((i) => i.kind === activeFilter);
    }
    if (activeZone === "activity" && activeFilter !== "all") {
      return zoneItems.filter((i) => i.kind === activeFilter);
    }
    if (activeZone === "curated" && activeFilter !== "all") {
      return zoneItems.filter((i) => i.kind === activeFilter);
    }
    return zoneItems;
  }, [zoneItems, activeZone, activeFilter]);

  const zoneCounts = useMemo(
    () => ({
      authored:
        (summary?.counts.blueprints ?? 0) +
        (summary?.counts.blogs ?? 0) +
        (summary?.counts.bounties ?? 0),
      curated: 0,
      activity: 0,
      network:
        (summary?.counts.followers ?? 0) + (summary?.counts.following ?? 0),
    }),
    [summary]
  );

  const handleZoneItemClick = useCallback(
    (item: ZoneItem) => {
      if (item.href) navigate(item.href);
    },
    [navigate]
  );

  // ── Item-level actions (owner & visitor) ───────────────────────────────
  const refetchZone = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["zone-content", summary?.id ?? null] });
  }, [qc, summary?.id]);

  const handleEditItem = useCallback(
    (item: ZoneItem) => {
      const id = item.id;
      if (!id) return;
      // Best-effort: route to the upload editor. Different post types share /upload?edit.
      navigate(`/upload?edit=${id}`);
    },
    [navigate]
  );

  const handleUnpublishItem = useCallback(
    async (item: ZoneItem) => {
      if (!item.id) return;
      const { error: err } = await supabase
        .from("content_items")
        .update({ status: "draft" } as any)
        .eq("id", item.id);
      if (err) {
        toast({ title: "Could not unpublish", description: err.message, variant: "destructive" });
        return;
      }
      toast({ title: "Moved back to drafts" });
      refetchZone();
    },
    [toast, refetchZone]
  );

  const handleDeleteItem = useCallback(
    async (item: ZoneItem) => {
      if (!item.id) return;
      if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
      const { error: err } = await supabase
        .from("content_items")
        .delete()
        .eq("id", item.id);
      if (err) {
        toast({ title: "Could not delete", description: err.message, variant: "destructive" });
        return;
      }
      toast({ title: "Deleted" });
      refetchZone();
    },
    [toast, refetchZone]
  );

  const handleBookmarkItem = useCallback(
    async (item: ZoneItem) => {
      if (!user?.id) {
        navigate("/login");
        return;
      }
      if (!item.id) return;
      const { error: err } = await supabase
        .from("user_saves")
        .insert({ user_id: user.id, content_id: item.id } as any);
      if (err && !err.message.toLowerCase().includes("duplicate")) {
        toast({ title: "Could not bookmark", description: err.message, variant: "destructive" });
        return;
      }
      toast({ title: "Saved to your library" });
    },
    [user?.id, toast, navigate]
  );

  const handleRepostItem = useCallback(
    (_item: ZoneItem) => {
      toast({ title: "Repost coming soon" });
    },
    [toast]
  );

  const handleShareItem = useCallback(
    async (item: ZoneItem) => {
      try {
        const url = item.href
          ? `${window.location.origin}${item.href}`
          : window.location.href;
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied" });
      } catch {
        toast({ title: "Could not copy link", variant: "destructive" });
      }
    },
    [toast]
  );

  const handleCreateBlueprint = useCallback(() => {
    navigate("/upload");
  }, [navigate]);

  // ── Follow / Unfollow ──────────────────────────────────────────────────
  const handleFollow = useCallback(async () => {
    if (!summary || !user?.id) {
      navigate("/login");
      return;
    }
    // Optimistic
    qc.setQueryData(queryKey, (prev: any) =>
      prev
        ? {
            ...prev,
            isFollowing: true,
            counts: { ...prev.counts, followers: prev.counts.followers + 1 },
          }
        : prev
    );
    const { error: err } = await supabase
      .from("follows")
      .insert({ follower_id: user.id, following_id: summary.id } as any);
    if (err) {
      refresh();
      toast({
        title: "Could not follow",
        description: err.message,
        variant: "destructive",
      });
    }
  }, [summary, user?.id, qc, queryKey, refresh, toast, navigate]);

  const handleUnfollow = useCallback(async () => {
    if (!summary || !user?.id) return;
    qc.setQueryData(queryKey, (prev: any) =>
      prev
        ? {
            ...prev,
            isFollowing: false,
            counts: {
              ...prev.counts,
              followers: Math.max(0, prev.counts.followers - 1),
            },
          }
        : prev
    );
    const { error: err } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", summary.id);
    if (err) {
      refresh();
      toast({
        title: "Could not unfollow",
        description: err.message,
        variant: "destructive",
      });
    }
  }, [summary, user?.id, qc, queryKey, refresh, toast]);

  // ── Share / Message ────────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Profile link copied" });
    } catch {
      toast({ title: "Could not copy link", variant: "destructive" });
    }
  }, [toast]);

  const handleMessage = useCallback(() => {
    if (!summary) return;
    if (!isLoggedIn) { navigate("/login"); return; }
    if (summary.isOwnProfile) return;
    setComposeOpen(true);
  }, [summary, isLoggedIn, navigate]);

  const handleComposeSubmit = useCallback(async (firstMessage: string) => {
    if (!summary) return;
    setComposeBusy(true);
    try {
      const threadId = await createDirectThread(summary.id);
      if (firstMessage.trim()) {
        await sendTextMessage(threadId, firstMessage.trim());
      }
      setComposeOpen(false);
      navigate(`/messages/${threadId}`);
    } catch (err: any) {
      toast({
        title: "Could not start conversation",
        description: err?.message ?? String(err),
        variant: "destructive",
      });
    } finally {
      setComposeBusy(false);
    }
  }, [summary, navigate, toast]);

  // ── Avatar / Cover upload ──────────────────────────────────────────────
  const uploadAsset = useCallback(
    async (file: File, kind: "avatar" | "cover") => {
      if (!user?.id) return;
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) {
        toast({
          title: "Upload failed",
          description: upErr.message,
          variant: "destructive",
        });
        return;
      }
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = data.publicUrl;
      const column = kind === "avatar" ? "avatar_url" : "banner_url";
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ [column]: publicUrl } as any)
        .eq("id", user.id);
      if (updErr) {
        toast({
          title: "Could not save image",
          description: updErr.message,
          variant: "destructive",
        });
        return;
      }
      toast({ title: kind === "avatar" ? "Avatar updated" : "Cover updated" });
      refresh();
    },
    [user?.id, toast, refresh]
  );

  // ── Stat click → tab switching (zones not yet built; soft-scroll hook) ─
  const handleStatClick = useCallback(
    (stat: "followers" | "following" | "blueprints" | "blogs" | "bounties") => {
      // Map header stat → (zone, filter) and update URL.
      if (stat === "followers") updateParams({ zone: "network", filter: "follower" });
      else if (stat === "following")
        updateParams({ zone: "network", filter: "following" });
      else if (stat === "blueprints")
        updateParams({ zone: "authored", filter: "blueprint" });
      else if (stat === "blogs")
        updateParams({ zone: "authored", filter: "blog" });
      else if (stat === "bounties")
        updateParams({ zone: "authored", filter: "bounty" });

      // Scroll the zones into view.
      requestAnimationFrame(() => {
        document
          .getElementById("profile-zones")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [updateParams]
  );

  // ── Render ─────────────────────────────────────────────────────────────
  if (authLoading || isLoading || !lookup) return <ProfileSkeleton />;
  if (error || !summary) {
    return (
      <div className="max-w-[880px] mx-auto px-4 py-12 text-center text-muted-foreground">
        <p>Profile not found.</p>
      </div>
    );
  }

  return (
    <>
      <SeoHead
        title={`${summary.displayName} (@${summary.handle})`}
        description={
          summary.customBio ?? summary.derivedBio ?? `Profile of ${summary.displayName}`
        }
        path={handle ? `/profile/${handle}` : "/profile"}
      />
      <div className="w-full max-w-[880px] mx-auto px-4 py-6">
        <ProfileHeader
          profile={summary}
          isFollowing={!!summary.isFollowing}
          isTrustedSolver={!!authorStats?.isTrustedSolver}
          onEditProfile={() => setEditOpen(true)}
          onShareProfile={handleShare}
          onFollow={handleFollow}
          onUnfollow={handleUnfollow}
          onMessage={handleMessage}
          onBlockUser={() => console.log("[profile] block user", summary.id)}
          onReportUser={() => console.log("[profile] report user", summary.id)}
          onStatClick={handleStatClick}
          onAvatarEdit={() => avatarFileRef.current?.click()}
          onCoverEdit={() => coverFileRef.current?.click()}
        />

        {/* Visitor-only "shared interests" banner. */}
        <MatchBanner
          targetUserId={summary.id}
          viewerId={user?.id ?? null}
          isOwnProfile={summary.isOwnProfile}
        />

        {/* Own-profile welcome coachmark (zero-content state). */}
        <ProfileWelcomeCoachmark
          visible={
            summary.isOwnProfile &&
            (summary.counts.blueprints + summary.counts.blogs + summary.counts.bounties) === 0
          }
        />

        {/* Hidden file inputs for avatar / cover uploads */}
        <input
          ref={avatarFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) uploadAsset(f, "avatar");
            e.target.value = "";
          }}
        />
        <input
          ref={coverFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) uploadAsset(f, "cover");
            e.target.value = "";
          }}
        />

        {statsLoading || !authorStats ? (
          <AuthorStatsPanelSkeleton />
        ) : (
          <AuthorStatsPanel stats={{ ...authorStats, reblogCount: reblogCount ?? 0 } as any} />
        )}

        <MostReferencedPrimitives
          primitives={referencedCards}
          onPrimitiveClick={handlePrimitiveClick}
          onViewAllClick={handleViewAllReferenced}
        />

        {/* Profile zones (authored / curated / activity / network). */}
        <div id="profile-zones">
          {activeZone === "authored" && activeFilter === "reblog" ? (
            <ProfileAuthoredReblogs
              userId={summary.id}
              activeFilter={activeFilter}
              onFilterChange={handleFilterChange}
            />
          ) : (
            <ProfileContentZones
              activeZone={activeZone}
              onZoneChange={handleZoneChange}
              activeFilter={activeFilter}
              onFilterChange={handleFilterChange}
              sort={sort}
              onSortChange={handleSortChange}
              counts={zoneCounts}
              items={visibleZoneItems}
              isLoading={zoneQuery.isLoading}
              isLoadingMore={zoneQuery.isFetchingNextPage}
              hasMore={!!zoneQuery.hasNextPage}
              onLoadMore={() => zoneQuery.fetchNextPage()}
              onItemClick={handleZoneItemClick}
              isOwnProfile={summary.isOwnProfile}
              onMakeCollection={() => setMakeCollectionOpen(true)}
              onCreateBlueprint={handleCreateBlueprint}
              onEditItem={summary.isOwnProfile ? handleEditItem : undefined}
              onUnpublishItem={summary.isOwnProfile ? handleUnpublishItem : undefined}
              onDeleteItem={summary.isOwnProfile ? handleDeleteItem : undefined}
              onBookmarkItem={!summary.isOwnProfile ? handleBookmarkItem : undefined}
              onRepostItem={!summary.isOwnProfile ? handleRepostItem : undefined}
              onShareItem={handleShareItem}
            />
          )}
        </div>
      </div>

      {summary.isOwnProfile && user?.id && (
        <EditProfileSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          userId={user.id}
          initial={{
            displayName: summary.displayName,
            customBio: summary.customBio,
            coverUrl: summary.coverUrl,
            location: summary.location,
            website: summary.website,
          }}
          onSaved={refresh}
        />
      )}

      {summary.isOwnProfile && user?.id && (
        <MakeCollectionDialog
          open={makeCollectionOpen}
          onOpenChange={setMakeCollectionOpen}
          ownerId={user.id}
          onCreated={() => refetchZone()}
        />
      )}

      {summary && !summary.isOwnProfile && (
        <MessageComposeModal
          open={composeOpen}
          onOpenChange={setComposeOpen}
          recipientLabel={summary.displayName ?? `@${summary.handle}`}
          onSubmit={handleComposeSubmit}
          submitting={composeBusy}
        />
      )}
    </>
  );
}
