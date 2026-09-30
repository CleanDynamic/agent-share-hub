import type { LucideIcon } from "lucide-react"
import {
  BadgeCheck,
  Flag,
  GitFork,
  Hammer,
  Network,
  Play,
  Puzzle,
  RefreshCw,
  ShieldCheck,
  Wrench,
} from "lucide-react"

/**
 * XP-DESIGN.md › Tiers. Three steps, by weight and fill, never by hue:
 * common = outline, rare = --recess fill, highest = --lit fill.
 */
export type Tier = "common" | "rare" | "highest"

export interface Badge {
  /** The slug: badges.slug in the database, user_badges.badge_key on a person's row. */
  id: string
  name: string
  /** What earns it, in the words of XP-DESIGN.md. */
  description: string
  icon: LucideIcon
  tier: Tier
  earned: boolean
  earnedDate?: string
}

/**
 * The complete catalogue, in the order of XP-DESIGN.md › Badges: ten badges,
 * three tiers. Slugs, names, descriptions and tiers are the ones in the
 * document and in 20261001260000_rc_badge_catalogue.sql; badgeCatalogue.test.ts
 * holds the three together. Nothing here is earned: these are definitions, and
 * earning is a person's row in user_badges.
 */
export const BADGES: Badge[] = [
  { id: "first-build", name: "First build", description: "publish a build", icon: Hammer, tier: "common", earned: false },
  { id: "runner", name: "Runner", description: "run 10 other people's builds and report back", icon: Play, tier: "common", earned: false },
  { id: "solver", name: "Solver", description: "one accepted solution", icon: Puzzle, tier: "common", earned: false },
  { id: "proven", name: "Proven", description: "a build of yours is run successfully by 3 other people", icon: BadgeCheck, tier: "rare", earned: false },
  { id: "rebuilt", name: "Rebuilt", description: "someone publishes a rebuild of your work", icon: GitFork, tier: "rare", earned: false },
  { id: "keeper", name: "Keeper", description: "re-confirm a stale build of yours", icon: RefreshCw, tier: "rare", earned: false },
  { id: "founder", name: "Founder", description: "held an account before the reset", icon: Flag, tier: "rare", earned: false },
  { id: "well-proven", name: "Well proven", description: "a build of yours is run successfully by 10 other people", icon: ShieldCheck, tier: "highest", earned: false },
  { id: "family", name: "Family", description: "a build of yours has 5 published rebuilds", icon: Network, tier: "highest", earned: false },
  { id: "fixer", name: "Fixer", description: "five accepted solutions", icon: Wrench, tier: "highest", earned: false },
]

/** The catalogue entry for a slug, or undefined for a key that is not one of the ten. */
export function badgeBySlug(slug: string): Badge | undefined {
  return BADGES.find((badge) => badge.id === slug)
}

export const tierLabel: Record<Tier, string> = {
  common: "Common",
  rare: "Rare",
  highest: "Highest",
}
