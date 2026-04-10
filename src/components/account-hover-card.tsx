import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { CalendarDays } from "lucide-react"

const AVATAR_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  orange: { bg: "rgba(232, 87, 26, 0.15)", color: "#E8571A", border: "rgba(232, 87, 26, 0.3)" },
  teal: { bg: "rgba(46, 196, 182, 0.15)", color: "#2EC4B6", border: "rgba(46, 196, 182, 0.3)" },
  purple: { bg: "rgba(139, 92, 246, 0.15)", color: "#8B5CF6", border: "rgba(139, 92, 246, 0.3)" },
  blue: { bg: "rgba(59, 130, 246, 0.15)", color: "#3B82F6", border: "rgba(59, 130, 246, 0.3)" },
  green: { bg: "rgba(34, 197, 94, 0.15)", color: "#22C55E", border: "rgba(34, 197, 94, 0.3)" },
}

export interface AccountData {
  display_name: string
  username: string
  avatar_url?: string
  bio?: string
  follower_count?: number
  following_count?: number
  post_count?: number
  joined_date?: string
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function getAvatarStyle(name: string) {
  const colors = Object.values(AVATAR_COLORS)
  const index = name.length % colors.length
  return colors[index]
}

function formatJoinDate(dateStr?: string): string {
  if (!dateStr) return "Member"
  const date = new Date(dateStr)
  return `Joined ${date.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
}

interface AccountHoverCardProps {
  account: AccountData
  children: React.ReactNode
}

export function AccountHoverCard({ account, children }: AccountHoverCardProps) {
  const avatarStyle = account.avatar_url ? null : getAvatarStyle(account.display_name)
  const initials = getInitials(account.display_name)

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div className="cursor-pointer inline">{children}</div>
      </HoverCardTrigger>
      <HoverCardContent
        className="w-72 p-0 overflow-hidden"
        style={{
          background: "rgba(27, 27, 32, 0.95)",
          backdropFilter: "blur(40px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
        }}
        side="bottom"
        align="start"
        sideOffset={8}
      >
        {/* Header with avatar and follow button */}
        <div className="p-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            {/* Avatar */}
            {account.avatar_url ? (
              <img
                src={account.avatar_url}
                alt={account.display_name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold"
                style={{
                  background: avatarStyle?.bg,
                  color: avatarStyle?.color,
                  border: `1px solid ${avatarStyle?.border}`,
                }}
              >
                {initials}
              </div>
            )}

            {/* Follow button */}
            <button
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all"
              style={{
                background: "#E8571A",
                color: "#ffffff",
              }}
              onClick={(e) => {
                e.stopPropagation()
                console.log(`Follow @${account.username}`)
              }}
            >
              Follow
            </button>
          </div>

          {/* Name and handle */}
          <div className="mt-3">
            <div className="font-semibold text-white text-[15px] leading-tight">
              {account.display_name}
            </div>
            <div className="text-white/40 text-sm">@{account.username}</div>
          </div>

          {/* Bio */}
          {account.bio && (
            <p className="mt-2 text-sm text-white/60 leading-relaxed line-clamp-2">
              {account.bio}
            </p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-white text-sm">
                {account.following_count ?? 0}
              </span>
              <span className="text-white/40 text-sm">Following</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-semibold text-white text-sm">
                {account.follower_count ?? 0}
              </span>
              <span className="text-white/40 text-sm">Followers</span>
            </div>
          </div>

          {/* Joined date */}
          <div className="flex items-center gap-1.5 mt-3 text-white/40">
            <CalendarDays className="w-3.5 h-3.5" />
            <span className="text-xs">{formatJoinDate(account.joined_date)}</span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
