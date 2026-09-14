import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { CalendarDays } from "lucide-react"

const AVATAR_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  orange: { bg: "color-mix(in srgb, var(--action) 15%, transparent)", color: "var(--action)", border: "color-mix(in srgb, var(--action) 30%, transparent)" },
  teal: { bg: "color-mix(in srgb, var(--evidence) 15%, transparent)", color: "var(--evidence)", border: "color-mix(in srgb, var(--evidence) 30%, transparent)" },
  purple: { bg: "color-mix(in srgb, var(--cat-agents) 15%, transparent)", color: "var(--cat-agents)", border: "color-mix(in srgb, var(--cat-agents) 30%, transparent)" },
  blue: { bg: "color-mix(in srgb, var(--cat-data) 15%, transparent)", color: "var(--cat-data)", border: "color-mix(in srgb, var(--cat-data) 30%, transparent)" },
  green: { bg: "color-mix(in srgb, var(--cat-configuration) 15%, transparent)", color: "var(--cat-configuration)", border: "color-mix(in srgb, var(--cat-configuration) 30%, transparent)" },
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
          background: "var(--bg)",
          backdropFilter: "blur(40px)",
          border: "1px solid var(--line)",
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
                background: "var(--action)",
                color: "var(--text)",
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
            <div className="font-semibold text-foreground text-[15px] leading-tight">
              {account.display_name}
            </div>
            <div className="text-muted-foreground text-sm">@{account.username}</div>
          </div>

          {/* Bio */}
          {account.bio && (
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {account.bio}
            </p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-foreground text-sm">
                {account.following_count ?? 0}
              </span>
              <span className="text-muted-foreground text-sm">Following</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-semibold text-foreground text-sm">
                {account.follower_count ?? 0}
              </span>
              <span className="text-muted-foreground text-sm">Followers</span>
            </div>
          </div>

          {/* Joined date */}
          <div className="flex items-center gap-1.5 mt-3 text-muted-foreground">
            <CalendarDays className="w-3.5 h-3.5" />
            <span className="text-xs">{formatJoinDate(account.joined_date)}</span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
