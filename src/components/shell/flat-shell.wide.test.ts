import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

/* BG-P18b CHANGED FOUR OF THE SIX NUMBERS THIS BLOCK GUARDED, and the
   assertions are rewritten rather than removed, because what they are for is
   unchanged: the frame has a measurement contract and a reader should be able
   to read it here. The frame is still 1200 and the rails are still 240 and 300
   — those four never move. What moved is the reading column (600 → 634, which
   is 1 + 16 + 600 + 16 + 1, so a CARD is 600 where before the column was 600
   and the card 568) and the frame's inset (24px padding and a 24px gap → 0,
   which is what lets the three columns meet as one surface). Wide mode keeps
   the old inset; that is asserted below. */
describe("the standard mode's measurements", () => {
  it("keeps 1200 / 240 / 300, and states the reading column at 634", () => {
    expect(decl(".fs-frame", "max-width")).toBe("1200px");
    expect(decl(".fs-left", "width")).toBe("240px");
    expect(decl(".fs-right", "width")).toBe("300px");
    expect(decl(".fs-centre", "width")).toBe("634px");
  });

  it("closes the frame's padding and gap, so the three columns meet", () => {
    expect(decl(".fs-frame", "padding")).toBe("0");
    expect(decl(".fs-frame", "gap")).toBe("0");
  });

  it("gives the centre 16px of padding and a hairline on each side", () => {
    // 634 = 1 + 16 + 600 + 16 + 1 under `box-sizing: border-box`, which is what
    // makes a card exactly 600. The two hairlines are the only separation
    // between the three columns; neither rail carries one.
    expect(decl(".fs-centre", "padding")).toBe("0 16px");
    expect(decl(".fs-centre", "border-left")).toBe("1px solid var(--line)");
    expect(decl(".fs-centre", "border-right")).toBe("1px solid var(--line)");
    expect(decl(".fs-centre", "box-sizing")).toBe("border-box");
    expect(decl(".fs-centre", "min-height")).toBe("100dvh");
  });

  it("keeps the 768 and 1024 breakpoints", () => {
    expect(css).toContain("@media (min-width: 768px) and (max-width: 1023px)");
    expect(css).toContain("@media (max-width: 767px)");
  });

  it("lets the reading column give way rather than pushing a rail off-screen", () => {
    /* `flex-shrink: 0` was why standard mode was "600px, full stop". At
       1024–1173 all three columns render and 1174 does not fit, and a pinned
       centre put the left rail at x = -82. The centre is shrinkable now, so
       that band loses measure instead of losing the nav; above 1174 of frame
       nothing shrinks and the column is exactly 634. */
    expect(decl(".fs-centre", "flex")).toBe("0 1 auto");
    expect(decl(".fs-centre", "min-width")).toBe("0");
  });

  it("puts no panel on either rail: no fill, no border, no radius, no blur", () => {
    expect(decl(".fs-rail", "background")).toBe("transparent");
    expect(decl(".fs-rail", "border")).toBe("none");
    expect(decl(".fs-rail", "border-radius")).toBe("0");
    expect(decl(".fs-rail", "box-shadow")).toBe("none");
    // The rails are full-height sticky panels, which the theme never blurs.
    expect(css).not.toMatch(/backdrop-filter/);
  });

  it("makes both rails sticky at full viewport height", () => {
    expect(decl(".fs-rail", "position")).toBe("sticky");
    expect(decl(".fs-rail", "top")).toBe("0");
    expect(decl(".fs-rail", "height")).toBe("100dvh");
    expect(decl(".fs-rail", "overscroll-behavior")).toBe("contain");
    // Hidden scrollbars, the codebase's existing utility, on both.
    expect(decl(".fs-left", "scrollbar-width")).toBe("none");
    expect(decl(".fs-right", "scrollbar-width")).toBe("none");
  });

  it("states the rails' padding, and nothing else on the rail element", () => {
    expect(decl(".fs-left", "padding")).toBe("24px 16px 24px 16px");
    expect(decl(".fs-right", "padding")).toBe("16px 0 24px 24px");
  });

  it("paints nothing behind the frame", () => {
    expect(decl(".fs-root", "background")).toBe("transparent");
    expect(decl(".fs-frame", "background")).toBe("transparent");
    // The home wrapper's 16px inset moved onto the column; keeping both would
    // put the cards back at 568.
    expect(decl(".fs-home-pad", "padding")).toBe("0");
  });
});

/* BG-P18b — the page ground, asserted where it is declared.
   jsdom resolves no custom properties and computes no cascade worth reading, so
   the browser half of this is `e2e/tier3/home-ground.spec.ts`, which reads the
   resolved colour off #root in both themes. This is the half that runs in CI on
   every commit: that the declaration exists at all, and that nothing in the
   stylesheet paints an image behind the page. */
describe("one ground", () => {
  const indexCss = readFileSync("src/index.css", "utf-8");
  const bare = indexCss.replace(/\/\*[\s\S]*?\*\//g, "");

  it("gives html, body and #root the --bg token and nothing else", () => {
    expect(bare).toMatch(/html,\s*body,\s*#root\s*\{[^}]*background:\s*var\(--bg\)/);
    expect(bare).toMatch(/#root\s*\{[^}]*min-height:\s*100dvh/);
  });

  it("declares --bg per theme and no longer in the legacy block", () => {
    expect(bare).toMatch(/:root,\s*:root\[data-theme="exhibition"\]\s*\{[^}]*--bg:\s*#E4E6E8/);
    expect(bare).toMatch(/:root\[data-theme="dusk"\]\s*\{[^}]*--bg:\s*#1F1B2B/);
    expect(bare).not.toContain("#25252F");
  });

  it("paints no pattern anywhere in either stylesheet", () => {
    // BlobBackground's dot grid was a `radial-gradient` at `background-size:
    // 20px 20px`. Nothing on this route may carry a background image.
    for (const text of [bare, css]) {
      expect(text).not.toMatch(/background-image/);
      expect(text).not.toMatch(/radial-gradient/);
    }
  });

  it("has no BlobBackground left to mount", () => {
    expect(existsSync(join(process.cwd(), "src/components/BlobBackground.tsx"))).toBe(false);
    expect(readFileSync("src/App.tsx", "utf-8").replace(/\/\*[\s\S]*?\*\//g, ""))
      .not.toContain("BlobBackground");
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
      /* BG-P18b. Four more, and every one of them is here to keep wide mode
         rendering as it did. The standard frame lost its 24px padding and gap
         and the centre gained 16px of inline padding and two hairlines when the
         three columns became one surface; a wide page is a grid in a frame with
         no reading column, so it keeps the inset and takes neither the padding
         nor the lines. `border-*-width: 0` is a measurement and names no
         colour, which is what this check is actually for. */
      "padding", "border-left-width", "border-right-width",
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
