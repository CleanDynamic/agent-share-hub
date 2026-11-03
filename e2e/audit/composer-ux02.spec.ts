/* UX-02: the build editor, in a real browser on the real composer.

     npx playwright test --config=playwright.audit.config.ts composer-ux02

   The page runs on the jsdom tests' faked backend (`src/lib/build/__audit__/fakeSupabase.ts`), answered from Node, as the SV-07
   recording does. The file store is not modelled there, so an upload is answered here. The draft is seeded with three sessions:
   Session 1 (two prompts), Session 2 (one prompt), Session 3 (empty), and one source file, `brief.md`. */

import { readFileSync } from "node:fs";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { ACCESS_TOKEN, answer, MAKER_ID, REPO_SCHEMA, startAuditBackend, tableRows } from "../../src/lib/build/__audit__/fakeSupabase";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range, content-profile" };
const DRAFT = "0d0d0d0d-0000-4000-8000-000000000003";
const id = (n: number) => `0c2c2c2c-0000-4000-8000-${String(n).padStart(12, "0")}`;
const KEY = { a: "typed-ux02-a", b: "typed-ux02-b", c: "typed-ux02-c" } as const;
const IDS = { p1: id(1), p2: id(2), p3: id(3), source: id(9) } as const;
const SOURCE_MEDIA = "0f1f1f1f-0000-4000-8000-000000000001";

type Row = Record<string, unknown>;

