// buildgallery.ai — the progress colour ladder. BG-P28b.
//
// THE DECISION THIS MODULE EXISTS TO RECORD.
//
// Seven token modules used to invent their own answer to "what colour is
// progress": `progress/gamification`, `progress/xp-kit`, `profile-game`,
// `streaks`, `skilltree`, `challenges/quest` and `ambient`. Between them they
// carried `#E8571A` for XP, `#2EC4B6` for reputation, `#F59E0B` for streaks,
// `#7C3AED` for one track, `#22C55E` for positive deltas and four more hues for
// badge tiers — eleven colours for one idea, none of which read
// `<html data-theme>`. This module is the single answer they now share.
//
// ── Why progress cannot simply pick a hue ──────────────────────────────────
//
// Every obvious candidate is already spoken for, and one colour means one
// thing:
//
//   the nine `--cat-*` hues  mean PART CATEGORIES. They route a gap to the
//                            right solver. Borrowing one for a level or a
//                            rarity tier makes a badge look like a data part.
//   `--action`               means "the primary thing to do".
//   `--evidence`             means "this worked" — reproduction, live state.
//
// That leaves `--lit`, the system's own light, which is where achievement
// naturally belongs. But `--lit` is amber, and amber measures **3.01:1 on the
// Exhibition ground** — below the 4.5:1 text floor and below the 3.0:1 UI floor
// for anything that carries state as a border.
//
// ── The resolution ─────────────────────────────────────────────────────────
//
// **Progress is carried by `--lit` as LIGHT, never as TYPE.** A level marker is
// an amber lamp, or an amber fill with `--on-lit` on it. It is never an amber
// word and never an amber state-carrying border on a light ground. Where
// progress needs a text colour it takes `--text` or `--text2` like every other
// surface in the product — see `xpText()`.
//
// Rarity and tier are then expressed by **weight and fill**, not by a rainbow,
// because the rainbow is taken. Three rungs, and only three:
//
//   common   outline        a hairline, no ground.
//   rare     `--recess`     an inset ground, still no light.
//   highest  `--lit` fill   the light itself, labelled `--on-lit`.
//
// von-Restorff is the whole reason the third rung is scarce: if four tiers each
// get a fill, none of them is memorable. One lit thing on the page is.
//
// ── What collapsed onto this ladder ────────────────────────────────────────
//
// `trophies/badge-data.ts` distinguished FOUR tiers by four hues
// (`--tier-bronze` … `--tier-platinum`). Those four custom properties were
// never defined in `index.css`, so every tier accent on that surface resolved
// to an invalid value and painted nothing — the rainbow was already broken,
// which is its own argument. `legacyTier()` below maps the four names onto the
// three rungs; the tier's NAME still renders as a label, so no rank is lost,
// only its private hue.
//
// The four skill TRACKS (Architect, Curator, Mentor, Explorer) collapse the
// same way and for the same reason — a track is not a part category, so it is
// named by its name and lit by `--lit` like every other progress marker.
//
// ── The collision check (BG-P28b acceptance 5), measured, not assumed ──────
//
// `--lit` is `#D9A441`, hue 39.1°. Against the 15° rule in `better-colors`:
//
//   vs `--action`   Exhibition `#9E4B2C` Δ22.8°  ·  Dusk `#D98C6B` Δ21.1°
//                   CLEAR in both rooms. This is the check the prompt names.
//   vs the nine category hues
//                   CLEAR against eight of nine in both rooms (Δ19.9°–178.8°).
//
// Two honest exceptions, neither introduced here:
//
//   `cat-artefact`  Δ13.1° on Exhibition, Δ1.0° on Dusk. A REAL hue collision,
//                   and a PRE-EXISTING property of the shipped token set —
//                   `--lit` and `--cat-artefact` were struck against each other
//                   long before this prompt and are already spent side by side.
//                   It is survivable because the two never occupy the same ROLE
//                   or the same SHAPE: `--cat-artefact` appears only as a part
//                   chip, resolved through `categoryColour()` onto its own
//                   measured `-fill` ground; `--lit` appears only as a lamp or
//                   as a fill carrying `--on-lit`. The ladder below deliberately
//                   keeps progress out of chip-shaped hue swatches so the reader
//                   is never asked to tell the two apart as peers. If a future
//                   surface ever puts an amber progress chip beside an artefact
//                   chip, that rule is broken and the collision becomes real.
//   `cat-narrative` Δ3.1° on Dusk only. Not a collision: `#A8A6A3` is a
//                   2.7%-saturation grey, and a hue angle on a near-grey is
//                   noise rather than a colour.
//
// ── Delivery ───────────────────────────────────────────────────────────────
//
// Every value below is a `var(--token)` reference or a constant, so a surface
// written with one follows the theme switch with no re-render — the same
// contract as `tokens.ts`. Nothing here resolves a hex.

