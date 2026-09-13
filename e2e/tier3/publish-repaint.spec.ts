// Tier 3 — the repainted publish sheet (BG-P24).
//
// WHY THIS IS A BROWSER SPEC. Everything asserted here is RESOLVED COLOUR, a
// COMPUTED FILTER or LAYOUT, and jsdom can give none of the three: a
// `var(--bg)` is a string in a style attribute until a browser resolves it
// against `<html data-theme>`, `color-mix()` is dropped by jsdom's parser
// outright, and `backdrop-filter` does not exist there at all — which is
// exactly the property this surface has to prove absent on itself and present
// on the card inside it. The unit tests under src/components/compose/ cover
// what the sheet DECIDES; this covers what a browser DOES with it.
//
// THE COMPOSER IS STUBBED AT THE REST BOUNDARY, the way BG-P23's compose spec
// and BG-P21's build-page spec both are: /compose/:buildId needs a signed-in
// creator AND a record they own, so it cannot be opened anonymously. Every
// component under test is the real one; only the network is fake.
//
// THE GATE IS NOT REPAINTED AND NOT TESTED DIFFERENTLY. The two gate
// assertions below — a draft short of the bar refuses and says why, a complete
// one does not — are here precisely because a repaint is the kind of change
// that silently moves one. They assert the behaviour, not the colour.

import { expect, test, type Page } from "@playwright/test";

const THEMES = ["exhibition", "dusk"] as const;

/** The prompt's four widths. */
const WIDTHS = [1400, 1024, 900, 390] as const;

/** The sheet stacks to one column below this. See PublishSheet. */
const SINGLE_COLUMN_MAX = 900;

const PROJECT_REF = "zybdotagjwektucfdkri";
const USER = "11111111-0000-4000-8000-000000000001";
const BUILD = "22222222-0000-4000-8000-000000000002";
const SOURCE = "33333333-0000-4000-8000-000000000003";

/** A draft that clears the gate: an outcome, an instruction and an evidence. */
const readyBuild = {
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
  cover_media_id: null,
  cost_setup: null,
  cost_monthly: null,
  currency: "GBP",
  time_to_first_result: null,
  completeness: 62,
  reproduction_count: 0,
  last_confirmed_at: null,
  last_confirmed_model: null,
  published_at: null,
  parent_build_id: null,
  rebuild_count: 0,
  rebuild_note: null,
  source_title_at_fork: null,
  source_handle_at_fork: null,
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-09-01T10:00:00Z",
  difficulty: "intermediate",
};

/** The same record, forked from a published source: a rebuild. */
const rebuiltBuild = {
  ...readyBuild,
  parent_build_id: SOURCE,
  source_title_at_fork: "Inbox triage agent",
  source_handle_at_fork: "amara",
};

/** What it was forked FROM, so the diff has two sides to compare. */
const sourceBuild = {
  ...readyBuild,
  id: SOURCE,
  slug: "inbox-triage-agent-original",
  title: "Inbox triage agent",
  outcome: "Sorts a full inbox in about a minute.",
  made_with: ["gpt-4o"],
  status: "published",
  published_at: "2026-07-01T10:00:00Z",
  parent_build_id: null,
  source_title_at_fork: null,
  source_handle_at_fork: null,
};

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
    schema: {
      fields: [
        { key: "text", label: "Prompt text", type: "text", required: true },
        { key: "model", label: "Model", type: "string" },
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
    sort: 2,
    schema: { fields: [{ key: "summary", label: "What happened", type: "text", required: true }] },
  },
  {
    key: "config",
    label: "Agent config",
    category: "configuration",
    colour: null,
    icon: null,
    renderer: "configuration",
    copyable: true,
    is_active: true,
    sort: 3,
    schema: { fields: [{ key: "json", label: "Configuration", type: "text", required: true }] },
  },
];

