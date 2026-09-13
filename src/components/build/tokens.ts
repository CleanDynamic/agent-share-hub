// Design tokens for the public build page (/b2/:slug).
//
// @deprecated BG-P21. SUPERSEDED BY `src/lib/theme/tokens.ts`, `radius.ts` and
// `type.ts`. Nothing new may import this module.
//
// REPOINTED, NOT REWRITTEN, AND NOT DELETED. Every export below used to be a
// hex or a white-alpha string struck for a single dark room: `#08080C` ground,
// `#E8571A` orange, `rgba(255,255,255,0.90)` ink. Roughly eighty files import
// them — the whole build page, the whole compose workspace, the bounty panels
// and three routes — and repainting eighty files by hand is eighty chances to
// miss one. So each constant KEEPS ITS NAME and changes its VALUE to the
// `var(--token)` the two-theme system already publishes. One edit, and every
// importer follows `<html data-theme="…">` from the next paint.
//
// That is also why the module survives this prompt. Deleting it is a separate
// change from ceasing to be the source of a colour, and it is BG-P29's:
// the names here are now aliases, and an alias that resolves correctly is not
// urgent to remove. It is only urgent not to add to.
//
// THE NAMES LIE NOW, WHICH IS THE PRICE OF THE ALIAS. `ORANGE` is the action
// token, which is burnt orange on Exhibition and salmon on Dusk; `TEAL` is the
// evidence token, which is teal on Exhibition and sky on Dusk; `VOID` is the
// page ground, which is a luminous grey in the light room. Read every name
// below as the JOB it does rather than as the colour it was.
//
// These live as plain objects rather than CSS classes on purpose: Tailwind's
// generated utilities win over hand-written classes at build time, so every
// surface on this route is styled with inline style={{ }}.

import type { CSSProperties } from "react";

import { GLASS_BLUR } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

/** The page ground. Was `#08080C`; a light room has no void in it. */
export const VOID = t.bg;
/** The primary action. Was `#E8571A` in both rooms; now theme-dependent. */
export const ORANGE = t.action;
/** Reproduction, "it worked", live states. Was `#2EC4B6`. */
export const TEAL = t.evidence;

export const TEXT_PRIMARY = t.text;
export const TEXT_SECONDARY = t.text2;
/**
 * The third rung of the ramp, COLLAPSED ONTO THE SECOND.
 *
 * It was `rgba(255,255,255,0.28)` — 3.0:1 on the old ground at best, and below
 * the 4.5:1 text floor in both of the rooms that replaced it. The two-theme
 * system publishes two text tokens, not three, because the third rung was
 * never a legal one: a label nobody can read is not a quieter label. Callers
 * keep the name and get `--text2`, which is what they should have had.
 */
export const TEXT_MUTED = t.text2;
export const HAIRLINE = t.line;

/** breakage / gap. Also the left border on a node flagged is_gap. */
export const GAP_RED = t.catBreakage;

/** BG-P03 moved the body face to Figtree; this is that stack, by its own name. */
export const FONT_STACK = FIGTREE;

/**
 * @deprecated BG-P05. SUPERSEDED BY `categoryColour` IN src/lib/theme/category.ts.
 *
 * Every one of these hexes has been repointed at a `--cat-*` token, and every
 * consumer that read this map — or read `node_types.colour`, which holds the
 * same values — now calls `categoryColour(row.category)` instead. The stored
 * column and this map are both left in place: the column because a migration is
 * out of scope here, this map because deleting it is a separate change from
 * ceasing to read it. Neither is the source of a colour any more.
 *
 * BG-P21 finished the repointing the note above described: the values are the
 * nine `--cat-*` tokens now rather than the hexes they were measured against.
 * `agent` and `gap` stay as the spellings this map already had — the resolver
 * treats them as aliases of `agents` and `breakage`, and this map agrees with
 * it rather than inventing a tenth and eleventh hue.
 *
 * Nothing new may read this. Add a category to `CATEGORIES` in
 * `src/lib/theme/category.ts` — or let it fall to `--cat-fallback`, which is
 * what the nine-hue system does with a meaning it has no hue for.
 */
