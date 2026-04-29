import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { SeoHead } from "@/components/SeoHead";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { EditProfileSheet } from "@/components/profile/EditProfileSheet";
import { getProfileSummary } from "@/lib/profile/getProfileSummary";

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
    // Phase 7 will own the messaging integration; route is stubbed for now.
    navigate(`/messages?compose=${summary.id}`);
  }, [navigate, summary]);

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
      // Profile zones (6.6) will listen for this event and switch tabs.
      window.dispatchEvent(
        new CustomEvent("profile:stat-click", { detail: { stat } })
      );
    },
    []
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
      />
      <div className="w-full max-w-[880px] mx-auto px-4 py-6">
        <ProfileHeader
          profile={summary}
          isFollowing={!!summary.isFollowing}
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

        {/* Profile zones (authored / curated / activity / network) land here in 6.6. */}
        <div className="mt-8" id="profile-zones" />
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
    </>
  );
}
