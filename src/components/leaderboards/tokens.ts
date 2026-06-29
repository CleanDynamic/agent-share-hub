// Design system tokens for the Leaderboards surface.
// Plain values — consumed via inline style={{}} for visuals.

export const tokens = {
  shell: "rgba(52,52,66,0.55)",
  card: "rgba(68,68,84,0.60)",
  input: "rgba(82,82,100,0.60)",
  borderSoft: "0.5px solid rgba(255,255,255,0.10)",
  borderStrong: "0.5px solid rgba(255,255,255,0.14)",
  brand: "#E8571A",
  brandGradient: "linear-gradient(135deg, #E8571A 0%, #C44514 100%)",
  teal: "#2EC4B6",
  amber: "#F59E0B",
  purple: "#7C3AED",
  green: "#22C55E",
  red: "#EF4444",
  locked: "rgba(255,255,255,0.25)",
  textPrimary: "rgba(255,255,255,0.92)",
  textMuted: "rgba(255,255,255,0.55)",
  textFaint: "rgba(255,255,255,0.38)",
  radiusPanel: 14,
  radiusCard: 10,
  radiusPill: 100,
  glass: {
    backdropFilter: "blur(28px) saturate(160%)",
    WebkitBackdropFilter: "blur(28px) saturate(160%)",
  },
  fontSans:
    "var(--font-inter), 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  fontMono:
    "var(--font-jetbrains-mono), 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace",
} as const

export type Track = "Architect" | "Curator" | "Mentor" | "Explorer"

export const trackColor: Record<Track, string> = {
  Architect: "#E8571A",
  Curator: "#7C3AED",
  Mentor: "#2EC4B6",
  Explorer: "#F59E0B",
}

// Rank medallion accents for the top 3 — restrained, not theatrical.
export const medalColor: Record<1 | 2 | 3, string> = {
  1: "#F59E0B", // amber / gold
  2: "#C9CDD6", // silver
  3: "#C07A4B", // bronze
}
