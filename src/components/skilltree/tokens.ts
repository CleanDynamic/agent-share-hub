// Shared design tokens + types for the Skill Tree kit.
// Dark theme — plain values used in inline style objects.

export type TrackId = "architect" | "curator" | "mentor" | "explorer"

export type NodeState = "locked" | "available" | "unlocked"

export const tokens = {
  shell: "rgba(52,52,66,0.55)",
  card: "rgba(68,68,84,0.60)",
  input: "rgba(82,82,100,0.60)",
  borderSoft: "0.5px solid rgba(255,255,255,0.10)",
  border: "0.5px solid rgba(255,255,255,0.14)",
  brandOrange: "#E8571A",
  brandGradient: "linear-gradient(135deg, #E8571A 0%, #C44514 100%)",
  teal: "#2EC4B6",
  amber: "#F59E0B",
  purple: "#7C3AED",
  green: "#22C55E",
  locked: "rgba(255,255,255,0.25)",
  glass: "blur(28px) saturate(160%)",
  radiusPanel: 14,
  radiusCard: 10,
  radiusPill: 100,
  text: "rgba(255,255,255,0.92)",
  textDim: "rgba(255,255,255,0.55)",
  textFaint: "rgba(255,255,255,0.35)",
} as const

export const trackMeta: Record<
  TrackId,
  { name: string; color: string; philosophy: string }
> = {
  architect: {
    name: "Architect",
    color: "#E8571A",
    philosophy: "Design the systems others build on.",
  },
  curator: {
    name: "Curator",
    color: "#7C3AED",
    philosophy: "Shape signal out of the noise.",
  },
  mentor: {
    name: "Mentor",
    color: "#2EC4B6",
    philosophy: "Multiply yourself through others.",
  },
  explorer: {
    name: "Explorer",
    color: "#F59E0B",
    philosophy: "Go where the map runs out.",
  },
}

export const mono = "var(--font-geist-mono), ui-monospace, monospace"
export const sans = "var(--font-geist-sans), Inter, system-ui, sans-serif"

export function fmt(n: number): string {
  return n.toLocaleString("en-US")
}
