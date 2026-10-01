// Editorial numbers: targets the product owner sets, not figures the code derives.

/**
 * How many reproductions the community aims for in a week.
 *
 * AN EDITORIAL NUMBER FOR THE PRODUCT OWNER TO SET. It is null on purpose: no
 * target has been chosen, and inventing one would put a made-up denominator on
 * the Gallery header. While it is null the Gallery shows the week's count and a
 * bar at the fraction of last week's count instead of "/ goal" (UI-P28). Set it
 * to a whole number and the "/ goal" form takes over; nothing else changes.
 */
export const WEEKLY_REPRODUCTION_GOAL: number | null = null;
