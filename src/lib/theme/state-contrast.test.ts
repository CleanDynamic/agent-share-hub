/* BG-P30 — the two measurements the contract does not publish.
 *
 * `contrast.test.ts` recomputes the pairings the buildgallery-theme skill
 * publishes, so a value edited in `semantics.ts` without remeasuring fails
 * there. `category.test.ts` measures each of the nine hues as CHIP TEXT on its
 * own fill. Neither covers the other two jobs the hues do, or the state
 * colours, and this prompt's audit asks for both by name:
 *
 *   the nine hues  as a BORDER and as a LEFT EDGE, in both rooms
 *   state colours  focus ring, error text and border, the evidence fill pair,
 *                  the dashed gap edge, the unread marker, disabled text
 *
 * A BORDER AND A LEFT EDGE ARE ONE MEASUREMENT AND THREE GROUNDS. Both are the
 * same 3.0:1 non-text floor and the same arithmetic; what differs is what they
 * are drawn against, and a hue that clears the floor on the page ground can
 * fail on a recess or on a card. So each hue is measured against all three
 * grounds a part actually sits on: `--bg`, `--recess`, and the card composite
 * (thread over frame over ground), which is where a gap edge on a build card
 * lands.
 *
 * WHY THE FLOOR IS 3.0 AND NOT 4.5. A border is not text. WCAG 1.4.11 floors
 * the visual information required to identify a component or its state at
 * 3.0:1, and a category edge is exactly that: it says which kind of part this
 * is. The same hue AS TEXT is floored at 4.5 and is measured in
 * `category.test.ts` against the fill it is paired with, which is the only
 * ground the theme sanctions for it.
 *
 * THE ARITHMETIC IS LOCAL, as it is in `contrast.test.ts` and
 * `category.test.ts`. Three copies of twenty lines of WCAG luminance is a
 * deliberate trade this codebase already made — the alternative is a shared
 * module that every future prompt has to be told about, for arithmetic that has
 * not changed since 2008.
 */

import { describe, expect, it } from "vitest";
import { dusk, noon, type TokenName } from "./semantics";

/* ── measurement ──────────────────────────────────────────────────────────── */

type Rgba = [number, number, number, number];

function parse(colour: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(colour.trim());
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgb = /^rgba?\(([\d.]+),([\d.]+),([\d.]+)(?:,([\d.]*))?\)$/.exec(colour.replace(/\s/g, ""));
  if (!rgb) throw new Error(`unparseable colour: ${colour}`);
  return [+rgb[1], +rgb[2], +rgb[3], rgb[4] === undefined ? 1 : +rgb[4]];
}

function over(fg: string, bg: string): string {
  const f = parse(fg);
  const b = parse(bg);
  const [r, g, bl] = [0, 1, 2].map((i) => Math.round(f[i] * f[3] + b[i] * (1 - f[3])));
  return `rgb(${r},${g},${bl})`;
}

