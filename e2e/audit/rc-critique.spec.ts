// RC-P20b — the phase-4 critique screenshots (RC-P09c's spec, re-pointed again).
//
// WHAT THIS RECORDS. The social layer Phase 4 built — engagement on cards and
// build headers (RC-P16), comments on a build and its parts (RC-P17), reports
// and the admin's queue (RC-P17b), the library on builds (RC-P18), build
// notifications (RC-P19) and builds in messages (RC-P20) — as eight views of
// seven addresses and three dialogs, at the four widths the contract names
// (390, 768, 1024, 1440) and in both rooms: 88 screenshots. It saves them to
// e2e/audit/critique/phase-4/, which is gitignored, and the critique in
// docs/reconciliation/critique/phase-4.md is written from them. (Phase 2's
// record is critique/phase-2.md, phase 3's critique/phase-3.md.)
//
// IT ALSO MEASURES, BECAUSE TWO OF THE RECORD'S NUMBERS ARE COUNTS. Beside
// each screenshot it writes what the topmost layer holds: the interactive
// elements painted with the primary fill (--action), in the open dialog's
// layer when one is open and in the page otherwise; and, for a dialog, its
// scrim (whether one covers the screen, and what a corner of the screen hits).
// Both go to probes-<view>-<theme>.json beside the pictures.
//
// THE THEME IS SWITCHED THE WAY THE APP'S CONTROL SWITCHES IT: withTheme writes
// the "bg-theme" key index.html's boot script reads before first paint.
//
// THE BACKEND IS FAKED, AND FILTERED. The audit harness answers the boundary
// (auth as its synthetic reader, the socket, every other table); the builds,
// their parts and media, the boards and the rebuild family come from
// fixtures/rcBuilds.ts, and the social layer — comments, likes, saves,
// collections, notifications, the thread and the report — from
// fixtures/rcSocial.ts, all answered through support/restFilter.ts so a lookup
// by slug or id gets its rows rather than all of them. Nothing reaches the
// network, and no row is real user data.
//
// THE READER follows two of the three fixture makers and has a direct thread
// with one of them. For /admin only, the reader is an admin.
//
// "FULL PAGE" IS THE SCREEN. The frame is one viewport tall and scrolls its
// centre column inside itself, so a full-page capture is what a reader sees.
//
// Reduced motion is emulated so that nothing is caught mid-reveal.
//
// DESKTOP PROJECT ONLY: the widths are set here, per capture.

import fs from "node:fs";
import { expect, test, type Page, type Route } from "@playwright/test";
import { ME, THEM, THEMES, installStub, withSession, withTheme } from "./support/harness";
import { filterRows } from "./support/restFilter";
import {
  RC_BOUNTY_SOLUTIONS,
  RC_FACETS,
  RC_FEED_ROWS,
  RC_FIXTURE_SLUG,
  RC_MAKERS,
  RC_OPEN_BOUNTIES,
  RC_SOLVERS,
  coverPng,
  rebuildTreeRows,
} from "./fixtures/rcBuilds";
import {
  RC_COLLECTIONS,
  RC_COLLECTION_ITEMS,
  RC_COMMENTS,
  RC_LIKES,
  RC_MESSAGES,
  RC_NOTIFICATIONS,
  RC_REPORTS,
  RC_SAVES,
  RC_SOCIAL_BUILDS,
  RC_THREADS,
  RC_THREAD_ID,
  RC_THREAD_MEMBERS,
} from "./fixtures/rcSocial";

type Row = Record<string, unknown>;

const BUILD_PATH = `/b2/${RC_FIXTURE_SLUG}`;

/**
 * The views this pass looks at. A view is an address, where to look on it,
 * and, for the three dialog states, what to press to open the dialog.
 */
interface View {
  name: string;
  path: string;
  /** Resolves once the view's own content is on screen. */
  ready: (page: Page) => Promise<void>;
  /** For a dialog state: open it, and resolve once it is open. */
  open?: (page: Page) => Promise<void>;
  admin?: boolean;
}

const heading = (page: Page) => page.getByRole("heading", { level: 1 }).first().waitFor();

