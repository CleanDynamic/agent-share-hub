export type TrackName = "Architect" | "Curator" | "Mentor" | "Explorer"

export interface QuestStep {
  id: string
  label: string
  xp: number
  status: "completed" | "active" | "future"
  /** Deep-link target description shown/used by onGo */
  href?: string
}

export interface CreatorMark {
  id: string
  name: string
  /** track colour key driving the mark accent */
  track?: TrackName
}

export type ChallengeState = "go" | "claimable" | "claimed"

export interface Challenge {
  id: string
  title: string
  description?: string
  xp: number
  state: ChallengeState
  /** lucide icon name is resolved by the component; pass the element instead */
}

export interface WeeklyChallenge {
  id: string
  title: string
  description: string
  xp: number
  progress: number
  goal: number
  state: ChallengeState
}

export interface ChallengeHistoryEntry {
  id: string
  title: string
  xp: number
  completedAt: string
  track?: TrackName
}
