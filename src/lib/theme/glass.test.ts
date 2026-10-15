/* There is no glass (UI-P99). The refined look has none, and since the current look went, nothing blurs: no
 * `.bg-glass` rule, no displacement filter, no `backdrop-filter` in the stylesheet, and no blur in the source outside
 * the one file recorded in EXEMPT.
 *
 * BG-P31 — §Glass's static half: exactly one blur value in the whole codebase.
 *
 * WHY THIS IS A SOURCE SCAN AND NOT A BROWSER TEST. A blur can sit in a component no audited route opens and be
 * invisible to a browser assertion. The rule is about the codebase, so the test reads the codebase.
 *
 * RAISING A VALUE IS NOT THE FORBIDDEN FIX. BG-P31's constraint is that the blur must never be REDUCED BELOW 16px to
 * save cost; the one value the spec names is 16px.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { GLASS_BLUR } from "./controls";
import { dusk, noon } from "./semantics";

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

describe("§Glass — nothing blurs", () => {
  const all = blurredFiles();

  it("blurs only in the files recorded in EXEMPT", () => {
    const offenders = all.filter((d) => !EXEMPT[d.file]).map((d) => `${d.file}: ${d.declaration}`);
    expect(offenders, offenders.join("\n")).toEqual([]);
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

describe("§Glass — the liquid-glass machinery is gone (UI-P99)", () => {
  const sources = walk(SRC)
    .filter((full) => !IS_TEST.test(full))
    .map((full) => ({ file: relative(ROOT, full).split(sep).join("/"), text: code(readFileSync(full, "utf8")) }));

  it("has no feDisplacementMap and no reference to the distortion filter", () => {
    expect(sources.filter((s) => /feDisplacementMap|bg-glass-distortion/.test(s.text)).map((s) => s.file)).toEqual([]);
  });

  it("has no .bg-glass class, in a stylesheet or a component", () => {
    expect(sources.filter((s) => /(?<![\w-])bg-glass(?![\w-])/.test(s.text)).map((s) => s.file)).toEqual([]);
  });

  it("has no blur in the stylesheet", () => {
    const css = sources.find((s) => s.file === "src/index.css")!.text;
    expect(css).not.toMatch(/backdrop-filter|blur\(/);
  });
});

describe("§Glass — the surfaces are opaque (UI-P79)", () => {
  const alpha = (colour: string) => {
    if (/^#[0-9a-f]{6}$/i.test(colour)) return 1;
    const m = /^rgba\(([^)]*)\)$/.exec(colour.replace(/\s/g, ""));
    return m ? Number(m[1].split(",")[3] ?? 1) : NaN;
  };

  it.each([
    ["noon", noon],
    ["dusk", dusk],
  ] as const)("%s: the module and the surface are opaque", (_theme, table) => {
    for (const name of ["module", "surface", "frame"] as const) {
      expect(alpha(table[name]), `--${name} is ${table[name]}`).toBe(1);
    }
  });
});
