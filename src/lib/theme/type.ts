// OpenBuilds — the type scale (Synth draft brand pack).
//
// THIS IS THE ONLY TYPE MODULE A COMPONENT IMPORTS, and it is the companion to
// `tokens.ts`: that one decides colour, this one decides lettering. Neither
// decides layout.
//
// Styling in this codebase is applied inline. Every role below is a ready-made
// style object, meant to be spread rather than copied:
//
//   <h2 style={{ ...type.sectionHead, color: t.text }}>36 drafts</h2>
//   <p  style={{ ...type.body, ...measure, color: t.text2 }}>…</p>
//   <span style={{ ...type.data, ...tabular }}>12</span>
//   <h1 style={{ ...type.work, color: t.text }}>The build's title</h1>
//
// ONE SANS, ONE SERIF, ONE MONO.
//   Geist        the interface: headings, body, buttons, nav, labels.
//   Geist Serif  weight 400 ONLY, and ONLY for works: the build title, a
//                build's name in a "Rebuilt from" box, compare column heads,
//                the credit line on Rebuild, a profile card's name in Followers.
//                It has no weight axis, so it is never bolded.
//   Geist Mono   ONLY for numbers: counts in tables, step numbers, keys,
//                character counts, XP figures, "1 of 3". Never a sentence,
//                a label or a handle.
// The names FIGTREE, SENTIENT and DM_MONO stay as the three roles' handles so
// callers do not change; FIGTREE is Geist, SENTIENT is Geist Serif, DM_MONO is
// Geist Mono.
//
// FIVE SIZES (px size / line): 31/36 page titles and the build title; 20/24
// section heads; 17/22 group headings; 15/20 body, fields, buttons, nav; 13/16
// meta, labels, chips. The eyebrow role is retired: it keeps its name so
// callers do not change, and renders as a plain 13/16 label. No uppercase.

import type { CSSProperties } from "react";

/** `var(--x, fallback)` → `fallback`, through nested vars. Anything else comes back unchanged. */
export function fallbackOf(value: string): string {
  let current = value.trim();
  for (;;) {
    const m = /^var\(\s*--[a-z0-9-]+\s*,\s*([\s\S]+)\)$/i.exec(current);
    if (!m) return current;
    current = m[1].trim();
  }
}

/** A role property: the custom property for it, defaulting to today's value. */
const roleVar = (role: string, prop: "size" | "weight" | "leading" | "tracking" | "font", fallback: string | number) =>
  `var(--type-${role}-${prop}, ${fallback})`;

/* ── Families ──────────────────────────────────────────────────────────────
   Each stack falls back within its own job, so a face that fails to load
   degrades to something doing the same work rather than to the body face. */

/** The interface: Geist. The `*_STACK` constants are the fallbacks written into each `var()`. */
export const FIGTREE_STACK = "Geist, system-ui, sans-serif";
export const FIGTREE = `var(--font-ui, ${FIGTREE_STACK})`;

/** Works only: Geist Serif 400. */
export const SENTIENT_STACK = "'Geist Serif', Georgia, serif";
export const SENTIENT = `var(--font-display, ${SENTIENT_STACK})`;

/** Numbers only: Geist Mono. */
export const DM_MONO_STACK = "'Geist Mono', ui-monospace, monospace";
export const DM_MONO = `var(--font-data, ${DM_MONO_STACK})`;

/* ── The scale ─────────────────────────────────────────────────────────────
   Five sizes, nine role names. `textWrap` is set by role: headings balance so a
   two-line title does not leave one word stranded, descriptions get `pretty`.
   Neither belongs on a label or a number. */

/** 13/16 Geist 500. The retired eyebrow: the name stays so callers do not change,
    but there is no uppercase and no mono any more. */
export const eyebrow = {
  fontFamily: roleVar("eyebrow", "font", FIGTREE),
  fontSize: roleVar("eyebrow", "size", "13px"),
  fontWeight: 500,
  lineHeight: "16px",
  letterSpacing: "0",
} as const satisfies CSSProperties;

/** 15/20 Geist 400. Prose, post text, fields, buttons, nav. */
export const body = {
  fontFamily: FIGTREE,
  fontSize: roleVar("body", "size", "15px"),
  fontWeight: 400,
  lineHeight: roleVar("body", "leading", "20px"),
  letterSpacing: "0",
  textWrap: "pretty",
} as const satisfies CSSProperties;

/** 17/22 Geist 400. Group headings inside settings and legal pages, the notepad
    title, copy that leads. Bold it to 600 where it heads a group. */
export const bodyLarge = {
  fontFamily: FIGTREE,
  fontSize: roleVar("body-large", "size", "17px"),
  fontWeight: 400,
  lineHeight: roleVar("body-large", "leading", "22px"),
  letterSpacing: "0",
  textWrap: "pretty",
} as const satisfies CSSProperties;

