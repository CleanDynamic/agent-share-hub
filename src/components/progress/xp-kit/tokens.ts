// Shared design tokens for the XP display kit.
// Plain values — components use Tailwind for layout and inline style for visuals.

export const tokens = {
  // Surfaces
  shell: "rgba(52,52,66,0.55)",
  card: "rgba(68,68,84,0.60)",
  input: "rgba(82,82,100,0.60)",

  // Borders
  borderSoft: "0.5px solid rgba(255,255,255,0.10)",
  borderMid: "0.5px solid rgba(255,255,255,0.12)",
  borderStrong: "0.5px solid rgba(255,255,255,0.14)",

  // Brand + semantic colours
  orange: "#E8571A",
  orangeGradient: "linear-gradient(135deg, #E8571A 0%, #C44514 100%)",
  teal: "#2EC4B6",
  amber: "#F59E0B",
  purple: "#7C3AED",
  green: "#22C55E",
  red: "#EF4444",
  locked: "rgba(255,255,255,0.25)",

  // Track colours (skill tracks)
  trackArchitect: "#E8571A",
  trackCurator: "#7C3AED",
  trackMentor: "#2EC4B6",
  trackExplorer: "#F59E0B",

  // Text
  text: "rgba(255,255,255,0.92)",
  textMuted: "rgba(255,255,255,0.55)",
  textFaint: "rgba(255,255,255,0.35)",

  // Radii
  radiusPanel: 14,
  radiusCard: 10,
  radiusPill: 100,

  // Glass
  glass: {
    backdropFilter: "blur(28px) saturate(160%)",
    WebkitBackdropFilter: "blur(28px) saturate(160%)",
  } as const,

  // Fonts
  fontSans:
    "'Figtree', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const

export type Tokens = typeof tokens
