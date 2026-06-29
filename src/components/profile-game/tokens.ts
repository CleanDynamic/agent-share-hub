// Shared design-system tokens for the L1 profile gamification surface.
// Plain TS object — imported by every component. Visuals are applied via
// inline style={{}}; Tailwind is reserved for layout only.

export const tokens = {
  surface: {
    shell: "rgba(52,52,66,0.55)",
    card: "rgba(68,68,84,0.60)",
    input: "rgba(82,82,100,0.60)",
  },
  border: {
    soft: "0.5px solid rgba(255,255,255,0.10)",
    strong: "0.5px solid rgba(255,255,255,0.14)",
  },
  radius: {
    panel: 14,
    card: 10,
    pill: 100,
  },
  glass: {
    // Apply to shell-tier surfaces only.
    backdropFilter: "blur(28px) saturate(160%)",
    WebkitBackdropFilter: "blur(28px) saturate(160%)",
  },
  brand: {
    orange: "#E8571A",
    orangeGradient: "linear-gradient(135deg, #E8571A 0%, #C44514 100%)",
  },
  accent: {
    teal: "#2EC4B6",
    amber: "#F59E0B",
    purple: "#7C3AED",
    green: "#22C55E", // ONLY for live / positive deltas
  },
  // Gamification colour language
  xp: "#E8571A", // XP = brand orange
  reputation: "#2EC4B6", // Reputation = teal
  streak: "#F59E0B", // Streaks = amber flame
  locked: "rgba(255,255,255,0.25)",
  text: {
    primary: "rgba(255,255,255,0.92)",
    secondary: "rgba(255,255,255,0.62)",
    muted: "rgba(255,255,255,0.42)",
  },
  font: {
    sans: "var(--font-inter), 'Inter', system-ui, sans-serif",
    mono: "var(--font-jetbrains-mono), 'JetBrains Mono', ui-monospace, monospace",
  },
} as const

// Track identity colours
export type TrackName = "Architect" | "Curator" | "Mentor" | "Explorer"

export const trackColors: Record<TrackName, string> = {
  Architect: "#E8571A",
  Curator: "#7C3AED",
  Mentor: "#2EC4B6",
  Explorer: "#F59E0B",
}
