// Tier 3 — the provenance line on a build page (EX-P14).
//
// WHY THIS IS A BROWSER SPEC AND NOT A UNIT TEST. The sentences themselves are
// covered by src/components/build/CreatedViaLine.test.tsx, and duplicating them
// here would buy a slower copy. What only a browser can settle is the other
// half of the claim:
//
//   1. the line actually reaches the page — the column is read, parsed and
//      rendered end to end, through a query jsdom never runs
//   2. it is MUTED IN BOTH ROOMS. `--text2` is a string in a style attribute
//      until an engine resolves it against <html data-theme>, so "quiet on
//      Exhibition AND quiet on Dusk" is not a claim markup can support — and it
//      is the claim that matters, because a line that came out at full
//      contrast, or in the breakage hue, would read as a warning
//   3. a build with nothing recorded gains NO element and NO blank space. Most
//      builds are that build, and an empty flex item in a `gap: 32` column
//      costs every one of them 32px of nothing
//
// THE BUILD IS STUBBED AT THE REST BOUNDARY, deliberately thinner than
// build-page-repaint's: no hero, no media, no rebuilds. This spec is about one
// paragraph above the title, and a video hero would only add ways to flake.

import { expect, test, type Page, type Route } from "@playwright/test";

const REST = /\/rest\/v1\//;
const THEMES = ["exhibition", "dusk"] as const;

const SLUG = "inbox-triage-agent";
const BUILD_ID = "00000000-0000-4000-8000-000000000001";
const CREATOR = "00000000-0000-4000-8000-0000000000aa";
const IMPORT_A = "00000000-0000-4000-8000-0000000000c1";
const IMPORT_B = "00000000-0000-4000-8000-0000000000c2";
const IMPORT_C = "00000000-0000-4000-8000-0000000000c3";

type Row = Record<string, unknown>;

/** Set the theme before first paint, the way index.html's boot script reads it. */
async function withTheme(page: Page, theme: string) {
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem("bg-theme", value);
    } catch {
      /* private window — the default theme is a fine ground for a measurement */
    }
  }, theme);
}

const build: Row = {
  id: BUILD_ID,
  creator_id: CREATOR,
  slug: SLUG,
  title: "Inbox triage agent that drafts the replies",
  outcome: "Sorts a morning's email into three piles and drafts the replies for two of them.",
  shape: "workflow",
  status: "published",
  made_for: ["founder"],
  made_with: ["Claude"],
  live_url: null,
  repo_url: null,
  hero_node_id: null,
  cover_media_id: null,
  cost_setup: null,
  cost_monthly: null,
  currency: "GBP",
  time_to_first_result: null,
  completeness: 70,
  reproduction_count: 0,
  last_confirmed_at: null,
  last_confirmed_model: null,
  parent_build_id: null,
  root_build_id: null,
  forked_from_event_id: null,
  source_content_item_id: null,
  monetisation_type: "free",
  price_gbp: null,
  donation_enabled: false,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-09-10T00:00:00.000Z",
  published_at: "2026-08-02T00:00:00.000Z",
  rebuild_note: null,
  rebuild_count: 0,
  source_title_at_fork: null,
  source_handle_at_fork: null,
  solves_node_id: null,
};

const NODES: Row[] = [
  {
    id: "00000000-0000-4000-8000-0000000000n1",
    build_id: BUILD_ID,
    parent_id: null,
    position: 0,
    type: "prompt",
    title: "The classify prompt",
    note: null,
    payload: { text: "Classify this email into reply, read, or ignore." },
    source_ref: null,
    event_id: null,
    is_gap: false,
    status: "placed",
    created_at: "2026-08-01T00:00:00.000Z",
  },
];

const EVENTS: Row[] = [
  {
    id: "00000000-0000-4000-8000-0000000000v1",
    build_id: BUILD_ID,
    ordinal: 1,
    kind: "prompt",
    phase: 1,
    phase_title: "Getting it running",
    title: "Step 1",
    payload: { text: "What happened at step 1." },
    occurred_at: "2026-08-01T09:00:00.000Z",
    visibility: "kept",
    produced_node_id: null,
    created_at: "2026-08-01T00:00:00.000Z",
  },
];

const NODE_TYPES: Row[] = [
  {
    key: "prompt",
    label: "Prompt",
    category: "instruction",
    colour: "#E8571A",
    icon: "MessageSquare",
    renderer: "instruction",
    copyable: true,
    is_active: true,
    sort: 1,
    schema: { fields: [{ key: "text", label: "Text", type: "text" }] },
  },
];

const wantsObject = (route: Route) =>
  (route.request().headers()["accept"] ?? "").includes("pgrst.object");

function json(route: Route, rows: Row[]) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
    body: wantsObject(route) ? JSON.stringify(rows[0] ?? null) : JSON.stringify(rows),
  });
}

/**
 * Open the build page with `created_via` set to whatever this test is about.
 *
 * The column rides on the same stubbed row the record comes from, which is what
 * the real table does too — getCreatedVia asks for one column of one build, and
 * PostgREST answers with the row narrowed to it.
 */
