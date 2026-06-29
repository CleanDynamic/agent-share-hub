// Shared design tokens for the Reputation UI.
// Teal is the reputation colour language; orange is XP/level.

export const tokens = {
  // surface tiers
  shell: "rgba(52,52,66,0.55)",
  card: "rgba(68,68,84,0.60)",
  input: "rgba(82,82,100,0.60)",

  // borders
  borderSoft: "0.5px solid rgba(255,255,255,0.10)",
  borderStrong: "0.5px solid rgba(255,255,255,0.14)",

  // text
  text: "rgba(255,255,255,0.92)",
  textMuted: "rgba(255,255,255,0.55)",
  textFaint: "rgba(255,255,255,0.32)",
  locked: "rgba(255,255,255,0.25)",

  // brand / semantic
  orange: "#E8571A",
  orangeGradient: "linear-gradient(135deg, #E8571A 0%, #C44514 100%)",
  teal: "#2EC4B6",
  amber: "#F59E0B",
  green: "#22C55E",

  // teal shades for stacked contribution bars
  tealShades: ["#2EC4B6", "#27A89C", "#1F8C82", "#176F68"],

  // radii
  radiusPanel: 14,
  radiusCard: 10,
  radiusPill: 100,

  // glass
  glass: {
    backdropFilter: "blur(28px) saturate(160%)",
    WebkitBackdropFilter: "blur(28px) saturate(160%)",
  },
} as const

export const fontSans =
  "var(--font-inter), 'Inter Fallback', system-ui, sans-serif"
export const fontMono =
  "var(--font-jetbrains-mono), 'JetBrains Mono Fallback', monospace"
