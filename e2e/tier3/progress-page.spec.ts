// RC-P27 — the progress page, in a real browser, at the desktop and the phone
// project.
//
// THE BACKEND IS FAKED (CONTRACT §7): /rest/v1/, /auth/v1/, /storage/v1/ and
// /functions/v1/ are answered here, the realtime socket and the font CDN are
// silenced, and a signed-in maker is a session put in storage. user_progress
// answers 412 XP at level 3, xp_events this week's two runs and one accepted
// solution, user_badges four held badges, and builds with its two functions a
// maker whose one build has solutions waiting, so every section draws. Every
// other table answers empty, and every request the page makes, the frame's
// included, is recorded.

import { expect, test, type Page, type Route } from "@playwright/test";
import { ME, withSession } from "../audit/support/harness";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

const BUILDS = [
  { n: 1, title: "Invoice reader that files the totals", reproduction_count: 12, last_confirmed_at: ago(3) },
  { n: 2, title: "Contract clause finder", reproduction_count: 0, last_confirmed_at: null },
].map((b) => ({
  id: id(b.n),
  slug: `build-${b.n}`,
  title: b.title,
  reproduction_count: b.reproduction_count,
  last_confirmed_at: b.last_confirmed_at,
  last_confirmed_model: b.last_confirmed_at ? "claude-sonnet-4-5" : null,
  published_at: ago(30),
  rebuild_count: 0,
  like_count: 4,
  comment_count: 1,
  save_count: 2,
}));

const METRICS = [
  { build_id: id(1), runs: 13, worked: 12, failed_last_30_days: 0, open_bounties: 0, solutions_waiting: 0 },
  { build_id: id(2), runs: 0, worked: 0, failed_last_30_days: 0, open_bounties: 1, solutions_waiting: 3 },
];

/** The tables and functions of the features XP-DESIGN.md parks, and of the old panels RC-P27 unmounted. */
const PARKED = [
  "perks",
  "user_perks",
  "daily_challenges",
  "challenge_history",
  "streak_days",
  "creator_marks",
  "solver_leaderboard_cache",
  "rpc/get_visible_surfaces",
  "rpc/get_quest_state",
  "rpc/claim_challenge",
  "rpc/has_perk",
  "rpc/set_user_track",
  "rpc/respec_track",
  "rpc/mark_depth_revealed",
  "rpc/record_daily_activity",
];

const LIT = "rgb(217, 164, 65)";

const wantsObject = (route: Route) => (route.request().headers()["accept"] ?? "").includes("pgrst.object");

function json(route: Route, rows: unknown) {
  const list = Array.isArray(rows) ? rows : [rows];
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "content-range": `0-${Math.max(list.length - 1, 0)}/${list.length}` },
    body: wantsObject(route) ? JSON.stringify(list[0] ?? null) : JSON.stringify(rows),
  });
}

interface Backend {
  /** Every /rest/v1/ path the page asked for, the frame's included: "builds", "rpc/maker_stats"… */
  paths: () => string[];
}

async function fakeBackend(page: Page, { theme = "noon" }: { theme?: "noon" | "dusk" } = {}): Promise<Backend> {
  const paths: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes("/rest/v1/")) paths.push(url.pathname.split("/rest/v1/")[1]);
  });

  await withSession(page);
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem("bg-theme", value);
    } catch {
      /* the default room is still a room */
    }
  }, theme);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
    route.request().url().includes("css2")
      ? route.fulfill({ status: 200, contentType: "text/css", body: "" })
      : route.fulfill({ status: 200, contentType: "font/woff2", body: "" }),
  );
  await page.routeWebSocket(/\/realtime\/v1\//, () => {
    /* no broker */
  });
  await page.route(/\/auth\/v1\//, (route) =>
    route.request().url().includes("/user")
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: ME.id, aud: "authenticated" }) })
      : route.fulfill({ status: 401, contentType: "application/json", body: '{"msg":"no session"}' }),
  );
  await page.route(/\/(storage|functions)\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );

  // Widest first: Playwright matches the LAST registered route first.
  await page.route(/\/rest\/v1\//, (route) => json(route, []));
  await page.route(/\/rest\/v1\/profiles\?/, (route) =>
    json(route, [{ id: ME.id, username: ME.username, display_name: ME.display_name, avatar_url: null, is_admin: false, is_creator: true }]),
  );
  await page.route(/\/rest\/v1\/user_progress\?/, (route) =>
    decodeURIComponent(route.request().url()).includes("xp_total")
      ? json(route, [{ xp_total: 412, level: 3 }])
      : json(route, [{ welcome_xp_shown_at: ago(100) }]),
  );
  await page.route(/\/rest\/v1\/xp_events\?/, (route) => {
    const now = new Date().toISOString();
    return json(route, [
      { reason: "run_reported", source_id: id(21), created_at: now },
      { reason: "run_reported", source_id: id(22), created_at: now },
      { reason: "solution_accepted", source_id: id(31), created_at: now },
    ]);
  });
  await page.route(/\/rest\/v1\/user_badges\?/, (route) =>
    json(route, ["founder", "first-build", "runner", "well-proven"].map((badge_key) => ({ badge_key }))),
  );
  await page.route(/\/rest\/v1\/rpc\/maker_stats/, (route) =>
    json(route, [{ builds: 2, reproductions_received: 12, rebuilds_of_their_work: 0, gaps_solved: 1 }]),
  );
  await page.route(/\/rest\/v1\/rpc\/maker_build_metrics/, (route) => json(route, METRICS));
  await page.route(/\/rest\/v1\/builds\?/, (route) =>
    decodeURIComponent(route.request().url()).includes("save_count") ? json(route, BUILDS) : json(route, []),
  );

  return { paths: () => [...paths] };
}