const node = (id: string, type: string, title: string, extra: Record<string, unknown> = {}) => ({
  id,
  build_id: BUILD,
  parent_id: null,
  position: 0,
  type,
  title,
  payload: type === "prompt" ? { text: "You are an inbox triage agent." } : { summary: "It sorted them." },
  is_gap: false,
  source_ref: null,
  created_at: "",
  updated_at: "",
  ...extra,
});

/** The publishable minimum: something to run, and evidence it ran. */
const readyNodes = [
  node("n1", "prompt", "The triage prompt"),
  node("n2", "result", "What it did", { position: 1 }),
];

/** The same, plus a part left deliberately unsolved. */
const gapNodes = [
  ...readyNodes,
  node("n3", "config", "Calendar hand-off", {
    position: 2,
    is_gap: true,
    payload: { problem: "The hand-off to a calendar is not written yet." },
  }),
];

/** What the source held, so the diff has something to report. */
const sourceNodes = [
  { ...node("s1", "prompt", "The triage prompt"), build_id: SOURCE },
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

type Scenario = "ready" | "short" | "rebuild" | "gaps";

/**
 * A signed-in creator on their own draft, with the network stubbed, and the
 * publish sheet open.
 *
 * The theme is set before first paint, the way index.html's boot script reads
 * it — a theme applied after load would be measured mid-cross-fade.
 */
async function openSheet(page: Page, theme: string, scenario: Scenario = "ready") {
  const build =
    scenario === "rebuild"
      ? rebuiltBuild
      : scenario === "short"
        ? { ...readyBuild, outcome: null, made_for: null, made_with: null }
        : readyBuild;
  const nodes =
    scenario === "gaps" ? gapNodes : scenario === "short" ? [readyNodes[0]] : readyNodes;

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

  await page.route(/\/storage\/v1\//, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ signedURL: "/stub-media.svg", signedUrl: "/stub-media.svg" }),
    })
  );

  await page.route(/\/rest\/v1\//, (route) => {
    const url = route.request().url();
    const table = url.split("/rest/v1/")[1].split("?")[0];
    // The rebuild's source is a DIFFERENT record, fetched by its own id — so
    // the stub answers on the id in the query rather than on the table alone.
    // Without that both sides of the diff are the same row and every rebuild
    // reports no changes, which is not the state under test.
    const wantsSource = url.includes(SOURCE);

    let body: unknown[] = [];
    if (table === "builds") body = [wantsSource ? sourceBuild : build];
    else if (table === "node_types") body = nodeTypes;
    else if (table === "build_nodes")
      body = url.includes("position=is.null") ? [] : wantsSource ? sourceNodes : nodes;
    else if (table === "profiles")
      body = [{ id: USER, username: "creator", display_name: "A creator", avatar_url: null }];

    // PostgREST answers .maybeSingle()/.single() with an object, not an array.
    const single = (route.request().headers()["accept"] ?? "").includes("vnd.pgrst.object");
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(single ? (body[0] ?? null) : body),
    });
  });

  await page.goto(`/compose/${BUILD}`);
  await page.getByRole("button", { name: "Publish", exact: true }).first().click();
  await expect(page.getByTestId("publish-sheet")).toBeVisible();
}

/** What a token resolves to in the room the page is currently in. */
async function token(page: Page, name: string): Promise<string> {
  return page.evaluate((property) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${property})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);
}

// -----------------------------------------------------------------------------

