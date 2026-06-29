import type { CSSProperties } from "react"

/**
 * NeoScale design tokens — dark, glassmorphic creator gamification system.
 * Layout via Tailwind; all visual styling via inline style objects (no Next.js patterns).
 */

export const colors = {
  shell: "rgba(52,52,66,0.55)",
  card: "rgba(68,68,84,0.60)",
  input: "rgba(82,82,100,0.60)",

  borderSoft: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(255,255,255,0.14)",

  textPrimary: "rgba(255,255,255,0.92)",
  textSecondary: "rgba(255,255,255,0.62)",
  textMuted: "rgba(255,255,255,0.40)",
  locked: "rgba(255,255,255,0.25)",

  // brand
  orange: "#E8571A",
  orangeDeep: "#C44514",
  teal: "#2EC4B6",
  amber: "#F59E0B",
  purple: "#7C3AED",
  green: "#22C55E",
} as const

// XP / level colour language
export const semantic = {
  xp: colors.orange,
  reputation: colors.teal,
  streak: colors.amber,
  locked: colors.locked,
} as const

// Track colours
export const tracks = {
  Architect: "#E8571A",
  Curator: "#7C3AED",
  Mentor: "#2EC4B6",
  Explorer: "#F59E0B",
} as const

export const orangeGradient =
  "linear-gradient(135deg, #E8571A 0%, #C44514 100%)"

export const radius = {
  panel: 14,
  card: 10,
  pill: 100,
} as const

export const glass: CSSProperties = {
  backdropFilter: "blur(28px) saturate(160%)",
  WebkitBackdropFilter: "blur(28px) saturate(160%)",
}

export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "")
  const r = Number.parseInt(h.slice(0, 2), 16)
  const g = Number.parseInt(h.slice(2, 4), 16)
  const b = Number.parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Detect reduced-motion preference (safe on server: defaults to false).
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export const shellSurface: CSSProperties = {
  background: colors.shell,
  border: `0.5px solid ${colors.borderStrong}`,
  borderRadius: radius.panel,
  ...glass,
}

export const cardSurface: CSSProperties = {
  background: colors.card,
  border: `0.5px solid ${colors.borderSoft}`,
  borderRadius: radius.card,
}
