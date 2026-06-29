import { tokens } from "./tokens"

interface LevelRingMiniProps {
  level: number
  /** Avatar image url (optional) */
  avatarUrl?: string
  /** Display name — used for fallback initials + alt text */
  name: string
  /** Diameter in px */
  size?: number
  /** Progress through current level, 0–1 */
  progress?: number
  /** Ring accent colour (defaults to XP orange) */
  color?: string
}

/**
 * Compact avatar wrapped in a circular level-progress ring with a level pip.
 * Used inside MemberRow and member avatar stacks.
 */
export default function LevelRingMini({
  level,
  avatarUrl,
  name,
  size = 36,
  progress = 0.6,
  color = tokens.xp,
}: LevelRingMiniProps) {
  const stroke = Math.max(2, Math.round(size * 0.07))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = Math.min(Math.max(progress, 0), 1) * c
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  const inner = size - stroke * 2 - 3

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="absolute inset-0 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>

      <div
        className="flex items-center justify-center overflow-hidden rounded-full"
        style={{
          width: inner,
          height: inner,
          background: tokens.input,
          fontFamily: tokens.fontSans,
          fontSize: inner * 0.4,
          fontWeight: 600,
          color: tokens.text,
        }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl || "/placeholder.svg"}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      <span
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center justify-center"
        style={{
          minWidth: size * 0.42,
          height: size * 0.3,
          padding: "0 4px",
          borderRadius: tokens.radiusPill,
          background: color,
          color: "#1A1208",
          fontFamily: tokens.fontMono,
          fontSize: size * 0.22,
          fontWeight: 700,
          lineHeight: 1,
          border: "1.5px solid #25252F",
        }}
      >
        {level}
      </span>
    </div>
  )
}
