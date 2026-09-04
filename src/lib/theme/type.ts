// buildgallery.ai — the type scale.
//
// THIS IS THE ONLY TYPE MODULE A COMPONENT IMPORTS, and it is the companion to
// `tokens.ts`: that one decides colour, this one decides lettering. Neither
// decides layout.
//
// Styling in this codebase is applied inline, because Tailwind's generated
// utilities override hand-written classes at build time. So every role below is
// a ready-made style object, meant to be spread rather than copied:
//
//   import { type } from "@/lib/theme/type";
//   import { t } from "@/lib/theme/tokens";
//
//   <h2 style={{ ...type.sectionHead, color: t.text }}>How it was built</h2>
//   <p  style={{ ...type.body, ...measure, color: t.text2 }}>…</p>
//   <span style={{ ...type.data, ...tabular }}>$0.42</span>
//
// Spread it; do not pick fields out of it. A role that arrives half-applied —
// the size without the weight, the family without the line-height — is how a
// scale stops being one.
//
// THREE FACES, THREE JOBS. Bodoni Moda is display and nothing else. Figtree is
// body and UI. DM Mono is data: model names, cost, timestamps, change
// summaries, part labels, counts and eyebrows. Mono never sets long-form prose,
// and no role here mixes the jobs.
//
// TWO FLOORS, ENFORCED BELOW RATHER THAN DOCUMENTED. Bodoni Moda is never
// emitted under 20px, and Figtree is never emitted under weight 400 at sizes
// below 18px. Both are hard rules in the theme, and both describe a specific
// failure: a didone's hairlines shimmer and break up at small sizes, worst on
// the dark room, and a sub-400 weight at text size disappears into the ground.
// `assertFloors` runs over this table at import time in dev, and the unit test
// runs it in CI, so a violation cannot reach a screen by being written down.

import type { CSSProperties } from "react";

/* ── Families ──────────────────────────────────────────────────────────────
   Each stack falls back within its own job, so a face that fails to load
   degrades to something doing the same work rather than to the body face. */

/** Body and UI. */
export const FIGTREE =
  "'Figtree', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/** Display, 20px and up only. */
export const BODONI = "'Bodoni Moda', 'Didot', 'Times New Roman', Georgia, serif";

/** Data. */
export const DM_MONO =
  "'DM Mono', ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, monospace";

/* ── The scale ─────────────────────────────────────────────────────────────
   Eight roles. Sizes given as a range in the spec are `clamp()`d between those
   bounds so they scale with the viewport instead of stepping at a breakpoint;
   the lower bound is the value the floors are checked against, because it is
   the smallest the role can ever render.

   `textWrap` is set by role, not by taste: headings balance so a two-line
   title does not leave one word stranded, descriptions get `pretty` so a
   paragraph does not end on a widow. Neither belongs on a label or a number,
   which is why the short roles carry no `textWrap` at all. */

/** 12px mono, uppercase. The small label above a section or a card. */
export const eyebrow = {
  fontFamily: DM_MONO,
  fontSize: "12px",
  fontWeight: 500,
  lineHeight: 1.3,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
} as const satisfies CSSProperties;

/** 16px Figtree. The default for prose and any text that wraps. */
export const body = {
  fontFamily: FIGTREE,
  fontSize: "16px",
  fontWeight: 400,
  lineHeight: 1.55,
  letterSpacing: "0",
  textWrap: "pretty",
} as const satisfies CSSProperties;

/** 17px Figtree. Body copy that leads — a standfirst, a build's summary. */
export const bodyLarge = {
  fontFamily: FIGTREE,
  fontSize: "17px",
  fontWeight: 400,
  lineHeight: 1.55,
  letterSpacing: "0",
  textWrap: "pretty",
} as const satisfies CSSProperties;

/** 19–22px Figtree 500. A card's title. Sans, not display: at this size
    Bodoni would be below its floor at the small end and shimmer at the large. */
export const cardTitle = {
  fontFamily: FIGTREE,
  fontSize: "clamp(19px, 1.4vw, 22px)",
  fontWeight: 500,
  lineHeight: 1.25,
  letterSpacing: "-0.01em",
  textWrap: "balance",
} as const satisfies CSSProperties;

/** 30–48px Bodoni Moda. A section heading on a reading surface. */
export const sectionHead = {
  fontFamily: BODONI,
  fontSize: "clamp(30px, 3.6vw, 48px)",
  fontWeight: 400,
  lineHeight: 1.12,
  letterSpacing: "-0.01em",
  textWrap: "balance",
} as const satisfies CSSProperties;

/** 44–78px Bodoni Moda. One per page, at most. */
export const hero = {
  fontFamily: BODONI,
  fontSize: "clamp(44px, 6.4vw, 78px)",
  fontWeight: 400,
  lineHeight: 1.05,
  letterSpacing: "-0.02em",
  textWrap: "balance",
} as const satisfies CSSProperties;

/** 13–14px mono. Model names, cost, timestamps, change summaries, counts.
    Pair with `tabular` wherever the digits sit in a column. */
export const data = {
  fontFamily: DM_MONO,
  fontSize: "clamp(13px, 0.9vw, 14px)",
  fontWeight: 400,
  lineHeight: 1.45,
  letterSpacing: "0",
} as const satisfies CSSProperties;

