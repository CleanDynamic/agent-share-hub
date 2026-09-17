// Tier 3 — EX-P09, waiting imports on the upload page.
//
// WHAT THIS GUARDS. A conversation the buildgallery connector parked on
// import_sessions has to be findable, reviewable and binnable from
// /compose/new, and confirming it has to land the creator on a draft holding
// exactly what they kept — through the SAME review surface and the SAME writer
// a pasted transcript uses. The unit tests beside imports.ts prove the order of
// the data-layer calls; this proves the page wires them to what a creator sees.
//
// THE DATABASE IS AN IN-MEMORY POSTGREST, seeded per test. This repo has one
// `.env`, pointing at one project, and nothing says it is a dev project — the
// position e2e/tier2/support/supabaseStub.ts takes, and compose-repaint.spec.ts
// after it. The stub here is small but REAL in the one way that matters for
// this step: writes change what later reads return. A claimed import stops
// being listed because the PATCH landed, not because the page hid it; the
// draft's events are read back from the rows the page inserted. Nothing
// reaches the network — an unknown table answers empty, never the project.
//
// BOTH VIEWPORTS, SET PER TEST. The `mobile` project in playwright.config.ts
// matches tier 1 only, so the phone is covered the way the other tier-3 specs
// do it: `setViewportSize` inside the desktop project. 1400 and 390 are two of
// the three widths the theme names for overflow.
//
// SELECTORS ARE ROLE, NAME AND data-testid. No `.ns-*` class, no Tailwind
// utility; the test ids were added to the new panel and passed through to the
// review surface's existing optional props, which is what they exist for.

import { expect, test, type Page } from "@playwright/test";

