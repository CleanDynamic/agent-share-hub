// The theme states two type rules as hard, so they are tested rather than
// trusted: Sentient never below 20px (17 until the UI-P52 density pass), and
// Figtree never below weight 400 at sizes under 18px. Both describe a specific rendering failure — the display
// face loses its shape at small sizes, worst on Dusk, and a sub-400 weight at
// text size disappears into the ground.
//
// Three layers here, and the third is the one that makes the first two mean
// something:
//   1. the shipped scale obeys both floors;
//   2. `floorViolations` actually catches a violation, so (1) is not a check
//      that passes by never looking;
//   3. no component anywhere sets Sentient by hand, so every instance on
//      every route comes from the scale (1) has already cleared.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import {
  BODY_MIN_WEIGHT,
  BODY_WEIGHT_FLOOR_PX,
  DISPLAY_MIN_PX,
  DM_MONO,
  FIGTREE,
  LOCKUP_MIN_PX,
  SENTIENT,
  assertFloors,
  display,
  floorViolations,
  measure,
  minPx,
  mono,
  scale,
  tabular,
  type,
} from "./type";

const SRC = join(process.cwd(), "src");

/** Every .ts/.tsx file under src/, as [repo-relative path, contents]. */
function sourceFiles(dir = SRC): Array<[string, string]> {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    if (!/\.tsx?$/.test(entry.name)) return [];
    return [[relative(process.cwd(), full), readFileSync(full, "utf8")] as [string, string]];
  });
}

/** Start of the CSS rule containing `pos`, skipping `${` interpolation opens. */
function ruleStart(text: string, pos: number): number {
  for (let i = pos; i > 0; i--) {
    if (text[i] === "{" && text[i - 1] !== "$") return i;
  }
  return -1;
}

/** End of the block opened at `open`, counting nested braces. */
function ruleEnd(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return i;
  }
  return text.length;
}

// UI-P52 density pass: the floor is 20 (it was 17), because the pass takes the
// smallest headings under 20 and those are now set in Figtree 600.
describe("the display floor: Sentient never below 20px", () => {
  it("holds across the shipped scale", () => {
    expect(assertFloors()).toEqual([]);
  });

  it("holds for every role that uses the display face", () => {
    const displayRoles = Object.entries(scale).filter(([, s]) => s.fontFamily === SENTIENT);
    // If this is empty the loop below proves nothing.
    expect(displayRoles.length).toBeGreaterThan(0);

    for (const [role, style] of displayRoles) {
      const smallest = minPx(style.fontSize);
      expect(smallest, `${role} has a size this check cannot resolve`).not.toBeNull();
      expect(smallest, `${role} renders Sentient at ${smallest}px`).toBeGreaterThanOrEqual(
        DISPLAY_MIN_PX,
      );
    }
  });

  it("catches display type set below the floor", () => {
    const found = floorViolations("smallHead", {
      fontFamily: SENTIENT,
      fontSize: "13px",
      fontWeight: 400,
    });
    expect(found).toHaveLength(1);
    // UI-P52 density pass: the floor in the message is 20, not 17.
    expect(found[0]).toMatch(/below the 20px display floor/);
  });

  it("catches a clamp whose lower bound breaches the floor", () => {
    // The failure a plain "is the size ok" check misses: legal at the top of
    // the range, illegal at the bottom, which is where a phone renders it.
    const found = floorViolations("shrinkingHead", {
      fontFamily: SENTIENT,
      fontSize: "clamp(16px, 4vw, 48px)",
      fontWeight: 400,
    });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/16px is below/);
  });

  it("refuses a display size it cannot resolve rather than passing it", () => {
    const found = floorViolations("remHead", { fontFamily: SENTIENT, fontSize: "1.2rem" });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/cannot resolve/);
  });

  it("leaves the other two faces alone at small sizes", () => {
    expect(floorViolations("data", { fontFamily: DM_MONO, fontSize: "12px" })).toEqual([]);
    expect(
      floorViolations("label", { fontFamily: FIGTREE, fontSize: "13px", fontWeight: 500 }),
    ).toEqual([]);
  });
});

