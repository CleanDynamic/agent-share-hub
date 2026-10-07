// UI-P47 / UI-P48 — the composer in the site frame: frame, media, text,
// prompts, your sessions, made with, publish.
//
// THE BACKEND IS FAKED (see support/fakeBackend.ts) with a small stateful
// builds / build_nodes / build_media / import_sessions. The first thing every
// test asserts is what was WRITTEN: opening /compose/new writes nothing, and
// the first change is what makes the draft.

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
  { key: "breakage", label: "Breakage", category: "narrative", description: "", icon: null, schema: { fields: [] }, sort: 4, is_active: true },
  { key: "gap", label: "Gap", category: "narrative", description: "", icon: null, schema: { fields: [] }, sort: 5, is_active: true },
];

/* ── UI-P48's sessions: the fixture's two, as import_sessions rows and their proposals ── */

const SESSION_1 = uuid(101);
const SESSION_2 = uuid(102);

const PROMPTS: Record<string, string[]> = {
  [SESSION_1]: [
    "Build me a script that renames photos by the date they were taken. Keep the original name in brackets.",
    "It says exiftool: command not found. What do I install?",
    "Skip files with no EXIF date and list them at the end.",
    "Run it on ~/Pictures/2024 and show me what changed.",
  ],
  [SESSION_2]: [
    "My iPhone photos are HEIC. Make the script handle them too.",
    "WhatsApp photos have no capture date. Use the file's date for those instead.",
  ],
};

/** An import_sessions row as the list's select reads it. */
const sessionRow = (id: string, over: Row = {}): Row => ({
  id,
  client: id === SESSION_1 ? "claude-code" : "claude",
  model: id === SESSION_1 ? "claude-sonnet-5-5" : "claude-opus-5-5",
  target_build_id: null,
  build_id: null,
  status: "parsed",
  created_at: id === SESSION_1 ? new Date().toISOString() : new Date(Date.now() - 86_400_000).toISOString(),
  first_prompt: PROMPTS[id][0],
  user_turns: PROMPTS[id].length,
  assistant_turns: PROMPTS[id].length,
  ...over,
});

/** The stored proposal: one prompt event per user turn, turns numbered across both speakers. */
const proposalOf = (id: string): Row => ({
  events: PROMPTS[id].map((text, at) => ({
    ordinal: at + 1,
    kind: "prompt",
    visibility: "kept",
    occurred_at: null,
    payload: { text, response_summary: null },
    source_ref: { source: "transcript", session_id: `proposal-${id}`, index: at * 2 + 1 },
    inferred: false,
    inferred_reason: null,
  })),
  nodes: [],
  warnings: [],
  summary: { session_id: `proposal-${id}`, proposed_title: null, user_turn_count: PROMPTS[id].length, assistant_turn_count: PROMPTS[id].length },
});

/** An existing draft of the signed-in creator's, for the tests that open /compose/{id}. */
const DRAFT: Row = {
  id: BUILD_ID,
  creator_id: ME.id,
  slug: "photo-renamer-k3f9x1",
  title: "Photo renamer by date taken",
  outcome: null,
  shape: "other",
  status: "draft",
  made_for: [],
  made_with: [],
  making: {},
  completeness: 0,
  reproduction_count: 0,
  parent_build_id: null,
  created_at: "2026-10-06T09:00:00.000Z",
  updated_at: "2026-10-06T09:00:00.000Z",
  published_at: null,
};

const placed = (id: string, position: number, over: Row = {}): Row => ({
  id,
  build_id: BUILD_ID,
  parent_id: null,
  position,
  type: "prompt",
  title: null,
  note: null,
  payload: {},
  source_ref: null,
  event_id: null,
  is_gap: false,
  created_at: "2026-10-06T09:00:00.000Z",
  ...over,
});

interface Seed {
  build?: Row;
  nodes?: Row[];
  sessions?: Row[];
}

