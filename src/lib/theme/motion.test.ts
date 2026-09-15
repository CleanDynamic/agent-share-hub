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
  /* THREE SPELLINGS, because this codebase used all three and the first
     version of this guard only saw two. `transition: all` is the CSS keyword;
     `transition-all` is Tailwind's utility, which compiles to it; and
     `transition: "all 0.15s"` is the same keyword inside a quoted style-object
     value, which the first regex could not see past its own opening quote — 33
     of those were still live after the pass that was meant to remove them. */
  const OFFENDERS =
    /transition:\s*["']?\s*all\b|(?:^|[\s"'`:])transition-all(?:[\s"'`]|$)/;

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

  it("does not hide one behind Tailwind's BARE `transition` either", () => {
    /* THE ONE THAT GOT PAST THE FIRST VERSION OF THIS TEST. Tailwind's
       suffix-less `transition` class is not a harmless shorthand: its property
       list is color, background-color, border-color, text-decoration-color,
       fill, stroke, opacity, BOX-SHADOW, transform, filter and
       backdrop-filter. Three of those cannot be composited. It read as
       innocuous in a className and the shadow scanners above could not see it,
       which is exactly why it is worth its own assertion. */
    const bare = /(?:^|[\s"'`])transition(?:[\s"'`]|$)/;
    const offenders = SCANNED.flatMap((file) =>
      file.code
        .split("\n")
        .map((line, index) => [index + 1, line] as const)
        .filter(([, line]) => /className|cva\(|cn\(|"/.test(line) && bare.test(line))
        .map(([number, line]) => `${file.rel}:${number} — ${line.trim().slice(0, 100)}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe("no layout property is animated", () => {
  /* Hard constraint: width, height, top, left, margin and padding invalidate
     layout for the whole subtree on every frame. `transition-[width,height]`
     and friends are the Tailwind spelling, and four of them were hiding in the
     shadcn sidebar. CardThread's `grid-template-rows` unfold is the one
     knowing exception and is allowed by name — see the note at UNFOLD_MS. */
  const LAYOUT = /^(max-|min-)?(width|height|top|left|right|bottom|margin|padding|inset|flex-basis)/;

  it("finds none in a Tailwind arbitrary transition-property", () => {
    const offenders = SCANNED.flatMap((file) =>
      [...file.code.matchAll(/transition-\[([^\]]+)\]/g)]
        .filter((m) => LAYOUT.test(m[1]))
        .map((m) => `${file.rel} — transition-[${m[1]}]`),
    );
    expect(offenders).toEqual([]);
  });

  it("finds none in a CSS or inline transition, bar the one named exception", () => {
    /* THE PROPERTY LIST IS PARSED, NOT GREPPED FOR. A line-level match reports
       `transition: 'color 0.15s'` sitting beside `padding: '4px 8px'`, and
       `opacity ${isDesktop ? 200 : 280}ms` for the `top` inside `isDesktop`.
       Only the first token of each comma-separated part of the transition's own
       value is a property name, so only that is checked.

       `stroke-width` is not on the list: it is an SVG paint attribute and
       reflows nothing. `grid-template-rows` is the one knowing exception, and
       it is named at UNFOLD_MS in CardThread rather than waved through here. */
    const value = /transition(?:-property)?\s*[:=]\s*(["'`])([^"'`]*)\1/g;

    const offenders = SCANNED.flatMap((file) => {
      const found: string[] = [];
      for (const [index, line] of file.code.split("\n").entries()) {
        for (const match of line.matchAll(value)) {
          for (const part of match[2].split(",")) {
            const property = part.trim().split(/\s+/)[0];
            if (property === "grid-template-rows" || property === "stroke-width") continue;
            if (LAYOUT.test(property)) {
              found.push(`${file.rel}:${index + 1} — transition on \`${property}\``);
            }
          }
        }
      }
      return found;
    });
    expect(offenders).toEqual([]);
  });
});

describe("no stylesheet declares its own duration", () => {
  /* The four .css files are the only place a transition can be written without
     going through motion.ts, so they read the `--motion-*` custom properties
     the module mirrors. A literal here is a twelfth duration waiting to happen.
     0.01ms in the global reduced-motion reset is the deliberate exception and
     is matched by name. */
  it("every transition in a .css file spends a --motion token", () => {
    const offenders = SCANNED.filter((file) => file.rel.endsWith(".css")).flatMap((file) =>
      file.code
        .split("\n")
        .map((line, index) => [index + 1, line] as const)
        .filter(([, line]) => /transition(?:-duration)?\s*:/.test(line))
        .filter(([, line]) => /[0-9]/.test(line))
        .filter(([, line]) => !line.includes("0.01ms") && !line.includes("0s"))
        .filter(([, line]) => !line.includes("var(--motion-"))
        .map(([number, line]) => `${file.rel}:${number} — ${line.trim().slice(0, 100)}`),
    );
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

describe("scroll reveals live on the two sanctioned surfaces only", () => {
  /* `buildgallery-theme` §Motion: "Only on the gallery grid and build-page
     sections. App surfaces get list entrances and skeletons — never scroll
     storytelling." A working surface that withholds its content until you
     scroll to it is a surface arguing with the person trying to use it, and
     this is the assertion that keeps the third one from being added quietly. */
  const SANCTIONED = ["src/pages/BuildPage.tsx", "src/pages/Gallery.tsx"];

  it("is imported by exactly those two", () => {
    const importers = SCANNED.filter((file) => /from ["'][^"']*useReveal["']/.test(file.code))
      .map((file) => file.rel)
      .sort();
    expect(importers).toEqual(SANCTIONED);
  });

  it("is the only IntersectionObserver-driven entrance in the product", () => {
    /* An observer used for anything ELSE is fine and there are three: a read
       receipt in the DM bubble, infinite scroll on a profile, and a sticky
       upload header. What would be a reveal gone around this hook is an
       observer whose own callback sets opacity or a translate, so only the
       callback is scanned rather than the whole file — scanning the file
       flags all three of those for mentioning `opacity` elsewhere. */
    const offenders = SCANNED.filter((file) => {
      if (SANCTIONED.includes(file.rel) || file.rel.endsWith("lib/theme/useReveal.ts")) return false;
      for (const match of file.code.matchAll(/new IntersectionObserver/g)) {
        const callback = file.code.slice(match.index, (match.index ?? 0) + 400);
        if (/opacity|translateY|setShown|setRevealed/.test(callback)) return true;
      }
      return false;
    }).map((file) => file.rel);
    expect(offenders).toEqual([]);
  });
});

describe("the theme switch (BG-P02, re-verified by BG-P32)", () => {
  const css = readFileSync(join(SRC, "index.css"), "utf8");
  const rule = css.slice(
    css.indexOf(":root[data-theme-changing]"),
    css.indexOf("}", css.indexOf(":root[data-theme-changing]")),
  );

  it("is scoped to the attribute, so it cannot run on first paint", () => {
    // ThemeProvider sets data-theme-changing for exactly the switch's duration
    // and never on the first write, so the rule has nothing to match until a
    // switch is actually in flight.
    expect(rule).toContain(":root[data-theme-changing]");
    const provider = readFileSync(join(SRC, "contexts/ThemeContext.tsx"), "utf8");
    expect(provider).toMatch(/if \(first \|\| prefersReducedMotion\(\)\)/);
  });

  it("crosses colour properties only, at the theme's 180ms", () => {
    expect(rule).toContain("var(--motion-theme)");
    for (const property of ["background-color", "color", "border-color"]) {
      expect(rule).toContain(property);
    }
    expect(rule).not.toMatch(/\btransform\b|\bwidth\b|\bheight\b|box-shadow|\ball\b/);
  });

  it("is absent under reduced motion", () => {
    // The global rule at the end of index.css collapses it along with
    // everything else; ThemeProvider also declines to set the attribute.
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition-duration: 0\.01ms !important/);
  });
});

describe("the global reduced-motion guarantee", () => {
  const css = readFileSync(join(SRC, "index.css"), "utf8");
  const global = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));

  it("reaches every element and both pseudo-elements", () => {
    expect(global).toMatch(/\*,\s*\n\s*\*::before,\s*\n\s*\*::after/);
  });

  it("collapses transitions, animations and smooth scrolling together", () => {
    for (const declaration of [
      "animation-duration: 0.01ms !important",
      "animation-iteration-count: 1 !important",
      "transition-duration: 0.01ms !important",
      "scroll-behavior: auto !important",
    ]) {
      expect(global).toContain(declaration);
    }
  });

  it("finishes rather than cancels, so transitionend still fires", () => {
    /* `none`/`0s` cancels a transition outright and a cancelled transition
       never fires `transitionend` — any component waiting on that event to
       unmount a node or release a lock would hang, for exactly the readers
       least able to work around it. */
    expect(global).not.toMatch(/transition: *none/);
    expect(global).not.toMatch(/animation: *none/);
  });

  it("has a JavaScript half for the scrolls CSS cannot reach", () => {
    /* An explicit `behavior: "smooth"` argument beats the stylesheet, so every
       one of them reads `scrollBehavior()` instead of the literal. */
    const literal = SCANNED.filter(
      (file) => !file.rel.endsWith("lib/theme/motion.ts") && /behavior: *["']smooth["']/.test(file.code),
    ).map((file) => file.rel);
    expect(literal).toEqual([]);
  });
});
