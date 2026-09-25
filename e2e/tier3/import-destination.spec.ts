// Tier 3 — EX-P10, the destination choice.
//
// WHAT THIS GUARDS. A waiting import can now go into a draft the creator
// already has, not only into a new build, and this is the one step in the
// connector's sequence that could damage work: a claim into an existing draft
// must ADD after what the draft holds and change nothing already in it, and a
// second claim of the same conversation into the same draft must add nothing
// at all. The unit tests beside imports.ts prove which calls are made; this
// proves what a creator's draft looks like afterwards, row by row.
//
// THE DATABASE IS AN IN-MEMORY POSTGREST, seeded per test — the same stub the
// EX-P09 spec uses, with one addition: a `builds` select that embeds
// build_nodes and build_events counts is answered as the real PostgREST
// answers it — the counts, when each embed names its build_id foreign key, and
// a PGRST201 refusal when it does not, because builds is joined to each of
// those tables more than one way (EX-P18-fix2). Writes change what later reads
// return, so the rows asserted on below are the rows the page wrote, not what
// the page claimed to write. It applies no row-level security, as an admin's
// session would not, so one creator's drafts are kept from another by the page
// itself — which is what the EX-P18-fix2 test holds it to.
//
// BOTH VIEWPORTS, SET PER TEST, as the EX-P09 spec does it. SELECTORS ARE
// ROLE, NAME AND data-testid: no `.ns-*` class, no Tailwind utility.

import { expect, test, type Page } from "@playwright/test";

const PROJECT_REF = "zybdotagjwektucfdkri";
const USER = "11111111-0000-4000-8000-000000000001";
const IMPORT = "aaaaaaaa-0000-4000-8000-000000000a01";
const SECOND_IMPORT = "aaaaaaaa-0000-4000-8000-000000000a02";
const DRAFT = "22222222-0000-4000-8000-000000000002";
const OLDER_DRAFT = "22222222-0000-4000-8000-000000000003";
const PUBLISHED = "22222222-0000-4000-8000-000000000004";
const GONE = "22222222-0000-4000-8000-000000000009";
/** Another creator, and two drafts of theirs. */
const OTHER_CREATOR = "99999999-0000-4000-8000-000000000001";
const THEIR_DRAFT = "22222222-0000-4000-8000-000000000011";
const THEIR_OTHER_DRAFT = "22222222-0000-4000-8000-000000000012";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * The compose frame stacks to one column below this and does not draw the
 * tray panel at a phone width, so what the workspace SHOWS is asserted at the
 * desktop width only; what the database HOLDS is asserted at both.
 */
const SINGLE_COLUMN_MAX = 900;

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

/** One import row as PostgREST would serve it for the panel's select. */
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
    expires_at: new Date(now + 5.5 * DAY).toISOString(),
    turn_count: proposal.summary.turn_count,
    event_count: proposal.summary.event_count,
    node_count: proposal.summary.node_count,
    detected_format: proposal.summary.detected_format,
    ...overrides,
  };
}

/** A build header with what the picker, the check and the workspace read. */
function buildRow(id: string, overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    id,
    creator_id: USER,
    slug: `build-${id.slice(-4)}`,
    title: "Untitled build",
    outcome: null,
    shape: "agent",
    status: "draft",
    made_for: [],
    made_with: [],
    live_url: null,
    repo_url: null,
    hero_node_id: null,
    cover_media_id: null,
    completeness: 0,
    reproduction_count: 0,
    last_confirmed_at: null,
    last_confirmed_model: null,
    parent_build_id: null,
    root_build_id: null,
    forked_from_event_id: null,
    published_at: null,
    created_at: new Date(now - 10 * DAY).toISOString(),
    updated_at: new Date(now - 10 * DAY).toISOString(),
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
  /** The id of every row any read handed to the page, in order. */
  served: string[];
  storage: string[];
}