interface Write {
  method: string;
  url: string;
  body: Row | null;
}

interface Backend {
  writes: Write[];
  build: () => Row | null;
  nodes: () => Row[];
}

const bodyOf = (request: Request): Row | null => {
  try {
    return request.postDataJSON() as Row;
  } catch {
    return null;
  }
};

async function fakeBackend(page: Page, { signedIn = true, seed = {} }: { signedIn?: boolean; seed?: Seed } = {}): Promise<Backend> {
  let build: Row | null = seed.build ? { ...seed.build } : null;
  const media: Row[] = [];
  const nodes: Row[] = (seed.nodes ?? []).map((row) => ({ ...row }));
  const sessions: Row[] = (seed.sessions ?? []).map((row) => ({ ...row }));
  const writes: Write[] = [];
  let nextNode = 0;
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
    if (build && (url.includes(`id=eq.${BUILD_ID}`) || url.includes(`slug=eq.${build.slug}`))) return json(route, [build]);
    return json(route, []);
  });

  await page.route(/\/rest\/v1\/node_types/, (route) => json(route, NODE_TYPES));
  await page.route(/\/rest\/v1\/build_events/, (route) => json(route, []));

  // Inserts and upserts (an `id` replaces that row), one row or an array of
  // them, deletes by id, and the reads the composer and the writer make.
  await page.route(/\/rest\/v1\/build_nodes/, (route) => {
    const request = route.request();
    record(request);
    const url = decodeURIComponent(request.url());
    if (request.method() === "POST") {
      const body = request.postDataJSON() as Row | Row[];
      const rows = (Array.isArray(body) ? body : [body]).map((incoming) => {
        const at = incoming.id ? nodes.findIndex((row) => row.id === incoming.id) : -1;
        if (at !== -1) {
          nodes[at] = { ...nodes[at], ...incoming };
          return nodes[at];
        }
        const row = { id: uuid(900 + nextNode++), created_at: "2026-10-06T09:00:00.000Z", title: null, note: null, source_ref: null, event_id: null, is_gap: false, ...incoming };
        nodes.push(row);
        return row;
      });
      return json(route, rows, 201);
    }
    if (request.method() === "DELETE") {
      const id = url.match(/id=eq\.([^&]+)/)?.[1];
      const at = nodes.findIndex((row) => row.id === id);
      if (at !== -1) nodes.splice(at, 1);
      return json(route, []);
    }
    if (request.method() !== "GET") return json(route, []);
    if (url.includes("position=is.null")) return json(route, []);
    const ids = url.match(/id=in\.\(([^)]*)\)/)?.[1]?.split(",");
    const rows = ids ? nodes.filter((row) => ids.includes(String(row.id))) : nodes;
    return json(route, [...rows].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0)));
  });

  // The sessions: the build's, the waiting ones, a proposal, the claim and a model.
  await page.route(/\/rest\/v1\/import_sessions/, (route) => {
    const request = route.request();
    record(request);
    const url = decodeURIComponent(request.url());
    const id = url.match(/[?&]id=eq\.([^&]+)/)?.[1];
    const session = sessions.find((row) => row.id === id);
    if (request.method() === "PATCH") {
      const body = bodyOf(request) ?? {};
      if (!session || (url.includes("status=eq.parsed") && session.status !== "parsed")) return json(route, []);
      Object.assign(session, body);
      return json(route, [{ id: session.id, client: session.client, reader_id: null, build_id: session.build_id }]);
    }
    if (url.includes("select=proposal")) return json(route, session ? [{ proposal: proposalOf(String(session.id)) }] : []);
    if (url.includes("select=id,status,build_id")) return json(route, session ? [{ id: session.id, status: session.status, build_id: session.build_id }] : []);
    const inBuild = url.match(/build_id=eq\.([^&]+)/)?.[1];
    if (inBuild) {
      return json(route, sessions.filter((row) => row.build_id === inBuild && row.status === "claimed").sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))));
    }
    if (url.includes("status=in.(parsed)")) return json(route, sessions.filter((row) => row.status === "parsed"));
    return json(route, sessions);
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

  return { writes, build: () => build, nodes: () => nodes };
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

