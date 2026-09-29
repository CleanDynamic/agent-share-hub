// RC-P14c — the phase-3 critique screenshots (RC-P09c's spec, re-pointed).
//
// WHAT THIS RECORDS. The discovery Phase 3 built — the gallery's lenses and
// search (RC-P10), the two-tab Home (RC-P11), the bounties and solvers boards
// (RC-P12, RC-P13), the rebuild tree (RC-P14) and where next (RC-P14b) — on
// nine addresses, at the four widths the contract names (390, 768, 1024, 1440)
// and in both rooms: 72 screenshots. It asserts nothing: it saves one
// screenshot per route, width and theme to e2e/audit/critique/phase-3/, which
// is gitignored, and the critique in docs/reconciliation/critique/phase-3.md is
// written from them. (Phase 2's pictures came from this spec's RC-P09c routes;
// that record is docs/reconciliation/critique/phase-2.md.)
//
// THE THEME IS SWITCHED THE WAY THE APP'S CONTROL SWITCHES IT: withTheme writes
// the "bg-theme" key index.html's boot script reads before first paint.
//
// THE BACKEND IS FAKED, AND FILTERED. The audit harness answers the boundary
// (auth as its synthetic reader, the socket, every other table); the builds,
// their parts and media, the feed, the facets, the boards, the solvers and the
// rebuild family then come from e2e/audit/fixtures/rcBuilds.ts, answered
// through support/restFilter.ts so a lookup by slug gets one build rather than
// all of them. Nothing reaches the network, and no row is real user data.
//
// THE READER follows two of the three fixture makers, so / opens on Following
// with something in it, and /?tab=everyone shows the whole feed.
//
// "FULL PAGE" IS THE SCREEN. The frame is one viewport tall and scrolls its
// centre column inside itself, so a full-page capture is what a reader sees.
// The build page is captured scrolled to its foot, where where-next is; every
// other address as it opens.
//
// Reduced motion is emulated so that nothing is caught mid-reveal.
//
// DESKTOP PROJECT ONLY: the widths are set here, per capture.

import { test, type Page, type Route } from "@playwright/test";
import { ME, THEM, THEMES, installStub, withSession, withTheme } from "./support/harness";
import { filterRows } from "./support/restFilter";
import {
  RC_BOUNTY_SOLUTIONS,
  RC_BUILDS,
  RC_FACETS,
  RC_FEED_ROWS,
  RC_FIXTURE_SLUG,
  RC_MAKERS,
  RC_OPEN_BOUNTIES,
  RC_SOLVERS,
  coverPng,
  rebuildTreeRows,
} from "./fixtures/rcBuilds";

type Row = Record<string, unknown>;

/** The routes this pass looks at, and the name each one's screenshots carry. */
const ROUTES = [
  { path: "/", name: "home" },
  { path: "/?tab=everyone", name: "home-everyone" },
  { path: "/gallery", name: "gallery" },
  { path: "/gallery?lens=proven", name: "gallery-proven" },
  { path: "/gallery?q=agent", name: "gallery-search" },
  { path: "/bounties", name: "bounties" },
  { path: "/bounties/solvers", name: "solvers" },
  { path: `/b2/${RC_FIXTURE_SLUG}`, name: "build-foot", foot: true },
  { path: `/b2/${RC_FIXTURE_SLUG}/lineage`, name: "lineage" },
] as const;

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

const OUT = "e2e/audit/critique/phase-3";

/* ── The fixture world ──────────────────────────────────────────────────────── */

const profileRow = (who: { id: string; username: string; display_name: string }): Row => ({
  id: who.id,
  username: who.username,
  display_name: who.display_name,
  avatar_url: null,
  bio: null,
  created_at: "2026-01-04T09:00:00.000Z",
  is_creator: true,
  follower_count: 12,
  following_count: 2,
});

const PROFILES: Row[] = [ME, THEM, ...RC_MAKERS].map(profileRow);
const makerOf = (id: unknown) => PROFILES.find((profile) => profile.id === id) ?? null;

/** The reader follows the first two makers. */
const FOLLOWS: Row[] = RC_MAKERS.slice(0, 2).map((maker, n) => ({
  id: `7c000000-0000-4000-8000-00000000000${n}`,
  follower_id: ME.id,
  following_id: maker.id,
  created_at: "2026-09-01T09:00:00.000Z",
}));
const FOLLOWED = new Set(FOLLOWS.map((row) => row.following_id));

const NODE_ROWS: Row[] = RC_BUILDS.flatMap((build) =>
  (build.build_nodes as Row[]).map((node) => ({
    ...node,
    build_id: build.id,
    parent_id: null,
    note: null,
    source_ref: null,
    event_id: null,
    status: "placed",
    created_at: build.published_at,
  })),
);

