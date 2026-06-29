import {
  Compass,
  Hammer,
  BookOpen,
  Sparkles,
  Telescope,
  Swords,
} from "lucide-react"
import { tokens } from "./tokens"
import type {
  Guild,
  GuildMember,
  GuildGoal,
  GuildBadge,
  MembershipState,
} from "./types"

import GuildCard from "./GuildCard"
import GuildHeader from "./GuildHeader"
import MemberRow from "./MemberRow"
import GuildGoalCard from "./GuildGoalCard"
import GuildBadgeTile from "./GuildBadgeTile"
import GuildDirectory from "./GuildDirectory"

/* ----------------------------- Sample data ----------------------------- */

const primaryGuild: Guild = {
  id: "g-nightowls",
  name: "The Night Owls",
  emblem: { icon: Compass, color: tokens.brand },
  purpose: "Ship one meaningful improvement to the docs every single day.",
  memberCount: 23,
  capacity: 50,
}

const members: GuildMember[] = [
  { id: "m1", name: "Ava Reyes", level: 27, track: "Architect", role: "Founder", weeklyXp: 2140 },
  { id: "m2", name: "Liang Chen", level: 22, track: "Curator", role: "Member", weeklyXp: 1880 },
  { id: "m3", name: "Mara Osei", level: 19, track: "Mentor", role: "Member", weeklyXp: 1620 },
  { id: "m4", name: "Tomás Vidal", level: 24, track: "Explorer", role: "Member", weeklyXp: 1490 },
  { id: "m5", name: "Priya Nair", level: 16, track: "Curator", role: "Member", weeklyXp: 1205 },
  { id: "m6", name: "Sam Whitfield", level: 14, track: "Architect", role: "Member", weeklyXp: 980 },
  { id: "m7", name: "Noor Haddad", level: 21, track: "Mentor", role: "Member", weeklyXp: 870 },
  { id: "m8", name: "Yuki Tanaka", level: 18, track: "Explorer", role: "Member", weeklyXp: 640 },
]

const weeklyGoal = { current: 12400, target: 20000, cadence: "this week" }

const sharedGoal: GuildGoal = {
  id: "goal-1",
  title: "Reach 20,000 collective XP",
  current: 12400,
  target: 20000,
  contributors: 23,
  cadence: "this week",
  reward: {
    name: "Nightwatch Emblem",
    description: "An exclusive guild badge for every active member.",
  },
}

const guildBadge: GuildBadge = {
  id: "b1",
  name: "Nightwatch Emblem",
  description: "Hit the weekly guild XP goal together.",
  earned: true,
  tint: tokens.brand,
}

const lockedBadge: GuildBadge = {
  id: "b2",
  name: "Centurion Circle",
  description: "Accumulate 100k lifetime guild XP.",
  earned: false,
  tint: tokens.purple,
}

const directoryGuilds: { guild: Guild; membership: MembershipState; goalProgress: number }[] = [
  {
    guild: primaryGuild,
    membership: "member",
    goalProgress: 0.62,
  },
  {
    guild: {
      id: "g-forge",
      name: "The Forge",
      emblem: { icon: Hammer, color: tokens.brand },
      purpose: "Build and review one open-source PR per week.",
      memberCount: 41,
      capacity: 50,
    },
    membership: "none",
    goalProgress: 0.78,
  },
  {
    guild: {
      id: "g-archive",
      name: "Living Archive",
      emblem: { icon: BookOpen, color: tokens.purple },
      purpose: "Curate and tag the community knowledge base.",
      memberCount: 50,
      capacity: 50,
    },
    membership: "requested",
    goalProgress: 0.45,
  },
  {
    guild: {
      id: "g-lanterns",
      name: "Lantern Bearers",
      emblem: { icon: Sparkles, color: tokens.teal },
      purpose: "Onboard and mentor newcomers in their first week.",
      memberCount: 17,
      capacity: 50,
    },
    membership: "none",
    goalProgress: 0.33,
  },
  {
    guild: {
      id: "g-voyagers",
      name: "Voyagers",
      emblem: { icon: Telescope, color: tokens.amber },
      purpose: "Explore and document one new tool every sprint.",
      memberCount: 29,
      capacity: 50,
    },
    membership: "none",
    goalProgress: 0.51,
  },
]

/* ------------------------------- Demo ------------------------------- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: tokens.fontSans,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        color: tokens.textFaint,
      }}
    >
      {children}
    </h2>
  )
}

export default function GuildDemo() {
  const noop = () => {}

  return (
    <div
      className="min-h-screen w-full px-4 py-8 sm:px-8"
      style={{ background: "#25252F", fontFamily: tokens.fontSans }}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="flex flex-col gap-1">
          <span
            className="inline-flex w-fit items-center gap-1.5"
            style={{
              padding: "2px 10px",
              borderRadius: tokens.radiusPill,
              background: `${tokens.brand}1F`,
              border: `0.5px solid ${tokens.brand}66`,
              color: tokens.brand,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            <Swords size={12} />
            Ships at T3
          </span>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: tokens.text,
              letterSpacing: -0.4,
            }}
          >
            Guilds &amp; Circles
          </h1>
          <p style={{ fontSize: 14, color: tokens.textMuted }}>
            Small collaborative groups of 20–50 members working toward shared
            goals.
          </p>
        </header>

        <section className="flex flex-col gap-3">
          <SectionLabel>Guild header</SectionLabel>
          <GuildHeader
            guild={primaryGuild}
            members={members}
            goal={weeklyGoal}
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-3">
            <SectionLabel>Shared goal</SectionLabel>
            <GuildGoalCard goal={sharedGoal} />
          </section>

          <section className="flex flex-col gap-3">
            <SectionLabel>Members</SectionLabel>
            <div className="flex flex-col gap-2">
              {members.slice(0, 5).map((m) => (
                <MemberRow key={m.id} member={m} />
              ))}
            </div>
          </section>
        </div>

        <section className="flex flex-col gap-3">
          <SectionLabel>Guild badges</SectionLabel>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            <GuildBadgeTile badge={guildBadge} emblem={primaryGuild.emblem} />
            <GuildBadgeTile badge={lockedBadge} emblem={primaryGuild.emblem} />
            <GuildBadgeTile
              badge={{
                id: "b3",
                name: "Forge Masters",
                description: "Merge 250 reviewed PRs as a guild.",
                earned: true,
                tint: tokens.teal,
              }}
              emblem={{ icon: Hammer, color: tokens.teal }}
            />
            <GuildBadgeTile
              badge={{
                id: "b4",
                name: "Eternal Flame",
                description: "Hold a 90-day collective streak.",
                earned: false,
                tint: tokens.amber,
              }}
              emblem={{ icon: Sparkles, color: tokens.amber }}
            />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel>Single guild card</SectionLabel>
          <div className="max-w-sm">
            <GuildCard
              guild={primaryGuild}
              membership="none"
              goalProgress={0.62}
              onJoin={noop}
            />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel>Directory</SectionLabel>
          <GuildDirectory
            guilds={directoryGuilds}
            canCreate
            onJoin={noop}
            onCreate={noop}
          />
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel>Directory — below Level 10 (create locked)</SectionLabel>
          <GuildDirectory
            guilds={directoryGuilds.slice(0, 2)}
            canCreate={false}
            onJoin={noop}
            onCreate={noop}
          />
        </section>
      </div>
    </div>
  )
}
