// G25 and G26: every page in the matrix, at every variant: axe (WCAG 2.0 to 2.2 A and AA, less the allow list) and the
// Tab walk. Each run's findings are written to test-results/a11y/<page>-<theme>-<width>.json for report.mjs.

import { expect, test } from "@playwright/test";

import { openPage, runAxe, tabWalk, writeResult } from "./harness";
import { MATRIX, VARIANTS, slugOf } from "./matrix";

for (const entry of MATRIX) {
  for (const variant of VARIANTS) {
    test(`${entry.name} · ${variant.theme} · ${variant.width}`, async ({ page }) => {
      const started = Date.now();
      const { boundary } = await openPage(page, entry, variant);
      const axe = await runAxe(page, entry.name);
      const walk = await tabWalk(page);
      const blocking = axe.filter((finding) => !finding.allowed);
      writeResult(slugOf(entry.name, variant), {
        page: entry.name,
        state: entry.state,
        theme: variant.theme,
        width: variant.width,
        boundary,
        axe,
        walk: { ended: walk.ended, stops: walk.stops.length, failures: walk.failures },
        ms: Date.now() - started,
      });
      // G13: a page drawn as the error boundary has nothing of its own to check.
      expect.soft(boundary, "the page crashed into the error boundary").toBe(false);
      expect.soft(blocking.map((finding) => `${finding.rule} · ${finding.target} · ${finding.summary}`), "axe violations not on the allow list").toEqual([]);
      expect.soft(walk.failures, "Tab walk").toEqual([]);
    });
  }
}
