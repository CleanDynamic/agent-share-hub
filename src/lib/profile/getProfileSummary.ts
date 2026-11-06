import { db } from "@/lib/social/types";
import { parseCrop, parseProfileSettings } from "./settings";
import type { ProfileSummary, ProfileLevel } from "./types";

const UUID_RX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PROFILE_COLUMNS =
  "id, username, display_name, avatar_url, banner_url, bio, website_url, location, follower_count, following_count, created_at, is_verified, level, derived_bio, last_derived_at, is_private, is_trusted_solver, avatar_crop, banner_crop, avatar_alt, banner_alt, about, links, profile_settings";

/**
 * Resolve a user id or @handle to the profile row. UX-10: with a reader, whether they follow this person comes in the same
 * request (the follows row embedded, filtered to the reader), so the profile is one round, not two.
 */
async function resolveProfile(userIdOrHandle: string, viewerId: string | null) {
  const looksLikeId = UUID_RX.test(userIdOrHandle);
  // UX-10: through the untyped client, since the generated types predate the profile's new columns (20261109120000).
  let query = db
    .from("profiles")
    .select((viewerId ? `${PROFILE_COLUMNS}, viewer_follow:follows!follows_following_id_fkey(id)` : PROFILE_COLUMNS) as string)
    .limit(1);
  if (viewerId) query = query.eq("viewer_follow.follower_id", viewerId).limit(1, { referencedTable: "viewer_follow" });

  const { data, error } = await ((looksLikeId
    ? query.eq("id", userIdOrHandle).maybeSingle()
    : query.ilike("username", userIdOrHandle.replace(/^@/, "")).maybeSingle()) as unknown as Promise<{ data: Record<string, any> | null; error: unknown }>);

  if (error) throw error;
  return data;
}

export async function getProfileSummary(
  userIdOrHandle: string,
  viewerId: string | null
): Promise<ProfileSummary> {
  const profile = await resolveProfile(userIdOrHandle, viewerId);
  if (!profile) {
    throw new Error(`Profile not found: ${userIdOrHandle}`);
  }

  const isOwnProfile = !!viewerId && viewerId === profile.id;
  const viewerFollows = Array.isArray((profile as any).viewer_follow) && (profile as any).viewer_follow.length > 0;


  return {
    id: profile.id,
    displayName: profile.display_name ?? profile.username ?? "Unnamed",
    handle: profile.username ?? "",
    avatarUrl: profile.avatar_url ?? null,
    coverUrl: (profile as any).banner_url ?? null,
    isVerified: !!(profile as any).is_verified,
    // RC-P21: the header's Trusted solver chip, on the request the page
    // already makes, rather than the legacy author-stats reads it rode on.
    isTrustedSolver: !!profile.is_trusted_solver,
    isPrivate: !!(profile as any).is_private,
    level: (((profile as any).level as ProfileLevel) ?? "reader"),
    domain: null,
    derivedBio: (profile as any).derived_bio ?? null,
    customBio: profile.bio ?? null,
    joinedAt: profile.created_at,
    location: profile.location ?? null,
    website: (profile as any).website_url ?? null,
    // UX-10 P1: the profile's own columns (20261109120000).
    bannerCrop: parseCrop((profile as any).banner_crop),
    avatarCrop: parseCrop((profile as any).avatar_crop),
    avatarAlt: (profile as any).avatar_alt ?? null,
    bannerAlt: (profile as any).banner_alt ?? null,
    about: (profile as any).about ?? null,
    links: Array.isArray((profile as any).links) ? ((profile as any).links as string[]) : [],
    settings: parseProfileSettings((profile as any).profile_settings),
    counts: {
      followers: profile.follower_count ?? 0,
      following: profile.following_count ?? 0,
    },
    isOwnProfile,
    isFollowing: isOwnProfile ? null : viewerFollows,
  };
}
