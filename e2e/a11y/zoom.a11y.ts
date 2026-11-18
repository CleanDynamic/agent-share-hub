// G22: at 200% zoom on a 1280 window (640 CSS pixels) and at 400% (320), nothing is cut off and no control overlaps another,
// on Home, Builds, a build page, Library, Drafts, Settings account, OpenBuilds, the sign-in dialog and the editor. Browser zoom
// is a narrower viewport in CSS pixels at a higher device scale, which is what this sets. Each page is checked for: no
// sideways scroll; every control inside the window's width; no two controls overlapping; no text clipped by a box that hides
// overflow (an ellipsis drawn on purpose is listed, not failed). A full-page screenshot of each is written for the report.
// The real addresses with the network faked: a build page shows its not-found state, and the lists are empty.

import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

import { RESULTS, openPage, writeResult } from "./harness";
import type { MatrixPage } from "./matrix";

const PAGES: MatrixPage[] = [
  { name: "Home", path: "/", signedIn: true, state: "empty" },
  { name: "Builds", path: "/builds", state: "empty" },
  { name: "Build", path: "/b2/a11y-missing", state: "not found" },
  { name: "Library", path: "/library", signedIn: true, state: "empty" },
  { name: "Drafts", path: "/drafts", signedIn: true, state: "empty" },
  { name: "Settings account", path: "/settings/account", signedIn: true, state: "ready" },
  { name: "OpenBuilds feed", path: "/openbuilds", state: "empty" },
  { name: "Sign-in dialog", path: "/?signin=login", state: "dialog" },
  { name: "Editor", path: "/compose/new", signedIn: true, ready: ".ProseMirror", state: "ready" },
];

const ZOOMS = [
  { zoom: 200, width: 640, height: 400, scale: 2 },
  { zoom: 400, width: 320, height: 200, scale: 4 },
  // A phone at its own size, where the header and the dock stay pinned: focus must still never land under them.
  { zoom: 100, width: 390, height: 844, scale: 2 },
] as const;

/** In the page: what is cut off or overlaps. */
function inspect(width: number) {
  const CONTROLS = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="radio"], [role="checkbox"], [role="switch"], [role="menuitem"], [tabindex="0"]';
  const shown = (el: Element) => {
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false;
    for (let n: Element | null = el; n; n = n.parentElement) if (n.closest('[aria-hidden="true"], [inert]')) return false;
    return true;
  };
  const label = (el: Element) => `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}"`;
  const scroll = document.documentElement.scrollWidth;
  const controls = Array.from(document.querySelectorAll(CONTROLS)).filter(shown);
  const outside = controls
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    // A control inside a box that scrolls sideways on purpose (a table, a strip of tabs) is reached by scrolling it.
    .filter(({ el }) => !(function scrolls(n: Element | null): boolean {
      for (let p = n?.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if ((s.overflowX === "auto" || s.overflowX === "scroll") && p.scrollWidth > p.clientWidth) return true;
      }
      return false;
    })(el))
    .filter(({ r }) => r.left < -1 || r.right > width + 1)
    .map(({ el, r }) => `${label(el)} ${Math.round(r.left)}..${Math.round(r.right)}`);
  // A control's box as it is seen: cut to every box round it that hides or scrolls its overflow.
  const seenBox = (el: Element) => {
    const r = el.getBoundingClientRect();
    let { left, right, top, bottom } = r;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.overflowX === "visible" && s.overflowY === "visible") continue;
      const c = p.getBoundingClientRect();
      left = Math.max(left, c.left);
      right = Math.min(right, c.right);
      top = Math.max(top, c.top);
      bottom = Math.min(bottom, c.bottom);
    }
    return { left, right, top, bottom };
  };
  /** The header and the dock stay put while the page scrolls under them: they are checked with focus (obscured), not here. */
  const pinned = (el: Element) => {
    for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
      const position = getComputedStyle(n).position;
      if (position === "fixed" || position === "sticky") return true;
    }
    return false;
  };
  const inFlow = controls.filter((el) => !pinned(el));
  const overlaps: string[] = [];
  for (let i = 0; i < inFlow.length; i++) {
    for (let j = i + 1; j < inFlow.length; j++) {
      const a = inFlow[i];
      const b = inFlow[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = seenBox(a);
      const rb = seenBox(b);
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      // Hit areas grown with negative margins touch by design; an overlap is more than a sliver.
      if (w > 4 && h > 4) overlaps.push(`${label(a)} × ${label(b)} (${Math.round(w)}×${Math.round(h)})`);
    }
  }
  const clipped: string[] = [];
  const ellipsis: string[] = [];
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    if (!shown(el) || !(el instanceof HTMLElement) || el.children.length > 0 || !(el.textContent ?? "").trim()) continue;
    const s = getComputedStyle(el);
    if (s.overflowX !== "hidden" && s.overflow !== "hidden" && s.overflowY !== "hidden") continue;
    const cut = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2;
    if (!cut) continue;
    (s.textOverflow === "ellipsis" || s.webkitLineClamp !== "none" ? ellipsis : clipped).push(label(el));
  }
  return { scroll, outside, overlaps: overlaps.slice(0, 12), clipped: clipped.slice(0, 12), ellipsis: ellipsis.slice(0, 12) };
}

