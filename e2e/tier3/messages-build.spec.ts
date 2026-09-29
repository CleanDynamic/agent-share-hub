// RC-P20 — builds in messages, in a real browser, at the desktop and the phone
// project.
//
// THE BACKEND IS FAKED (CONTRACT §7): /rest/v1/, /auth/v1/, /storage/v1/ and
// /functions/v1/ are answered here, the realtime socket and the font CDN are
// silenced, and a signed-in reader is a session put in storage. One direct
// thread holds an old share whose link the clear emptied, an old post share
// likewise emptied, a message carrying a build, and a plain reply. builds
// answers the shared build as the gallery's cards read it, the reader's own
// published builds, and their saved builds' titles; build_saves answers their
// saves. Every write to dm_messages and dm_threads is recorded. Nothing
// reaches the network.

import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { ME, THEM, withSession } from "../audit/support/harness";

type Row = Record<string, unknown>;

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const THREAD_ID = id(600);

/** The build a message carries, as the gallery's cards read it. */
const SHARED: Row = {
  id: id(1),
  creator_id: THEM.id,
  slug: "invoice-reader",
  title: "Invoice reader that files the totals",
  outcome: "Reads an invoice and files its totals.",
  shape: "workflow",
  status: "published",
  made_for: ["founder"],
  made_with: ["Claude"],
  live_url: null,
  repo_url: null,
  hero_node_id: null,
  cover_media_id: id(501),
  completeness: 92,
  reproduction_count: 12,
  last_confirmed_at: minutesAgo(60 * 24 * 3),
  last_confirmed_model: "claude-sonnet-4-5",
  published_at: "2026-08-01T00:00:00.000Z",
  parent_build_id: null,
  rebuild_count: 0,
  rebuild_note: null,
  source_title_at_fork: null,
  source_handle_at_fork: null,
  build_nodes: [],
  build_media: [
    {
      id: id(501),
      node_id: null,
      bucket: "build-media",
      path: `${id(1)}/cover.png`,
      kind: "image",
      width: 1600,
      height: 900,
      poster_path: null,
      duration: null,
      post_position: null,
      post_text: null,
    },
  ],
  bounties: [],
};

/** Fifteen published builds of the reader's own, and ten saves: 25 to offer, 20 shown. */
const OWN: Row[] = Array.from({ length: 15 }, (_, index) => ({
  id: id(100 + index),
  slug: `my-build-${index}`,
  title: `My build ${index}`,
  published_at: `2026-09-${String(10 + index).padStart(2, "0")}T09:00:00.000Z`,
  created_at: "2026-08-01T00:00:00.000Z",
}));
const SAVED: Row[] = Array.from({ length: 10 }, (_, index) => ({
  build_id: id(200 + index),
  created_at: `2026-09-28T${String(20 - index).padStart(2, "0")}:00:00.000Z`,
}));
const SAVED_TITLES: Row[] = SAVED.map((save, index) => ({
  id: save.build_id,
  slug: `saved-build-${index}`,
  title: `Saved build ${index}`,
}));

const THREAD: Row = {
  id: THREAD_ID,
  type: "direct",
  title: null,
  created_by: THEM.id,
  participant_a: ME.id,
  participant_b: THEM.id,
  pinned_content_id: null,
  pinned_content_type: null,
  pinned_build_id: null,
  is_pinned_a: false,
  is_pinned_b: false,
  is_muted_a: false,
  is_muted_b: false,
  is_deleted_a: false,
  is_deleted_b: false,
  request_status: "accepted",
  last_message_at: minutesAgo(5),
  last_message_preview: "Thanks, trying it tonight.",
  last_message_sender_id: ME.id,
  is_archived: false,
  unread_count_a: 0,
  unread_count_b: 0,
};