/** 13px Figtree 500. A field label or a chip — short, and never wrapping. */
export const label = {
  fontFamily: FIGTREE,
  fontSize: "13px",
  fontWeight: 500,
  lineHeight: 1.3,
  letterSpacing: "0.01em",
} as const satisfies CSSProperties;

/** The scale, by role. `type.body`, `type.sectionHead`, and so on. */
export const type = {
  eyebrow,
  body,
  bodyLarge,
  cardTitle,
  sectionHead,
  hero,
  data,
  label,
} as const;

export type TypeRole = keyof typeof type;

/* ── Modifiers ─────────────────────────────────────────────────────────────
   Spread alongside a role rather than baked into it, because both depend on
   where the text sits rather than on what it is. */

/**
 * The 68ch measure cap, mid-range of the 60–75 characters the theme sets.
 * Long-form prose only — build notes, layer content, the import steps, the
 * about page. A label, a heading or a table cell is exempt; capping those
 * makes columns ragged for no reading benefit.
 *
 * `maxWidth` on a text element is a visual constraint on the text, not a
 * change to a layout element's own width. Do not spread this onto a container
 * whose width the layout depends on.
 */
export const measure = { maxWidth: "68ch" } as const satisfies CSSProperties;

/**
 * Fixed-width digits, so a value that changes — a cost, a count, a duration —
 * does not shift what sits beside it. Required wherever digits align in a
 * column; harmless anywhere else a number renders.
 */
export const tabular = {
  fontVariantNumeric: "tabular-nums",
} as const satisfies CSSProperties;

/* ── The floors ────────────────────────────────────────────────────────────
   Both rules are stated in the theme as hard, so they are checked in code
   rather than trusted to review. */

/** Bodoni Moda is never emitted below this size. */
export const DISPLAY_MIN_PX = 20;

/** Below this size, Figtree is never emitted under weight 400. */
export const BODY_WEIGHT_FLOOR_PX = 18;

/** The weight that floor holds Figtree to. */
export const BODY_MIN_WEIGHT = 400;

/**
 * The smallest px a size can render at: the first bound of a `clamp()`, or the
 * value itself when it is a plain px. Returns null for a size expressed in
 * units this check cannot resolve statically, which is the honest answer — a
 * caller deciding a floor treats null as "unknown", never as "fine".
 */
export function minPx(fontSize: string): number | null {
  const clamped = /^clamp\(\s*(-?[\d.]+)px\s*,/.exec(fontSize);
  if (clamped) return Number(clamped[1]);
  const plain = /^(-?[\d.]+)px$/.exec(fontSize);
  return plain ? Number(plain[1]) : null;
}

/** True when the stack leads with the named family. */
const leadsWith = (fontFamily: string, family: string) =>
  fontFamily.trim().startsWith(`'${family}'`);

/**
 * Check one style object against both floors. Returns the violations it finds
 * as sentences, empty when the style is legal.
 *
 * Exported so the test can run it over arbitrary input, not only over the
 * table above — the floors have to hold for anything a component writes by
 * hand, and a check that only ever sees its own constants proves nothing.
 */
export function floorViolations(role: string, style: CSSProperties): string[] {
  const found: string[] = [];
  const family = String(style.fontFamily ?? "");
  const size = typeof style.fontSize === "string" ? minPx(style.fontSize) : null;
  const weight = Number(style.fontWeight ?? BODY_MIN_WEIGHT);

  if (leadsWith(family, "Bodoni Moda")) {
    if (size === null) {
      found.push(
        `${role}: Bodoni Moda at a size this check cannot resolve (${String(style.fontSize)}); ` +
          `the display face needs a size provably at or above ${DISPLAY_MIN_PX}px.`,
      );
    } else if (size < DISPLAY_MIN_PX) {
      found.push(
        `${role}: Bodoni Moda at ${size}px is below the ${DISPLAY_MIN_PX}px display floor — ` +
          `its hairlines break up at this size, worst on Dusk. Use Figtree, or size up.`,
      );
    }
  }

  if (
    leadsWith(family, "Figtree") &&
    size !== null &&
    size < BODY_WEIGHT_FLOOR_PX &&
    weight < BODY_MIN_WEIGHT
  ) {
    found.push(
      `${role}: Figtree at ${size}px weight ${weight} is under the weight floor — ` +
        `below ${BODY_WEIGHT_FLOOR_PX}px the weight must be at least ${BODY_MIN_WEIGHT}.`,
    );
  }

  return found;
}

/** Every violation across the scale. Empty when the table is legal. */
export function assertFloors(): string[] {
  return Object.entries(type).flatMap(([role, style]) =>
    floorViolations(role, style as CSSProperties),
  );
}

// Dev-only. The scale is a static table, so a violation here is an authoring
// mistake that the unit test also catches — this makes it loud the moment the
// module is imported rather than at review time. It cannot fire in production:
// the check is stripped from the build, and the table it reads never changes at
// runtime.
if (import.meta.env?.DEV) {
  const violations = assertFloors();
  if (violations.length > 0) {
    throw new Error(`Type scale violates the theme's floors:\n  ${violations.join("\n  ")}`);
  }
}
