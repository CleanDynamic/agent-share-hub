// The theme states two type rules as hard, so they are tested rather than
// trusted: Bodoni Moda never below 20px, and Figtree never below weight 400 at
// sizes under 18px. Both describe a specific rendering failure — a didone's
// hairlines break up at small sizes, worst on Dusk, and a sub-400 weight at
// text size disappears into the ground.
//
// Three layers here, and the third is the one that makes the first two mean
// something:
//   1. the shipped scale obeys both floors;
//   2. `floorViolations` actually catches a violation, so (1) is not a check
//      that passes by never looking;
//   3. no component anywhere sets Bodoni Moda by hand, so every instance on
//      every route comes from the scale (1) has already cleared.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import {
  BODONI,
  BODY_MIN_WEIGHT,
  BODY_WEIGHT_FLOOR_PX,
  DISPLAY_MIN_PX,
  DM_MONO,
  FIGTREE,
  assertFloors,
  floorViolations,
  measure,
  minPx,
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

describe("the display floor: Bodoni Moda never below 20px", () => {
  it("holds across the shipped scale", () => {
    expect(assertFloors()).toEqual([]);
  });

  it("holds for every role that uses the display face", () => {
    const display = Object.entries(type).filter(([, s]) => s.fontFamily === BODONI);
    // If this is empty the loop below proves nothing.
    expect(display.length).toBeGreaterThan(0);

    for (const [role, style] of display) {
      const smallest = minPx(style.fontSize);
      expect(smallest, `${role} has a size this check cannot resolve`).not.toBeNull();
      expect(smallest, `${role} renders Bodoni at ${smallest}px`).toBeGreaterThanOrEqual(
        DISPLAY_MIN_PX,
      );
    }
  });

  it("catches display type set below the floor", () => {
    const found = floorViolations("smallHead", {
      fontFamily: BODONI,
      fontSize: "13px",
      fontWeight: 400,
    });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/below the 20px display floor/);
  });

  it("catches a clamp whose lower bound breaches the floor", () => {
    // The failure a plain "is the size ok" check misses: legal at the top of
    // the range, illegal at the bottom, which is where a phone renders it.
    const found = floorViolations("shrinkingHead", {
      fontFamily: BODONI,
      fontSize: "clamp(16px, 4vw, 48px)",
      fontWeight: 400,
    });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/16px is below/);
  });

  it("refuses a display size it cannot resolve rather than passing it", () => {
    const found = floorViolations("remHead", { fontFamily: BODONI, fontSize: "1.2rem" });
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
    const light = Object.entries(type).filter(
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
    for (const [role, style] of Object.entries(type)) {
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

    expect(type.body.fontSize).toBe("16px");
    expect(type.body.fontWeight).toBe(400);
    expect(type.body.lineHeight).toBe(1.55);
    expect(type.bodyLarge.fontSize).toBe("17px");

    expect(minPx(type.cardTitle.fontSize)).toBe(19);
    expect(type.cardTitle.fontWeight).toBe(500);
    expect(minPx(type.sectionHead.fontSize)).toBe(30);
    expect(minPx(type.hero.fontSize)).toBe(44);
    expect(minPx(type.data.fontSize)).toBe(13);
    expect(type.label.fontSize).toBe("13px");
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
  it("are named nowhere in the source", () => {
    const offenders = sourceFiles()
      .filter(([path]) => !path.endsWith("theme/type.test.ts"))
      .filter(([, text]) => /Playfair Display|['"]Inter['",]|\bInter,\s|,\s?Inter\b/.test(text))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
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

  it("leaves all three replacements requested exactly once", () => {
    const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
    for (const family of ["Bodoni+Moda", "DM+Mono", "Figtree"]) {
      expect(html, `${family} should be requested`).toContain(family);
    }
    expect(html.match(/fonts\.googleapis\.com\/css2/g) ?? []).toHaveLength(1);
  });
});

describe("every Bodoni instance comes from the scale", () => {
  // This is what makes the floor test cover the whole product rather than one
  // module. The scale is floor-checked above; if nothing else in src/ names
  // the face, then no route can render it below 20px.
  it("is set by hand nowhere outside type.ts", () => {
    const offenders = sourceFiles()
      .filter(([path]) => !path.endsWith("theme/type.ts") && !path.endsWith("theme/type.test.ts"))
      .filter(([, text]) => text.includes("Bodoni Moda"))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it("clears the floor at every site that interpolates the stack into CSS", () => {
    // Five of the six BODONI references sit in a CSS template literal, where
    // the size is written by hand rather than coming from a role. Each one's
    // enclosing rule is checked directly.
    const sites: string[] = [];
    for (const [path, text] of sourceFiles()) {
      if (path.endsWith("theme/type.ts") || path.endsWith("theme/type.test.ts")) continue;
      for (const m of text.matchAll(/BODONI/g)) {
        const open = ruleStart(text, m.index);
        if (open === -1) continue;
        const rule = text.slice(open, ruleEnd(text, open));
        for (const size of rule.matchAll(/font-size:\s*(\d+)px/g)) {
          sites.push(`${path}: ${size[1]}px`);
          expect(
            Number(size[1]),
            `${path} renders Bodoni at ${size[1]}px`,
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
    expect(text).toMatch(/const titleFont = isBlog \? BODONI : FIGTREE;/);
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
    const display = Object.values(type).filter((s) => s.fontFamily === BODONI);
    expect(display.every((s) => (minPx(s.fontSize) ?? 0) >= DISPLAY_MIN_PX)).toBe(true);
  });
});
