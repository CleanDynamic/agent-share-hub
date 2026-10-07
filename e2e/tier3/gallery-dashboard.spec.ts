// UI-P50 — the Gallery dashboard, in a real browser.
//
// THE BACKEND IS FAKED (support/galleryFeedBackend.ts). It answers every builds
// read with all four builds; the page applies the lab, session and window
// filters itself as well as asking the database for them, so what is asserted
// is what a reader sees and what the address says. The dashboard is desktop
// only: on the mobile project the same address shows the feed.

import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { fakeFeedBackend, type FeedBuild } from "./support/galleryFeedBackend";

const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768;

/** By engagement: CV, Inbox, Photo, Receipt. By prompts: Inbox, Receipt, Photo, CV. */
const BUILDS: FeedBuild[] = [
  { n: 1, title: "Photo renamer by date taken", handle: "maria", models: ["claude-sonnet-5-5", "claude-opus-5-5"], proof: { "claude-sonnet-5-5": 5 }, reproductionCount: 11, sessions: 2, prompts: 10, turns: 30 },
  { n: 2, title: "CV tailored to a job ad", handle: "dana", models: ["gpt-6-astra"], proof: { "gpt-6-astra": 15 }, reproductionCount: 74, sessions: 1, prompts: 4, turns: 10 },
  { n: 3, title: "Inbox triage for a small shop", handle: "priya", models: ["claude-sonnet-5-5", "gemini-3.8-flash"], proof: { "claude-sonnet-5-5": 9 }, reproductionCount: 52, sessions: 4, prompts: 20, turns: 80 },
  { n: 4, title: "Receipt photos to an expenses sheet", handle: "sam", models: ["gemini-4-argon"], reproductionCount: 5, sessions: 3, prompts: 12, turns: 40 },
];

const titles = (page: Page) => page.getByTestId("dash-row").getByRole("button", { name: /^(?!Open details)/ }).allTextContents();

test.beforeEach(async ({ page }) => {
  await fakeFeedBackend(page, BUILDS);
});

test("Dashboard shows the table, sorted by engagement", async ({ page }) => {
  test.skip(isPhone(page), "the dashboard is desktop only");
  await page.goto("/gallery");
  await page.getByRole("radiogroup", { name: "Gallery view" }).getByRole("radio", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/gallery\?view=dashboard$/);

  await expect(page.getByRole("table", { name: "Builds" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Builds");
  await expect(page.getByTestId("dash-pill")).toHaveText("All models");
  await expect.poll(() => titles(page)).toEqual([
    "CV tailored to a job ad",
    "Inbox triage for a small shop",
    "Photo renamer by date taken",
    "Receipt photos to an expenses sheet",
  ]);
  await expect(page.getByTestId("dash-footer")).toContainText("4 builds in view");
});

test("Sort by Prompts reorders the table and is written to the address", async ({ page }) => {
  test.skip(isPhone(page), "the dashboard is desktop only");
  await page.goto("/gallery?view=dashboard");
  await expect(page.getByTestId("dash-row")).toHaveCount(4);

  await page.getByTestId("dash-menu-sort").click();
  await page.getByRole("menuitemradio", { name: "Prompts" }).click();
  await expect(page).toHaveURL(/dsort=prompts/);
  await expect(page.getByTestId("dash-menu-sort")).toContainText("Prompts");
  await expect.poll(() => titles(page)).toEqual([
    "Inbox triage for a small shop",
    "Receipt photos to an expenses sheet",
    "Photo renamer by date taken",
    "CV tailored to a job ad",
  ]);
});

test("choosing the Google lab filters the table and the pill reads Google models", async ({ page }) => {
  test.skip(isPhone(page), "the dashboard is desktop only");
  await page.goto("/gallery?view=dashboard");
  await expect(page.getByTestId("dash-row")).toHaveCount(4);

  await page.getByTestId("dash-lab-Google").click();
  await expect(page).toHaveURL(/lab=Google/);
  await expect(page.getByTestId("dash-lab-Google")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("dash-pill")).toHaveText("Google models");
  await expect.poll(() => titles(page)).toEqual(["Inbox triage for a small shop", "Receipt photos to an expenses sheet"]);

  // Choosing it again clears it.
  await page.getByTestId("dash-lab-Google").click();
  await expect(page).toHaveURL(/\/gallery\?view=dashboard$/);
  await expect(page.getByTestId("dash-row")).toHaveCount(4);
});

test("Built over 3+ sessions leaves only the builds with 3 or more", async ({ page }) => {
  test.skip(isPhone(page), "the dashboard is desktop only");
  await page.goto("/gallery?view=dashboard");
  await expect(page.getByTestId("dash-row")).toHaveCount(4);

  await page.getByTestId("dash-report-multi").click();
  await expect(page).toHaveURL(/report=multi/);
  await expect.poll(() => titles(page)).toEqual(["Inbox triage for a small shop", "Receipt photos to an expenses sheet"]);
  const sessions = await page.getByTestId("dash-row").evaluateAll((rows) =>
    rows.map((row) => Number(row.querySelectorAll('[role="cell"]')[2].textContent)),
  );
  expect(sessions.every((n) => n >= 3)).toBe(true);
});

test("a search nobody matches says so, and Clear filters brings the builds back", async ({ page }) => {
  test.skip(isPhone(page), "the dashboard is desktop only");
  await page.goto("/gallery?view=dashboard&q=zzzz");
  await expect(page.getByText("No builds match these filters.")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/gallery\?view=dashboard$/);
  await expect(page.getByTestId("dash-row")).toHaveCount(4);
});

test("Export downloads gallery-builds.csv with the header row and the rows in view", async ({ page }) => {
  test.skip(isPhone(page), "the dashboard is desktop only");
  await page.goto("/gallery?view=dashboard&lab=Google");
  await expect(page.getByTestId("dash-row")).toHaveCount(2);

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("dash-export").click()]);
  expect(download.suggestedFilename()).toBe("gallery-builds.csv");
  const path = await download.path();
  const lines = readFileSync(path, "utf8").trim().split("\r\n");
  expect(lines[0]).toBe("Title,Maker,Models,Sessions,Prompts,AI turns,Engagement,Last activity");
  expect(lines).toHaveLength(3);
  expect(lines[1]).toMatch(/^Inbox triage for a small shop,priya,Sonnet 5\.5; Gemini 3\.8 Flash,4,20,80,52,/);
});

test("on a phone, view=dashboard shows the feed", async ({ page }) => {
  test.skip(!isPhone(page), "the phone project only");
  await page.goto("/gallery?view=dashboard");
  await expect(page.getByTestId("gallery-feed")).toBeVisible();
  await expect(page.getByRole("table", { name: "Builds" })).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
