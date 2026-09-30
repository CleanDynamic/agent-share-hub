// RC-P28a — the phase-5 and phase-6 critique screenshots (RC-P09c's spec,
// re-pointed a third time).
//
// WHAT THIS RECORDS. Identity and progress as Phases 5 and 6 left them: the
// profile (RC-P21) as a visitor sees it and as its maker does, the progress
// page (RC-P23 to RC-P28) with a maker's record and as a new reader first meets
// it, and the drafts list the profile's Drafts link opens. Five ROUTES, at the
// four widths the contract names (390, 768, 1024, 1440), in both rooms. The
// Gallery is captured beside them the same way, as the REFERENCE the
// consistency audit compares them against. Everything is saved to
// e2e/audit/critique/phase-6/, which is gitignored, and the critique in
// docs/reconciliation/critique/phase-6.md is written from it. (Phase 2's record
// is critique/phase-2.md, phase 3's critique/phase-3.md, phase 4's
// critique/phase-4.md.)
//
// TWO PICTURES A WIDTH. The frame is one viewport tall and scrolls its centre
// column inside itself, so a full-page capture is the screen a reader lands on:
// <view>-<width>-<theme>.png. Where the column is longer than the screen, the
// viewport is then grown to the column's height and the whole column captured
// as <view>-<width>-<theme>-full.png.
//
// IT MEASURES AS WELL AS PICTURES. Beside each view it writes
// probes-<view>-<theme>.json, one entry a width, taken on the landing screen:
//   - filled: interactive elements painted with the primary fill (--action) in
//     the topmost layer (an open dialog, else the page): the von-restorff count
//     phase 4 kept;
//   - isolated: every shown element that departs from the neutral ground and
//     ink, anywhere in the document, the frame's rail included: a fill in
//     --action, --lit or --evidence-fill, or type in --action, --evidence or a
//     part-category hue, with the nearest named container it sits in;
//   - amberText: text drawn in --lit, the theme's "amber is light, never type";
//   - type: each distinct text style in the page's column (face, size, weight)
//     and how many text runs use it;
//   - buttons: each button-like control in the column: height, text size and
//     weight, and paint (filled, outline, ghost);
//   - sections: the column's top-level blocks and the gaps between them;
//   - scrollers: regions in the column that scroll sideways, how much of each
//     shows, and for a table how many of its columns are in view. (Not the
//     scrollbar: Playwright launches Chromium with --hide-scrollbars, so every
//     bar measures 0 here whatever the CSS says.)
//   - overflow: how far the document scrolls sideways.
//
// THE BACKEND IS FAKED, AND FILTERED, as phase 4's was: the audit harness
// answers the boundary (auth, the socket, every other table), and the builds,
// the boards, the social layer and now the maker's record come from
// fixtures/rcBuilds.ts, fixtures/rcSocial.ts and fixtures/rcProgress.ts,
// answered through support/restFilter.ts. user_progress, xp_events and
// user_badges answer only the signed-in reader's own rows, as their read
// policies do. The legacy clear's world: content_items and content_blocks are
// empty. Nothing reaches the network, and no row is real user data.
//
// THE READERS. The audit runner (who follows the maker) visits her profile and
// the Gallery; the maker, Maya Okafor, opens her own profile, her progress page
// (the reset note already read) and her drafts; a reader who joined yesterday
// opens the progress page for the first time.
//
// Reduced motion is emulated so that nothing is caught mid-reveal.
//
// DESKTOP PROJECT ONLY: the widths are set here, per capture. Run it with
// `npx playwright test e2e/audit/rc-critique.spec.ts --project=desktop`.

import fs from "node:fs";
import { expect, test, type Page, type Route } from "@playwright/test";
import { ME, THEM, THEMES, installStub, withSession, withTheme } from "./support/harness";
import { filterRows } from "./support/restFilter";
import {
  RC_BOUNTY_SOLUTIONS,
  RC_FACETS,
  RC_FEED_ROWS,
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
  RC_THREADS,
  RC_THREAD_MEMBERS,
} from "./fixtures/rcSocial";
import {
  PHASE6_BADGES,
  PHASE6_BUILDS,
  PHASE6_MAKER,
  PHASE6_METRICS,
  PHASE6_NEWCOMER,
  PHASE6_PROFILES,
  PHASE6_PROGRESS,
  PHASE6_XP_EVENTS,
  makerStatsFor,
} from "./fixtures/rcProgress";

