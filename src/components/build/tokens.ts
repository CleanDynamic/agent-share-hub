// Design tokens for the public build page (/b2/:slug).
//
// These live as plain objects rather than CSS classes on purpose: Tailwind's
// generated utilities win over hand-written classes at build time, so every
// surface on this route is styled with inline style={{ }}.

import type { CSSProperties } from "react";

export const VOID = "#08080C";
export const ORANGE = "#E8571A";
export const TEAL = "#2EC4B6";

export const TEXT_PRIMARY = "rgba(255,255,255,0.90)";
export const TEXT_SECONDARY = "rgba(255,255,255,0.45)";
export const TEXT_MUTED = "rgba(255,255,255,0.28)";
export const HAIRLINE = "rgba(255,255,255,0.07)";

/** breakage / gap. Also the left border on a node flagged is_gap. */
export const GAP_RED = "#EF4444";

export const FONT_STACK =
  "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif";

/** Fallback when a node's type is missing from the registry. */
export const CATEGORY_COLOUR: Record<string, string> = {
  instruction: ORANGE,
  configuration: "#22C55E",
  data: "#3B82F6",
  artefact: "#F59E0B",
  evidence: TEAL,
  narrative: "#9CA3AF",
  agent: "#7C3AED",
  breakage: GAP_RED,
  gap: GAP_RED,
  media: "#EC4899",
};

/** "#E8571A" -> "rgba(232,87,26,0.15)". Returns the input if it is not a hex. */
export function hexToRgba(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!match) return hex;
  const int = parseInt(match[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export const panelGlass: CSSProperties = {
  background: "rgba(16,16,24,0.72)",
  backdropFilter: "blur(40px) saturate(180%)",
  WebkitBackdropFilter: "blur(40px) saturate(180%)",
  border: `1px solid ${HAIRLINE}`,
};

export const cardGlass: CSSProperties = {
  background: "rgba(255,255,255,0.025)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 12,
};

export const bodyText: CSSProperties = {
  fontSize: 13,
  fontWeight: 300,
  lineHeight: 1.6,
  color: TEXT_PRIMARY,
};

export const labelText: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.04em",
  color: TEXT_SECONDARY,
};

export const titleText: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: TEXT_PRIMARY,
};

export const headingText: CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  color: TEXT_PRIMARY,
};

export const pageHeadingText: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  lineHeight: 1.3,
  color: TEXT_PRIMARY,
};
