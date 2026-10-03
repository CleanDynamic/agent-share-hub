/* UI-P40 — the blur budget: exactly four chrome surfaces may blur — the desktop
 * header, the mobile header, the dock, and the build page's title plate and
 * action dock — and every one of them at the one value. UI-P09b adds ONE more
 * kind of surface to the budget: page-level panels, which blur through the
 * `.bg-glass` class in src/index.css and nowhere else (Panel sets no blur of its
 * own). The files that draw them are BUDGET below; a blur anywhere else fails.
 * Before UI-P40 there were some two hundred declarations across a hundred and
 * fourteen files.
 *
 * BG-P31 — §Glass's static half: exactly one blur value in the whole codebase.
 *
 * WHY THIS IS A SOURCE SCAN AND NOT A BROWSER TEST. The count of blurred
 * surfaces and their nesting are properties of a RENDERED tree and are asserted
 * where they can be seen — `e2e/audit/glass-budget.spec.ts`, over sixteen
 * routes in both rooms. "One blur value" is not: a second value can sit in a
 * component no route in the sweep opens, be perfectly invisible to a browser
 * assertion, and still be a second value the moment somebody navigates to the
 * guild page. The rule is about the codebase, so the test reads the codebase.
 *
 * WHY ONE VALUE MATTERS AT ALL, since a blur radius is not a correctness bug.
 * Two reasons, and neither is tidiness. A blur radius is the most expensive
 * number in a compositing pass, so a codebase with eleven of them has eleven
 * different costs nobody has measured and no single number to reason about.
 * And glass in this system CARRIES LIGHT AND NEVER MEANING — the moment a
 * surface blurs at 4px and its neighbour at 40px, the difference starts saying
 * something, and what it says is an accident.
 *
 * WHAT THIS PROMPT FOUND. Ninety-nine declarations at eleven different values —
 * 2, 4, 8, 12, 14, 16, 18, 20, 24, 28, 40 and 60px — of which the rendered
 * sweep could see exactly one, because the other ten live on surfaces none of
 * the sixteen audited routes opens. All ninety-nine are now `blur(16px)`.
 *
 * RAISING A VALUE IS NOT THE FORBIDDEN FIX. BG-P31's constraint is that the
 * blur must never be REDUCED BELOW 16px to save cost — "a screen needing more
 * glass needs fewer glass elements, not a smaller blur". Normalising 4px up and
 * 60px down to the one value the spec names is the spec being applied, not the
 * cost lever being pulled.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { GLASS_BLUR } from "./controls";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const EXTS = [".ts", ".tsx", ".css"];
const IS_TEST = /\.(test|spec)\.tsx?$/;

/**
 * Files allowed to declare a different blur, with the reason. A RATCHET: it may
 * only shrink.
 */
