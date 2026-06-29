import { Plus, Lock } from "lucide-react"
import { tokens } from "./tokens"
import type { Guild, MembershipState } from "./types"
import GuildCard from "./GuildCard"

interface DirectoryEntry {
  guild: Guild
  membership: MembershipState
  goalProgress: number
}

interface GuildDirectoryProps {
  guilds: DirectoryEntry[]
  /** Whether the viewer meets the Level 10 requirement to start a guild */
  canCreate: boolean
  /** Minimum level required to create (default 10) */
  createLevel?: number
  onJoin?: (guildId: string) => void
  onCreate?: () => void
}

export default function GuildDirectory({
  guilds,
  canCreate,
  createLevel = 10,
  onJoin,
  onCreate,
}: GuildDirectoryProps) {
  return (
    <section
      className="flex flex-col gap-4 p-5"
      style={{
        background: tokens.shell,
        ...tokens.glass,
        border: tokens.borderStrong,
        borderRadius: tokens.radiusPanel,
        fontFamily: tokens.fontSans,
        color: tokens.text,
      }}
    >
      <div className="flex items-center justify-between">
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Guilds</h2>
        <span style={{ fontSize: 12, color: tokens.textFaint }}>
          {guilds.length} circles
        </span>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {guilds.map((entry) => (
          <GuildCard
            key={entry.guild.id}
            guild={entry.guild}
            membership={entry.membership}
            goalProgress={entry.goalProgress}
            onJoin={onJoin}
          />
        ))}

        <StartGuildCta
          canCreate={canCreate}
          createLevel={createLevel}
          onCreate={onCreate}
        />
      </div>
    </section>
  )
}

function StartGuildCta({
  canCreate,
  createLevel,
  onCreate,
}: {
  canCreate: boolean
  createLevel: number
  onCreate?: () => void
}) {
  return (
    <button
      type="button"
      disabled={!canCreate}
      onClick={() => canCreate && onCreate?.()}
      className="flex flex-col items-center justify-center gap-3 p-4 text-center transition-colors"
      style={{
        minHeight: 200,
        background: "transparent",
        border: `1px dashed ${canCreate ? `${tokens.brand}80` : tokens.locked}`,
        borderRadius: tokens.radiusCard,
        color: tokens.text,
        cursor: canCreate ? "pointer" : "not-allowed",
        fontFamily: tokens.fontSans,
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: canCreate ? `${tokens.brand}1F` : "rgba(255,255,255,0.05)",
          border: canCreate
            ? `0.5px solid ${tokens.brand}66`
            : `0.5px solid ${tokens.locked}`,
        }}
      >
        {canCreate ? (
          <Plus size={24} color={tokens.brand} strokeWidth={2.2} />
        ) : (
          <Lock size={20} color={tokens.locked} />
        )}
      </div>
      <div className="flex flex-col gap-1">
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: canCreate ? tokens.text : tokens.textMuted,
          }}
        >
          Start a guild
        </span>
        <span style={{ fontSize: 12, color: tokens.textFaint }}>
          {canCreate
            ? "Found a circle and recruit your first members"
            : `Reach Level ${createLevel} to found your own circle`}
        </span>
      </div>
    </button>
  )
}