describe("the weight floor: Figtree never under 400 below 18px", () => {
  it("holds across the shipped scale", () => {
    const light = Object.entries(scale).filter(
      ([, s]) => s.fontFamily === FIGTREE && (minPx(s.fontSize) ?? 99) < BODY_WEIGHT_FLOOR_PX,
    );
    expect(light.length).toBeGreaterThan(0);
    for (const [role, style] of light) {
      expect(style.fontWeight, `${role} is under the weight floor`).toBeGreaterThanOrEqual(
        BODY_MIN_WEIGHT,
      );
    }
  });

  it("catches a light weight at text size", () => {
    const found = floorViolations("thinBody", {
      fontFamily: FIGTREE,
      fontSize: "13px",
      fontWeight: 300,
    });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/under the weight floor/);
  });

  it("permits a light weight at display size, where the floor does not apply", () => {
    expect(
      floorViolations("bigThin", { fontFamily: FIGTREE, fontSize: "48px", fontWeight: 300 }),
    ).toEqual([]);
  });
});

describe("minPx", () => {
  it("reads the lower bound of a clamp and a plain px", () => {
    expect(minPx("clamp(30px, 3.6vw, 48px)")).toBe(30);
    expect(minPx("16px")).toBe(16);
  });

  it("returns null for a size it cannot resolve statically", () => {
    expect(minPx("1.2rem")).toBeNull();
    expect(minPx("clamp(2rem, 4vw, 5rem)")).toBeNull();
  });
});

describe("the scale", () => {
  it("gives every role the five properties a role has to carry", () => {
    for (const [role, style] of Object.entries(scale)) {
      for (const property of ["fontFamily", "fontSize", "fontWeight", "lineHeight"] as const) {
        expect(style[property], `${role} is missing ${property}`).toBeDefined();
      }
      expect(style.letterSpacing, `${role} is missing letterSpacing`).toBeDefined();
    }
  });

  it("matches the sizes and faces the theme specifies", () => {
    expect(type.eyebrow.fontSize).toBe("12px");
    expect(type.eyebrow.fontFamily).toBe(DM_MONO);
    expect(type.eyebrow.letterSpacing).toBe("0.08em");
    expect(type.eyebrow.textTransform).toBe("uppercase");

    // UI-P52 density pass: every size below is its old size through the table
    // (design/prompts/README-density.md) — body 16 → 15, bodyLarge 17 → 16,
    // section heads 30 → 22, the hero 44 → 33, data 13 → 12, labels 13 → 12.
    // The eyebrow's 12 is in the kept band.
    expect(type.body.fontSize).toBe("15px");
    expect(type.body.fontWeight).toBe(400);
    expect(type.body.lineHeight).toBe(1.55);
    expect(type.bodyLarge.fontSize).toBe("16px");

    // THE CARD TITLE. BG-P09 made it the display face at a fixed 22 (22 ≥ the
    // floor of the day, 17), so a title under a picture wins the eye by face and
    // size; UI-P05 moved that face to Sentient. UI-P52 density pass: the table
    // takes 22 to 19, under Sentient's floor of 20, so the role keeps the size
    // and is set in Figtree 600 instead — still clear of the weight floor.
    expect(minPx(type.cardTitle.fontSize)).toBe(19);
    expect(type.cardTitle.fontFamily).toBe(FIGTREE);
    expect(type.cardTitle.fontWeight).toBe(600);
    expect(floorViolations("cardTitle", type.cardTitle)).toEqual([]);
    expect(minPx(type.sectionHead.fontSize)).toBe(22);
    expect(minPx(type.hero.fontSize)).toBe(33);
    expect(minPx(type.data.fontSize)).toBe(12);
    expect(type.label.fontSize).toBe("12px");
  });

  it("balances headings and prettifies descriptions", () => {
    for (const role of ["cardTitle", "sectionHead", "hero"] as const) {
      expect(type[role].textWrap, `${role} should balance`).toBe("balance");
    }
    for (const role of ["body", "bodyLarge"] as const) {
      expect(type[role].textWrap, `${role} should be pretty`).toBe("pretty");
    }
    // Short, non-wrapping roles carry neither.
    for (const role of ["eyebrow", "data", "label"] as const) {
      expect(type[role]).not.toHaveProperty("textWrap");
    }
  });

  it("keeps mono off long-form prose", () => {
    for (const role of ["body", "bodyLarge"] as const) {
      expect(type[role].fontFamily).toBe(FIGTREE);
    }
  });

  it("caps the measure inside the theme's 60-75 character range", () => {
    const ch = Number(/^(\d+)ch$/.exec(measure.maxWidth)?.[1]);
    expect(ch).toBeGreaterThanOrEqual(60);
    expect(ch).toBeLessThanOrEqual(75);
  });

  it("offers tabular numerals for columns of digits", () => {
    expect(tabular.fontVariantNumeric).toBe("tabular-nums");
  });
});