type Row = Record<string, unknown>;

interface Reader {
  id: string;
  username: string;
  display_name: string;
}

/**
 * A view: an address, who reads it, and what proves its own content is on
 * screen. `column` names the page's column for the sections probe: a test id,
 * "parent:<test id>" for the element that holds it, or "parent2:<test id>"
 * for the one that holds that.
 */
interface View {
  name: string;
  path: string;
  reader: Reader;
  /** The reset note was read in this browser before (ResetNote's key). */
  noteRead?: boolean;
  ready: (page: Page) => Promise<void>;
  column: string;
}

async function profileReady(page: Page) {
  await expect(page.getByTestId("maker-figure-value")).toHaveCount(4);
  await page.getByTestId("profile-card").first().waitFor();
}

async function progressReady(page: Page) {
  await expect(page.getByTestId("badge-slot")).toHaveCount(10);
  await expect(page.getByTestId("weekly-challenge")).toHaveCount(3);
  await page.getByTestId("progress-figure-value").first().waitFor({ state: "attached" });
}

/** The five views of identity and progress (RC-P28a step 2). */
const ROUTES: View[] = [
  { name: "profile-visitor", path: `/profile/${PHASE6_MAKER.username}`, reader: ME, ready: profileReady, column: "parent:profile-header" },
  { name: "profile-own", path: "/profile", reader: PHASE6_MAKER, ready: profileReady, column: "parent:profile-header" },
  {
    name: "analytics",
    path: "/analytics",
    reader: PHASE6_MAKER,
    noteRead: true,
    ready: async (page) => {
      await progressReady(page);
      await expect(page.getByTestId("needs-you-line")).toHaveCount(3);
    },
    column: "progress-page",
  },
  {
    name: "analytics-new",
    path: "/analytics",
    reader: PHASE6_NEWCOMER,
    ready: async (page) => {
      await progressReady(page);
      await page.getByTestId("xp-reset-note").waitFor({ state: "attached" });
      await page.getByTestId("build-stats-empty").waitFor({ state: "attached" });
    },
    column: "progress-page",
  },
  {
    name: "drafts",
    path: "/drafts",
    reader: PHASE6_MAKER,
    ready: (page) => page.getByRole("button", { name: /Continue editing/ }).nth(1).waitFor(),
    column: "frame-centre",
  },
];

/** What the consistency audit compares the five against. */
const REFERENCE: View[] = [
  { name: "gallery", path: "/gallery", reader: ME, ready: (page) => page.getByTestId("engagement-row").first().waitFor(), column: "parent2:gallery-grid" },
];

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

const OUT = "e2e/audit/critique/phase-6";

/** src/components/progress/ResetNote.tsx's RESET_NOTE_KEY. */
const RESET_NOTE_KEY = "bg-xp-reset-note-seen";

/* ── The fixture world ──────────────────────────────────────────────────────── */

const profileRow = (who: Reader): Row => ({
  id: who.id,
  username: who.username,
  display_name: who.display_name,
  avatar_url: null,
  banner_url: null,
  bio: null,
  website_url: null,
  location: null,
  created_at: "2026-01-04T09:00:00.000Z",
  is_verified: false,
  level: "reader",
  derived_bio: null,
  is_private: false,
  is_trusted_solver: false,
  is_creator: true,
  is_admin: false,
  follower_count: 12,
  following_count: 2,
});

/** Everybody, with the maker's and the newcomer's full rows in place of their short ones. */
const PEOPLE: Row[] = [
  ...[ME, THEM, ...RC_MAKERS]
    .filter((who) => !PHASE6_PROFILES.some((row) => row.id === who.id))
    .map((who) => profileRow(who as Reader)),
  ...PHASE6_PROFILES,
];
const personOf = (id: unknown) => PEOPLE.find((profile) => profile.id === id) ?? null;