/* ── UI-P48: prompts, your sessions, made with ── */

const promptField = (page: Page, n: number) => page.getByRole("textbox", { name: `Prompt ${n}`, exact: true });

test("+ on a session prompt writes a prompt node with where it came from, and shows added", async ({ page }) => {
  const backend = await fakeBackend(page, { seed: { build: DRAFT, sessions: [sessionRow(SESSION_1, { status: "claimed", build_id: BUILD_ID })] } });
  await page.goto(`/compose/${BUILD_ID}`);

  const sessions = page.getByTestId("compose-sessions");
  await expect(sessions.getByRole("button", { name: /^Session 1: Sonnet 5\.5, Today/ })).toHaveAttribute("aria-expanded", "true");
  const second = PROMPTS[SESSION_1][1];
  await sessions.getByRole("button", { name: `Add to prompts: ${second.slice(0, 60).trimEnd()}` }).click();

  await expect(page.getByText("Added as prompt 1.")).toBeVisible();
  const written = writesTo(backend, "build_nodes", "POST");
  expect(written).toHaveLength(1);
  expect(written[0].body).toMatchObject({
    build_id: BUILD_ID,
    type: "prompt",
    title: null,
    parent_id: null,
    position: 1,
    payload: { text: second, model: "Sonnet 5.5" },
    source_ref: { source: "transcript", index: 3, import_session_id: SESSION_1 },
  });
  // It is in Prompts, from session 1, and the session marks it added and offers no + for it.
  await expect(promptField(page, 1)).toHaveValue(second);
  await expect(page.getByTestId("compose-prompt").first()).toContainText("Session 1 · Sonnet 5.5");
  const row = sessions.getByTestId("session-prompt").nth(1);
  await expect(row).toHaveAttribute("data-added", "true");
  await expect(row).toContainText("added");
  await expect(row.getByRole("button")).toHaveCount(0);
});

test("write one adds an empty prompt, and writes nothing until it has words", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto("/compose/new");

  await page.getByRole("button", { name: "write one" }).click();
  await expect(promptField(page, 1)).toBeVisible();
  await expect(promptField(page, 1)).toHaveValue("");
  await expect(promptField(page, 1)).toBeFocused();
  await expect(page.getByTestId("compose-prompt")).toContainText("Written by you");
  await page.waitForTimeout(1200);
  expect(backend.writes).toEqual([]);

  // The first words make the draft, then the prompt.
  await page.keyboard.type("Now make it run every night.");
  await expect(page).toHaveURL(new RegExp(`/compose/${BUILD_ID}$`));
  await expect.poll(() => writesTo(backend, "build_nodes", "POST").length).toBe(1);
  expect(writesTo(backend, "build_nodes", "POST")[0].body).toMatchObject({
    build_id: BUILD_ID,
    type: "prompt",
    parent_id: null,
    position: 1,
    payload: { text: "Now make it run every night." },
    source_ref: null,
  });
  await expect(promptField(page, 1)).toBeFocused();
});