import type { CSSProperties } from "react";

import { r } from "./radius";
import { t } from "./tokens";
import { DM_MONO, tabular } from "./type";

/* ── The three rungs ───────────────────────────────────────────────────── */

/**
 * The ladder, in order. The only vocabulary for rarity, tier and rank in this
 * product. A fourth rung is not available — add one and the third stops being
 * memorable, which is the only thing the third is for.
 */
export type ProgressTier = "common" | "rare" | "highest";

export const PROGRESS_TIERS = ["common", "rare", "highest"] as const;

/**
 * The four legacy badge-tier names, mapped onto the three rungs.
 *
 * Four does not divide into three, so `silver` and `gold` share the middle
 * rung. That is deliberate rather than a rounding error: the top rung is the
 * scarce one, and spending it on both gold and platinum would double the amount
 * of amber on a trophy cabinet and halve what it is worth. The tier's own label
 * ("GOLD", "PLATINUM") still renders beside the mark, so the rank is legible —
 * it simply is not carried by a private colour any more.
 */
export type LegacyTier = "bronze" | "silver" | "gold" | "platinum";

const LEGACY_TIER_RUNG: Record<LegacyTier, ProgressTier> = {
  bronze: "common",
  silver: "rare",
  gold: "rare",
  platinum: "highest",
};

/** `"gold"` → `"rare"`. Unknown or absent tiers fall to the bottom rung. */
export function legacyTier(tier: string | null | undefined): ProgressTier {
  if (!tier) return "common";
  return LEGACY_TIER_RUNG[tier as LegacyTier] ?? "common";
}

/* ── tierFill ──────────────────────────────────────────────────────────── */

/**
 * The ground, border and label colour for one rung of the ladder.
 *
 * Spend it on the whole mark — a badge tile, a rarity chip, a skill-tree node —
 * rather than picking one property off it, because the three properties are a
 * measured set: `highest` is only legal because its label is `--on-lit`
 * (7.29:1 on Exhibition), and a caller that takes the background without the
 * colour gets amber-on-amber.
 *
 * Border width is fixed at 1px across all three rungs on purpose. A rung that
 * also changed its border width would move every fixed-height mark on the
 * surface by a pixel when its state changed, and BG-P28b is a repaint.
 */
export function tierFill(tier: ProgressTier): CSSProperties {
  switch (tier) {
    case "highest":
      return {
        background: t.lit,
        color: t.onLit,
        borderColor: t.lit,
        borderWidth: 1,
        borderStyle: "solid",
      };
    case "rare":
      return {
        background: t.recess,
        color: t.text,
        borderColor: t.line,
        borderWidth: 1,
        borderStyle: "solid",
      };
    case "common":
    default:
      return {
        background: "transparent",
        color: t.text2,
        borderColor: t.line,
        borderWidth: 1,
        borderStyle: "solid",
      };
  }
}

/**
 * The same ladder for a mark that is not yet earned. One step quieter than
 * `common` in every room: no ground, a hairline, and secondary text. Locked is
 * a STATE rather than a fourth rung — it says "not yet", not "lowest".
 */
export function lockedFill(): CSSProperties {
  return {
    background: "transparent",
    color: t.text2,
    borderColor: t.line,
    borderWidth: 1,
    borderStyle: "solid",
    opacity: 0.6,
  };
}

/* ── levelLamp ─────────────────────────────────────────────────────────── */

