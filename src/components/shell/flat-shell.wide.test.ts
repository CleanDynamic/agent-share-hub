import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SPACE } from "@/lib/theme/space";

/* ────────────────────────────────────────────────────────────────────────────
   BG-P14 — flat-shell.css, held to the two things this prompt promised.

   ONE: the standard mode did not move. The frame is 1200, the rails are 240
   and 300, the reading column is 600, and the two breakpoints are 768 and
   1024. Those six numbers are the whole measurement contract of the frame that
   ships today, and a wide mode that changed any of them would change every
   page in the application rather than the three BG-P15 is for. Asserted as
   text in the stylesheet rather than as rendered geometry because jsdom has no
   layout engine — the rendered proof is the browser sweep in
   e2e/tier1/wide-layout.spec.ts, and this is the half that runs in CI.

   TWO: the wide mode is additive. Every selector added by this prompt is
   scoped under `.fs-wide`, and every declaration under it is a measurement.
   Both are checked mechanically below, because "scoped" and "no colours" are
   exactly the kind of promise that decays one convenient rule at a time.
   ──────────────────────────────────────────────────────────────────────────── */

const PATH = "src/components/shell/flat-shell.css";
const raw = readFileSync(PATH, "utf-8");
const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");

/** The file split at the BG-P14 banner: what shipped before, and what this prompt added.
    Sliced from the END of the banner comment, so the section starts on a rule
    and the comment stripper below sees balanced delimiters. */
const MARKER = "BG-P14 — WIDE MODE";
const markerAt = raw.indexOf(MARKER);
const wideSection = raw.slice(raw.indexOf("*/", markerAt) + 2).replace(/\/\*[\s\S]*?\*\//g, "");

/** Every innermost `selector { declarations }` block, media wrappers stripped. */
function rules(source: string): { selector: string; decls: string }[] {
  const out: { selector: string; decls: string }[] = [];
  for (const m of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    if (selector.startsWith("@")) continue;
    out.push({ selector, decls: m[2].trim() });
  }
  return out;
}

/** The declared value of `prop` in the first rule whose selector is exactly `sel`. */
function decl(sel: string, prop: string): string | null {
  for (const rule of rules(css)) {
    if (rule.selector !== sel) continue;
    const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "m").exec(rule.decls);
    if (m) return m[1].trim();
  }
  return null;
}

describe("the standard mode's measurements are untouched", () => {
  it("keeps 1200 / 240 / 300 / 600", () => {
    expect(decl(".fs-frame", "max-width")).toBe("1200px");
    expect(decl(".fs-left", "width")).toBe("240px");
    expect(decl(".fs-right", "width")).toBe("300px");
    expect(decl(".fs-centre", "width")).toBe("600px");
  });

  it("keeps the frame's 24px padding and gap", () => {
    expect(decl(".fs-frame", "padding")).toBe("24px");
    expect(decl(".fs-frame", "gap")).toBe("24px");
  });

  it("keeps the 768 and 1024 breakpoints", () => {
    expect(css).toContain("@media (min-width: 768px) and (max-width: 1023px)");
    expect(css).toContain("@media (max-width: 767px)");
  });

  it("keeps the reading column pinned — .fs-centre does not flex in standard mode", () => {
    /* `flex-shrink: 0` on a 600px column is why standard mode is 600px and not
       "600px until something pushes". Wide mode overrides it under .fs-wide;
       the base rule must still say it. */
    expect(decl(".fs-centre", "flex-shrink")).toBe("0");
  });
});

describe("the wide mode is additive", () => {
  const wideRules = rules(wideSection);

  it("adds at least the four rules the mode needs", () => {
    expect(wideRules.length).toBeGreaterThanOrEqual(4);
  });

  it("scopes every added selector under .fs-wide", () => {
    for (const { selector } of wideRules) {
      for (const part of selector.split(",")) {
        expect([part.trim(), part.includes(".fs-wide")]).toEqual([part.trim(), true]);
      }
    }
  });

  it("declares measurements only — no colours", () => {
    /* The theme's rule: a stylesheet may carry measurements, and colour comes
       from tokens. Allow-list rather than deny-list, so a colour property
       nobody thought to ban still fails this. */
    const STRUCTURAL = new Set([
      "max-width", "width", "min-width", "flex", "display",
      "grid-template-columns", "gap", "align-items",
    ]);
    for (const { selector, decls } of wideRules) {
      for (const line of decls.split(";")) {
        const prop = line.split(":")[0]?.trim();
        if (!prop) continue;
        expect([selector, prop, STRUCTURAL.has(prop)]).toEqual([selector, prop, true]);
      }
    }
    expect(wideSection).not.toContain("var(--");
  });
});

describe("the wide mode's own measurements", () => {
  it("opens the frame to 1600px", () => {
    expect(decl(".fs-wide .fs-frame", "max-width")).toBe("1600px");
  });

  it("unpins the centre and lets it shrink", () => {
    expect(decl(".fs-wide .fs-centre", "width")).toBe("auto");
    expect(decl(".fs-wide .fs-centre", "max-width")).toBe("none");
    expect(decl(".fs-wide .fs-centre", "flex")).toBe("1 1 0%");
    expect(decl(".fs-wide .fs-centre", "min-width")).toBe("0");
  });

  it("leaves the left rail at 240px — the wide mode never touches it", () => {
    expect(wideSection).not.toContain(".fs-left");
  });

  it("lays the opt-in grid out in auto-filled 320px columns", () => {
    expect(decl(".fs-wide .fs-grid", "display")).toBe("grid");
    expect(decl(".fs-wide .fs-grid", "grid-template-columns")).toBe(
      "repeat(auto-fill, minmax(320px, 1fr))",
    );
  });

  it("takes both gutters from the spacing scale", () => {
    expect(decl(".fs-wide .fs-grid", "gap")).toBe(`${SPACE.md}px`);
    expect(wideSection).toContain("@media (min-width: 1280px)");
    /* The 40px gutter is the `lg` step and lives in the 1280 query. */
    const above1280 = wideSection.slice(wideSection.indexOf("@media (min-width: 1280px)"));
    expect(above1280).toContain(`gap: ${SPACE.lg}px`);
  });

  it("holds the grid to one column below 768, where the two modes are identical", () => {
    const mobile = wideSection.slice(wideSection.indexOf("@media (max-width: 767px)"));
    expect(mobile).toContain("grid-template-columns: 1fr");
  });

  it("gives the optional right rail back below 1280", () => {
    const below1280 = wideSection.slice(wideSection.indexOf("@media (max-width: 1279px)"));
    expect(below1280).toContain(".fs-wide .fs-right");
    expect(below1280).toContain("display: none");
    /* Never at the cost of the blueprint editor's forced rail. */
    expect(below1280).toContain(":not(.fs-right--force)");
  });

  it("applies nothing at all below 768 except the one-column grid", () => {
    /* The two modes are identical on a phone by construction rather than by
       arithmetic: the frame and centre rules sit inside a min-width: 768 query
       so a narrower viewport never sees them. */
    const guarded = wideSection.slice(
      wideSection.indexOf("@media (min-width: 768px)"),
      wideSection.indexOf("@media (max-width: 1279px)"),
    );
    expect(guarded).toContain(".fs-wide .fs-frame");
    expect(guarded).toContain(".fs-wide .fs-centre");
  });
});
