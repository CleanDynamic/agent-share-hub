// buildgallery.ai — the colour contract, measured.
//
// This file recomputes the contrast of every pairing the theme promises from the
// token values actually declared in `semantics.ts` (the refined look's, the only
// one since UI-P99), so a value edited there without remeasuring fails here
// rather than shipping.
//
// WCAG 2.x relative luminance and contrast, implemented locally — a dependency
// for twenty lines of arithmetic is not worth the install. Translucent tokens
// (Dusk's `evidence-fill`) are composited over the surface they sit on before
// measuring, because a ratio against an rgba() string is not a thing that exists.

import { describe, expect, it } from "vitest";
import type { TokenName } from "./semantics";
import { resolveToken as resolveRefined, type ThemeKey } from "./resolve";
import { MAP_ARTWORK } from "@/pages/site/compose/mapArtwork";
import { contrast, luminance, over, parse } from "./luminance";

/* ── measurement ──────────────────────────────────────────────────────────── */

// CA-06 P4: the maths lives in luminance.ts now, so a link's fill can be chosen with it at run time.
const round = (n: number) => Math.round(n * 100) / 100;

const TEXT_FLOOR = 4.5;
const UI_FLOOR = 3.0;

const CATEGORIES: TokenName[] = [
  "cat-instruction",
  "cat-configuration",
  "cat-data",
  "cat-artefact",
  "cat-evidence",
  "cat-narrative",
  "cat-agents",
  "cat-breakage",
  "cat-media",
];


/* ── the password strength meter's three colours (BG-P27) ─────────────────── */
//
// `--cat-breakage` / `--cat-artefact` / `--evidence` LOOK like a traffic light
// and are not one: they are three of the nine part-category hues doing a second,
// legitimate job. That is what makes them measurable, and this is the
// measurement — the ramp they replaced was `#ef4444 / #f59e0b / #2EC4B6`, picked
// by eye, of which the amber measures 2.28:1 on Noon's ground.
//
// ON THE CARD, NOT ON THE PAGE. The meter sits inside an auth card, which is
// `--glass` over `--bg`, so the ground under it is the composite rather than the
// room. The category floors above already hold each hue against `--bg`; these
// hold the three against the surface they are actually painted on, in both
// rooms, because a hue that clears the floor on the page and fails on the card
// fails where a reader is looking. Noon's card LIGHTENS the ground and
// Dusk's DARKENS it, so neither room's figure can be inferred from the other.
//
// The `backdrop-filter` is not modelled, for the reason the glass divergences
// above record: it blurs what is behind the card rather than tinting it, and
// behind an auth card is one flat token plus AuthShell's ≤10% wash.
describe("the password strength meter", () => {
  const METER: TokenName[] = ["cat-breakage", "cat-artefact", "evidence"];

  /** The auth card's ground: `--glass` composited over the room. */
  const card = (theme: ThemeKey) => resolveRefined(theme, "module");

  it.each(
    (["noon", "dusk"] as const).flatMap((theme) =>
      METER.map((token) => ({ theme, token })),
    ),
  )("$theme reads $token as a label on the auth card", ({ theme, token }) => {
    const actual = round(contrast(resolveRefined(theme, token), card(theme)));
    // Noon's artefact hue measures 3.97 on a card, the same shortfall the category block below pins: it is a ratchet,
    // and it may rise, never fall.
    if (theme === "noon" && token === "cat-artefact") {
      expect(actual, `${theme} ${token} is ${actual}:1 on the auth card`).toBeGreaterThanOrEqual(3.97);
      expect(actual, `${theme} ${token} now reaches ${TEXT_FLOOR}: remove this exception`).toBeLessThan(TEXT_FLOOR);
      return;
    }
    expect(
      actual,
      `${theme} ${token} is ${actual}:1 on the auth card, under the text floor`,
    ).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });

  it.each(
    (["noon", "dusk"] as const).flatMap((theme) =>
      METER.map((token) => ({ theme, token })),
    ),
  )("$theme separates a filled $token segment from the track", ({ theme, token }) => {
    // The FILLED-against-UNFILLED step is what carries the reading, so it is
    // floored at 3.0:1 as UI state. The track itself is `--recess` and is
    // deliberately quiet against the card — it is the bar's extent, not its
    // value.
    const actual = round(contrast(resolveRefined(theme, token), resolveRefined(theme, "recess")));
    expect(
      actual,
      `${theme} ${token} is ${actual}:1 against the --recess track`,
    ).toBeGreaterThanOrEqual(UI_FLOOR);
  });
});

