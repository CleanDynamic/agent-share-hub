/* SV-03, moved here by SV-04: the audit database for `npm run audit:pages`. The harness (harness.ts), plus the SV-03 rows
   answered the way PostgREST would (restFilter.ts), with every database request held DB_DELAY_MS. pages.spec.ts and
   page-changes.spec.ts both stage a page with it. */

import type { Page } from "@playwright/test";

import { SV_BUILD_SESSIONS, SV_DRAFTS, SV_IMPORT_SESSIONS, SV_SAVES } from "../fixtures/svPages";
import { BUILDS, installStub, withSession, withTheme } from "./harness";
import { DB_DELAY_MS } from "./pageTargets";
import { filterRows } from "./restFilter";

export interface Span {
  url: string;
  start: number;
  end: number;
  bytes: number;
}

export const isDatabase = (url: string) => /\/(rest|auth|functions)\/v1\//.test(url);

/** The harness, plus the SV-03 rows answered the way PostgREST would, and the delay on every database request. */
export async function stage(page: Page, options: { auth: boolean }, spans: Span[]) {
  await withTheme(page, "dusk");
  if (options.auth) await withSession(page);
  await installStub(page);

  const answer = (rows: Record<string, unknown>[]) => async (route: import("@playwright/test").Route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const found = filterRows(rows, route.request().url());
    const object = (route.request().headers()["accept"] ?? "").includes("pgrst.object");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": `0-${Math.max(found.length - 1, 0)}/${found.length}`, "access-control-allow-origin": "*" },
      body: JSON.stringify(object ? (found[0] ?? null) : found),
    });
  };
  await page.route(/\/rest\/v1\/builds(\?|$)/, answer([...BUILDS, ...SV_DRAFTS]));
  await page.route(/\/rest\/v1\/import_sessions(\?|$)/, answer(SV_IMPORT_SESSIONS));
  await page.route(/\/rest\/v1\/build_sessions(\?|$)/, answer(SV_BUILD_SESSIONS));
  await page.route(/\/rest\/v1\/build_saves(\?|$)/, answer(SV_SAVES(String(BUILDS[0].id))));

  // Registered last, so it runs first: hold the request, then hand it to the handlers above.
  await page.route(/\/(rest|auth|functions)\/v1\//, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, DB_DELAY_MS));
    await route.fallback();
  });

  const open = new Map<import("@playwright/test").Request, number>();
  page.on("request", (request) => {
    if (isDatabase(request.url())) open.set(request, Date.now());
  });
  const done = (request: import("@playwright/test").Request) => {
    const start = open.get(request);
    if (start === undefined) return;
    open.delete(request);
    spans.push({ url: request.url(), start, end: Date.now(), bytes: 0 });
  };
  page.on("requestfinished", done);
  page.on("requestfailed", done);
  page.on("response", (response) => {
    if (!isDatabase(response.url())) return;
    void response
      .body()
      .then((body) => {
        const span = [...spans].reverse().find((entry) => entry.url === response.url() && entry.bytes === 0);
        if (span) span.bytes = body.length;
        else spans.push({ url: response.url(), start: Date.now(), end: Date.now(), bytes: body.length });
      })
      .catch(() => {});
  });
}

