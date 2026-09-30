import type { LucideIcon } from "lucide-react"
import { Compass, Feather, GitFork, Heart, Hammer, Sparkles, Sunrise, Users } from "lucide-react"

/**
 * A warm "Creator Mark" — the L1 identity register.
 *
 * RC-P26 moved these, unchanged, out of badge-data.ts, which now holds the ten
 * badges of XP-DESIGN.md and nothing else. The marks still describe the old
 * product (blueprints, remixes) and the Analytics trophies tab still draws them
 * from the creator_marks table; RC-P27 decides what becomes of them.
 */
export interface CreatorMark {
  id: string
  name: string
  icon: LucideIcon
  /** One-line invitation shown when not yet earned. */
  hint: string
  earnedDate?: string
}

export const creatorMarks: CreatorMark[] = [
  {
    id: "first-blueprint",
    name: "First Blueprint",
    icon: Feather,
    hint: "Publish your first blueprint",
    earnedDate: "Jun 2, 2026",
  },
  {
    id: "early-riser",
    name: "Early Riser",
    icon: Sunrise,
    hint: "Join during the open beta",
    earnedDate: "May 28, 2026",
  },
  {
    id: "first-remix",
    name: "First Remix",
    icon: GitFork,
    hint: "Remix a blueprint from the community",
    earnedDate: "Jun 5, 2026",
  },
  {
    id: "first-spark",
    name: "First Spark",
    icon: Sparkles,
    hint: "Get your first reaction",
    earnedDate: "Jun 6, 2026",
  },
  {
    id: "kind-words",
    name: "Kind Words",
    icon: Heart,
    hint: "Leave a helpful comment on someone's work",
  },
  {
    id: "builder",
    name: "Builder",
    icon: Hammer,
    hint: "Ship three blueprints",
  },
  {
    id: "explorer",
    name: "Explorer",
    icon: Compass,
    hint: "Browse five different categories",
  },
  {
    id: "team-player",
    name: "Team Player",
    icon: Users,
    hint: "Collaborate on a shared blueprint",
  },
]
