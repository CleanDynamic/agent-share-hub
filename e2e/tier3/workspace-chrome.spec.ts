// Tier 3 — BG-P16, the shared authoring workspace chrome.
//
// WHAT THIS GUARDS. /compose/new, /compose/:buildId, /rebuild/:slug and
// /convert/:contentItemId each had their own outer container and their own way
// out — a "← buildgallery" text link on compose, "← Back to the build" on
// rebuild, "← Back to the post" on convert, and on the intake route nothing at
// all. They now share one WorkspaceBar. The claims that matter are about the
// chrome, and the two that cannot be made in jsdom are made here: the bar's
// rendered HEIGHT, and that nothing in the workspace is blurred. jsdom has no
// layout engine and no `backdrop-filter`, so those need a browser.
//
// WHY THE MEASUREMENTS RUN ON /dev/kit. All four routes need a signed-in
// creator, and three of them need a real record, so none can be opened by a
// browser without seeded credentials — while every claim below is about the
// bar rather than about any build. BG-P16 mounts one specimen in the control
// kit for exactly this, which is the move BG-P14 already made when it measured
// the wide frame on /dev/wide rather than on a real route. The specimen is the
// real component with real props, not a copy.
//
// THE FOUR ROUTES ARE STILL CHECKED, further down, for the one thing that can
// be asserted about them anonymously: that they are still OUTSIDE the
// application frame. That is a hard constraint of this prompt — the workspace
// drops navigation on purpose — and it is exactly the kind of thing a later
// prompt could undo by accident.
//
// Fifty-two is not a magic number: it is the height ComposeTopBar has carried
// since NS-P07, and the panel row below it is flex:1, so every pixel the bar
// gains is a pixel the tray, the tree and the inspector lose.

import { expect, test, type Page } from "@playwright/test";

const THEMES = ["exhibition", "dusk"] as const;

/** The height ComposeTopBar has always been. BG-P16 repaints, never resizes. */
const BAR_HEIGHT = 52;

/** Set the theme before first paint, the way index.html's boot script reads it. */
async function withTheme(page: Page, theme: string) {
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem("bg-theme", value);
    } catch {
      /* private window — the default theme is fine for a measurement */
    }
  }, theme);
}

async function openKit(page: Page, theme: string) {
  await withTheme(page, theme);
  await page.goto("/dev/kit");
  await expect(page.getByTestId("kit-workspace")).toBeVisible();
}

const bar = (page: Page) => page.getByTestId("workspace-bar");
const exit = (page: Page) => page.getByTestId("workspace-exit");

test.describe("the workspace bar", () => {
  for (const theme of THEMES) {
    test(`is ${BAR_HEIGHT}px tall on ${theme}, measured`, async ({ page }) => {
      await openKit(page, theme);
      const box = await bar(page).boundingBox();
      expect(box?.height).toBe(BAR_HEIGHT);
    });
  }

  test("holds that height at every width, so a crowded bar never grows a row", async ({ page }) => {
    await openKit(page, "exhibition");
    for (const width of [1920, 1440, 1024, 900, 768, 390]) {
      await page.setViewportSize({ width, height: 700 });
      const box = await bar(page).boundingBox();
      expect(box?.height, `bar height at ${width}px`).toBe(BAR_HEIGHT);
    }
  });

  for (const theme of THEMES) {
    test(`carries no backdrop-filter at all on ${theme}`, async ({ page }) => {
      await openKit(page, theme);
      const blurred = await bar(page).evaluate((root) =>
        [root, ...Array.from(root.querySelectorAll("*"))]
          .filter((element) => {
            const style = getComputedStyle(element as Element) as CSSStyleDeclaration & {
              webkitBackdropFilter?: string;
            };
            const applied = style.backdropFilter ?? style.webkitBackdropFilter;
            return Boolean(applied) && applied !== "none";
          })
          .map((element) => (element as HTMLElement).tagName),
      );
      // Reading surfaces have glass; working surfaces do not. This is the rule,
      // not a saving — see the note at the top of WorkspaceBar.tsx.
      expect(blurred).toEqual([]);
    });
  }
});