/**
 * A creator with two drafts and a published build. "Inbox triage agent"
 * already holds work: one placed part, one part in the tray, and two steps in
 * its sequence — exactly the material a claim must leave alone.
 */
function seedDb(imports: Row[] = [importRow(IMPORT)]): Db {
  const now = Date.now();
  const stamp = new Date(now - 2 * DAY).toISOString();
  return {
    tables: {
      import_sessions: imports,
      builds: [
        buildRow(DRAFT, {
          title: "Inbox triage agent",
          slug: "inbox-triage-agent",
          // Between one and two days out reads as "last touched yesterday".
          updated_at: new Date(now - DAY - HOUR).toISOString(),
        }),
        buildRow(OLDER_DRAFT, {
          title: "Older notes",
          slug: "older-notes",
          updated_at: new Date(now - 5 * DAY - HOUR).toISOString(),
        }),
        buildRow(PUBLISHED, {
          title: "Shipped already",
          slug: "shipped-already",
          status: "published",
          published_at: new Date(now - 3 * DAY).toISOString(),
        }),
      ],
      build_nodes: [
        {
          id: "n-placed",
          build_id: DRAFT,
          parent_id: null,
          position: 0,
          type: "prompt",
          title: "Classify the email",
          note: null,
          payload: { text: "You are an inbox triage agent." },
          source_ref: null,
          event_id: null,
          is_gap: false,
          created_at: stamp,
          updated_at: stamp,
        },
        {
          id: "n-tray",
          build_id: DRAFT,
          parent_id: null,
          position: null,
          type: "code",
          title: "helper.py",
          note: null,
          payload: { code: "def helper(): ...", language: "python" },
          source_ref: null,
          event_id: null,
          is_gap: false,
          created_at: stamp,
          updated_at: stamp,
        },
      ],
      build_events: [
        {
          id: "e-1",
          build_id: DRAFT,
          ordinal: 1,
          kind: "prompt",
          occurred_at: null,
          payload: { text: "First ask, by hand" },
          phase: null,
          phase_title: null,
          visibility: "kept",
          produced_node_id: null,
          created_at: stamp,
        },
        {
          id: "e-2",
          build_id: DRAFT,
          ordinal: 2,
          kind: "milestone",
          occurred_at: null,
          payload: { text: "It routed its first inbox" },
          phase: null,
          phase_title: null,
          visibility: "kept",
          produced_node_id: null,
          created_at: stamp,
        },
      ],
      build_media: [],
      node_types: nodeTypes,
      profiles: [{ id: USER, username: "creator", display_name: "A creator", avatar_url: null }],
    },
    writes: [],
    served: [],
    storage: [],
  };
}

/**
 * A second creator with two drafts of their own, one already holding work,
 * both touched more recently than anything of the first creator's — so a list
 * that let them through would put them at its top.
 */
