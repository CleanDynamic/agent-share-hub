/* BG-P32 — the guard that keeps motion one vocabulary.
 *
 * This prompt collapsed eleven durations and five easings, scattered across 278
 * files by a dozen earlier prompts, into `motion.ts`. That property is worth
 * exactly as much as the thing defending it: without an assertion, the next
 * surface prompt writes `transition: all 0.3s ease` because that is what its
 * reference gave it, nobody notices in review, and the product is back to
 * per-file motion — which is the scattered AI-slop the audit exists to catch.
 *
 * Four things are held here:
 *   1. The vocabulary itself — the figures the theme names, and the rules every
 *      builder must obey (no `all`, no `box-shadow`, no `ease-in`, ≤200ms on UI
 *      feedback, nothing under reduced motion).
 *   2. CSS/TS parity — `--motion-*` in `index.css` against the constants here,
 *      so a duration cannot be changed on one side only.
 *   3. `transition: all` and animated `box-shadow`, scanned across all of
 *      `src/`. These are the two the theme calls out by name, and both are
 *      invisible in review.
 *   4. Hover gating — every hover effect behind `(hover: hover) and (pointer:
 *      fine)`, whether it is a Tailwind utility, a CSS rule or a style object.
 *
 * COMMENTS ARE STRIPPED BEFORE SCANNING, deliberately. Most of the repointed
 * modules document what they used to do — "was `transition: all`", "never
 * `ease-in` on UI" — and that provenance is the most useful thing in them. A
 * forbidden string in a comment is documentation; one in a declaration is
 * something the browser runs. Only the second is a defect.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import {
  BASE,
  DURATION,
  EASING,
  FAST,
  HOVER_QUERY,
  LINEAR,
  REVEAL,
  REVEAL_SHIFT,
  STANDARD,
  THEME_SWITCH,
  fade,
  feedback,
  move,
  reveal,
  revealFrom,
} from "./motion";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const EXTS = [".ts", ".tsx", ".css"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
      continue;
    }
    if (EXTS.some((ext) => entry.endsWith(ext))) out.push(full);
  }
  return out;
}

/** Block and line comments removed, so provenance notes are not scanned. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const FILES = walk(SRC).map((path) => ({
  path,
  rel: relative(ROOT, path).split(sep).join("/"),
  code: stripComments(readFileSync(path, "utf8")),
}));

/* Only shipped code is scanned. A test legitimately quotes the strings these
   scanners look for — this file does it a dozen times, and onboardingPaint
   asserts `transition-all` is absent from its own render — so including tests
   would make every guard here trip on the guards. */
const SCANNED = FILES.filter((file) => !/\.test\.tsx?$/.test(file.rel));

describe("the vocabulary", () => {
  it("names the three durations the theme gives, and nothing else", () => {
    expect(FAST).toBe(150);
    expect(BASE).toBe(200);
    expect(REVEAL).toBe(450);
    expect(DURATION).toEqual({ fast: 150, base: 200, reveal: 450, themeSwitch: 180 });
  });

  it("keeps the theme switch at the 180ms BG-P02 fixed", () => {
    expect(THEME_SWITCH).toBe(180);
  });

  it("gives the scroll entry the theme's own figures", () => {
    expect(REVEAL).toBe(450);
    expect(REVEAL_SHIFT).toBe(14);
    expect(revealFrom()).toEqual({ opacity: 0, transform: "translateY(14px)" });
  });

  it("carries two curves and no ease-in", () => {
    expect(EASING).toEqual({ standard: STANDARD, linear: LINEAR });
    for (const curve of Object.values(EASING)) {
      expect(curve).not.toMatch(/\bease-in\b/);
    }
  });
});

describe("the four patterns", () => {
  const builders = {
    feedback: feedback(),
    fade: fade(),
    move: move(),
    reveal: reveal(120),
  };

  it("never emits the `all` keyword", () => {
    for (const [name, value] of Object.entries(builders)) {
      expect(value, name).not.toMatch(/\ball\b/);
    }
  });

  it("never emits box-shadow, which cannot be composited", () => {
    for (const [name, value] of Object.entries(builders)) {
      expect(value, name).not.toMatch(/box-shadow/);
    }
  });

  it("never emits ease-in, which reads as an unresponsive control", () => {
    for (const [name, value] of Object.entries(builders)) {
      expect(value, name).not.toMatch(/\bease-in\b/);
    }
  });

  it("never emits a layout property", () => {
    for (const [name, value] of Object.entries(builders)) {
      expect(value, name).not.toMatch(/\b(width|height|top|left|right|bottom|margin|padding)\b/);
    }
  });

  it("holds UI feedback under the theme's 200ms ceiling", () => {
    for (const name of ["feedback", "fade", "move"] as const) {
      for (const ms of builders[name].match(/(\d+)ms/g) ?? []) {
        expect(parseInt(ms, 10), `${name}: ${ms}`).toBeLessThanOrEqual(BASE);
      }
    }
  });

  it("lets a caller narrow the feedback list without inventing a duration", () => {
    expect(feedback("opacity")).toBe(`opacity ${FAST}ms ${STANDARD}`);
  });

  it("carries the stagger delay on the reveal", () => {
    expect(reveal(120)).toContain(`${REVEAL}ms ${STANDARD} 120ms`);
  });
});

