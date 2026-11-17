// G29: the page-state guard (e2e/pagestate). Its own config because it runs against a production build: the 12-second
// limit is about the page, and a cold dev server compiling each chunk on first request would eat it.

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PAGESTATE_PORT ?? 4174);
const CHROMIUM = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e/pagestate",
  testMatch: /.*\.pagestate\.ts$/,
  fullyParallel: true,
  retries: 0,
  // At most two: with four on a four-core machine the pages compete for it, and the first read starts 2 to 4 s late.
  workers: Math.min(2, Number(process.env.PAGESTATE_WORKERS ?? 2)),
  reporter: [["list"]],
  // Its own artifacts folder: Playwright empties outputDir on every run, and the readings in test-results/pagestate must survive a partial rerun.
  outputDir: "test-results/pagestate-artifacts",
  timeout: 60_000,
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
    command: process.env.PAGESTATE_SKIP_BUILD
      ? `npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`
      : `npx vite build && npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: true,
    timeout: 600_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
