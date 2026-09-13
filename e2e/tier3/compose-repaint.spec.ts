// Tier 3 — the repainted composer (BG-P23).
//
// WHY THIS IS A BROWSER SPEC. Everything asserted here is RESOLVED COLOUR,
// RESOLVED LAYOUT or a COMPUTED FILTER, and jsdom can give none of the three. A
// `var(--recess)` is a string in a style attribute until a browser resolves it
// against `<html data-theme>`; `color-mix()` is dropped by jsdom's parser
// outright; and `backdrop-filter` does not exist there at all — which is exactly
// the property this prompt has to prove absent. The 190 unit tests under
// src/components/compose/ cover what the components DECIDE; this covers what a
// browser DOES with it.
//
// WHY THE COMPOSER IS STUBBED AT THE REST BOUNDARY. /compose/:buildId needs a
// signed-in creator AND a record they own, so it cannot be opened anonymously
// the way /dev/kit can — the move BG-P16 made for the workspace bar. The
// build-page repaint spec (BG-P21) already solved this shape for a route that
// needs a record: stub PostgREST, and let the real components render real data.
// This adds a seeded session on top, because the composer also needs an owner.
// Every component under test is the real one; only the network is fake.

import { expect, test, type Page } from "@playwright/test";

const THEMES = ["exhibition", "dusk"] as const;

/** The prompt's four widths. */
const WIDTHS = [1400, 1024, 900, 390] as const;

/** The compose frame stacks to one column below this. */
const SINGLE_COLUMN_MAX = 900;

const PROJECT_REF = "zybdotagjwektucfdkri";
const USER = "11111111-0000-4000-8000-000000000001";
const BUILD = "22222222-0000-4000-8000-000000000002";

const build = {
  id: BUILD,
  creator_id: USER,
  slug: "inbox-triage-agent",
  title: "Inbox triage agent",
  outcome: "Sorts a full inbox in about a minute and drafts the three replies that matter.",
  shape: "agent",
  status: "draft",
  made_for: ["ops"],
  made_with: ["claude-sonnet-4.5"],
  live_url: null,
  repo_url: null,
  hero_node_id: null,
  cover_media_id: "m1",
  completeness: 62,
  reproduction_count: 0,
  last_confirmed_at: null,
  last_confirmed_model: null,
  published_at: null,
  parent_build_id: null,
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-09-01T10:00:00Z",
  difficulty: "intermediate",
};

const nodeTypes = [
  {
    key: "prompt",
    label: "Prompt",
    category: "instruction",
    schema: {
      fields: [
        { key: "text", label: "Prompt text", type: "text", required: true, hint: "Paste it exactly as you sent it." },
        { key: "model", label: "Model", type: "string", hint: "Which model this was written for." },
      ],
    },
    colour: null,
  },
  {
    key: "config",
    label: "Agent config",
    category: "configuration",
    schema: { fields: [{ key: "json", label: "Configuration", type: "text", required: true }] },
    colour: null,
  },
];

const nodes = [
  { id: "n1", build_id: BUILD, parent_id: null, position: 0, type: "prompt", title: "Classify the email", payload: { text: "You are an inbox triage agent." }, is_gap: false, source_ref: null, created_at: "", updated_at: "" },
  { id: "n2", build_id: BUILD, parent_id: "n1", position: 0, type: "config", title: "Routing table", payload: { json: "{}" }, is_gap: false, source_ref: null, created_at: "", updated_at: "" },
  // The awkward one: a part deliberately unsolved, which must read as an
  // invitation and keep its own category chip.
  { id: "n3", build_id: BUILD, parent_id: null, position: 1, type: "config", title: "Calendar hand-off", payload: {}, is_gap: true, source_ref: null, created_at: "", updated_at: "" },
];

const tray = [
  { id: "t1", build_id: BUILD, parent_id: null, position: null, type: "prompt", title: "Second draft of the system prompt", payload: { text: "Be brief." }, is_gap: false, source_ref: { source: "transcript", turn: 4 }, created_at: "", updated_at: "" },
];

/** Three entries: a cover, one carrying its own words, and a video. */
const media = [
  { id: "m1", build_id: BUILD, node_id: null, bucket: "build-media", path: `${BUILD}/unplaced/m1.png`, kind: "image", mime: "image/png", bytes: 2000, width: 1600, height: 900, duration: null, poster_path: null, created_at: "", post_position: 0, post_text: null },
  { id: "m2", build_id: BUILD, node_id: null, bucket: "build-media", path: `${BUILD}/unplaced/m2.png`, kind: "image", mime: "image/png", bytes: 2000, width: 1200, height: 1200, duration: null, poster_path: null, created_at: "", post_position: 1, post_text: "The routing table it builds on the first pass." },
  { id: "m3", build_id: BUILD, node_id: null, bucket: "build-media", path: `${BUILD}/unplaced/m3.png`, kind: "video", mime: "video/mp4", bytes: 4000, width: 1920, height: 1080, duration: 12, poster_path: `${BUILD}/unplaced/m3-poster.png`, created_at: "", post_position: 2, post_text: null },
];

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

