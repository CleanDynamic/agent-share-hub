// Shared visual tokens for the streak surface. Values are applied via inline
// style={{}} per the design system (Tailwind handles layout only).

export const COLORS = {
  // brand / gamification language
  xpOrange: "#E8571A",
  orangeDeep: "#C44514",
  reputationTeal: "#2EC4B6",
  streakAmber: "#F59E0B",
  purple: "#7C3AED",
  greenPositive: "#22C55E",
  // surfaces
  shell: "rgba(52,52,66,0.55)",
  card: "rgba(68,68,84,0.60)",
  input: "rgba(82,82,100,0.60)",
  // text
  text: "rgba(255,255,255,0.92)",
  textMuted: "rgba(255,255,255,0.55)",
  textFaint: "rgba(255,255,255,0.35)",
  locked: "rgba(255,255,255,0.25)",
} as const

export const BORDER = {
  hairline: "0.5px solid rgba(255,255,255,0.10)",
  hairlineStrong: "0.5px solid rgba(255,255,255,0.14)",
} as const

export const RADIUS = {
  panel: 14,
  card: 10,
  pill: 100,
} as const

export const FONT = {
  sans: "Inter, ui-sans-serif, system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
} as const

export const GLASS = {
  backdropFilter: "blur(28px) saturate(160%)",
  WebkitBackdropFilter: "blur(28px) saturate(160%)",
} as const

export const ORANGE_GRADIENT = `linear-gradient(135deg, ${COLORS.xpOrange} 0%, ${COLORS.orangeDeep} 100%)`

// Heatmap intensity ramp (orange, low -> high activity).
export const HEAT_RAMP = [
  "rgba(255,255,255,0.06)", // 0 — empty cell
  "rgba(232,87,26,0.28)",
  "rgba(232,87,26,0.50)",
  "rgba(232,87,26,0.72)",
  "rgba(232,87,26,0.95)",
] as const
