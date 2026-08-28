// Shared types for the bounty solver data layer.

// 'stage' and 'block' are the two kinds of slot a LEGACY content_items bounty
// has, and this data layer only ever reads legacy bounties. NS-P46 added a
// third kind, 'node', to solutions.slot_kind for bounties that live on a build;
// it is deliberately absent here until NS-P50 writes the client path for it,
// because every consumer of this union today is typed to the legacy pair.
export type SlotKind = "stage" | "block";
export type SolutionStatus = "draft" | "submitted" | "accepted" | "withdrawn";
export type VoteKind = "upvote" | "i_would_implement";

export interface SolverProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_trusted_solver?: boolean | null;
}

export interface Solution {
  id: string;
  /**
   * A public.bounties id since NS-P46 — NOT the content_items id in a legacy
   * bounty page's route. Read `legacy_bounty_item_id` for that.
   */
  bounty_id: string;
  /**
   * NS-P46 shim (removed in NS-P50). The content_items id this solution's
   * bounty was filed against, derived by the database from bounties.
   * legacy_item_id. NULL for a bounty that lives on a build.
   */
  legacy_bounty_item_id: string | null;
  slot_kind: SlotKind;
  slot_id: string;
  solver_id: string;
  solver_note: string | null;
  content_payload: any;
  vote_count: number;
  i_would_implement_count: number;
  status: SolutionStatus;
  submitted_at: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SolutionWithMeta extends Solution {
  solver: SolverProfile | null;
  hasVoted: boolean;
  hasIWouldImplement: boolean;
  commentCount: number;
}

export interface BountyCommentReactionSummary {
  reaction: string;
  count: number;
  reactedByViewer: boolean;
}

export interface ThreadedBountyComment {
  id: string;
  bounty_id: string;
  parent_comment_id: string | null;
  author: SolverProfile | null;
  body: string;
  taggedBountyAuthor: boolean;
  createdAt: string;
  updatedAt: string;
  reactions: BountyCommentReactionSummary[];
  replies: ThreadedBountyComment[];
  isUnread: boolean;
  isFromBountyAuthor: boolean;
  isFromAcceptedSolver: boolean;
}

export type DiscussionFilter =
  | "all"
  | "from_author"
  | "from_solvers"
  | "mentions"
  | "unread";

export type DiscussionSort = "newest" | "oldest" | "most_reactions";
export type SolutionsSort = "most_votes" | "newest" | "oldest" | "mine";
