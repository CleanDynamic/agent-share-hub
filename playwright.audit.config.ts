/* BG-P30/P31 — the audit harness's own Playwright config.
 *
 * SEPARATE FROM `playwright.config.ts` ON PURPOSE. The e2e config runs two
 * viewport projects and a `setup` dependency; the audit is one desktop viewport
 * swept serially, because every route is visited in both rooms and the report
 * is one document assembled in one place. Running it under the e2e config would
 * double every measurement for no gain and split the report across workers.
 *
 * THE BROWSER PATH IS RESOLVED, NOT ASSUMED. `PW_CHROMIUM_PATH` lets a sandbox
 * that ships Chromium at a fixed location point at it instead of downloading a
 * build; unset, Playwright resolves its own as usual.
 */

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 5173);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const CHROMIUM = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e/audit",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  // The sweep visits thirty pages in one test and settles each of them.
  timeout: 15 * 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
    launchOptions: CHROMIUM ? { executablePath: CHROMIUM } : {},
  },

  webServer: {
    command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