export const CATEGORY_COLOUR: Record<string, string> = {
  instruction: t.catInstruction,
  configuration: t.catConfiguration,
  data: t.catData,
  artefact: t.catArtefact,
  evidence: t.catEvidence,
  narrative: t.catNarrative,
  agent: t.catAgents,
  breakage: t.catBreakage,
  gap: t.catBreakage,
  media: t.catMedia,
};

/**
 * A colour at an alpha. Hex in, `rgba()` out; token in, `color-mix()` out.
 *
 * THE SECOND BRANCH IS WHAT KEEPS THE REPOINT HONEST. Forty-one call sites ask
 * for a tint of one of the constants above — `hexToRgba(TEAL, 0.06)` for the
 * ground under a solved row, `hexToRgba(GAP_RED, 0.35)` for a gap's border.
 * Those constants are `var(--token)` strings now, so the hex branch cannot
 * match them, and the old `return hex` fallback would have handed every one of
 * those call sites the hue AT FULL STRENGTH: a 6% wash becomes a solid teal
 * panel with unreadable text on it. `color-mix(in srgb, var(--x) 6%,
 * transparent)` is the same 6% wash, resolved by the browser after the theme
 * has decided what `--x` is — which a value computed in JavaScript never could.
 *
 * The hex branch stays because `node_types.colour` still holds hexes and a few
 * callers still pass one straight in. Anything that is neither returns
 * unchanged, exactly as before.
 */
export function hexToRgba(colour: string, alpha: number): string {
  const input = colour ?? "";

  const match = /^#?([0-9a-f]{6})$/i.exec(input);
  if (match) {
    const int = parseInt(match[1], 16);
    const red = (int >> 16) & 255;
    const green = (int >> 8) & 255;
    const blue = int & 255;
    return `rgba(${red},${green},${blue},${alpha})`;
  }

  if (/^var\(--[a-z0-9-]+\)$/i.test(input.trim())) {
    // Clamped and rounded to a tenth of a percent: `color-mix` rejects a
    // negative or >100 percentage outright, and an unrounded float prints
    // sixteen digits into the style attribute for no gain.
    const percent = Math.round(Math.min(Math.max(alpha, 0), 1) * 1000) / 10;
    return `color-mix(in srgb, ${input.trim()} ${percent}%, transparent)`;
  }

  return colour;
}

/**
 * A panel. The ONE blurred surface this module publishes.
 *
 * The blur was `40px saturate(180%)`, chosen by eye. The theme has exactly one
 * blur value — 16px, saturate 1.15 — and no smaller one to save cost, so this
 * is that value by its own name rather than a second copy of it.
 */
export const panelGlass: CSSProperties = {
  background: t.glass,
  backdropFilter: GLASS_BLUR,
  WebkitBackdropFilter: GLASS_BLUR,
  border: `1px solid ${t.glassBorder}`,
};

/**
 * A card, an inset group, a row. `--glass-2` and NO BLUR OF ITS OWN.
 *
 * It never had one, and it must not acquire one here: these surfaces sit inside
 * panels that are blurred, and a blurred child of a blurred parent is the
 * stacked compositing the theme forbids by name. `--glass-2` is the token for
 * the inset tier, and it lightens what is behind it, which is the whole of the
 * effect a surface this size can show. Radius moves 12 → `--r-card`, because
 * the scale puts a card at 14 and this object is the card.
 */
export const cardGlass: CSSProperties = {
  background: t.glass2,
  border: `1px solid ${t.glassBorder}`,
  borderRadius: r.card,
};

/**
 * WEIGHT 300 IS GONE FROM THIS FILE (BG-P21).
 *
 * The theme's second floor is hard: below 18px, Figtree is never emitted under
 * weight 400, because a sub-400 weight at text size disappears into the ground.
 * `bodyText` was 13/300 and `labelText` inherited 500, so exactly one role
 * breached it — and it is the role that sets most of the prose on three
 * routes. The size is left alone: 13px is this workspace's density and moving
 * it would reflow eighty files, which a repoint may not do. The weight is not
 * a layout property, and it is the half of the pairing the floor names.
 */
export const bodyText: CSSProperties = {
  fontSize: 13,
  fontWeight: 400,
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