/* ── the colour contract ──────────────────────────────────────────────────────
   The theme blocks in src/index.css, measured from semantics.ts. Translucent
   fills (Dusk's evidence-fill) are composited over the card they sit on. */

describe("the colour contract", () => {
  const resolved = (theme: ThemeKey, name: string) => resolveRefined(theme, name);
  const paint = (theme: ThemeKey, name: string, on: string) => {
    const value = resolved(theme, name);
    return parse(value)[3] === 1 ? value : over(value, resolved(theme, on));
  };
  const ratio = (theme: ThemeKey, fg: string, bg: string, floorGround = bg) =>
    contrast(resolved(theme, fg), paint(theme, bg, floorGround));

  const GROUNDS = ["surface", "module", "tile", "well", "frame"];
  const cases: Array<[ThemeKey, string, string]> = [];
  for (const theme of ["noon", "dusk"] as const) {
    for (const fg of ["text", "text2", "label"]) for (const bg of GROUNDS) cases.push([theme, fg, bg]);
  }

  it.each(cases)("%s: %s on %s is at least 4.5:1", (theme, fg, bg) => {
    expect(round(ratio(theme, fg, bg))).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });

  it.each(["noon", "dusk"] as const)("%s: evidence on evidence-fill, on a card and on the surface", (theme) => {
    for (const on of ["module", "surface"]) {
      expect(round(contrast(resolved(theme, "evidence"), paint(theme, "evidence-fill", on)))).toBeGreaterThanOrEqual(TEXT_FLOOR);
    }
  });

  it.each(["noon", "dusk"] as const)("%s: the filled pairs read", (theme) => {
    for (const [fg, bg] of [["on-action", "action"], ["on-pill", "pill"], ["on-tag", "tag-fill"]]) {
      expect(round(ratio(theme, fg, bg)), `${fg} on ${bg}`).toBeGreaterThanOrEqual(TEXT_FLOOR);
    }
  });

  /* UI-P79 asks every `cat-*` to reach 4.5:1 on `module` AND to use the values
     it lists, "exactly as written". Four of Noon's nine cannot do both: measured
     on #FAFAFA, cat-instruction is 3.98, cat-artefact 3.97, cat-configuration
     4.20 and cat-media 4.42. The values are kept as the prompt gives them and
     the shortfall is pinned here at what was measured (a ratchet: it may rise,
     never fall), not hidden and not quietly passed. They are above the 3.0 UI
     floor, which is what a chip's mark and edge need; text in these hues must
     sit on the `cat-*-fill` pairing or be darkened by a later prompt. Dusk's
     nine all pass 4.5. */
  const NOON_BELOW_TEXT_FLOOR: Record<string, number> = {
    "cat-instruction": 3.98,
    "cat-artefact": 3.97,
    "cat-configuration": 4.2,
    "cat-media": 4.42,
  };

  it.each(["noon", "dusk"] as const)("%s: each category hue on module", (theme) => {
    for (const cat of CATEGORIES) {
      const measured = round(ratio(theme, cat, "module"));
      const pinned = theme === "noon" ? NOON_BELOW_TEXT_FLOOR[cat] : undefined;
      if (pinned === undefined) {
        expect(measured, `${cat} on module`).toBeGreaterThanOrEqual(TEXT_FLOOR);
      } else {
        expect(measured, `${cat} on module is pinned below ${TEXT_FLOOR}`).toBeGreaterThanOrEqual(pinned);
        expect(measured, `${cat} now reaches ${TEXT_FLOOR}: remove it from NOON_BELOW_TEXT_FLOOR`).toBeLessThan(TEXT_FLOOR);
      }
    }
  });
});

/* ── CA-03 P2: the lines inside a Map box ─────────────────────────────────── */

describe("the lines inside a Map box, on the box's own fill", () => {
  /* A box's fill is artwork (`mapArtwork.ts`), not a token: Noon's is flat, Dusk's a shade from one value to another.
     Each line is measured against every value its fill passes through. Its title is `--text`; every other line in an
     agent's or a team's box is `--text2` (CA-03), never `--label`. */
  const fills = (theme: ThemeKey): string[] => {
    const paint = String(MAP_ARTWORK[theme].box.background);
    return paint.match(/#[0-9a-f]{6}/gi) ?? [];
  };

  it.each(["noon", "dusk"] as const)("%s: the title and every other line reach 4.5:1", (theme) => {
    expect(fills(theme).length).toBeGreaterThan(0);
    for (const fill of fills(theme)) {
      for (const ink of ["text", "text2"]) {
        expect(round(contrast(resolveRefined(theme, ink), fill)), `${ink} on ${fill}`).toBeGreaterThanOrEqual(TEXT_FLOOR);
      }
    }
  });
});
