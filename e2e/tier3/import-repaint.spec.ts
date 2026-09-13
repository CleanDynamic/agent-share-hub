// Tier 3 — /import repainted (BG-P24).
//
// WHY THIS IS A BROWSER SPEC. Every claim below is a RESOLVED COLOUR, a
// COMPUTED FILTER or a LAYOUT, and jsdom can give none of the three: a
// `var(--recess)` is a string in a style attribute until a browser resolves it
// against `<html data-theme>`, `color-mix()` is dropped by jsdom's parser
// outright, and `backdrop-filter` does not exist there at all. The unit tests
// in src/pages/ImportPage.test.tsx cover what the page DECIDES — which state
// the drop target is in, which document it offers, what parses. This covers
// what a browser DOES with it, in both rooms.
//
// NO SESSION, AND ONE TABLE STUBBED. /import is a public route: it renders for
// a signed-out visitor, the two kit documents are static assets the dev server
// itself serves, and the parse is local. The single thing it does reach the
// network for is `node_types` — the registry a dropped file is validated
// against — so that one table is stubbed and nothing else is. PostgREST is not
// reachable from a test runner, and without the stub every drop below would
// fail on the registry rather than on anything this spec is about.

import { expect, test, type Page } from "@playwright/test";

const THEMES = ["exhibition", "dusk"] as const;

/** The prompt's four widths. */
const WIDTHS = [1400, 1024, 900, 390] as const;

/**
 * The registry a dropped file is checked against.
 *
 * Two types is enough: the fixture below uses `prompt`, and `config` is here so
 * the file is validated against a registry with more in it than it uses —
 * which is the shape of the real one.
 */
const NODE_TYPES = [
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
    key: "config",
    label: "Agent config",
    category: "configuration",
    colour: null,
    icon: null,
    renderer: "configuration",
    copyable: true,
    is_active: true,
    sort: 2,
    schema: { fields: [{ key: "json", label: "Configuration", type: "text", required: true }] },
  },
];

/** A valid Build File, small enough to read and complete enough to parse. */
const VALID_BUILD_FILE = JSON.stringify(
  {
    neoscale_build: 1,
    generated_by: "extractor-v1",
    secrets_redacted: true,
    origin: { tool: "Claude", session_hint: "A chat", exported_at: "2026-09-01T10:00:00Z" },
    build: {
      title: "Inbox triage agent",
      outcome: "Sorts a full inbox in about a minute.",
      shape: "agent",
      made_for: ["ops"],
      made_with: ["claude-sonnet-4.5"],
      live_url: null,
      repo_url: null,
      cost: null,
      time_to_first_result: null,
    },
    nodes: [
      {
        path: "1",
        type: "prompt",
        title: "The triage prompt",
        note: null,
        payload: { text: "You are an inbox triage agent." },
        inferred: false,
        children: [],
      },
    ],
    events: [
      {
        ordinal: 1,
        kind: "prompt",
        payload: { text: "You are an inbox triage agent.", response_summary: "It sorted them." },
        phase_title: null,
        inferred: false,
      },
    ],
  },
  null,
  2
);

/**
 * The theme is set before first paint, the way index.html's boot script reads
 * it — a theme applied after load would be measured mid-cross-fade.
 */
async function openImport(page: Page, theme: string) {
  await page.addInitScript((stored) => {
    try {
      window.localStorage.setItem("bg-theme", stored);
    } catch {
      /* private window — the default theme is a fine ground for a measurement */
    }
  }, theme);

  // A signed-out visitor, which is what this route is for. The auth endpoint
  // is answered rather than left to time out.
  await page.route(/\/auth\/v1\//, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "null" })
  );

  await page.route(/\/rest\/v1\//, (route) => {
    const table = route.request().url().split("/rest/v1/")[1].split("?")[0];
    const body = table === "node_types" ? NODE_TYPES : [];
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  await page.goto("/import");
  await expect(page.getByTestId("import-drop")).toBeVisible();
}

/**
 * What a token resolves to in the room the page is currently in.
 *
 * Read through a probe element rather than off `getPropertyValue`, because a
 * computed style answers in `rgb()` and the token is declared as a hex — and
 * it is the `rgb()` that every assertion below is comparing against.
 */
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

test.describe("the import page in both rooms", () => {
  for (const theme of THEMES) {
    test(`renders inside the frame on ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 1000 });
      await openImport(page, theme);

      // The frame's own chrome, which is what "inside the frame" means: the
      // page does not draw its own nav, the application does.
      await expect(page.locator(".fs-root")).toHaveCount(1);
      expect(await page.getAttribute("html", "data-theme")).toBe(theme);

      // The header PageHeader renders, which is the component BG-P15 wrote for
      // this page and had to take back out until the repaint.
      await expect(
        page.getByRole("heading", { level: 1, name: "Post a build without writing it up." })
      ).toBeVisible();
      await expect(page.getByText("IMPORT", { exact: false }).first()).toBeVisible();

      // Three steps, and the page's ground is the theme's, not a hard-coded one.
      await expect(page.locator('[data-visual-slot="import-step"]')).toHaveCount(3);
      const ground = await page.evaluate(
        () =>
          getComputedStyle(
            document.querySelector('[data-visual-slot="import-frame"]') as HTMLElement
          ).backgroundColor
      );
      expect(ground).toBe(await token(page, "--bg"));
    });

    test(`cuts the steps into the page as --recess panels on ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 1000 });
      await openImport(page, theme);

      const recess = await token(page, "--recess");
      const steps = page.locator('[data-visual-slot="import-step"]');

      for (let index = 0; index < 3; index += 1) {
        const step = steps.nth(index);
        await expect(step).toHaveCSS("background-color", recess);
        await expect(step).toHaveCSS("border-radius", "16px");
      }
    });
  }
});