function message(n: number, sender: string, minutes: number, extra: Row): Row {
  return {
    id: id(700 + n),
    thread_id: THREAD_ID,
    sender_id: sender,
    kind: "text",
    message_type: "text",
    body: null,
    text_content: null,
    image_url: null,
    voice_url: null,
    voice_duration_seconds: null,
    is_liked: null,
    reply_to_message_id: null,
    shared_content_type: null,
    shared_content_id: null,
    shared_content_meta: null,
    shared_build_id: null,
    edited_at: null,
    sent_at: minutesAgo(minutes),
    read_at: null,
    delivered_at: minutesAgo(minutes),
    is_unsent: false,
    ...extra,
  };
}

const LEGACY_WORDS = "This is the one I meant last week.";
const NOTE = "It reads the totals and files them.";

const MESSAGES: Row[] = [
  // Shared before the clear: its link was emptied, its words were kept.
  message(1, THEM.id, 40, {
    kind: "content-share",
    shared_content_type: "blueprint",
    shared_content_meta: { title: "An old share" },
    body: LEGACY_WORDS,
    text_content: LEGACY_WORDS,
  }),
  // An old post share, emptied too; it never had words.
  message(2, ME.id, 30, { message_type: "post_share" }),
  // A build, with a note.
  message(3, THEM.id, 10, { shared_build_id: SHARED.id, body: NOTE, text_content: NOTE }),
  message(4, ME.id, 5, { body: "Thanks, trying it tonight.", text_content: "Thanks, trying it tonight." }),
];

const PNG_1PX = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const wantsObject = (route: Route) => (route.request().headers()["accept"] ?? "").includes("pgrst.object");

function json(route: Route, rows: unknown[], status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
    body: wantsObject(route) ? JSON.stringify(rows[0] ?? null) : JSON.stringify(rows),
  });
}

const requestUrl = (route: Route) => decodeURIComponent(route.request().url());

const idsIn = (url: string) => url.match(/[?&]id=in\.\(([^)]*)\)/)?.[1]?.split(",").map((value) => value.replace(/"/g, ""));

interface Backend {
  /** Every write to dm_messages, as sent. */
  messageWrites: Request[];
  /** Every write to dm_threads, as sent. */
  threadWrites: Request[];
}

async function fakeBackend(page: Page): Promise<Backend> {
  const backend: Backend = { messageWrites: [], threadWrites: [] };
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
  await page.route(/\/functions\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  // A cover is two calls: the sign request wants JSON, the signed URL wants bytes.
  await page.route(/\/storage\/v1\//, (route) =>
    route.request().method() === "POST" && route.request().url().includes("/object/sign/")
      ? route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ signedURL: "/render/image/sign/build-media/cover.png?token=tier3" }),
        })
      : route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(PNG_1PX, "base64") }),
  );

  // Widest first: Playwright matches the LAST registered route first.
  await page.route(/\/rest\/v1\//, (route) => json(route, []));
  await page.route(/\/rest\/v1\/profiles(\?|$)/, (route) => {
    const url = requestUrl(route);
    const people = [
      { id: ME.id, username: ME.username, display_name: ME.display_name, avatar_url: null, is_admin: false },
      { id: THEM.id, username: THEM.username, display_name: THEM.display_name, avatar_url: null, is_admin: false },
    ];
    const one = url.match(/[?&]id=eq\.([^&]+)/)?.[1];
    return json(route, one ? people.filter((person) => person.id === one) : people);
  });
  await page.route(/\/rest\/v1\/dm_threads(\?|$)/, (route) => {
    if (route.request().method() !== "GET") {
      backend.threadWrites.push(route.request());
      return route.fulfill({ status: 204, contentType: "application/json", body: "" });
    }
    return json(route, [THREAD]);
  });
  await page.route(/\/rest\/v1\/dm_thread_members(\?|$)/, (route) =>
    route.request().method() !== "GET"
      ? route.fulfill({ status: 204, contentType: "application/json", body: "" })
      : json(route, [
          { thread_id: THREAD_ID, user_id: ME.id, last_read_at: minutesAgo(1), is_pinned: false, is_muted: false, joined_at: minutesAgo(600) },
        ]),
  );
  await page.route(/\/rest\/v1\/dm_messages(\?|$)/, (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      backend.messageWrites.push(request);
      return route.fulfill({ status: 201, contentType: "application/json", body: "" });
    }
    if (request.method() !== "GET") return route.fulfill({ status: 204, contentType: "application/json", body: "" });
    return json(route, [...MESSAGES].reverse());
  });
  await page.route(/\/rest\/v1\/builds(\?|$)/, (route) => {
    const url = requestUrl(route);
    const ids = idsIn(url);
    if (ids && url.includes("build_nodes")) return json(route, [SHARED].filter((row) => ids.includes(String(row.id))));
    if (ids) return json(route, SAVED_TITLES.filter((row) => ids.includes(String(row.id))));
    if (url.includes(`creator_id=eq.${ME.id}`)) return json(route, [...OWN].reverse());
    return json(route, []);
  });
  await page.route(/\/rest\/v1\/build_saves(\?|$)/, (route) =>
    json(route, requestUrl(route).includes(`user_id=eq.${ME.id}`) ? SAVED : []),
  );

  return backend;
}