describe("the retired faces", () => {
  // Acceptance: neither family may appear in a network request on any route.
  // Both were loaded by name, so if the name is gone from the source and from
  // index.html, nothing can request them.
  // THE LIST IS EMPTY NOW (BG-P28). LeftPanel held the last exemption: it is
  // one of the externally-supplied shell components, so an earlier prompt left
  // its one Inter reference alone rather than quietly editing it. BG-P28 had
  // to touch that file anyway — it was still painting the wordmark in the old
  // brand's #8B4513 on every route in the app, which this prompt's acceptance
  // rules out — and repointing the face at the same time was the one-token fix
  // the note predicted. Nothing may be added to this list.
  const EXEMPT: string[] = [];

  it("are named nowhere in the source", () => {
    const offenders = sourceFiles()
      .filter(([path]) => !path.endsWith("theme/type.test.ts"))
      .filter(([path]) => !EXEMPT.includes(path))
      .filter(([, text]) => /Playfair Display|['"]Inter['",]|\bInter,\s|,\s?Inter\b/.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it("has an exemption list that is still doing work", () => {
    for (const path of EXEMPT) {
      const [, text] = sourceFiles().find(([p]) => p === path) ?? [];
      expect(text, `${path} is exempted but missing`).toBeDefined();
      expect(text, `${path} no longer needs its exemption — remove it`).toMatch(
        /['"]Inter['",]|Playfair Display/,
      );
    }
  });

  it("are not imported by index.html or any stylesheet", () => {
    const shipped = [
      readFileSync(join(process.cwd(), "index.html"), "utf8"),
      readFileSync(join(process.cwd(), "src/index.css"), "utf8"),
      readFileSync(join(process.cwd(), "src/styles/shared-ns.css"), "utf8"),
      readFileSync(join(process.cwd(), "src/components/shell/flat-shell.css"), "utf8"),
    ].join("\n");
    // A Google Fonts request names the family in the URL; the comments left
    // behind mention the retired names in prose, so match the request shape.
    expect(shipped).not.toMatch(/family=Inter/);
    expect(shipped).not.toMatch(/family=Playfair/);
    expect(shipped).not.toMatch(/font-family:[^;]*\bInter\b/);
    expect(shipped).not.toMatch(/font-family:[^;]*Playfair/);
  });

  it("leaves the two Google families requested exactly once, and Bodoni Moda not at all", () => {
    const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
    for (const family of ["DM+Mono", "Figtree"]) {
      expect(html, `${family} should be requested`).toContain(family);
    }
    expect(html.match(/fonts\.googleapis\.com\/css2/g) ?? []).toHaveLength(1);
    // UI-P05: the request, in any shipped file, names no Bodoni family.
    expect(html).not.toMatch(/family=Bodoni/);
    const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");
    expect(css).not.toMatch(/font-family:[^;]*Bodoni/);
  });

  it("self-hosts Sentient: two Latin WOFF2 files, two @font-face rules, both preloaded", () => {
    const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
    const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");
    for (const file of ["Sentient-Medium-latin.woff2", "Sentient-Bold-latin.woff2"]) {
      expect(existsSync(join(process.cwd(), "public/fonts", file)), `${file} is shipped`).toBe(true);
      expect(html).toMatch(
        new RegExp(`<link\\s+rel="preload"\\s+as="font"\\s+type="font/woff2"\\s+href="/fonts/${file.replace(/\./g, "\\.")}"\\s+crossorigin`),
      );
    }
    const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
    const sentient = faces.filter((f) => /font-family:\s*"Sentient"/.test(f));
    expect(sentient).toHaveLength(2);
    for (const weight of [500, 700]) {
      const face = sentient.find((f) => new RegExp(`font-weight:\\s*${weight}\\b`).test(f));
      expect(face, `Sentient ${weight} is declared`).toBeDefined();
      expect(face).toMatch(/font-display:\s*swap/);
      expect(face).toMatch(/format\("woff2"\)/);
      expect(face).toMatch(/unicode-range:/);
    }
  });
});

describe("every Sentient instance comes from the scale", () => {
  // This is what makes the floor test cover the whole product rather than one
  // module. The scale is floor-checked above; if nothing else in src/ names
  // the face, then no route can render it below 20px.
  it("is set by hand nowhere outside type.ts", () => {
    const offenders = sourceFiles()
      .filter(([path]) => !path.endsWith("theme/type.ts") && !path.endsWith("theme/type.test.ts"))
      // Tests assert on the face by name; only code that sets it is swept.
      .filter(([path]) => !/\.test\.tsx?$/.test(path))
      .filter(([, text]) => /['"]Sentient['",]/.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it("clears the floor at every site that interpolates the stack into CSS", () => {
    // The SENTIENT references sit in a CSS template literal, where
    // the size is written by hand rather than coming from a role. Each one's
    // enclosing rule is checked directly.
    const sites: string[] = [];
    for (const [path, text] of sourceFiles()) {
      if (path.endsWith("theme/type.ts") || path.endsWith("theme/type.test.ts")) continue;
      for (const m of text.matchAll(/\bSENTIENT\b/g)) {
        const open = ruleStart(text, m.index);
        if (open === -1) continue;
        const rule = text.slice(open, ruleEnd(text, open));
        for (const size of rule.matchAll(/font-size:\s*(\d+)px/g)) {
          sites.push(`${path}: ${size[1]}px`);
          expect(
            Number(size[1]),
            `${path} renders Sentient at ${size[1]}px`,
          ).toBeGreaterThanOrEqual(DISPLAY_MIN_PX);
        }
      }
    }
    // Guard against the sweep silently finding nothing to check.
    expect(sites.length).toBeGreaterThan(0);
  });

  it("clears the floor at the one site that picks the stack in JS", () => {
    // ContentDetailShell chooses between the display and body face at runtime.
    // The same title string renders twice: once in the sticky header at 13px,
    // which must NOT take the display face, and once as the h1 at 32-36px.
    const text = readFileSync(
      join(process.cwd(), "src/components/content-detail/ContentDetailShell.tsx"),
      "utf8",
    );
    expect(text).toMatch(/const titleFont = isBlog \? SENTIENT : FIGTREE;/);
    // The 13px site takes the body face directly, not titleFont.
    expect(text).toMatch(/fontFamily: FIGTREE,\s*\n\s*fontSize: 13,/);
    // Every site that does read titleFont is at or above the floor.
    for (const m of text.matchAll(/fontFamily: titleFont,\s*\n\s*fontSize: ([^,\n]+),/g)) {
      const smallest = Math.min(
        ...[...m[1].matchAll(/(\d+)/g)].map((d) => Number(d[1])),
      );
      expect(smallest, `titleFont used at ${m[1]}`).toBeGreaterThanOrEqual(DISPLAY_MIN_PX);
    }
  });

  it("is only ever spread from a role that clears the floor", () => {
    // Belt and braces: the sweep above proves the face is only named here, and
    // this proves the roles naming it are legal. Together they are the DOM
    // sweep's guarantee without needing to mount five routes.
    const sentient = Object.values(scale).filter((s) => s.fontFamily === SENTIENT);
    expect(sentient.every((s) => (minPx(s.fontSize) ?? 0) >= DISPLAY_MIN_PX)).toBe(true);
  });
});

describe("type.display(px)", () => {
  const spacing = (px: number, options?: Parameters<typeof display>[1]) => {
    const style = display(px, options);
    return [style.letterSpacing, style.lineHeight];
  };

  it("is Sentient 500 at the drawn size through the density table, complete", () => {
    // UI-P52 density pass: `px` is the size the board drew before the pass, and
    // the role renders it through the table — 44 → 33 (it rendered 44).
    const style = display(44);
    expect(style.fontFamily).toBe(SENTIENT);
    expect(style.fontSize).toBe("33px");
    expect(style.fontWeight).toBe(500);
    expect(style.textWrap).toBe("balance");
  });

  it("sets a heading the table takes under 20px in Figtree 600 at the same size", () => {
    // UI-P52 density pass: Sentient stays at 20px and up. Every heading drawn at
    // 22 or less renders under 20, so it keeps its size and changes its face.
    expect(display(24)).toMatchObject({ fontFamily: SENTIENT, fontSize: "20px", fontWeight: 500 });
    for (const [px, size] of [[22, 19], [21, 18], [20, 17], [19, 16], [18, 15], [17, 16]]) {
      expect(display(px), `display(${px})`).toMatchObject({ fontFamily: FIGTREE, fontSize: `${size}px`, fontWeight: 600 });
      expect(floorViolations(`display(${px})`, display(px))).toEqual([]);
    }
  });

  it("is reachable as type.display and type.mono", () => {
    expect(type.display).toBe(display);
    expect(type.mono).toBe(mono);
  });

  it("sets letter-spacing and line-height by size band, as the reference does", () => {
    expect(spacing(52)).toEqual(["-0.04em", 0.95]);
    expect(spacing(78)).toEqual(["-0.04em", 0.95]);
    expect(spacing(51)).toEqual(["-0.035em", 1]);
    expect(spacing(44)).toEqual(["-0.035em", 1]);
    expect(spacing(43)).toEqual(["-0.03em", 1]);
    expect(spacing(30)).toEqual(["-0.03em", 1]);
    expect(spacing(29)).toEqual(["-0.02em", 1.05]);
    expect(spacing(20)).toEqual(["-0.02em", 1.05]);
    expect(spacing(19)).toEqual(["-0.02em", 1.05]);
    expect(spacing(17)).toEqual(["-0.02em", 1.05]);
  });

  it("tightens a mobile page heading at 30–36px to -0.035em, and only there", () => {
    expect(spacing(30, { mobilePageHeading: true })).toEqual(["-0.035em", 1]);
    expect(spacing(36, { mobilePageHeading: true })).toEqual(["-0.035em", 1]);
    expect(spacing(37, { mobilePageHeading: true })).toEqual(["-0.03em", 1]);
    expect(spacing(28, { mobilePageHeading: true })).toEqual(["-0.02em", 1.05]);
  });

  it("sets the lockup wordmark at -0.03em / 1 at each size the reference draws it", () => {
    // UI-P52 density pass: drawn at 16, 18, 19, 21, 34, 64 and 70, rendered at
    // 15, 15, 16, 18, 26, 48 and 52 — and Sentient at every one of them.
    const drawn = [16, 18, 19, 21, 34, 64, 70];
    const rendered = [15, 15, 16, 18, 26, 48, 52];
    drawn.forEach((px, i) => {
      const style = display(px, { lockup: true });
      expect(style.fontSize).toBe(`${rendered[i]}px`);
      expect(style.fontFamily).toBe(SENTIENT);
      expect([style.letterSpacing, style.lineHeight]).toEqual(["-0.03em", 1]);
      expect(style).not.toHaveProperty("textWrap");
    });
  });

  it("holds the floor: nothing drawn under 17px, but the 16px lockup", () => {
    // UI-P52 density pass: `px` is the drawn size, so the floors that guard it
    // are the drawn ones they always were and the same inputs throw. What
    // renders is smaller: the 16px lockup is 15 now, and Sentient's own floor
    // (20) is held by setting smaller headings in Figtree, tested above.
    expect(() => display(16)).toThrow(/never drawn under 17px/);
    expect(() => display(12)).toThrow(RangeError);
    expect(() => display(Number.NaN)).toThrow(RangeError);
    expect(() => display(16, { lockup: true })).not.toThrow();
    expect(display(16, { lockup: true }).fontSize).toBe(`${LOCKUP_MIN_PX}px`);
    expect(() => display(15, { lockup: true })).toThrow(/never drawn under 16px/);
    // What it emits clears the same check the static roles are held to.
    for (const px of [17, 18, 22, 30, 44, 52, 70]) {
      expect(floorViolations(`display(${px})`, display(px))).toEqual([]);
    }
  });
});

describe("type.mono(px, { caps })", () => {
  it("is DM Mono, and carries tabular numerals", () => {
    const style = mono(12);
    expect(style.fontFamily).toBe(DM_MONO);
    expect(style.fontSize).toBe("12px");
    expect(style.fontVariantNumeric).toBe("tabular-nums");
  });

  it("renders the drawn size through the density table", () => {
    // UI-P52 density pass: 10–12 are kept, 13 → 12, 22 → 19, 40 → 30, and the
    // reference's few 9px labels become 10 (no text under 10px).
    for (const [px, size] of [[9, 10], [10, 10], [12, 12], [13, 12], [14, 13], [22, 19], [30, 22], [40, 30]]) {
      expect(mono(px).fontSize, `mono(${px})`).toBe(`${size}px`);
    }
  });

  it("sets an eyebrow uppercase at .09em", () => {
    for (const px of [10, 11, 12]) {
      const style = mono(px, { caps: true });
      expect(style.textTransform).toBe("uppercase");
      expect(style.letterSpacing).toBe("0.09em");
    }
  });

  it("gives a data value no extra tracking, and a large number -0.02em", () => {
    expect(mono(13).letterSpacing).toBe("0");
    expect(mono(21).letterSpacing).toBe("0");
    expect(mono(22).letterSpacing).toBe("-0.02em");
    expect(mono(40).letterSpacing).toBe("-0.02em");
    expect(mono(13)).not.toHaveProperty("textTransform");
  });

  it("is never under the weight floor", () => {
    expect(floorViolations("mono", mono(10))).toEqual([]);
    expect(Number(mono(10, { caps: true }).fontWeight)).toBeGreaterThanOrEqual(BODY_MIN_WEIGHT);
  });
});
