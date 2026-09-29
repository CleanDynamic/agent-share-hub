// RC-P18 — the Library on builds, in a real browser, at the desktop and the
// phone project.
//
// THE BACKEND IS FAKED (CONTRACT §7): /rest/v1/, /auth/v1/, /storage/v1/ and
// /functions/v1/ are answered here, the realtime socket and the font CDN are
// silenced, and a signed-in reader is a session put in storage. build_saves
// answers the saved list and which builds are saved; collections and
// collection_items answer the reader's collections, their builds and every
// write, which is recorded. Nothing reaches the network.

import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { ME, withSession } from "../audit/support/harness";

type Row = Record<string, unknown>;

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const TITLES = ["Invoice reader that files the totals", "Inbox triage agent", "Meeting notes to tasks", "Contract clause finder", "Weekly report writer"];

function galleryRow(n: number): Row {
  return {
    id: id(n),
    creator_id: id(900),
    slug: `build-${n}`,
    title: TITLES[n - 1],
    outcome: "Does a thing, and says how well it did it.",
    shape: "workflow",
    status: "published",
    made_for: ["founder"],
    made_with: ["Claude"],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: null,
    completeness: 92,
    reproduction_count: 12,
    last_confirmed_at: "2026-09-26T00:00:00.000Z",
    last_confirmed_model: "claude-sonnet-4-5",
    published_at: "2026-08-01T00:00:00.000Z",
    parent_build_id: null,
    rebuild_count: 0,
    rebuild_note: null,
    source_title_at_fork: null,
    source_handle_at_fork: null,
    build_nodes: [],
    build_media: [],
    bounties: [],
  };
}

const BUILDS = [1, 2, 3, 4, 5].map(galleryRow);
/** Saved, newest first: builds 3, 2 and 1. */
const SAVED = [3, 2, 1].map((n, index) => ({ build_id: id(n), created_at: `2026-09-2${8 - index}T10:00:00.000Z` }));

const COLLECTIONS: Row[] = Array.from({ length: 9 }, (_, index) => ({
  id: id(300 + index),
  owner_id: ME.id,
  title: ["Invoices", "Weekend ideas", "To try on Monday", "Client work", "Research", "Email", "Legal", "Hiring", "Old favourites"][index],
  is_public: false,
  updated_at: `2026-09-2${9 - index}T10:00:00.000Z`,
  collection_items: [{ count: index + 1 }],
}));

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
  /** Every write to collection_items, as sent. */
  itemWrites: Request[];
  /** Every write to collections, as sent. */
  collectionWrites: Request[];
}

async function fakeBackend(page: Page, { empty = false }: { empty?: boolean } = {}): Promise<Backend> {
  const backend: Backend = { itemWrites: [], collectionWrites: [] };
  await withSession(page);

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
  await page.route(/\/rest\/v1\/rpc\/gallery_facets/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ roles: [], tools: [] }) }),
  );
  await page.route(/\/rest\/v1\/profiles\?/, (route) =>
    json(route, [{ id: ME.id, username: ME.username, display_name: ME.display_name, avatar_url: null, is_admin: false }]),
  );
  await page.route(/\/rest\/v1\/builds\?/, (route) => {
    const url = decodeURIComponent(route.request().url());
    if (url.includes("like_count")) return json(route, BUILDS.map((row) => ({ id: row.id, like_count: 2, comment_count: 0 })));
    const ids = url.match(/[?&]id=in\.\(([^)]*)\)/)?.[1]?.split(",");
    if (ids) return json(route, BUILDS.filter((row) => ids.includes(String(row.id))));
    if (url.includes("parent_build_id=eq.") || url.includes("limit=3")) return json(route, []);
    return json(route, BUILDS);
  });
  await page.route(/\/rest\/v1\/build_saves/, (route) => {
    if (route.request().method() !== "GET") return route.fulfill({ status: 201, contentType: "application/json", body: "" });
    const url = decodeURIComponent(route.request().url());
    if (empty) return json(route, []);
    if (url.includes("created_at")) return json(route, SAVED);
    return json(route, SAVED.map((row) => ({ build_id: row.build_id })));
  });
  await page.route(/\/rest\/v1\/collections\?/, (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      backend.collectionWrites.push(request);
      const sent = request.postDataJSON() as Row;
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: id(399), updated_at: new Date().toISOString(), ...sent }),
      });
    }
    if (request.method() !== "GET") {
      backend.collectionWrites.push(request);
      return route.fulfill({ status: 204, contentType: "application/json", body: "" });
    }
    const url = decodeURIComponent(request.url());
    const one = url.match(/[?&]id=eq\.([^&]+)/)?.[1];
    if (one) return json(route, COLLECTIONS.filter((row) => row.id === one));
    return json(route, empty ? [] : COLLECTIONS);
  });
  await page.route(/\/rest\/v1\/collection_items/, (route) => {
    const request = route.request();
    if (request.method() !== "GET") {
      backend.itemWrites.push(request);
      return route.fulfill({ status: 201, contentType: "application/json", body: "" });
    }
    const url = decodeURIComponent(request.url());
    if (url.includes("select=build_id")) {
      return json(route, [4, 5].map((n, index) => ({ build_id: id(n), added_at: `2026-09-2${7 - index}T10:00:00.000Z` })));
    }
    if (url.includes("select=position")) return json(route, [{ position: 2 }]);
    return json(route, []);
  });

  return backend;
}

