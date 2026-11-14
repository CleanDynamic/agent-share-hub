// G21: the content security policy against the built site. RUN AGAINST MOCKS.
//
// The site is built (with Cloudflare's always-pass invisible test key, so the widget's script is asked for) and served by
// `vite preview`; e2e/csp/csp.spec.ts adds the policy from netlify.toml to every page, enforcing, and counts violations.
// Run: npx playwright test -c playwright.csp.config.ts --trace off
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_CSP_PORT ?? 4174);
const OUT = "node_modules/.cache/dist-csp";
const CHROMIUM = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e/csp",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    launchOptions: CHROMIUM ? { executablePath: CHROMIUM } : {},
  },
  webServer: {
    command: `VITE_TURNSTILE_SITE_KEY=1x00000000000000000000BB npx vite build --outDir ${OUT} --emptyOutDir && npx vite preview --outDir ${OUT} --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