const PROJECT_REF = "zybdotagjwektucfdkri";
const USER = "11111111-0000-4000-8000-000000000001";
const IMPORT = "aaaaaaaa-0000-4000-8000-000000000a01";
const ROUGH_IMPORT = "aaaaaaaa-0000-4000-8000-000000000a02";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Desktop and phone. The phone width is the one the theme names for overflow. */
const WIDTHS = [
  { name: "desktop", width: 1400, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const session = {
  access_token: "stub-access-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "stub-refresh-token",
  user: {
    id: USER,
    aud: "authenticated",
    role: "authenticated",
    email: "creator@example.test",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  },
};

/** What the connector would have parked: two prompts and one code block. */
function proposalFor(sessionId: string) {
  return {
    events: [
      {
        ordinal: 1,
        kind: "prompt",
        visibility: "public",
        occurred_at: null,
        payload: { text: "Build me an inbox triage agent", response_summary: "Sketched the routing." },
        source_ref: { source: "transcript", session_id: sessionId, index: 1 },
        inferred: false,
        inferred_reason: null,
      },
      {
        ordinal: 2,
        kind: "prompt",
        visibility: "public",
        occurred_at: null,
        payload: { text: "Now add the calendar hand-off", response_summary: null },
        source_ref: { source: "transcript", session_id: sessionId, index: 3 },
        inferred: false,
        inferred_reason: null,
      },
    ],
    nodes: [
      {
        local_id: "n1",
        type: "code",
        title: "triage.py",
        note: null,
        payload: { code: "def triage(mail): ...", language: "python" },
        source_ref: { source: "transcript", session_id: sessionId, index: 2 },
        inferred: false,
        inferred_reason: null,
      },
    ],
    summary: {
      session_id: sessionId,
      source_hint: null,
      detected_format: "labelled",
      detected_labels: { user: ["You"], assistant: ["Claude"] },
      turn_count: 4,
      user_turn_count: 2,
      assistant_turn_count: 2,
      event_count: 2,
      node_count: 1,
      character_count: 1200,
      line_count: 40,
      proposed_title: null,
      proposed_outcome: null,
    },
    warnings: [],
  };
}

/**
 * One import row as PostgREST would return it for the panel's select — the
 * three counts and the format are JSON-path aliases in that select, so they
 * sit beside `proposal` on the served row exactly as the aliases would.
 */
function importRow(id: string, overrides: Record<string, unknown> = {}) {
  const proposal = proposalFor(id);
  const now = Date.now();
  return {
    id,
    user_id: USER,
    client: "claude-code",
    source_hint: null,
    fingerprint: null,
    content_hash: "deadbeef",
    status: "parsed",
    chunk_count: 1,
    expected_chunks: 1,
    total_chars: 1200,
    declared_turns: 4,
    declared_chars: 1200,
    reader_id: "transcript",
    detection_reason: "Split as labelled into 4 turns on You / Claude.",
    proposal,
    secret_findings: [],
    error: null,
    target_build_id: null,
    build_id: null,
    created_at: new Date(now - 3 * HOUR).toISOString(),
    updated_at: new Date(now - 3 * HOUR).toISOString(),
    // Five and a half days out reads as "expires in 6 days".
    expires_at: new Date(now + 5.5 * DAY).toISOString(),
    turn_count: proposal.summary.turn_count,
    event_count: proposal.summary.event_count,
    node_count: proposal.summary.node_count,
    detected_format: proposal.summary.detected_format,
    ...overrides,
  };
}

const nodeTypes = [
  {
    key: "prompt",
    label: "Prompt",
    category: "instruction",
    colour: null,
    icon: null,
    renderer: "instruction",
    copyable: true,
    is_active: true,
    sort: 1,
    schema: { fields: [{ key: "text", label: "Prompt text", type: "text", required: true }] },
  },
  {
    key: "code",
    label: "Code",
    category: "artefact",
    colour: null,
    icon: null,
    renderer: "artefact",
    copyable: true,
    is_active: true,
    sort: 2,
    schema: {
      fields: [
        { key: "code", label: "Code", type: "text", required: true },
        { key: "language", label: "Language", type: "string" },
      ],
    },
  },
];

type Row = Record<string, unknown>;

interface Db {
  tables: Record<string, Row[]>;
  /** Every non-GET the page issued, in order. */
  writes: { method: string; table: string; body: unknown }[];
  /** Storage calls the page issued, by path. */
  storage: string[];
}

function seedDb(): Db {
  return {
    tables: {
      import_sessions: [
        importRow(IMPORT),
        importRow(ROUGH_IMPORT, {
          client: "chatgpt",
          detection_reason: "uncertain: transcript bid 0.2 (no speaker convention), lovable bid 0.1 (not JSON).",
          created_at: new Date(Date.now() - 2 * DAY).toISOString(),
        }),
      ],
      builds: [],
      build_events: [],
      build_nodes: [],
      build_media: [],
      node_types: nodeTypes,
      profiles: [{ id: USER, username: "creator", display_name: "A creator", avatar_url: null }],
    },
    writes: [],
    storage: [],
  };
}

/* ───────────────────────── a small PostgREST ───────────────────────── */

function applyFilters(rows: Row[], url: URL): Row[] {
  let out = [...rows];
  for (const [key, value] of url.searchParams) {
    if (["select", "order", "limit", "offset", "or", "on_conflict", "columns"].includes(key)) continue;
    const dot = value.indexOf(".");
    const op = value.slice(0, dot);
    const want = value.slice(dot + 1);
    if (op === "not" && want === "is.null") out = out.filter((r) => r[key] !== null && r[key] !== undefined);
    else if (op === "eq") out = out.filter((r) => String(r[key]) === want);
    else if (op === "neq") out = out.filter((r) => String(r[key]) !== want);
    else if (op === "is") {
      if (want === "null") out = out.filter((r) => r[key] === null || r[key] === undefined);
      else if (want === "not.null") out = out.filter((r) => r[key] !== null && r[key] !== undefined);
    } else if (op === "in") {
      const list = want.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, ""));
      out = out.filter((r) => list.includes(String(r[key])));
    }
  }
  return out;
}

function orderAndPage(rows: Row[], url: URL): Row[] {
  const out = [...rows];
  const order = url.searchParams.get("order");
  if (order) {
    const [col, dir] = order.split(".");
    out.sort((a, b) => {
      const av = (a[col] ?? "") as string | number;
      const bv = (b[col] ?? "") as string | number;
      if (av === bv) return 0;
      return (av < bv ? -1 : 1) * (dir === "desc" ? -1 : 1);
    });
  }
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = url.searchParams.get("limit");
  return out.slice(offset, limit ? offset + Number(limit) : undefined);
}

