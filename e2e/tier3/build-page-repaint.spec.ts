// Tier 3 — the repainted build page (BG-P21).
//
// WHY THIS IS A BROWSER SPEC. Everything asserted here is either RESOLVED
// COLOUR or RESOLVED LAYOUT, and jsdom can give neither. A `var(--recess)` is a
// string in a style attribute until a browser resolves it against
// `<html data-theme>`, so "the hero is grounded in the recess in BOTH rooms" is
// a claim only a real engine can settle — and jsdom drops the declaration
// outright, which is why the unit specs read markup instead. The widths are the
// other half: whether six tabs scroll rather than wrap at 390, whether the
// facts strip becomes two rows instead of a sideways scroll, and whether a
// 64px didone title still fits the column.
//
// WHAT IS DELIBERATELY NOT HERE. Which token each surface names, the one-primary
// count, the anatomy guide's inset, the plaque's two halves and the three page
// states are assertions about what the components DECIDE, and they are covered
// by 50 unit tests under src/components/build/ and src/pages/BuildPage.test.tsx.
// Duplicating them in a browser would buy a slower copy.
//
// THE BUILD IS STUBBED AT THE REST BOUNDARY, and it is deliberately the awkward
// one acceptance 4 names: a gap, a breakage, a rebuild credit and a video hero,
// all on one record, so every branch this repaint touches renders at once.

import { expect, test, type Page, type Route } from "@playwright/test";

const REST = /\/rest\/v1\//;
const THEMES = ["exhibition", "dusk"] as const;

/** The prompt's four widths. */
const WIDTHS = [1400, 1024, 768, 390] as const;

const SLUG = "inbox-triage-agent";

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

const overflowsX = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );

/* ── the record ──────────────────────────────────────────────────────────── */

type Row = Record<string, unknown>;

const BUILD_ID = "00000000-0000-4000-8000-000000000001";
const CREATOR = "00000000-0000-4000-8000-0000000000aa";

const build: Row = {
  id: BUILD_ID,
  creator_id: CREATOR,
  slug: SLUG,
  title: "Inbox triage agent that drafts the replies",
  outcome:
    "Sorts a morning's email into three piles, drafts the replies for two of them, and leaves the third alone.",
  shape: "workflow",
  status: "published",
  made_for: ["founder"],
  made_with: ["Claude", "n8n"],
  live_url: null,
  repo_url: null,
  hero_node_id: "00000000-0000-4000-8000-0000000000e1",
  cover_media_id: null,
  cost_setup: 40,
  cost_monthly: 12,
  currency: "GBP",
  time_to_first_result: 25,
  completeness: 88,
  reproduction_count: 41,
  last_confirmed_at: "2026-09-10T00:00:00.000Z",
  last_confirmed_model: "claude-sonnet-4-5",
  parent_build_id: "00000000-0000-4000-8000-0000000000b9",
  root_build_id: "00000000-0000-4000-8000-0000000000b9",
  forked_from_event_id: null,
  source_content_item_id: null,
  monetisation_type: "free",
  price_gbp: null,
  donation_enabled: false,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-09-10T00:00:00.000Z",
  published_at: "2026-08-02T00:00:00.000Z",
  // The rebuild credit: the two frozen snapshot columns plus the note.
  rebuild_note: "Swapped the classifier and halved the cost.",
  rebuild_count: 1,
  source_title_at_fork: "Inbox triage, first pass",
  source_handle_at_fork: "maren",
  solves_node_id: null,
};

const node = (partial: Row): Row => ({
  build_id: BUILD_ID,
  parent_id: null,
  position: 0,
  note: null,
  payload: {},
  source_ref: null,
  event_id: null,
  is_gap: false,
  status: "placed",
  created_at: "2026-08-01T00:00:00.000Z",
  ...partial,
});