/** 15/20 Geist 600. A row title, a name in a post. */
export const cardTitle = {
  fontFamily: FIGTREE,
  fontSize: roleVar("card-title", "size", "15px"),
  fontWeight: roleVar("card-title", "weight", 600),
  lineHeight: roleVar("card-title", "leading", "20px"),
  letterSpacing: "0",
  textWrap: "balance",
} as const satisfies CSSProperties;

/** 20/24 Geist 600, tracking -0.01em. Section heads in side columns, compact
    page heads, table titles. */
export const sectionHead = {
  fontFamily: FIGTREE,
  fontSize: roleVar("section-head", "size", "20px"),
  fontWeight: 600,
  lineHeight: roleVar("section-head", "leading", "24px"),
  letterSpacing: roleVar("section-head", "tracking", "-0.01em"),
  textWrap: "balance",
} as const satisfies CSSProperties;

/** 31/36 Geist 600. A visible page title: one per page, at most. */
export const hero = {
  fontFamily: FIGTREE,
  fontSize: roleVar("hero", "size", "31px"),
  fontWeight: 600,
  lineHeight: roleVar("hero", "leading", "36px"),
  letterSpacing: roleVar("hero", "tracking", "-0.02em"),
  textWrap: "balance",
} as const satisfies CSSProperties;

/** 31/36 Geist Serif 400, tracking -0.02em. The build title on the build page. Never bold. */
export const work = {
  fontFamily: SENTIENT,
  fontSize: roleVar("work", "size", "31px"),
  fontWeight: 400,
  lineHeight: roleVar("work", "leading", "36px"),
  letterSpacing: "-0.02em",
  textWrap: "balance",
} as const satisfies CSSProperties;

/** 15/20 Geist Serif 400. A build's name inside a "Rebuilt from" box, a compare
    column head, the credit line on Rebuild, a profile card's name in Followers. */
export const workName = {
  fontFamily: SENTIENT,
  fontSize: "15px",
  fontWeight: 400,
  lineHeight: "20px",
  letterSpacing: "0",
} as const satisfies CSSProperties;

/** 13/16 Geist 400, tabular digits. Meta lines: a model name, a time, a short fact.
    Not mono: only numbers are (see `monoLabel`). */
export const data = {
  fontFamily: roleVar("data", "font", FIGTREE),
  fontSize: roleVar("data", "size", "13px"),
  fontWeight: 400,
  lineHeight: roleVar("data", "leading", "16px"),
  letterSpacing: "0",
  fontVariantNumeric: "tabular-nums",
} as const satisfies CSSProperties;

/** 13/16 Geist 500. A field label or a chip: short, and never wrapping. */
export const label = {
  fontFamily: FIGTREE,
  fontSize: roleVar("label", "size", "13px"),
  fontWeight: 500,
  lineHeight: "16px",
  letterSpacing: "0",
} as const satisfies CSSProperties;

/** 20/24 Geist 600. A count or a headline number, tabular. */
export const figure = {
  fontFamily: FIGTREE,
  fontSize: roleVar("figure", "size", "20px"),
  fontWeight: 600,
  lineHeight: "24px",
  letterSpacing: "-0.01em",
  fontVariantNumeric: "tabular-nums",
} as const satisfies CSSProperties;

/** 13/16 Geist Mono. NUMBERS ONLY: counts in tables, step numbers, keyboard keys,
    character counts, XP figures, "1 of 3". Tabular digits. */
export const monoLabel = {
  fontFamily: DM_MONO,
  fontSize: "13px",
  fontWeight: 400,
  lineHeight: "16px",
  letterSpacing: "0",
  fontVariantNumeric: "tabular-nums",
} as const satisfies CSSProperties;

/** The static roles, by name. The floors are checked over this table. */
export const scale = {
  eyebrow,
  body,
  bodyLarge,
  cardTitle,
  sectionHead,
  hero,
  work,
  workName,
  data,
  label,
  figure,
  monoLabel,
} as const;

/* ── Sized roles ───────────────────────────────────────────────────────────
   Callers still say the size they once drew; `display(px)` and `mono(px)` land
   it on one of the five. */

export interface DisplayOptions {
  /** The lockup wordmark: Geist 600, -0.03em, line-height 1, any size. */
  lockup?: boolean;
  /** Kept for callers; every page heading now takes the same tracking. */
  mobilePageHeading?: boolean;
}

/** The smallest the lockup wordmark is ever rendered. */
export const LOCKUP_MIN_PX = 15;

/** The smallest size a heading was ever drawn at; `display()` refuses a smaller one. */
export const DRAWN_HEADING_MIN_PX = 17;

/** The smallest size the lockup wordmark was ever drawn at. */
export const DRAWN_LOCKUP_MIN_PX = 16;