function seed(rows: Record<string, Row[]>) {
  const build = rows.builds.find((row) => row.id === DRAFT) as Row;
  build.title = "UX-02 draft";
  build.making = {
    sessions_meta: { [KEY.a]: { tool: "claude-code", date: "2026-10-20" }, [KEY.b]: { tool: "claude-code", date: "2026-10-21" }, [KEY.c]: { tool: null, date: "2026-10-22" } },
    session_order: [KEY.a, KEY.b, KEY.c],
  };
  const node = (nodeId: string, position: number, type: string, payload: Row): Row => ({ id: nodeId, build_id: DRAFT, parent_id: null, position, type, title: null, note: null, payload, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-20T10:00:00Z" });
  rows.build_nodes.push(
    node(IDS.p1, 0, "prompt", { text: "Write the poster copy", session: KEY.a }),
    node(IDS.p2, 1, "prompt", { text: "Pick the poster colours", session: KEY.a }),
    node(IDS.p3, 2, "prompt", { text: "Write the menu", session: KEY.b }),
    node(IDS.source, 3, "document", { title: "brief.md", media_id: SOURCE_MEDIA }),
  );
  rows.build_sessions.push(
    { id: id(101), build_id: DRAFT, session_key: KEY.a, import_id: null, position: 0, collapsed: false, created_at: "2026-10-20T10:00:00Z" },
    { id: id(102), build_id: DRAFT, session_key: KEY.b, import_id: null, position: 1, collapsed: false, created_at: "2026-10-20T10:00:00Z" },
    { id: id(103), build_id: DRAFT, session_key: KEY.c, import_id: null, position: 2, collapsed: false, created_at: "2026-10-20T10:00:00Z" },
  );
}

function projectRef(): string {
  const env = process.env.VITE_SUPABASE_URL ?? readFileSync(".env", "utf8").match(/^\s*VITE_SUPABASE_URL\s*=\s*["']?(.+?)["']?\s*$/m)?.[1];
  if (!env) throw new Error("VITE_SUPABASE_URL is not set and .env does not define it.");
  return new URL(env).hostname.split(".")[0];
}

/** The composer on the seeded draft, signed in as the fake's maker, in Dusk. */
async function open(page: Page, width = 1440) {
  startAuditBackend({ schema: REPO_SCHEMA, seed });
  await page.setViewportSize({ width, height: 900 });
  const session = { access_token: "ux02", refresh_token: "ux02-refresh", token_type: "bearer", expires_in: 86400, expires_at: Math.floor(Date.now() / 1000) + 86400, user: { id: MAKER_ID, aud: "authenticated", role: "authenticated", email: "maker@example.test", app_metadata: {}, user_metadata: {}, created_at: "2026-08-01T00:00:00Z" } };
  await page.addInitScript(
    ([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
        window.localStorage.setItem("bg-theme", "dusk");
      } catch {
        /* the page draws without */
      }
    },
    [`sb-${projectRef()}-auth-token`, JSON.stringify(session)] as const,
  );
  await page.route(/\/(rest|auth|functions|storage)\/v1\//, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    // The file store is not modelled by the fake: an upload is taken as written.
    if (/\/storage\/v1\//.test(request.url())) return route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify({ Key: "build-media/x", Id: "x" }) });
    const headers = { ...request.headers() };
    const bearer = headers.authorization?.replace(/^Bearer\s+/i, "");
    if (bearer && bearer !== headers.apikey) headers.authorization = `Bearer ${ACCESS_TOKEN}`;
    const response = await answer(request.url(), { method: request.method(), headers, body: request.postData() ?? undefined });
    const body = Buffer.from(await response.arrayBuffer());
    await route.fulfill({ status: response.status, headers: { ...Object.fromEntries(response.headers), ...CORS }, body });
  });
  await page.goto(`/compose/${DRAFT}`);
  await expect(page.getByRole("group", { name: /^Session 1 · / })).toBeVisible({ timeout: 30_000 });
}

/** A real file drop: a DataTransfer holding a file, dropped at a point over `target`. */
async function dropFile(page: Page, target: Locator, at: { x: number; y: number } | "middle", name = "notes.md", body = "# Notes\n\nWhat the poster says.", type = "text/markdown") {
  const box = await target.boundingBox();
  if (!box) throw new Error("nothing to drop on");
  const point = at === "middle" ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : at;
  const data = await page.evaluateHandle(
    ([fileName, text, mime]) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([text], fileName, { type: mime }));
      return transfer;
    },
    [name, body, type] as const,
  );
  for (const kind of ["dragenter", "dragover", "drop"]) await target.dispatchEvent(kind, { dataTransfer: data, clientX: point.x, clientY: point.y, bubbles: true, cancelable: true });
}

const fileTiles = (name = "notes.md") => tableRows("build_nodes").filter((row) => row.build_id === DRAFT && row.type === "document" && (row.payload as Row).step === true && (row.payload as Row).title === name);
const inSession = (key: string) =>
  tableRows("build_nodes")
    .filter((row) => row.build_id === DRAFT && row.parent_id === null && (row.payload as Row).session === key)
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((row) => row.id);
const card = (page: Page, nodeId: string) => page.locator(`[data-node-id="${nodeId}"]`);
const session = (page: Page, key: string) => page.locator(`[data-session-key="${key}"]`);

test.describe("UX-02 P1 · a dropped file becomes a step tile", () => {
  test("on a step tile: attached inside that step", async ({ page }) => {
    await open(page);
    await dropFile(page, card(page, IDS.p1), "middle");
    await expect.poll(() => tableRows("build_nodes").filter((row) => row.parent_id === IDS.p1 && row.type === "document").length, { timeout: 15_000 }).toBe(1);
    expect(fileTiles()).toHaveLength(0);
  });

  test("on Session 2's head: a File step tile at its end", async ({ page }) => {
    await open(page);
    await dropFile(page, session(page, KEY.b).getByTestId("session-head"), "middle");
    await expect.poll(() => fileTiles().length, { timeout: 15_000 }).toBe(1);
    await expect.poll(() => inSession(KEY.b)).toEqual([IDS.p3, fileTiles()[0].id]);
    await expect(page.locator(`[data-node-id="${fileTiles()[0].id}"]`)).toBeVisible();
  });

  test("in the gap after a session's last tile: a File step tile there", async ({ page }) => {
    await open(page);
    const last = await card(page, IDS.p2).boundingBox();
    if (!last) throw new Error("no tile");
    // Just under Session 1's last tile, inside the session (its add row stands there).
    await dropFile(page, page.getByTestId("build-list"), { x: last.x + 40, y: last.y + last.height + 8 });
    await expect.poll(() => fileTiles().length, { timeout: 15_000 }).toBe(1);
    await expect.poll(() => inSession(KEY.a)).toEqual([IDS.p1, IDS.p2, fileTiles()[0].id]);
  });

  test("elsewhere on the List: a File step tile at the end of the current session", async ({ page }) => {
    await open(page);
    const list = await page.getByTestId("build-list").boundingBox();
    if (!list) throw new Error("no list");
    // The List's first line, above every session.
    await dropFile(page, page.getByTestId("build-list"), { x: list.x + 10, y: list.y + 2 });
    await expect.poll(() => fileTiles().length, { timeout: 15_000 }).toBe(1);
    expect((fileTiles()[0].payload as Row).session).toBeTruthy();
  });

  test("on Sources: a source file, not a step tile", async ({ page }) => {
    await open(page);
    await dropFile(page, page.getByTestId("sources-drop"), "middle");
    await expect.poll(() => tableRows("build_nodes").filter((row) => row.build_id === DRAFT && (row.payload as Row).title === "notes.md").length, { timeout: 15_000 }).toBe(1);
    expect(fileTiles()).toHaveLength(0);
  });

  test("a chat export still goes to the intake", async ({ page }) => {
    await open(page);
    await dropFile(page, page.getByTestId("build-list"), "middle", "conversations.json", JSON.stringify([{ mapping: {} }]), "application/json");
    await expect(page).toHaveURL(/\/compose\/start/, { timeout: 15_000 });
  });
});

test.describe("UX-02 P2 · a source file has a way into a session", () => {
  test("by the keys: open the menu, Add to session, Session 1, and a File step tile is there", async ({ page }) => {
    await open(page);
    const more = page.getByRole("button", { name: "brief.md options" });
    await more.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Add to session" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("menuitem", { name: /^Session 1 · / })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect.poll(() => fileTiles("brief.md").length, { timeout: 15_000 }).toBe(1);
    await expect.poll(() => inSession(KEY.a)).toEqual([IDS.p1, IDS.p2, fileTiles("brief.md")[0].id]);
  });
});
