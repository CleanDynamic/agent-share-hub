// TEMPORARY, not committed. The repo pins a @playwright/test whose bundled
// Chromium is build 1208; this container has 1194 preinstalled and no network
// install is wanted. Extending the real config with an explicit executablePath
// runs the same specs against the browser that is actually here.
import base from "./playwright.config";

export default {
  ...base,
  // This container cannot bind `::`, which the real config's `npx vite` does,
  // so the suite runs against a dev server already started on 127.0.0.1.
  webServer: undefined,
  use: {
    ...base.use,
    launchOptions: { executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" },
  },
  projects: (base.projects ?? []).map((p: any) => ({
    ...p,
    use: {
      ...(p.use ?? {}),
      launchOptions: { executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" },
    },
  })),
};
