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
 *
 * UI-P81 — THE REFINED LOOK HAS NO GLASS, and the second test below is where that
 * is counted. The refined look can only be asked for on `/dev/*` (UI-P78), and
 * every `/dev/kit/pages/*?look=refined` answers "No refined view yet" until its
 * page forks (UI-P77), so the pages it visits are the ones that DO draw under it:
 * the component catalogue, which carries a liquid-glass panel to take away. Zero
 * is asserted for LIQUID glass — `.bg-glass` panels and the distortion filter.
 * The frame's own blurs (the header, the dock, the build page's plate and action
 * dock) are listed in the report and not failed: UI-P87 and UI-P90 rebuild those
 * surfaces and take them to zero, and raise this assertion when they do.
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

/* UI-P81 — the refined look has no liquid glass.
 *
 * Each page is opened under `?look=refined` in both rooms, and the test first
 * proves it is looking at what it claims to: `<html data-look="refined">`, the
 * page drawn, and at least one panel that ASKED for glass. Without that last
 * condition a page with no glass panels would pass "zero glass" for free.
 */
test("UI-P81 — under the refined look no panel is liquid glass and no distortion filter is mounted", async ({ browser }) => {
  const findings: string[] = [];
  const rows: unknown[][] = [];
  const chromeBlur: string[] = [];

  const refinedPages = (theme: string) => [
    // `?theme=` because the compare pages take their room from the URL, not from storage.
    { id: "dev-components", path: `/dev/kit/components?theme=${theme}&look=refined`, drawn: '[data-design-page="components"]' },
  ];

  for (const theme of THEMES) {
    for (const entry of refinedPages(theme)) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      try {
        await openRoute(page, { id: entry.id, path: entry.path }, theme);

        const probe = await page.evaluate((drawn) => {
          const blurOf = (el: Element, pseudo?: string) => {
            const s = getComputedStyle(el, pseudo);
            const value = s.backdropFilter || (s as unknown as Record<string, string>).webkitBackdropFilter;
            return value && value !== "none" ? value : "";
          };
          const distortedBy = (el: Element, pseudo?: string) => getComputedStyle(el, pseudo).filter.includes("bg-glass-distortion");
          const liquid = Array.from(document.querySelectorAll(".bg-glass"));
          return {
            look: document.documentElement.dataset.look ?? "",
            drawn: Boolean(document.querySelector(drawn)),
            askedForGlass: document.querySelectorAll('[data-ui="panel"][data-surface="glass"]').length,
            glassClass: liquid.length,
            blurred: liquid.filter((el) => blurOf(el) || blurOf(el, "::after")).length,
            distorted: liquid.filter((el) => distortedBy(el) || distortedBy(el, "::after")).length,
            filterNodes: document.querySelectorAll("#bg-glass-distortion, feDisplacementMap").length,
          };
        }, entry.drawn);

        const label = `${entry.id} ${theme}`;
        if (probe.look !== "refined") findings.push(`${label}: <html data-look> is "${probe.look}", so this did not run under the refined look`);
        if (!probe.drawn) findings.push(`${label}: ${entry.drawn} is not on the page, so nothing was measured`);
        if (probe.askedForGlass === 0) findings.push(`${label}: no panel asked for surface="glass", so zero liquid glass proves nothing here`);
        if (probe.glassClass > 0) findings.push(`${label}: ${probe.glassClass} element(s) still carry the .bg-glass class`);
        if (probe.blurred > 0) findings.push(`${label}: ${probe.blurred} .bg-glass element(s) still blur what is behind them`);
        if (probe.distorted > 0) findings.push(`${label}: ${probe.distorted} .bg-glass element(s) are still refracted by #bg-glass-distortion`);
        if (probe.filterNodes > 0) findings.push(`${label}: the distortion filter is still mounted (${probe.filterNodes} node(s))`);

        // Everything else that blurs is the frame's, reported for UI-P87 and UI-P90 and not failed here.
        const census = await page.evaluate(collectGlass);
        for (const surface of census.surfaces) chromeBlur.push(`${label}: ${surface.selector} blur(${surface.blur})`);

        rows.push([entry.id, theme, probe.look, probe.askedForGlass, probe.glassClass, probe.blurred, probe.distorted, probe.filterNodes, census.count]);
      } finally {
        await context.close();
      }
    }
  }

  const file = writeCsv(
    "glass-census-refined.csv",
    ["page", "theme", "data_look", "panels_asking_for_glass", "bg_glass_elements", "bg_glass_blurred", "bg_glass_distorted", "filter_nodes", "other_blurred_surfaces"],
    rows,
  );
  const summary = [
    "UI-P81 refined glass census",
    "",
    `visits      ${rows.length}`,
    `findings    ${findings.length}`,
    "",
    "findings",
    ...(findings.length ? findings.map((f) => "  " + f) : ["  none"]),
    "",
    "other blurred surfaces (the frame's own; UI-P87 and UI-P90 take these to zero)",
    ...(chromeBlur.length ? chromeBlur.map((c) => "  " + c) : ["  none"]),
    "",
    `written: ${file}`,
  ].join("\n");

  writeText("glass-census-refined.txt", summary);
  console.log("\n" + summary + "\n");

  expect(findings, findings.join("\n")).toEqual([]);
});
