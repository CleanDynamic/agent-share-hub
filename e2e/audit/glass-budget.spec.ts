/* BG-P31 — the glass census, and the three rules that keep it cheap.
 *
 * §Glass is binding and it is three claims, not one: ONE blur value, about
 * TWENTY blurred surfaces a page, and NEVER nested. The third is the one that
 * costs: a blurred chip inside a blurred card inside a blurred panel is three
 * stacked compositing layers, each re-reading the pixels beneath it every
 * frame, and that — not the blur radius — is what made the previous shell
 * stutter. `neoscale-performance` names it as cause 4 and the flat shell as
 * its replacement; this is the assertion that keeps it replaced.
 *
 * A FOURTH RULE IS CHECKED HERE TOO: never blur a full-height fixed panel. The
 * shell BG-P17 removed had three of them, permanently visible, each one a
 * full-viewport read-back per frame.
 *
 * COUNTED IN A REAL BROWSER, because `backdrop-filter` does not exist in jsdom
 * and the count is a property of the rendered tree rather than of the source:
 * one component that renders twelve rows is one `backdropFilter` in the source
 * and twelve compositing layers on the page. The static half — that there is
 * exactly one blur value in the codebase — is asserted in
 * src/lib/theme/glass.test.ts, where a source scan belongs.
 */

import { expect, test } from "@playwright/test";
import { ROUTES, THEMES, openRoute } from "./support/harness";
import { collectGlass } from "./support/probe";
import { writeCsv, writeText } from "./support/report";

test.describe.configure({ mode: "serial" });

/** "About twenty per page." Twenty-four is the line this treats as over. */
const BUDGET = 24;

test("BG-P31 — every route is inside the glass budget, with no nesting", async ({ browser }) => {
  const rows: unknown[][] = [];
  const findings: string[] = [];
  const perRoute: Array<{ route: string; theme: string; count: number; depth: number }> = [];

  for (const route of ROUTES) {
    for (const theme of THEMES) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      try {
        await openRoute(page, route, theme);
        const glass = await page.evaluate(collectGlass);
        perRoute.push({ route: route.id, theme, count: glass.count, depth: glass.maxDepth });

        for (const surface of glass.surfaces) {
          rows.push([
            route.id,
            theme,
            surface.selector,
            surface.blur,
            surface.filter,
            surface.depth,
            surface.fixedFullHeight ? "yes" : "",
            `${surface.rect.w}x${surface.rect.h}`,
            surface.ancestors.join(" < "),
          ]);
        }

        if (glass.count > BUDGET) {
          findings.push(
            `${route.id} ${theme}: ${glass.count} blurred surfaces, over the ~20 budget`,
          );
        }
        for (const nested of glass.nested) {
          findings.push(
            `${route.id} ${theme}: ${nested.selector} is blurred inside ${nested.ancestors.join(" < ")}`,
          );
        }
        for (const fixed of glass.fixedFullHeight) {
          findings.push(
            `${route.id} ${theme}: ${fixed.selector} is a blurred full-height fixed panel (${fixed.rect.w}x${fixed.rect.h})`,
          );
        }
        if (glass.blurValues.length > 1) {
          findings.push(
            `${route.id} ${theme}: ${glass.blurValues.length} blur values in play — ${glass.blurValues.join(", ")}`,
          );
        }
      } finally {
        await context.close();
      }
    }
  }

  const file = writeCsv(
    "glass-census.csv",
    ["route", "theme", "selector", "blur", "filter", "nesting_depth", "fixed_full_height", "size", "blurred_ancestors"],
    rows,
  );

  const worst = [...perRoute].sort((a, b) => b.count - a.count);
  const summary = [
    "BG-P31 glass census",
    "",
    `visits      ${perRoute.length}`,
    `surfaces    ${rows.length} blurred surfaces across every visit`,
    `budget      ${BUDGET} per route ("about twenty")`,
    `findings    ${findings.length}`,
    "",
    "per route, worst first",
    ...worst.map(
      (r) =>
        `  ${r.route.padEnd(16)} ${r.theme.padEnd(11)} ${String(r.count).padStart(3)} surfaces  depth ${r.depth}`,
    ),
    "",
    "findings",
    ...(findings.length ? findings.map((f) => "  " + f) : ["  none"]),
    "",
    `written: ${file}`,
  ].join("\n");

  writeText("glass-census.txt", summary);
  console.log("\n" + summary + "\n");

  expect(findings, findings.join("\n")).toEqual([]);
});
