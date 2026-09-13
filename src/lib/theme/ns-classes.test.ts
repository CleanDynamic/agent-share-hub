/* BG-P17 — the .ns-* rules the retired shell left behind.
 *
 * WHY THIS FILE EXISTS. NeoScaleShell carried its own CSS in an injected
 * <style> block, and components all over the application still wear the
 * .ns-* class names that block defined. Earlier prompts copied the rules those
 * components need into real stylesheets so the shell could go. This test is the
 * proof that the copy is complete and stays complete: if a stylesheet, one of
 * its rules, or one of the two imports that mount them is ever removed, a live
 * surface loses its styling silently — nothing throws, the class simply stops
 * resolving — and only an assertion like this one catches it.
 *
 * IT IS DELIBERATELY A LIST AND NOT A SCANNER. A scanner that harvested every
 * `ns-` token out of src would also collect the `ns-resize` cursor keyword and
 * the `ns-p46-…` strings that name test cases, and would need an allowlist to
 * suppress them — which is the same list as this one, kept further from the
 * thing it describes. The map below is the audit BG-P17 ran, written down.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** Comments name these classes in prose — including the header this prompt
 *  wrote — so a match inside one would read as a definition. Strip both comment
 *  syntaxes before looking for a selector. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

/** A CSS rule head for `cls`, e.g. `.ns-tile {` or `.ns-tile:hover,`. */
const defines = (text: string, cls: string) =>
  new RegExp(`\\.${cls}(?![A-Za-z0-9_-])`).test(code(text));

/* Where every .ns-* class a live file wears is actually defined. */
const SHARED = "src/styles/shared-ns.css";
const RAIL = "src/components/shell/right-rail-explore.css";

const DEFINITIONS: Record<string, string[]> = {
  [SHARED]: ["ns-back-btn", "ns-section-label", "ns-engagement-bar", "ns-comment-drawer"],
  /* BG-P18b removed sixteen names from this list, and removed their rules from
     the stylesheet in the same commit. This list is "where every class a LIVE
     FILE WEARS is defined", so a class no live file wears any more does not
     belong in it — keeping the name here would assert that a dead rule must
     stay, which is the opposite of what the test is for. What went, and why, is
     written at the top of the rail's stylesheet: the "EXPLORE" eyebrow, the
     three Browse tiles, the Browse/Trending divider, the seven trending-row
     classes, the second spelling of the section heading, the duplicated auth
     pair, and the footer's container. */
  [RAIL]: [
    "ns-collection-item", "ns-curator-avatar", "ns-curator-item",
    "ns-follow-avatar", "ns-follow-handle", "ns-follow-info", "ns-follow-item",
    "ns-follow-name", "ns-footer-link", "ns-right-search",
    "ns-right-search-results", "ns-search-result", "ns-search-result-badge",
    "ns-search-result-title",
  ],
  "src/index.css": ["ns-badge"],
  /* These three never left their consumer, so the rule and the markup that
     wears it live in one file and cannot drift apart. */
  "src/components/library/LibraryShell.tsx": ["ns-collections-grid"],
  "src/components/library/CollectionDetailPage.tsx": ["ns-detail-grid"],
  "src/components/content-detail/PrimitiveCommentDrawer.tsx": ["ns-comment-new-reply"],
};

describe("the .ns-* rules inherited from the retired shell", () => {
  it("defines every class a live file wears, outside NeoScaleShell", () => {
    for (const [path, classes] of Object.entries(DEFINITIONS)) {
      const text = read(path);
      for (const cls of classes) {
        expect(defines(text, cls), `${path} no longer defines .${cls}`).toBe(true);
      }
    }
  });

  it("keeps both extracted stylesheets mounted", () => {
    // A stylesheet nobody imports is the same as a stylesheet that was deleted.
    expect(read("src/main.tsx")).toMatch(/import\s+["']\.\/styles\/shared-ns\.css["']/);
    expect(read("src/components/shell/RightRailExplore.tsx")).toMatch(
      /import\s+["']\.\/right-rail-explore\.css["']/,
    );
  });

  it("no longer resolves anything through NeoScaleShell", () => {
    // The shell is gone as of BG-P17, so nothing can resolve through it. Kept
    // as an assertion rather than dropped: if the file ever returns, whoever
    // brings it back is told to re-check that the rules above are still
    // defined outside it, which is the condition that made deleting it safe.
    const shell = join(process.cwd(), "src/components/NeoScaleShell.tsx");
    expect(
      existsSync(shell),
      "NeoScaleShell is back — re-check that every class above is defined outside it",
    ).toBe(false);
  });

  it("still finds nothing behind the three inert class names", () => {
    // .ns-btn-primary, .ns-btn-silver and .ns-right-cat are worn by live
    // markup but were never defined anywhere, including in the shell — they
    // were already doing nothing before the deletion. If one of them ever
    // gains a rule, the surfaces wearing it change appearance, and whoever
    // adds it should have to come here and say so.
    const inert = ["ns-btn-primary", "ns-btn-silver", "ns-right-cat"];
    const sheets = [SHARED, RAIL, "src/index.css", "src/components/shell/flat-shell.css", "src/App.css"];
    for (const cls of inert) {
      for (const sheet of sheets) {
        expect(defines(read(sheet), cls), `${sheet} now defines .${cls}`).toBe(false);
      }
    }
  });
});