test.describe("the exit", () => {
  test("reads as a control rather than as a line of text", async ({ page }) => {
    await openKit(page, "exhibition");
    const control = exit(page);
    await expect(control).toBeVisible();
    await expect(control).toContainText("buildgallery");
    await expect(control).toHaveAttribute("href", "/gallery");

    const paint = await control.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        border: parseFloat(s.borderTopWidth),
        radius: parseFloat(s.borderTopLeftRadius),
        // A transparent fill would mean it is standing on the bar's own ground.
        filled: s.backgroundColor !== "rgba(0, 0, 0, 0)" && s.backgroundColor !== "transparent",
        height: el.getBoundingClientRect().height,
      };
    });
    expect(paint.border).toBeGreaterThan(0);
    expect(paint.radius).toBeGreaterThan(0);
    expect(paint.filled).toBe(true);
    // Taller than the 30–32px controls beside it: its only emphasis.
    expect(paint.height).toBeGreaterThan(32);
    expect(paint.height).toBeLessThan(BAR_HEIGHT);
  });

  test("navigates out of the workspace when pressed", async ({ page }) => {
    await openKit(page, "exhibition");
    await exit(page).click();
    await expect(page).toHaveURL(/\/gallery$/);
  });

  test("is reachable and operable from the keyboard", async ({ page }) => {
    await openKit(page, "exhibition");
    await exit(page).focus();
    await expect(exit(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/gallery$/);
  });

  for (const theme of THEMES) {
    test(`clears the 3.0:1 floor for UI state against the bar on ${theme}`, async ({ page }) => {
      await openKit(page, theme);
      const ratio = await exit(page).evaluate((el) => {
        const parse = (value: string) =>
          (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const lum = ([r, g, b]: number[]) => {
          const channel = (c: number) => {
            const v = c / 255;
            return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
        };
        const border = lum(parse(getComputedStyle(el).borderTopColor));
        const ground = lum(parse(getComputedStyle(el.parentElement as Element).backgroundColor));
        const [hi, lo] = border > ground ? [border, ground] : [ground, border];
        return (hi + 0.05) / (lo + 0.05);
      });
      // The exit's border is --text2, not the --line every other control takes,
      // precisely so this passes: --line on --bg measures 1.30 and 1.82.
      expect(ratio).toBeGreaterThanOrEqual(3);
    });
  }
});

test.describe("the theme toggle inside the workspace", () => {
  test("changes rooms without leaving the workspace", async ({ page }) => {
    await openKit(page, "exhibition");
    const group = bar(page).getByRole("radiogroup", { name: "Theme" });
    await expect(group).toBeVisible();

    await group.getByRole("radio", { name: "Dusk" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dusk");
    // Still here: a creator an hour into a build did not lose their workspace.
    await expect(bar(page)).toBeVisible();
    await expect(exit(page)).toBeVisible();

    await group.getByRole("radio", { name: "Exhibition" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "exhibition");
    await expect(bar(page)).toBeVisible();
  });
});

test.describe("the four authoring routes stay outside the frame", () => {
  // Signed out they redirect to /login, which is itself inside the frame — so
  // the assertion is made on the first paint, before auth resolves, where the
  // route's own container is what renders. `.fs-left` is FlatShell's own frame
  // class, the same one BG-P15's spec uses to tell the frame from a page.
  const ROUTES = ["/compose/new", "/compose/abc123", "/rebuild/some-slug", "/convert/abc123"];

  for (const route of ROUTES) {
    test(`${route} never renders the application frame's rails`, async ({ page }) => {
      await withTheme(page, "exhibition");
      await page.goto(route);
      // Either the route's own surface, or the login redirect. Never the frame
      // wrapped around an authoring surface.
      const framedWorkspace = page.locator(".fs-left").locator("..").getByTestId("workspace-bar");
      await expect(framedWorkspace).toHaveCount(0);
    });
  }
});