/**
 * An amber lamp: the one legal way to say "progress" with colour.
 *
 * It is a FILLED MARK, never type and never a state-carrying border, which is
 * what keeps it legal on Exhibition where amber measures 3.01:1. The plaque's
 * freshness lamp is the same object at the same size, so a level marker and a
 * freshness lamp agree by construction.
 *
 * `dim` is the plaque's stale state: the lamp drops to 45% rather than changing
 * colour, because a dimmer light is still a light and a different hue would be
 * a different claim.
 */
export function levelLamp(opts?: { size?: number; dim?: boolean }): CSSProperties {
  const size = opts?.size ?? 8;
  return {
    width: size,
    height: size,
    borderRadius: r.full,
    background: t.lit,
    opacity: opts?.dim ? 0.45 : 1,
  };
}

/**
 * The unfilled remainder of a progress bar or ring — the groove the light sits
 * in. A hairline colour rather than a ground: on Exhibition a white-alpha track
 * simply vanishes, and on Dusk a ground-coloured one swallows the arc.
 */
export function progressTrack(): CSSProperties {
  return { background: t.line };
}

/** The filled portion of any progress bar or ring. The light itself. */
export function progressFill(): CSSProperties {
  return { background: t.lit };
}

/* ── The glow, and the one place it is legal ───────────────────────────── */

/**
 * A glow needs darkness to glow against.
 *
 * On Dusk an achievement mark may carry a low-alpha amber radial behind a solid
 * mark. On Exhibition the same radial has nothing to glow against and reads as
 * a sticker adhered to a light grey wall, so it is simply absent — the mark is
 * solid amber and carries itself.
 *
 * TWO TREATMENTS, ONE COMPONENT. Callers pass the RESOLVED theme from
 * `useTheme()` rather than deciding by media query, because the theme is an
 * attribute the visitor controls and `prefers-color-scheme` is not it.
 * Returns `undefined` on Exhibition so a caller can spread it unconditionally.
 */
export function progressGlow(
  resolved: "exhibition" | "dusk",
  opts?: { radius?: number; alpha?: number },
): CSSProperties | undefined {
  if (resolved !== "dusk") return undefined;
  const radius = opts?.radius ?? 22;
  const alpha = opts?.alpha ?? 0.3;
  return {
    background: `radial-gradient(circle at 50% 50%, color-mix(in srgb, ${t.lit} ${Math.round(
      alpha * 100,
    )}%, transparent) 0%, transparent 70%)`,
    width: radius * 2,
    height: radius * 2,
    borderRadius: r.full,
  };
}

/* ── xpText ────────────────────────────────────────────────────────────── */

/**
 * The type an XP figure is set in. **Never amber** — that is the whole rule.
 *
 * XP is data: a count that changes and aligns in columns, so it is DM Mono with
 * tabular numerals, coloured `--text` or `--text2` like every other number in
 * the product. The amber belongs to the FILL BEHIND a figure, never to the
 * figure — `tierFill("highest")` already pairs `--lit` with `--on-lit`, and a
 * caller that wants a lit XP chip spreads that and lets `xpText` supply only
 * the face and the numerals.
 *
 * `emphasis: "onLit"` is for exactly that case: a figure sitting ON an amber
 * fill, which takes `--on-lit` and is still not amber type.
 */
export function xpText(
  emphasis: "primary" | "secondary" | "onLit" = "primary",
): CSSProperties {
  return {
    fontFamily: DM_MONO,
    ...tabular,
    color:
      emphasis === "onLit" ? t.onLit : emphasis === "secondary" ? t.text2 : t.text,
  };
}

/* ── The assertion the rule is worth ───────────────────────────────────── */

/**
 * Every token this module will ever put on a progress surface as TEXT.
 *
 * `--lit` is deliberately absent, and its absence is the invariant BG-P28b's
 * DOM sweep on `/analytics` checks from the other side. Exported so the check
 * has one list to read rather than a hard-coded copy that can drift.
 */
export const LEGAL_PROGRESS_TEXT_TOKENS = [
  "--text",
  "--text2",
  "--on-lit",
  "--on-action",
] as const;
