/* UX-02: the build editor, in a real browser on the real composer.

     npx playwright test --config=playwright.audit.config.ts composer-ux02

   The page runs on the jsdom tests' faked backend (`src/lib/build/__audit__/fakeSupabase.ts`), answered from Node, as the SV-07
   recording does. The file store is not modelled there, so an upload is answered here. The draft is seeded with three sessions:
   Session 1 (two prompts), Session 2 (one prompt), Session 3 (empty), and one source file, `brief.md`. */

import { mkdirSync, readFileSync } from "node:fs";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { ACCESS_TOKEN, answer, MAKER_ID, REPO_SCHEMA, startAuditBackend, tableRows, type Fault } from "../../src/lib/build/__audit__/fakeSupabase";

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
async function open(page: Page, width = 1440, faults: Fault[] = [], height = 900) {
  startAuditBackend({ schema: REPO_SCHEMA, seed, faults });
  await page.setViewportSize({ width, height });
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

/**
 * A real file drop: a DataTransfer holding a file, dispatched on `target` at a point measured from `from` (default: the target) in
 * the same task, so the layout cannot move between the measure and the drop. `at` is "middle", an offset from `from`'s top left, or
 * `below`: that far under its bottom edge (negative: above it).
 */
async function dropFile(page: Page, target: Locator, at: "middle" | { dx: number; dy: number } | { dx: number; below: number } = "middle", options: { from?: Locator; name?: string; body?: string; type?: string } = {}) {
  const { name = "notes.md", body = "# Notes\n\nWhat the poster says.", type = "text/markdown" } = options;
  const on = await target.elementHandle();
  const from = await (options.from ?? target).elementHandle();
  await page.evaluate(
    ([element, measured, where, fileName, text, mime]) => {
      const box = (measured as Element).getBoundingClientRect();
      const point = where === "middle" ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : { x: box.left + where.dx, y: "below" in where ? box.bottom + where.below : box.top + where.dy };
      const transfer = new DataTransfer();
      transfer.items.add(new File([text], fileName, { type: mime }));
      for (const kind of ["dragenter", "dragover", "drop"]) (element as Element).dispatchEvent(new DragEvent(kind, { dataTransfer: transfer, clientX: point.x, clientY: point.y, bubbles: true, cancelable: true }));
    },
    [on, from, at, name, body, type] as const,
  );
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
    // Just under Session 1's last tile, inside the session (its add row stands there).
    await dropFile(page, page.getByTestId("build-list"), { dx: 40, below: 8 }, { from: card(page, IDS.p2) });
    await expect.poll(() => fileTiles().length, { timeout: 15_000 }).toBe(1);
    await expect.poll(() => inSession(KEY.a)).toEqual([IDS.p1, IDS.p2, fileTiles()[0].id]);
  });

  test("elsewhere on the List: a File step tile at the end of the current session", async ({ page }) => {
    await open(page);
    // The List's foot, under every session (the Add a session row).
    await dropFile(page, page.getByTestId("build-list"), { dx: 10, below: -4 });
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
    await dropFile(page, page.getByTestId("build-list"), "middle", { name: "conversations.json", body: JSON.stringify([{ mapping: {} }]), type: "application/json" });
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

/* ── P3: drag from Sources ── */

const SHOTS = "design/audits/composer/ux-02";
/** The fake backend's waiting session: in Available to add. */
const WAITING = "0e0e0e0e-0000-4000-8000-000000000001";
const sourceRow = (page: Page, dragId: string) => page.locator(`[data-source-drag="${dragId}"]`);
const listOrder = (page: Page) => page.getByTestId("build-list").locator("[data-session-key]").evaluateAll((els) => els.map((el) => el.getAttribute("data-session-key")));

/** Pick a row of Sources up by its grip and carry it to `to` (a point, or the middle of a locator); `beforeUp` runs while it is held. */
async function carry(page: Page, dragId: string, to: Locator | { x: number; y: number } | ((page: Page) => Promise<{ x: number; y: number }>), options: { hold?: number; beforeUp?: () => Promise<void>; up?: boolean } = {}) {
  const row = sourceRow(page, dragId);
  await row.scrollIntoViewIfNeeded();
  await row.hover();
  const grip = row.getByTestId("source-drag-handle");
  await expect(grip).toHaveCSS("opacity", "1");
  const from = await grip.boundingBox();
  if (!from) throw new Error("no grip");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2, { steps: 3 });
  const target = typeof to === "function" ? await to(page) : "x" in to ? to : await (async () => {
    const box = await to.boundingBox();
    if (!box) throw new Error("no target");
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  })();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  // Once more where it is, after the List has slid apart under it.
  const again = typeof to === "function" ? await to(page) : target;
  await page.mouse.move(again.x, again.y, { steps: 2 });
  if (options.hold) await page.waitForTimeout(options.hold);
  await options.beforeUp?.();
  if (options.up !== false) await page.mouse.up();
}

/** Between two boxes: the middle of the gap from `above`'s bottom to `below`'s top. */
const between = (above: Locator, below: Locator, dx = 60) => async () => {
  const a = await above.boundingBox();
  const b = await below.boundingBox();
  if (!a || !b) throw new Error("no boxes");
  return { x: a.x + dx, y: (a.y + a.height + b.y) / 2 };
};

test.describe("UX-02 P3 · drag from Sources onto the build", () => {
  test("B: a session row is picked up and dropped back on Sources with no write and no change", async ({ page }) => {
    await open(page);
    const before = { nodes: tableRows("build_nodes").length, sessions: tableRows("build_sessions").length, order: await listOrder(page) };
    await carry(page, `src-session:${WAITING}`, page.getByTestId("sources-panel"), {
      beforeUp: async () => {
        await expect(page.getByTestId("held-copy")).toBeVisible();
      },
    });
    await expect(page.getByTestId("held-copy")).toHaveCount(0, { timeout: 100 });
    await page.waitForTimeout(400);
    expect({ nodes: tableRows("build_nodes").length, sessions: tableRows("build_sessions").length, order: await listOrder(page) }).toEqual(before);
  });

  test("C: an Available session dragged between Sessions 1 and 2 is added there", async ({ page }) => {
    // Tall enough that the place is clear of the window's edge, where the drag scrolls the page under the pointer.
    await open(page, 1440, [], 1300);
    mkdirSync(SHOTS, { recursive: true });
    await carry(page, `src-session:${WAITING}`, between(session(page, KEY.a), session(page, KEY.b)), {
      hold: 300,
      beforeUp: async () => {
        await expect(page.getByTestId("incoming-slot")).toHaveCount(1);
        await page.screenshot({ path: `${SHOTS}/p3-held-session-1440.png` });
      },
    });
    await expect.poll(() => listOrder(page), { timeout: 20_000 }).toEqual([KEY.a, WAITING, KEY.b, KEY.c]);
    await expect.poll(() => tableRows("build_sessions").filter((row) => row.build_id === DRAFT).sort((x, y) => Number(x.position) - Number(y.position)).map((row) => row.session_key), { timeout: 10_000 }).toEqual([KEY.a, WAITING, KEY.b, KEY.c]);
  });

  test("C: a file row dragged into the gap after Session 1's first tile is a File step tile there", async ({ page }) => {
    await open(page);
    await carry(page, `src-file:${IDS.source}`, between(card(page, IDS.p1), card(page, IDS.p2)), {
      hold: 200,
      beforeUp: async () => {
        await expect(page.getByTestId("incoming-slot")).toHaveCount(1);
        await page.screenshot({ path: `${SHOTS}/p3-held-file-1440.png` });
      },
    });
    await expect.poll(() => fileTiles("brief.md").length, { timeout: 15_000 }).toBe(1);
    await expect.poll(() => inSession(KEY.a)).toEqual([IDS.p1, fileTiles("brief.md")[0].id, IDS.p2]);
  });

  test("C: a file row held on the middle of a step tile is attached inside it", async ({ page }) => {
    await open(page);
    // The middle of the tile as it stands once the List has made room: measured again after the first move.
    const middle = async () => {
      const box = await card(page, IDS.p1).boundingBox();
      if (!box) throw new Error("no tile");
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    await carry(page, `src-file:${IDS.source}`, middle, { hold: 900 });
    await expect.poll(() => tableRows("build_nodes").filter((row) => row.parent_id === IDS.p1 && (row.payload as Row).media_id === SOURCE_MEDIA).length, { timeout: 15_000 }).toBe(1);
    expect(fileTiles("brief.md")).toHaveLength(0);
  });

  test("C: Escape writes nothing, and the held copy is gone at once", async ({ page }) => {
    await open(page);
    const nodes = tableRows("build_nodes").length;
    await carry(page, `src-file:${IDS.source}`, between(card(page, IDS.p1), card(page, IDS.p2)), { up: false });
    await expect(page.getByTestId("held-copy")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("held-copy")).toHaveCount(0, { timeout: 100 });
    await expect(page.getByTestId("incoming-slot")).toHaveCount(0);
    await page.mouse.up();
    await page.waitForTimeout(500);
    expect(tableRows("build_nodes").length).toBe(nodes);
  });

  test("C: dropped outside the List, nothing is written and the held copy is gone at once", async ({ page }) => {
    await open(page);
    const nodes = tableRows("build_nodes").length;
    const header = await page.getByTestId("sandbox-heading").boundingBox();
    if (!header) throw new Error("no heading");
    await carry(page, `src-file:${IDS.source}`, { x: header.x + 20, y: header.y + 10 });
    await expect(page.getByTestId("held-copy")).toHaveCount(0, { timeout: 100 });
    await page.waitForTimeout(500);
    expect(tableRows("build_nodes").length).toBe(nodes);
  });

  test("C: with the add forced to fail, the build is as it was and the failure is said", async ({ page }) => {
    await open(page, 1440, [{ method: "POST", path: /^\/rest\/v1\/build_nodes/, answer: { status: 500, body: { code: "XX000", message: "forced" } } }]);
    await carry(page, `src-file:${IDS.source}`, between(card(page, IDS.p1), card(page, IDS.p2)), { hold: 200 });
    await expect(page.getByText("brief.md not added")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("incoming-slot")).toHaveCount(0, { timeout: 2_000 });
    expect(inSession(KEY.a)).toEqual([IDS.p1, IDS.p2]);
  });
});
