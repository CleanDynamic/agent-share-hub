/* BG-P31 — §Glass's static half: exactly one blur value in the whole codebase.
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

/** Strip comments, so a blur documented in prose is not read as a declaration. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
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

describe("§Glass — one blur value", () => {
  const all = declarations();

  it("finds the declarations at all, so a green run is not an empty scan", () => {
    expect(all.length).toBeGreaterThan(50);
  });

  it("declares exactly one blur value outside the recorded exemptions", () => {
    const values = new Set(all.filter((d) => !EXEMPT[d.file]).map((d) => d.blur));
    const offenders = all
      .filter((d) => !EXEMPT[d.file] && d.blur !== "blur(16px)")
      .map((d) => `${d.file}: ${d.declaration}`);
    expect(offenders, offenders.join("\n")).toEqual([]);
    expect(values).toEqual(new Set(["blur(16px)"]));
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