describe("CSS and TypeScript agree", () => {
  const css = readFileSync(join(SRC, "index.css"), "utf8");

  const custom = (name: string): string[] => [
    ...css.matchAll(new RegExp(`--motion-${name}:\\s*([^;]+);`, "g")),
  ].map((match) => match[1].trim());

  it.each([
    ["fast", `${FAST}ms`],
    ["base", `${BASE}ms`],
    ["reveal", `${REVEAL}ms`],
    ["theme", `${THEME_SWITCH}ms`],
    ["ease", STANDARD],
  ])("--motion-%s matches the module", (name, expected) => {
    const found = custom(name);
    // Declared in both theme blocks, exactly as the radius scale is.
    expect(found).toHaveLength(2);
    for (const value of found) expect(value).toBe(expected);
  });
});

describe("no transition: all, anywhere in src/", () => {
  /* Both spellings: the CSS keyword and Tailwind's utility, which compiles to
     it. `transition-all` is the one that actually appeared in this codebase —
     52 times, across the control kit, the publish form and nine block types. */
  const OFFENDERS = /transition:\s*all\b|(?:^|[\s"'`:])transition-all(?:[\s"'`]|$)/;

  it("finds none", () => {
    /* Named line by line, so a failure is actionable rather than a bare count. */
    const offenders = SCANNED.flatMap((file) =>
      file.code
        .split("\n")
        .map((line, index) => [index + 1, line] as const)
        .filter(([, line]) => OFFENDERS.test(line))
        .map(([number, line]) => `${file.rel}:${number} — ${line.trim().slice(0, 120)}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe("no animated box-shadow, anywhere in src/", () => {
  /* A shadow that changes goes on a pseudo-element whose opacity is animated.
     `box-shadow` is not compositable, so transitioning it re-rasterises the
     element on every frame — twenty-four cards to a gallery grid. */
  const IN_TRANSITION = /transition(?:-property)?\s*[:=][^;\n]*box-shadow/;

  it("finds none", () => {
    const offenders = SCANNED.filter((file) => IN_TRANSITION.test(file.code)).map(
      (file) => file.rel,
    );
    expect(offenders).toEqual([]);
  });

  it("does not hide one behind a Tailwind utility either", () => {
    const utility = /transition-shadow|transition-\[[^\]]*shadow/;
    const offenders = SCANNED.filter((file) => utility.test(file.code)).map((file) => file.rel);
    expect(offenders).toEqual([]);
  });
});

describe("every hover effect is pointer-gated", () => {
  /* THREE HALVES TO ONE GATE, because hover reaches this codebase three ways.
     Tailwind's `hover:` utilities are gated wholesale by the
     `hoverOnlyWhenSupported` flag in tailwind.config.ts, which compiles every
     one of them into this same media query — that is asserted below rather
     than per-file, because there are 563 of them. A hand-written `:hover` in a
     stylesheet has to sit inside the query itself. A hover carried in a style
     object has no selector to gate, so it goes through `hoverIsFine()`. */

  it("turns Tailwind's hover utilities into the media query", () => {
    const config = readFileSync(join(ROOT, "tailwind.config.ts"), "utf8");
    expect(stripComments(config)).toMatch(/hoverOnlyWhenSupported:\s*true/);
  });

  it("uses the theme's exact query, so the three halves agree", () => {
    // Tailwind emits this string verbatim; a stylesheet that wrote
    // `(hover: hover)` alone would gate differently on a hybrid device.
    expect(HOVER_QUERY).toBe("(hover: hover) and (pointer: fine)");
  });

  it("puts every stylesheet :hover rule inside the query", () => {
    for (const file of SCANNED.filter((candidate) => candidate.rel.endsWith(".css"))) {
      for (const [index, line] of file.code.split("\n").entries()) {
        if (!line.includes(":hover")) continue;

        // The block this line sits in, back to the nearest @media.
        const before = file.code.split("\n").slice(0, index).join("\n");
        const lastQuery = before.lastIndexOf("@media");
        const gated =
          lastQuery !== -1 &&
          before.slice(lastQuery).includes("hover: hover") &&
          // Still inside it: no unbalanced closing brace since the query opened.
          countBraces(before.slice(lastQuery)) > 0;

        expect(gated, `${file.rel}:${index + 1} — ${line.trim()}`).toBe(true);
      }
    }
  });
});

function countBraces(source: string): number {
  let depth = 0;
  for (const char of source) {
    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
  }
  return depth;
}