let nextId = 1;
const freshId = (prefix: string) =>
  `${prefix}-${String(nextId++).padStart(4, "0")}-4000-8000-000000000000`.slice(0, 36);

/**
 * A signed-in creator on /compose/new, with the network stubbed and `db` as
 * the one source of truth for what PostgREST answers.
 */
async function openIntake(page: Page, db: Db) {
  await page.addInitScript(
    ([ref, value]) => {
      try {
        window.localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(value));
      } catch {
        /* a storage-less context is a harness problem, not an app bug */
      }
    },
    [PROJECT_REF, session] as const
  );

  await page.route(/\/auth\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) })
  );

  // The discard sweep lists and removes chunk objects. There are none left
  // after a successful parse, so both answer empty; the paths are recorded so
  // the spec can prove the sweep ran.
  await page.route(/\/storage\/v1\//, (route) => {
    const url = new URL(route.request().url());
    db.storage.push(`${route.request().method()} ${url.pathname}`);
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route(/\/rest\/v1\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.replace(/^.*\/rest\/v1\//, "").split("/")[0];
    const method = request.method();
    const accept = request.headers()["accept"] ?? "";
    const single = accept.includes("vnd.pgrst.object");
    const json = (status: number, body: unknown) =>
      route.fulfill({
        status,
        contentType: single ? "application/vnd.pgrst.object+json" : "application/json",
        headers: { "access-control-expose-headers": "content-range" },
        body: JSON.stringify(body),
      });

    const rows = (db.tables[table] ??= []);

    if (method === "POST") {
      let body: unknown = [];
      try {
        body = JSON.parse(request.postData() || "[]");
      } catch {
        body = [];
      }
      const inserted = (Array.isArray(body) ? body : [body]).map((r: Row) => ({
        id: freshId(table.slice(0, 8)),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...r,
      }));
      db.writes.push({ method, table, body });
      rows.push(...inserted);
      return json(201, single ? inserted[0] : inserted);
    }

    if (method === "PATCH") {
      let body: Row = {};
      try {
        body = JSON.parse(request.postData() || "{}");
      } catch {
        body = {};
      }
      db.writes.push({ method, table, body });
      const matched = applyFilters(rows, url);
      for (const row of matched) Object.assign(row, body);
      return json(200, single ? matched[0] ?? null : matched);
    }

    if (method === "DELETE") {
      const matched = applyFilters(rows, url);
      db.writes.push({ method, table, body: matched.map((r) => r.id) });
      db.tables[table] = rows.filter((r) => !matched.includes(r));
      return json(200, matched);
    }

    const matched = applyFilters(rows, url);
    const paged = orderAndPage(matched, url);
    const prefer = request.headers()["prefer"] ?? "";
    const headers: Record<string, string> = { "access-control-expose-headers": "content-range" };
    if (prefer.includes("count=") || method === "HEAD") {
      headers["content-range"] = `0-${Math.max(0, paged.length - 1)}/${matched.length}`;
    }
    return route.fulfill({
      status: 200,
      contentType: single ? "application/vnd.pgrst.object+json" : "application/json",
      headers,
      body: method === "HEAD" ? "" : JSON.stringify(single ? paged[0] ?? null : paged),
    });
  });

  await page.goto("/compose/new");
  await expect(page.getByRole("heading", { name: "Start a build" })).toBeVisible();
}

/** True when anything on the page reaches past the viewport horizontally. */
const overflowsX = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );

const panel = (page: Page) => page.getByTestId("waiting-imports");

/** The arrival line the workspace greets an intake with. */
const arrival = (page: Page) => page.locator('[data-visual-slot="intake-arrival"]');

/**
 * The writes this step is about. The app also heartbeats presence while a
 * signed-in creator is on the page, and that is not a write to a build or an
 * import.
 */
const STEP_TABLES = ["builds", "build_events", "build_nodes", "import_sessions"];
const stepWrites = (db: Db) => db.writes.filter((w) => STEP_TABLES.includes(w.table));
const rowFor = (page: Page, id: string) =>
  page.locator(`[data-testid="waiting-import"][data-import-id="${id}"]`);