test("moving a prompt down swaps it with the next prompt through reorder, and leaves the cover where it is", async ({ page }) => {
  const COVER = uuid(31);
  const FIRST = uuid(32);
  const SECOND = uuid(33);
  const backend = await fakeBackend(page, {
    seed: {
      build: DRAFT,
      nodes: [
        placed(COVER, 1, { type: "screenshot", payload: { media_id: MEDIA_ID, caption: null } }),
        placed(FIRST, 2, { payload: { text: "Build me a script that renames photos." } }),
        placed(SECOND, 3, { payload: { text: "Skip files with no EXIF date." } }),
      ],
    },
  });
  await page.goto(`/compose/${BUILD_ID}`);

  await expect(promptField(page, 1)).toHaveValue("Build me a script that renames photos.");
  await expect(page.getByRole("button", { name: "Move prompt 1 up" })).toBeDisabled();
  await page.getByRole("button", { name: "Move prompt 1 down" }).click();

  await expect(promptField(page, 1)).toHaveValue("Skip files with no EXIF date.");
  await expect(promptField(page, 2)).toHaveValue("Build me a script that renames photos.");
  // reorderNodes: read the two rows, park them, then place them.
  const upserts = writesTo(backend, "build_nodes", "POST").map((write) => write.body as unknown as Row[]);
  expect(upserts).toHaveLength(2);
  const [parked, final] = upserts;
  expect(parked.every((row) => Number(row.position) < 0)).toBe(true);
  expect(final.map((row) => [row.id, row.position])).toEqual([
    [FIRST, 3],
    [SECOND, 2],
  ]);
  expect([...parked, ...final].some((row) => row.id === COVER)).toBe(false);
  expect(backend.nodes().find((row) => row.id === COVER)?.position).toBe(1);
});

test("+ Add a session claims it for this build and refreshes the stats", async ({ page }, testInfo) => {
  const backend = await fakeBackend(page, { seed: { build: DRAFT, sessions: [sessionRow(SESSION_2)] } });
  await page.goto(`/compose/${BUILD_ID}`);

  await expect(page.getByTestId("compose-sessions")).toContainText("No sessions in this build yet.");
  await page.getByRole("button", { name: "Add a session" }).click();
  if (testInfo.project.name === "mobile") {
    await page.getByRole("dialog", { name: "Add a session" }).getByRole("button", { name: /My iPhone photos are HEIC/ }).click();
  } else {
    await page.getByRole("menuitem", { name: /My iPhone photos are HEIC/ }).click();
  }

  await expect(page.getByText("Session added. Opus 5.5 is now under Made with.")).toBeVisible();
  const claim = writesTo(backend, "import_sessions", "PATCH").find((write) => write.body?.status === "claimed");
  expect(claim?.body).toMatchObject({ status: "claimed", build_id: BUILD_ID });
  const stats = writesTo(backend, "builds", "PATCH").find((write) => write.body && "session_count" in write.body);
  expect(stats?.body).toMatchObject({ session_count: 1, prompt_count: 2, ai_turn_count: 4, models_used: ["Opus 5.5"], made_with: ["Claude", "Opus 5.5"] });

  await expect(page.getByTestId("compose-sessions").getByRole("button", { name: /^Session 1: Opus 5\.5/ })).toBeVisible();
  await expect(page.getByTestId("made-with-chip")).toHaveText(["Claude · Opus 5.5"]);
});

test("Publish goes through once there is a title, a description, a cover and one prompt", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto("/compose/new");

  await page.getByLabel("Title").fill("Photo renamer by date taken");
  await expect(page).toHaveURL(new RegExp(`/compose/${BUILD_ID}$`));
  await page.getByLabel("Description").fill("Renames every photo in a folder to the date it was taken.");
  await page.getByTestId("compose-file").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("img", { name: "Cover" })).toBeVisible();
  await expect(page.getByTestId("compose-status")).toContainText("still needs a prompt");

  await page.getByRole("button", { name: "write one" }).click();
  await page.keyboard.type("Build me a script that renames photos by the date they were taken.");
  await expect(page.getByTestId("compose-status")).not.toContainText("still needs");
  await expect(publish(page)).toBeEnabled();

  await publish(page).click();
  await expect(page.getByTestId("compose-published")).toContainText("Published.");
  const live = writesTo(backend, "builds", "PATCH").find((write) => write.body?.status === "published");
  expect(live?.body).toMatchObject({ status: "published" });
  expect(backend.nodes().filter((row) => row.type === "prompt").map((row) => (row.payload as Row).text)).toEqual([
    "Build me a script that renames photos by the date they were taken.",
  ]);
});