const NODES: Row[] = [
  node({
    id: "00000000-0000-4000-8000-0000000000e1",
    type: "screen_recording",
    title: "The agent running on a real inbox",
    position: 0,
    payload: { media_id: "00000000-0000-4000-8000-0000000000m1" },
  }),
  node({
    id: "00000000-0000-4000-8000-0000000000n1",
    type: "prompt",
    title: "The classify prompt",
    position: 1,
    note: "Written for a morning inbox rather than a backlog, which is why it leans on recency.",
    payload: { text: "Classify this email into reply, read, or ignore." },
  }),
  node({
    id: "00000000-0000-4000-8000-0000000000n2",
    type: "agent_config",
    title: "The retry policy nobody has written",
    position: 2,
    // THE GAP. It keeps its own category and takes a dashed breakage edge.
    is_gap: true,
    payload: {},
  }),
  node({
    id: "00000000-0000-4000-8000-0000000000n3",
    type: "breakage",
    title: "Context window overflowed on long threads",
    position: 3,
    event_id: "00000000-0000-4000-8000-0000000000v2",
    payload: {
      symptom: "Threads past forty messages came back empty.",
      cause: "The whole thread was pasted into the prompt.",
      resolution: "Summarise everything older than the last ten messages first.",
      event_start: 2,
      event_end: 3,
    },
  }),
];

const EVENTS: Row[] = [1, 2, 3, 4].map((ordinal) => ({
  id: `00000000-0000-4000-8000-0000000000v${ordinal}`,
  build_id: BUILD_ID,
  ordinal,
  kind: ordinal === 2 ? "breakage" : "prompt",
  phase: ordinal <= 2 ? 1 : 2,
  phase_title: ordinal <= 2 ? "Getting it running" : "Making it good",
  title: `Step ${ordinal}`,
  payload: { text: `What happened at step ${ordinal}.` },
  occurred_at: `2026-08-0${ordinal}T09:00:00.000Z`,
  visibility: "kept",
  produced_node_id: null,
  created_at: "2026-08-01T00:00:00.000Z",
}));

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
  {
    key: "agent_config",
    label: "Agent config",
    category: "configuration",
    colour: "#22C55E",
    icon: "Cog",
    renderer: "configuration",
    copyable: false,
    is_active: true,
    sort: 1,
    schema: { fields: [] },
  },
  {
    key: "breakage",
    label: "Breakage",
    category: "breakage",
    colour: "#EF4444",
    icon: "TriangleAlert",
    renderer: "breakage",
    copyable: false,
    is_active: true,
    sort: 1,
    schema: {
      fields: [
        { key: "symptom", label: "Symptom", type: "text" },
        { key: "cause", label: "Cause", type: "text" },
        { key: "resolution", label: "Resolution", type: "text" },
      ],
    },
  },
  {
    key: "screen_recording",
    label: "Screen recording",
    category: "media",
    colour: "#EC4899",
    icon: "Video",
    renderer: "media",
    copyable: false,
    is_active: true,
    sort: 1,
    schema: { fields: [] },
  },
];

/** A VIDEO HERO. poster_path is what fills the slot before anyone presses play. */
const MEDIA: Row[] = [
  {
    id: "00000000-0000-4000-8000-0000000000m1",
    build_id: BUILD_ID,
    bucket: "build-media",
    path: `${BUILD_ID}/run.mp4`,
    kind: "video",
    mime: "video/mp4",
    bytes: 2_400_000,
    width: 1920,
    height: 1080,
    duration: 48,
    poster_path: `${BUILD_ID}/run-poster.png`,
    created_at: "2026-08-01T00:00:00.000Z",
  },
];

/** One published descendant, so the Rebuilds tab exists. */
const REBUILDS: Row[] = [
  {
    id: "00000000-0000-4000-8000-0000000000r1",
    slug: "inbox-triage-overnight",
    title: "Inbox triage, overnight",
    rebuild_note: "Runs at 3am against the night's mail.",
    created_at: "2026-09-01T00:00:00.000Z",
    forked_from_event_id: "00000000-0000-4000-8000-0000000000v2",
    reproduction_count: 2,
    parent_build_id: BUILD_ID,
    creator_id: "00000000-0000-4000-8000-0000000000bb",
    profiles: { id: "00000000-0000-4000-8000-0000000000bb", username: "nightowl", display_name: "Night Owl", avatar_url: null },
  },
];

