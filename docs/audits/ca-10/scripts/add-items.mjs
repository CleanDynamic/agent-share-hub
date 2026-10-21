// CA-10 Part 3: every Add item visibly does something, measured in the browser on the CA-09 stand-in. On a draft and
// on /compose/new, at a computer's width (1280×800) and a phone's (430×739, 390×664): press Add, then each item, and
// check what the maker sees.
//   - Prompt: the add-prompt field is document.activeElement, and its box is inside the viewport, below the header and
//     (on a phone) above the dock and action bar, at 0 ms and at 600 ms.
//   - New session, Agent or team, Tool, Manual step, Code, Check: a dialog is open and fully on screen (Check may be
//     disabled, saying why).
//   - File: the file chooser opens.
//   - Result: something is drawn within 300 ms, and the new Result tile ends up inside the viewport.
// Usage: node docs/audits/ca-10/scripts/add-items.mjs [desktop|phone]. Writes docs/audits/ca-10/after/add-items.json.
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PROFILES, open, SITE, standin, resetData, landmarks } from "../../ca-09/scripts/lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../after");
const only = process.argv[2];
const HEADER = 48;
const PHONE_BOTTOM = 158;

const VIEWPORTS = [
  ["desktop", { name: "1280x800", context: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }, cpu: 1, network: null }],
  ["phone", { name: "430x739", context: { ...PROFILES.iphone.context }, cpu: 1, network: null }],
  ["phone", { name: "390x664", context: { ...PROFILES.iphone.context, viewport: { width: 390, height: 664 } }, cpu: 1, network: null }],
].filter(([kind]) => !only || kind === only);

const L = await landmarks();
const ITEMS = ["Prompt", "New session", "Agent or team", "File", "Tool", "Manual step", "Code", "Check", "Result"];
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const results = [];
let failures = 0;

for (const [kind, profile] of VIEWPORTS) {
  PROFILES[profile.name] = profile;
  const floor = profile.context.viewport.height - (kind === "phone" ? PHONE_BOTTOM : 0);
  for (const route of [`/compose/${L.sevenStep}`, "/compose/new"]) {
    for (const item of ITEMS) {
      await resetData();
      await standin({ latency: 120 });
      const { browser, page } = await open(profile.name);
      await page.goto(SITE + route);
      const add = page.getByTestId("sandbox-add").filter({ visible: true }).first();
      await add.waitFor({ timeout: 20_000 });
      await page.waitForTimeout(1200);
      await add.click();
      await page.locator('[role=menu], [data-testid="add-sheet"]').first().waitFor({ state: "visible", timeout: 5000 });
      const row = page.locator("[role=menuitem], [data-testid=add-sheet] [role=group] button").filter({ hasText: new RegExp(`^\\s*${esc(item)}`) }).filter({ visible: true }).first();
      const disabled = (await row.getAttribute("aria-disabled")) === "true" || (await row.getAttribute("disabled")) !== null;
      let verdict = "";
      let detail = "";
      if (disabled) {
        const words = (await row.textContent()) ?? "";
        verdict = item === "Check" && /first/.test(words) ? "shown disabled, says why" : "DISABLED";
        detail = words;
      } else if (item === "File") {
        const chooser = page.waitForEvent("filechooser", { timeout: 3000 }).then(() => true).catch(() => false);
        await row.click();
        verdict = (await chooser) ? "file chooser opened" : "NOTHING";
      } else {
        await row.click();
        const at = async (ms) => {
          if (ms) await page.waitForTimeout(ms);
          return page.evaluate(([floorY, header]) => {
            const inside = (r) => r.top >= header - 0.5 && r.bottom <= floorY + 0.5 && r.left >= -0.5 && r.right <= innerWidth + 0.5;
            const a = document.activeElement;
            const field = document.querySelector('textarea[aria-label="Add a prompt"]');
            const dialog = [...document.querySelectorAll("[role=dialog]")].find((d) => d.getAttribute("data-testid") !== "add-sheet");
            const pending = document.querySelector('[data-testid="add-pending"]');
            const results = [...document.querySelectorAll('[data-testid="result-card"]')];
            const box = (el) => (el ? el.getBoundingClientRect() : null);
            const dbox = box(dialog);
            return {
              focusField: Boolean(field) && a === field,
              fieldBox: field ? [Math.round(box(field).top), Math.round(box(field).bottom)] : null,
              fieldInside: field ? inside(box(field)) : false,
              dialog: dialog ? (dialog.getAttribute("aria-label") || dialog.querySelector("h2")?.textContent || "dialog").slice(0, 40) : null,
              dialogOnScreen: dbox ? dbox.top >= -0.5 && dbox.bottom <= innerHeight + 0.5 && dbox.left >= -0.5 && dbox.right <= innerWidth + 0.5 : false,
              pendingInside: pending ? inside(box(pending)) : false,
              lastResultInside: results.length ? inside(box(results[results.length - 1])) : false,
              results: results.length,
              path: location.pathname,
            };
          }, [floor, HEADER]);
        };
        const t0 = await at(0);
        const t300 = await at(300);
        const t600 = await at(300);
        if (item === "Prompt") {
          const ok = t0.focusField && t0.fieldInside && t600.focusField && t600.fieldInside;
          verdict = ok ? "field focused and on screen at 0 and 600 ms" : "NOT VISIBLE OR NOT FOCUSED";
          detail = `0ms ${JSON.stringify(t0.fieldBox)} focus=${t0.focusField}; 600ms ${JSON.stringify(t600.fieldBox)} focus=${t600.focusField}; floor ${floor}`;
        } else if (item === "Result") {
          let end = t600;
          for (let i = 0; i < 20 && !(end.lastResultInside && end.results > 0 && !end.pendingInside); i += 1) end = await at(250);
          const quick = t0.pendingInside || t300.pendingInside || t0.lastResultInside;
          const ok = quick && end.lastResultInside;
          verdict = ok ? "tile drawn at once, new Result on screen" : "NOT SHOWN";
          detail = `pending at 0 ms ${t0.pendingInside}, at 300 ms ${t300.pendingInside}; result on screen ${end.lastResultInside} (${end.path})`;
        } else {
          let end = t600;
          for (let i = 0; i < 8 && !end.dialog; i += 1) end = await at(250);
          const ok = Boolean(end.dialog) && end.dialogOnScreen;
          verdict = ok ? "dialog open, on screen" : "NO DIALOG ON SCREEN";
          detail = `${end.dialog ?? "none"}`;
        }
      }
      const pass = !/^[A-Z ]+$/.test(verdict) || verdict === "";
      const failed = /NOTHING|NOT |NO DIALOG|DISABLED/.test(verdict);
      if (failed) failures += 1;
      results.push({ viewport: profile.name, route: route.endsWith("/new") ? "new post" : "draft", item, verdict, detail, pass: pass && !failed });
      console.log(`${profile.name.padEnd(8)} ${route.endsWith("/new") ? "new  " : "draft"} ${item.padEnd(13)} ${verdict}${detail ? "  · " + detail : ""}`);
      await browser.close();
    }
  }
}

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, `add-items${only ? "-" + only : ""}.json`), JSON.stringify({ failures, results }, null, 2));
console.log(failures === 0 ? "PASS: every Add item visibly does something" : `FAIL: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
