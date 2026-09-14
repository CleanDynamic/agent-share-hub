// Shared visual tokens for the streak surface. Values are applied via inline
// style={{}} per the design system (Tailwind handles layout only).

export const COLORS = {
  // brand / gamification language
  xpOrange: "var(--action)",
  orangeDeep: "#C44514",
  reputationTeal: "var(--evidence)",
  streakAmber: "var(--lit)",
  purple: "var(--cat-agents)",
  greenPositive: "var(--cat-configuration)",
  // surfaces
  shell: "rgba(52,52,66,0.55)",
  card: "rgba(68,68,84,0.60)",
  input: "rgba(82,82,100,0.60)",
  // text
  text: "var(--text)",
  textMuted: "var(--recess)",
  textFaint: "var(--recess)",
  locked: "var(--recess)",
} as const

export const BORDER = {
  hairline: "0.5px solid var(--line)",
  hairlineStrong: "0.5px solid var(--line)",
} as const

export const RADIUS = {
  panel: 14,
  card: 10,
  pill: 100,
} as const

export const FONT = {
  sans: "Figtree, ui-sans-serif, system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
} as const

export const GLASS = {
  backdropFilter: "blur(28px) saturate(160%)",
  WebkitBackdropFilter: "blur(28px) saturate(160%)",
} as const

export const ORANGE_GRADIENT = `linear-gradient(135deg, ${COLORS.xpOrange} 0%, ${COLORS.orangeDeep} 100%)`

// Heatmap intensity ramp (orange, low -> high activity).
export const HEAT_RAMP = [
  "var(--recess)", // 0 — empty cell
  "color-mix(in srgb, var(--action) 28%, transparent)",
  "color-mix(in srgb, var(--action) 50%, transparent)",
  "color-mix(in srgb, var(--action) 72%, transparent)",
  "color-mix(in srgb, var(--action) 95%, transparent)",
] as const
