// G25 to G27: the accessibility guard. Run with `npx playwright test -c e2e/a11y/playwright.a11y.config.ts`.
//
// It runs against the dev server, not a production build, because the dev kit pages (the pages with full sample data)
// are registered only in development. Every request to the Supabase host is answered in the browser (e2e/pagestate's
// faker); every other outside host is aborted. Nothing reaches the live project.

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.A11Y_PORT ?? 5175);
const CHROMIUM = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.a11y\.ts$/,
  globalSetup: "./warmup.ts",
  fullyParallel: true,
  retries: 0,
  workers: Math.min(4, Number(process.env.A11Y_WORKERS ?? 2)),
  reporter: [["list"]],
  outputDir: "../../test-results/a11y-artifacts",
  timeout: 180_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "off",
    screenshot: "off",
    video: "off",
    launchOptions: CHROMIUM ? { executablePath: CHROMIUM } : {},
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
    // The server runs from the repository root, where vite.config.ts is; Playwright would otherwise start it in this folder.
    cwd: "../..",
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
