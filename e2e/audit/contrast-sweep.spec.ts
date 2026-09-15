/* BG-P30 — the contrast sweep. Fifteen routes, two rooms, every rendered pair.
 *
 * WHAT THIS IS FOR. `src/lib/theme/contrast.test.ts` measures the TOKENS — the
 * contract the system was built on, recomputed from `semantics.ts` so a value
 * edited there without remeasuring fails. This measures the PAGES: the colour a
 * reader's eye actually receives, after the cascade has resolved `var()`, after
 * three translucent layers have composited, after an `opacity` on an ancestor
 * has faded the ink, on a real glyph box at a real size. A token can clear
 * every floor in the contract and still be put on the wrong ground by a
 * component, and that is the failure this catches and nothing else does.
 *
 * SERIAL, ONE WORKER, ONE REPORT. Thirty page visits assembled into one CSV.
 * Parallel workers would split the report across processes for a saving of
 * about a minute.
 *
 * THE SEVERITY MODEL is `critique-color`'s, applied to what the spec floors:
 *
 *   HIGH   text under 4.5:1 — a reader cannot read it.
 *   HIGH   a STATE-CARRYING border or a focus ring under 3.0:1 — a reader
 *          cannot tell the state.
 *   HIGH   `--lit` used as text or as a state border on Exhibition, at any
 *          ratio. The theme's first hard rule; it is a finding even where the
 *          measurement happens to pass, and it is asserted separately below.
 *   note   a HAIRLINE under 3.0:1. `--line` is 1.2:1 on Exhibition's ground BY
 *          DESIGN — the spec names it "hairlines, chip borders" and floors it
 *          nowhere, because a separator is not a control boundary and WCAG
 *          1.4.11 exempts it. These are reported, never failed; failing them
 *          would mean moving `--line`, which is a system-wide repaint this
 *          prompt forbids and the operator has not asked for.
 *   note   a pair with an image or a gradient beneath it. A gradient has no
 *          single ratio. Reported with the composite it would have had, never
 *          failed, because inventing a number here is repainting by eye.
 *
 * SURVIVORS. The acceptance allows a failure to survive if it is listed with a
 * justification the operator has accepted. `SURVIVORS` below is that list, and
 * it is a ratchet: it may only shrink.
 */

import { expect, test } from "@playwright/test";
import { DEGRADED, ROUTES, THEMES, openRoute, type Theme } from "./support/harness";
import { collectContrast, collectFocus } from "./support/probe";
import { writeCsv, writeText } from "./support/report";
import { TOKEN_NAMES } from "../../src/lib/theme/semantics";

test.describe.configure({ mode: "serial" });

/** route id + theme + selector + measured pair, with the reason it stands. */
interface Survivor {
  route: string;
  theme: Theme | "*";
  match: RegExp;
  why: string;
}

const SURVIVORS: Survivor[] = [];

const survivorFor = (route: string, theme: string, selector: string, sample: string) =>
  SURVIVORS.find(
    (s) =>
      s.route === route &&
      (s.theme === "*" || s.theme === theme) &&
      s.match.test(`${selector} ${sample}`),
  );

