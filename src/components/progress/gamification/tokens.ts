/**
 * Shared design tokens for the gamification system.
 * Visuals are applied via inline style objects; layout via Tailwind.
 */

export const colors = {
  pageBg: "#25252F",
  shell: "rgba(52,52,66,0.55)",
  card: "rgba(68,68,84,0.60)",
  input: "rgba(82,82,100,0.60)",
  borderSoft: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(255,255,255,0.14)",
  textPrimary: "rgba(255,255,255,0.92)",
  textMuted: "rgba(255,255,255,0.55)",
  textFaint: "rgba(255,255,255,0.35)",
  locked: "rgba(255,255,255,0.25)",

  // Brand / semantic
  brand: "#E8571A", // XP
  brandGradient: "linear-gradient(135deg, #E8571A 0%, #C44514 100%)",
  teal: "#2EC4B6", // Reputation
  amber: "#F59E0B", // Streaks
  purple: "#7C3AED",
  green: "#22C55E", // live / positive deltas ONLY
} as const

export const tracks = {
  Architect: "#E8571A",
  Curator: "#7C3AED",
  Mentor: "#2EC4B6",
  Explorer: "#F59E0B",
} as const

export type TrackName = keyof typeof tracks

export const radius = {
  panel: 14,
  card: 10,
  pill: 100,
} as const

export const glass = {
  backdropFilter: "blur(28px) saturate(160%)",
  WebkitBackdropFilter: "blur(28px) saturate(160%)",
} as const

/** Convert a hex color + alpha into an rgba() string. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "")
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const monoFont =
  "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace"
