// Tier 1: UX-01 P6, card images keep their addresses between visits.
//
// Home's feed is served by a fake; storage signs each picture with a new token every time it is asked. Leave Home for another
// page inside the app and come back: no picture is signed again and none is fetched again, because the address is the same one.

import { expect, test } from "@playwright/test";

import { fakeBoundaries } from "../tier3/support/fakeBackend";
import { PNG } from "./support/postThreadBackend";

const ROW = {
  item_kind: "build", item_at: "2026-10-01T09:00:00.000Z", build_id: "b1", slug: "bakery", title: "Bakery site", outcome: "An ordering site",
  shape: "media", cover_media_id: "m1", creator_id: "c1", creator_username: "maya", creator_display: "Maya", creator_avatar: null,
  reproduction_count: 3, rebuild_count: 0, parent_build_id: null, source_title_at_fork: null, source_handle_at_fork: null, rebuild_note: null,
  repro_note: null, repro_model: null, repro_user_username: null, status: "published", made_for: null, last_confirmed_at: null,
  last_confirmed_model: null, cover_bucket: "build-media", cover_path: "c1/cover.png", cover_kind: "image", cover_poster_path: null,
  repro_worked: null,
};

test("Home's second visit signs no picture again and fetches none again", async ({ page }) => {
  await fakeBoundaries(page);
  let signs = 0;
  let token = 0;
  const pictureGets: string[] = [];
  await page.route(/\/storage\/v1\/(object|render\/image)\/sign\//, (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      signs += 1;
      token += 1;
      const path = request.url().split("/sign/")[1];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ signedURL: `/object/sign/${path}?token=t${token}` }) });
    }
    pictureGets.push(request.url());
    return route.fulfill({ status: 200, contentType: "image/png", headers: { "cache-control": "max-age=3600" }, body: PNG });
  });
  await page.route(/\/rest\/v1\/rpc\/get_build_feed/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([ROW]) }));

  await page.goto("/");
  const picture = page.locator('[data-testid="home-feed"] img[src*="/sign/"]').first();
  await expect(picture).toBeVisible();
  const first = await picture.getAttribute("src");
  const signsAfterFirst = signs;
  const getsAfterFirst = pictureGets.length;
  expect(signsAfterFirst).toBeGreaterThan(0);

  // Leave inside the app, then come back.
  await page.getByRole("link", { name: "Builds", exact: true }).first().click();
  await expect(page).toHaveURL(/\/builds/);
  await page.getByRole("link", { name: "Home", exact: true }).first().click();
  const again = page.locator('[data-testid="home-feed"] img[src*="/sign/"]').first();
  await expect(again).toBeVisible();

  expect(await again.getAttribute("src")).toBe(first);
  expect(signs).toBe(signsAfterFirst);
  expect(pictureGets.length).toBe(getsAfterFirst);
});