/** The page has drawn every section's data. */
async function settled(page: Page) {
  await expect(page.getByTestId("badge-slot")).toHaveCount(10);
  await expect(page.getByTestId("weekly-challenge")).toHaveCount(3);
  await expect(page.getByTestId("progress-figure-value")).toHaveCount(3);
  await expect(page.getByTestId("needs-you-line")).toHaveCount(1);
}

test("the page is six sections in order: the note, Progress, Needs you, Your builds, This week, Badges", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/analytics");
  await settled(page);

  const sections = await page.getByTestId("progress-page").evaluate((wrapper) =>
    [...wrapper.children].map((section) =>
      section.getAttribute("role") === "note" ? "Reset note" : section.querySelector("h2")?.textContent ?? "?",
    ),
  );
  expect(sections).toEqual(["Reset note", "Progress", "Needs you", "Your builds", "This week", "Badges"]);
  await expect(page.getByTestId("progress-page").getByRole("heading", { level: 2 })).toHaveText([
    "Progress",
    "Needs you",
    "Your builds",
    "This week",
    "Badges",
  ]);
});

for (const theme of ["noon", "dusk"] as const) {
  test(`no text is drawn in --lit on ${theme === "noon" ? "Noon" : "Dusk"}, and the progress fills are`, async ({ page }) => {
    await fakeBackend(page, { theme });
    await page.goto("/analytics");
    await settled(page);

    const found = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.color = "var(--lit)";
      document.body.appendChild(probe);
      const lit = getComputedStyle(probe).color;
      probe.remove();
      const inked = [...document.querySelectorAll("body *")].filter((element) =>
        [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()),
      );
      return {
        lit,
        inked: inked.length,
        litText: inked.filter((element) => getComputedStyle(element).color === lit).map((element) => element.textContent?.trim()),
        fills: [...document.querySelectorAll('[data-testid="lit-bar-fill"]')].map((fill) => getComputedStyle(fill).backgroundColor),
      };
    });
    expect(found.lit).toBe(LIT);
    expect(found.inked).toBeGreaterThan(40);
    expect(found.litText).toEqual([]);
    expect(found.fills).toEqual([LIT, LIT, LIT, LIT]);
  });
}

test("no request reaches a parked feature's table or function", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto("/analytics");
  await settled(page);
  await page.waitForLoadState("networkidle");

  const asked = backend.paths().map((path) => path.split("?")[0]);
  expect(asked).toEqual(expect.arrayContaining(["user_progress", "xp_events", "user_badges", "builds"]));
  expect(asked.filter((path) => PARKED.includes(path))).toEqual([]);
});

test("this week shows at most three challenges, each n of m beside its bar", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/analytics");

  const rows = page.getByTestId("weekly-challenge");
  await expect(rows).toHaveCount(3);
  await expect(page.getByTestId("weekly-challenge-count")).toHaveText(["2 of 3", "1 of 1", "0 of 1"]);
  await expect(page.getByTestId("this-week").getByRole("progressbar")).toHaveCount(3);
});

test("badges are drawn earned first, then not yet", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/analytics");

  const slots = page.getByTestId("badge-slot").locator('[role="img"]');
  await expect(slots).toHaveCount(10);
  const earned = await slots.evaluateAll((marks) => marks.map((mark) => mark.getAttribute("data-earned")));
  expect(earned).toEqual(["true", "true", "true", "true", "false", "false", "false", "false", "false", "false"]);
  await expect(slots.first()).toHaveAccessibleName("First build, common badge");
});

test("the bar grows in by transform when motion is allowed", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await fakeBackend(page);
  await page.goto("/analytics");

  const fill = page.getByTestId("level-bar").getByTestId("lit-bar-fill");
  await expect(fill).toHaveCSS("transition-property", "transform");
  await expect(fill).toHaveCSS("transition-duration", "0.2s");
  await expect(fill).toHaveCSS("transform", "none");
});

test("under prefers-reduced-motion the bar does not move", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fakeBackend(page);
  await page.goto("/analytics");

  const fill = page.getByTestId("level-bar").getByTestId("lit-bar-fill");
  await expect(fill).toHaveCSS("transition-property", "none");
  await expect(fill).toHaveCSS("transform", "none");
  await expect(fill).toHaveAttribute("style", /inline-size: 69\.8%/);
});

test("Got it closes the reset note, and it stays closed after a reload", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/analytics");

  const note = page.getByRole("note");
  await expect(note).toContainText("Progress has been reset to match how buildgallery works now");
  await note.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByRole("note")).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId("badge-slot")).toHaveCount(10);
  await expect(page.getByRole("note")).toHaveCount(0);
});

test("at 390 the page does not scroll sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fakeBackend(page);
  await page.goto("/analytics");
  await settled(page);

  const overflow = await page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});
