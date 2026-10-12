// UI-P64 — Sources in the new composer: adding a session from "Not in a build",
// and dropping a file, against the faked backend.
//
// THE SWITCH IS OFF IN THE SOURCE (SANDBOX_COMPOSER_ENABLED, until UI-P76), so
// the spec serves the flag module as `true` for this page only and touches
// nothing in the app. The first thing each test asserts is what was WRITTEN.

import { expect, test, type Page, type Request } from "@playwright/test";
import { ME } from "../audit/support/harness";
import { fakeBoundaries, json, uuid, type Row } from "./support/fakeBackend";

const BUILD_ID = uuid(7);
const MEDIA_ID = uuid(8);
const SESSION_1 = uuid(101);
const SESSION_2 = uuid(102);

const NODE_TYPES: Row[] = ["screenshot", "recording", "prompt", "document", "breakage", "gap"].map((key, at) => ({
  key,
  label: key,
  category: key === "prompt" ? "instruction" : "evidence",
  description: "",
  icon: null,
  schema: { fields: [] },
  sort: at + 1,
  is_active: true,
}));

const PROMPTS: Record<string, string[]> = {
  [SESSION_1]: ["Build me a script that renames photos by the date they were taken.", "Skip files with no EXIF date."],
  [SESSION_2]: ["My iPhone photos are HEIC. Make the script handle them too.", "Use the file's date for WhatsApp photos."],
};

const sessionRow = (id: string, over: Row = {}): Row => ({
  id,
  client: id === SESSION_1 ? "claude-code" : "claude",
  model: id === SESSION_1 ? "claude-sonnet-5-5" : "claude-opus-5-5",
  target_build_id: null,
  build_id: null,
  status: "parsed",
  created_at: id === SESSION_1 ? "2026-10-06T09:00:00.000Z" : "2026-10-05T09:00:00.000Z",
  first_prompt: PROMPTS[id][0],
  user_turns: PROMPTS[id].length,
  assistant_turns: PROMPTS[id].length,
  ...over,
});

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

interface Write {
  method: string;
  url: string;
  body: Row | null;
}

interface Backend {
  writes: Write[];
  nodes: () => Row[];
}

const bodyOf = (request: Request): Row | null => {
  try {
    return request.postDataJSON() as Row;
  } catch {
    return null;
  }
};