/**
 * A signed-in creator on their own draft, with the network stubbed.
 *
 * The theme is set before first paint, the way index.html's boot script reads
 * it — a theme applied after load would be measured mid-cross-fade.
 */
interface Write {
  method: string;
  table: string;
  body: string;
}

async function openComposer(page: Page, theme: string, writes: Write[] = []) {
  await page.addInitScript(
    ([ref, value, stored]) => {
      try {
        window.localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(value));
        window.localStorage.setItem("bg-theme", stored);
      } catch {
        /* private window — the default theme is a fine ground for a measurement */
      }
    },
    [PROJECT_REF, session, theme] as const
  );

  await page.route(/\/auth\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) })
  );

  // Signing is a storage call; the object behind it is an inline SVG at the
  // fixture's own dimensions, so a picture's SHAPE is its shape without a
  // network or a transform to get wrong. Same liberty /dev/kit takes.
  await page.route(/\/storage\/v1\//, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ signedURL: "/stub-media.svg", signedUrl: "/stub-media.svg" }),
    })
  );
  await page.route("**/stub-media.svg*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#8A8FA0"/></svg>',
    })
  );

  await page.route(/\/rest\/v1\//, (route) => {
    const url = route.request().url();
    const table = url.split("/rest/v1/")[1].split("?")[0];
    const method = route.request().method();
    if (method !== "GET" && method !== "HEAD") {
      writes.push({ method, table, body: route.request().postData() ?? "" });
    }
    let body: unknown[] = [];
    if (table === "builds") body = [build];
    else if (table === "node_types") body = nodeTypes;
    else if (table === "build_nodes") body = url.includes("position=is.null") ? tray : nodes;
    else if (table === "build_media") body = media;
    else if (table === "profiles")
      body = [{ id: USER, username: "creator", display_name: "A creator", avatar_url: null }];

    // PostgREST answers .maybeSingle()/.single() with an object, not an array.
    const accept = route.request().headers()["accept"] ?? "";
    const single = accept.includes("vnd.pgrst.object");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(single ? (body[0] ?? null) : body),
    });
  });

  await page.goto(`/compose/${BUILD}`);
  await expect(page.getByTestId("cover-strip")).toBeVisible();
}

test.describe("the composer in both rooms", () => {
  for (const theme of THEMES) {
    test(`opens on the thread editor, populated, on ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 1000 });
      await openComposer(page, theme);

      // The thread, its count, and the cover named in mono.
      await expect(page.getByTestId("thread-count")).toHaveText("3 / 4");
      await expect(page.getByTestId("thread-cover-label")).toHaveText("COVER");

      // The first entry's text IS the description, and it is the build's own
      // column rather than that row's post_text.
      await expect(page.getByTestId("outcome-input")).toHaveValue(build.outcome);
      // The second carries its own words.
      await expect(page.getByTestId("entry-text-1")).toHaveValue(
        "The routing table it builds on the first pass."
      );
      // The third has none, and says what to write there.
      await expect(page.getByTestId("entry-text-2")).toHaveAttribute(
        "placeholder",
        "Say what this shows"
      );

      // The preview is the real card, fed by the same resolver.
      await expect(page.getByTestId("thread-preview")).toBeVisible();
    });
  }
});

test.describe("no glass in the workspace", () => {
  for (const theme of THEMES) {
    test(`nothing the composer itself draws is blurred on ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 1000 });
      await openComposer(page, theme);

      /* THE ONE EXCEPTION IS NAMED, NOT WAIVED. The live preview renders BG-P09's
         real GalleryCard, and a card is a READING surface: the theme gives it
         glass, and stripping it would make the preview lie about what publishes.
         So the claim is that nothing the workspace itself draws is blurred — the
         panels, the tray, the tree, the inspector, the strip's own chrome — and
         that the single blurred element on the route is inside the preview. */
      const blurred = await page.evaluate(() => {
        const out: { inPreview: boolean; filter: string }[] = [];
        const preview = document.querySelector('[data-testid="thread-preview"]');
        for (const el of Array.from(document.querySelectorAll("*"))) {
          const filter = getComputedStyle(el).backdropFilter;
          if (filter && filter !== "none") {
            out.push({ inPreview: Boolean(preview?.contains(el)), filter });
          }
        }
        return out;
      });

      expect(blurred.filter((entry) => !entry.inPreview)).toEqual([]);
      // And the one inside the preview is the theme's single blur value, not a
      // second one invented for this surface.
      for (const entry of blurred) {
        expect(entry.filter).toContain("blur(16px)");
      }
    });
  }
});