test.describe("the publish sheet in both rooms", () => {
  for (const theme of THEMES) {
    test(`stands on --bg at --r-panel above a scrim on ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 1000 });
      await openSheet(page, theme);

      const sheet = page.getByTestId("publish-sheet");
      await expect(sheet).toHaveCSS("background-color", await token(page, "--bg"));
      await expect(sheet).toHaveCSS("border-radius", "16px");
      await expect(sheet).toHaveCSS("border-top-color", await token(page, "--line"));

      // `elevation.overlay`, which is the level a dialog takes — not `raised`,
      // and not nothing.
      const shadow = await sheet.evaluate((el) => getComputedStyle(el).boxShadow);
      expect(shadow).not.toBe("none");

      // THE SCRIM IS THE PAGE'S. It dims the workspace behind the sheet and
      // belongs to the layer behind it, never to the sheet itself.
      const scrim = await page.evaluate(() => {
        const sheetEl = document.querySelector('[data-testid="publish-sheet"]');
        const overlays = Array.from(document.querySelectorAll("div")).filter((el) => {
          const style = getComputedStyle(el);
          return (
            style.position === "fixed" &&
            style.inset === "0px" &&
            !el.contains(sheetEl) &&
            style.backgroundColor !== "rgba(0, 0, 0, 0)"
          );
        });
        return overlays.map((el) => getComputedStyle(el).backgroundColor);
      });
      expect(scrim.length).toBeGreaterThan(0);
    });

    /**
     * A WORKING SURFACE CARRIES NO GLASS, and the one exception is named
     * rather than waived: the live preview is BG-P09's real GalleryCard, and a
     * card is a READING surface. Stripping its glass would make the preview
     * lie about what publishes.
     */
    test(`blurs nothing but the card inside it on ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 1000 });
      await openSheet(page, theme);

      const blurred = await page.evaluate(() => {
        const sheet = document.querySelector('[data-testid="publish-sheet"]');
        const preview = document.querySelector('[data-testid="publish-card-preview"]');
        const out: { inPreview: boolean; filter: string }[] = [];
        for (const el of Array.from(sheet?.querySelectorAll("*") ?? [])) {
          const filter = getComputedStyle(el).backdropFilter;
          if (filter && filter !== "none") {
            out.push({ inPreview: Boolean(preview?.contains(el)), filter });
          }
        }
        // The sheet itself as well as its children.
        const own = sheet ? getComputedStyle(sheet).backdropFilter : "none";
        if (own && own !== "none") out.push({ inPreview: false, filter: own });
        return out;
      });

      expect(blurred.filter((entry) => !entry.inPreview)).toEqual([]);
      // And the one inside the preview is the theme's single blur value, not a
      // second one invented for this surface.
      for (const entry of blurred) expect(entry.filter).toContain("blur(16px)");
    });

    test(`previews the post with the gallery's own card on ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 1000 });
      await openSheet(page, theme);

      const preview = page.getByTestId("publish-card-preview");
      // GalleryCard's own slot attribute, set nowhere else in the codebase. If
      // the preview ever stops being the component /gallery renders, this is
      // the line that says so.
      await expect(preview.locator('[data-visual-slot="gallery-card"]')).toBeVisible();
      await expect(preview).toContainText("Inbox triage agent");
    });
  }
});

test.describe("the gate behaves exactly as before", () => {
  for (const theme of THEMES) {
    test(`refuses a draft short of the bar and says why, inline, on ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 1000 });
      await openSheet(page, theme, "short");

      const confirm = page.getByTestId("publish-confirm");
      await expect(confirm).toBeDisabled();

      // NEVER A TOAST. The reason is on the screen, against the button, and it
      // stays there for as long as the refusal does.
      const reason = page.getByTestId("publish-blocked-reason");
      await expect(reason).toBeVisible();
      await expect(reason).not.toHaveText("");
      await expect(reason).toHaveCSS("color", await token(page, "--text2"));

      // And the checklist says what would clear it, as invitations rather than
      // as faults: --text2 sentences, each carrying an --action marker that is
      // present AT REST rather than on hover, because hover does not exist on
      // a touch screen.
      const rows = page.getByTestId("publish-checklist-row");
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(0);

      const action = await token(page, "--action");
      const text2 = await token(page, "--text2");
      const evidence = await token(page, "--evidence");

      for (let index = 0; index < rowCount; index += 1) {
        const row = rows.nth(index);
        await expect(row).toHaveCSS("color", text2);

        // The arrow, in the accent.
        const markers = await row.evaluate((el, accent) =>
          Array.from(el.querySelectorAll("span"))
            .filter((span) => getComputedStyle(span).color === accent)
            .map((span) => span.textContent?.trim() ?? ""),
          action
        );
        expect(markers).toContain("→");

        // And the dot, which says whether the button is waiting on THIS row:
        // the accent when it is, --evidence when it is not.
        const dot = await row.evaluate((el) => {
          const first = el.querySelector("span");
          return first ? getComputedStyle(first).backgroundColor : "";
        });
        expect([action, evidence]).toContain(dot);
      }

      // At least one of them is a row the button is actually waiting on, and
      // it says so in words under the sentence rather than only in a colour.
      const blocking = page.locator('[data-testid="publish-checklist-row"][data-blocking="true"]');
      expect(await blocking.count()).toBeGreaterThan(0);
      await expect(blocking.first()).toContainText("needed to publish");
    });

    test(`lets a complete draft through, with one primary action, on ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 1000 });
      await openSheet(page, theme, "ready");

      const confirm = page.getByTestId("publish-confirm");
      await expect(confirm).toBeEnabled();
      await expect(confirm).toHaveText("Publish");

      // The kit's primary: --action fill, --on-action label, --r-control.
      await expect(confirm).toHaveCSS("background-color", await token(page, "--action"));
      await expect(confirm).toHaveCSS("color", await token(page, "--on-action"));
      await expect(confirm).toHaveCSS("border-radius", "12px");

      // ONE PRIMARY ON THE SHEET. The workspace bar's own trigger is behind
      // the overlay, not competing with it.
      const sheet = page.getByTestId("publish-sheet");
      await expect(sheet.locator('[data-visual-slot="btn-primary"]')).toHaveCount(1);
    });
  }
});

test.describe("the empty-imagery nudge", () => {
  for (const theme of THEMES) {
    test(`invites a picture in --action and lands in the thread editor on ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1400, height: 1000 });
      await openSheet(page, theme, "ready");

      // Nothing resolves as a cover, so the card shows its own missing-cover
      // state and the nudge sits beside it.
      const nudge = page.getByTestId("publish-cover-nudge");
      await expect(nudge).toBeVisible();
      await expect(nudge).toHaveCSS("color", await token(page, "--action"));
      // A LINE, not a second call to action: no fill, no border.
      await expect(nudge).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(nudge).toHaveCSS("border-top-width", "0px");
      await expect(nudge).toHaveCSS("text-decoration-line", "underline");

      await nudge.click();

      // It closes the sheet and puts the creator in front of the thread editor
      // — the surface that holds the picture.
      await expect(page.getByTestId("publish-sheet")).toBeHidden();
      const landed = await page.evaluate(() =>
        Boolean(
          document
            .querySelector('[data-testid="cover-strip"]')
            ?.contains(document.activeElement)
        )
      );
      expect(landed).toBe(true);
    });
  }
});