test.describe("the drop target is obviously droppable", () => {
  for (const theme of THEMES) {
    /**
     * `critique-affordance`: what on this screen looks like it will accept an
     * action, BEFORE anything is dragged at it?
     *
     * A dashed edge is the one border style that says "something goes here"
     * rather than "this is a thing". It is present at rest, and hover then
     * arms the same edge with the accent — so the affordance survives a touch
     * screen, where hover does not exist at all.
     */
    test(`is dashed at rest and arms in --action on hover on ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 1000 });
      await openImport(page, theme);

      const target = page.getByTestId("import-drop");
      const line = await token(page, "--line");
      const action = await token(page, "--action");

      await expect(target).toHaveAttribute("data-drop-state", "idle");
      await expect(target).toHaveCSS("border-style", "dashed");
      await expect(target).toHaveCSS("border-top-color", line);
      // It sits on --bg INSIDE the --recess step panel: a well inside a well
      // is not a well, so the target steps back out of the surface around it.
      await expect(target).toHaveCSS("background-color", await token(page, "--bg"));

      await target.hover();
      await expect(target).toHaveAttribute("data-drop-state", "hover");
      // The same edge, armed — not a different treatment.
      await expect(target).toHaveCSS("border-style", "dashed");
      await expect(target).toHaveCSS("border-top-color", action);

      // And the accent is NOT amber: the theme forbids --lit as a border that
      // carries state on a light ground, and this is the exact place a
      // "highlight" would reach for it.
      expect(action).not.toBe(await token(page, "--lit"));
    });

    test(`says what will happen when a file is over the page on ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 1000 });
      await openImport(page, theme);

      const target = page.getByTestId("import-drop");
      await page.evaluate(() => {
        const transfer = new DataTransfer();
        transfer.items.add(new File(["{}"], "a.md", { type: "text/markdown" }));
        window.dispatchEvent(
          new DragEvent("dragenter", { dataTransfer: transfer, bubbles: true })
        );
        window.dispatchEvent(new DragEvent("dragover", { dataTransfer: transfer, bubbles: true }));
      });

      await expect(target).toHaveAttribute("data-drop-state", "over");
      await expect(target).toContainText("Let go to read it");
      await expect(target).toHaveCSS("border-top-color", await token(page, "--action"));
      // The whole page reads as the target it is.
      const ring = await page.evaluate(
        () =>
          getComputedStyle(
            document.querySelector('[data-visual-slot="import-frame"]') as HTMLElement
          ).boxShadow
      );
      expect(ring).not.toBe("none");
    });
  }
});

