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
//   <h1 style={{ ...type.display(44), color: t.text }}>Builds worth running</h1>
//   <span style={{ ...type.mono(10, { caps: true }) }}>Maker</span>
//
// Spread it; do not pick fields out of it. A role that arrives half-applied —
// the size without the weight, the family without the line-height — is how a
// scale stops being one.
//
// THREE FACES, THREE JOBS. Sentient (500, self-hosted from /fonts) is display
// and nothing else: every heading. Figtree is body and UI. DM Mono is data:
// model names, cost, timestamps, change summaries, part labels, counts and
// eyebrows. Mono never sets long-form prose, and no role here mixes the jobs.
// Bodoni Moda, the display face before UI-P05, is retired.
//
// TWO FLOORS, ENFORCED BELOW RATHER THAN DOCUMENTED. Sentient is never emitted
// under 20px, and Figtree is never emitted under weight 400 at sizes below
// 18px. Both are hard rules in the theme: a display face loses its shape at
// small sizes, worst on the dark room, and a sub-400 weight at text size
// disappears into the ground. The one sanctioned exception is the lockup
// wordmark, which the reference draws at 15px in the footer; `display(16,
// { lockup: true })` is the only way to get it. `assertFloors` runs over the
// static role table at import time in dev, and the unit test runs it in CI, so
// a violation cannot reach a screen by being written down.
//
// THE DENSITY PASS (UI-P52, UI-P53). The kit was tightened by the table in
// `design/prompts/README-density.md`, and this scale follows it: every static
// role below is its old size through the table, and `display(px)` and
// `mono(px)` take the size the boards drew BEFORE the pass and render it
// through the table (`display(44)` is 33px), keeping that size's tracking and
// leading — which is exactly what the tightened kit draws. So every caller
// tightened without being edited. Sentient stays at 20px and up: a heading the
// table takes under 20 is set in Figtree 600 at the same size, which is why
// the floor rose from 17 to 20 here.

import type { CSSProperties } from "react";

import { denseFont } from "./density";

/* ── Families ──────────────────────────────────────────────────────────────
   Each stack falls back within its own job, so a face that fails to load
   degrades to something doing the same work rather than to the body face. */

/** Body and UI. */
export const FIGTREE =
  "'Figtree', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/** Display, 20px and up (15px only for the lockup wordmark). Loaded by the
 *  `@font-face` rules in src/index.css, weights 500 and 700. */
export const SENTIENT = "'Sentient', Georgia, 'Times New Roman', serif";

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
   which is why the short roles carry no `textWrap` at all.

   UI-P53: each size is its pre-pass size through the density table (16 → 15,
   13 → 12, 22 → 19, 48 → 36…). A `clamp()`'s preferred term is scaled with its
   bounds, so the role still renders the dense size at 1440 and at 390. */

/** 12px mono, uppercase. The small label above a section or a card.
    `mono(px, { caps: true })` is the same job at the reference's other sizes.
    12 is in the table's kept band (10–12), so the pass left it alone. */
export const eyebrow = {
  fontFamily: DM_MONO,
  fontSize: "12px",
  fontWeight: 500,
  lineHeight: 1.3,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
} as const satisfies CSSProperties;

/** 15px Figtree (16 before UI-P53). The default for prose and any text that wraps. */
export const body = {
  fontFamily: FIGTREE,
  fontSize: "15px",
  fontWeight: 400,
  lineHeight: 1.55,
  letterSpacing: "0",
  textWrap: "pretty",
} as const satisfies CSSProperties;

/** 16px Figtree (17 before UI-P53). Body copy that leads — a standfirst, a build's summary. */
export const bodyLarge = {
  fontFamily: FIGTREE,
  fontSize: "16px",
  fontWeight: 400,
  lineHeight: 1.55,
  letterSpacing: "0",
  textWrap: "pretty",
} as const satisfies CSSProperties;

/**
 * 19px Figtree 600. A card's title.
 *
 * FIGTREE 600 SINCE UI-P53, AND SENTIENT BEFORE IT. BG-P09 set the role in the
 * display face at a fixed 22px: a title under a picture has to win the reader's
 * eye by face, size and contrast, and Sentient at 22 did, clear of the display
 * floor. The density pass takes 22 to 19, which is under Sentient's floor of 20,
 * so the role keeps the size and changes the face — Figtree at 600, the weight
 * that still wins against a photograph at 19. Tracking, leading and balancing
 * are unchanged.
 */
