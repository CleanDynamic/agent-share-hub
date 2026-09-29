// RC-P17b — reporting a build or a comment, and the admin's Reports tab, in a
// real browser, at the desktop and the phone project.
//
// THE BACKEND IS FAKED (CONTRACT §7): /rest/v1/, /auth/v1/, /storage/v1/ and
// /functions/v1/ are answered here, the realtime socket and the font CDN are
// silenced, and a signed-in reader is a session put in storage. profiles
// answers whether that reader is an admin; content_reports takes a report and
// lists the open ones; rpc/resolve_report closes one. Nothing reaches the
// network.

import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { ME, THEMES, withSession, withTheme } from "../audit/support/harness";

type Row = Record<string, unknown>;

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const BUILD_ID = id(1);
const MAKER = id(900);
const SLUG = "invoice-reader";
const TITLE = "Invoice reader that files the totals";
const RAE_COMMENT = id(701);

const BUILD: Row = {
  id: BUILD_ID,
  creator_id: MAKER,
  slug: SLUG,
  title: TITLE,
  outcome: "Reads a folder of invoices and files each total in the right month.",
  shape: "workflow",
  status: "published",
  made_for: ["founder"],
  made_with: ["Claude"],
  live_url: null,
  repo_url: null,
  hero_node_id: null,
  cover_media_id: null,
  cost_setup: null,
  cost_monthly: null,
  currency: "GBP",
  time_to_first_result: null,
  completeness: 90,
  reproduction_count: 3,
  last_confirmed_at: null,
  last_confirmed_model: null,
  parent_build_id: null,
  root_build_id: null,
  forked_from_event_id: null,
  source_content_item_id: null,
  monetisation_type: "free",
  price_gbp: null,
  donation_enabled: false,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-09-10T00:00:00.000Z",
  published_at: "2026-08-02T00:00:00.000Z",
  rebuild_note: null,
  rebuild_count: 0,
  source_title_at_fork: null,
  source_handle_at_fork: null,
  solves_node_id: null,
  // getBuildBySlug's embed: the credit line's name.
  maker: { username: "maya", display_name: "Maya Okafor" },
};

const COMMENTS: Row[] = [
  {
    id: RAE_COMMENT,
    build_id: BUILD_ID,
    node_id: null,
    parent_id: null,
    author_id: id(801),
    body: "Ran it on a year of invoices. Two came out in the wrong month.",
    is_hidden: false,
    created_at: "2026-09-20T09:00:00.000Z",
    edited_at: null,
    author: { id: id(801), username: "rae", display_name: "Rae", avatar_url: null },
  },
];

const REPORTS: Row[] = [
  {
    id: id(601),
    target_type: "build",
    target_id: BUILD_ID,
    reason: "spam",
    note: "Posted three times this week.",
    created_at: "2026-09-28T10:00:00.000Z",
    reporter: { username: "sam", display_name: "Sam" },
  },
  {
    id: id(602),
    target_type: "comment",
    target_id: RAE_COMMENT,
    reason: "harmful",
    note: null,
    created_at: "2026-09-27T10:00:00.000Z",
    reporter: { username: "lee", display_name: "Lee" },
  },
  {
    id: id(603),
    target_type: "build",
    target_id: BUILD_ID,
    reason: "stolen",
    note: null,
    created_at: "2026-09-26T10:00:00.000Z",
    reporter: { username: "kit", display_name: null },
  },
];

const wantsObject = (route: Route) => (route.request().headers()["accept"] ?? "").includes("pgrst.object");

function json(route: Route, rows: unknown[], status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
    body: wantsObject(route) ? JSON.stringify(rows[0] ?? null) : JSON.stringify(rows),
  });
}

interface Backend {
  /** Every POST to content_reports, as sent. */
  reports: Request[];
  /** Every GET on content_reports. */
  queueReads: Request[];
  /** Every call to resolve_report, as sent. */
  resolves: Request[];
}

async function fakeBackend(page: Page, { signedIn, admin = false }: { signedIn: boolean; admin?: boolean }): Promise<Backend> {
  const backend: Backend = { reports: [], queueReads: [], resolves: [] };
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
  await page.route(/\/rest\/v1\/profiles\?/, (route) =>
    json(route, [{ id: ME.id, username: ME.username, display_name: ME.display_name, avatar_url: null, is_admin: admin }]),
  );
  await page.route(/\/rest\/v1\/builds\?/, (route) => {
    const url = decodeURIComponent(route.request().url());
    if (url.includes("like_count")) return json(route, [{ id: BUILD_ID, like_count: 4, comment_count: 1 }]);
    if (url.includes("select=id,slug,title")) return json(route, [{ id: BUILD_ID, slug: SLUG, title: TITLE }]);
    if (url.includes("parent_build_id=eq.") || url.includes("limit=3")) return json(route, []);
    return json(route, [BUILD]);
  });
  await page.route(/\/rest\/v1\/build_comments/, (route) => {
    const url = decodeURIComponent(route.request().url());
    if (url.includes("select=node_id")) return json(route, []);
    if (url.includes("select=id,body")) {
      return json(route, [{ id: RAE_COMMENT, body: COMMENTS[0].body, build: { slug: SLUG, title: TITLE } }]);
    }
    return json(route, COMMENTS);
  });
  await page.route(/\/rest\/v1\/content_reports/, (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      backend.reports.push(request);
      return route.fulfill({ status: 201, contentType: "application/json", body: "" });
    }
    backend.queueReads.push(request);
    return json(route, REPORTS);
  });
  await page.route(/\/rest\/v1\/rpc\/resolve_report/, (route) => {
    backend.resolves.push(route.request());
    return route.fulfill({ status: 204, contentType: "application/json", body: "" });
  });

  return backend;
}