test.describe("the two extension sections", () => {
  for (const theme of THEMES) {
    test(`shows a rebuild's change lines with kind-coloured dots on ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 1000 });
      await openSheet(page, theme, "rebuild");

      const section = page.getByTestId("rebuild-section");
      await expect(section).toBeVisible();

      const lines = page.getByTestId("rebuild-change-lines").locator("li");
      expect(await lines.count()).toBeGreaterThan(0);

      // MONO, because a change summary is data about a record — the theme's
      // own list of what the data face sets.
      await expect(lines.first()).toHaveCSS("font-family", /DM Mono/);

      // Each dot carries its kind, and the four are the tokens that name the
      // JOB rather than hues on loan from the part categories.
      const expected: Record<string, string> = {
        changed: await token(page, "--action"),
        added: await token(page, "--evidence"),
        removed: await token(page, "--text2"),
        header: await token(page, "--cat-artefact"),
      };
      const dots = await lines.evaluateAll((rows) =>
        rows.map((row) => ({
          kind: row.getAttribute("data-change-kind") ?? "",
          colour: getComputedStyle(row.querySelector("span") as HTMLElement).backgroundColor,
        }))
      );
      expect(dots.length).toBeGreaterThan(0);
      for (const dot of dots) expect(dot.colour).toBe(expected[dot.kind]);

      // The credit preview is the SHARED component, composing the sentence
      // from the frozen snapshot columns the card composes it from.
      const credit = page.getByTestId("rebuild-credit");
      await expect(credit.locator('[data-visual-slot="rebuild-credit"]')).toBeVisible();
      await expect(credit).toContainText("Rebuilt from Inbox triage agent by @amara");

      // The note is the kit's field: a --recess well, not a white film.
      await expect(page.getByTestId("rebuild-note")).toHaveCSS(
        "background-color",
        await token(page, "--recess")
      );
    });

    test(`shows the bounty section for a gap-carrying draft on ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 1000 });
      await openSheet(page, theme, "gaps");

      const section = page.getByTestId("bounty-section");
      await expect(section).toBeVisible();

      const row = page.getByTestId("bounty-gap-row").first();
      await expect(row).toBeVisible();

      // THE EDGE IS DASHED AND IT IS BREAKAGE. Solid says "this is what it
      // is"; dashed says "this is where something goes".
      await expect(row).toHaveCSS("border-left-style", "dashed");
      await expect(row).toHaveCSS("border-left-color", await token(page, "--cat-breakage"));

      // The shared marker in its row placement, with the part's TRUE category
      // on the chip — never recoloured red.
      const marker = row.locator('[data-visual-slot="gap-marker"]');
      await expect(marker).toHaveAttribute("data-gap-placement", "row");
      await expect(marker).toContainText("Agent config");

      // A reward and an optional deadline, on the kit's field paint.
      await expect(row.getByTestId("bounty-reward-input")).toHaveCSS(
        "background-color",
        await token(page, "--recess")
      );
      await expect(row.getByTestId("bounty-deadline-input")).toBeVisible();

      // And the one switch, which is the kit's.
      const skip = page.getByTestId("bounty-skip");
      await expect(skip).toHaveAttribute("role", "switch");
      await expect(skip).toHaveAttribute("aria-checked", "false");
      await skip.click();
      await expect(skip).toHaveAttribute("aria-checked", "true");
    });
  }
});