for (const viewport of WIDTHS) {
  test.describe(`EX-P09 — waiting imports on /compose/new (${viewport.name})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
    });

    test("a parked import appears above the fold with its source, counts and expiry", async ({
      page,
    }) => {
      const db = seedDb();
      await openIntake(page, db);

      await expect(panel(page)).toBeVisible();
      await expect(page.getByTestId("waiting-imports-count")).toHaveText("2 conversations");
      await expect(page.getByTestId("waiting-import")).toHaveCount(2);

      const row = rowFor(page, IMPORT);
      await expect(row.getByTestId("waiting-import-source")).toContainText("From Claude Code");
      await expect(row.getByTestId("waiting-import-source")).toContainText("arrived 3 hours ago");
      await expect(row.getByTestId("waiting-import-counts")).toContainText("2 steps");
      await expect(row.getByTestId("waiting-import-counts")).toContainText("1 part");
      await expect(row.getByTestId("waiting-import-counts")).toContainText("1,200 characters");
      await expect(row.getByTestId("waiting-import-counts")).toContainText("expires in 6 days");
      await expect(row.getByRole("button", { name: "Review" })).toBeVisible();
      await expect(row.getByRole("button", { name: "Discard" })).toBeVisible();

      // The rougher-structure sentence appears only where routing was uncertain.
      await expect(row.getByTestId("waiting-import-rough")).toHaveCount(0);
      const rough = rowFor(page, ROUGH_IMPORT);
      await expect(rough.getByTestId("waiting-import-source")).toContainText("From ChatGPT");
      await expect(rough.getByTestId("waiting-import-rough")).toContainText(
        "structure may be rougher"
      );

      // Above the fold: the panel sits above the paste zone, and within the
      // first viewport at both widths.
      const panelBox = await panel(page).boundingBox();
      const pasteBox = await page.getByLabel("Paste the transcript").boundingBox();
      expect(panelBox && pasteBox && panelBox.y < pasteBox.y).toBe(true);
      expect(panelBox && panelBox.y < viewport.height).toBe(true);

      // Every existing way in is still on the page, untouched.
      await expect(page.getByLabel("Or paste a repository URL")).toBeVisible();
      await expect(page.getByTestId("import-drop")).toBeVisible();
      await expect(page.getByRole("button", { name: "Read it" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Start empty instead" })).toBeVisible();

      expect(await overflowsX(page)).toBe(false);
    });

    test("the panel renders nothing when nothing is waiting", async ({ page }) => {
      const db = seedDb();
      db.tables.import_sessions = [];
      await openIntake(page, db);

      await expect(panel(page)).toHaveCount(0);
      await expect(page.getByLabel("Paste the transcript")).toBeVisible();
    });

    test("Review opens the tick-box screen with everything kept, and Skip leaves it waiting", async ({
      page,
    }) => {
      const db = seedDb();
      await openIntake(page, db);

      await rowFor(page, IMPORT).getByRole("button", { name: "Review" }).click();

      const review = page.getByTestId("waiting-import-proposal");
      await expect(review).toBeVisible();
      await expect(page.getByRole("heading", { name: "Here is what it found" })).toBeVisible();
      await expect(page.getByTestId("import-source-line")).toHaveText(
        "From Claude Code, 2 steps and 1 part"
      );
      await expect(review.getByText("2 prompts in sequence")).toBeVisible();
      await expect(review.getByText("All kept", { exact: false })).toBeVisible();
      await expect(page.getByTestId("waiting-import-confirm")).toHaveText("Add 3 to the draft");

      // Nothing was created to reach the review.
      expect(stepWrites(db)).toHaveLength(0);

      await page.getByRole("button", { name: "Throw this away and start empty" }).click();

      // Back on the offer, and the import is still waiting — nothing was written.
      await expect(page.getByRole("heading", { name: "Start a build" })).toBeVisible();
      await expect(rowFor(page, IMPORT)).toBeVisible();
      expect(stepWrites(db)).toHaveLength(0);
      expect(db.tables.import_sessions.find((r) => r.id === IMPORT)?.status).toBe("parsed");
    });

    test("confirming creates the draft, writes what was kept, and lands on it", async ({
      page,
    }) => {
      const db = seedDb();
      await openIntake(page, db);

      await rowFor(page, IMPORT).getByRole("button", { name: "Review" }).click();
      await expect(page.getByTestId("waiting-import-proposal")).toBeVisible();

      // Untick the second prompt, so "kept" is a choice rather than a default.
      await page.getByRole("button", { name: "Show all 2" }).click();
      await page.getByRole("switch", { name: "Discard prompt 2" }).click();
      await expect(page.getByTestId("waiting-import-confirm")).toHaveText("Add 2 to the draft");

      await page.getByTestId("waiting-import-confirm").click();

      // The draft workspace, by way of the same arrival a paste gets.
      await expect(page).toHaveURL(/\/compose\/(?!new$)[^/]+$/);
      const buildId = new URL(page.url()).pathname.split("/").pop()!;
      await expect(arrival(page)).toContainText("1 item is in your tray");
      await expect(arrival(page)).toContainText("1 prompt is in the sequence");

      // The draft was created by createBuild, at confirm time, once.
      const builds = stepWrites(db).filter((w) => w.method === "POST" && w.table === "builds");
      expect(builds).toHaveLength(1);
      expect(builds[0].body).toMatchObject({ creator_id: USER, status: "draft", title: "Untitled build" });
      expect(db.tables.builds.map((b) => b.id)).toEqual([buildId]);

      // Exactly the kept event, carrying the import's id as its provenance.
      const events = db.tables.build_events.filter((e) => e.build_id === buildId);
      expect(events).toHaveLength(1);
      expect(events[0].payload).toMatchObject({
        text: "Build me an inbox triage agent",
        source_ref: { session_id: IMPORT, index: 1 },
      });
      const nodes = db.tables.build_nodes.filter((n) => n.build_id === buildId);
      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({ type: "code", title: "triage.py", position: null });

      // The import row is claimed and points at the build it went to.
      const claimed = db.tables.import_sessions.find((r) => r.id === IMPORT);
      expect(claimed?.status).toBe("claimed");
      expect(claimed?.build_id).toBe(buildId);

      // And it no longer waits: the other one does.
      await page.goto("/compose/new");
      await expect(page.getByTestId("waiting-import")).toHaveCount(1);
      await expect(rowFor(page, ROUGH_IMPORT)).toBeVisible();
    });

    test("Discard asks once, can be kept, and then removes the row", async ({ page }) => {
      const db = seedDb();
      await openIntake(page, db);

      const row = rowFor(page, IMPORT);
      await row.getByRole("button", { name: "Discard" }).click();

      const confirm = row.getByRole("group", { name: "Confirm discard" });
      await expect(confirm).toBeVisible();
      await expect(confirm).toContainText("Discard this conversation?");

      // Keeping it drops the question and writes nothing.
      await row.getByRole("button", { name: "Keep it" }).click();
      await expect(confirm).toHaveCount(0);
      await expect(row.getByRole("button", { name: "Review" })).toBeVisible();
      expect(stepWrites(db)).toHaveLength(0);

      await row.getByRole("button", { name: "Discard" }).click();
      await row.getByRole("button", { name: "Discard it" }).click();

      await expect(rowFor(page, IMPORT)).toHaveCount(0);
      await expect(page.getByTestId("waiting-import")).toHaveCount(1);
      await expect(page.getByTestId("waiting-imports-count")).toHaveText("1 conversation");

      // Expired in the database, not merely hidden; and the chunk folder swept.
      const binned = db.tables.import_sessions.find((r) => r.id === IMPORT);
      expect(binned?.status).toBe("expired");
      expect(stepWrites(db)).toHaveLength(1);
      expect(stepWrites(db)[0]).toMatchObject({ method: "PATCH", table: "import_sessions" });
      expect(db.storage.some((call) => call.includes(`/${USER}/${IMPORT}`) || call.includes("imports"))).toBe(
        true
      );

      // A reload agrees.
      await page.reload();
      await expect(page.getByTestId("waiting-import")).toHaveCount(1);
      await expect(rowFor(page, ROUGH_IMPORT)).toBeVisible();
    });
  });
}