/** The one of the five sizes a drawn heading size lands on: 30 and up is 31/36, 22 to 29 is 20/24, under 22 is 17/22. */
export function headingStep(px: number): { size: number; line: number } {
  if (px >= 30) return { size: 31, line: 36 };
  if (px >= 22) return { size: 20, line: 24 };
  return { size: 17, line: 22 };
}

/** A complete Geist heading role for a heading drawn at `px`, on one of the five sizes. Never serif; for a work use `work`. */
export function display(px: number, options: DisplayOptions = {}): CSSProperties {
  const { lockup = false } = options;
  const floor = lockup ? DRAWN_LOCKUP_MIN_PX : DRAWN_HEADING_MIN_PX;
  if (!(px >= floor) || !Number.isFinite(px)) {
    throw new RangeError(
      `type.display(${px}): a heading is never drawn under ${floor}px${
        lockup ? "" : ` (the lockup wordmark alone may go to ${DRAWN_LOCKUP_MIN_PX})`
      }.`,
    );
  }
  if (lockup) {
    return { fontFamily: FIGTREE, fontSize: `${Math.round(px * 0.94)}px`, fontWeight: 600, lineHeight: 1, letterSpacing: "-0.03em" };
  }
  const { size, line } = headingStep(px);
  return {
    fontFamily: FIGTREE,
    fontSize: `${size}px`,
    fontWeight: 600,
    lineHeight: `${line}px`,
    letterSpacing: size === 31 ? "-0.02em" : "-0.01em",
    textWrap: "balance",
  };
}

export interface MonoOptions {
  /** Retired with the eyebrow: accepted so callers compile, and ignored. No uppercase anywhere. */
  caps?: boolean;
}

/** A Geist Mono role, 13/16 at every size: numbers only. Tabular digits. */
export function mono(_px: number, _options: MonoOptions = {}): CSSProperties {
  return {
    fontFamily: DM_MONO,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: "16px",
    letterSpacing: "0",
    fontVariantNumeric: "tabular-nums",
  };
}

/**
 * The scale, by role. `type.body`, `type.sectionHead`, and so on.
 *
 * IMPORTING THIS INTO A FILE THAT ALREADY SAYS `type`: import the roles by
 * name instead (`import { cardTitle }`, or `data as dataText`).
 */
export const type = {
  ...scale,
  display,
  mono,
} as const;

export type TypeRole = keyof typeof scale;

/** The build editor's five type steps, in px, each one of the five sizes: 13 meta, 15 body, 17 a section heading, 20 a
    headline and the compact page title. Nothing in the editor is set below 13. The roles above are whole styles; these are sizes only, for the editor's
    own `text()` and `type()` recipes. */
export const textStep = { meta: 13, body: 15, section: 17, headline: 20, title: 20 } as const;

/** The five sizes, in px. Every font size the site sets is one of these: 31 a visible page title and the build title;
    20 a section head; 17 a group heading; 15 body, fields, buttons and nav; 13 meta, labels and chips. */
export const typeSize = { title: 31, section: 20, group: 17, body: 15, meta: 13 } as const;

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

/** Geist Serif is never emitted below this size: its smallest use is a work's name at 15. */
export const DISPLAY_MIN_PX = 15;

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
export function minPx(rawFontSize: string): number | null {
  const fontSize = fallbackOf(rawFontSize);
  const clamped = /^clamp\(\s*(-?[\d.]+)px\s*,/.exec(fontSize);
  if (clamped) return Number(clamped[1]);
  const plain = /^(-?[\d.]+)px$/.exec(fontSize);
  return plain ? Number(plain[1]) : null;
}

/** True when the style spends the family token for the job: the display face, or the UI face. */
const spends = (fontFamily: string, job: "display" | "ui") => fontFamily.trim().startsWith(`var(--font-${job}`);

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
  // The current look's value: a role's weight may be a var() with today's as its fallback.
  const rawWeight = typeof style.fontWeight === "string" ? fallbackOf(style.fontWeight) : style.fontWeight;
  const size = typeof style.fontSize === "string" ? minPx(style.fontSize) : null;
  const weight = Number(rawWeight ?? BODY_MIN_WEIGHT);

  if (spends(family, "display")) {
    if (size === null) {
      found.push(
        `${role}: the serif at a size this check cannot resolve (${String(style.fontSize)}); ` +
          `the serif needs a size provably at or above ${DISPLAY_MIN_PX}px.`,
      );
    } else if (size < DISPLAY_MIN_PX) {
      found.push(
        `${role}: the serif at ${size}px is below the ${DISPLAY_MIN_PX}px floor — ` +
          `it is for works only. Use Geist, or size up.`,
      );
    }
  }

  if (
    spends(family, "ui") &&
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

/** Every violation across the static roles. Empty when the table is legal. */
export function assertFloors(): string[] {
  return Object.entries(scale).flatMap(([role, style]) =>
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