async function fakeBackend(page: Page, { sessions: seeded = [] }: { sessions?: Row[] } = {}): Promise<Backend> {
  const build: Row = { ...DRAFT };
  const nodes: Row[] = [];
  const sessions = seeded.map((row) => ({ ...row }));
  const writes: Write[] = [];
  let nextNode = 0;
  await fakeBoundaries(page);

  // The new composer is behind a switch that is off; this page alone has it on.
  await page.route(/\/src\/lib\/build\/flags\.ts/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: "export const SANDBOX_COMPOSER_ENABLED = true;\nexport const BUILD_PAGE_STEPS_ENABLED = false;\n",
    }),
  );

  const record = (request: Request) => {
    if (request.method() !== "GET" && request.method() !== "HEAD") {
      writes.push({ method: request.method(), url: decodeURIComponent(request.url()), body: bodyOf(request) });
    }
  };

  await page.route(/\/storage\/v1\/object\//, (route) => {
    record(route.request());
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Key: "build-media/x" }) });
  });

  await page.route(/\/rest\/v1\/builds(\?|$)/, (route) => {
    const request = route.request();
    record(request);
    if (request.method() === "PATCH") {
      Object.assign(build, bodyOf(request) ?? {});
      return json(route, [build]);
    }
    const url = decodeURIComponent(request.url());
    return url.includes(`id=eq.${BUILD_ID}`) || url.includes(`slug=eq.${build.slug}`) ? json(route, [build]) : json(route, []);
  });

  await page.route(/\/rest\/v1\/node_types/, (route) => json(route, NODE_TYPES));
  await page.route(/\/rest\/v1\/build_events/, (route) => json(route, []));

  await page.route(/\/rest\/v1\/build_nodes/, (route) => {
    const request = route.request();
    record(request);
    if (request.method() === "POST") {
      const body = request.postDataJSON() as Row | Row[];
      const rows = (Array.isArray(body) ? body : [body]).map((incoming) => {
        const row = { id: uuid(900 + nextNode++), created_at: "2026-10-06T09:00:00.000Z", title: null, note: null, source_ref: null, event_id: null, is_gap: false, ...incoming };
        nodes.push(row);
        return row;
      });
      return json(route, rows, 201);
    }
    if (request.method() !== "GET") return json(route, []);
    return json(route, [...nodes].sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0)));
  });

  await page.route(/\/rest\/v1\/import_sessions/, (route) => {
    const request = route.request();
    record(request);
    const url = decodeURIComponent(request.url());
    const id = url.match(/[?&]id=eq\.([^&]+)/)?.[1];
    const session = sessions.find((row) => row.id === id);
    if (request.method() === "PATCH") {
      if (!session || (url.includes("status=eq.parsed") && session.status !== "parsed")) return json(route, []);
      Object.assign(session, bodyOf(request) ?? {});
      return json(route, [{ id: session.id, client: session.client, reader_id: null, build_id: session.build_id }]);
    }
    if (url.includes("select=proposal")) return json(route, session ? [{ proposal: proposalOf(String(session.id)) }] : []);
    if (url.includes("select=id,status,build_id")) return json(route, session ? [{ id: session.id, status: session.status, build_id: session.build_id }] : []);
    const inBuild = url.match(/build_id=eq\.([^&]+)/)?.[1];
    if (inBuild) {
      return json(route, sessions.filter((row) => row.build_id === inBuild && row.status === "claimed").sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))));
    }
    if (url.includes("status=in.(parsed,claimed,expired)") && url.includes("proposal=not.is.null")) {
      return json(route, [...sessions].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
    }
    return json(route, sessions);
  });

  await page.route(/\/rest\/v1\/build_media/, (route) => {
    const request = route.request();
    record(request);
    if (request.method() === "POST") {
      const row = { id: MEDIA_ID, node_id: null, bucket: "build-media", poster_path: null, post_position: null, post_text: null, created_at: "2026-10-06T09:00:00.000Z", ...(bodyOf(request) ?? {}) };
      return json(route, [row], 201);
    }
    return json(route, []);
  });

  return { writes, nodes: () => nodes };
}

const writesTo = (backend: Backend, table: string, method?: string) =>
  backend.writes.filter((write) => write.url.includes(`/rest/v1/${table}`) && (!method || write.method === method));

const group = (page: Page, name: string) => page.getByRole("region", { name });

/** A drop of one file on the zone, as a mouse makes it. */
async function dropFile(page: Page, name: string, type: string, text: string) {
  const zone = page.getByTestId("sources-drop");
  const data = await page.evaluateHandle(
    ({ name, type, text }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([text], name, { type }));
      return transfer;
    },
    { name, type, text },
  );
  await zone.dispatchEvent("dragenter", { dataTransfer: data });
  await zone.dispatchEvent("dragover", { dataTransfer: data });
  await zone.dispatchEvent("drop", { dataTransfer: data });
}

test("Sources lists what is in the build and what is not, and opening writes nothing", async ({ page }) => {
  const backend = await fakeBackend(page, {
    sessions: [sessionRow(SESSION_1, { status: "claimed", build_id: BUILD_ID }), sessionRow(SESSION_2)],
  });
  await page.goto(`/compose/${BUILD_ID}`);

  const inBuild = group(page, "Sessions in this build");
  await expect(inBuild.getByTestId("source-session")).toHaveCount(1);
  await expect(inBuild.getByRole("button", { name: /^Session 1 · Claude Code/ })).toBeVisible();
  const waiting = group(page, "Not in a build");
  await expect(waiting.getByTestId("source-library")).toHaveCount(1);
  await expect(page.getByTestId("sources-count")).toHaveText("1 in build");
  await expect(page.getByTestId("sources-drop")).toHaveText("Drop sessions or files");
  await expect(group(page, "Files in this build")).toHaveCount(0);

  await page.waitForTimeout(1000);
  expect(backend.writes).toEqual([]);
});

