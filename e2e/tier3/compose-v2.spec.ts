// UI-P47 — the composer in the site frame: frame, media, text, publish.
//
// THE BACKEND IS FAKED (see support/fakeBackend.ts) with a small stateful
// builds / build_nodes / build_media. The first thing every test asserts is
// what was WRITTEN: opening /compose/new writes nothing, and the first change
// is what makes the draft.

import { expect, test, type Page, type Request } from "@playwright/test";
import { ME } from "../audit/support/harness";
import { fakeBoundaries, json, uuid, type Row } from "./support/fakeBackend";

const BUILD_ID = uuid(7);
const MEDIA_ID = uuid(8);

/** A 1×1 PNG. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const NODE_TYPES: Row[] = [
  { key: "screenshot", label: "Screenshot", category: "evidence", description: "", icon: null, schema: { fields: [] }, sort: 1, is_active: true },
  { key: "recording", label: "Recording", category: "evidence", description: "", icon: null, schema: { fields: [] }, sort: 2, is_active: true },
  { key: "prompt", label: "Prompt", category: "instruction", description: "", icon: null, schema: { fields: [] }, sort: 3, is_active: true },
];

interface Write {
  method: string;
  url: string;
  body: Row | null;
}

interface Backend {
  writes: Write[];
  build: () => Row | null;
}

const bodyOf = (request: Request): Row | null => {
  try {
    return request.postDataJSON() as Row;
  } catch {
    return null;
  }
};

async function fakeBackend(page: Page, { signedIn = true }: { signedIn?: boolean } = {}): Promise<Backend> {
  let build: Row | null = null;
  const media: Row[] = [];
  const nodes: Row[] = [];
  const writes: Write[] = [];
  await fakeBoundaries(page, { signedIn });

  const record = (request: Request) => {
    if (request.method() !== "GET" && request.method() !== "HEAD") {
      writes.push({ method: request.method(), url: decodeURIComponent(request.url()), body: bodyOf(request) });
    }
  };

  // Every write to the storage bucket counts too.
  await page.route(/\/storage\/v1\/object\//, (route) => {
    record(route.request());
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Key: "build-media/x" }) });
  });

  await page.route(/\/rest\/v1\/builds(\?|$)/, (route) => {
    const request = route.request();
    record(request);
    if (request.method() === "POST") {
      const body = bodyOf(request) ?? {};
      build = {
        id: BUILD_ID,
        creator_id: ME.id,
        slug: "photo-renamer-k3f9x1",
        outcome: null,
        shape: "other",
        status: "draft",
        made_for: [],
        made_with: [],
        completeness: 0,
        reproduction_count: 0,
        parent_build_id: null,
        created_at: "2026-10-06T09:00:00.000Z",
        updated_at: "2026-10-06T09:00:00.000Z",
        published_at: null,
        ...body,
      };
      return json(route, [build], 201);
    }
    if (request.method() === "PATCH") {
      build = { ...(build ?? {}), ...(bodyOf(request) ?? {}) };
      return json(route, [build]);
    }
    const url = decodeURIComponent(request.url());
    if (build && url.includes(`id=eq.${BUILD_ID}`)) return json(route, [build]);
    return json(route, []);
  });

  await page.route(/\/rest\/v1\/node_types/, (route) => json(route, NODE_TYPES));
  await page.route(/\/rest\/v1\/build_events/, (route) => json(route, []));

  await page.route(/\/rest\/v1\/build_nodes/, (route) => {
    const request = route.request();
    record(request);
    if (request.method() === "POST") {
      const row = { id: uuid(9), created_at: "2026-10-06T09:00:00.000Z", title: null, note: null, source_ref: null, event_id: null, is_gap: false, ...(bodyOf(request) ?? {}) };
      nodes.push(row);
      return json(route, [row], 201);
    }
    if (request.method() !== "GET") return json(route, []);
    const url = decodeURIComponent(request.url());
    return json(route, url.includes("position=is.null") ? [] : nodes);
  });

  await page.route(/\/rest\/v1\/build_media/, (route) => {
    const request = route.request();
    record(request);
    if (request.method() === "POST") {
      const row = { id: MEDIA_ID, node_id: null, bucket: "build-media", poster_path: null, post_position: null, post_text: null, created_at: "2026-10-06T09:00:00.000Z", ...(bodyOf(request) ?? {}) };
      media.push(row);
      return json(route, [row], 201);
    }
    if (request.method() !== "GET") return json(route, []);
    const url = decodeURIComponent(request.url());
    return json(route, url.includes("post_position=not.is.null") ? media.filter((row) => row.post_position !== null) : media);
  });

  await page.route(/\/rest\/v1\/rpc\/set_build_post_media/, (route) => {
    record(route.request());
    const ids = ((bodyOf(route.request()) ?? {}).p_media_ids ?? []) as string[];
    for (const row of media) row.post_position = ids.includes(row.id as string) ? ids.indexOf(row.id as string) : null;
    return json(route, media.filter((row) => row.post_position !== null));
  });

  return { writes, build: () => build };
}

const writesTo = (backend: Backend, table: string, method?: string) =>
  backend.writes.filter((write) => write.url.includes(`/rest/v1/${table}`) && (!method || write.method === method));

const heading = (page: Page) => page.getByTestId("compose-heading");
const publish = (page: Page) => page.getByRole("button", { name: "Publish", exact: true });

test("/compose/new makes no write until the first change", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto("/compose/new");

  await expect(heading(page)).toHaveText("Untitled build");
  await expect(page.getByRole("link", { name: "Paste a transcript or a repo instead" })).toHaveAttribute("href", "/compose/start");
  await expect(page.getByTestId("compose-status")).toContainText("Draft");
  // Let the debounce and any effect have their say.
  await page.waitForTimeout(1500);

  expect(backend.writes).toEqual([]);
  await expect(page).toHaveURL(/\/compose\/new$/);
});

test("typing a title creates the build and the URL becomes /compose/{id}", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto("/compose/new");

  await page.getByLabel("Title").fill("Photo renamer by date taken");

  await expect(page).toHaveURL(new RegExp(`/compose/${BUILD_ID}$`));
  const created = writesTo(backend, "builds", "POST");
  expect(created).toHaveLength(1);
  expect(created[0].body).toMatchObject({ title: "Photo renamer by date taken", status: "draft" });
  await expect(heading(page)).toHaveText("Photo renamer by date taken");
  await expect(page.getByLabel("Title")).toHaveValue("Photo renamer by date taken");
  // The cursor was not lost to the move.
  await expect(page.getByLabel("Title")).toBeFocused();
});

test("Publish with nothing says what is needed, and writes nothing", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto("/compose/new");

  await expect(publish(page)).toBeEnabled();
  await publish(page).click();

  await expect(page.getByText("To publish, add a cover picture or video, a title, a description, a prompt.")).toBeVisible();
  expect(backend.writes).toEqual([]);
});

test("dropping an image adds it, writes a screenshot node and sets the cover", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto("/compose/new");

  const zone = page.getByTestId("compose-dropzone");
  const data = await page.evaluateHandle((bytes) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(bytes)], "screenshot.png", { type: "image/png" }));
    return transfer;
  }, [...PNG]);
  await zone.dispatchEvent("dragenter", { dataTransfer: data });
  await zone.dispatchEvent("dragover", { dataTransfer: data });
  await zone.dispatchEvent("drop", { dataTransfer: data });

  await expect(page.getByRole("img", { name: "Cover" })).toBeVisible();
  await expect(page.getByText("Cover", { exact: true })).toBeVisible();

  // The draft was made by the drop, with the placeholder title.
  expect(writesTo(backend, "builds", "POST")[0].body).toMatchObject({ title: "Untitled build" });
  // The file went to storage, and its record exists.
  expect(backend.writes.some((write) => write.url.includes("/storage/v1/object/build-media/"))).toBe(true);
  expect(writesTo(backend, "build_media", "POST")).toHaveLength(1);
  // The set, not the mirror: the RPC carries the picture, and cover_media_id is never written.
  const set = backend.writes.find((write) => write.url.includes("/rpc/set_build_post_media"));
  expect(set?.body).toMatchObject({ p_build_id: BUILD_ID, p_media_ids: [MEDIA_ID] });
  expect(backend.writes.some((write) => write.body && "cover_media_id" in write.body)).toBe(false);
  // The evidence is a placed screenshot node pointing at it.
  const node = writesTo(backend, "build_nodes", "POST")[0].body;
  expect(node).toMatchObject({ build_id: BUILD_ID, parent_id: null, position: 1, type: "screenshot", payload: { media_id: MEDIA_ID, caption: null } });
});

test("signed out goes to sign in", async ({ page }) => {
  await fakeBackend(page, { signedIn: false });
  await page.goto("/compose/new");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcompose%2Fnew/);
});
