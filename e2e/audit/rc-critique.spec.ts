// RC-P09c — the phase-2 critique screenshots.
//
// WHAT THIS RECORDS. The frame RC-P05 to RC-P08 built — the nav, the phone
// bar, the one search field, no right rail — on the five routes a reader meets
// first, at the four widths the contract names (390, 768, 1024, 1440) and in
// both rooms. It asserts nothing: it saves one screenshot per route, width and
// theme to e2e/audit/critique/phase-2/, which is gitignored, and the critique
// in docs/reconciliation/critique/phase-2.md is written from them.
//
// THE THEME IS SWITCHED THE WAY THE APP'S CONTROL SWITCHES IT. ThemeToggle
// calls ThemeContext's setter, which writes the choice to localStorage under
// "bg-theme" and sets <html data-theme>; index.html's boot script reads that
// key before first paint. withTheme writes the same key before the page loads,
// so the room is set exactly as a returning reader's stored choice sets it.
//
// THE BACKEND IS FAKED. The audit harness answers every table, the auth server
// (signed in as its synthetic reader) and the realtime socket; the builds, the
// home feed, the gallery's facets and the covers then come from
// e2e/audit/fixtures/rcBuilds.ts, registered after the harness so they win.
// Nothing reaches the network, and no row is real user data.
//
// "FULL PAGE" IS THE FIRST SCREEN. The frame is one viewport tall and scrolls
// its centre column inside itself, so a full-page capture of the document is
// exactly what a reader sees on arrival — which is what a critique of the
// frame is about.
//
// Reduced motion is emulated so that no card is caught mid-reveal: the theme
// ends every reveal at its final state under it, which is the state to judge.
//
// DESKTOP PROJECT ONLY: the widths are set here, per capture.

import { test, type Page, type Route } from "@playwright/test";
import { installStub, withSession, withTheme, THEMES } from "./support/harness";
import { RC_BUILDS, RC_FACETS, RC_FEED_ROWS, coverPng } from "./fixtures/rcBuilds";

/** The routes this pass looks at, and the name each one's screenshots carry. */
const ROUTES = [
  { path: "/", name: "home" },
  { path: "/gallery", name: "gallery" },
  { path: "/bounties", name: "bounties" },
  { path: "/notifications", name: "notifications" },
  { path: "/library", name: "library" },
] as const;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

const OUT = "e2e/audit/critique/phase-2";

const wantsObject = (route: Route) =>
  (route.request().headers()["accept"] ?? "").includes("pgrst.object");

/** The fixture's builds, feed and covers, over the harness's answers. */
async function serveRcBuilds(page: Page) {
  await page.route(/\/rest\/v1\/builds(\?|$)/, (route) => {
    const headers = {
      "content-range": `0-${RC_BUILDS.length - 1}/${RC_BUILDS.length}`,
      "access-control-expose-headers": "content-range",
    };
    if (route.request().method() === "HEAD") return route.fulfill({ status: 200, headers, body: "" });
    return route.fulfill({
      status: 200,
      headers,
      contentType: "application/json",
      body: JSON.stringify(wantsObject(route) ? RC_BUILDS[0] : RC_BUILDS),
    });
  });
  await page.route(/\/rest\/v1\/rpc\/get_build_feed/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(RC_FEED_ROWS) }),
  );
  await page.route(/\/rest\/v1\/rpc\/gallery_facets/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(RC_FACETS) }),
  );
  /* A cover is signed one request per row, then fetched: answer the signature
     with a URL naming the same path, and the fetch with that path's picture. */
  await page.route(/\/storage\/v1\//, (route) => {
    const url = route.request().url();
    const path = /build-media\/([^?]+)/.exec(url)?.[1] ?? "rc/cover-1.png";
    if (route.request().method() === "POST" && url.includes("/object/sign/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ signedURL: `/render/image/sign/build-media/${path}?token=rc` }),
      });
    }
    return route.fulfill({ status: 200, contentType: "image/png", body: coverPng(path) });
  });
}

test.describe.configure({ mode: "default" });

for (const route of ROUTES) {
  for (const theme of THEMES) {
    test(`captures ${route.path} in ${theme} at four widths`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "Captured once, on the desktop project.");
      test.setTimeout(240_000);

      await page.emulateMedia({ reducedMotion: "reduce" });
      await withTheme(page, theme);
      await withSession(page);
      await installStub(page);
      await serveRcBuilds(page);

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        await page.goto(route.path, { waitUntil: "networkidle", timeout: 120_000 });
        await page.getByTestId("frame-centre").waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(
          () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        await page.screenshot({
          path: `${OUT}/${route.name}-${viewport.width}-${theme}.png`,
          fullPage: true,
        });
      }
    });
  }
}
