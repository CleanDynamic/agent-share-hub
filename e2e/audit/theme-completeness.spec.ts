/* BG-P30 — the both-theme completeness assertion.
 *
 * THE CLASSIC FAILURE THIS CATCHES. A page that looks right in Dusk and wrong
 * in Exhibition, because one surface was written with a value instead of a
 * token. `compliance.test.ts` (BG-P29) already catches a raw literal in the
 * SOURCE; this catches the same defect in the RENDER, which is where it also
 * arrives by other routes a source scan cannot see: a Tailwind utility whose
 * bridge variable was never repointed, a third-party stylesheet, a `color-mix`
 * against the wrong token, an inline style built from a theme object that was
 * captured once and never re-read.
 *
 * THE TEST. Collect every colour each page actually paints, in each room. A
 * value that belongs to the OTHER room's token block, and to no token in the
 * room it is painted in, is a colour that stopped following the theme. That is
 * precise rather than approximate: `#D98C6B` is Dusk's `--action` and nothing
 * else, so seeing it on Exhibition means one surface is wearing the other
 * room's paint — which is the exact case the theme's second hard rule names.
 *
 * WHY NOT "every colour must be a token value". Because `color-mix()` and
 * `tokenAlpha()` are how this codebase expresses a token AT AN ALPHA, and the
 * browser resolves those to values that are in no token block by design. A
 * whitelist would fail hundreds of legal surfaces and teach the next prompt to
 * delete the test. The asymmetric rule has no such false positives.
 *
 * `--lit` IS THE ONE COLOUR THAT IS LEGITIMATELY THE SAME IN BOTH ROOMS, and
 * `--on-lit` differs only because Dusk's ink on amber is warmer. Any token
 * whose value is identical across the two blocks is therefore excluded from
 * the rule automatically — it is in both sets, so it can never be "the other
 * room's only".
 */

import { expect, test } from "@playwright/test";
import { DEGRADED, ROUTES, THEMES, openRoute } from "./support/harness";
import { collectColours } from "./support/probe";
import { writeCsv, writeText } from "./support/report";
import { dusk, exhibition, TOKEN_NAMES } from "../../src/lib/theme/semantics";

test.describe.configure({ mode: "serial" });

/** `rgba(255, 255, 255, 0.55)` and `#FFFFFF8C` have to compare equal. */
function normalise(value: string): string | null {
  const c = (value || "").trim().toLowerCase();
  if (!c || c === "none" || c === "transparent") return null;
  const rgb = /^rgba?\(([^)]+)\)$/.exec(c);
  if (rgb) {
    const p = rgb[1].split(/[,/\s]+/).filter(Boolean).map(Number);
    if (p.length < 3 || p.some((n) => Number.isNaN(n))) return null;
    const a = p[3] === undefined ? 1 : p[3];
    return `${Math.round(p[0])},${Math.round(p[1])},${Math.round(p[2])},${Math.round(a * 100) / 100}`;
  }
  const hexMatch = /^#([0-9a-f]{3,8})$/i.exec(c);
  if (hexMatch) {
    let h = hexMatch[1];
    if (h.length === 3 || h.length === 4) h = h.split("").map((x) => x + x).join("");
    const n = parseInt(h.slice(0, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.round(a * 100) / 100}`;
  }
  return null;
}

/** A theme's token values, normalised, plus the same values at any alpha. */
function paletteOf(theme: Record<string, string>) {
  const exact = new Set<string>();
  const rgbOnly = new Set<string>();
  for (const name of TOKEN_NAMES) {
    const raw = theme[name];
    if (!raw || raw.startsWith("var(")) continue;
    const n = normalise(raw);
    if (!n) continue;
    exact.add(n);
    rgbOnly.add(n.split(",").slice(0, 3).join(","));
  }
  return { exact, rgbOnly };
}

const PALETTE = { exhibition: paletteOf(exhibition), dusk: paletteOf(dusk) } as const;

/**
 * Colours that are the other room's AND legal where they are, with the reason.
 * A ratchet: it may only shrink.
 */
const EXEMPT: Array<{ route: string; value: string; why: string }> = [];

/* A DETECTOR THAT CANNOT FIRE IS A GREEN TEST THAT MEANS NOTHING. This plants
   Dusk's `--action` on an Exhibition page and requires the sweep to find it,
   so "zero leaks" below is a measurement rather than a tautology. */
test("BG-P30 — the leak detector fires on a planted single-room colour", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  try {
    await openRoute(page, ROUTES[0], "exhibition");
    await page.evaluate(() => {
      const plant = document.createElement("p");
      plant.id = "planted-dusk-salmon";
      plant.textContent = "Dusk's salmon, on the Exhibition ground";
      plant.style.color = "#D98C6B";
      document.body.appendChild(plant);
    });
    const colours = await page.evaluate(collectColours);
    const planted = colours
      .map((c) => normalise(c.value))
      .filter((n): n is string => n !== null)
      .map((n) => n.split(",").slice(0, 3).join(","));
    expect(planted).toContain("217,140,107");
    expect(PALETTE.dusk.rgbOnly.has("217,140,107")).toBe(true);
    expect(PALETTE.exhibition.rgbOnly.has("217,140,107")).toBe(false);
  } finally {
    await context.close();
  }
});

test("BG-P30 — no element renders a colour defined only in the other room", async ({ browser }) => {
  const rows: unknown[][] = [];
  const leaks: string[] = [];

  for (const route of ROUTES) {
    for (const theme of THEMES) {
      const other = theme === "exhibition" ? "dusk" : "exhibition";
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      try {
        await openRoute(page, route, theme);
        const colours = await page.evaluate(collectColours);
        for (const found of colours) {
          const n = normalise(found.value);
          if (!n) continue;
          const rgb = n.split(",").slice(0, 3).join(",");
          const mine = PALETTE[theme].rgbOnly.has(rgb);
          const theirs = PALETTE[other].rgbOnly.has(rgb);
          if (!theirs || mine) continue;
          const exempt = EXEMPT.find((e) => e.route === route.id && normalise(e.value) === n);
          const line = `${route.id} ${theme} ${found.prop} ${found.value} on ${found.selector} "${found.sample}" — this is ${other}'s paint`;
          rows.push([route.id, theme, found.prop, found.value, found.selector, found.sample, other, exempt ? "exempt" : "leak"]);
          if (exempt) continue;
          leaks.push(line);
        }
      } finally {
        await context.close();
      }
    }
  }

  const file = writeCsv(
    "theme-leaks.csv",
    ["route", "theme", "property", "value", "selector", "sample", "belongs_to", "status"],
    rows,
  );

  const summary = [
    "BG-P30 both-theme completeness",
    "",
    `visits      ${ROUTES.length * THEMES.length}`,
    `leaks       ${leaks.length}`,
    `exempt      ${rows.filter((r) => r[7] === "exempt").length}`,
    `degraded    ${Object.keys(DEGRADED).join(", ") || "none"}`,
    "",
    ...(leaks.length ? leaks.map((l) => "  " + l) : ["  no element renders a single-room colour"]),
    "",
    `written: ${file}`,
  ].join("\n");

  writeText("theme-completeness.txt", summary);
  console.log("\n" + summary + "\n");

  expect(leaks, leaks.join("\n")).toEqual([]);
});
