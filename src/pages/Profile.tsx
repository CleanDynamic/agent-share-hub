import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { SeoHead } from "@/components/SeoHead";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { EditProfileSheet } from "@/components/profile/EditProfileSheet";
import { MakerFigures } from "@/components/profile/MakerFigures";
import {
  ProfileContentZones,
  profileTabOf,
  type ProfileTab,
} from "@/components/profile/ProfileContentZones";
import { MatchBanner } from "@/components/profile/MatchBanner";
import { getMakerStats } from "@/lib/profile/makerStats";
import { getProfileSummary } from "@/lib/profile/getProfileSummary";
import { buttonStyle } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { body, type } from "@/lib/theme/type";
import { createDirectThread, sendTextMessage } from "@/lib/messaging";
import { MessageComposeModal } from "@/components/messages/MessageComposeModal";
import FounderMark from "@/components/profile-game/FounderMark";
import { useProfileGameData } from "@/hooks/useProfileGameData";
import { Sparkles } from "lucide-react";
import type { CreatorMark } from "@/components/profile-game/CreatorMarkChip";

// THE PROFILE, ON BUILDS (RC-P21). A maker's standing is what they built, what
// other people got working, what other people rebuilt, and which gaps they
// solved: four figures under the header, from one request (maker_stats), and
// three tabs of the gallery's own cards under those. The zones of the product
// that was cleared — their filters, their sort menu, and the panels that read
// legacy posts (author stats, most-referenced blocks, the showcase strip,
// authored reblogs, the welcome note about blueprints) — are no longer
// mounted, and nothing they asked for is asked for.
//
// The figures row is the one place the page states a maker's standing: the
// header's two earned numbers, which said two of the four figures again in
// other words, left in RC-P28a.

const BUCKET = "profile-assets";

/**
 * The profile, before it has arrived.
 *
 * IT IS THE HEADER'S OWN SHAPE, not four grey bars. A skeleton that does not
 * match what replaces it is a layout shift with extra steps, so this carries
 * the cover at `--r-media`, the avatar as a circle, the name and the handle.
 * The kit's `Skeleton` paints them: `--recess` with a sweep across it, dropped
 * under reduced motion.
 */
function ProfileSkeleton() {
  return (
    <div
      className="w-full max-w-[600px] mx-auto px-4 py-6 space-y-4"
      data-visual-slot="profile-skeleton"
      role="status"
      aria-label="Loading profile"
    >
      <Skeleton className="h-52 w-full" style={{ borderRadius: r.media }} />
      <div className="px-2 -mt-12 flex items-end gap-4">
        <Skeleton className="h-24 w-24" style={{ borderRadius: r.full }} />
        <div className="space-y-2 pb-2 flex-1">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-16 w-full" style={{ borderRadius: r.panel }} />
      <Skeleton className="h-10 w-full" style={{ borderRadius: r.control }} />
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

  /* THE FOUR FIGURES, IN ONE REQUEST (RC-P21). maker_stats counts them in the
     database under the reader's own row-level security. */
  const makerStats = useQuery({
    queryKey: ["maker-stats", summary?.id ?? null],
    enabled: !!summary?.id,
    queryFn: () => getMakerStats(summary!.id),
    refetchOnWindowFocus: false,
  });

  // ── The tab lives in the address: ?tab=rebuilds, ?tab=solutions ────────
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = profileTabOf(searchParams.get("tab"));

  const handleTabChange = useCallback(
    (tab: ProfileTab) => {
      const params = new URLSearchParams(searchParams);
      if (tab === "builds") params.delete("tab");
      else params.set("tab", tab);
      setSearchParams(params, { replace: false });
    },
    [searchParams, setSearchParams]
  );

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

  // Profile-game (level / xp / streak / marks / founder badge)
  const { data: gameData } = useProfileGameData(summary?.id ?? null);
  const creatorMarks: CreatorMark[] = useMemo(() => {
    return (gameData?.marks ?? []).slice(0, 3).map((m) => ({
      id: m.id,
      label:
        typeof m.metadata?.label === "string"
          ? m.metadata.label
          : m.mark_key.replace(/_/g, " "),
      icon: Sparkles,
    }));
  }, [gameData]);

  if (authLoading || isLoading || !lookup) return <ProfileSkeleton />;
  if (error || !summary) {
    /* A statement of fact and a way out, not a dead end. Token-coloured like
       every other state on this route: `text-muted-foreground` is the shadcn
       palette, which this system replaces. */
    return (
      <div className="max-w-[600px] mx-auto px-4 py-12 text-center" role="status">
        <p style={{ ...type.cardTitle, color: t.text, margin: 0 }}>
          Profile not found
        </p>
        <p style={{ ...body, fontSize: 14, color: t.text2, marginTop: 8 }}>
          The handle may have changed, or the link is broken.
        </p>
        <button
          type="button"
          onClick={() => navigate("/gallery")}
          style={{
            ...buttonStyle("secondary"),
            ...body,
            fontSize: 13,
            fontWeight: 500,
            padding: "8px 16px",
            marginTop: 20,
          }}
        >
          Back to the gallery
        </button>
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
      <div className="w-full max-w-[600px] mx-auto px-4 py-6 space-y-6">
        <ProfileHeader
          profile={summary}
          isFollowing={!!summary.isFollowing}
          isTrustedSolver={!!summary.isTrustedSolver}
          level={gameData?.level ?? 1}
          progressPct={gameData?.progressPct ?? 0}
          creatorMarks={creatorMarks}
          founderAccessory={
            gameData?.founderBadge ? (
              <FounderMark
                memberNumber={gameData.founderBadge.memberNumber ?? undefined}
              />
            ) : undefined
          }
          onEditProfile={() => setEditOpen(true)}
          onShareProfile={handleShare}
          onFollow={handleFollow}
          onUnfollow={handleUnfollow}
          onMessage={handleMessage}
          onBlockUser={() => console.log("[profile] block user", summary.id)}
          onReportUser={() => console.log("[profile] report user", summary.id)}
          onAvatarEdit={() => avatarFileRef.current?.click()}
          onCoverEdit={() => coverFileRef.current?.click()}
        />

        {/* THE FOUR FIGURES: a maker's standing, directly under the header. */}
        <MakerFigures
          stats={makerStats.data}
          loading={makerStats.isLoading}
          error={makerStats.error}
          onRetry={() => void makerStats.refetch()}
        />

        {/* Visitor-only "shared interests" banner. */}
        <MatchBanner
          targetUserId={summary.id}
          viewerId={user?.id ?? null}
          isOwnProfile={summary.isOwnProfile}
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

        {/* The tabs: Builds, Rebuilds, Solutions, and on your own profile a
            link to your drafts. */}
        <div id="profile-zones">
          <ProfileContentZones
            userId={summary.id}
            isOwnProfile={summary.isOwnProfile}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
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