function addAnotherCreator(db: Db) {
  const now = Date.now();
  const stamp = new Date(now - HOUR).toISOString();
  db.tables.builds.push(
    buildRow(THEIR_DRAFT, {
      creator_id: OTHER_CREATOR,
      title: "Their private notes",
      slug: "their-private-notes",
      updated_at: new Date(now - HOUR).toISOString(),
    }),
    buildRow(THEIR_OTHER_DRAFT, {
      creator_id: OTHER_CREATOR,
      title: "Their unpublished agent",
      slug: "their-unpublished-agent",
      updated_at: new Date(now - 2 * HOUR).toISOString(),
    })
  );
  db.tables.build_nodes.push({
    id: "n-theirs",
    build_id: THEIR_DRAFT,
    parent_id: null,
    position: 0,
    type: "prompt",
    title: "Their first part",
    note: null,
    payload: { text: "Not yours to see." },
    source_ref: null,
    event_id: null,
    is_gap: false,
    created_at: stamp,
    updated_at: stamp,
  });
  db.tables.build_events.push({
    id: "e-theirs",
    build_id: THEIR_DRAFT,
    ordinal: 1,
    kind: "prompt",
    occurred_at: null,
    payload: { text: "Their first ask" },
    phase: null,
    phase_title: null,
    visibility: "kept",
    produced_node_id: null,
    created_at: stamp,
  });
  db.tables.profiles.push({
    id: OTHER_CREATOR,
    username: "someone-else",
    display_name: "Someone else",
    avatar_url: null,
  });
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

/**
 * PostgREST's answer to an embed from builds of build_nodes or build_events
 * that names no foreign key — bare, aliased, or with only a join modifier.
 * builds is joined to build_nodes three ways (a build's parts, its hero, the
 * gap it solves) and to build_events two (its steps, the event it was forked
 * from), so the real one refuses with PGRST201, as HTTP 300, before it reads a
 * row. Null when the select is one it can resolve.
 */
function refuseUnnamedEmbed(table: string, url: URL): Row | null {
  if (table !== "builds") return null;
  const select = url.searchParams.get("select") ?? "";
  const bare = /(?:^|[\s,:])(build_nodes|build_events)(?:!(?:inner|left))?\(/.exec(select);
  if (!bare) return null;
  return {
    code: "PGRST201",
    details: null,
    hint: null,
    message: `Could not embed because more than one relationship was found for 'builds' and '${bare[1]}'`,
  };
}

/**
 * The one embedding this step asks for — each draft's parts and steps, counted
 * through the build_id foreign keys — answered as PostgREST answers it: one
 * object holding the count, per row.
 */
function embedCounts(table: string, rows: Row[], url: URL, db: Db): Row[] {
  const select = url.searchParams.get("select") ?? "";
  if (table !== "builds") return rows;
  const parts = select.includes("build_nodes!build_nodes_build_id_fkey(count)");
  const steps = select.includes("build_events!build_events_build_id_fkey(count)");
  if (!parts && !steps) return rows;
  return rows.map((row) => ({
    ...row,
    ...(parts
      ? { build_nodes: [{ count: db.tables.build_nodes.filter((n) => n.build_id === row.id).length }] }
      : {}),
    ...(steps
      ? { build_events: [{ count: db.tables.build_events.filter((e) => e.build_id === row.id).length }] }
      : {}),
  }));
}

let nextId = 1;
const freshId = (prefix: string) =>
  `${prefix}-${String(nextId++).padStart(4, "0")}-4000-8000-000000000000`.slice(0, 36);

/** A signed-in creator on /compose/new, with the network stubbed and `db` as the truth. */
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

    const refusal = refuseUnnamedEmbed(table, url);
    if (refusal) return json(300, refusal);

    const matched = applyFilters(rows, url);
    const paged = embedCounts(table, orderAndPage(matched, url), url, db);
    const handedBack = method === "HEAD" ? [] : single ? paged.slice(0, 1) : paged;
    db.served.push(...handedBack.filter((row) => row.id !== undefined).map((row) => String(row.id)));
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

/** The arrival line the workspace greets an intake with. */
const arrival = (page: Page) => page.locator('[data-visual-slot="intake-arrival"]');

const STEP_TABLES = ["builds", "build_events", "build_nodes", "import_sessions"];
const stepWrites = (db: Db) => db.writes.filter((w) => STEP_TABLES.includes(w.table));
const rowFor = (page: Page, id: string) =>
  page.locator(`[data-testid="waiting-import"][data-import-id="${id}"]`);
const draftOption = (page: Page, id: string) =>
  page.locator(`[data-testid="import-destination-draft"][data-build-id="${id}"]`);

/** A copy that later writes cannot reach, for "unchanged" to mean unchanged. */
const snapshot = (rows: Row[]): Row[] => JSON.parse(JSON.stringify(rows));

/** Review → destination step, then choose the draft and continue to the tick boxes. */
async function reviewInto(page: Page, importId: string, draftId: string) {
  await rowFor(page, importId).getByRole("button", { name: "Review" }).click();
  await expect(page.getByTestId("import-destination")).toBeVisible();
  await page.getByTestId("import-destination-existing").check();
  await draftOption(page, draftId).click();
  await expect(draftOption(page, draftId)).toHaveAttribute("aria-checked", "true");
  await page.getByTestId("import-destination-continue").click();
  await expect(page.getByTestId("waiting-import-proposal")).toBeVisible();
}

for (const viewport of WIDTHS) {
  test.describe(`EX-P10 — the destination choice on /compose/new (${viewport.name})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
    });

    test("Review asks where it should go first, with a new build pre-selected and the drafts on offer", async ({
      page,
    }) => {
      const db = seedDb();
      await openIntake(page, db);

      await rowFor(page, IMPORT).getByRole("button", { name: "Review" }).click();

      const step = page.getByTestId("import-destination");
      await expect(step).toBeVisible();
      await expect(page.getByRole("heading", { name: "Where should it go?" })).toBeVisible();
      await expect(page.getByTestId("import-destination-source")).toHaveText(
        "From Claude Code, 2 steps and 1 part"
      );
      await expect(page.getByTestId("import-destination-new")).toBeChecked();
      await expect(page.getByTestId("import-destination-existing")).not.toBeChecked();
      // Nothing was asked for in the chat, so nothing is said about it.
      await expect(page.getByTestId("import-destination-note")).toHaveCount(0);
      // The drafts stay out of the way until the second option is chosen.
      await expect(page.getByTestId("import-destination-draft")).toHaveCount(0);

      await page.getByTestId("import-destination-existing").check();
      const drafts = page.getByTestId("import-destination-draft");
      // Drafts only, most recently worked on first, each with what it holds.
      await expect(drafts).toHaveCount(2);
      await expect(drafts.nth(0)).toContainText("Inbox triage agent");
      await expect(drafts.nth(0)).toContainText("last touched yesterday");
      await expect(drafts.nth(0)).toContainText("2 parts");
      await expect(drafts.nth(0)).toContainText("2 steps");
      await expect(drafts.nth(1)).toContainText("Older notes");
      await expect(drafts.nth(1)).toContainText("last touched 5 days ago");
      await expect(drafts.nth(1)).toContainText("0 parts");
      await expect(step).not.toContainText("Shipped already");
      // The first draft is the one offered until another is picked.
      await expect(draftOption(page, DRAFT)).toHaveAttribute("aria-checked", "true");

      expect(await overflowsX(page)).toBe(false);

      // Changing the answer back is one click, and Continue leads to the
      // tick-box screen exactly as before, with nothing written.
      await page.getByTestId("import-destination-new").check();
      await page.getByTestId("import-destination-continue").click();
      const review = page.getByTestId("waiting-import-proposal");
      await expect(review).toBeVisible();
      await expect(review).toContainText("Everything you keep lands in the tray, unplaced");
      await expect(page.getByTestId("waiting-import-confirm")).toHaveText("Add 3 to the draft");
      expect(stepWrites(db)).toHaveLength(0);
    });

    test("claiming into an existing draft adds after what is there, changes nothing already in it, and a second claim adds nothing", async ({
      page,
    }) => {
      const db = seedDb();
      const nodesBefore = snapshot(db.tables.build_nodes);
      const eventsBefore = snapshot(db.tables.build_events);
      const buildsBefore = snapshot(db.tables.builds);
      await openIntake(page, db);

      await reviewInto(page, IMPORT, DRAFT);

      // The tick-box screen is the same one, with one sentence changed.
      const review = page.getByTestId("waiting-import-proposal");
      await expect(review).toContainText(
        "Everything you keep is added to the tray of “Inbox triage agent”, alongside what is already there"
      );
      await expect(review).not.toContainText("lands in the tray, unplaced");
      await expect(page.getByTestId("waiting-import-confirm")).toHaveText("Add 3 to the draft");
      expect(stepWrites(db)).toHaveLength(0);

      await page.getByTestId("waiting-import-confirm").click();

      // The creator lands on the draft they chose, told what was added to it.
      await expect(page).toHaveURL(new RegExp(`/compose/${DRAFT}$`));
      await expect(arrival(page)).toContainText("Added to “Inbox triage agent”");
      await expect(arrival(page)).toContainText("1 item in the tray");
      await expect(arrival(page)).toContainText("2 prompts at the end of the sequence");

      // No build was created. The header is touched exactly once, and only by
      // EX-P14's provenance patch: a draft the creator had already started, now
      // joined by an import, is `mixed` and carries the id of what joined it.
      // Before EX-P14 this assertion was `toHaveLength(0)`; the write it now
      // allows is the one that step adds, and the two assertions below are what
      // keep "no build header was touched" true of everything else.
      const headerWrites = stepWrites(db).filter((w) => w.table === "builds");
      expect(headerWrites).toHaveLength(1);
      expect(headerWrites[0].method).toBe("PATCH");
      expect(headerWrites[0].body).toEqual({
        created_via: { source: "mixed", imports: [IMPORT] },
      });

      // Every other column of every build row is exactly as it was.
      const withoutProvenance = (rows: Row[]) =>
        rows.map(({ created_via: _created_via, ...rest }) => rest);
      expect(withoutProvenance(db.tables.builds)).toEqual(withoutProvenance(buildsBefore));

      // Every part and step the draft already held is still there, unchanged.
      for (const before of nodesBefore) {
        expect(db.tables.build_nodes.find((n) => n.id === before.id)).toEqual(before);
      }
      for (const before of eventsBefore) {
        expect(db.tables.build_events.find((e) => e.id === before.id)).toEqual(before);
      }

      // The new steps continue the draft's own numbering, after its two.
      const newEvents = db.tables.build_events.filter(
        (e) => !eventsBefore.some((b) => b.id === e.id)
      );
      expect(newEvents.map((e) => e.ordinal).sort()).toEqual([3, 4]);
      expect(newEvents.every((e) => e.build_id === DRAFT)).toBe(true);
      expect(newEvents.map((e) => (e.payload as { text: string }).text)).toEqual([
        "Build me an inbox triage agent",
        "Now add the calendar hand-off",
      ]);

      // The new part landed in the tray of that draft, carrying its provenance.
      const newNodes = db.tables.build_nodes.filter((n) => !nodesBefore.some((b) => b.id === n.id));
      expect(newNodes).toHaveLength(1);
      expect(newNodes[0]).toMatchObject({
        build_id: DRAFT,
        type: "code",
        title: "triage.py",
        position: null,
        source_ref: { session_id: IMPORT, local_id: "n1" },
      });

      // The import row is claimed and points at the draft it joined.
      const claimed = db.tables.import_sessions.find((r) => r.id === IMPORT)!;
      expect(claimed.status).toBe("claimed");
      expect(claimed.build_id).toBe(DRAFT);

      // The workspace shows the old tray part beside the new one.
      const tray = page.locator('[data-visual-slot="compose-tray"]');
      if (viewport.width >= SINGLE_COLUMN_MAX) {
        await expect(tray.getByTestId("tray-header")).toHaveText("Not placed yet · 2");
        await expect(tray.getByText("helper.py")).toBeVisible();
        await expect(tray.getByText("triage.py")).toBeVisible();
      }

      // THE SECOND CLAIM. The same import, waiting again, into the same draft:
      // the writer finds everything already written and adds nothing.
      claimed.status = "parsed";
      claimed.build_id = null;
      const nodeCount = db.tables.build_nodes.length;
      const eventCount = db.tables.build_events.length;
      const nodesAfterFirst = snapshot(db.tables.build_nodes);
      const eventsAfterFirst = snapshot(db.tables.build_events);

      await page.goto("/compose/new");
      await reviewInto(page, IMPORT, DRAFT);
      await page.getByTestId("waiting-import-confirm").click();

      await expect(page).toHaveURL(new RegExp(`/compose/${DRAFT}$`));
      await expect(arrival(page)).toContainText(
        "“Inbox triage agent” already held this conversation, so nothing was added."
      );
      expect(db.tables.build_nodes).toHaveLength(nodeCount);
      expect(db.tables.build_events).toHaveLength(eventCount);
      expect(db.tables.build_nodes).toEqual(nodesAfterFirst);
      expect(db.tables.build_events).toEqual(eventsAfterFirst);
      expect(db.tables.import_sessions.find((r) => r.id === IMPORT)?.status).toBe("claimed");
      if (viewport.width >= SINGLE_COLUMN_MAX) {
        await expect(tray.getByTestId("tray-header")).toHaveText("Not placed yet · 2");
      }
    });

    test("a draft named in the chat is pre-selected, said so, and can be changed", async ({ page }) => {
      const db = seedDb([importRow(IMPORT, { target_build_id: DRAFT })]);
      await openIntake(page, db);

      await rowFor(page, IMPORT).getByRole("button", { name: "Review" }).click();

      await expect(page.getByTestId("import-destination")).toBeVisible();
      await expect(page.getByTestId("import-destination-note")).toHaveText(
        "Claude Code sent this to your draft “Inbox triage agent”."
      );
      await expect(page.getByTestId("import-destination-existing")).toBeChecked();
      await expect(page.getByTestId("import-destination-new")).not.toBeChecked();
      await expect(draftOption(page, DRAFT)).toHaveAttribute("aria-checked", "true");
      await expect(draftOption(page, OLDER_DRAFT)).toHaveAttribute("aria-checked", "false");

      // The creator, not the chat, has the last word.
      await page.getByTestId("import-destination-new").check();
      await expect(page.getByTestId("import-destination-draft")).toHaveCount(0);
      await page.getByTestId("import-destination-continue").click();

      const review = page.getByTestId("waiting-import-proposal");
      await expect(review).toBeVisible();
      await expect(review).toContainText("Everything you keep lands in the tray, unplaced");
      expect(stepWrites(db)).toHaveLength(0);
    });

    test("a named draft that was published since, or is gone, falls back to a new build and says so", async ({
      page,
    }) => {
      const db = seedDb([
        importRow(IMPORT, { target_build_id: PUBLISHED }),
        importRow(SECOND_IMPORT, {
          client: "chatgpt",
          target_build_id: GONE,
          created_at: new Date(Date.now() - DAY).toISOString(),
        }),
      ]);
      await openIntake(page, db);

      await rowFor(page, IMPORT).getByRole("button", { name: "Review" }).click();
      await expect(page.getByTestId("import-destination-note")).toHaveText(
        "Claude Code sent this to a draft that has since been published, so it will start a new build instead."
      );
      await expect(page.getByTestId("import-destination-new")).toBeChecked();
      await expect(page.getByTestId("import-destination-existing")).not.toBeChecked();

      // Back leaves the import waiting, exactly as it was.
      await page.getByTestId("import-destination-back").click();
      await expect(page.getByRole("heading", { name: "Start a build" })).toBeVisible();
      await expect(page.getByTestId("waiting-import")).toHaveCount(2);
      expect(stepWrites(db)).toHaveLength(0);

      await rowFor(page, SECOND_IMPORT).getByRole("button", { name: "Review" }).click();
      await expect(page.getByTestId("import-destination-note")).toHaveText(
        "ChatGPT sent this to a draft that no longer exists, so it will start a new build instead."
      );
      await expect(page.getByTestId("import-destination-new")).toBeChecked();
      expect(await overflowsX(page)).toBe(false);
    });

    test("EX-P18-fix2: the picker offers the creator's own drafts, counted, and never another creator's", async ({
      page,
    }) => {
      const db = seedDb();
      addAnotherCreator(db);
      await openIntake(page, db);

      await rowFor(page, IMPORT).getByRole("button", { name: "Review" }).click();
      const step = page.getByTestId("import-destination");
      await expect(step).toBeVisible();
      // The drafts were read: no refusal, and the second option is open.
      await expect(page.getByTestId("import-destination-error")).toHaveCount(0);
      await page.getByTestId("import-destination-existing").check();

      // Exactly the signed-in creator's two drafts, most recently worked on
      // first, each with what it holds.
      const drafts = page.getByTestId("import-destination-draft");
      await expect(drafts).toHaveCount(2);
      await expect(drafts.nth(0)).toHaveAttribute("data-build-id", DRAFT);
      await expect(drafts.nth(0)).toContainText("2 parts");
      await expect(drafts.nth(0)).toContainText("2 steps");
      await expect(drafts.nth(1)).toHaveAttribute("data-build-id", OLDER_DRAFT);
      await expect(drafts.nth(1)).toContainText("0 parts");

      // Nothing of the other creator's is offered or named on the step, though
      // theirs are the most recently touched drafts in the database...
      await expect(draftOption(page, THEIR_DRAFT)).toHaveCount(0);
      await expect(draftOption(page, THEIR_OTHER_DRAFT)).toHaveCount(0);
      await expect(step).not.toContainText("Their private notes");
      await expect(step).not.toContainText("Their unpublished agent");
      // ...and no read handed either of them to the page at all.
      expect(db.served).not.toContain(THEIR_DRAFT);
      expect(db.served).not.toContain(THEIR_OTHER_DRAFT);
      expect(stepWrites(db)).toHaveLength(0);
      expect(await overflowsX(page)).toBe(false);
    });

    test("EX-P18-fix2b: someone else's draft never reaches the picker, even when the import row names it", async ({
      page,
    }) => {
      // The creator's own import row names another creator's draft. The
      // connector never stores such a target — it checks the caller owns it —
      // so this is a row edited by hand. The stub, like an admin's session,
      // hands that draft's header over when it is asked for by id: what keeps
      // it out of the picker is the page.
      const db = seedDb([importRow(IMPORT, { target_build_id: THEIR_DRAFT })]);
      addAnotherCreator(db);
      await openIntake(page, db);

      await rowFor(page, IMPORT).getByRole("button", { name: "Review" }).click();
      const step = page.getByTestId("import-destination");
      await expect(step).toBeVisible();

      // Answered exactly as a draft that no longer exists: nothing of theirs is
      // pre-selected, and a new build is the answer on offer.
      await expect(page.getByTestId("import-destination-note")).toHaveText(
        "Claude Code sent this to a draft that no longer exists, so it will start a new build instead."
      );
      await expect(page.getByTestId("import-destination-new")).toBeChecked();
      await expect(page.getByTestId("import-destination-existing")).not.toBeChecked();

      // The drafts on offer are the creator's own two, and only those.
      await page.getByTestId("import-destination-existing").check();
      const drafts = page.getByTestId("import-destination-draft");
      await expect(drafts).toHaveCount(2);
      await expect(drafts.nth(0)).toHaveAttribute("data-build-id", DRAFT);
      await expect(drafts.nth(1)).toHaveAttribute("data-build-id", OLDER_DRAFT);
      await expect(draftOption(page, THEIR_DRAFT)).toHaveCount(0);
      await expect(draftOption(page, THEIR_OTHER_DRAFT)).toHaveCount(0);
      await expect(step).not.toContainText("Their private notes");
      await expect(step).not.toContainText("Their unpublished agent");
      expect(stepWrites(db)).toHaveLength(0);
      expect(await overflowsX(page)).toBe(false);
    });
  });
}
