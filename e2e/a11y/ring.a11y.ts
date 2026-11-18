// G24: the focus ring has at least 3:1 against the colours next to it, in both themes: on the page background, a card, a
// window, and the green primary in the sign-in dialog. Each control is reached with Tab (so the ring is the keyboard's ring),
// then the ring's colour is read and compared with what is behind it. The ring is drawn 2px off the control, so the colour on
// both sides of it is the surface behind the control; the control's own fill (the green primary) is 2px inside, and that
// ratio is reported too.

import { expect, test, type Page } from "@playwright/test";

import { openPage, writeResult } from "./harness";
import type { MatrixPage, Theme } from "./matrix";

interface Case {
  name: string;
  entry: MatrixPage;
  /** Which control to reach with Tab, matched in the page. */
  pick: string;
  /** Keys to press first (the primary is a Tab stop only once the form is filled). */
  fill?: boolean;
}

const CASES: Case[] = [
  { name: "page background (header link)", entry: { name: "Home", path: "/", state: "" }, pick: '[data-slot="header"] a[href="/builds"]' },
  { name: "surface (page control)", entry: { name: "Home", path: "/", state: "" }, pick: 'main [role="tab"]' },
  { name: "card", entry: { name: "Build", kit: "build", state: "" }, pick: "main [data-ui='panel'] a[href], main [data-ui='panel'] button" },
  { name: "window (sign-in dialog field)", entry: { name: "Sign in", path: "/?signin=login", state: "" }, pick: '[role="dialog"] input[aria-label="Email"]' },
  { name: "green primary (sign-in dialog)", entry: { name: "Sign in", path: "/?signin=login", state: "" }, pick: '[role="dialog"] form button[type="submit"]', fill: true },
];

/** In the page: the focused control's ring colour, the surface behind it, and its own fill, as hex. */
function readRing(): { ring: string; offset: string; behind: string; fill: string; what: string } {
  const hex = (c: string) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return c;
    const [r, g, b, a = "1"] = m[1].split(",").map((x) => x.trim());
    if (Number(a) === 0) return "transparent";
    return `#${[r, g, b].map((x) => Number(x).toString(16).padStart(2, "0")).join("")}`;
  };
  // A field drawn as a well (the sign-in fields) shows the ring on the well round the input: that is the ring that is seen.
  const focused = document.activeElement as HTMLElement;
  const well = focused.tagName === "INPUT" && focused.parentElement && getComputedStyle(focused.parentElement).outlineStyle === "solid" ? focused.parentElement : null;
  const el = well ?? focused;
  const style = getComputedStyle(el);
  let behind = "transparent";
  for (let node = el.parentElement; node; node = node.parentElement) {
    const bg = hex(getComputedStyle(node).backgroundColor);
    if (bg !== "transparent") {
      behind = bg;
      break;
    }
  }
  if (behind === "transparent") behind = hex(getComputedStyle(document.body).backgroundColor);
  const fill = hex(style.backgroundColor);
  return { ring: hex(style.outlineColor), offset: style.outlineOffset, behind, fill: fill === "transparent" ? behind : fill, what: `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}"` };
}

const luminance = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
};

async function tabUntil(page: Page, selector: string): Promise<void> {
  for (let press = 0; press < 120; press++) {
    if (await page.evaluate((s) => Boolean(document.activeElement?.matches(s)), selector)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Tab never reached ${selector}`);
}

for (const theme of ["light", "dark"] as Theme[]) {
  for (const c of CASES) {
    test(`G24: the ring on the ${c.name} · ${theme}`, async ({ page }) => {
      await openPage(page, c.entry, { theme, width: 1440 });
      if (c.fill) {
        await tabUntil(page, '[role="dialog"] input[aria-label="Email"]');
        await page.keyboard.type("member@example.test");
        await tabUntil(page, '[role="dialog"] input[aria-label="Password"]');
        await page.keyboard.type("a long enough password");
      }
      await tabUntil(page, c.pick);
      await page.waitForTimeout(150);
      const seen = await page.evaluate(readRing);
      const result = { case: c.name, theme, ...seen, againstBehind: ratio(seen.ring, seen.behind), againstFill: ratio(seen.ring, seen.fill) };
      writeResult(`ring-${theme}-${c.name.replace(/[^a-z]+/gi, "-").toLowerCase()}`, result);
      expect(seen.offset, "the ring stands off the control, so the surface behind is what it sits on").toBe("2px");
      expect(result.againstBehind, `${seen.ring} on ${seen.behind}`).toBeGreaterThanOrEqual(3);
    });
  }
}
