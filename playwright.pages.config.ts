/* SV-03: the page audit's config: the audit config, served by `vite preview` on a built bundle (`npm run audit:pages`
   builds first). A dev server is not the product, and the audit's times would be about Vite. */

import { defineConfig } from "@playwright/test";
import base from "./playwright.audit.config";

const PORT = Number(process.env.PAGES_PORT ?? 4173);
const BASE_URL = `http://127.0.0.1:${PORT}`;
process.env.PERF_BASE_URL = BASE_URL;

export default defineConfig({
  ...base,
  testMatch: /(pages|page-changes|page-fade)\.spec\.ts/,
  use: { ...base.use, baseURL: BASE_URL },
  reporter: [["list"]],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
