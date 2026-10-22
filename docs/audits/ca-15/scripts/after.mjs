// CA-15: every tile modal (closed, then with its first Optional row open) and the build list with every tile kind, at 1280 and 390
// wide, on the stand-in.
//   docs/audits/ca-09/scripts/standin.sh build && docs/audits/ca-09/scripts/standin.sh start
//   node docs/audits/ca-15/scripts/after.mjs docs/audits/ca-15/after
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { SITE, CHROMIUM, STORAGE_KEY, session } from "../../ca-09/scripts/lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] ?? "docs/audits/ca-15/after");
mkdirSync(out, { recursive: true });

const SIZES = {
  "1280": { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 },
  "390": { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};
const scenario = () => execFileSync("node", [path.join(here, "scenario.mjs"), "--reset"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").pop();

/** What each Add item opens: the menu's name, the dialog's name, and the file's name. */
const MODALS = [
  ["prompt-window", null, null],
  ["result", /^Result/, /result/i],
  ["tool", /^Tool/, /tool/i],
  ["check", /^Check/, /check/i],
  ["code", /^Code/, /^Add code/i],
  ["agent", /^Agent/, /agent/i],
  ["decision", /^Decision/, /decision/i],
  ["system-prompt", /^System prompt/, /system prompt/i],
  ["dataset", /^Dataset/, /dataset/i],
  ["github-repository", /^GitHub repository/, /github repository/i],
];

const browser = await chromium.launch({ executablePath: CHROMIUM, args: ["--ignore-certificate-errors"] });
const value = JSON.stringify(await session());

for (const [width, device] of Object.entries(SIZES)) {
  const phone = width === "390";
  const id = scenario();
  const context = await browser.newContext({ ...device, ignoreHTTPSErrors: true });
  await context.addInitScript(([key, v]) => {
    try {
      localStorage.setItem(key, v);
      localStorage.setItem("bg-theme", "noon");
    } catch {}
  }, [STORAGE_KEY, value]);
  const page = await context.newPage();
  await page.goto(`${SITE}/compose/${id}`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="build-list"]', { timeout: 30000 });
  await page.waitForTimeout(1500);

  // The build list with every tile kind.
  await page.locator('[data-testid="build-list"]').screenshot({ path: path.join(out, `build-list-${width}.png`) });

  const shotDialog = async (name, suffix) => {
    const dialog = page.getByRole("dialog").last();
    await dialog.screenshot({ path: path.join(out, `${name}-${suffix}-${width}.png`) });
  };
  const openFirstRow = async () => {
    const dialog = page.getByRole("dialog").last();
    const row = dialog.getByTestId("optional-field").first().locator("button").first();
    if ((await row.count()) > 0) {
      await row.click();
      await page.waitForTimeout(300);
    }
  };

  for (const [name, item, title] of MODALS) {
    if (!item) {
      // The prompt window opens from a prompt tile's footer link.
      await page.getByRole("button", { name: "Open prompt" }).first().click();
      await page.getByRole("dialog").last().waitFor({ timeout: 5000 });
    } else {
      await page.getByTestId("sandbox-add").first().click();
      await page.waitForTimeout(300);
      if (phone) await page.getByTestId("add-sheet").getByRole("button", { name: item }).first().click();
      else await page.getByRole("menuitem", { name: item }).first().click();
      await page.getByRole("dialog", { name: title }).last().waitFor({ timeout: 8000 });
    }
    await page.waitForTimeout(400);
    await shotDialog(name, "closed");
    await openFirstRow();
    await shotDialog(name, "row-open");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    if ((await page.getByRole("dialog").count()) > 0) await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
  await context.close();
}
await browser.close();
console.log("done", out);