test("+ on a session not in a build puts it into this draft, and it moves up", async ({ page }) => {
  const backend = await fakeBackend(page, {
    sessions: [sessionRow(SESSION_1, { status: "claimed", build_id: BUILD_ID }), sessionRow(SESSION_2)],
  });
  await page.goto(`/compose/${BUILD_ID}`);

  await group(page, "Not in a build").getByRole("button", { name: "Add session" }).click();

  await expect
    .poll(() => writesTo(backend, "import_sessions", "PATCH").find((write) => write.body?.status === "claimed")?.body)
    .toMatchObject({ status: "claimed", build_id: BUILD_ID });
  await expect(group(page, "Sessions in this build").getByTestId("source-session")).toHaveCount(2);
  await expect(group(page, "Not in a build")).toHaveCount(0);
  await expect(page.getByTestId("sources-count")).toHaveText("2 in build");
  // Nothing from the conversation is written into the build: no node, no prompt.
  expect(writesTo(backend, "build_nodes")).toHaveLength(0);
});

test("Add › Session lists the same sessions as a menu, and adds from it", async ({ page }) => {
  const backend = await fakeBackend(page, { sessions: [sessionRow(SESSION_2)] });
  await page.goto(`/compose/${BUILD_ID}`);

  await page.getByTestId("sandbox-add").click();
  await page.getByTestId("add-session").click();
  await page.getByRole("menuitem", { name: /Session · Opus 5\.5/ }).click();

  await expect
    .poll(() => writesTo(backend, "import_sessions", "PATCH").find((write) => write.body?.status === "claimed")?.body)
    .toMatchObject({ status: "claimed", build_id: BUILD_ID });
  await expect(group(page, "Sessions in this build").getByTestId("source-session")).toHaveCount(1);
});

test("dropping a file makes it a file of the build, stored through the media path", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto(`/compose/${BUILD_ID}`);
  await expect(page.getByText("No files yet.")).toBeVisible();

  await dropFile(page, "CLAUDE.md", "text/markdown", "# Stack\nNext.js");

  await expect(group(page, "Files in this build").getByTestId("source-file")).toHaveCount(1);
  await expect(group(page, "Files in this build").getByText("CLAUDE.md")).toBeVisible();
  await expect(group(page, "Files in this build").getByText("added by you")).toBeVisible();
  // The file went to storage, its record exists, and a file node points at it.
  expect(backend.writes.some((write) => write.url.includes("/storage/v1/object/build-media/"))).toBe(true);
  expect(writesTo(backend, "build_media", "POST")).toHaveLength(1);
  expect(writesTo(backend, "build_nodes", "POST")[0].body).toMatchObject({
    build_id: BUILD_ID,
    parent_id: null,
    position: 1,
    type: "document",
    payload: { title: "CLAUDE.md", media_id: MEDIA_ID },
  });
  await expect(page.getByTestId("sources-count")).toHaveText("1 in build");
});

test("Add › File opens the picker, and a chosen file is added the same way", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto(`/compose/${BUILD_ID}`);

  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("sandbox-add").click();
  await page.getByRole("menuitem", { name: /^File/ }).click();
  await (await chooser).setFiles({ name: "brief.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });

  await expect(group(page, "Files in this build").getByText("brief.pdf")).toBeVisible();
  expect(writesTo(backend, "build_nodes", "POST")[0].body).toMatchObject({ type: "document", payload: { title: "brief.pdf" } });
});

test("a dropped session export is not uploaded: the panel says where it is read", async ({ page }) => {
  const backend = await fakeBackend(page);
  await page.goto(`/compose/${BUILD_ID}`);

  await dropFile(page, "chat-export.json", "application/json", "{}");

  const note = page.getByTestId("sources-intake-note");
  await expect(note.getByRole("link", { name: "Read it in the intake" })).toHaveAttribute("href", "/compose/start");
  await page.waitForTimeout(800);
  expect(backend.writes).toEqual([]);
});
