// UI-P47 — the composer, part 1: frame, media, text and publish.
//
// THE BACKEND IS FAKED (see support/fakeBackend.ts). builds, build_nodes,
// build_media, the node-type registry, the post-media function and storage are
// answered here, and every write is recorded so the spec can say what was sent
// and, just as important, what was not.

import { expect, test, type Page, type Request } from "@playwright/test";
import { ME } from "../audit/support/harness";
import { fakeBoundaries, json, uuid, type Row } from "./support/fakeBackend";

const BUILD_ID = uuid(501);
const MEDIA_ID = uuid(601);

/** A 1×1 PNG, so the browser can decode the file it is "dropped". */
const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const NODE_TYPES: Row[] = [
  ["screenshot", "Screenshot", "evidence"],
  ["recording", "Recording", "evidence"],
  ["prompt", "Prompt", "instruction"],
].map(([key, label, category]) => ({
  key,
  label,
  category,
  colour: null,
  icon: "Circle",
  renderer: category,
  copyable: category === "instruction",
  is_active: true,
  sort: 1,
  schema: { fields: [] },
}));

const buildRow = (patch: Row = {}): Row => ({
  id: BUILD_ID,
  creator_id: ME.id,
  slug: "photo-renamer-abc123",
  title: "Photo renamer",
  outcome: null,
  shape: "other",
  status: "draft",
  made_for: [],
  made_with: [],
  completeness: 0,
  reproduction_count: 0,
  parent_build_id: null,
  created_at: "2026-10-06T10:00:00.000Z",
  updated_at: "2026-10-06T10:00:00.000Z",
  published_at: null,
  ...patch,
});

interface Backend {
  /** Every write to /rest/v1 or /storage/v1, as sent. */
  writes: Request[];
  buildWrites: Request[];
  nodeWrites: Request[];
  rpcCalls: Request[];
}

async function fakeBackend(page: Page): Promise<Backend> {
  const backend: Backend = { writes: [], buildWrites: [], nodeWrites: [], rpcCalls: [] };
  let build: Row | null = null;
  const nodes: Row[] = [];
  const media: Row[] = [];

  page.on("request", (request) => {
    const url = request.url();
    if (!/\/(rest|storage)\/v1\//.test(url) || ["GET", "HEAD"].includes(request.method())) return;
    // Signing a URL and the facets are POSTs that read; dm_presence is the app's own heartbeat, not the composer.
    if (url.includes("/object/sign/") || url.includes("/rpc/gallery_facets") || url.includes("/dm_presence")) return;
    backend.writes.push(request);
  });

  await fakeBoundaries(page);

  await page.route(/\/rest\/v1\/node_types/, (route) => json(route, NODE_TYPES));
  await page.route(/\/rest\/v1\/build_events/, (route) => json(route, []));

  await page.route(/\/rest\/v1\/builds\?/, (route) => {
    const request = route.request();
    const method = request.method();
    if (method === "POST") {
      backend.buildWrites.push(request);
      build = buildRow({ ...(request.postDataJSON() as Row) });
      return json(route, [build], 201);
    }
    if (method === "PATCH") {
      backend.buildWrites.push(request);
      build = { ...(build ?? buildRow()), ...(request.postDataJSON() as Row) };
      return json(route, [build]);
    }
    return json(route, build ? [build] : []);
  });

  await page.route(/\/rest\/v1\/build_nodes/, (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      backend.nodeWrites.push(request);
      const sent = request.postDataJSON() as Row;
      const row = { id: uuid(700 + nodes.length), note: null, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-06T10:01:00.000Z", title: null, ...sent };
      nodes.push(row);
      return json(route, [row], 201);
    }
    if (request.method() !== "GET") return json(route, []);
    const url = decodeURIComponent(request.url());
    return json(route, url.includes("position=is.null") ? [] : nodes);
  });

  await page.route(/\/rest\/v1\/build_media/, (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const sent = request.postDataJSON() as Row;
      const row = { id: MEDIA_ID, node_id: null, post_position: null, post_text: null, created_at: "2026-10-06T10:01:00.000Z", ...sent };
      media.push(row);
      return json(route, [row], 201);
    }
    if (request.method() !== "GET") return json(route, []);
    return json(route, media.filter((row) => row.post_position !== null && row.post_position !== undefined));
  });

  await page.route(/\/rest\/v1\/rpc\/set_build_post_media/, (route) => {
    const request = route.request();
    backend.rpcCalls.push(request);
    const ids = (request.postDataJSON() as { p_media_ids: string[] }).p_media_ids;
    ids.forEach((id, index) => {
      const row = media.find((m) => m.id === id);
      if (row) row.post_position = index;
    });
    return json(route, media.filter((row) => ids.includes(String(row.id))));
  });

  // Upload, then signing, then the picture itself.
  await page.route(/\/storage\/v1\/object\/build-media\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Key: "build-media/x" }) }),
  );
  await page.route(/\/storage\/v1\/object\/sign\/build-media\/.*\?token=/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(PNG_BASE64, "base64") }),
  );
  await page.route(/\/storage\/v1\/object\/sign\/build-media\/[^?]*$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ signedURL: "/object/sign/build-media/cover.png?token=t" }),
    }),
  );
  return backend;
}

