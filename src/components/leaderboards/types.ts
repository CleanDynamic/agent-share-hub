import type { Track } from "./tokens"

export type LeaderboardTab =
  | "week"
  | "alltime"
  | "reputation"
  | "category"

export interface LeaderboardRow {
  id: string
  rank: number
  name: string
  handle: string
  avatarUrl?: string
  level: number
  /** 0–1 progress toward next level, drives the LevelRing-mini. */
  levelProgress: number
  track: Track
  /** Primary metric for the active tab (XP or reputation). */
  value: number
  /** Rank change vs last week. Positive = climbed, negative = fell. */
  delta?: number
}