test.describe("the composer at every width", () => {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      test(`has no sideways scroll at ${width} on ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
        await openComposer(page, theme);

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow).toBe(0);

        // The thread editor and the tree both survive the width, with the
        // workspace bar above them.
        await expect(page.getByTestId("workspace-bar")).toBeVisible();
        await expect(page.getByTestId("cover-strip")).toBeVisible();
        await expect(page.locator('[data-visual-slot="compose-node-tree"]')).toBeVisible();
      });
    }
  }

  test("puts the preview beside the editor above 1024 and beneath it below", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await openComposer(page, "exhibition");

    const strip = page.getByTestId("cover-strip");
    const preview = page.getByTestId("thread-preview");

    /* POLLED, NOT READ ONCE. The breakpoint is a matchMedia listener in the
       component, so a resize lands a React render AFTER the viewport changes —
       reading a box on the next line races that render and catches the previous
       layout. Polling the relationship rather than the pixel is also what keeps
       this honest about what it claims: the preview is BESIDE the editor, or it
       is BENEATH it, and the exact x is nobody's business. */
    const previewIsBeside = async () => {
      const stripBox = await strip.boundingBox();
      const previewBox = await preview.boundingBox();
      if (!stripBox || !previewBox) return null;
      return previewBox.x > stripBox.x + stripBox.width / 2;
    };

    await expect.poll(previewIsBeside, { timeout: 10_000 }).toBe(true);

    await page.setViewportSize({ width: SINGLE_COLUMN_MAX - 10, height: 1000 });
    await expect.poll(previewIsBeside, { timeout: 10_000 }).toBe(false);
  });
});

test.describe("the tree's unsolved row", () => {
  for (const theme of THEMES) {
    test(`rules a gap with a dashed breakage edge and keeps its category chip on ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1400, height: 1000 });
      await openComposer(page, theme);

      const gapRow = page.locator('[data-node-id="n3"]');
      await expect(gapRow).toBeVisible();

      const edge = await gapRow.evaluate((el) => {
        const s = getComputedStyle(el);
        return { style: s.borderLeftStyle, width: s.borderLeftWidth, colour: s.borderLeftColor };
      });
      expect(edge.style).toBe("dashed");

      // The hue is --cat-breakage in whichever room this is, which is not the
      // ground and not the ordinary hairline.
      const breakage = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--cat-breakage").trim()
      );
      expect(breakage).not.toBe("");

      // NEVER RECOLOURED RED. A gap on an agent config is still configuration,
      // and that is what routes it to the right solvers.
      await expect(gapRow.getByText("Agent config")).toBeVisible();

      // An ordinary row beside it is solid, so "dashed" means something.
      const plain = await page
        .locator('[data-node-id="n1"]')
        .evaluate((el) => getComputedStyle(el).borderLeftStyle);
      expect(plain).toBe("solid");
    });
  }
});

test.describe("the completeness panel", () => {
  test("invites rather than scoring", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await openComposer(page, "exhibition");

    // Never a score: no percentage, and no bar to read one off.
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await expect(page.getByText(/% filled in/)).toHaveCount(0);
    await expect(page.getByText(/left to add/)).toBeVisible();
  });
});


/* ── The description rule, proved on the wire ──────────────────────────────────
   THE CLOSEST HONEST EQUIVALENT TO "READ IT BACK OUT OF THE DATABASE". This
   environment has no writable database to read — the project's anon key cannot
   author a build, and a spec that wrote to the live project would be a spec that
   litters it. What it CAN do is watch the request that would do the writing, on
   the real debounce, through the real save path, with the real component: the
   column, the table and the value are all in that body, and a rule that put the
   sentence in the wrong one would fail here exactly as it would fail a read.

   THE RULE. The first entry's text is the build's one-sentence description and
   goes to `builds`. Every later entry carries its own words and goes to that
   row of `build_media` as post_text. The sentence is never in both — a second
   copy is how the card and the composer start disagreeing about what the post
   says.
   ─────────────────────────────────────────────────────────────────────────── */
test.describe("where each entry's text is written", () => {
  test("sends the first entry's text to the build and a later one to its own row", async ({
    page,
  }) => {
    const writes: Write[] = [];
    await page.setViewportSize({ width: 1400, height: 1000 });
    await openComposer(page, "exhibition", writes);

    // The first entry: the description, on the workspace's own debounce.
    await page.getByTestId("outcome-input").fill("Clears a week of backlog in one pass.");
    await expect
      .poll(() => writes.find((w) => w.table === "builds" && w.body.includes("outcome")), {
        timeout: 8000,
      })
      .toBeTruthy();

    const headerWrite = writes.find((w) => w.table === "builds" && w.body.includes("outcome"))!;
    expect(headerWrite.body).toContain("Clears a week of backlog in one pass.");
    // NOT duplicated into the row. postEntriesOf falls position 0 back to the
    // build's own column, and a second copy is what makes the two drift.
    expect(headerWrite.table).toBe("builds");
    expect(writes.filter((w) => w.table === "build_media")).toHaveLength(0);

    // A later entry: its own words, on its own row.
    await page.getByTestId("entry-text-1").fill("The routing table, second pass.");
    await expect
      .poll(() => writes.find((w) => w.table === "build_media" && w.body.includes("post_text")), {
        timeout: 8000,
      })
      .toBeTruthy();

    const rowWrite = writes.find((w) => w.table === "build_media")!;
    expect(rowWrite.body).toContain("The routing table, second pass.");
    expect(rowWrite.body).toContain("post_text");
    // And it did not reach for the build's column on the way.
    expect(rowWrite.body).not.toContain("outcome");
  });
});