for (const z of ZOOMS) {
  for (const entry of PAGES) {
    test(`G22: ${entry.name} at ${z.zoom}%`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: z.width, height: z.height }, deviceScaleFactor: z.scale });
      const page = await context.newPage();
      // openPage sets the viewport from a matrix width; put the zoom's back after it.
      await openPage(page, entry, { theme: "light", width: 390 });
      await page.setViewportSize({ width: z.width, height: z.height });
      await page.waitForTimeout(800);
      const seen = await page.evaluate(inspect, z.width);
      // WCAG 2.4.11: Tab through the page; a focused control must not be entirely under the header or the dock.
      const obscured: string[] = [];
      for (let press = 0; press < 80; press++) {
        await page.keyboard.press("Tab");
        const hidden = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return "body";
          const pinned = (n: Element | null) => {
            for (; n && n !== document.body; n = n.parentElement) {
              const p = getComputedStyle(n).position;
              if (p === "fixed" || p === "sticky") return true;
            }
            return false;
          };
          if (pinned(el)) return null;
          const r = el.getBoundingClientRect();
          const points = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 2, r.top + 2], [r.right - 2, r.top + 2], [r.left + 2, r.bottom - 2], [r.right - 2, r.bottom - 2]];
          const covered = points.every(([x, y]) => {
            const at = document.elementFromPoint(x, y);
            return !at || (!el.contains(at) && !at.contains(el) && pinned(at));
          });
          return covered ? `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)}"` : null;
        });
        if (hidden === "body") break;
        if (hidden) obscured.push(hidden);
      }
      const dir = path.join(RESULTS, "zoom");
      fs.mkdirSync(dir, { recursive: true });
      const shot = path.join(dir, `${entry.name.toLowerCase().replace(/[^a-z]+/g, "-")}-${z.zoom}.png`);
      await page.evaluate(() => {
        (document.activeElement as HTMLElement | null)?.blur();
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(200);
      await page.screenshot({ path: shot, fullPage: true, animations: "disabled", caret: "hide", scale: "css" });
      writeResult(`zoom-${z.zoom}-${entry.name.toLowerCase().replace(/[^a-z]+/g, "-")}`, { page: entry.name, zoom: z.zoom, state: entry.state, ...seen, obscured, shot });
      await context.close();
      expect(seen.scroll, "no sideways scroll").toBeLessThanOrEqual(z.width);
      expect(seen.outside, "every control inside the window").toEqual([]);
      expect(seen.overlaps, "no control overlaps another").toEqual([]);
      expect(seen.clipped, "no text cut by a box that hides overflow").toEqual([]);
      expect(obscured, "no focused control entirely under the header or the dock").toEqual([]);
    });
  }
}
