import { supabase } from "@/integrations/supabase/client";
import type { ProfileSummary, ProfileLevel } from "./types";

const UUID_RX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a user id or @handle to the profile row.
 */
async function resolveProfile(userIdOrHandle: string) {
  const looksLikeId = UUID_RX.test(userIdOrHandle);
  const query = supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, banner_url, bio, website_url, location, follower_count, following_count, created_at, is_verified, level, derived_bio, last_derived_at"
    )
    .limit(1);

  const { data, error } = await (looksLikeId
    ? query.eq("id", userIdOrHandle).maybeSingle()
    : query.ilike("username", userIdOrHandle.replace(/^@/, "")).maybeSingle());

  if (error) throw error;
  return data;
}

export async function getProfileSummary(
  userIdOrHandle: string,
  viewerId: string | null
): Promise<ProfileSummary> {
  const profile = await resolveProfile(userIdOrHandle);
  if (!profile) {
    throw new Error(`Profile not found: ${userIdOrHandle}`);
  }

  const isOwnProfile = !!viewerId && viewerId === profile.id;

  // Stats matview + follow check in parallel.
  const [statsRes, followRes] = await Promise.all([
    (supabase as any)
      .from("profile_stats")
      .select(
        "blueprints_count, blogs_count, bounties_posted"
      )
      .eq("user_id", profile.id)
      .maybeSingle(),
    !isOwnProfile && viewerId
      ? supabase
          .from("follows")
          .select("id")
          .eq("follower_id", viewerId)
          .eq("following_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as const),
  ]);

  const stats = (statsRes as any)?.data ?? {};

  return {
    id: profile.id,
    displayName: profile.display_name ?? profile.username ?? "Unnamed",
    handle: profile.username ?? "",
    avatarUrl: profile.avatar_url ?? null,
    coverUrl: (profile as any).banner_url ?? null,
    isVerified: !!(profile as any).is_verified,
    level: (((profile as any).level as ProfileLevel) ?? "reader"),
    derivedBio: (profile as any).derived_bio ?? null,
    customBio: profile.bio ?? null,
    joinedAt: profile.created_at,
    location: profile.location ?? null,
    website: (profile as any).website_url ?? null,
    counts: {
      followers: profile.follower_count ?? 0,
      following: profile.following_count ?? 0,
      blueprints: Number(stats.blueprints_count ?? 0),
      blogs: Number(stats.blogs_count ?? 0),
      bounties: Number(stats.bounties_posted ?? 0),
    },
    isOwnProfile,
    isFollowing: isOwnProfile ? null : !!(followRes as any)?.data,
  };
}
