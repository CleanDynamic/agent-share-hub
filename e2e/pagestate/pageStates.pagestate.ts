// G29: every page type, under each of the five conditions, reaches the right settled state within 12 seconds.
//
// Run with `npx playwright test -c playwright.pagestate.config.ts`. It runs against a production build (vite build, then
// vite preview), so the 12 seconds measure the page and not the dev server compiling it. The network is faked in the
// browser (network.ts); nothing reaches the live project.
//
// For each cell it asserts: settled within 12 s; the state is the right one for the condition; no element is left
// aria-busy; the title is present; no text looks like an error code; where a retry button is shown its label is
// "Try again". Every check is soft, so one run reports them all, and each cell's reading is written to
// test-results/pagestate/<page>__<condition>.json for the table (report.mjs).

import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

import { readState, type Reading } from "./classify";
import { CONDITIONS, installCondition, signIn, type Condition } from "./network";
import { PAGE_TYPES, expectedFor } from "./pages";

/** 12 s is the limit; PAGESTATE_SETTLE_MS reads longer, to compare with the audit (it read at 46 s). */
const SETTLE_MS = Number(process.env.PAGESTATE_SETTLE_MS ?? 12_000);
const POLL_MS = 250;
const OUT = path.resolve("test-results/pagestate");

/** Before the document has a body to read. */
const LOADING: Reading = { state: "loading", states: ["loading"], title: null, codes: [], retryLabels: [], busy: 0, lines: [] };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

for (const pageType of PAGE_TYPES) {
  test.describe(pageType.name, () => {
    for (const condition of CONDITIONS) {
      test(`${condition}`, async ({ page }) => {
        test.setTimeout(SETTLE_MS + 33_000);
        await installCondition(page, condition as Condition);
        await signIn(page);

        const started = Date.now();
        await page.goto(pageType.path, { waitUntil: "commit" });

        // Read until the limit. `since` is when the state now shown first appeared; the page has settled if, at the limit,
        // it is not loading, and it settled at `since`.
        let reading: Reading = await readState(page).catch(() => LOADING);
        let key = "";
        let since = 0;
        /** Every change of state, with when it happened, for the report. */
        const history: string[] = [];
        while (Date.now() - started < SETTLE_MS) {
          reading = await readState(page).catch(() => reading);
          const next = `${reading.state}|${[...reading.states].sort().join(",")}`;
          if (next !== key) {
            key = next;
            since = Date.now() - started;
            history.push(`${(since / 1000).toFixed(1)}s ${next}`);
          }
          await page.waitForTimeout(POLL_MS);
        }
        const settledAt = reading.state === "loading" ? null : since;

        const expected = expectedFor(pageType, condition as Condition);
        const result = {
          page: pageType.name,
          path: pageType.path,
          legacy: Boolean(pageType.legacy),
          condition,
          expected,
          settledSeconds: settledAt === null ? null : Math.round(settledAt / 100) / 10,
          history,
          ...reading,
        };
        fs.mkdirSync(OUT, { recursive: true });
        fs.writeFileSync(path.join(OUT, `${slug(pageType.name)}__${condition}.json`), JSON.stringify(result, null, 2));

        expect.soft(settledAt, "settled within 12 s").not.toBeNull();
        expect.soft(expected, `state (saw ${reading.state}: ${reading.states.join(", ")})`).toContain(reading.state);
        expect.soft(reading.busy, "no aria-busy left").toBe(0);
        expect.soft(reading.title, "title present").not.toBeNull();
        expect.soft(reading.codes, "no code on screen").toEqual([]);
        for (const label of reading.retryLabels) expect.soft(label, "retry label").toBe("Try again");
      });
    }
  });
}