test("/compose/new makes no write until the first change", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto("/compose/new");

  await expect(page.getByRole("heading", { name: "Untitled build", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Paste a transcript or a repo instead" })).toHaveAttribute("href", "/compose/start");
  await expect(page.getByText("Draft · still needs")).toBeVisible();
  // Give anything that was going to write a moment to do it.
  await page.waitForTimeout(1500);
  expect(backend.writes.map((r) => `${r.method()} ${r.url()}`)).toEqual([]);
  expect(page.url()).toMatch(/\/compose\/new$/);
});

test("typing a title creates the build, and the URL becomes /compose/{id}", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto("/compose/new");

  const title = page.getByLabel("Title", { exact: true });
  await title.fill("Photo renamer");

  await expect(page).toHaveURL(new RegExp(`/compose/${BUILD_ID}$`));
  expect(backend.buildWrites[0].method()).toBe("POST");
  expect(backend.buildWrites[0].postDataJSON()).toMatchObject({ title: "Photo renamer", status: "draft", creator_id: ME.id });
  await expect(page.getByRole("heading", { name: "Photo renamer", level: 1 })).toBeVisible();

  // The page did not remount: the field still has focus and the next keystrokes land.
  await expect(title).toBeFocused();
  await title.pressSequentially(" by date taken");
  await expect(title).toHaveValue("Photo renamer by date taken");
  await expect
    .poll(() => backend.buildWrites.filter((r) => r.method() === "PATCH").some((r) => (r.postDataJSON() as Row).title === "Photo renamer by date taken"))
    .toBe(true);
});

test("Publish with nothing says what is missing, in order, and writes nothing", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto("/compose/new");

  await page.getByRole("button", { name: "Publish" }).click();

  await expect(page.getByText("To publish, add a cover picture or video, a title, a description, a prompt.")).toBeVisible();
  expect(backend.writes).toEqual([]);
});

test("dropping an image uploads it, writes a screenshot node and sets the cover", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto("/compose/new");

  const dataTransfer = await page.evaluateHandle((b64) => {
    const transfer = new DataTransfer();
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    transfer.items.add(new File([bytes], "shot.png", { type: "image/png" }));
    return transfer;
  }, PNG_BASE64);
  await page.getByTestId("media-zone").dispatchEvent("drop", { dataTransfer });

  await expect(page.getByRole("img", { name: "Your cover" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/compose/${BUILD_ID}$`));

  // The set, never the mirror.
  expect(backend.rpcCalls.map((r) => r.postDataJSON())).toEqual([{ p_build_id: BUILD_ID, p_media_ids: [MEDIA_ID] }]);
  expect(backend.buildWrites.some((r) => "cover_media_id" in ((r.postDataJSON() ?? {}) as Row))).toBe(false);

  // A placed evidence node: top level, a position, never the tray.
  expect(backend.nodeWrites).toHaveLength(1);
  expect(backend.nodeWrites[0].postDataJSON()).toMatchObject({
    build_id: BUILD_ID,
    parent_id: null,
    position: 0,
    type: "screenshot",
    payload: { media_id: MEDIA_ID, caption: null },
  });

  // The cover is the evidence, so the status line no longer asks for it.
  await expect(page.getByTestId("compose-status")).not.toContainText("cover picture or video");
});
