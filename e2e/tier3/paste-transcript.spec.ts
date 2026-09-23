// Tier 3 — the paste path: a transcript pasted on /compose/new becomes a draft.
//
// WHAT THIS GUARDS. Critical path 13 in the e2e skill, "Intake: paste
// transcript → populated draft", which had no spec until EX-P16-fix. That step
// moved parse-transcript's and parse-lovable's parsers into
// supabase/functions/_shared/intake/parsers/ so the mcp function could bundle
// them, and this is the route the move had to leave exactly as it was: paste,
// Read it, review what was found, add it to the draft, and land on the draft
// with the prompts in the sequence and the parts in the tray.
//
// THE PARSERS ARE THE REAL ONES. The functions' HTTP shells are not run — they
// need a real Supabase — but their reading is. The stub for
// functions/v1/parse-transcript and functions/v1/parse-lovable answers with the
// parser module each function imports, called on the body the page actually
// sent. Only the shells' ownership check and hint trimming are mirrored. So a
// change to what either parser proposes for these inputs fails this spec, and
// so does a change to what the page sends it.
//
// THE DATABASE IS AN IN-MEMORY POSTGREST, seeded per test — the stub the
// EX-P09, EX-P10 and EX-P15 specs use. Writes change what later reads return,
// so the draft shows the rows the page actually wrote.
//
// THE EXCHANGE IS ATTACHED to every run: what the page sent, what the parser
// answered, what the review said and what was written, with generated ids and
// timestamps normalised. It is what a failure report needs, and comparing it
// across two runs is how EX-P16-fix showed the move changed nothing.
//
// BOTH VIEWPORTS, SET PER TEST, as the EX-P15 spec does it. The tray and the
// sequence are asserted at the desktop width, where the compose frame draws
// them.
//
// SELECTORS ARE ROLE, NAME, TEXT, data-testid AND data-visual-slot. No `.ns-*`
// class, no Tailwind utility.

import { writeFileSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { parseLovable } from "../../supabase/functions/_shared/intake/parsers/lovable.ts";
import { parseTranscript } from "../../supabase/functions/_shared/intake/parsers/transcript.ts";

const PROJECT_REF = "zybdotagjwektucfdkri";
const USER = "11111111-0000-4000-8000-000000000013";

/**
 * The session id a proposal carries. The real shells mint a fresh uuid per
 * call; one fixed here keeps the attached exchange comparable across runs.
 */
const SESSION = "5e551000-0000-4000-8000-000000000013";

/** The shells trim a hint to this many characters (index.ts in each parse function). */
const MAX_SOURCE_HINT_CHARS = 120;

/** The compose frame stacks to one column below this and does not draw the tray. */
const SINGLE_COLUMN_MAX = 900;

/** Desktop and phone. The phone width is the one the theme names for overflow. */
const WIDTHS = [
  { name: "desktop", width: 1400, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

/* ───────────────────────── what gets pasted ───────────────────────── */

/** The two things the person asked, verbatim. Each becomes a step. */
const PROMPTS = [
  "Build me a script that renames holiday photos by the date they were taken. Use gpt-4o with temperature: 0.2.",
  "It only prints the names. Make it rename them to YYYY-MM-DD.",
];

/** A ChatGPT-style paste: two turns each way, one fenced file, one model, one result. */
const TRANSCRIPT = [
  "You said:",
  PROMPTS[0],
  "",
  "ChatGPT said:",
  "Here is a first version.",
  "",
  "```python rename_photos.py",
  "from pathlib import Path",
  "for photo in Path('.').glob('*.jpg'):",
  "    print(photo.name)",
  "```",
  "",
  "You said:",
  PROMPTS[1],
  "",
  "ChatGPT said:",
  "Updated — it now reads the EXIF date and renames each file. It works now: 212 photos renamed.",
  "",
].join("\n");

/** A Lovable chat-exporter file pasted into the same box. It goes to parse-lovable instead. */
const LOVABLE_EXPORT = JSON.stringify(
  {
    exportedAt: "2026-08-20T18:04:11.522Z",
    url: "https://lovable.dev/projects/recipe-box-planner",
    messageCount: 4,
    messages: [
      { id: "umsg_01", role: "user", timestampText: "Aug 18, 2026, 9:12 AM", topPx: 120,
        contentHtml: "", contentText: "Build me a recipe box." },
      { id: "amsg_01", role: "ai", timestampText: "Aug 18, 2026, 9:13 AM", topPx: 340,
        contentHtml: "",
        contentText: "Done.\n\n```tsx src/components/RecipeCard.tsx\nexport const RecipeCard = () => null;\n```" },
      { id: "umsg_02", role: "user", timestampText: "Aug 18, 2026, 10:02 AM", topPx: 560,
        contentHtml: "", contentText: "Publish it." },
      { id: "amsg_02", role: "ai", timestampText: "Aug 18, 2026, 10:03 AM", topPx: 780,
        contentHtml: "", contentText: "Published. Your app is live at https://recipe-box-planner.lovable.app" },
    ],
  },
  null,
  2
);

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

/** The registry rows these two proposals land as, with their seeded schemas. */
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
    sort: 1,
    schema: {
      fields: [
        {
          key: "language",
          label: "Language",
          type: "enum",
          options: ["ts", "tsx", "js", "jsx", "python", "sql", "json", "yaml", "bash", "html", "css", "other"],
        },
        { key: "source", label: "Source", type: "text", required: true },
        { key: "filename", label: "Filename", type: "string" },
        { key: "entrypoint", label: "Entrypoint", type: "boolean" },
      ],
    },
  },
  {
    key: "result",
    label: "Result",
    category: "evidence",
    colour: null,
    icon: null,
    renderer: "evidence",
    copyable: false,
    is_active: true,
    sort: 1,
    schema: {
      fields: [
        { key: "summary", label: "Summary", type: "text", required: true },
        { key: "metric", label: "Metric", type: "string" },
        { key: "value", label: "Value", type: "string" },
      ],
    },
  },
  {
    key: "model_params",
    label: "Model parameters",
    category: "configuration",
    colour: null,
    icon: null,
    renderer: "configuration",
    copyable: true,
    is_active: true,
    sort: 1,
    schema: {
      fields: [
        { key: "model", label: "Model", type: "string", required: true },
        { key: "temperature", label: "Temperature", type: "number" },
        { key: "max_tokens", label: "Max tokens", type: "number" },
        { key: "top_p", label: "Top P", type: "number" },
        { key: "context_window", label: "Context window", type: "number" },
        { key: "seed", label: "Seed", type: "string" },
      ],
    },
  },
  {
    key: "live_app",
    label: "Live app",
    category: "artefact",
    colour: null,
    icon: null,
    renderer: "artefact",
    copyable: false,
    is_active: true,
    sort: 2,
    schema: {
      fields: [
        { key: "url", label: "URL", type: "string", format: "url", required: true },
        { key: "embeddable", label: "Embeddable", type: "boolean" },
        { key: "credentials_note", label: "Credentials note", type: "text" },
      ],
    },
  },
];

type Row = Record<string, unknown>;

interface Db {
  tables: Record<string, Row[]>;
  /** Every non-GET the page issued, in order. */
  writes: { method: string; table: string; body: unknown }[];
  /** Per test, so the ids a run mints do not depend on which worker ran it. */
  nextId: number;
}

function seedDb(): Db {
  return {
    tables: {
      import_sessions: [],
      builds: [],
      build_events: [],
      build_nodes: [],
      build_media: [],
      node_types: nodeTypes,
      profiles: [{ id: USER, username: "creator", display_name: "A creator", avatar_url: null }],
    },
    writes: [],
    nextId: 1,
  };
}

const freshId = (db: Db, prefix: string) =>
  `${prefix}-${String(db.nextId++).padStart(4, "0")}-4000-8000-000000000000`.slice(0, 36);

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

/* ───────────────────────── the two parser functions ───────────────────────── */

interface ParseCall {
  fn: string;
  body: Row;
  answer: unknown;
}

/** The CORS headers the parse functions' own shells send. */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * parse-transcript and parse-lovable, read by their real parsers. The shells'
 * lock is mirrored — a build the caller owns, or a 403 — and so is the hint
 * trimming; nothing else of the shells is.
 */
async function stubParsers(page: Page, db: Db, calls: ParseCall[]) {
  await page.route(/\/functions\/v1\/parse-(transcript|lovable)(\?|$)/, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 200, headers: corsHeaders });

    const fn = new URL(request.url()).pathname.split("/").pop() ?? "";
    let body: Row = {};
    try {
      body = JSON.parse(request.postData() || "{}");
    } catch {
      body = {};
    }
    const reply = (status: number, answer: unknown) => {
      calls.push({ fn, body, answer });
      return route.fulfill({
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(answer),
      });
    };

    const build = db.tables.builds.find((row) => row.id === body.build_id);
    if (!build || build.creator_id !== USER) {
      return reply(403, { error: "That build does not exist or is not yours to draft against." });
    }
    const options = {
      session_id: SESSION,
      source_hint:
        typeof body.source_hint === "string" ? body.source_hint.trim().slice(0, MAX_SOURCE_HINT_CHARS) : null,
    };
    const rawText = String(body.raw_text ?? "");
    return reply(200, fn === "parse-lovable" ? parseLovable(rawText, options) : parseTranscript(rawText, options));
  });
}

