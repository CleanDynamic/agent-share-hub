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
  fallbackOf,
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

// The serif is for works only, and its smallest use is a work's name at 15.
describe("the serif floor: Geist Serif never below 15px", () => {
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
    expect(found[0]).toMatch(/below the 15px floor/);
  });

  it("catches a clamp whose lower bound breaches the floor", () => {
    // The failure a plain "is the size ok" check misses: legal at the top of
    // the range, illegal at the bottom, which is where a phone renders it.
    const found = floorViolations("shrinkingHead", {
      fontFamily: SENTIENT,
      fontSize: "clamp(12px, 4vw, 48px)",
      fontWeight: 400,
    });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/12px is below/);
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

describe("the weight floor: the UI face never under 400 below 18px", () => {
  it("holds across the shipped scale", () => {
    const light = Object.entries(scale).filter(
      ([, s]) => s.fontFamily === FIGTREE && (minPx(s.fontSize) ?? 99) < BODY_WEIGHT_FLOOR_PX,
    );
    expect(light.length).toBeGreaterThan(0);
    for (const [role, style] of light) {
      expect(Number(fallbackOf(String(style.fontWeight))), `${role} is under the weight floor`).toBeGreaterThanOrEqual(
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

  it("matches the five sizes and the three faces the pack specifies", () => {
    const now = (v: unknown) => fallbackOf(String(v));
    // 13/16 Geist 500, no uppercase: the eyebrow is retired and keeps only its name.
    expect(now(type.eyebrow.fontSize)).toBe("13px");
    expect(type.eyebrow.fontFamily).toBe(`var(--type-eyebrow-font, ${FIGTREE})`);
    expect(type.eyebrow).not.toHaveProperty("textTransform");
    // 15/20 body, 17/22 group headings, 15/20 600 row titles, 20/24 section heads, 31/36 page titles.
    expect(now(type.body.fontSize)).toBe("15px");
    expect(type.body.fontWeight).toBe(400);
    expect(now(type.body.lineHeight)).toBe("20px");
    expect(now(type.bodyLarge.fontSize)).toBe("17px");
    expect(now(type.bodyLarge.lineHeight)).toBe("22px");
    expect(now(type.cardTitle.fontSize)).toBe("15px");
    expect(now(type.cardTitle.fontWeight)).toBe("600");
    expect(type.cardTitle.fontFamily).toBe(FIGTREE);
    expect(now(type.sectionHead.fontSize)).toBe("20px");
    expect(now(type.sectionHead.lineHeight)).toBe("24px");
    expect(now(type.sectionHead.letterSpacing)).toBe("-0.01em");
    expect(now(type.hero.fontSize)).toBe("31px");
    expect(now(type.hero.lineHeight)).toBe("36px");
    expect(now(type.label.fontSize)).toBe("13px");
    expect(now(type.label.fontWeight)).toBe("500");
    expect(now(type.data.fontSize)).toBe("13px");
    expect(type.data.fontFamily).toBe(`var(--type-data-font, ${FIGTREE})`);
    expect(floorViolations("cardTitle", type.cardTitle)).toEqual([]);
  });

  it("sets the serif at weight 400 only, for works only", () => {
    expect(type.work.fontFamily).toBe(SENTIENT);
    expect(type.work.fontWeight).toBe(400);
    expect(fallbackOf(String(type.work.fontSize))).toBe("31px");
    expect(fallbackOf(String(type.work.lineHeight))).toBe("36px");
    expect(type.work.letterSpacing).toBe("-0.02em");
    expect(type.workName.fontFamily).toBe(SENTIENT);
    expect(type.workName.fontWeight).toBe(400);
    for (const [role, style] of Object.entries(scale)) {
      if (style.fontFamily === SENTIENT) expect(["work", "workName"], `${role} is serif`).toContain(role);
    }
  });

  it("balances headings and prettifies descriptions", () => {
    for (const role of ["cardTitle", "sectionHead", "hero", "work"] as const) {
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
    ].join("\n");
    // A Google Fonts request names the family in the URL; the comments left
    // behind mention the retired names in prose, so match the request shape.
    expect(shipped).not.toMatch(/family=Inter/);
    expect(shipped).not.toMatch(/family=Playfair/);
    expect(shipped).not.toMatch(/font-family:[^;]*\bInter\b/);
    expect(shipped).not.toMatch(/font-family:[^;]*Playfair/);
  });

  it("requests no font from Google, and names no retired family in a stylesheet or a font stack", () => {
    // UI-P99 retired Figtree, Sentient and DM Mono; the faces are Geist and Geist Mono, self-hosted.
    const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
    expect(html).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
    expect(html).not.toMatch(/family=Bodoni/);
    const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");
    expect(css).not.toMatch(/font-family:[^;]*(Bodoni|Figtree|Sentient|DM Mono)/);
    const shared = readFileSync(join(process.cwd(), "src/styles/shared-ns.css"), "utf8");
    expect(shared).not.toMatch(/font-family:[^;]*(Figtree|Sentient|DM Mono)/);
    for (const file of ["Sentient-Medium-latin.woff2", "Sentient-Bold-latin.woff2"]) {
      expect(existsSync(join(process.cwd(), "public/fonts", file)), `${file} is gone`).toBe(false);
    }
  });

  it("self-hosts Geist, Geist Serif and Geist Mono: three variable WOFF2 files, three @font-face rules, Geist and Geist Serif preloaded", () => {
    const html = readFileSync(join(process.cwd(), "index.html"), "utf8");
    const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");
    for (const file of ["Geist-Variable.woff2", "GeistSerif-Variable.woff2", "GeistMono-Variable.woff2"]) {
      expect(existsSync(join(process.cwd(), "public/fonts", file)), `${file} is shipped`).toBe(true);
    }
    for (const file of ["Geist-Variable.woff2", "GeistSerif-Variable.woff2"]) {
      expect(html).toMatch(
        new RegExp(`<link\\s+rel="preload"\\s+as="font"\\s+type="font/woff2"\\s+href="/fonts/${file.replace(".", "\\.")}"\\s+crossorigin`),
      );
    }
    const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
    expect(faces).toHaveLength(3);
    for (const family of ["Geist", "Geist Serif", "Geist Mono"]) {
      const face = faces.find((f) => new RegExp(`font-family:\\s*"${family}"`).test(f));
      expect(face, `${family} is declared`).toBeDefined();
      expect(face).toMatch(/font-display:\s*swap/);
      expect(face).toMatch(/format\("woff2"\)/);
      expect(face).toMatch(/font-weight:\s*100 900/);
    }
  });
});

describe("every display-face instance comes from the scale", () => {
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
    // The serif is no longer interpolated into CSS anywhere (works are styled through `work`), so nothing may be found.
    expect(sites).toEqual([]);
  });

  it("clears the floor at the one site that picks the stack in JS", () => {
    // ContentDetailShell chooses between the display and body face at runtime.
    // The same title string renders twice: once in the sticky header at 13px,
    // which must NOT take the display face, and once as the h1 at 32-36px.
    const text = readFileSync(
      join(process.cwd(), "src/components/content-detail/ContentDetailShell.tsx"),
      "utf8",
    );
    expect(text).toMatch(/const titleFont = FIGTREE;/);
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
  it("is Geist 600 on one of the five sizes, never serif", () => {
    expect(display(44)).toMatchObject({ fontFamily: FIGTREE, fontSize: "31px", fontWeight: 600, lineHeight: "36px", letterSpacing: "-0.02em", textWrap: "balance" });
    expect(display(30)).toMatchObject({ fontSize: "31px", lineHeight: "36px" });
    for (const px of [22, 24, 28]) {
      expect(display(px), `display(${px})`).toMatchObject({ fontFamily: FIGTREE, fontSize: "20px", fontWeight: 600, lineHeight: "24px", letterSpacing: "-0.01em" });
    }
    for (const px of [17, 18, 20, 21]) {
      expect(display(px), `display(${px})`).toMatchObject({ fontFamily: FIGTREE, fontSize: "17px", fontWeight: 600, lineHeight: "22px" });
    }
  });

  it("is reachable as type.display and type.mono", () => {
    expect(type.display).toBe(display);
    expect(type.mono).toBe(mono);
  });

  it("sets the lockup wordmark at -0.03em / 1, in Geist", () => {
    for (const px of [16, 18, 19, 21, 34, 64, 70]) {
      const style = display(px, { lockup: true });
      expect(style.fontFamily).toBe(FIGTREE);
      expect([style.letterSpacing, style.lineHeight]).toEqual(["-0.03em", 1]);
      expect(style).not.toHaveProperty("textWrap");
    }
  });

  it("holds the floor: nothing drawn under 17px, but the 16px lockup", () => {
    expect(() => display(16)).toThrow(/never drawn under 17px/);
    expect(() => display(12)).toThrow(RangeError);
    expect(() => display(Number.NaN)).toThrow(RangeError);
    expect(() => display(16, { lockup: true })).not.toThrow();
    expect(display(16, { lockup: true }).fontSize).toBe(`${LOCKUP_MIN_PX}px`);
    expect(() => display(15, { lockup: true })).toThrow(/never drawn under 16px/);
    for (const px of [17, 18, 22, 30, 44, 52, 70]) {
      expect(floorViolations(`display(${px})`, display(px))).toEqual([]);
    }
  });
});

describe("type.mono(px)", () => {
  it("is Geist Mono 13/16 at every size, and carries tabular numerals", () => {
    for (const px of [9, 10, 12, 13, 14, 22, 40]) {
      const style = mono(px);
      expect(style.fontFamily).toBe(DM_MONO);
      expect(style.fontSize).toBe("13px");
      expect(style.lineHeight).toBe("16px");
      expect(style.fontVariantNumeric).toBe("tabular-nums");
    }
  });

  it("never sets uppercase, even when a caller still asks for caps", () => {
    expect(mono(11, { caps: true })).not.toHaveProperty("textTransform");
    expect(mono(13).letterSpacing).toBe("0");
  });

  it("is never under the weight floor", () => {
    expect(floorViolations("mono", mono(10))).toEqual([]);
  });
});

/* ── The roles ─────────────────────────────────────────────────────────────
   The roles are var() references; the declarations are in src/index.css. This
   resolves them the way the browser does. */

describe("roles", () => {
  const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");
  const declarations = (selector: string) => {
    const open = css.indexOf("{", css.indexOf(`\n${selector} {`));
    const out: Record<string, string> = {};
    for (const m of css.slice(open + 1, css.indexOf("}", open)).matchAll(/^\s*--([a-z0-9-]+):\s*(.+);\s*$/gm)) out[m[1]] = m[2];
    return out;
  };
  const refined = declarations(":root");

  /** `var(--a, fb)` as a browser resolves it, innermost first. */
  const resolve = (value: unknown, vars: Record<string, string>): string => {
    let v = String(value);
    for (let i = 0; i < 12 && v.includes("var("); i++) {
      v = v.replace(/var\(\s*--([a-z0-9-]+)\s*(?:,\s*((?:[^()]|\([^()]*\))*))?\)/, (_, name: string, fb?: string) => vars[name] ?? fb ?? "");
    }
    return v.trim();
  };
  const first = (family: string) => /^'?([^',]+)'?/.exec(family)![1];

  it("declares the three family tokens: Geist, Geist Serif and Geist Mono", () => {
    expect(first(refined["font-ui"])).toBe("Geist");
    expect(first(refined["font-display"])).toBe("Geist Serif");
    expect(first(refined["font-data"])).toBe("Geist Mono");
  });

  it("resolves to the five sizes", () => {
    const r = (v: unknown) => resolve(v, refined);
    expect([r(type.hero.fontSize), r(type.hero.lineHeight), r(type.hero.letterSpacing), r(type.hero.fontWeight)]).toEqual(["31px", "36px", "-0.02em", "600"]);
    expect([r(type.sectionHead.fontSize), r(type.sectionHead.lineHeight), r(type.sectionHead.letterSpacing)]).toEqual(["20px", "24px", "-0.01em"]);
    expect([r(type.figure.fontSize), r(type.figure.fontWeight)]).toEqual(["20px", "600"]);
    expect(type.figure.fontVariantNumeric).toBe("tabular-nums");
    expect([r(type.cardTitle.fontSize), r(type.cardTitle.fontWeight), r(type.cardTitle.lineHeight)]).toEqual(["15px", "600", "20px"]);
    expect([r(type.body.fontSize), r(type.body.fontWeight), r(type.body.lineHeight)]).toEqual(["15px", "400", "20px"]);
    expect([r(type.bodyLarge.fontSize), r(type.bodyLarge.lineHeight)]).toEqual(["17px", "22px"]);
    expect([r(type.label.fontSize), r(type.label.fontWeight), r(type.label.lineHeight)]).toEqual(["13px", "500", "16px"]);
    expect([r(type.eyebrow.fontSize), r(type.eyebrow.letterSpacing)]).toEqual(["13px", "0"]);
    expect(first(r(type.eyebrow.fontFamily))).toBe("Geist");
    expect([r(type.data.fontSize), r(type.data.lineHeight)]).toEqual(["13px", "16px"]);
    expect(first(r(type.data.fontFamily))).toBe("Geist");
    expect([r(type.monoLabel.fontSize), r(type.monoLabel.lineHeight)]).toEqual(["13px", "16px"]);
    expect(first(r(type.monoLabel.fontFamily))).toBe("Geist Mono");
  });

  it("sets every role in Geist, except the works in the serif and the numbers in mono", () => {
    const mono = ["monoLabel"];
    const serif = ["work", "workName"];
    for (const [role, style] of Object.entries(scale)) {
      const face = first(resolve((style as { fontFamily: string }).fontFamily, refined));
      const want = mono.includes(role) ? "Geist Mono" : serif.includes(role) ? "Geist Serif" : "Geist";
      expect(face, `${role} resolves to ${face}`).toBe(want);
    }
  });

  it("keeps the floors over the shipped scale", () => {
    expect(assertFloors()).toEqual([]);
  });
});