const EXEMPT: Record<string, string> = {
  "src/components/layout/RightPanelExplore.tsx":
    "An externally-supplied visual shell (neoscale-ui RULE 3, code-review rule 5). " +
    "Editing it is an automatic fail, so its blur is recorded rather than changed. " +
    "It is one surface, on the Explore rail, and the sweep measures it every run.",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTS.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

/** Strip comments, so a blur documented in prose is not read as a declaration, and `@supports` conditions, which
 * ask whether a property exists and paint nothing (`@supports not (backdrop-filter: blur(2px))`, UI-P09b). */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    .replace(/@supports[^{]*\{/g, "@supports {");
}

const DECLARATION =
  /(?:-webkit-)?backdrop-filter\s*:\s*[^;}"'\n]*|(?:[Ww]ebkit)?[Bb]ackdropFilter\s*:\s*["'`][^"'`\n]*["'`]/g;

interface Found {
  file: string;
  blur: string;
  declaration: string;
}

function declarations(): Found[] {
  const found: Found[] = [];
  for (const full of walk(SRC)) {
    const file = relative(ROOT, full).split(sep).join("/");
    if (IS_TEST.test(file)) continue;
    for (const match of code(readFileSync(full, "utf8")).match(DECLARATION) ?? []) {
      for (const blur of match.match(/blur\([\d.]+px\)/g) ?? []) {
        found.push({ file, blur, declaration: match.trim().slice(0, 90) });
      }
    }
  }
  return found;
}

/** The files that draw the four blurred surfaces (UI-P40). */
const BUDGET: Record<string, string> = {
  "src/components/shell/SiteHeader.tsx": "the desktop header",
  "src/components/shell/MobileHeader.tsx": "the mobile header",
  "src/components/shell/Dock.tsx": "the dock",
  "src/components/brand/HeroPlate.tsx": "the build page's title plate",
  "src/pages/site/build/BuildView.tsx": "the build page's action dock",
  "src/index.css": "page-level panels, through the one .bg-glass class (UI-P09b)",
};

/** Every backdrop blur in a file, whatever its value is spelled as: a literal,
 * a constant such as GLASS_BLUR, or a Tailwind `backdrop-blur` class. */
const ANY_BLUR = /(?:-webkit-)?backdrop-filter\s*:\s*(?!none)[^;}"'\n]+|[Bb]ackdropFilter\s*:\s*(?!["'`]none)[^,}\n]+|\bbackdrop-blur\b[\w-[\]]*/g;

function blurredFiles(): Found[] {
  const found: Found[] = [];
  for (const full of walk(SRC)) {
    const file = relative(ROOT, full).split(sep).join("/");
    if (IS_TEST.test(file)) continue;
    for (const match of code(readFileSync(full, "utf8")).match(ANY_BLUR) ?? []) {
      found.push({ file, blur: match, declaration: match.trim().slice(0, 90) });
    }
  }
  return found;
}

describe("§Glass — the blur budget (UI-P40)", () => {
  const all = blurredFiles();

  it("blurs only in the files that draw the four chrome surfaces and the page-level panels", () => {
    const offenders = all
      .filter((d) => !BUDGET[d.file] && !EXEMPT[d.file])
      .map((d) => `${d.file}: ${d.declaration}`);
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("still finds every budgeted surface, so a green run is not an empty scan", () => {
    for (const file of Object.keys(BUDGET)) {
      expect(all.some((d) => d.file === file), `${file} declares no blur`).toBe(true);
    }
  });
});

describe("§Glass — one blur value", () => {
  const all = declarations();

  it("declares exactly one blur value outside the recorded exemptions", () => {
    const values = new Set(all.filter((d) => !EXEMPT[d.file]).map((d) => d.blur));
    const offenders = all
      .filter((d) => !EXEMPT[d.file] && d.blur !== "blur(16px)")
      .map((d) => `${d.file}: ${d.declaration}`);
    expect(offenders, offenders.join("\n")).toEqual([]);
    expect([...values].every((v) => v === "blur(16px)")).toBe(true);
  });

  it("uses the value GLASS_BLUR names, so the constant is the source of truth", () => {
    expect(GLASS_BLUR).toBe("blur(16px) saturate(1.15)");
    const [, radius] = /blur\(([\d.]+px)\)/.exec(GLASS_BLUR)!;
    expect(radius).toBe("16px");
  });

  it("keeps the exemption list honest — every entry still declares a blur", () => {
    for (const [file, why] of Object.entries(EXEMPT)) {
      expect(why.length, `${file} has no reason`).toBeGreaterThan(40);
      expect(
        all.some((d) => d.file === file),
        `${file} is exempted but declares no blur — remove the exemption`,
      ).toBe(true);
    }
  });

  it("never blurs below 16px, which is the one thing the spec forbids outright", () => {
    for (const d of all) {
      const px = Number(/blur\(([\d.]+)px\)/.exec(d.blur)![1]);
      expect(px, `${d.file} blurs at ${px}px`).toBeGreaterThanOrEqual(16);
    }
  });
});

describe("§Glass — liquid glass (UI-P09b)", () => {
  const sources = walk(SRC)
    .filter((full) => !IS_TEST.test(full))
    .map((full) => ({ file: relative(ROOT, full).split(sep).join("/"), text: code(readFileSync(full, "utf8")) }));

  it("uses feDisplacementMap in exactly one file, the one filter mounted by GlassFilter", () => {
    const files = sources.filter((s) => /feDisplacementMap/.test(s.text)).map((s) => s.file);
    expect(files).toEqual(["src/components/brand/GlassFilter.tsx"]);
  });

  it("points at that filter from exactly one stylesheet rule, and nothing else references it", () => {
    const files = sources.filter((s) => /bg-glass-distortion/.test(s.text)).map((s) => s.file).sort();
    expect(files).toEqual(["src/components/brand/GlassFilter.tsx", "src/index.css"]);
    const css = sources.find((s) => s.file === "src/index.css")!.text;
    expect(css.match(/(?<!-webkit-)filter:\s*url\(#bg-glass-distortion\)/g)).toHaveLength(1);
  });

  it("spends the .bg-glass class in Panel and nowhere else", () => {
    const files = sources.filter((s) => /(?<![\w-])bg-glass(?![\w-])/.test(s.text)).map((s) => s.file).sort();
    expect(files).toEqual(["src/components/brand/Panel.tsx", "src/index.css"]);
  });

  it("drops the displacement below 768px and under reduced transparency, and the blur too in the latter", () => {
    const css = readFileSync(join(SRC, "index.css"), "utf8");
    expect(css).toMatch(/@media \(max-width: 767px\) \{\s*\.bg-glass::after \{ filter: none; -webkit-filter: none; \}/);
    expect(css).toMatch(/@media \(prefers-reduced-transparency: reduce\)[\s\S]*?backdrop-filter: none/);
    expect(css).toMatch(/@supports not \(backdrop-filter: blur\(2px\)\)[\s\S]*?filter: none/);
  });
});
