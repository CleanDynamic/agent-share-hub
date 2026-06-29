// Shared design tokens for the Guild/Circle UI system.
// Plain object — consumed via inline style={{}} for all visual treatment.

export const tokens = {
  // Surface tiers
  shell: "rgba(52,52,66,0.55)",
  card: "rgba(68,68,84,0.60)",
  input: "rgba(82,82,100,0.60)",

  // Borders
  border: "0.5px solid rgba(255,255,255,0.10)",
  borderStrong: "0.5px solid rgba(255,255,255,0.14)",

  // Brand + semantic
  brand: "#E8571A",
  brandGradient: "linear-gradient(135deg, #E8571A 0%, #C44514 100%)",
  teal: "#2EC4B6",
  amber: "#F59E0B",
  purple: "#7C3AED",
  green: "#22C55E", // ONLY for live / positive deltas

  // Gamification colour language
  xp: "#E8571A", // XP = brand orange
  reputation: "#2EC4B6", // Reputation = teal
  streak: "#F59E0B", // Streaks = amber flame
  locked: "rgba(255,255,255,0.25)",

  // Text
  text: "rgba(255,255,255,0.92)",
  textMuted: "rgba(255,255,255,0.62)",
  textFaint: "rgba(255,255,255,0.40)",

  // Radii
  radiusPanel: 14,
  radiusCard: 10,
  radiusPill: 100,

  // Glass (shell-tier surfaces only)
  glass: {
    backdropFilter: "blur(28px) saturate(160%)",
    WebkitBackdropFilter: "blur(28px) saturate(160%)",
  },

  // Fonts
  fontSans:
    'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  fontMono:
    'JetBrains Mono, ui-monospace, "SF Mono", Menlo, Consolas, monospace',
} as const

// Track colour language
export const trackColors = {
  Architect: "#E8571A",
  Curator: "#7C3AED",
  Mentor: "#2EC4B6",
  Explorer: "#F59E0B",
} as const

export type TrackName = keyof typeof trackColors