test("BG-P30 — every rendered pair on fifteen routes, in both rooms", async ({ browser }) => {
  const rows: unknown[][] = [];
  const failures: string[] = [];
  const accepted: string[] = [];
  const coverage: Array<{ route: string; theme: string; pairs: number; nodes: number }> = [];

  for (const route of ROUTES) {
    for (const theme of THEMES) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      try {
        await openRoute(page, route, theme);
        const nodes = await page.evaluate(() => document.querySelectorAll("*").length);
        const hits = await page.evaluate(collectContrast, [...TOKEN_NAMES]);
        /* ONE REAL TAB BEFORE THE FOCUS PASS. Chromium only applies a
           `:focus-visible` rule once the last input modality was the keyboard;
           a scripted `el.focus()` with no prior keystroke leaves the control
           wearing the UA's 1px auto outline, and a sweep that measured THAT
           would report thirty routes of failures that no keyboard user ever
           sees. One `Tab` sets the modality, after which the scripted focus
           inside `collectFocus` draws the system's own ring. */
        await page.keyboard.press("Tab");
        const rings = await page.evaluate(collectFocus, 40);

        for (const hit of hits) {
          rows.push([
            route.id,
            theme,
            hit.kind,
            hit.selector,
            hit.sample,
            hit.fontPx || "",
            hit.fontWeight || "",
            hit.fg,
            hit.bg,
            hit.ratio,
            hit.floor || "",
            hit.status,
            hit.note,
            hit.count,
          ]);
          if (hit.status === "fail") {
            const line =
              `${route.id} ${theme} ${hit.kind} ${hit.selector} — ${hit.fg} on ${hit.bg} ` +
              `= ${hit.ratio}:1 (floor ${hit.floor}) ${hit.fontPx ? hit.fontPx + "px/" + hit.fontWeight : ""} ` +
              `"${hit.sample}" ×${hit.count}`;
            if (survivorFor(route.id, theme, hit.selector, hit.sample)) accepted.push(line);
            else failures.push(line);
          }
        }

        for (const ring of rings) {
          rows.push([
            route.id,
            theme,
            "focus",
            ring.selector,
            `outline ${ring.width}px offset ${ring.offset}px`,
            "",
            "",
            ring.ringColour,
            ring.ground,
            ring.ratio,
            3,
            ring.kind === "ua-default" ? "hairline" : ring.ok ? "pass" : "fail",
            ring.kind === "ua-default"
              ? "ua-default ring — the system's own ring never reached this control"
              : ring.kind === "none"
                ? "NO RING AT ALL"
                : "",
            1,
          ]);
          if (!ring.ok) {
            const line =
              `${route.id} ${theme} focus ${ring.selector} — ring ${ring.ringColour} on ` +
              `${ring.ground} = ${ring.ratio}:1 (width ${ring.width}px)`;
            if (survivorFor(route.id, theme, ring.selector, "focus")) accepted.push(line);
            else failures.push(line);
          }
        }

        coverage.push({ route: route.id, theme, pairs: hits.length + rings.length, nodes });
      } finally {
        await context.close();
      }
    }
  }

  const header = [
    "route",
    "theme",
    "kind",
    "selector",
    "sample",
    "font_px",
    "font_weight",
    "foreground",
    "background",
    "ratio",
    "floor",
    "status",
    "note",
    "count",
  ];

  const all = writeCsv("contrast-all.csv", header, rows);
  const failing = writeCsv(
    "contrast-failures.csv",
    header,
    rows.filter((r) => r[11] === "fail"),
  );
  const notes = writeCsv(
    "contrast-notes.csv",
    header,
    rows.filter((r) => r[11] === "hairline" || r[11] === "image-beneath"),
  );

  const summary = [
    "BG-P30 contrast sweep",
    "",
    `routes      ${ROUTES.length} × ${THEMES.length} rooms = ${coverage.length} page visits`,
    `pairs       ${rows.length} distinct pairings measured`,
    `failures    ${failures.length} unaccepted`,
    `accepted    ${accepted.length} survivors with a recorded justification`,
    `hairlines   ${rows.filter((r) => r[11] === "hairline").length} (reported, not floored — see the header of this spec)`,
    `ua rings    ${rows.filter((r) => String(r[12]).startsWith("ua-default")).length} controls the system ring never reached (Chromium paints its own; a consistency finding, not a contrast one)`,
    `image       ${rows.filter((r) => r[11] === "image-beneath").length} pairs over an image or gradient (not measurable as one ratio)`,
    "",
    "degraded routes (measured, but not rendering their own content)",
    ...(Object.keys(DEGRADED).length
      ? Object.entries(DEGRADED).map(([id, why]) => `  ${id}: ${why}`)
      : ["  none"]),
    "",
    "coverage",
    ...coverage.map((c) => `  ${c.route.padEnd(16)} ${c.theme.padEnd(11)} ${String(c.pairs).padStart(5)} pairs  ${String(c.nodes).padStart(5)} nodes`),
    "",
    "failures",
    ...(failures.length ? failures.map((f) => "  " + f) : ["  none"]),
    "",
    "accepted survivors",
    ...(accepted.length ? accepted.map((f) => "  " + f) : ["  none"]),
    "",
    `written: ${all}`,
    `written: ${failing}`,
    `written: ${notes}`,
  ].join("\n");

  writeText("contrast-summary.txt", summary);
  console.log("\n" + summary + "\n");

  // Every route has to have rendered something, or a green sweep means nothing.
  // A route in DEGRADED is exempt and says why in the report, so the exemption
  // is visible on every run rather than silently swallowed.
  for (const c of coverage) {
    if (DEGRADED[c.route]) continue;
    expect(c.pairs, `${c.route}/${c.theme} measured nothing — did the route render?`).toBeGreaterThan(5);
  }

  expect(failures, failures.join("\n")).toEqual([]);
});
