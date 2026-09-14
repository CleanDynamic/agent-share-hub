// Shared design tokens for the XP / gamification system.
// Plain TS module — visuals are applied via inline style={{}} in each component.

export const tokens = {
  // Surfaces
  pageBg: "var(--bg)",
  shell: "rgba(52,52,66,0.55)",
  card: "rgba(68,68,84,0.60)",
  input: "rgba(82,82,100,0.60)",

  // Borders
  borderSoft: "0.5px solid var(--line)",
  borderMid: "0.5px solid var(--line)",
  borderStrong: "0.5px solid var(--line)",

  // Brand / semantic
  orange: "var(--action)",
  orangeGradient: "linear-gradient(135deg, var(--action) 0%, #C44514 100%)",
  teal: "var(--evidence)",
  amber: "var(--lit)",
  purple: "var(--cat-agents)",
  green: "var(--cat-configuration)", // ONLY for live / positive deltas
  locked: "var(--recess)",

  // Text
  text: "var(--text)",
  textMuted: "var(--recess)",
  textFaint: "var(--recess)",

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
  Architect: "var(--action)",
  Curator: "var(--cat-agents)",
  Mentor: "var(--evidence)",
  Explorer: "var(--cat-artefact)",
} as const

export type TrackName = keyof typeof trackColors