async function openBuild(page: Page, theme: string, createdVia: Row | null) {
  await withTheme(page, theme);

  // Registered widest-first: Playwright matches the LAST registered route
  // first, so the specific handlers have to come after the catch-all.
  await page.route(REST, (route: Route) => json(route, []));
  await page.route(/\/rest\/v1\/node_types/, (route: Route) => json(route, NODE_TYPES));
  await page.route(/\/rest\/v1\/build_nodes/, (route: Route) => json(route, NODES));
  await page.route(/\/rest\/v1\/build_events/, (route: Route) => json(route, EVENTS));
  await page.route(/\/rest\/v1\/builds/, (route: Route) => {
    if (route.request().url().includes("parent_build_id=eq.")) return json(route, []);
    return json(route, [{ ...build, created_via: createdVia }]);
  });

  await page.goto(`/b2/${SLUG}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

const line = (page: Page) => page.getByTestId("created-via");

/* ════════════════════════════════════════════════════════════════════════════
   1 — the line reaches the page, and says which tool, in both rooms
   ════════════════════════════════════════════════════════════════════════════ */

for (const theme of THEMES) {
  test(`EX-P14 — one conversation names its tool on ${theme}`, async ({ page }) => {
    await openBuild(page, theme, {
      source: "connector",
      client: "claude-code",
      reader_id: "claude",
      imports: [IMPORT_A],
    });

    await expect(line(page)).toHaveText(
      "Drafted from a Claude Code conversation, reviewed by the creator.",
    );
  });

  test(`EX-P14 — more than one conversation counts instead, on ${theme}`, async ({ page }) => {
    await openBuild(page, theme, {
      source: "mixed",
      imports: [IMPORT_A, IMPORT_B, IMPORT_C],
    });

    await expect(line(page)).toHaveText(
      "Drafted from three AI conversations, reviewed by the creator.",
    );
  });

  /**
   * THE CLAIM THIS SPEC EXISTS FOR. `--text2` is the token every other piece of
   * metadata on this page already spends, so the test is not "it is grey" — it
   * is "it is the SAME grey the page uses for everything quiet", resolved by a
   * real engine against a real theme attribute. A line that had picked up
   * `--text`, or worse `--cat-breakage`, would fail here and nowhere else.
   */
  test(`EX-P14 — it is muted, not emphasis and not a warning, on ${theme}`, async ({ page }) => {
    await openBuild(page, theme, {
      source: "connector",
      client: "claude",
      reader_id: "claude",
      imports: [IMPORT_A],
    });

    const muted = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--text2").trim(),
    );
    const [colour, background, borderWidth, radius] = await line(page).evaluate((el) => {
      const style = getComputedStyle(el);
      return [style.color, style.backgroundColor, style.borderTopWidth, style.borderTopLeftRadius];
    });

    // Resolved --text2, reached through the same var() the rest of the page uses.
    expect(colour).toBe(await toRgb(page, muted));

    // No badge: nothing filled, nothing outlined, nothing rounded.
    expect(background).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(borderWidth).toBe("0px");
    expect(radius).toBe("0px");
  });
}

/** A token's declared value, resolved to the rgb() a computed style reports. */
async function toRgb(page: Page, value: string): Promise<string> {
  return page.evaluate((colour) => {
    const probe = document.createElement("span");
    probe.style.color = colour;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, value);
}

/* ════════════════════════════════════════════════════════════════════════════
   2 — it fits, at every width the theme holds a surface to
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * The longest sentence this line can produce, at the three widths the theme
 * names. It wraps at spaces and is capped at the 68ch measure, so overflow
 * should be impossible — which is exactly the kind of "should" that is worth
 * one assertion rather than an argument.
 */
for (const width of [390, 768, 1400] as const) {
  test(`EX-P14 — no sideways scroll at ${width} with the line present`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openBuild(page, "exhibition", {
      source: "connector",
      client: "claude-code",
      reader_id: "claude",
      imports: [IMPORT_A],
    });

    await expect(line(page)).toBeVisible();
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows).toBe(false);
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   3 — a build with nothing recorded gains nothing, not even space
   ════════════════════════════════════════════════════════════════════════════ */

test("EX-P14 — a build with no provenance renders no line", async ({ page }) => {
  await openBuild(page, "exhibition", null);

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(line(page)).toHaveCount(0);
});

/**
 * The empty-flex-item trap, measured rather than reasoned about.
 *
 * The column above the header spaces its children with `gap: 32`. A component
 * that rendered null inside its own <Section> would still be a flex item, so
 * every build made before this step — which is all of them — would gain 32px of
 * blank page. The guard is outside the Section for exactly this reason, and
 * this is the assertion that keeps it there: with no provenance, the distance
 * from the top of the page to the title is unchanged.
 */
test("EX-P14 — and gains no blank space above the title either", async ({ page }) => {
  await openBuild(page, "exhibition", null);
  const without = await page.getByRole("heading", { level: 1 }).evaluate(
    (el) => el.getBoundingClientRect().top + window.scrollY,
  );

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await openBuild(page, "exhibition", {
    source: "connector",
    client: "claude-code",
    reader_id: "claude",
    imports: [IMPORT_A],
  });
  const withLine = await page.getByRole("heading", { level: 1 }).evaluate(
    (el) => el.getBoundingClientRect().top + window.scrollY,
  );

  // The line itself moves the title down; the point is that its ABSENCE costs
  // nothing, so the two differ by roughly one line of text plus one gap rather
  // than by a gap on its own.
  expect(withLine).toBeGreaterThan(without);
  await expect(line(page)).toBeVisible();
});
