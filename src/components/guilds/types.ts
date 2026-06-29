import type { LucideIcon } from "lucide-react"
import type { TrackName } from "./tokens"

export type GuildRole = "Founder" | "Member"

export interface GuildEmblem {
  /** Lucide icon used as the emblem mark */
  icon: LucideIcon
  /** Accent colour for the emblem (hex) */
  color: string
}

export interface Guild {
  id: string
  name: string
  emblem: GuildEmblem
  /** One-line purpose / mission */
  purpose: string
  memberCount: number
  capacity: number
}

export interface GuildMember {
  id: string
  name: string
  avatarUrl?: string
  level: number
  track: TrackName
  role: GuildRole
  /** XP contributed this week */
  weeklyXp: number
}

export type MembershipState = "none" | "requested" | "member"

export interface GuildGoal {
  id: string
  title: string
  /** Total collective XP accumulated toward the goal */
  current: number
  /** Target collective XP */
  target: number
  /** Number of contributing members (for per-member average) */
  contributors: number
  /** Reward badge granted on completion */
  reward: {
    name: string
    description: string
  }
  /** Optional cadence label e.g. "this week" */
  cadence?: string
}

export interface GuildBadge {
  id: string
  name: string
  description: string
  /** Whether the badge has been earned */
  earned: boolean
  /** Tier accent colour (hex) */
  tint: string
}
