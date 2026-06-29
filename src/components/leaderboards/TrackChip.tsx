import { Compass, GraduationCap, Layers, PenTool } from "lucide-react"
import { tokens, trackColor, type Track } from "./tokens"

export interface TrackChipProps {
  track: Track
  size?: "sm" | "md"
}

const icons: Record<Track, typeof Compass> = {
  Architect: Layers,
  Curator: PenTool,
  Mentor: GraduationCap,
  Explorer: Compass,
}

/** Pill identifying which track a player belongs to, tinted by track colour. */
export default function TrackChip({ track, size = "sm" }: TrackChipProps) {
  const color = trackColor[track]
  const Icon = icons[track]
  const sm = size === "sm"

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: sm ? 20 : 24,
        padding: sm ? "0 8px" : "0 10px",
        borderRadius: tokens.radiusPill,
        background: `${color}1F`,
        border: `0.5px solid ${color}59`,
        color,
        fontFamily: tokens.fontSans,
        fontSize: sm ? 11 : 12,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={sm ? 11 : 13} aria-hidden />
      {track}
    </span>
  )
}