test.describe("the sections at phone width", () => {
  for (const theme of THEMES) {
    /**
     * The gap row grew in BG-P24: a tick, the shared marker (a category chip, a
     * state tag and sometimes a reward tag) and the part's title, where before
     * it was a tick, one pill and the title. At 390px inside a one-column sheet
     * that is more than fits on a line — and NOTHING STRUCTURAL WAS CHANGED TO
     * absorb it. The row's own `min-width: 0` on the title and its existing
     * ellipsis already do the job: the title gives way, the tags stay whole,
     * and nothing scrolls sideways. This is the assertion that says so, and it
     * is why no `flex-wrap` was added to an element that had none.
     */
    test(`fits the richer bounty rows at 390 without overflowing on ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openSheet(page, theme, "gaps");

      await expect(page.getByTestId("bounty-section")).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(1);

      // And nothing inside the sheet is wider than the sheet itself.
      const widest = await page.evaluate(() => {
        const sheet = document.querySelector('[data-testid="publish-sheet"]') as HTMLElement;
        const limit = sheet.getBoundingClientRect().width;
        let worst = 0;
        for (const el of Array.from(sheet.querySelectorAll("*"))) {
          worst = Math.max(worst, (el as HTMLElement).getBoundingClientRect().width - limit);
        }
        return worst;
      });
      expect(widest).toBeLessThanOrEqual(1);
    });
  }
});

test.describe("the publish sheet at every width", () => {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      test(`has no sideways scroll at ${width} on ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
        await openSheet(page, theme);

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(1);

        // Below the breakpoint the sheet is one column, card above checklist.
        const columns = await page
          .getByTestId("publish-sheet")
          .evaluate((el) => getComputedStyle(el).gridTemplateColumns);
        if (width < SINGLE_COLUMN_MAX) {
          expect(columns === "none" || !columns.includes(" ")).toBe(true);
        }
      });
    }
  }
});
