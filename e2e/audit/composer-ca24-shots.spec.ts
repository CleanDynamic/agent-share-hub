/* CA-24 P5: screenshots of the composer's loading, empty and error states, Dusk and Noon, at 1440 and 390, written to
   design/audits/composer/ca-24/.

   The first load is shot three times with every animation paused (`document.getAnimations()`, then `currentTime`): building (the
   rows part-way up), the wave mid-page, and halfway through arriving (the blocks half faded, the content half in).

     npm run audit -- composer-ca24-shots */

import { mkdirSync } from "node:fs";

import { test, type Page } from "@playwright/test";

const OUT = "design/audits/composer/ca-24";
const SIZES = [
  { name: "1440", width: 1440, height: 900, mobile: false },
  { name: "390", width: 390, height: 844, mobile: true },
];

const url = (theme: string, show: string, mobile: boolean) => `/dev/kit/pages/sandbox?theme=${theme}&build=ca24&show=${show}&window=1${mobile ? "&viewport=mobile" : ""}`;

/** Pause every animation and put it at `at` ms; a finished one (not a loop) is put at `at` too when `all`, else at its end. */
async function freeze(page: Page, at: number, all = false) {
  await page.evaluate(
    ({ at, all }) => {
      for (const animation of document.getAnimations()) {
        animation.pause();
        const timing = animation.effect?.getTiming();
        const loops = timing ? !Number.isFinite(Number(timing.iterations)) : false;
        const end = timing ? Number(timing.delay ?? 0) + Number(timing.duration ?? 0) : at;
        animation.currentTime = loops || all ? at : Math.min(at, end);
      }
    },
    { at, all },
  );
}

for (const theme of ["dusk", "noon"]) {
  for (const size of SIZES) {
    const shot = async (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}-${theme}-${size.name}.png` });
    const open = async (page: Page, show: string) => {
      mkdirSync(OUT, { recursive: true });
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto(url(theme, show, size.mobile));
    };

    test(`composer/ca-24/${theme}/${size.name}/first-load`, async ({ page }) => {
      await open(page, "first-load");
      await page.getByTestId("compose-skeleton").waitFor();
      // Building: the rows part-way up, blocks starting 40 ms apart.
      await freeze(page, 330, true);
      await shot(page, "first-load-1-building");
      // The wave mid-page: the loops at 1.1 s of their cycle, the rows built.
      await page.reload();
      await page.getByTestId("compose-skeleton").waitFor();
      await freeze(page, 1500, true);
      await page.evaluate(() => document.getAnimations().forEach((animation) => { if (!Number.isFinite(Number(animation.effect?.getTiming().iterations))) animation.currentTime = 1100; }));
      await shot(page, "first-load-2-wave");
      // Arriving: the content is ready; halfway through both fades.
      await page.reload();
      await page.getByTestId("compose-skeleton").waitFor();
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            (window as unknown as { __ca24Ready: () => void }).__ca24Ready();
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                for (const animation of document.getAnimations()) {
                  animation.pause();
                  const timing = animation.effect?.getTiming();
                  const loops = timing ? !Number.isFinite(Number(timing.iterations)) : true;
                  animation.currentTime = loops ? 1100 : Number(timing?.duration ?? 0) / 2;
                }
                resolve();
              }),
            );
          }),
      );
      await shot(page, "first-load-3-arriving");
    });

    test(`composer/ca-24/${theme}/${size.name}/empty`, async ({ page }) => {
      await open(page, "empty");
      await page.getByTestId("empty-build").waitFor();
      await page.waitForTimeout(300);
      await shot(page, "empty-build");
    });

    test(`composer/ca-24/${theme}/${size.name}/details-loading`, async ({ page }) => {
      await open(page, "details-loading");
      await page.locator('section[aria-label="Build"]').waitFor();
      if (size.mobile) await page.getByRole("button", { name: "Details", exact: true }).click();
      await page.getByTestId("details-loading").waitFor();
      await page.waitForTimeout(300);
      await freeze(page, 1100);
      await shot(page, "details-loading");
    });

    test(`composer/ca-24/${theme}/${size.name}/details-failed`, async ({ page }) => {
      await open(page, "details-failed");
      await page.locator('section[aria-label="Build"]').waitFor();
      if (size.mobile) await page.getByRole("button", { name: "Details", exact: true }).click();
      await page.getByText("Details didn't load").waitFor();
      await page.waitForTimeout(300);
      await shot(page, "details-failed");
    });

    test(`composer/ca-24/${theme}/${size.name}/import`, async ({ page }) => {
      await open(page, "import");
      await page.getByTestId("importing-tag").waitFor({ timeout: 10_000 });
      await page.waitForTimeout(300);
      await freeze(page, 1100);
      // 18 sockets are taller than a window: the whole page, from the head to the bar.
      await page.screenshot({ path: `${OUT}/slow-import-6-of-18-${theme}-${size.name}.png`, fullPage: true });
    });
  }
}
