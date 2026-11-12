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
    { name: /^button "All" /, why: "the lens tab is the shared TextTabs, 16 wide on its own label; shared controls are measured and reported, not edited here" },
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

  // BF-08 put Cancel and Apply in the footer in place of Done.
  test("mobile: Filters opens a full screen dialog, and Cancel closes it", async ({ page }, testInfo) => {
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
    await dialog.getByRole("button", { name: "Cancel" }).click();
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

  /* ── BF-10 P3 (C9) ── */

  test("ticking a column in the chooser shows its head while the chooser is still open, and the chooser does not cover it", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "/builds", answerWithBuilds);
    await page.getByRole("button", { name: /^Columns:/ }).click();
    const chooser = page.getByRole("dialog").filter({ has: page.getByRole("group", { name: "Columns" }) });
    await expect(chooser).toBeVisible();
    await chooser.getByRole("checkbox", { name: "Shape" }).check();
    const head = page.getByRole("columnheader", { name: "Shape" });
    await expect(head).toBeVisible();
    await expect(chooser).toBeVisible();
    await head.scrollIntoViewIfNeeded();
    const [a, b] = [await head.boundingBox(), await chooser.boundingBox()];
    // eslint-disable-next-line no-console
    console.log(`Shape head ${JSON.stringify(a)}, chooser ${JSON.stringify(b)}`);
    const overlaps = a!.x < b!.x + b!.width && b!.x < a!.x + a!.width && a!.y < b!.y + b!.height && b!.y < a!.y + a!.height;
    expect(overlaps).toBe(false);
  });

  test("phone at 390: the chooser stays on the screen", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile project only");
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, "/builds", answerWithBuilds);
    await page.getByRole("button", { name: /^Columns:/ }).click();
    const chooser = page.getByRole("dialog").filter({ has: page.getByRole("group", { name: "Columns" }) });
    await expect(chooser).toBeVisible();
    const box = (await chooser.boundingBox())!;
    const viewport = page.viewportSize()!;
    // eslint-disable-next-line no-console
    console.log(`phone chooser ${JSON.stringify(box)} in ${viewport.width} x ${viewport.height}, side ${await chooser.getAttribute("data-side")}`);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  });

  /* ── BF-12 P4 (B5) ── */

  test("Shift with Enter on a focused head sets the second key, as Shift-click does", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await open(page, "/builds?by=field", answerWithBuilds);
    const button = page.getByRole("columnheader", { name: /^Reproductions/ }).getByRole("button");
    await button.focus();
    await page.keyboard.press("Shift+Enter");
    await expect(page).toHaveURL(/by=field&by2=reproductions/);
    await expect(page.getByRole("columnheader", { name: /^Reproductions/ })).toHaveAttribute("aria-sort", "other");
    await page.getByRole("columnheader", { name: /^Field/ }).getByRole("button").click();
    await expect(page).not.toHaveURL(/by2=/);
    await page.getByRole("columnheader", { name: /^Rebuilds/ }).getByRole("button").click({ modifiers: ["Shift"] });
    await expect(page).toHaveURL(/by2=rebuilds/);
  });

  /* ── BF-13 P2 (C6) ── */

  const headNames = (page: Page) => page.getByRole("columnheader").evaluateAll((heads) => heads.map((head) => (head.textContent ?? "").replace(/[↑↓]2?/g, "").trim()));

  test("dragging the Field head past Tools and stack puts Field after it, and no text is selected", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await open(page, "/builds", answerWithBuilds);
    await expect(page.getByRole("columnheader", { name: /^Field/ })).toBeVisible();
    const before = await headNames(page);
    expect(before.indexOf("Field") + 1).toBe(before.indexOf("Tools"));
    const field = (await page.getByRole("columnheader", { name: /^Field/ }).boundingBox())!;
    const tools = (await page.getByRole("columnheader", { name: /^Tools/ }).boundingBox())!;
    const y = field.y + field.height / 2;
    await page.mouse.move(field.x + 10, y);
    await page.mouse.down();
    await page.mouse.move(field.x + 10 + 8, y, { steps: 2 });
    /* Far enough that the dragged head's centre passes the next head's centre by 4px. */
    const dx = tools.x + tools.width / 2 - (field.x + field.width / 2) + 4;
    await page.mouse.move(field.x + 10 + dx, y, { steps: 8 });
    await page.mouse.up();
    const swapped = [...before];
    swapped.splice(before.indexOf("Field"), 2, "Tools", "Field");
    await expect.poll(() => headNames(page)).toEqual(swapped);
    expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toBe("");
    await expect(page).not.toHaveURL(/by=field/);
    await page.reload();
    await expect(page.getByRole("columnheader", { name: /^Field/ })).toBeVisible();
    const after = await headNames(page);
    expect(after.indexOf("Field")).toBe(after.indexOf("Tools") + 1);
  });

  test("a press without movement still sorts", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await open(page, "/builds", answerWithBuilds);
    await page.getByRole("columnheader", { name: /^Field/ }).getByRole("button").click();
    await expect(page).toHaveURL(/by=field/);
  });

  /* ── BF-13 P3 (C5b) ── */

  test("scrolling the table to its right end leaves the first build's name on screen", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await page.setViewportSize({ width: 1280, height: 900 });
    const all = ["build", "built", "field", "tools", "steps", "sessions", "reproductions", "confirmed", "runs", "rebuilds", "open", "cost", "shape", "task", "setting", "role", "technique", "modality", "method", "autonomy", "data", "oversight", "age", "skill", "works", "likes", "patterns", "published"];
    await page.addInitScript((columns) => window.localStorage.setItem("builds:layout:v1", JSON.stringify({ columns, calculations: [] })), all);
    await open(page, "/builds", answerWithBuilds);
    const region = page.getByRole("region", { name: "Builds table" });
    await expect(page.getByRole("columnheader", { name: /^Published/ })).toBeAttached();
    await region.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
    await expect(region).toHaveAttribute("data-scrolled", "true");
    const link = page.getByRole("link", { name: "Lead scoring from CRM notes" }).first();
    const [box, frame] = [(await link.boundingBox())!, (await region.boundingBox())!];
    expect(box.x).toBeGreaterThanOrEqual(frame.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width);
    /* Nothing is drawn over it: the topmost element at its centre is the link. */
    const onTop = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("a")?.textContent ?? "", [box.x + box.width / 2, box.y + box.height / 2]);
    expect(onTop).toBe("Lead scoring from CRM notes");
  });

  test("at 1440 with the default columns and four filters on, the table does not scroll sideways", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "/builds?tool=claude-code&f=field%3Amedicine&steps=5-30&reproductions=1-50", answerWithBuilds);
    const region = page.getByRole("region", { name: "Builds table" });
    await expect(page.getByRole("columnheader", { name: /^Steps/ })).toBeVisible();
    const widths = await region.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, columns: el.querySelectorAll("th").length }));
    // eslint-disable-next-line no-console
    console.log(`Builds table at 1440 with four filters: scrollWidth ${widths.scroll}, clientWidth ${widths.client}, ${widths.columns} columns`);
    expect(widths.scroll).toBeLessThanOrEqual(widths.client);
  });

  /* ── BF-15 P2: the 10 November walk-through, replayed ── */

  test("the 10 November walk-through", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "desktop project only");
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const now = Date.now();
    const S = ["typed-0b1c2d3e-0000-4000-8000-0000000000c1", "typed-0b1c2d3e-0000-4000-8000-0000000000c2", "typed-0b1c2d3e-0000-4000-8000-0000000000c3"];
    /* Two builds: one with three sessions and a classification, one with nothing. */
    const full = {
      id: "wa", slug: "wa", title: "Inbox triage", shape: "workflow", made_with: ["Claude Code"], reproduction_count: 4,
      last_confirmed_at: new Date(now - 2 * 86_400_000).toISOString(), last_confirmed_model: "opus-5-5", published_at: new Date(now - 30 * 86_400_000).toISOString(),
      rebuild_count: 1, classification: { declared: { field: [{ id: "medicine" }] }, derived: { built: { values: ["browser-extension"] } } },
      maker: { username: "kit", display_name: null }, step_count: 6, session_count: 3, still_open_topics: 0,
      build_reproductions: [{ confirmed_at: new Date(now - 2 * 86_400_000).toISOString() }],
    };
    const empty = {
      id: "wb", slug: "wb", title: "Blank build", shape: "app", made_with: [], reproduction_count: 0, last_confirmed_at: null, last_confirmed_model: null,
      published_at: new Date(now - 10 * 86_400_000).toISOString(), rebuild_count: 0, classification: {}, maker: { username: "ava", display_name: null },
      step_count: null, session_count: 0, still_open_topics: 0, build_reproductions: [],
    };
    const map = {
      id: "wa",
      making: { sessions: [], excluded_models: [], session_order: S, sessions_meta: Object.fromEntries(S.map((key, at) => [key, { tool: "claude", model: "Opus 5.5", date: "2026-10-12", title: `Session ${at + 1}` }])) },
      build_nodes: S.map((key, at) => ({ id: `wn${at}`, parent_id: null, position: at + 1, type: "prompt", title: null, payload: { text: `Step ${at + 1}`, tool: "claude", model: "Opus 5.5", session: key }, is_gap: false })),
    };
    await page.route(/\/rest\/v1\//, (route) => {
      const url = new URL(route.request().url());
      const select = url.searchParams.get("select") ?? "";
      const filtered = url.searchParams.has("facets");
      const rows = filtered ? [full] : [full, empty];
      if (url.pathname.endsWith("/builds") && select.includes("making")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([map, { id: "wb", making: null, build_nodes: [] }]) });
      if (url.pathname.endsWith("/builds") && select.includes("slug")) return route.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": `0-${rows.length - 1}/${rows.length}`, "access-control-expose-headers": "content-range" }, body: JSON.stringify(rows) });
      const count = url.pathname.endsWith("/builds") ? rows.length : 0;
      /* A count is read from content-range, which a cross-origin answer must expose. */
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": `*/${count}`, "access-control-expose-headers": "content-range" }, body: "[]" });
    });
    await open(page, "/builds", async () => undefined);
    const region = page.getByRole("region", { name: "Builds table" });
    const blankRow = page.getByRole("row", { name: /Blank build/ });

    await test.step("1 (A1 C5a C4 C10 C3): the table, no aside, no blank cell, no lamp at zero", async () => {
      await expect(blankRow).toBeVisible();
      await expect(page.getByRole("complementary", { name: "Filters" })).toHaveCount(0);
      expect(await region.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await page.locator("tbody td").evaluateAll((cells) => cells.filter((cell) => (cell.textContent ?? "").trim() === "" && !cell.querySelector("[role=img], a")).length)).toBe(0);
      await expect(blankRow.getByRole("cell").nth(6)).toContainText("0");
      await expect(blankRow.getByRole("img", { name: /Confirmed in the last|Stale/ })).toHaveCount(0);
      const runs = page.getByTestId("stat-runs");
      if ((await runs.count()) > 0 && (await runs.textContent())?.trim().startsWith("0")) {
        const [mark, evidence] = await runs.evaluate((el) => {
          const probe = document.createElement("span");
          probe.style.color = "var(--evidence)";
          document.body.appendChild(probe);
          const colours = [getComputedStyle(el).color, getComputedStyle(probe).color];
          probe.remove();
          return colours;
        });
        expect(mark).not.toBe(evidence);
      }
    });

    const dialog = page.getByRole("dialog", { name: "Filters" });
    await test.step("2 (A1 A6 A3 A9): Filters is a dialog with no grip, Classification current, Autonomy labelled", async () => {
      await page.getByRole("button", { name: /^Filters/ }).click();
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/drag to reorder/i)).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: /^Move |grip/i })).toHaveCount(0);
      await expect(dialog.getByRole("button", { name: /^Classification/ })).toHaveAttribute("aria-current", "true");
      const autonomy = dialog.getByRole("region", { name: "Autonomy" });
      const values = autonomy.getByRole("button");
      expect(await values.count()).toBeGreaterThan(1);
      for (const text of await values.allTextContents()) expect(text.trim().length).toBeGreaterThan(0);
    });

    await test.step("3 (A3 A5): a group, then Find a filter narrows the list and nothing else moves", async () => {
      await dialog.getByRole("button", { name: /^Proof/ }).click();
      const before = await dialog.boundingBox();
      await dialog.getByRole("searchbox", { name: "Find a filter" }).or(dialog.getByRole("textbox", { name: "Find a filter" })).fill("conf");
      await expect(dialog.getByRole("heading", { level: 3 })).toHaveText(["Last confirmed", "Confirmed or stale"]);
      expect(await dialog.boundingBox()).toEqual(before);
    });

    await test.step("4 (A2): Escape closes, focus is on Filters, the address did not change", async () => {
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Filters/ })).toBeFocused();
      await expect(page).toHaveURL(/\/builds$/);
    });

    await test.step("5 (B3 C6): Field sorts both ways, and its head drags with no text selected", async () => {
      const field = () => page.getByRole("columnheader", { name: /^Field/ });
      await field().getByRole("button").click();
      await expect(field()).toHaveAttribute("aria-sort", "descending");
      await field().getByRole("button").click();
      await expect(field()).toHaveAttribute("aria-sort", "ascending");
      const before = await page.getByRole("columnheader").allTextContents();
      const [a, b] = [(await field().boundingBox())!, (await page.getByRole("columnheader", { name: /^Tools/ }).boundingBox())!];
      await page.mouse.move(a.x + 10, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(a.x + 18, a.y + a.height / 2, { steps: 2 });
      await page.mouse.move(a.x + 10 + (b.x + b.width / 2) - (a.x + a.width / 2) + 4, a.y + a.height / 2, { steps: 6 });
      await page.mouse.up();
      await expect.poll(() => page.getByRole("columnheader").allTextContents()).not.toEqual(before);
      expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toBe("");
    });

    await test.step("6 (C9): Columns is grouped and opens to the left; ticking Shape shows its head on one line", async () => {
      await page.getByRole("button", { name: /^Columns:/ }).click();
      const chooser = page.getByRole("dialog").filter({ has: page.getByRole("group", { name: "Columns" }) });
      await expect(chooser).toHaveAttribute("data-side", "left");
      expect(await chooser.getByRole("group").count()).toBeGreaterThan(2);
      await chooser.getByRole("checkbox", { name: "Shape" }).check();
      const shape = page.getByRole("columnheader", { name: /^Shape/ });
      await expect(shape).toBeVisible();
      expect((await shape.boundingBox())!.height).toBeLessThan(40);
      await page.keyboard.press("Escape");
    });

    await test.step("7 (F1): Save current needs a signed-in reader; signed out there is no Saved group", async () => {
      await page.getByRole("button", { name: /^Filters/ }).click();
      await expect(dialog.getByRole("button", { name: /^Saved/ })).toHaveCount(0);
      await page.keyboard.press("Escape");
    });

    const views = page.getByRole("navigation", { name: "View" });
    const switchBox = await views.boundingBox();
    await test.step("8 (D1 D2 D3): Maps keeps the switch and the count; no sessions and three sessions", async () => {
      await views.getByRole("link", { name: "Maps" }).click();
      await expect(page).toHaveURL(/view=maps/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("2 builds");
      expect(await views.boundingBox()).toEqual(switchBox);
      await expect(page.getByText("No sessions yet")).toBeVisible();
      await expect(page.getByText(/No sessions$/)).toBeVisible();
      await expect(page.getByText(/3 sessions/).first()).toBeVisible();
    });

    await test.step("9 (E3 E4): Classification's key is directly above the cards and names derived; the blank card collapses", async () => {
      await views.getByRole("link", { name: "Classification" }).click();
      await expect(page).toHaveURL(/view=classification/);
      const key = page.getByTestId("classification-key");
      await expect(key).toContainText("derived");
      expect(await key.evaluate((el) => Boolean(el.nextElementSibling?.querySelector("[data-testid=classification-card]")))).toBe(true);
      await expect(page.getByTestId("classification-card").filter({ hasText: "Blank build" })).toContainText("Not classified yet");
    });

    await test.step("10 (E5): opening Filters there does not move the first card", async () => {
      const card = page.getByTestId("classification-card").first();
      const before = await card.boundingBox();
      await page.getByRole("button", { name: /^Filters/ }).click();
      await expect(dialog).toBeVisible();
      expect(await card.boundingBox()).toEqual(before);
      await page.keyboard.press("Escape");
    });

    await test.step("11 (E1 X3 C2): pressing a value filters in place, with its chip, down to one card", async () => {
      await page.getByTestId("classification-card").first().getByRole("link", { name: "Medicine and health" }).click();
      await expect(page).toHaveURL(/view=classification/);
      await expect(page.getByRole("group", { name: "Active filters" })).toContainText("Field");
      await expect(page.getByTestId("classification-card")).toHaveCount(1);
    });

    await test.step("12 (C3 C1 B1 B2 C6): Table reads 1 of 2, the All tab 1, Field is marked filtered, one footer cell a column", async () => {
      await views.getByRole("link", { name: "Table" }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("1 of 2 builds");
      await expect(page.getByRole("tab", { name: /^All/ })).toContainText("1");
      await expect(page.getByRole("columnheader", { name: "Field, filtered" })).toBeVisible();
      const [heads, cells] = [await page.getByRole("columnheader").count(), await page.locator("tfoot td").count()];
      expect(cells).toBe(heads);
    });

    await test.step("13 (X2 B1): Clear all: two rows, the mark gone, the lens and sort as they were", async () => {
      const before = new URL(page.url());
      await page.getByRole("group", { name: "Active filters" }).getByRole("button", { name: "Clear all" }).click();
      await expect(page.getByRole("link", { name: "Blank build" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Field, filtered" })).toHaveCount(0);
      const after = new URL(page.url());
      for (const key of ["lens", "sort", "dir", "by"]) expect(after.searchParams.get(key)).toBe(before.searchParams.get(key));
    });
  });
});