/** A signed-in creator on /compose/new, with the network stubbed and `db` as the truth. */
async function openIntake(page: Page, db: Db, calls: ParseCall[]) {
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

  await page.route(/\/storage\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await stubParsers(page, db, calls);

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
        id: freshId(db, table.slice(0, 8)),
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

/* ───────────────────────── the exchange ───────────────────────── */

const UUID_LIKE = /[0-9a-z]{6,8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Ids and timestamps the page or this stub mints differ on every run, so they
 * are renamed in order of first appearance and dropped respectively. A slug's
 * random suffix goes too. What is left is only what the parse decided and what
 * the page did with it.
 */
function normalise(value: unknown): unknown {
  const ids = new Map<string, string>();
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      return v.replace(UUID_LIKE, (id) => {
        if (!ids.has(id)) ids.set(id, `<id-${ids.size + 1}>`);
        return ids.get(id)!;
      });
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v)
          .filter(([key]) => key !== "created_at" && key !== "updated_at")
          .map(([key, x]) => [key, key === "slug" && typeof x === "string" ? x.replace(/-[a-z0-9]+$/, "-<suffix>") : walk(x)])
      );
    }
    return v;
  };
  return walk(value);
}

/** What the paste path writes. The frame's own presence heartbeat is not this route's. */
const INTAKE_TABLES = ["builds", "build_events", "build_nodes"];

/** What the running test has seen so far. Attached after it, passed or failed. */
interface Exchange {
  db: Db;
  calls: ParseCall[];
  review: string;
}
let exchange: Exchange | null = null;

function startExchange(): Exchange {
  exchange = { db: seedDb(), calls: [], review: "" };
  return exchange;
}

async function attachExchange(page: Page, testInfo: TestInfo) {
  if (!exchange) return;
  const { db, calls, review } = exchange;
  exchange = null;
  const landed = (await arrival(page).count()) > 0;
  const record = {
    calls,
    review,
    writes: db.writes.filter((write) => INTAKE_TABLES.includes(write.table)),
    landedOn: new URL(page.url()).pathname,
    arrival: landed ? await arrival(page).innerText() : "",
  };
  const file = testInfo.outputPath("exchange.json");
  writeFileSync(file, `${JSON.stringify(normalise(record), null, 2)}\n`);
  await testInfo.attach("exchange", { path: file, contentType: "application/json" });
}

/** The arrival line the workspace greets an intake with. */
const arrival = (page: Page) => page.locator('[data-visual-slot="intake-arrival"]');
const proposal = (page: Page) => page.locator('[data-visual-slot="intake-proposal"]');