export const cardTitle = {
  fontFamily: FIGTREE,
  fontSize: "19px",
  fontWeight: 600,
  lineHeight: 1.25,
  letterSpacing: "-0.01em",
  textWrap: "balance",
} as const satisfies CSSProperties;

/** 22–36px Sentient (30–48 before UI-P53). A section heading on a reading surface. */
export const sectionHead = {
  fontFamily: SENTIENT,
  fontSize: "clamp(22px, 2.7vw, 36px)",
  fontWeight: 500,
  lineHeight: 1.12,
  letterSpacing: "-0.01em",
  textWrap: "balance",
} as const satisfies CSSProperties;

/** 33–58px Sentient (44–78 before UI-P53). One per page, at most. */
export const hero = {
  fontFamily: SENTIENT,
  fontSize: "clamp(33px, 4.8vw, 58px)",
  fontWeight: 500,
  lineHeight: 1.05,
  letterSpacing: "-0.02em",
  textWrap: "balance",
} as const satisfies CSSProperties;

/** 12–13px mono (13–14 before UI-P53). Model names, cost, timestamps, change
    summaries, counts. Pair with `tabular` wherever the digits sit in a column.
    0.83vw keeps it at 12px at 1440, where the old role rendered 13. */
export const data = {
  fontFamily: DM_MONO,
  fontSize: "clamp(12px, 0.83vw, 13px)",
  fontWeight: 400,
  lineHeight: 1.45,
  letterSpacing: "0",
} as const satisfies CSSProperties;

/** 12px Figtree 500 (13 before UI-P53). A field label or a chip — short, and never wrapping. */
export const label = {
  fontFamily: FIGTREE,
  fontSize: "12px",
  fontWeight: 500,
  lineHeight: 1.3,
  letterSpacing: "0.01em",
} as const satisfies CSSProperties;

/** The eight static roles, by name. The floors are checked over this table;
    `display` and `mono` below are functions and are checked at the call. */
export const scale = {
  eyebrow,
  body,
  bodyLarge,
  cardTitle,
  sectionHead,
  hero,
  data,
  label,
} as const;

/* ── Sized roles ───────────────────────────────────────────────────────────
   Display and mono type are used at many sizes in the overhaul, and their
   tracking and leading depend on the size, so each is a function that returns a
   complete role. The bands are the reference's own.

   `px` IS THE SIZE THE BOARD DREW BEFORE UI-P52, and the role renders it through
   the density table. The bands stay keyed to that size because the tightened kit
   kept each heading's tracking and leading when it shrank it: a 52px heading is
   39px now and still −0.04em at 0.95. */

export interface DisplayOptions {
  /** The lockup wordmark: −0.03em, line-height 1, no balancing, Sentient at
   *  every size, and the one role allowed under the 20px floor. Drawn at 16,
   *  18, 19, 21, 34, 64 and 70 before the pass; rendered at 15, 15, 16, 18, 26,
   *  48 and 52 (the footer's is the smallest). */
  lockup?: boolean;
  /** A page heading on mobile drawn at 30–36px takes −0.035em instead of −0.03em. */
  mobilePageHeading?: boolean;
}

/** The smallest the lockup wordmark is ever rendered: the footer's, 16 → 15 in UI-P52. */
export const LOCKUP_MIN_PX = 15;

/** The smallest size a board drew a heading at. `display()` refuses a smaller one. */
export const DRAWN_HEADING_MIN_PX = 17;

/** The smallest size a board drew the lockup wordmark at (the footer's). */
export const DRAWN_LOCKUP_MIN_PX = 16;

/**
 * A complete display role for a heading the board drew at `px`, rendered at
 * `denseFont(px)`, with the reference's letter-spacing and line-height for the
 * drawn size's band:
 *
 *   52 and up   −0.04em   0.95
 *   44–51       −0.035em  1
 *   30–43       −0.03em   1    (−0.035em for a mobile page heading at 30–36)
 *   17–29       −0.02em   1.05
 *   lockup      −0.03em   1    at its own size
 *
 * Sentient 500 when it renders at 20px or more; Figtree 600 at the same size
 * when the table takes it under 20 (every heading drawn at 22 or less), since
 * Sentient is never set under its floor. The lockup is Sentient at every size.
 *
 * Throws for a size no board drew a heading at — under 17px, or 16 for the
 * lockup — rather than emitting it: that is not a heading, and the mistake
 * should fail where it is written.
 */
