// Shared types for the profile data layer.
//
// NOTE: several spec fields are adapted to the actual schema:
//  - `coverUrl`   → profiles.banner_url
//  - `customBio`  → profiles.bio
//  - `website`    → profiles.website_url
//  - `userId`     → content_items.creator_id
//  - "published"  → status = 'approved'
//  - block_references / bookmarks / bounty_solutions tables don't exist;
//    references are derived from blog_referenced_post_ids + fork_of_content_id,
//    bookmarks come from user_library + collection_items.

export type ProfileLevel = "reader" | "builder" | "creator" | "curator";

export interface ProfileSummary {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  isVerified: boolean;
  isPrivate: boolean;
  level: ProfileLevel;
  derivedBio: string | null;
  customBio: string | null;
  joinedAt: string;
  location: string | null;
  website: string | null;
  // Optional self-reported domain (used for visitor "Match" banner). Falls back
  // to derivedBio heuristics if not present.
  domain: string | null;
  counts: {
    followers: number;
    following: number;
    blueprints: number;
    blogs: number;
    bounties: number;
  };
  isOwnProfile: boolean;
  isFollowing: boolean | null;
}

export interface BlockTypeBreakdown {
  type: string;
  color: string;
  count: number;
  percentage: number;
}

export interface AuthorStats {
  totalViews: number;
  blueprintsCount: number;
  referencesReceived: number;
  bountiesSolved: number;
  bountiesPosted: number;
  avgReadingMinutes: number;
  blockTypeDistribution: BlockTypeBreakdown[];
  // Bounty solver stats (Phase 5)
  bountySolutionsAccepted: number;
  bountySolutionsSubmitted: number;
  bountySolverAcceptanceRate: number | null;
  bountyTotalRewardEarned: number;
  isTrustedSolver: boolean;
}

export interface Primitive {
  blockId: string;
  blockType: string;
  preview: string;
  referenceCount: number;
  parent: {
    contentId: string;
    title: string;
    slug: string | null;
    postType: string;
  } | null;
}

export type ZoneName = "authored" | "curated" | "activity" | "network";

export interface ZoneItem {
  id: string;
  kind: string;
  title: string;
  subtitle?: string | null;
  href?: string | null;
  meta?: Record<string, unknown>;
  occurredAt: string;
}

export interface ZoneContentResult {
  items: ZoneItem[];
  hasMore: boolean;
}
