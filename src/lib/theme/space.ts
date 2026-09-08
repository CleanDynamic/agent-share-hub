// buildgallery.ai — the spacing scale.
//
// Seven steps: 8 / 16 / 24 / 40 / 64 / 96 / 132. The scale is binding; a value
// between two steps is not a finer judgement, it is a step nobody can reuse.
//
// The steps are not a geometric ramp and are not meant to be one. 8→16→24 walk
// in eights because that is the range where a difference of 8px is the whole
// difference between two elements reading as one group or two; 40→64→96→132
// open up because at page scale a difference of 8px is invisible and the
// decisions being made are "these are separate sections", not "these are
// separate lines".
//
// WHAT A STEP IS FOR, not what it measures. Following `spacing-system`: pick the
// step by the RELATIONSHIP being expressed, never by measuring the gap you want
// in a mockup. Two things inside one control are `xs` apart because they are one
// thing; two sections are `xl` apart because they are not.
//
// THE ONE HARD RULE, from the spec: a card's internal padding may never exceed
// the gap to the card's neighbour. Break it and the grid inverts — the eye
// groups across the gap instead of within the card, and a row of cards reads as
// one wide band of content rather than as separate objects. `assertPadding`
// below is that rule, for the tests of rebuilt components.
//
// UNITS. Numbers, not strings. React writes a bare number into a pixel value for
// every property in this scale's range, and a number is what arithmetic on a
// scale step needs. Where a string is wanted, `px()` gives it.
//
// STRUCTURAL PROPERTIES ARE NOT REPAINTABLE. Padding, margin and gap change
// layout, so applying a step to an element that already has one is a rebuild,
// not a repaint (see `neoscale-ui`). This module defines the scale; it does not
// license changing the spacing of a surface that already ships.

/**
 * The scale, by role.
 *
 * `SPACE[2]` does not exist and is not wanted — the names are the point. A gap
 * chosen as "sm" survives a redesign that moves what sm measures; a gap chosen
 * as 16 does not.
 */
export const SPACE = {
  /**
   * 8 — inside one object. The gap between an icon and its label, a chip and
   * the chip beside it, two lines of a single stacked field. Anything closer
   * than this is one element with letter-spacing, not two elements.
   */
  xs: 8,
  /**
   * 16 — between sibling elements in one group. Rows of a list, fields of a
   * form, a card's internal padding at the small end. The default when two
   * things belong together and nothing argues for more.
   */
  sm: 16,
  /**
   * 24 — between groups inside one surface. A card's padding at the roomy end,
   * the gap between a heading and the block it heads, the gutter of a grid of
   * cards. The largest step that still reads as "inside".
   */
  md: 24,
  /**
   * 40 — between distinct blocks on a page. A card and the next card down, a
   * form and the actions under it, the gap that says "this is over, here is the
   * next thing" without starting a new section.
   */
  lg: 40,
  /**
   * 64 — between sections of a page. The step at which a heading stops needing
   * a rule above it to be read as a new section.
   */
  xl: 64,
  /**
   * 96 — between the pivotal sections of a reading surface. A landing page's
   * acts, the space above a page's one primary call to action. Earned by
   * importance, not spent evenly: a page where everything is 96 apart has
   * nothing that is pivotal.
   */
  "2xl": 96,
  /**
   * 132 — the top and tail of a page, and the space around a hero. One or two
   * uses per page at most. The only step large enough to be a silence.
   */
  "3xl": 132,
} as const;

export type SpaceName = keyof typeof SPACE;

/** The seven names, smallest first. */
export const SPACE_NAMES = Object.keys(SPACE) as SpaceName[];

/** The seven values, smallest first. */
export const SPACE_STEPS = SPACE_NAMES.map((n) => SPACE[n]);

/** `space.md` → `"24px"`, for the properties that want a string. */
export const px = (step: number): string => `${step}px`;

/** True when `value` is one of the seven steps. */
export const isSpaceStep = (value: number): boolean => SPACE_STEPS.includes(value as never);

/**
 * The spec's rule, as an assertion: a card's internal padding may never exceed
 * the gap to its neighbour.
 *
 * Returns `null` when the pair is legal, and the reason when it is not, so a
 * test can assert on the message rather than on a bare boolean:
 *
 *   expect(assertPadding(SPACE.md, SPACE.lg)).toBeNull();
 *
 * EQUAL IS LEGAL, and deliberately so. At padding === gap the card's inside and
 * its outside are the same distance, which is the boundary case the eye reads as
 * neutral; past it the grouping inverts and the row of cards reads as one band.
 * The rule is "never exceed", not "always less".
 *
 * Both arguments are pixel numbers rather than scale names, because the gap a
 * card actually sits in is frequently not a scale step — a grid gutter, a
 * flex `gap` inherited from a parent — and the rule still applies to it.
 */
export function assertPadding(padding: number, gap: number): string | null {
  if (!Number.isFinite(padding) || !Number.isFinite(gap)) {
    return `padding and gap must both be finite pixel values, got ${padding} and ${gap}`;
  }
  if (padding < 0 || gap < 0) {
    return `padding and gap must both be non-negative, got ${padding} and ${gap}`;
  }
  if (padding > gap) {
    return (
      `card padding ${padding}px exceeds the ${gap}px gap to its neighbour: ` +
      `the eye groups across the gap instead of within the card, so a row of ` +
      `cards reads as one band. Reduce the padding or open the gap.`
    );
  }
  return null;
}