const cards = (page: Page) => page.getByTestId("library-card");

async function openTheDialogFromTheGallery(page: Page) {
  await page.goto("/gallery");
  const grid = page.getByTestId("gallery-grid");
  await expect(grid.locator('[data-visual-slot="gallery-card"]').first()).toBeVisible();
  await expect(grid.getByRole("button", { name: "Unsave", exact: true })).toHaveCount(3);
  // The first build nobody has saved: build 4.
  await grid.getByRole("button", { name: "Save", exact: true }).first().click();
  await page.getByRole("button", { name: "Add to a collection" }).click();
  const dialog = page.getByTestId("add-to-collection-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("collection-choice")).toHaveCount(9);
  return dialog;
}

test("saved builds render as the gallery's cards, newest save first", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/library");

  await expect(cards(page)).toHaveCount(3);
  await expect(cards(page).locator('[data-visual-slot="gallery-card"]')).toHaveCount(3);
  await expect(cards(page).nth(0)).toContainText(TITLES[2]);
  await expect(cards(page).nth(2)).toContainText(TITLES[0]);
});

test("adding a saved build to a collection sends it as a build", async ({ page }) => {
  const backend = await fakeBackend(page);
  const dialog = await openTheDialogFromTheGallery(page);

  await dialog.getByTestId("collection-choice").first().click();

  await expect(page.getByText("Added to Invoices.")).toBeVisible();
  await expect(dialog).toHaveCount(0);
  const insert = backend.itemWrites.find((request) => request.method() === "POST");
  expect(insert?.postDataJSON()).toEqual({
    collection_id: id(300),
    item_kind: "build",
    build_id: id(4),
    item_id: id(4),
    content_id: null,
    added_by: ME.id,
    position: 3,
  });
  // The collection moves to the top of the reader's lists.
  expect(backend.collectionWrites.some((request) => request.method() === "PATCH")).toBe(true);
});

test("a new collection made in the dialog takes the build", async ({ page }) => {
  const backend = await fakeBackend(page);
  const dialog = await openTheDialogFromTheGallery(page);

  await dialog.getByLabel("New collection").fill("Receipts");
  await dialog.getByRole("button", { name: "Create and add" }).click();

  await expect(page.getByText("Added to Receipts.")).toBeVisible();
  const made = backend.collectionWrites.find((request) => request.method() === "POST");
  expect(made?.postDataJSON()).toMatchObject({ owner_id: ME.id, title: "Receipts", is_public: false, is_default: false });
  const insert = backend.itemWrites.find((request) => request.method() === "POST");
  expect(insert?.postDataJSON()).toMatchObject({ collection_id: id(399), item_kind: "build", build_id: id(4) });
});

test("the dialog shows seven collections before its list scrolls", async ({ page }) => {
  await fakeBackend(page);
  const dialog = await openTheDialogFromTheGallery(page);

  const list = await dialog.getByTestId("collection-choices").evaluate((element) => ({
    client: element.clientHeight,
    scroll: element.scrollHeight,
    row: (element.querySelector("button") as HTMLElement).getBoundingClientRect().height,
  }));
  expect(Math.round(list.client / list.row)).toBe(7);
  expect(list.scroll).toBeGreaterThan(list.client);
});

test("collections list the one used last first, and one opens as cards", async ({ page }) => {
  await fakeBackend(page);
  await page.goto("/library?tab=collections");

  const rows = page.getByTestId("library-collection");
  await expect(rows).toHaveCount(9);
  await expect(rows.first()).toContainText("Invoices");
  await rows.first().click();

  await expect(page).toHaveURL(/tab=collections&collection=/);
  await expect(cards(page)).toHaveCount(2);
  await expect(cards(page).first()).toContainText(TITLES[3]);
});

test("both empty sentences, each with its one action", async ({ page }) => {
  await fakeBackend(page, { empty: true });

  await page.goto("/library");
  const saved = page.getByTestId("library-saved-empty");
  await expect(saved).toContainText("Save a build and it waits for you here.");
  await expect(saved.getByRole("link", { name: "Browse the gallery" })).toHaveAttribute("href", "/gallery");

  await page.getByRole("button", { name: "Collections", exact: true }).click();
  const collections = page.getByTestId("library-collections-empty");
  await expect(collections).toContainText("Group builds you want to keep together.");
  await expect(collections.getByRole("button", { name: "New collection" })).toBeVisible();
});

test("a short tab starts under its tabs, with no empty band above it", async ({ page }) => {
  await fakeBackend(page, { empty: true });
  await page.goto("/library?tab=collections");

  const empty = page.getByTestId("library-collections-empty");
  await expect(empty).toBeVisible();
  const tabs = await page.getByRole("button", { name: "Collections", exact: true }).boundingBox();
  const tab = await empty.boundingBox();
  // The frame grows every child of the page body. The page is one child, so
  // only its own spacing sits between the tabs and what they open (RC-P20b).
  expect(tab!.y - (tabs!.y + tabs!.height)).toBeLessThanOrEqual(64);
});