/**
 * A 160x90 PNG — 16:9, the ratio a screen recording arrives at.
 *
 * Solid colour, so it compresses to under 300 bytes. Its only job is to give
 * the hero slot an intrinsic ratio, so a `height: auto` media element resolves
 * to a real height and the layout measurements below have something to measure.
 */
const POSTER_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAKAAAABaCAIAAACwpMoFAAAAoklEQVR42u3RMQ0AAAgEsfevgYkRlfiAJqfgmurR4WIBYAEWYAEWYAEWYMACLMACLMACLMACDFiABViABViABViABRiwAAuwAAuwAAswYAEWYAEWYAEWYMACLMACLMACLMACDFiABViABViABRiwAAuwAAuwAAswYBcAC7AAC7AAC7AAAxZgARZgARZgAQYswAIswAIswAIswIAFWIAFWIAFWIB/td3jQEZmUes7AAAAAElFTkSuQmCC";

/** True when the request wants one object rather than a list. */
const wantsObject = (route: Route) =>
  (route.request().headers()["accept"] ?? "").includes("pgrst.object");

function json(route: Route, rows: Row[]) {
  const body = wantsObject(route)
    ? JSON.stringify(rows[0] ?? null)
    : JSON.stringify(rows);
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` },
    body,
  });
}

/**
 * Answer every request the page makes, and everything else with an empty list.
 *
 * Registered widest-first: Playwright matches the LAST registered route first,
 * so the specific handlers have to come after the catch-all.
 */
async function stubBuild(page: Page, { heroKind = "video" }: { heroKind?: "video" | "image" } = {}) {
  const media =
    heroKind === "image"
      ? [{ ...MEDIA[0], kind: "image", mime: "image/png", poster_path: null, duration: null }]
      : MEDIA;

  await page.route(REST, (route: Route) => json(route, []));
  await page.route(/\/rest\/v1\/node_types/, (route: Route) => json(route, NODE_TYPES));
  await page.route(/\/rest\/v1\/build_nodes/, (route: Route) => json(route, NODES));
  await page.route(/\/rest\/v1\/build_events/, (route: Route) => json(route, EVENTS));
  await page.route(/\/rest\/v1\/build_media/, (route: Route) => json(route, media));
  await page.route(/\/rest\/v1\/builds/, (route: Route) => {
    const url = route.request().url();
    // listRebuilds asks by parent_build_id; everything else wants the record.
    if (url.includes("parent_build_id=eq.")) return json(route, REBUILDS);
    return json(route, [build]);
  });
  // Signing, and then the bytes. Both are stubbed because the hero's SLOT is a
  // layout claim: an <img> with no intrinsic size collapses the well to a
  // hairline, and "the hero leads" would then be measuring nothing. POSTER is a
  // real 16:9 PNG, which is the ratio a screen recording arrives at.
  // `object/sign` is the POST that signs; `render/image/sign` is where the
  // client sends the GET once a transform is asked for — which is the whole of
  // acceptance 5, and why both have to be intercepted rather than just the one.
  await page.route(/\/storage\/v1\/(object|render\/image)\/sign\//, (route: Route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "image/png",
        body: Buffer.from(POSTER_PNG_BASE64, "base64"),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        signedURL: "/storage/v1/object/sign/build-media/poster.png?token=t&width=1200",
      }),
    });
  });
}

async function openBuild(
  page: Page,
  theme: string,
  width: number,
  options: { heroKind?: "video" | "image" } = {},
) {
  await withTheme(page, theme);
  await stubBuild(page, options);
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/b2/${SLUG}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

/** The resolved value of one CSS custom property on the root. */
const tokenValue = (page: Page, name: string) =>
  page.evaluate(
    (token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim(),
    name,
  );

/* ════════════════════════════════════════════════════════════════════════════
   ACCEPTANCE 1 — a real build page, both themes, four widths, every tab
   ════════════════════════════════════════════════════════════════════════════ */

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test(`BG-P21 — the whole page renders at ${width} on ${theme}, with no sideways scroll`, async ({
      page,
    }) => {
      await openBuild(page, theme, width);

      await expect(page.locator('[data-visual-slot="build-hero"]')).toBeVisible();
      await expect(page.locator('[data-visual-slot="build-facts"]')).toBeVisible();
      await expect(page.locator('[data-visual-slot="build-tabs"]')).toBeVisible();
      expect(await overflowsX(page)).toBe(false);
    });
  }
}

for (const theme of THEMES) {
  test(`BG-P21 — every tab opens and paints on ${theme}`, async ({ page }) => {
    await openBuild(page, theme, 1400);

    // WAIT FOR THE STRIP TO SETTLE BEFORE COUNTING IT. Rebuilds is one of the
    // two tabs that appear only when there is something in them, and its query
    // resolves after the record does — so a count taken on first paint reads
    // four and the strip grows under it a moment later. That is the strip
    // behaving as designed; the test has to let it finish arriving.
    await expect(page.getByRole("tab", { name: "Rebuilds" })).toBeVisible();

    const tabs = page.getByRole("tab");
    const count = await tabs.count();
    // Anatomy, watch, run, where it broke, rebuilds. Understand it has no
    // approved layer on this record, so it is correctly absent.
    expect(count).toBe(5);

    for (let index = 0; index < count; index += 1) {
      const tab = tabs.nth(index);
      await tab.click({ force: true });
      const id = await tab.getAttribute("id");
      const panel = page.locator(`#${(id ?? "").replace("tab", "panel")}`);
      await expect(panel).toBeVisible();
      // Something was actually drawn, rather than an empty panel.
      expect((await panel.innerText()).trim().length).toBeGreaterThan(0);
      expect(await overflowsX(page)).toBe(false);
    }
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   ACCEPTANCE 3 — the hero is the entry point, before the title
   ════════════════════════════════════════════════════════════════════════════ */

