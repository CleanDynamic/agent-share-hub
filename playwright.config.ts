// Playwright for NeoScale.
//
// This file used to import `lovable-agent-playwright-config`, a scaffold package
// that is in neither lockfile and does not exist on the registry — so the whole
// harness failed at config load with ERR_MODULE_NOT_FOUND and no spec could run.
// It is replaced here with a self-contained config that depends only on
// @playwright/test, which IS a devDependency.
//
// TWO VIEWPORT PROJECTS, NOT ONE RESIZED. Below 768px this app renders different
// components (MobileTopBar, MobileBottomNav, ProfileDrawer, RightRailDrawer), so
// desktop and mobile are separate projects that exercise separate code, and the
// tier-1 suite is expected to run under both.
//
// GENEROUS TIMEOUTS ARE DELIBERATE. Measured `load` on this bundle is ~2676 ms;
// a cold Vite dev start is slower again. Tight navigation timeouts here produce
// failures that say nothing about correctness.
//
// The auth setup project runs first and writes the storage states the tier-2 and
// tier-3 projects reuse, so no test signs in through the UI.

import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 5173);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Independent and runnable in any order, so parallel is safe. CI pins workers
  // for reproducibility rather than speed.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    // For a maintainer who cannot read a stack trace, the screenshot is usually
    // the whole diagnosis.
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
  },

  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      dependencies: ["setup"],
      testIgnore: /.*\.setup\.ts/,
    },
    {
      // Pixel 7 is 412x915 — comfortably under the 768px breakpoint, so the
      // mobile chrome renders.
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      dependencies: ["setup"],
      // Tier 3 is authored against the desktop compose surface; tier 1 is the
      // suite required at both viewports.
      testMatch: /e2e\/tier1\/.*\.spec\.ts/,
    },
  ],

  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