async function toComments(page: Page) {
  await heading(page);
  await page.getByTestId("comment").first().waitFor();
  await page.getByTestId("comments").evaluate((element) => element.scrollIntoView({ block: "start" }));
}

const VIEWS: View[] = [
  { name: "gallery", path: "/gallery", ready: (page) => page.getByTestId("engagement-row").first().waitFor() },
  { name: "build-top", path: BUILD_PATH, ready: heading },
  { name: "build-comments", path: `${BUILD_PATH}#comments`, ready: toComments },
  { name: "library", path: "/library", ready: (page) => page.getByTestId("library-card").first().waitFor() },
  { name: "library-collections", path: "/library?tab=collections", ready: (page) => page.getByTestId("library-collection").first().waitFor() },
  { name: "notifications", path: "/notifications", ready: (page) => page.getByTestId("notification").nth(8).waitFor() },
  { name: "messages", path: `/messages/${RC_THREAD_ID}`, ready: (page) => page.getByTestId("message-build").waitFor() },
  { name: "admin-reports", path: "/admin", admin: true, ready: (page) => page.getByTestId("report-row").first().waitFor() },
  {
    name: "state-report-dialog",
    path: BUILD_PATH,
    ready: heading,
    open: async (page) => {
      await page.getByTestId("build-credit-line").getByRole("button", { name: "Report", exact: true }).click();
      await page.getByTestId("report-dialog").waitFor();
    },
  },
  {
    name: "state-delete-comment",
    path: `${BUILD_PATH}#comments`,
    ready: toComments,
    open: async (page) => {
      const mine = page.getByTestId("comment").filter({ hasText: "the refund rule also matches" });
      await mine.getByRole("button", { name: "Delete", exact: true }).click();
      await page.getByRole("dialog").filter({ hasText: "Delete this comment?" }).waitFor();
    },
  },
  {
    name: "state-add-to-collection",
    path: BUILD_PATH,
    ready: heading,
    open: async (page) => {
      await page.getByTestId("engagement-row").first().getByRole("button", { name: "Save", exact: true }).click();
      await page.getByRole("button", { name: "Add to a collection" }).click();
      await page.getByTestId("add-to-collection-dialog").waitFor();
      await page.getByTestId("collection-choice").first().waitFor();
    },
  },
];

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

const OUT = "e2e/audit/critique/phase-4";

/* ── The fixture world ──────────────────────────────────────────────────────── */

const profileRow = (who: { id: string; username: string; display_name: string }, admin = false): Row => ({
  id: who.id,
  username: who.username,
  display_name: who.display_name,
  avatar_url: null,
  bio: null,
  created_at: "2026-01-04T09:00:00.000Z",
  is_creator: true,
  is_admin: admin && who.id === ME.id,
  follower_count: 12,
  following_count: 2,
});

const peopleFor = (admin: boolean): Row[] => [ME, THEM, ...RC_MAKERS].map((who) => profileRow(who, admin));
const PROFILES = peopleFor(false);
const personOf = (id: unknown) => PROFILES.find((profile) => profile.id === id) ?? null;

/** The reader follows the first two makers; the thread is with the first. */
const FOLLOWS: Row[] = RC_MAKERS.slice(0, 2).map((maker, n) => ({
  id: `7c000000-0000-4000-8000-00000000000${n}`,
  follower_id: ME.id,
  following_id: maker.id,
  created_at: "2026-09-01T09:00:00.000Z",
}));