for (const viewport of WIDTHS) {
  test.describe(`paste a transcript on /compose/new (${viewport.name})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
    });

    test.afterEach(async ({ page }, testInfo) => {
      await attachExchange(page, testInfo);
    });

    test("a pasted chat transcript is read, reviewed and lands in a new draft", async ({ page }) => {
      const seen = startExchange();
      const { db, calls } = seen;
      await openIntake(page, db, calls);

      await page.getByLabel("Paste the transcript").fill(TRANSCRIPT);
      await page.getByRole("button", { name: "Read it" }).click();

      // THE REVIEW. What the parser found, said the way the page says it.
      await expect(page.getByRole("heading", { name: "Here is what it found" })).toBeVisible();
      await expect(proposal(page)).toContainText("2 prompts · 1 code block · 1 model setting · 1 result · gpt-4o");
      await proposal(page).getByRole("button", { name: "Show all 2" }).click();
      for (const prompt of PROMPTS) await expect(proposal(page)).toContainText(prompt);

      // One read, of exactly what was pasted, against the draft made for it.
      expect(calls.map((call) => call.fn)).toEqual(["parse-transcript"]);
      expect(db.tables.builds).toHaveLength(1);
      const buildId = db.tables.builds[0].id as string;
      expect(calls[0].body).toEqual({ raw_text: TRANSCRIPT, build_id: buildId, source_hint: "pasted transcript" });
      seen.review = await proposal(page).innerText();

      // THE CLAIM. Everything kept: two prompts and three parts.
      await page.getByRole("button", { name: "Add 5 to the draft" }).click();
      await expect(page).toHaveURL(new RegExp(`/compose/${buildId}$`));
      await expect(arrival(page)).toContainText(
        "3 items are in your tray and 2 prompts are in the sequence — drag from the tray into the build to place them."
      );

      // Written: each prompt as a step, verbatim, and each part unplaced.
      const events = db.tables.build_events.filter((row) => row.build_id === buildId);
      expect(events.map((row) => (row.payload as { text: string }).text)).toEqual(PROMPTS);
      const nodes = db.tables.build_nodes.filter((row) => row.build_id === buildId);
      expect(nodes.map((row) => row.type).sort()).toEqual(["code", "model_params", "result"]);
      expect(nodes.every((row) => row.position === null)).toBe(true);

      // THE DRAFT. The tray holds the three parts and the sequence the two prompts.
      if (viewport.width >= SINGLE_COLUMN_MAX) {
        const tray = page.locator('[data-visual-slot="compose-tray"]');
        await expect(tray.getByTestId("tray-header")).toHaveText("Not placed yet · 3");
        await page.getByRole("tab", { name: "Sequence" }).click();
        // Scoped: the opening prompt is also the proposed outcome, which the
        // draft's header shows too.
        const sequence = page.getByRole("tabpanel", { name: "Sequence" });
        for (const prompt of PROMPTS) await expect(sequence.getByText(prompt, { exact: true })).toBeVisible();
      }
    });

    test("a pasted Lovable export goes to parse-lovable and lands the same way", async ({ page }) => {
      const seen = startExchange();
      const { db, calls } = seen;
      await openIntake(page, db, calls);

      await page.getByLabel("Paste the transcript").fill(LOVABLE_EXPORT);
      await page.getByRole("button", { name: "Read it" }).click();

      await expect(page.getByRole("heading", { name: "Here is what it found" })).toBeVisible();
      await proposal(page).getByRole("button", { name: "Show all 3" }).click();
      for (const step of ["Build me a recipe box.", "Publish it.", "Deployed to https://recipe-box-planner.lovable.app"]) {
        await expect(proposal(page)).toContainText(step);
      }

      // The Lovable parser read it, not the transcript one.
      expect(calls.map((call) => call.fn)).toEqual(["parse-lovable"]);
      expect(db.tables.builds).toHaveLength(1);
      const buildId = db.tables.builds[0].id as string;
      expect(calls[0].body).toEqual({ raw_text: LOVABLE_EXPORT, build_id: buildId, source_hint: "pasted Lovable export" });
      seen.review = await proposal(page).innerText();

      // Three steps (two prompts and a deploy) and two parts (the file and the live app).
      await page.getByRole("button", { name: "Add 5 to the draft" }).click();
      await expect(page).toHaveURL(new RegExp(`/compose/${buildId}$`));
      await expect(arrival(page)).toBeVisible();

      const events = db.tables.build_events.filter((row) => row.build_id === buildId);
      expect(events.map((row) => row.kind)).toEqual(["prompt", "prompt", "deploy"]);
      const nodes = db.tables.build_nodes.filter((row) => row.build_id === buildId);
      expect(nodes.map((row) => row.type).sort()).toEqual(["code", "live_app"]);
      expect(nodes.every((row) => row.position === null)).toBe(true);

      if (viewport.width >= SINGLE_COLUMN_MAX) {
        const tray = page.locator('[data-visual-slot="compose-tray"]');
        await expect(tray.getByTestId("tray-header")).toHaveText("Not placed yet · 2");
      }
    });
  });
}
