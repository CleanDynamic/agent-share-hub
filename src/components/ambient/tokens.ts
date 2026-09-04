// Shared design tokens for the XP / gamification system.
// Plain TS module — visuals are applied via inline style={{}} in each component.

export const tokens = {
  // Surfaces
  pageBg: "#25252F",
  shell: "rgba(52,52,66,0.55)",
  card: "rgba(68,68,84,0.60)",
  input: "rgba(82,82,100,0.60)",

  // Borders
  borderSoft: "0.5px solid rgba(255,255,255,0.10)",
  borderMid: "0.5px solid rgba(255,255,255,0.12)",
  borderStrong: "0.5px solid rgba(255,255,255,0.14)",

  // Brand / semantic
  orange: "#E8571A",
  orangeGradient: "linear-gradient(135deg, #E8571A 0%, #C44514 100%)",
  teal: "#2EC4B6",
  amber: "#F59E0B",
  purple: "#7C3AED",
  green: "#22C55E", // ONLY for live / positive deltas
  locked: "rgba(255,255,255,0.25)",

  // Text
  text: "rgba(255,255,255,0.92)",
  textMuted: "rgba(255,255,255,0.58)",
  textFaint: "rgba(255,255,255,0.38)",

  // Radii
  radiusPanel: 14,
  radiusCard: 10,
  radiusPill: 100,

  // Effects
  glass: "blur(28px) saturate(160%)",

  // Type
  fontSans: "'Figtree', system-ui, sans-serif",
  fontMono: "'JetBrains Mono', var(--font-geist-mono), monospace",
} as const

// Gamification colour language
export const xpColor = tokens.orange // XP = brand orange
export const reputationColor = tokens.teal // Reputation = teal
export const streakColor = tokens.amber // Streaks = amber flame

// Track colours
export const trackColors = {
  Architect: "#E8571A",
  Curator: "#7C3AED",
  Mentor: "#2EC4B6",
  Explorer: "#F59E0B",
} as const

export type TrackName = keyof typeof trackColors