/** The audit runner follows the first two makers, the phase's maker among them. */
const FOLLOWS: Row[] = RC_MAKERS.slice(0, 2).map((maker, n) => ({
  id: `7c000000-0000-4000-8000-00000000000${n}`,
  follower_id: ME.id,
  following_id: maker.id,
  created_at: "2026-09-01T09:00:00.000Z",
}));

/** The audit runner's own progress, for the frame's level chip on the visitor's views. */
const PROGRESS: Row[] = [
  ...PHASE6_PROGRESS,
  { user_id: ME.id, xp_total: 412, level: 3, streak_days: 0, welcome_xp_shown_at: "2026-01-04T09:00:00.000Z" },
];

const NODE_ROWS: Row[] = PHASE6_BUILDS.flatMap((build) =>
  ((build.build_nodes as Row[]) ?? []).map((node) => ({
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

const MEDIA_ROWS: Row[] = PHASE6_BUILDS.flatMap((build) =>
  ((build.build_media as Row[]) ?? []).map((media) => ({ ...media, build_id: build.id })),
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

function commentEmbeds(row: Row, select: string): Row {
  return select.includes("author:profiles") ? { ...row, author: nameOf(row.author_id) } : row;
}

const collectionEmbeds = (row: Row, select: string): Row =>
  select.includes("collection_items(count)")
    ? { ...row, collection_items: [{ count: RC_COLLECTION_ITEMS.filter((item) => item.collection_id === row.id).length }] }
    : row;

function rpc(route: Route, payload: unknown) {
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
}

const rpcArgs = (route: Route): Row => (route.request().postDataJSON() ?? {}) as Row;

async function servePhase6(page: Page, reader: Reader) {
  /** The rows of a table only their owner may read (users_read_own_progress and its kin). */
  const ownRows = (rows: readonly Row[]) => table(rows.filter((row) => row.user_id === reader.id));

  await page.route(/\/functions\/v1\//, (route) => rpc(route, {}));
  await page.route(/\/auth\/v1\//, (route) =>
    route.request().url().includes("/user")
      ? rpc(route, { id: reader.id, email: `${reader.username}@example.test`, aud: "authenticated" })
      : rpc(route, {}),
  );

  // The builds and their surroundings, as phase 4 served them, plus the maker's stale build and drafts.
  await page.route(/\/rest\/v1\/builds(\?|$)/, table(PHASE6_BUILDS, withMaker));
  await page.route(/\/rest\/v1\/build_nodes(\?|$)/, table(NODE_ROWS));
  await page.route(/\/rest\/v1\/build_media(\?|$)/, table(MEDIA_ROWS));
  await page.route(/\/rest\/v1\/build_events(\?|$)/, table([]));
  await page.route(/\/rest\/v1\/bounties(\?|$)/, table(RC_OPEN_BOUNTIES));
  await page.route(/\/rest\/v1\/solutions(\?|$)/, table(RC_BOUNTY_SOLUTIONS));
  await page.route(/\/rest\/v1\/profiles(\?|$)/, table(PEOPLE));
  await page.route(/\/rest\/v1\/follows(\?|$)/, table(FOLLOWS));
  await page.route(/\/rest\/v1\/rpc\/get_build_feed/, (route) => rpc(route, RC_FEED_ROWS.slice(0, 20)));
  await page.route(/\/rest\/v1\/rpc\/gallery_facets/, (route) => rpc(route, RC_FACETS));
  await page.route(/\/rest\/v1\/rpc\/top_solvers/, (route) => rpc(route, RC_SOLVERS));
  await page.route(/\/rest\/v1\/rpc\/rebuild_tree/, (route) => rpc(route, rebuildTreeRows(String(rpcArgs(route).root ?? ""))));

  // The social layer, as phase 4 served it.
  await page.route(/\/rest\/v1\/build_comments(\?|$)/, table(RC_COMMENTS, commentEmbeds));
  await page.route(/\/rest\/v1\/build_likes(\?|$)/, table(RC_LIKES));
  await page.route(/\/rest\/v1\/build_saves(\?|$)/, table(RC_SAVES));
  await page.route(/\/rest\/v1\/collections(\?|$)/, table(RC_COLLECTIONS, collectionEmbeds));
  await page.route(/\/rest\/v1\/collection_items(\?|$)/, table(RC_COLLECTION_ITEMS));
  await page.route(/\/rest\/v1\/notifications(\?|$)/, table(RC_NOTIFICATIONS.filter((row) => row.recipient_id === reader.id)));
  await page.route(/\/rest\/v1\/dm_threads(\?|$)/, table(reader.id === ME.id ? RC_THREADS : []));
  await page.route(/\/rest\/v1\/dm_thread_members(\?|$)/, table(reader.id === ME.id ? RC_THREAD_MEMBERS : []));
  await page.route(/\/rest\/v1\/dm_messages(\?|$)/, table(reader.id === ME.id ? RC_MESSAGES : []));
  await page.route(/\/rest\/v1\/content_reports(\?|$)/, table(RC_REPORTS));

  // Identity and progress (phase 6).
  await page.route(/\/rest\/v1\/user_progress(\?|$)/, ownRows(PROGRESS));
  await page.route(/\/rest\/v1\/xp_events(\?|$)/, ownRows(PHASE6_XP_EVENTS));
  await page.route(/\/rest\/v1\/user_badges(\?|$)/, ownRows(PHASE6_BADGES));
  await page.route(/\/rest\/v1\/rpc\/maker_stats/, (route) => rpc(route, makerStatsFor(rpcArgs(route).uid)));
  await page.route(/\/rest\/v1\/rpc\/maker_build_metrics/, (route) =>
    rpc(route, rpcArgs(route).uid === PHASE6_MAKER.id ? PHASE6_METRICS : []),
  );

  // The legacy clear's world: no legacy post, so no legacy draft either.
  await page.route(/\/rest\/v1\/content_items(\?|$)/, table([]));
  await page.route(/\/rest\/v1\/content_blocks(\?|$)/, table([]));

  /* A cover is signed one request per row, then fetched: answer the signature
     with a URL naming the same path, and the fetch with that path's picture. */
  await page.route(/\/storage\/v1\//, (route) => {
    const url = route.request().url();
    const path = /build-media\/([^?]+)/.exec(url)?.[1] ?? "rc/cover-1.png";
    if (route.request().method() === "POST" && url.includes("/object/sign/")) {
      return rpc(route, { signedURL: `/render/image/sign/build-media/${path}?token=rc` });
    }
    return route.fulfill({ status: 200, contentType: "image/png", body: coverPng(path) });
  });
}

/* ── The probes ─────────────────────────────────────────────────────────────── */

interface Probe {
  width: number;
  /** Where the filled count was taken: the open dialog, or the page. */
  layer: "dialog" | "page";
  filled: string[];
  isolated: { kind: string; name: string; within: string }[];
  amberText: string[];
  type: { style: string; runs: number; sample: string }[];
  buttons: { name: string; height: number; text: string; paint: string; radius: string }[];
  sections: { name: string; height: number; gapBefore: number | null }[];
  /** Regions that scroll sideways: how much they hold, how much shows, and a table's columns in view. */
  scrollers: { name: string; scrollWidth: number; clientWidth: number; columns: string | null }[];
  overflow: number;
}

async function probe(page: Page, width: number, column: string): Promise<Probe> {
  return page.evaluate(
    ([viewportWidth, columnSpec]) => {
      const colour = (value: string, property: "color" | "backgroundColor" = "color") => {
        const swatch = document.createElement("div");
        swatch.style.color = value;
        swatch.style.backgroundColor = value;
        document.body.appendChild(swatch);
        const out = getComputedStyle(swatch)[property];
        swatch.remove();
        return out;
      };
      const ACTION = colour("var(--action)");
      const LIT = colour("var(--lit)");
      const EVIDENCE = colour("var(--evidence)");
      const EVIDENCE_FILL = colour("var(--evidence-fill)", "backgroundColor");
      const CATEGORY = new Map(
        ["instruction", "configuration", "data", "artefact", "evidence", "narrative", "agents", "breakage", "media"].map(
          (name) => [colour(`var(--cat-${name})`), name] as const,
        ),
      );

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
      const ownText = (element: Element) =>
        [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
      const within = (element: Element) => {
        const named = element.closest("[data-testid]");
        if (named) return named.getAttribute("data-testid") ?? "?";
        const landmark = element.closest("nav, header, main, aside, [role='dialog']");
        return landmark ? `${landmark.tagName.toLowerCase()}${landmark.getAttribute("aria-label") ? ` "${landmark.getAttribute("aria-label")}"` : ""}` : "page";
      };

      const dialogs = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')].filter(shown);
      const dialog = dialogs[dialogs.length - 1] ?? null;
      const scope: ParentNode = dialog ?? document;
      const filled = [...scope.querySelectorAll('button, a[href], [role="button"], [role="tab"], input[type="submit"]')]
        .filter((element) => shown(element) && getComputedStyle(element).backgroundColor === ACTION)
        .map(name);

      const centre = document.querySelector('[data-testid="frame-centre"]') ?? document.body;
      const everything = [...document.body.querySelectorAll("*")].filter(shown);
      const inCentre = everything.filter((element) => centre.contains(element));

      const isolated: Probe["isolated"] = [];
      for (const element of everything) {
        const style = getComputedStyle(element);
        const kinds: string[] = [];
        if (style.backgroundColor === ACTION) kinds.push("--action fill");
        if (style.backgroundColor === LIT) kinds.push("--lit fill");
        if (style.backgroundColor === EVIDENCE_FILL) kinds.push("--evidence-fill");
        if (ownText(element)) {
          if (style.color === ACTION) kinds.push("--action type");
          else if (style.color === EVIDENCE) kinds.push("--evidence type");
          else if (CATEGORY.has(style.color)) kinds.push(`--cat-${CATEGORY.get(style.color)} type`);
        }
        for (const kind of kinds) isolated.push({ kind, name: name(element), within: within(element) });
      }

      const amberText = everything
        .filter((element) => ownText(element) && getComputedStyle(element).color === LIT)
        .map((element) => (element.textContent ?? "").trim().slice(0, 60));

      const styles = new Map<string, { runs: number; sample: string }>();
      for (const element of inCentre) {
        if (!ownText(element)) continue;
        const style = getComputedStyle(element);
        const key = `${style.fontFamily.split(",")[0].replace(/["']/g, "").trim()} ${style.fontSize} ${style.fontWeight}`;
        const entry = styles.get(key) ?? { runs: 0, sample: (element.textContent ?? "").trim().slice(0, 40) };
        entry.runs += 1;
        styles.set(key, entry);
      }
      const type = [...styles.entries()]
        .map(([style, { runs, sample }]) => ({ style, runs, sample }))
        .sort((a, b) => parseFloat(b.style.split(" ").slice(-2)[0]) - parseFloat(a.style.split(" ").slice(-2)[0]));

      const transparent = (value: string) => value === "transparent" || /rgba\(0, 0, 0, 0\)/.test(value);
      const buttons = inCentre
        .filter((element) => element.matches('button, [role="button"], a[data-visual-slot^="btn"], a[role="tab"], [role="tab"]'))
        .map((element) => {
          const style = getComputedStyle(element);
          const box = element.getBoundingClientRect();
          const bordered = parseFloat(style.borderTopWidth) > 0 && !transparent(style.borderTopColor);
          const paint =
            style.backgroundColor === ACTION
              ? "filled --action"
              : !transparent(style.backgroundColor)
                ? `filled ${style.backgroundColor}`
                : bordered
                  ? "outline"
                  : "ghost";
          return {
            name: name(element),
            height: Math.round(box.height),
            text: `${style.fontSize} ${style.fontWeight}`,
            paint,
            radius: style.borderTopLeftRadius,
          };
        });

      // "<id>", "parent:<id>" or "parent2:<id>": the element, its parent, or its grandparent.
      const [prefix, id] = columnSpec.includes(":") ? columnSpec.split(":") : ["self", columnSpec];
      const anchor = document.querySelector(`[data-testid="${id}"]`);
      const holder =
        prefix === "parent2" ? anchor?.parentElement?.parentElement ?? null : prefix === "parent" ? anchor?.parentElement ?? null : anchor;
      const blocks = holder ? [...holder.children].filter(shown) : [];
      const sections = blocks.map((block, index) => {
        const box = block.getBoundingClientRect();
        const previous = index > 0 ? blocks[index - 1].getBoundingClientRect() : null;
        const heading = block.querySelector("h1, h2");
        return {
          name:
            block.getAttribute("role") === "note"
              ? "note"
              : (heading?.textContent?.trim() || block.getAttribute("data-testid") || block.tagName.toLowerCase()).slice(0, 40),
          height: Math.round(box.height),
          gapBefore: previous ? Math.round(box.top - previous.bottom) : null,
        };
      });

      const scrollers = inCentre
        .filter((element) => /(auto|scroll)/.test(getComputedStyle(element).overflowX) && element.scrollWidth > element.clientWidth + 1)
        .map((element) => {
          const box = element.getBoundingClientRect();
          const heads = [...element.querySelectorAll("thead th")];
          const inView = heads.filter((head) => head.getBoundingClientRect().right <= box.right + 1).length;
          return {
            name: element.getAttribute("data-testid") ?? element.tagName.toLowerCase(),
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            columns: heads.length ? `${inView} of ${heads.length}` : null,
          };
        });

      const root = document.scrollingElement ?? document.documentElement;
      return {
        width: viewportWidth,
        layer: dialog ? "dialog" : "page",
        filled,
        isolated,
        amberText,
        type,
        buttons,
        sections,
        scrollers,
        overflow: root.scrollWidth - root.clientWidth,
      } as Probe;
    },
    [width, column] as const,
  );
}

/** How much taller the page's scrolling column is than the space it scrolls in. */
function columnOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const centre = document.querySelector('[data-testid="frame-centre"]');
    const candidates = [document.scrollingElement ?? document.documentElement, ...(centre ? [centre, ...centre.querySelectorAll("*")] : [])];
    let most = 0;
    for (const element of candidates) {
      const style = getComputedStyle(element);
      const scrolls = element === document.scrollingElement || /(auto|scroll)/.test(style.overflowY);
      if (scrolls) most = Math.max(most, element.scrollHeight - element.clientHeight);
    }
    return most;
  });
}

const settle = (page: Page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

/* ── The captures ───────────────────────────────────────────────────────────── */

test.describe.configure({ mode: "default" });

for (const view of [...ROUTES, ...REFERENCE]) {
  for (const theme of THEMES) {
    test(`captures ${view.name} in ${theme} at four widths`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "desktop", "Captured once, on the desktop project.");
      test.setTimeout(300_000);

      await page.emulateMedia({ reducedMotion: "reduce" });
      await withTheme(page, theme);
      await withSession(page, view.reader);
      if (view.noteRead) {
        await page.addInitScript((key) => {
          try {
            window.localStorage.setItem(key as string, "1");
          } catch {
            /* the note shows, and the picture says so */
          }
        }, RESET_NOTE_KEY);
      }
      await installStub(page);
      await servePhase6(page, view.reader);

      fs.mkdirSync(OUT, { recursive: true });
      const probes: Probe[] = [];
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        await page.goto("about:blank");
        await page.goto(view.path, { waitUntil: "networkidle", timeout: 120_000 });
        await page.getByTestId("frame-centre").waitFor();
        await view.ready(page);
        await page.evaluate(() => document.fonts.ready);
        await settle(page);
        await page.screenshot({ path: `${OUT}/${view.name}-${viewport.width}-${theme}.png`, fullPage: true });
        probes.push(await probe(page, viewport.width, view.column));

        const extra = await columnOverflow(page);
        if (extra > 1) {
          await page.setViewportSize({ width: viewport.width, height: Math.min(viewport.height + extra, 9000) });
          await settle(page);
          await page.screenshot({ path: `${OUT}/${view.name}-${viewport.width}-${theme}-full.png`, fullPage: true });
        }
      }
      fs.writeFileSync(`${OUT}/probes-${view.name}-${theme}.json`, JSON.stringify(probes, null, 2));
      expect(probes).toHaveLength(VIEWPORTS.length);
    });
  }
}
