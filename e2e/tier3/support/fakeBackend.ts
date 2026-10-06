// Shared by the UI-P46 / UI-P47 specs: the parts of the faked backend every
// signed-in page needs — the session in storage, the auth, storage and
// functions boundaries, the realtime socket and the font CDN — so each spec
// only writes the tables it is about. Nothing reaches the network.

import type { Page, Route } from "@playwright/test";
import { ME, withSession } from "../../audit/support/harness";

export type Row = Record<string, unknown>;

export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const wantsObject = (route: Route) => (route.request().headers()["accept"] ?? "").includes("pgrst.object");

/** A PostgREST answer: the rows, or the first one for a `.single()` / `.maybeSingle()`. */
export function json(route: Route, rows: unknown[], status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
    body: wantsObject(route) ? JSON.stringify(rows[0] ?? null) : JSON.stringify(rows),
  });
}

/** The boundaries every page talks through. `signedIn: false` leaves storage empty, so ProtectedRoute redirects. */
export async function fakeBoundaries(page: Page, { signedIn = true }: { signedIn?: boolean } = {}) {
  if (signedIn) await withSession(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.request().url().includes("css2")
      ? route.fulfill({ status: 200, contentType: "text/css", body: "" })
      : route.fulfill({ status: 200, contentType: "font/woff2", body: "" }),
  );
  await page.routeWebSocket(/\/realtime\/v1\//, () => {
    /* no broker */
  });
  await page.route(/\/auth\/v1\//, (route) =>
    signedIn && route.request().url().includes("/user")
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: ME.id, aud: "authenticated" }) })
      : route.fulfill({ status: 401, contentType: "application/json", body: '{"msg":"no session"}' }),
  );
  await page.route(/\/(storage|functions)\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  // Widest first: Playwright matches the LAST registered route first.
  await page.route(/\/rest\/v1\//, (route) => json(route, []));
  await page.route(/\/rest\/v1\/rpc\/gallery_facets/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ roles: ["photographers", "families"], tools: [] }) }),
  );
  await page.route(/\/rest\/v1\/profiles\?/, (route) =>
    json(route, [{ id: ME.id, username: ME.username, display_name: ME.display_name, avatar_url: null, is_admin: false }]),
  );
}
