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
  [RAIL]: [
    "ns-auth-btn", "ns-auth-btns", "ns-collection-item", "ns-curator-avatar",
    "ns-curator-item", "ns-follow-avatar", "ns-follow-handle", "ns-follow-info",
    "ns-follow-item", "ns-follow-name", "ns-footer-link", "ns-footer-links",
    "ns-right-divider", "ns-right-search", "ns-right-search-results",
    "ns-right-title", "ns-search-result", "ns-search-result-badge",
    "ns-search-result-title", "ns-section-title", "ns-tile", "ns-tile-grid",
    "ns-tile-label", "ns-trending-badge", "ns-trending-info", "ns-trending-item",
    "ns-trending-list", "ns-trending-name", "ns-trending-rank", "ns-trending-title",
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

  it("resolves none of them through NeoScaleShell", () => {
    // The whole point of the extraction. Asserted against the file only while
    // it still exists, so this keeps working once BG-P17 deletes it.
    const shell = "src/components/NeoScaleShell.tsx";
    if (!existsSync(join(process.cwd(), shell))) return;
    const text = read(shell);
    for (const [path, classes] of Object.entries(DEFINITIONS)) {
      for (const cls of classes) {
        if (!defines(text, cls)) continue;
        expect(
          defines(read(path), cls),
          `.${cls} is defined in the shell and would be lost when it goes`,
        ).toBe(true);
      }
    }
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