test.describe("a dropped file still parses, reviews and can be materialised", () => {
  for (const theme of THEMES) {
    test(`reviews a valid Build File on ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 1000 });
      await openImport(page, theme);

      await page.getByTestId("import-file-input").setInputFiles({
        name: "my-build.buildgallery.md",
        mimeType: "text/markdown",
        buffer: Buffer.from(`\`\`\`json\n${VALID_BUILD_FILE}\n\`\`\`\n`),
      });

      // The parse is local: the review is on screen without a request.
      const review = page.getByTestId("import-review");
      await expect(review).toBeVisible();
      await expect(review).toContainText("Here is what it found");
      await expect(page.getByTestId("import-source-line")).toContainText("From Claude");

      // NOTHING AUTO-PUBLISHES. The creator is still between the file and the
      // record: the confirm exists, is theirs to press, and nothing has been
      // written until they do.
      const confirm = page.getByTestId("import-confirm");
      await expect(confirm).toBeVisible();
      await expect(confirm).toBeEnabled();
      // And it is the kit's PRIMARY, which is what the one control the screen
      // exists to reach has to be.
      await expect(confirm).toHaveAttribute("data-visual-slot", "btn-primary");
      await expect(confirm).toHaveCSS("background-color", await token(page, "--action"));
      await expect(confirm).toHaveCSS("color", await token(page, "--on-action"));
    });

    test(`refuses an unreadable file in words, not a code, on ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1400, height: 1000 });
      await openImport(page, theme);

      await page.getByTestId("import-file-input").setInputFiles({
        name: "holiday-photos.md",
        mimeType: "text/markdown",
        buffer: Buffer.from("# Just some notes\n\nNothing machine-readable in here.\n"),
      });

      const panel = page.getByTestId("import-error");
      await expect(panel).toBeVisible();

      // THE BREAKAGE IS ON THE EDGE, NOT UNDER THE PANEL. A red wash behind a
      // whole box says "you did something wrong"; the file is wrong and the
      // person is not. The ground stays the flow's own --recess.
      await expect(panel).toHaveCSS("border-left-color", await token(page, "--cat-breakage"));
      await expect(panel).toHaveCSS("background-color", await token(page, "--recess"));

      // And both ways out are named, in --action for the one that leads
      // somewhere new.
      await expect(page.getByTestId("import-error-extractor")).toBeVisible();
      await expect(page.getByTestId("import-error-retry")).toBeVisible();
      await expect(page.getByTestId("import-error-extractor")).toHaveCSS(
        "color",
        await token(page, "--action")
      );
    });

    test(`shows a key that travelled in the file, and imports it anyway, on ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1400, height: 1000 });
      await openImport(page, theme);

      const withSecret = VALID_BUILD_FILE.replace(
        "You are an inbox triage agent.",
        "Use sk-test-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 to call it."
      );
      await page.getByTestId("import-file-input").setInputFiles({
        name: "leaky.buildgallery.md",
        mimeType: "text/markdown",
        buffer: Buffer.from(`\`\`\`json\n${withSecret}\n\`\`\`\n`),
      });

      const banner = page.getByTestId("import-secrets-banner");
      await expect(banner).toBeVisible();
      await expect(banner).toHaveCSS("border-left-color", await token(page, "--cat-breakage"));
      await expect(banner).toHaveCSS("background-color", await token(page, "--recess"));

      // IT NEVER BLOCKS THE IMPORT. The scan cannot tell a live key from an
      // example one, and a surface that refused the file would be wrong often
      // enough to teach creators to route around it.
      await expect(page.getByTestId("import-confirm")).toBeEnabled();
    });
  }
});

test.describe("both document names serve", () => {
  /**
   * The page offers the buildgallery-named documents, and the NEOSCALE-named
   * paths still answer with the identical bytes — because a creator who
   * bookmarked one, downloaded one or pasted one into a chat months ago is
   * holding the old URL.
   *
   * Asserted over HTTP rather than over the filesystem (which
   * src/lib/build/buildfileDocuments.test.ts does) because SERVING is the
   * claim: a file that exists but is shadowed by the SPA fallback would pass
   * a filesystem check and hand a creator index.html.
   */
  const PAIRS = [
    ["/buildfile/BUILDGALLERY_EXTRACTOR.md", "/buildfile/NEOSCALE_EXTRACTOR.md"],
    ["/buildfile/BUILDGALLERY_COMPILER.md", "/buildfile/NEOSCALE_COMPILER.md"],
  ] as const;

  for (const [current, retired] of PAIRS) {
    test(`serves ${current} and keeps ${retired} serving it`, async ({ request }) => {
      const now = await request.get(current);
      expect(now.ok()).toBe(true);
      const body = await now.text();
      expect(body).toContain("buildgallery");
      // Markdown, not the application's own HTML shell.
      expect(body.startsWith("<!DOCTYPE")).toBe(false);

      const old = await request.get(retired);
      expect(old.ok()).toBe(true);
      expect(await old.text()).toBe(body);
    });
  }

  test("the format key is untouched in what is actually served", async ({ request }) => {
    // `neoscale_build` is a PARSED IDENTIFIER, not a word: every Build File in
    // the wild declares it, and renaming it would refuse all of them. The
    // rename is of the filename and the prose, and stops there.
    for (const path of [
      "/buildfile/BUILDGALLERY_EXTRACTOR.md",
      "/buildfile/NEOSCALE_EXTRACTOR.md",
    ]) {
      const body = await (await request.get(path)).text();
      expect(body).toContain('"neoscale_build": 1');
      // ...and no other trace of the old name anywhere a person reads.
      const prose = body
        .split("\n")
        .filter((line) => !line.includes("neoscale_build"))
        .join("\n");
      expect(prose.toLowerCase()).not.toContain("neoscale");
    }
  });
});

test.describe("the import page at every width", () => {
  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      test(`has no sideways scroll at ${width} on ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
        await openImport(page, theme);

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(1);
      });
    }
  }
});
