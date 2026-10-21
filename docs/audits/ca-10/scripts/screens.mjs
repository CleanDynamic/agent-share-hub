// CA-10 Part 5: the screenshots for the pull request, on the CA-09 stand-in, at 1280 and 430 wide, in both themes
// (Noon and Dusk):
//   1. Drafts with the sessions read failing (57014);
//   2. the Add menu on a computer, with the button low on the screen (1280 only);
//   3. the Add sheet on a phone (430 only);
//   4. the add-prompt field focused after Add › Prompt;
//   5. the "Not saved" line, after the database refuses a title (23514).
// Usage: node docs/audits/ca-10/scripts/screens.mjs. Writes docs/audits/ca-10/after/screens/*.png.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PROFILES, open, SITE, standin, resetData, landmarks } from "../../ca-09/scripts/lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../after/screens");
mkdirSync(OUT, { recursive: true });
const L = await landmarks();
const WAITING = "^/rest/v1/import_sessions\\?.*status=in\\.\\(parsed\\)(&|$)";
const T57014 = { status: 500, body: { code: "57014", details: null, hint: null, message: "canceling statement due to statement timeout" } };
const CHECK = { status: 400, body: { code: "23514", details: "Failing row contains (…).", hint: null, message: 'new row for relation "builds" violates check constraint "builds_title_check"' } };

PROFILES.w1280 = { name: "w1280", context: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }, cpu: 1, network: null };
PROFILES.w430 = { name: "w430", context: { ...PROFILES.iphone.context }, cpu: 1, network: null };

async function page(profile, theme) {
  const opened = await open(profile);
  await opened.context.addInitScript((value) => {
    try {
      localStorage.setItem("bg-theme", value);
    } catch {}
  }, theme);
  return opened;
}

const shot = (p, name) => p.screenshot({ path: path.join(OUT, name) });

for (const [profile, width] of [["w1280", 1280], ["w430", 430]]) {
  const phone = width < 768;
  for (const theme of ["noon", "dusk"]) {
    const tag = `${width}-${theme}`;

    // 1. Drafts, the sessions read failing.
    await resetData();
    await standin({ latency: 120, faults: [{ method: "GET", path: WAITING, ...T57014 }] });
    {
      const { browser, page: p } = await page(profile, theme);
      await p.goto(`${SITE}/drafts`);
      await p.getByText("Code 57014").first().waitFor({ timeout: 20_000 });
      await p.waitForTimeout(400);
      await shot(p, `drafts-sessions-failing-${tag}.png`);
      await browser.close();
    }

    // 2 / 3. The Add menu low on a computer's screen; the Add sheet on a phone.
    await resetData();
    await standin({ latency: 0, faults: [] });
    {
      const { browser, page: p } = await page(profile, theme);
      await p.goto(`${SITE}/compose/${L.sevenStep}`);
      const add = p.getByTestId("sandbox-add").filter({ visible: true }).first();
      await add.waitFor({ timeout: 20_000 });
      await p.waitForTimeout(800);
      if (!phone) {
        await p.evaluate(() => {
          const el = document.querySelector('[data-testid="sandbox-add"]');
          window.scrollBy(0, el.getBoundingClientRect().top - (innerHeight - 90));
        });
        await p.waitForTimeout(200);
      }
      await add.click();
      await p.locator('[role=menu], [data-testid="add-sheet"]').first().waitFor({ state: "visible" });
      await p.waitForTimeout(400);
      await shot(p, phone ? `add-sheet-${tag}.png` : `add-menu-low-${tag}.png`);

      // 4. Add › Prompt: the field, focused.
      const row = p.locator("[role=menuitem], [data-testid=add-sheet] [role=group] button").filter({ hasText: /^\s*Prompt/ }).first();
      await row.click();
      await p.waitForTimeout(300);
      await shot(p, `add-prompt-focused-${tag}.png`);
      await browser.close();
    }

    // 5. The "Not saved" line: the database refuses a title.
    await resetData();
    await standin({ latency: 0, faults: [{ method: "PATCH", path: "^/rest/v1/builds\\?", ...CHECK }] });
    {
      const { browser, page: p } = await page(profile, theme);
      await p.goto(`${SITE}/compose/${L.sevenStep}`);
      await p.getByTestId("sandbox-add").filter({ visible: true }).first().waitFor({ timeout: 20_000 });
      await p.getByRole("button", { name: "Card" }).filter({ visible: true }).first().click();
      const title = p.getByLabel("Title").filter({ visible: true }).first();
      await title.fill("Pantry inventory helper, refused");
      await p.keyboard.press("Escape");
      await p.getByTestId("save-problem").waitFor({ timeout: 10_000 });
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.waitForTimeout(300);
      await shot(p, `not-saved-${tag}.png`);
      await browser.close();
    }
    console.log(`screens ${tag} done`);
  }
}