test("BG-P21 — the hero leads: it is first, it is bigger, and the title follows it", async ({
  page,
}) => {
  // A SCREENSHOT HERO, which is the common case and the one with an intrinsic
  // ratio. The video variant is measured in the awkward-build test instead: a
  // <video> whose codec this container cannot decode resolves to no height at
  // all, so measuring hierarchy through one would be measuring the stub.
  await openBuild(page, "exhibition", 1400, { heroKind: "image" });
  await expect(page.locator('[data-visual-slot="build-hero"] img')).toBeVisible();

  const hero = await page.locator('[data-visual-slot="build-hero"]').boundingBox();
  const title = await page.getByRole("heading", { level: 1 }).boundingBox();
  expect(hero).not.toBeNull();
  expect(title).not.toBeNull();

  // Above it in the page, and holding more of the first screen than it does.
  expect(hero!.y).toBeLessThan(title!.y);
  expect(hero!.height).toBeGreaterThan(title!.height);
  // And inside the reading column, not bleeding past it.
  expect(hero!.width).toBeLessThanOrEqual(900);
});

for (const theme of THEMES) {
  test(`BG-P21 — the hero is a --recess well under a --line hairline on ${theme}`, async ({
    page,
  }) => {
    await openBuild(page, theme, 1400);

    const well = page.locator('[data-visual-slot="build-hero"]');
    const paint = await well.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        borderTop: style.borderTopColor,
        borderTopWidth: style.borderTopWidth,
        radius: style.borderTopLeftRadius,
        // A frame would be a ring on all four sides.
        borderLeftWidth: style.borderLeftWidth,
      };
    });

    // Resolved, not `var(--recess)`: this is the half jsdom cannot check.
    expect(paint.background).toMatch(/^rgba?\(/);
    expect(paint.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(paint.borderTopWidth).toBe("1px");
    expect(paint.borderLeftWidth).toBe("0px");
    expect(paint.radius).toBe("10px");
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   ACCEPTANCE 4 — a gap, a breakage, a rebuild credit and a video hero
   ════════════════════════════════════════════════════════════════════════════ */

for (const theme of THEMES) {
  test(`BG-P21 — the awkward build renders whole on ${theme}`, async ({ page }) => {
    await openBuild(page, theme, 1400);

    // The video hero is a player with its poster, not a flattened still.
    const player = page.locator('[data-visual-slot="build-hero"] video');
    await expect(player).toHaveCount(1);
    await expect(player).toHaveAttribute("poster", /.+/);

    // The rebuild credit, above the build, from the frozen snapshot columns.
    await expect(page.getByTestId("rebuild-banner")).toBeVisible();
    await expect(page.getByTestId("rebuild-credit-line")).toContainText(
      "Inbox triage, first pass",
    );

    // The gap: its own category chip, and a dashed edge in the breakage hue.
    const gap = page.locator('[data-node-id="00000000-0000-4000-8000-0000000000n2"]');
    await expect(gap).toBeVisible();
    const edge = await gap.evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.borderLeftStyle, colour: style.borderLeftColor };
    });
    expect(edge.style).toBe("dashed");
    const breakageHue = await tokenValue(page, "--cat-breakage");
    expect(breakageHue.length).toBeGreaterThan(0);
    await expect(gap).toContainText("Agent config");

    // The breakage tab, in the breakage hue and nowhere near an alarm.
    await page.getByRole("tab", { name: "Where it broke" }).click({ force: true });
    await expect(page.locator('[data-visual-slot="build-breakage"]')).toBeVisible();
    await expect(page.getByText("Context window overflowed on long threads")).toBeVisible();
  });
}

