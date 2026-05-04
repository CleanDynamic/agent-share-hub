// Shared types for the bounty competition data layer.

export type UrgencyState = "plenty" | "warning" | "urgent" | "closed";

export type LeaderboardSort =
  | "rank"
  | "votes"
  | "submissions"
  | "acceptances"
  | "recent";

export interface LeaderboardEntry {
  userId: string;
  rank: number;
  voteTotal: number;
  submissionCount: number;
  acceptanceCount: number;
  hasActiveDraft: boolean;
  computedAt: string;
  profile: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    isTrustedSolver: boolean;
  } | null;
}

export interface CompState {
  bountyId: string;
  submissionCount: number;
  activeSolverCount: number;
  commentCount: number;
  slotsTotal: number;
  slotsSolved: number;
  deadline: string | null;
  timeRemainingMs: number | null;
  urgencyState: UrgencyState;
  leaderboardPreview: LeaderboardEntry[];
  healthScore: number | null;
  isMeta: boolean;
}

export interface ActivityEvent {
  type:
    | "submission"
    | "acceptance"
    | "comment"
    | "vote"
    | "deadline_extended"
    | "draft_started";
  occurredAt: string;
  actorId: string | null;
  metadata: Record<string, any>;
}

export interface PromisingSubmission {
  solutionId: string;
  solverId: string;
  voteCount: number;
  submittedAt: string | null;
  slotKind: string;
  slotId: string;
}

export interface TopCommenter {
  userId: string;
  commentCount: number;
}

export interface BountyAnalytics {
  bountyId: string;
  totalSubmissions: number;
  acceptanceRate: number; // 0..1
  avgQuality: number | null; // avg votes per submission
  discussionEngagement: number; // total comments
  weekDeltaSubmissions: number; // last 7d - prior 7d
  promisingSubmissions: PromisingSubmission[];
  topCommenters: TopCommenter[];
  activityTimeline: ActivityEvent[];
}

export interface SubBountyDefinitionInput {
  title: string;
  description?: string | null;
  targetAmount: number;
  spawnThresholdPct?: number; // default 100
  acceptanceCriteria?: string | null;
}

export interface SubBountyState {
  id: string;
  title: string;
  description: string | null;
  targetAmount: number;
  spawnThresholdPct: number;
  pledgedAmount: number;
  pledgerCount: number;
  spawnedBountyId: string | null;
  position: number;
}

export interface MetaState {
  bountyId: string;
  title: string;
  description: string | null;
  status: string | null;
  fundingDeadline: string | null;
  totalPledged: number;
  totalPledgers: number;
  subBounties: SubBountyState[];
}