const MEDIA_ROWS: Row[] = RC_BUILDS.flatMap((build) =>
  (build.build_media as Row[]).map((media) => ({ ...media, build_id: build.id })),
);

const wantsObject = (route: Route) =>
  (route.request().headers()["accept"] ?? "").includes("pgrst.object");

/** Answer a table read from `rows`, filtered as PostgREST would; HEAD answers the count. */
function table(rows: readonly Row[], embed: (row: Row, select: string) => Row = (row) => row) {
  return (route: Route) => {
    const request = route.request();
    const select = new URL(request.url()).searchParams.get("select") ?? "";
    const found = filterRows(rows, request.url()).map((row) => embed(row, select));
    const headers = {
      "content-range": found.length ? `0-${found.length - 1}/${found.length}` : `*/0`,
      "access-control-expose-headers": "content-range",
    };
    if (request.method() === "HEAD") return route.fulfill({ status: 200, headers, body: "" });
    return route.fulfill({
      status: 200,
      headers,
      contentType: "application/json",
      body: JSON.stringify(wantsObject(route) ? (found[0] ?? null) : found),
    });
  };
}

/** A build row with the maker embeds a select names (creator: on Home's suggestions, maker: on where-next). */
function withMaker(row: Row, select: string): Row {
  const maker = makerOf(row.creator_id);
  const embeds: Row = {};
  if (select.includes("creator:profiles")) embeds.creator = maker;
  if (select.includes("maker:profiles")) {
    embeds.maker = maker ? { username: maker.username, display_name: maker.display_name } : null;
  }
  return { ...row, ...embeds };
}

function rpc(route: Route, payload: unknown) {
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
}

async function servePhase3(page: Page) {
  await page.route(/\/rest\/v1\/builds(\?|$)/, table(RC_BUILDS, withMaker));
  await page.route(/\/rest\/v1\/build_nodes(\?|$)/, table(NODE_ROWS));
  await page.route(/\/rest\/v1\/build_media(\?|$)/, table(MEDIA_ROWS));
  await page.route(/\/rest\/v1\/build_events(\?|$)/, table([]));
  await page.route(/\/rest\/v1\/bounties(\?|$)/, table(RC_OPEN_BOUNTIES));
  await page.route(/\/rest\/v1\/solutions(\?|$)/, table(RC_BOUNTY_SOLUTIONS));
  await page.route(/\/rest\/v1\/profiles(\?|$)/, table(PROFILES));
  await page.route(/\/rest\/v1\/follows(\?|$)/, table(FOLLOWS));

  await page.route(/\/rest\/v1\/rpc\/get_build_feed/, (route) => {
    const params = (route.request().postDataJSON() ?? {}) as { only_following?: boolean; page_size?: number };
    const rows = params.only_following
      ? RC_FEED_ROWS.filter((row) => FOLLOWED.has(row.creator_id))
      : RC_FEED_ROWS;
    return rpc(route, rows.slice(0, params.page_size ?? 20));
  });
  await page.route(/\/rest\/v1\/rpc\/gallery_facets/, (route) => rpc(route, RC_FACETS));
  await page.route(/\/rest\/v1\/rpc\/search_build_ids/, (route) => {
    const q = String((route.request().postDataJSON() ?? {}).q ?? "").toLowerCase();
    const hits = RC_BUILDS.filter((build) =>
      [build.title, build.outcome, ...(build.made_for as string[]), ...(build.made_with as string[])]
        .join(" ")
        .toLowerCase()
        .includes(q),
    ).sort((a, b) => Number(b.reproduction_count) - Number(a.reproduction_count));
    return rpc(route, hits.map((build) => ({ build_id: build.id })));
  });
  await page.route(/\/rest\/v1\/rpc\/top_solvers/, (route) => rpc(route, RC_SOLVERS));
  await page.route(/\/rest\/v1\/rpc\/rebuild_tree/, (route) =>
    rpc(route, rebuildTreeRows(String((route.request().postDataJSON() ?? {}).root ?? ""))),
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

/* ── The captures ───────────────────────────────────────────────────────────── */

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
      await servePhase3(page);

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        await page.goto(route.path, { waitUntil: "networkidle", timeout: 120_000 });
        await page.getByTestId("frame-centre").waitFor();
        if ("foot" in route && route.foot) {
          await page.getByRole("heading", { level: 1 }).first().waitFor();
          const sentinel = page.getByTestId("where-next-sentinel");
          if (await sentinel.count()) await sentinel.scrollIntoViewIfNeeded();
          await page.getByTestId("where-next").waitFor();
          await page.getByTestId("where-next").scrollIntoViewIfNeeded();
        }
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
