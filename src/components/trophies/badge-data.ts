import type { LucideIcon } from "lucide-react"
import {
  Award,
  BookOpen,
  Boxes,
  Compass,
  Crown,
  Feather,
  Flame,
  GitFork,
  Hammer,
  Heart,
  Layers,
  Leaf,
  Medal,
  MessageSquare,
  Rocket,
  Sparkles,
  Star,
  Sunrise,
  Trophy,
  Users,
  Wand2,
  Zap,
} from "lucide-react"

export type Tier = "bronze" | "silver" | "gold" | "platinum"
export type BadgeCategory = "creation" | "community" | "mastery" | "seasonal" | "milestone"
export type BadgeVariant = "tiered" | "hidden" | "seasonal" | "category"

/** A warm "Creator Mark" — the L1 identity register. */
export interface CreatorMark {
  id: string
  name: string
  icon: LucideIcon
  /** One-line invitation shown when not yet earned. */
  hint: string
  earnedDate?: string
}

/** A full cabinet badge — the L2 trophy register. */
export interface Badge {
  id: string
  name: string
  description: string
  icon: LucideIcon
  variant: BadgeVariant
  category: BadgeCategory
  tier?: Tier
  earned: boolean
  earnedDate?: string
  /** 0–100 progress toward earning; only meaningful when not earned. */
  progress?: number
  progressLabel?: string
  /** Rarity as a percent of users who own it. Nullable — hide the line when null. */
  rarityPct: number | null
  seasonal?: string
}

/* ----------------------------- Creator Marks (L1) ----------------------------- */

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

/* ----------------------------- Cabinet Badges (L2) ----------------------------- */

export const cabinetBadges: Badge[] = [
  {
    id: "prolific-creator",
    name: "Prolific Creator",
    description: "Publish blueprints consistently and climb the creator tiers.",
    icon: Layers,
    variant: "tiered",
    category: "creation",
    tier: "gold",
    earned: true,
    earnedDate: "Jun 9, 2026",
    rarityPct: 8.4,
  },
  {
    id: "trendsetter",
    name: "Trendsetter",
    description: "Have a blueprint reach the weekly featured row.",
    icon: Flame,
    variant: "category",
    category: "creation",
    earned: true,
    earnedDate: "Jun 7, 2026",
    rarityPct: 3.1,
  },
  {
    id: "remix-royalty",
    name: "Remix Royalty",
    description: "Your blueprints have been remixed 50 times.",
    icon: Crown,
    variant: "tiered",
    category: "community",
    tier: "platinum",
    earned: true,
    earnedDate: "Jun 1, 2026",
    rarityPct: 0.9,
  },
  {
    id: "mentor",
    name: "Mentor",
    description: "Help newcomers with thoughtful, accepted feedback.",
    icon: BookOpen,
    variant: "category",
    category: "community",
    earned: true,
    earnedDate: "May 30, 2026",
    rarityPct: 12.5,
  },
  {
    id: "lightning-hands",
    name: "Lightning Hands",
    description: "Ship a blueprint in under an hour from a blank canvas.",
    icon: Zap,
    variant: "category",
    category: "mastery",
    earned: false,
    progress: 70,
    progressLabel: "42 of 60 min runs logged",
    rarityPct: 5.2,
  },
  {
    id: "master-craft",
    name: "Master Craftsperson",
    description: "Reach the highest creation tier across all categories.",
    icon: Award,
    variant: "tiered",
    category: "mastery",
    tier: "silver",
    earned: false,
    progress: 45,
    progressLabel: "Tier 2 of 4",
    rarityPct: 1.8,
  },
  {
    id: "community-pillar",
    name: "Community Pillar",
    description: "Earn 1,000 helpful marks from the community.",
    icon: Users,
    variant: "tiered",
    category: "community",
    tier: "bronze",
    earned: false,
    progress: 30,
    progressLabel: "312 of 1,000 marks",
    rarityPct: 2.4,
  },
  {
    id: "spring-bloom",
    name: "Spring Bloom",
    description: "Participated in the Spring 2026 build jam.",
    icon: Leaf,
    variant: "seasonal",
    category: "seasonal",
    earned: true,
    earnedDate: "Apr 18, 2026",
    rarityPct: 22.0,
    seasonal: "Spring 2026",
  },
  {
    id: "launch-week",
    name: "Launch Week Hero",
    description: "Shipped something during Launch Week.",
    icon: Rocket,
    variant: "seasonal",
    category: "seasonal",
    earned: false,
    progress: 0,
    progressLabel: "Returns next season",
    rarityPct: null,
    seasonal: "Winter 2025",
  },
  {
    id: "wizard",
    name: "The Wizard",
    description: "????????????????",
    icon: Wand2,
    variant: "hidden",
    category: "mastery",
    earned: false,
    rarityPct: 0.3,
  },
  {
    id: "secret-keeper",
    name: "Secret Keeper",
    description: "????????????????",
    icon: Star,
    variant: "hidden",
    category: "community",
    earned: true,
    earnedDate: "Jun 4, 2026",
    rarityPct: 0.7,
  },
  {
    id: "centurion",
    name: "Centurion",
    description: "Reach 100 published blueprints.",
    icon: Boxes,
    variant: "tiered",
    category: "milestone",
    tier: "bronze",
    earned: false,
    progress: 18,
    progressLabel: "18 of 100 blueprints",
    rarityPct: 0.5,
  },
  {
    id: "first-thousand",
    name: "First Thousand",
    description: "Reach 1,000 total reactions across your work.",
    icon: Medal,
    variant: "tiered",
    category: "milestone",
    tier: "gold",
    earned: true,
    earnedDate: "Jun 8, 2026",
    rarityPct: 4.6,
  },
  {
    id: "conversationalist",
    name: "Conversationalist",
    description: "Start 25 discussion threads that get replies.",
    icon: MessageSquare,
    variant: "category",
    category: "community",
    earned: false,
    progress: 60,
    progressLabel: "15 of 25 threads",
    rarityPct: 9.1,
  },
  {
    id: "grand-trophy",
    name: "Grand Trophy",
    description: "????????????????",
    icon: Trophy,
    variant: "hidden",
    category: "milestone",
    earned: false,
    rarityPct: null,
  },
]

/** Badges that "popped" while the user was away — used in the depth-reveal moment. */
export const pendingReveals: Badge[] = [
  cabinetBadges.find((b) => b.id === "trendsetter")!,
  cabinetBadges.find((b) => b.id === "first-thousand")!,
  cabinetBadges.find((b) => b.id === "secret-keeper")!,
  cabinetBadges.find((b) => b.id === "prolific-creator")!,
]

/** Showcase selection for the profile strip. */
export const showcaseBadges: Badge[] = [
  cabinetBadges.find((b) => b.id === "remix-royalty")!,
  cabinetBadges.find((b) => b.id === "prolific-creator")!,
  cabinetBadges.find((b) => b.id === "trendsetter")!,
  cabinetBadges.find((b) => b.id === "first-thousand")!,
  cabinetBadges.find((b) => b.id === "spring-bloom")!,
]

export const tierLabel: Record<Tier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
}

export const tierColorVar: Record<Tier, string> = {
  bronze: "var(--tier-bronze)",
  silver: "var(--tier-silver)",
  gold: "var(--tier-gold)",
  platinum: "var(--tier-platinum)",
}