async function openBuild(page: Page, hash = "") {
  await page.goto(`/b2/${SLUG}${hash}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

const dialog = (page: Page) => page.getByTestId("report-dialog");

async function openReportDialog(page: Page) {
  await page.getByTestId("build-credit-line").getByRole("button", { name: "Report", exact: true }).click();
  await expect(dialog(page)).toBeVisible();
}

/**
 * Buttons painted with an opaque fill, as the reader sees them. A radio is a
 * button to the DOM but a field to the reader: its opaque --recess well is
 * where a choice goes, not an action, so radios are not counted.
 */
async function filledButtons(scope: ReturnType<Page["locator"]>) {
  return scope.locator('button:not([role="radio"])').evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const background = getComputedStyle(button).backgroundColor;
        const alpha = background.match(/rgba?\([^)]*,\s*([\d.]+)\)$/)?.[1];
        return background !== "transparent" && background !== "rgba(0, 0, 0, 0)" && (alpha === undefined || Number(alpha) > 0.9);
      })
      .map((button) => button.textContent?.trim() ?? ""),
  );
}

test("the dialog offers five reasons in order and one filled button, Send report", async ({ page }) => {
  await fakeBackend(page, { signedIn: true });
  await openBuild(page);
  await openReportDialog(page);

  await expect(dialog(page).getByRole("heading", { name: "Report this build" })).toBeVisible();
  const radios = dialog(page).getByRole("radio");
  await expect(radios).toHaveCount(5);
  expect(await radios.evaluateAll((items) => items.map((item) => item.getAttribute("aria-label")))).toEqual([
    "Spam",
    "Doesn't work",
    "Harmful",
    "Not theirs",
    "Something else",
  ]);
  for (const radio of await radios.all()) await expect(radio).toHaveAttribute("aria-checked", "false");

  expect(await filledButtons(dialog(page))).toEqual(["Send report"]);
  await expect(dialog(page).getByRole("button", { name: "Send report" })).toBeDisabled();
});

for (const theme of THEMES) {
  test(`the page recedes behind a scrim in ${theme}`, async ({ page }) => {
    await withTheme(page, theme);
    await fakeBackend(page, { signedIn: true });
    await openBuild(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await openReportDialog(page);

    const scrim = page.locator('.fixed.inset-0[data-state="open"]');
    await expect(scrim).toHaveCount(1);
    const found = await scrim.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const corner = document.elementFromPoint(2, window.innerHeight - 2);
      return {
        background: getComputedStyle(element).backgroundColor,
        covers: box.left <= 0 && box.top <= 0 && box.right >= window.innerWidth && box.bottom >= window.innerHeight,
        cornerIsScrim: corner === element,
      };
    });
    expect(found.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(found.background).not.toBe("transparent");
    expect(found.covers).toBe(true);
    expect(found.cornerIsScrim).toBe(true);
    // Nothing fixed to the screen shows through the scrim: on a phone that is
    // the top and bottom bars. A modal dialog turns pointer events off on the
    // page behind it, which hides the page from hit-testing, so they are
    // turned back on for the one measurement and then restored. Each fixed
    // element's centre must land on the scrim or the dialog.
    const showingThrough = await scrim.evaluate((overlay) => {
      const panel = document.querySelector('[role="dialog"]');
      const fixed = [...document.body.querySelectorAll("*")].filter((element) => {
        if (element === overlay || panel?.contains(element)) return false;
        if (element.closest("[data-sonner-toaster]") || element.closest('section[aria-label^="Notifications"]')) return false;
        const style = getComputedStyle(element);
        if (style.position !== "fixed" || style.display === "none" || style.visibility === "hidden") return false;
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < window.innerHeight;
      });
      const before = document.body.style.pointerEvents;
      document.body.style.pointerEvents = "auto";
      const out = fixed
        .filter((element) => {
          const box = element.getBoundingClientRect();
          const x = Math.min(Math.max(box.left + box.width / 2, 0), window.innerWidth - 1);
          const y = Math.min(Math.max(box.top + box.height / 2, 0), window.innerHeight - 1);
          const top = document.elementFromPoint(x, y);
          return !(top === overlay || (panel !== null && top !== null && panel.contains(top)));
        })
        .map((element) => element.getAttribute("aria-label") ?? element.tagName.toLowerCase());
      document.body.style.pointerEvents = before;
      return out;
    });
    expect(showingThrough).toEqual([]);
    // The dialog sits above it: its own centre is the dialog's.
    const onTop = await dialog(page).evaluate((element) => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + 12);
      return hit !== null && element.contains(hit);
    });
    expect(onTop).toBe(true);
  });
}

test("a report on a build sends the build, the reason and the note, then thanks the reader", async ({ page }) => {
  const backend = await fakeBackend(page, { signedIn: true });
  await openBuild(page);
  await openReportDialog(page);

  await dialog(page).getByRole("radio", { name: "Doesn't work" }).click();
  await dialog(page).getByLabel("Anything to add? (optional)").fill("The folder step never finishes.");
  await dialog(page).getByRole("button", { name: "Send report" }).click();

  await expect(dialog(page).getByText("Thanks. An admin will look at it.")).toBeVisible();
  expect(backend.reports).toHaveLength(1);
  expect(backend.reports[0].postDataJSON()).toEqual({
    target_type: "build",
    target_id: BUILD_ID,
    reporter_id: ME.id,
    reason: "broken",
    note: "The folder step never finishes.",
  });
});

test("a report on somebody else's comment sends the comment", async ({ page }) => {
  const backend = await fakeBackend(page, { signedIn: true });
  await openBuild(page, "#comments");

  const comment = page.getByTestId("comments").getByTestId("comment").first();
  await comment.getByRole("button", { name: "Report", exact: true }).click();
  await expect(dialog(page).getByRole("heading", { name: "Report this comment" })).toBeVisible();
  await dialog(page).getByRole("radio", { name: "Spam" }).click();
  await dialog(page).getByRole("button", { name: "Send report" }).click();

  await expect(dialog(page).getByText("Thanks. An admin will look at it.")).toBeVisible();
  expect(backend.reports[0].postDataJSON()).toEqual({
    target_type: "comment",
    target_id: RAE_COMMENT,
    reporter_id: ME.id,
    reason: "spam",
    note: null,
  });
});

test("the header keeps its four actions: Report sits at the end of the credit line", async ({ page }) => {
  await fakeBackend(page, { signedIn: true });
  await openBuild(page);

  const row = page.getByTestId("engagement-row");
  await expect(row.getByRole("button")).toHaveCount(4);
  await expect(row.getByRole("button", { name: "Report" })).toHaveCount(0);

  const credit = page.getByTestId("build-credit-line");
  await expect(credit).toContainText("by Maya Okafor");
  const report = credit.getByRole("button", { name: "Report", exact: true });
  await expect(report).toBeVisible();
  const box = await report.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

test("a reader who is not signed in is offered no Report", async ({ page }) => {
  await fakeBackend(page, { signedIn: false });
  await openBuild(page, "#comments");
  await expect(page.getByTestId("comments").getByTestId("comment")).toHaveCount(1);

  await expect(page.getByRole("button", { name: "Report", exact: true })).toHaveCount(0);
});

test("the Reports tab lists open reports and resolves them", async ({ page }) => {
  const backend = await fakeBackend(page, { signedIn: true, admin: true });
  await page.goto("/admin");

  await expect(page.getByRole("tab")).toHaveCount(6);
  await expect(page.getByRole("tab", { name: "Reports" })).toHaveAttribute("aria-selected", "true");

  const rows = page.getByTestId("report-row");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText("Build · Spam");
  await expect(rows.nth(0)).toContainText("Posted three times this week.");
  await expect(rows.nth(0)).toContainText("Sam");
  await expect(rows.nth(0).getByRole("link", { name: TITLE })).toHaveAttribute("href", `/b2/${SLUG}`);
  await expect(rows.nth(1)).toContainText("Comment · Harmful");
  await expect(rows.nth(1).getByRole("link")).toHaveAttribute("href", `/b2/${SLUG}#comments`);
  await expect(rows.nth(2)).toContainText("@kit");

  // Hide asks first, and its one filled button names the act.
  await rows.nth(0).getByRole("button", { name: "Hide", exact: true }).click();
  const confirm = page.getByTestId("hide-dialog");
  await expect(confirm.getByRole("heading", { name: "Hide this build?" })).toBeVisible();
  expect(await filledButtons(confirm)).toEqual(["Hide it"]);
  expect(backend.resolves).toHaveLength(0);
  await confirm.getByRole("button", { name: "Hide it" }).click();

  // Both reports on the build leave together; the comment's stays.
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Comment · Harmful");
  expect(backend.resolves[0].postDataJSON()).toEqual({ report: id(601), action: "hide" });

  await rows.first().getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(page.getByTestId("reports-empty")).toHaveText("Nothing has been reported.");
  expect(backend.resolves[1].postDataJSON()).toEqual({ report: id(602), action: "dismiss" });
});

test("a reader who is not an admin never sees the Reports tab", async ({ page }) => {
  const backend = await fakeBackend(page, { signedIn: true, admin: false });
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("tab", { name: "Reports" })).toHaveCount(0);
  expect(backend.queueReads).toHaveLength(0);
});