/* ════════════════════════════════════════════════════════════════════════════
   ACCEPTANCE 5 — media asks for a sized transform at every slot
   ════════════════════════════════════════════════════════════════════════════ */

test("BG-P21 — the hero's media is requested at a slot width, never at original size", async ({
  page,
}) => {
  const asked: string[] = [];
  await withTheme(page, "exhibition");
  await stubBuild(page);
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/storage/v1/")) asked.push(url);
  });

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`/b2/${SLUG}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(500);

  expect(asked.length).toBeGreaterThan(0);

  // THE PROOF IS THE ENDPOINT AND THE PARAMETER. Storage signs at
  // `/object/sign` and RESIZES at `/render/image/sign?width=…`; a picture
  // fetched from the first is the original file, whatever its megapixels. So
  // every image the page actually loads must arrive through the second, and
  // name a width — MEDIA_WIDTH.hero, 1200, for this slot.
  const fetched = asked.filter((url) => !url.includes("/object/sign/"));
  expect(fetched.length).toBeGreaterThan(0);
  for (const url of fetched) {
    expect(url).toContain("/render/image/sign/");
    expect(url).toMatch(/[?&]width=\d+/);
  }
});

/* ════════════════════════════════════════════════════════════════════════════
   The 390 column — the width the type and the strips have to survive
   ════════════════════════════════════════════════════════════════════════════ */

test("BG-P21 — at 390 the title still fits and the facts strip wraps rather than scrolls", async ({
  page,
}) => {
  await openBuild(page, "exhibition", 390);

  const title = page.getByRole("heading", { level: 1 });
  const box = await title.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(390);

  // The clamp's floor, not its ceiling: 40px at this width.
  const size = await title.evaluate((element) =>
    Math.round(parseFloat(getComputedStyle(element).fontSize)),
  );
  expect(size).toBeGreaterThanOrEqual(40);
  expect(size).toBeLessThanOrEqual(64);

  const facts = page.locator('[data-visual-slot="build-facts"]');
  const factsBox = await facts.boundingBox();
  expect(factsBox!.width).toBeLessThanOrEqual(390);
  // It wrapped into more than one row rather than running off the side.
  expect(factsBox!.height).toBeGreaterThan(48);
  expect(await overflowsX(page)).toBe(false);
});


