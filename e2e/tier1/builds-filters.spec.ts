// Tier 1: the Builds filters series (BF-00 on). One file for the series' end to end tests; each BF prompt adds its own.
//
// It opens the page the way builds-site-frame.spec.ts does (same imports, same projects), so it needs no auth. That spec
// settles for the loading state because nothing answers the page's reads; this one answers every read with no rows, so
// the page leaves loading and draws its table. Nothing here asserts anything about the filter rail yet.

import { expect, test, type Page } from "@playwright/test";

/** Every REST and RPC read returns no rows, with a zero total, so the page settles with an empty table. */
async function answerWithNoRows(page: Page) {
  await page.route(/\/rest\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": "*/0" }, body: "[]" }),
  );
}

/** BF-06: twelve builds for the list read, every one with each column the default Table draws filled, so the table is as
    wide as a real one; every other read has no rows. The list is the one read that selects `slug`. */
async function answerWithBuilds(page: Page) {
  const now = Date.now();
  const rows = Array.from({ length: 12 }, (_, at) => ({
    id: `b${at}`,
    slug: `b${at}`,
    title: ["Lead scoring from CRM notes", "Call notes that write themselves", "Proposal writer with pricing"][at % 3],
    shape: "workflow",
    made_with: ["Claude Code", "Cursor", "n8n"],
    reproduction_count: 12 + at,
    last_confirmed_at: new Date(now - (at + 1) * 86_400_000).toISOString(),
    last_confirmed_model: "opus-5-5",
    published_at: new Date(now - 90 * 86_400_000).toISOString(),
    rebuild_count: 3,
    classification: { declared: { field: [{ id: "medicine" }] }, derived: { built: { values: ["browser-extension"] }, cost: { values: ["extra-usage-10-to-50-a-month"] } } },
    maker: { username: `maker${at}`, display_name: null },
    step_count: 14 + at,
    session_count: 3,
    still_open_topics: 2,
    build_reproductions: [{ confirmed_at: new Date(now - 3 * 86_400_000).toISOString() }],
  }));
  await page.route(/\/rest\/v1\//, (route) => {
    const url = new URL(route.request().url());
    const list = url.pathname.endsWith("/builds") && (url.searchParams.get("select") ?? "").includes("slug");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": list ? `0-11/${rows.length}` : "*/0" },
      body: list ? JSON.stringify(rows) : "[]",
    });
  });
}

async function open(page: Page, path = "/builds", answer: (page: Page) => Promise<void> = answerWithNoRows) {
  await answer(page);
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem("bg-theme", "noon");
    } catch {
      /* private window: the default theme is a fine fallback */
    }
  });
  await page.goto(path);
  await expect(page.getByTestId("site-frame")).toBeVisible();
}