function luminance(colour: string): number {
  const [r, g, b, a] = parse(colour);
  if (a !== 1) throw new Error(`luminance needs an opaque colour, got ${colour}`);
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

const THEMES = { noon, dusk } as const;
type ThemeKey = keyof typeof THEMES;
const ROOMS = ["noon", "dusk"] as const;

/** A token's rendered colour: itself, or itself over the room's ground. */
function value(theme: ThemeKey, token: TokenName): string {
  const raw = THEMES[theme][token];
  return parse(raw)[3] === 1 ? raw : over(raw, THEMES[theme].bg);
}

/** The four grounds this product actually paints a part or a state onto. */
function grounds(theme: ThemeKey): Record<string, string> {
  const frame = over(THEMES[theme]["card-frame"], THEMES[theme].bg);
  return {
    bg: THEMES[theme].bg,
    recess: THEMES[theme].recess,
    glass: over(THEMES[theme].glass, THEMES[theme].bg),
    card: over(THEMES[theme]["card-thread"], frame),
  };
}

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

/* ── the nine hues as a border, and as a left edge ────────────────────────── */
//
// A left edge IS a border — `border-left: 2px solid var(--cat-x)` in a part row,
// `1.5px dashed var(--cat-breakage)` on a card — so the two jobs share one
// measurement and differ only in width, which contrast does not depend on.

describe("every category hue as an edge, on every ground a part sits on", () => {
  const CASES = ROOMS.flatMap((theme) =>
    CATEGORIES.flatMap((token) =>
      Object.keys(grounds(theme)).map((ground) => ({ theme, token, ground })),
    ),
  );

  it.each(CASES)("$theme $token on $ground clears the 3.0:1 UI floor", ({ theme, token, ground }) => {
    const ratio = contrast(value(theme, token), grounds(theme)[ground]);
    expect(ratio, `${theme} --${token} is ${ratio}:1 on --${ground}`).toBeGreaterThanOrEqual(
      UI_FLOOR,
    );
  });

  it("records the worst ground for each hue, so a moved value has to be re-recorded", () => {
    const worst = ROOMS.map((theme) => ({
      theme,
      lowest: Math.min(
        ...CATEGORIES.flatMap((token) =>
          Object.values(grounds(theme)).map((ground) => contrast(value(theme, token), ground)),
        ),
      ),
    }));
    expect(worst).toEqual([
      { theme: "noon", lowest: 4.31 },
      { theme: "dusk", lowest: 4.02 },
    ]);
  });
});

/* ── state colours ────────────────────────────────────────────────────────── */

describe("the focus ring, on every ground a control sits on", () => {
  // BG-P30 ESCALATED THIS RING RATHER THAN FIXING IT, AND UI-P04 FIXED IT. The
  // ring was `--lit` in both rooms, and the lamp gold does not clear the 3.0:1
  // UI floor on any Noon ground. The 2px offset does not rescue it: the band
  // is `--bg` and so is what lies outside the ring, so both of the ring's edges
  // are read against the same colour. The ring is `--focus-ring` now, the ink
  // on Noon and the lamp gold on Dusk, and this asserts the floor it was only
  // recording before.
  it("clears the UI floor on every ground, in both rooms", () => {
    for (const theme of ROOMS) {
      for (const [name, ground] of Object.entries(grounds(theme))) {
        const ratio = contrast(value(theme, "focus-ring"), ground);
        expect(ratio, `${theme} --focus-ring is ${ratio}:1 on --${name}`).toBeGreaterThanOrEqual(
          UI_FLOOR,
        );
      }
    }
  });

  it("records the figures, so a moved value has to be re-recorded", () => {
    const measured = ROOMS.map((theme) => ({
      theme,
      ...Object.fromEntries(
        Object.entries(grounds(theme)).map(([name, ground]) => [
          name,
          contrast(value(theme, "focus-ring"), ground),
        ]),
      ),
    }));
    expect(measured).toEqual([
      { theme: "noon", bg: 13.41, recess: 11.48, glass: 15.24, card: 15.38 },
      { theme: "dusk", bg: 7.65, recess: 5.6, glass: 7.52, card: 5.22 },
    ]);
  });

  it("is not the lamp on Noon, where the lamp fails on every ground", () => {
    // The reason for the split, kept on the record: what the ring was before.
    for (const ground of Object.values(grounds("noon"))) {
      expect(contrast(value("noon", "lit"), ground)).toBeLessThan(UI_FLOOR);
    }
    expect(value("noon", "focus-ring")).not.toBe(value("noon", "lit"));
    expect(value("dusk", "focus-ring")).toBe(value("dusk", "lit"));
  });

  it("is legal as a fill with --on-lit on it, in both rooms — which is the rule", () => {
    for (const theme of ROOMS) {
      expect(contrast(value(theme, "on-lit"), value(theme, "lit"))).toBeGreaterThanOrEqual(
        TEXT_FLOOR,
      );
    }
  });
});

describe("the error state", () => {
  // `fieldStyle({ invalid: true })` draws the border in `--cat-breakage` and
  // `fieldMessageStyle` puts the message under it in the same token. The border
  // is a 3.0:1 state and the message is 4.5:1 text, so they are two floors on
  // one colour.
  //
  // THE MESSAGE IS NOT LEGAL ON EVERY GROUND, AND THAT IS A CONSTRAINT RATHER
  // THAN A DEFECT. Every consumer of `fieldMessageStyle` today is an auth card
  // — glass over the page ground — where it measures 5.88:1 and 4.66:1, and it
  // clears the floor on the bare page ground too. On a `--recess` panel it is
  // 4.47:1 and 4.31:1, and on a Dusk build card 3.93:1: short, in both cases,
  // by less than a tenth. So the floors below are asserted on the two grounds
  // the message is actually painted on, and the other two are RECORDED with the
  // rule they imply — do not put a field message on a recess or on a card. The
  // day one is, this table is what a reader checks.
  const PAINTED_ON = ["bg", "glass"] as const;

  it.each(ROOMS)("%s puts the message above the text floor where it is painted", (theme) => {
    for (const name of PAINTED_ON) {
      const ratio = contrast(value(theme, "cat-breakage"), grounds(theme)[name]);
      expect(ratio, `${theme} error text on --${name} is ${ratio}:1`).toBeGreaterThanOrEqual(
        TEXT_FLOOR,
      );
    }
  });

  it("records the two grounds the message must not be painted on", () => {
    const measured = ROOMS.map((theme) => ({
      theme,
      recess: contrast(value(theme, "cat-breakage"), grounds(theme).recess),
      card: contrast(value(theme, "cat-breakage"), grounds(theme).card),
    }));
    expect(measured).toEqual([
      { theme: "noon", recess: 4.62, card: 6.18 },
      { theme: "dusk", recess: 4.31, card: 4.02 },
    ]);
    // The two that are short are short — stated, so the rule above has a
    // measurement behind it rather than a memory. UI-P03's Noon recess lifted
    // that ground to 4.62:1, so only Dusk's are left; the rule stands for both
    // rooms because a message painted on a recess is still unmeasured by design.
    expect(measured[1].recess).toBeLessThan(TEXT_FLOOR);
    expect(measured[1].card).toBeLessThan(TEXT_FLOOR);
  });

  it("puts the border above the UI floor against the field's own fill", () => {
    for (const theme of ROOMS) {
      const ratio = contrast(value(theme, "cat-breakage"), value(theme, "recess"));
      expect(ratio, `${theme} error border on the field fill is ${ratio}:1`).toBeGreaterThanOrEqual(
        UI_FLOOR,
      );
    }
  });
});

describe("the evidence fill pair", () => {
  // The two halves are used together or not at all, and the ink differs by
  // room: Noon puts `--text` on a solid mint, Dusk puts `--evidence` on a
  // 16% wash of itself. Both are contract pairings; this holds them to it.
  it("Noon puts --text on --evidence-fill", () => {
    expect(contrast(value("noon", "text"), value("noon", "evidence-fill"))).toBe(11.86);
  });

  it("Dusk puts --evidence on --evidence-fill", () => {
    const ratio = contrast(value("dusk", "evidence"), value("dusk", "evidence-fill"));
    expect(ratio, `dusk evidence on its fill is ${ratio}:1`).toBeGreaterThanOrEqual(TEXT_FLOOR);
  });
});

describe("the dashed gap edge", () => {
  // The card's edge is the whole treatment for a gap, so it is the one thing
  // that must read: 1.5px dashed `--cat-breakage` on the normal card shape.
  // Measured on the card composite, which is where a card's edge actually is.
  it("reads against the card, in both rooms", () => {
    for (const theme of ROOMS) {
      const ratio = contrast(value(theme, "cat-breakage"), grounds(theme).card);
      expect(ratio, `${theme} gap edge on a card is ${ratio}:1`).toBeGreaterThanOrEqual(UI_FLOOR);
    }
  });

  it("resolves to an --evidence edge that also reads, once the gap is filled", () => {
    for (const theme of ROOMS) {
      const ratio = contrast(value(theme, "evidence"), grounds(theme).card);
      expect(ratio, `${theme} solved edge on a card is ${ratio}:1`).toBeGreaterThanOrEqual(
        UI_FLOOR,
      );
    }
  });
});

describe("the unread marker", () => {
  // Two renderings. One unread is a 6px `--action` dot — a mark, not type, so
  // the 3.0:1 UI floor. More than one is a count in `--text` on a 14% wash of
  // `--action`, which is type and takes the 4.5:1 floor.
  const wash = (theme: ThemeKey) => {
    const [r, g, b] = parse(value(theme, "action"));
    return over(`rgba(${r},${g},${b},0.14)`, THEMES[theme].bg);
  };

  it("the dot reads on the page ground and on a card, in both rooms", () => {
    for (const theme of ROOMS) {
      for (const [name, ground] of Object.entries(grounds(theme))) {
        if (name === "recess") continue; // a thread row is not an inset well
        const ratio = contrast(value(theme, "action"), ground);
        expect(ratio, `${theme} unread dot on --${name} is ${ratio}:1`).toBeGreaterThanOrEqual(
          UI_FLOOR,
        );
      }
    }
  });

  it("the count reads on its own wash, in both rooms", () => {
    for (const theme of ROOMS) {
      const ratio = contrast(value(theme, "text"), wash(theme));
      expect(ratio, `${theme} unread count is ${ratio}:1`).toBeGreaterThanOrEqual(TEXT_FLOOR);
    }
  });
});

describe("disabled text", () => {
  // THE ONE PLACE A LOW NUMBER IS THE DESIGN. The kit washes a disabled control
  // to 50%, which is what makes it read as unavailable, and WCAG 1.4.3 excludes
  // "text that is part of an inactive user interface component" from the
  // contrast requirement for exactly that reason. So this records the figures
  // rather than flooring them — and records that they are BELOW the floor, so
  // nobody later mistakes the wash for an accident.
  const washed = (theme: ThemeKey, ink: TokenName, ground: string) => {
    const [r, g, b] = parse(value(theme, ink));
    return contrast(over(`rgba(${r},${g},${b},0.5)`, ground), ground);
  };

  it("records the 50% wash on a secondary control, in both rooms", () => {
    const measured = ROOMS.map((theme) => ({
      theme,
      onBg: washed(theme, "text2", grounds(theme).bg),
      onCard: washed(theme, "text2", grounds(theme).card),
    }));
    expect(measured).toEqual([
      { theme: "noon", onBg: 2.14, onCard: 2.25 },
      { theme: "dusk", onBg: 2.96, onCard: 2.5 },
    ]);
    for (const row of measured) {
      expect(row.onBg, "a disabled control that cleared the text floor would not read as disabled")
        .toBeLessThan(TEXT_FLOOR);
    }
  });
});