async function openThread(page: Page) {
  await page.goto(`/messages/${THREAD_ID}`);
  await expect(page.getByText("Thanks, trying it tonight.").last()).toBeVisible();
}

/**
 * Open the picker the way both projects can: "@" in the message box, the
 * composer's own shortcut. At the phone width the Messages page still lays
 * the thread list beside the thread, and the Share a build button sits under
 * the message box there (the diary records it; the page is not RC-P20's).
 */
async function openPicker(page: Page) {
  await page.getByPlaceholder("Message…").pressSequentially("@");
  const picker = page.getByRole("dialog", { name: "Share a build" });
  await expect(picker.getByTestId("reference-item").first()).toBeVisible();
  return picker;
}

test("the picker offers one kind, Builds, and twenty builds at most", async ({ page }) => {
  await fakeBackend(page);
  await openThread(page);

  const picker = await openPicker(page);
  await expect(picker.getByTestId("reference-item")).toHaveCount(20);

  await expect(picker.getByTestId("reference-kind")).toHaveText("Builds");
  for (const legacy of ["Blueprints", "Stages", "Blocks"]) await expect(picker.getByText(legacy)).toHaveCount(0);
  // The most recent first: the reader's latest save, then their other saves.
  await expect(picker.getByTestId("reference-item").first()).toContainText("Saved build 0");
});

test("a message carrying a build shows the build's card, with the plaque, linking to the build", async ({ page }) => {
  await fakeBackend(page);
  await openThread(page);

  const card = page.getByTestId("message-build");
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute("href", "/b2/invoice-reader");
  await expect(card.getByTestId("message-build-title")).toHaveText(String(SHARED.title));
  await expect(card.locator('[data-visual-slot="plaque"]')).toHaveCount(1);
  await expect(card.getByTestId("reproduction-count")).toContainText("12");
  await expect(card.locator("img")).toHaveAttribute("src", /render\/image\/sign/);
  await expect(page.getByTestId("message-build-share").getByText(NOTE)).toBeVisible();
});

test("an old message whose link was emptied shows its words and no card", async ({ page }) => {
  await fakeBackend(page);
  await openThread(page);

  await expect(page.getByText(LEGACY_WORDS)).toBeVisible();
  await expect(page.getByText("Shared post")).toHaveCount(0);
  await expect(page.getByTestId("message-build")).toHaveCount(1);
});

test("sending a build writes a text message carrying the build and its note", async ({ page }) => {
  const backend = await fakeBackend(page);
  await openThread(page);

  const picker = await openPicker(page);
  await picker.getByTestId("reference-item").first().click();
  const note = page.getByPlaceholder("Add a note (optional)…");
  await note.fill("Worth a look.");
  await note.press("Enter");

  await expect.poll(() => backend.messageWrites.length).toBe(1);
  expect(backend.messageWrites[0].postDataJSON()).toMatchObject({
    thread_id: THREAD_ID,
    sender_id: ME.id,
    kind: "text",
    message_type: "text",
    shared_build_id: SAVED[0].build_id,
    body: "Worth a look.",
  });
  await expect
    .poll(() => backend.threadWrites.map((request) => request.postDataJSON()?.last_message_preview))
    .toContain("Shared a build");
});