export function display(px: number, options: DisplayOptions = {}): CSSProperties {
  const { lockup = false, mobilePageHeading = false } = options;
  const floor = lockup ? DRAWN_LOCKUP_MIN_PX : DRAWN_HEADING_MIN_PX;
  if (!(px >= floor) || !Number.isFinite(px)) {
    throw new RangeError(
      `type.display(${px}): a heading is never drawn under ${floor}px${
        lockup ? "" : ` (the lockup wordmark alone may go to ${DRAWN_LOCKUP_MIN_PX})`
      }.`,
    );
  }
  const size = denseFont(px);

  const base = {
    fontFamily: lockup || size >= DISPLAY_MIN_PX ? SENTIENT : FIGTREE,
    fontSize: `${size}px`,
    fontWeight: lockup || size >= DISPLAY_MIN_PX ? 500 : 600,
  } as const;

  if (lockup) return { ...base, lineHeight: 1, letterSpacing: "-0.03em" };

  let letterSpacing: string;
  let lineHeight: number;
  if (px >= 52) {
    letterSpacing = "-0.04em";
    lineHeight = 0.95;
  } else if (px >= 44) {
    letterSpacing = "-0.035em";
    lineHeight = 1;
  } else if (px >= 30) {
    letterSpacing = mobilePageHeading && px <= 36 ? "-0.035em" : "-0.03em";
    lineHeight = 1;
  } else {
    letterSpacing = "-0.02em";
    lineHeight = 1.05;
  }
  return { ...base, lineHeight, letterSpacing, textWrap: "balance" };
}

export interface MonoOptions {
  /** An eyebrow: uppercase, .09em tracking, weight 500. Used at 10–12px. */
  caps?: boolean;
}

/**
 * A complete DM Mono role for type the board drew at `px`, rendered at
 * `denseFont(px)` (10–12 are kept, 13 → 12, 22 → 19, 40 → 30). Eyebrows
 * (`caps`) are uppercase with .09em tracking; data values carry no extra
 * tracking; a large number — drawn at 22px and up — takes −0.02em. Digits that
 * sit in a column also need `tabular`, which this role carries so a number
 * cannot be set without it.
 */
export function mono(px: number, options: MonoOptions = {}): CSSProperties {
  const { caps = false } = options;
  const base = {
    fontFamily: DM_MONO,
    fontSize: `${denseFont(px)}px`,
    lineHeight: 1.3,
    fontVariantNumeric: "tabular-nums",
  } as const;
  if (caps) {
    return { ...base, fontWeight: 500, letterSpacing: "0.09em", textTransform: "uppercase" };
  }
  return { ...base, fontWeight: 400, letterSpacing: px >= 22 ? "-0.02em" : "0" };
}

/**
 * The scale, by role. `type.body`, `type.sectionHead`, and so on.
 *
 * IMPORTING THIS INTO A FILE THAT ALREADY SAYS `type`. Two cases, both of
 * which the compiler catches and the bundler does not:
 *
 *   - the file declares its own `type` (a prop, a local), which shadows this
 *     one, so `type.cardTitle` reads a property off that value instead;
 *   - the file uses inline type-import modifiers (`import { type Foo }`),
 *     which a value binding called `type` makes ambiguous, and the imported
 *     types silently stop resolving.
 *
 * In either case import the roles by name — `import { cardTitle }`, or
 * `data as dataText` where the bare name would collide — rather than the
 * object. Every role below is exported individually for exactly this.
 */
export const type = {
  ...scale,
  display,
  mono,
} as const;

export type TypeRole = keyof typeof scale;

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

/** Sentient is never emitted below this size (the lockup wordmark aside).
    20 since UI-P53, when the density pass took the old 17px floor's headings
    under it; 17 before. */
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

  if (leadsWith(family, "Sentient")) {
    if (size === null) {
      found.push(
        `${role}: Sentient at a size this check cannot resolve (${String(style.fontSize)}); ` +
          `the display face needs a size provably at or above ${DISPLAY_MIN_PX}px.`,
      );
    } else if (size < DISPLAY_MIN_PX) {
      found.push(
        `${role}: Sentient at ${size}px is below the ${DISPLAY_MIN_PX}px display floor — ` +
          `the face loses its shape at this size, worst on Dusk. Use Figtree, or size up.`,
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
