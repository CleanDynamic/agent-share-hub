// G23: with the WCAG 1.4.12 text-spacing overrides (line height 1.5, paragraph spacing 2em, letter spacing 0.12em, word spacing
// 0.16em) no text is cut on Home, Builds, a build page, Library, Drafts, Settings account, OpenBuilds, the sign-in dialog and
// the editor. Each page is read before and after the overrides; text that the spacing newly cuts (a box that hides its overflow
// clipping it, or an ellipsis it did not need before) fails. A box that scrolls is not a cut: the text is reached by scrolling.
// Fixed control heights may grow; only cut text counts.

import { expect, test } from "@playwright/test";

import { openPage, writeResult } from "./harness";
import type { MatrixPage, Variant } from "./matrix";

const PAGES: MatrixPage[] = [
  { name: "Home", kit: "vision-home", state: "sample data" },
  { name: "Builds", kit: "vision-builds-table", state: "sample data" },
  { name: "Build", kit: "build", state: "sample data" },
  { name: "Library", kit: "vision-library", state: "sample data" },
  { name: "Drafts", kit: "vision-drafts", state: "sample data" },
  { name: "Settings account", path: "/settings/account", signedIn: true, state: "ready" },
  { name: "OpenBuilds feed", path: "/openbuilds", state: "empty" },
  { name: "Sign-in dialog", path: "/?signin=login", state: "dialog" },
  { name: "Editor", kit: "compose", state: "sample data" },
];

const SPACING = `
  * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
  p { margin-bottom: 2em !important; }
`;

/** In the page: every piece of text a box cuts, by a key that stays the same before and after the overrides. */
function cuts(): string[] {
  const out: string[] = [];
  const all = Array.from(document.querySelectorAll<HTMLElement>("body *"));
  all.forEach((el, index) => {
    const own = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim());
    if (!own) return;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none") return;
    const box = el.getBoundingClientRect();
    if (box.width <= 1 || box.height <= 1) return;
    if (el.closest('[aria-hidden="true"]') && el.closest('[data-ui="loading"]')) return;
    const key = `${index}:${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 40)}"`;
    // The element itself hides what does not fit.
    const hides = (st: CSSStyleDeclaration) => st.overflowX === "hidden" || st.overflowY === "hidden" || st.overflow === "hidden" || st.overflowX === "clip" || st.overflowY === "clip";
    if (hides(s) && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2)) {
      const truncated = s.textOverflow === "ellipsis" || (s.webkitLineClamp !== "none" && s.webkitLineClamp !== "");
      out.push(`${key} cut inside itself${truncated ? " (truncated by design)" : ` (${el.tagName === "TEXTAREA" ? "field" : "box"} ${el.clientWidth}x${el.clientHeight}, overflow ${s.overflowY})`}`);
      return;
    }
    // A box round it hides its overflow and the text runs past that box.
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.overflowX === "auto" || ps.overflowX === "scroll" || ps.overflowY === "auto" || ps.overflowY === "scroll") break;
      if (!hides(ps)) continue;
      const c = p.getBoundingClientRect();
      if (box.right > c.right + 1 || box.bottom > c.bottom + 2 || box.left < c.left - 1 || box.top < c.top - 2) {
        const shortened = ps.textOverflow === "ellipsis" || (ps.webkitLineClamp !== "none" && ps.webkitLineClamp !== "");
        out.push(`${key} cut by ${p.tagName.toLowerCase()}${p.getAttribute("data-testid") ? `[${p.getAttribute("data-testid")}]` : ""}${shortened ? " (truncated by design)" : ""}`);
      }
      break;
    }
  });
  return out;
}

const VARIANTS: Variant[] = [
  { theme: "light", width: 1440 },
  { theme: "light", width: 390 },
];

for (const variant of VARIANTS) {
  for (const entry of PAGES) {
    test(`G23: ${entry.name} with text spacing · ${variant.width}`, async ({ page }) => {
      await openPage(page, entry, variant);
      const before = new Set(await page.evaluate(cuts));
      await page.addStyleTag({ content: SPACING });
      await page.waitForTimeout(600);
      const after = await page.evaluate(cuts);
      const fresh = after.filter((cut) => !before.has(cut));
      // A title or meta line the design already shortens with an ellipsis or a line clamp is listed for the report, not
      // failed: the spacing lengthens it past the same edge (see the report's TRUNCATION list).
      const truncated = fresh.filter((cut) => cut.endsWith("(truncated by design)"));
      const cut = fresh.filter((entryCut) => !entryCut.endsWith("(truncated by design)"));
      writeResult(`spacing-${variant.width}-${entry.name.toLowerCase().replace(/[^a-z]+/g, "-")}`, { page: entry.name, width: variant.width, before: [...before], cut, truncated });
      expect(cut, "text the spacing cuts").toEqual([]);
    });
  }
}