const NODE_ROWS: Row[] = RC_SOCIAL_BUILDS.flatMap((build) =>
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

const MEDIA_ROWS: Row[] = RC_SOCIAL_BUILDS.flatMap((build) =>
  (build.build_media as Row[]).map((media) => ({ ...media, build_id: build.id })),
);

const wantsObject = (route: Route) =>
  (route.request().headers()["accept"] ?? "").includes("pgrst.object");

/** Answer a table read from `rows`, filtered as PostgREST would; HEAD answers the count; a write is accepted. */
function table(rows: readonly Row[], embed: (row: Row, select: string) => Row = (row) => row) {
  return (route: Route) => {
    const request = route.request();
    if (!["GET", "HEAD"].includes(request.method())) {
      return route.fulfill({ status: 201, contentType: "application/json", body: "" });
    }
    const select = new URL(request.url()).searchParams.get("select") ?? "";
    const found = filterRows(rows, request.url()).map((row) => embed(row, select));
    const headers = {
      "content-range": found.length ? `0-${found.length - 1}/${found.length}` : `*/0`,
      "access-control-allow-origin": "*",
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

/** A build row with the maker embeds a select names (creator: on Home's suggestions, maker: on the header and where-next). */
function withMaker(row: Row, select: string): Row {
  const maker = personOf(row.creator_id);
  const embeds: Row = {};
  if (select.includes("creator:profiles")) embeds.creator = maker;
  if (select.includes("maker:profiles")) {
    embeds.maker = maker ? { username: maker.username, display_name: maker.display_name } : null;
  }
  return { ...row, ...embeds };
}

const nameOf = (id: unknown) => {
  const person = personOf(id);
  return person ? { id: person.id, username: person.username, display_name: person.display_name, avatar_url: null } : null;
};

/** A comment with its author, or (for the reports queue) with its build. */
function commentEmbeds(row: Row, select: string): Row {
  const embeds: Row = {};
  if (select.includes("author:profiles")) embeds.author = nameOf(row.author_id);
  if (select.includes("build:builds")) {
    const build = RC_SOCIAL_BUILDS.find((b) => b.id === row.build_id);
    embeds.build = build ? { slug: build.slug, title: build.title } : null;
  }
  return { ...row, ...embeds };
}

const reportEmbeds = (row: Row, select: string): Row =>
  select.includes("reporter:profiles")
    ? { ...row, reporter: { username: personOf(row.reporter_id)?.username, display_name: personOf(row.reporter_id)?.display_name } }
    : row;

const collectionEmbeds = (row: Row, select: string): Row =>
  select.includes("collection_items(count)")
    ? { ...row, collection_items: [{ count: RC_COLLECTION_ITEMS.filter((item) => item.collection_id === row.id).length }] }
    : row;

function rpc(route: Route, payload: unknown) {
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
}

async function servePhase4(page: Page, { admin }: { admin: boolean }) {
  await page.route(/\/functions\/v1\//, (route) => rpc(route, {}));

  // The builds and their surroundings, as phase 3 served them.
  await page.route(/\/rest\/v1\/builds(\?|$)/, table(RC_SOCIAL_BUILDS, withMaker));
  await page.route(/\/rest\/v1\/build_nodes(\?|$)/, table(NODE_ROWS));
  await page.route(/\/rest\/v1\/build_media(\?|$)/, table(MEDIA_ROWS));
  await page.route(/\/rest\/v1\/build_events(\?|$)/, table([]));
  await page.route(/\/rest\/v1\/bounties(\?|$)/, table(RC_OPEN_BOUNTIES));
  await page.route(/\/rest\/v1\/solutions(\?|$)/, table(RC_BOUNTY_SOLUTIONS));
  await page.route(/\/rest\/v1\/profiles(\?|$)/, table(peopleFor(admin)));
  await page.route(/\/rest\/v1\/follows(\?|$)/, table(FOLLOWS));
  await page.route(/\/rest\/v1\/rpc\/get_build_feed/, (route) => rpc(route, RC_FEED_ROWS.slice(0, 20)));
  await page.route(/\/rest\/v1\/rpc\/gallery_facets/, (route) => rpc(route, RC_FACETS));
  await page.route(/\/rest\/v1\/rpc\/top_solvers/, (route) => rpc(route, RC_SOLVERS));
  await page.route(/\/rest\/v1\/rpc\/rebuild_tree/, (route) =>
    rpc(route, rebuildTreeRows(String((route.request().postDataJSON() ?? {}).root ?? ""))),
  );

  // The social layer.
  await page.route(/\/rest\/v1\/build_comments(\?|$)/, table(RC_COMMENTS, commentEmbeds));
  await page.route(/\/rest\/v1\/build_likes(\?|$)/, table(RC_LIKES));
  await page.route(/\/rest\/v1\/build_saves(\?|$)/, table(RC_SAVES));
  await page.route(/\/rest\/v1\/collections(\?|$)/, table(RC_COLLECTIONS, collectionEmbeds));
  await page.route(/\/rest\/v1\/collection_items(\?|$)/, table(RC_COLLECTION_ITEMS));
  await page.route(/\/rest\/v1\/notifications(\?|$)/, table(RC_NOTIFICATIONS));
  await page.route(/\/rest\/v1\/dm_threads(\?|$)/, table(RC_THREADS));
  await page.route(/\/rest\/v1\/dm_thread_members(\?|$)/, table(RC_THREAD_MEMBERS));
  await page.route(/\/rest\/v1\/dm_messages(\?|$)/, table(RC_MESSAGES));
  await page.route(/\/rest\/v1\/content_reports(\?|$)/, table(RC_REPORTS, reportEmbeds));

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

/* ── The probes ─────────────────────────────────────────────────────────────── */

interface Probe {
  width: number;
  /** Where the count was taken: the open dialog, or the page. */
  layer: "dialog" | "page";
  /** Interactive elements painted with --action, by accessible name. */
  filled: string[];
  /** For a dialog: its scrim, if any. */
  scrim?: { present: boolean; background: string; covers: boolean; cornerHitsScrim: boolean };
}

async function probe(page: Page, width: number): Promise<Probe> {
  return page.evaluate((viewportWidth) => {
    const swatch = document.createElement("div");
    swatch.style.background = "var(--action)";
    document.body.appendChild(swatch);
    const action = getComputedStyle(swatch).backgroundColor;
    swatch.remove();

    const shown = (element: Element) => {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return false;
      for (let node: Element | null = element; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
      }
      return true;
    };
    const name = (element: Element) =>
      (element.getAttribute("aria-label") ?? element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60);

    const dialogs = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].filter(shown);
    const dialog = dialogs[dialogs.length - 1] ?? null;
    const scope: ParentNode = dialog ?? document;
    const filled = [...scope.querySelectorAll('button, a[href], [role="button"], [role="tab"], input[type="submit"]')]
      .filter((element) => shown(element) && getComputedStyle(element).backgroundColor === action)
      .map(name);

    let scrim: Probe["scrim"];
    if (dialog) {
      const overlay = [...document.querySelectorAll('.fixed.inset-0[data-state="open"]')].filter(shown).pop() ?? null;
      const box = overlay?.getBoundingClientRect();
      const corner = document.elementFromPoint(2, window.innerHeight - 2);
      scrim = {
        present: overlay !== null,
        background: overlay ? getComputedStyle(overlay).backgroundColor : "none",
        covers: Boolean(box && box.left <= 0 && box.top <= 0 && box.right >= window.innerWidth && box.bottom >= window.innerHeight),
        cornerHitsScrim: overlay !== null && corner === overlay,
      };
    }
    return { width: viewportWidth, layer: dialog ? "dialog" : "page", filled, scrim } as Probe;
  }, width);
}

/* ── The captures ───────────────────────────────────────────────────────────── */

test.describe.configure({ mode: "default" });

for (const view of VIEWS) {
  for (const theme of THEMES) {
    test(`captures ${view.name} in ${theme} at four widths`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "Captured once, on the desktop project.");
      test.setTimeout(300_000);

      await page.emulateMedia({ reducedMotion: "reduce" });
      await withTheme(page, theme);
      await withSession(page);
      await installStub(page);
      await servePhase4(page, { admin: Boolean(view.admin) });

      const probes: Probe[] = [];
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        // A fresh document per width: a second visit to the same address with
        // a #hash is a same-document hop, and would keep the last width's
        // dialog open.
        await page.goto("about:blank");
        await page.goto(view.path, { waitUntil: "networkidle", timeout: 120_000 });
        await page.getByTestId("frame-centre").waitFor();
        await view.ready(page);
        if (view.open) await view.open(page);
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(
          () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        await page.screenshot({ path: `${OUT}/${view.name}-${viewport.width}-${theme}.png`, fullPage: true });
        probes.push(await probe(page, viewport.width));
      }
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(`${OUT}/probes-${view.name}-${theme}.json`, JSON.stringify(probes, null, 2));
      expect(probes).toHaveLength(VIEWPORTS.length);
    });
  }
}