test.describe("/builds filters", () => {
  test("builds: the page opens with its table", async ({ page }) => {
    await open(page);
    await expect(page.getByTestId("builds-page")).toBeVisible();
    await expect(page.getByTestId("builds-table")).toBeVisible();
    const views = page.getByRole("navigation", { name: "View" });
    await expect(views.getByRole("link")).toHaveCount(3);
    for (const name of ["Table", "Maps", "Classification"]) await expect(views.getByRole("link", { name })).toBeVisible();
  });

  // BF-03 P1 (D1): one head on every view, so the switch stays under the pointer.
  test("the view switch does not move between Table, Maps and Classification", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await open(page);
    await expect(page.getByTestId("builds-table")).toBeVisible();
    const views = page.getByRole("navigation", { name: "View" });
    const table = await views.boundingBox();
    await views.getByRole("link", { name: "Maps" }).click();
    await expect(page.getByTestId("builds-maps")).toBeVisible();
    const maps = await views.boundingBox();
    await views.getByRole("link", { name: "Classification" }).click();
    await expect(page.getByTestId("builds-classification")).toBeVisible();
    const classification = await views.boundingBox();
    for (const box of [maps, classification]) {
      expect(Math.abs(box!.y - table!.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(box!.x - table!.x)).toBeLessThanOrEqual(1);
    }
  });

  // BF-05 P3 (G3): no pointer target under 24 by 24 (WCAG 2.5.8). A target that cannot reach 24 without moving its
  // neighbours goes in ALLOWED with the reason. A link that is a word inside a sentence is the exception the rule
  // allows; there is none on these pages today.
  const ALLOWED: readonly { name: RegExp; why: string }[] = [
    { name: /^button "Move /, why: "the grip is 16 by 20 and BF-07 deletes it" },
    { name: /^button "(You do each step|AI suggests and you approve|AI acts with approval gates|Fully autonomous)"/, why: "the Autonomy segments are 18 high and BF-09 deletes them" },
    { name: /^button "All" /, why: "the lens tab is the shared TextTabs, 16 wide on its own label; shared controls are measured and reported, not edited here" },
    { name: /^div "Resize /, why: "a drag handle 8 high between a list and the next section: 24 would cover the last rows and the next head, so it stays and is reported" },
  ];

  async function smallTargets(page: Page) {
    // The Table's root is `builds-page`; Maps and Classification pass their own test id to the same frame.
    const root = page.locator('[data-testid="builds-page"], [data-testid="builds-maps"], [data-testid="builds-classification"]').first();
    return root.evaluate((root) => {
      const picked = Array.from(root.querySelectorAll<HTMLElement>('button, a[href], [role="slider"], input, label, [tabindex="0"]'))
        .filter((el) => el.tagName !== "LABEL" || el.querySelector("input"));
      const small: string[] = [];
      for (const el of picked) {
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue; // not visible
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || style.display === "none") continue;
        if (box.width >= 24 && box.height >= 24) continue;
        const name = el.getAttribute("aria-label") || (el.textContent ?? "").trim().slice(0, 40) || el.tagName.toLowerCase();
        small.push(`${el.tagName.toLowerCase()} "${name}" ${Math.round(box.width * 10) / 10} x ${Math.round(box.height * 10) / 10}`);
      }
      return small;
    });
  }

  // The page answers every read with no rows, so the table, the chips and the slider do not draw. The kit pages draw
  // the same views with the vision boards' sample data, so every control the series adds is measured there too.
  for (const [label, path] of [
    ["Table (sample data)", "/dev/kit/pages/vision-builds-table?theme=noon&viewport=desktop"],
    ["Maps (sample data)", "/dev/kit/pages/vision-builds-maps?theme=noon&viewport=desktop"],
    ["Classification (sample data)", "/dev/kit/pages/vision-builds-classification?theme=noon&viewport=desktop"],
  ] as const) {
    test(`${label}: no pointer target is smaller than 24 by 24`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "desktop project only");
      await page.goto(path);
      await expect(page.locator('[data-design-ready="true"]')).toBeVisible();
      const small = (await smallTargets(page)).filter((line) => !ALLOWED.some((a) => a.name.test(line)));
      // eslint-disable-next-line no-console
      console.log(`${label}: ${small.length} target(s) under 24`, small);
      expect(small).toEqual([]);
    });
  }

  for (const [label, path, testId] of [
    ["Table", "/builds", "builds-table"],
    ["Maps", "/builds?view=maps", "builds-maps"],
    ["Classification", "/builds?view=classification", "builds-classification"],
  ] as const) {
    test(`${label}: no pointer target is smaller than 24 by 24`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "desktop project only");
      await open(page, path);
      await expect(page.getByTestId(testId)).toBeVisible();
      const small = (await smallTargets(page)).filter((line) => !ALLOWED.some((a) => a.name.test(line)));
      // eslint-disable-next-line no-console
      console.log(`${label}: ${small.length} target(s) under 24`, small);
      expect(small).toEqual([]);
    });
  }

  /* ── BF-06 P2 (A1, C5a, C13) ── */

  test("desktop at 1440 by 900: the default table does not scroll sideways", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "/builds", answerWithBuilds);
    const region = page.getByRole("region", { name: "Builds table" });
    await expect(region).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Steps" })).toBeVisible();
    const widths = await region.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, columns: el.querySelectorAll("th").length }));
    // eslint-disable-next-line no-console
    console.log(`Builds table at 1440: scrollWidth ${widths.scroll}, clientWidth ${widths.client}, ${widths.columns} columns`);
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  });

  test("mobile: Filters opens a full screen dialog, and Done closes it", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile project only");
    await open(page, "/builds", answerWithBuilds);
    await page.getByRole("button", { name: /^Filters/ }).click();
    const dialog = page.getByRole("dialog", { name: "Filters" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize()!;
    expect(Math.round(box!.x)).toBe(0);
    expect(Math.round(box!.y)).toBe(0);
    expect(Math.round(box!.width)).toBe(viewport.width);
    expect(Math.abs(box!.height - viewport.height)).toBeLessThanOrEqual(1);
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).toBeHidden();
  });

  test("desktop: with the dialog open, Tab stays inside it and Escape returns focus to Filters", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await open(page, "/builds", answerWithBuilds);
    const button = page.getByRole("button", { name: /^Filters/ });
    await button.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Filters" });
    await expect(dialog).toBeVisible();
    for (let step = 0; step < 40; step += 1) {
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();
  });

  /* ── BF-06 P3 (E5, X1) ── */

  for (const [label, path, card] of [
    ["Classification", "/builds?view=classification", "classification-card"],
    ["Maps", "/builds?view=maps", "map-card"],
  ] as const) {
    test(`${label}: opening Filters does not move the first card`, async ({ page }) => {
      await open(page, path, answerWithBuilds);
      const first = page.getByTestId(card).first();
      await expect(first).toBeVisible();
      const before = await first.boundingBox();
      await page.getByRole("button", { name: /^Filters/ }).click();
      await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
      const after = await first.boundingBox();
      for (const key of ["x", "y", "width", "height"] as const) expect(Math.abs(after![key] - before![key])).toBeLessThanOrEqual(1);
    });
  }
});
