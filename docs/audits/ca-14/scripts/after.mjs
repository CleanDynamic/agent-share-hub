// CA-14: the six steps of the brief on the stand-in, screenshotted at 1280 and 430 in both themes, then the reader's page.
//   node docs/audits/ca-14/scripts/after.mjs <out-dir>
// Each run starts from a fresh scenario draft (scenario.mjs): Session 1 typed (3 tiles), Session 2 imported (66 prompts),
// Session 3 started fresh.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API, SITE, session } from "../../ca-09/scripts/lib.mjs";
import { launch, openDraft } from "./shots.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(process.argv[2] ?? "docs/audits/ca-14/after");
mkdirSync(out, { recursive: true });

const scenario = () => execFileSync("node", [path.join(here, "scenario.mjs"), "--reset"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n").pop();

const browser = await launch();
const reply = [];

for (const size of ["desktop", "phone"]) {
  for (const theme of ["noon", "dusk"]) {
    const id = scenario();
    const { context, page } = await openDraft(browser, size, theme, id);
    const name = `${size}-${theme}`;
    const phone = size === "phone";
    let n = 0;
    const snap = async (label, focusKey) => {
      n += 1;
      const list = page.locator('[data-testid="build-list"]');
      const height = (await list.boundingBox())?.height ?? 0;
      const file = path.join(out, `${String(n).padStart(2, "0")}-${label}-${name}.png`);
      if (height < 2600) await list.screenshot({ path: file });
      else {
        if (focusKey) await page.locator(`[data-session-key="${focusKey}"] [data-testid="session-head"]`).scrollIntoViewIfNeeded();
        await page.screenshot({ path: file });
      }
    };
    const options = (number) => page.getByRole("button", { name: `Session ${number} options` });
    const menu = async (number, item) => {
      await options(number).click();
      await page.getByRole("menuitem", { name: item }).click();
      await page.waitForTimeout(3000);
    };
    const keyOf = async (number) => (await page.getByRole("group", { name: new RegExp(`^Session ${number} · `) }).first().evaluate((el) => el.closest("[data-session-key]").getAttribute("data-session-key")));

    // Titles: Planning on Session 1, Router on Session 2.
    for (const [number, title] of [[1, "Planning"], [2, "Router"]]) {
      const field = page.getByRole("textbox", { name: `Title of Session ${number}` });
      await field.fill(title);
      await field.press("Enter");
      await page.waitForTimeout(500);
    }
    await page.getByRole("button", { name: "Collapse Session 2" }).click();
    await page.waitForTimeout(500);
    await snap("start-titled-and-folded");

    // 1. Session 3 to the top.
    await menu(3, "Move up");
    await menu(2, "Move up");
    await snap("1-session-3-moved-to-the-top");

    // 2. Collapse Session 2 (now Session 3 holds the 66): it already is folded; fold and unfold once to show both.
    await page.getByRole("button", { name: /^Expand Session 3$/ }).click();
    await page.waitForTimeout(500);
    await snap("2a-the-long-session-open", await keyOf(3));
    await page.getByRole("button", { name: /^Collapse Session 3$/ }).click();
    await page.waitForTimeout(500);
    await snap("2b-the-long-session-folded");

    // 3. A tile in Session 1 (the fresh one) from the Add button at the top.
    await page.getByTestId(phone ? "sandbox-add" : "sandbox-add").click();
    await page.waitForTimeout(300);
    if (phone) {
      await page.getByRole("radio").first().click();
      await page.getByText("Prompt", { exact: true }).first().click();
    } else {
      await page.getByRole("menuitem", { name: /^Prompt/ }).click();
      await page.waitForTimeout(300);
      await snap("3a-which-session");
      await page.getByRole("radio", { name: /Session 1/ }).click();
    }
    await page.waitForTimeout(400);
    await page.getByRole("textbox", { name: "Add a prompt" }).fill("Start with the routes table");
    await page.getByRole("textbox", { name: "Add a prompt" }).press("Enter");
    await page.waitForTimeout(3500);
    await snap("3b-a-tile-in-session-1");

    // 4. View › Split and merge, then split the long session at its tile 10.
    await page.getByTestId("sandbox-view").click();
    await page.getByRole("menuitemcheckbox", { name: "Split and merge" }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /^Expand Session 3$/ }).click();
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: /^Prompt 14 options$/ }).scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: /^Prompt 14 options$/ }).click();
    await page.getByRole("menuitem", { name: "Split session here" }).click();
    await page.waitForTimeout(4000);
    await snap("4-split-at-tile-10", await keyOf(4));

    // 5. Merge it back.
    await page.getByRole("button", { name: "Session 4 options" }).scrollIntoViewIfNeeded();
    await menu(4, "Merge with the session above");
    await snap("5-merged-back", await keyOf(3));

    // 6. Reload.
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('[data-testid="build-list"]');
    await snap("6-after-reload");

    if (theme === "noon") {
      // The session list, on.
      await page.getByTestId("sandbox-view").click();
      await page.getByRole("menuitemcheckbox", { name: "Session list" }).click();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(out, `07-session-list-${name}.png`) });
    }
    await context.close();

    // The reader's page for the same draft, published.
    const reader = await openPublished(browser, size, theme);
    const steps = reader.getByTestId("build-steps").first();
    await steps.waitFor({ timeout: 15000 }).catch(() => undefined);
    await steps.scrollIntoViewIfNeeded().catch(() => undefined);
    await reader.waitForTimeout(500);
    await reader.screenshot({ path: path.join(out, `08-reader-${name}.png`) });
    await reader.context().close();
  }
}

async function openPublished(browser, size, theme) {
  const id = scenario();
  const token = (await session()).access_token;
  const headers = { "content-type": "application/json", apikey: "ca09-publishable-placeholder", authorization: `Bearer ${token}`, prefer: "return=representation" };
  const slug = `ca14-reader-${size}-${theme}`;
  await fetch(`${API}/rest/v1/builds?id=eq.${id}`, { method: "PATCH", headers, body: JSON.stringify({ status: "published", slug, published_at: new Date().toISOString(), outcome: "A router and a plan." }) });
  // The maker's titles and a folded long session, as the maker left them.
  const get = await (await fetch(`${API}/rest/v1/builds?id=eq.${id}&select=making`, { headers })).json();
  const making = get[0].making;
  const [first, second] = Object.keys(making.sessions_meta);
  making.sessions_meta[first].title = "Planning";
  making.sessions_meta[second].title = "Router";
  making.session_order = [Object.keys(making.sessions_meta)[2], first, second];
  making.sessions_collapsed = [second];
  await fetch(`${API}/rest/v1/builds?id=eq.${id}`, { method: "PATCH", headers, body: JSON.stringify({ making }) });
  const { context, page } = await openDraft(browser, size, theme, id, `/b2/${slug}`).catch(async () => {
    const ctx = await browser.newContext();
    return { context: ctx, page: await ctx.newPage() };
  });
  return page;
}

await browser.close();
reply.push(out);
console.log(reply.join("\n"));
void SITE;
