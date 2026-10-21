// CA-09 Part 3: a close look at Add › New session and Add › Prompt on one profile. Prints what Playwright sees when
// it presses each, where focus ends up and what covers it. Usage: node docs/audits/ca-09/scripts/probe-add.mjs desktop|iphone
import { open, SITE, standin, resetData, landmarks } from "./lib.mjs";
const profile = process.argv[2] ?? "desktop";
const L = await landmarks();
await resetData();
await standin({ latency: 120 });
const { browser, page } = await open(profile);
await page.goto(`${SITE}/compose/${L.sevenStep}`);
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(1500);
const add = page.getByTestId("sandbox-add").filter({ visible: true }).first();
await add.click();
await page.getByRole("menu").first().waitFor();
await page.waitForTimeout(300);
await page.screenshot({ path: new URL(`../measurements/screens/add-menu-open-${profile}.png`, import.meta.url).pathname });
const rows = await page.getByRole("menuitem").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return `${e.textContent.trim().slice(0, 30)} | ${Math.round(r.top)}-${Math.round(r.bottom)} | disabled=${e.getAttribute("data-disabled") !== null} | hit=${t === e || e.contains(t)} ${t && !(t === e || e.contains(t)) ? "(" + t.tagName + " " + (t.textContent || "").slice(0, 20) + ")" : ""}`; }));
console.log(rows.join("\n"));
const item = page.getByRole("menuitem").filter({ hasText: /^\s*New session/ }).first();
try { await item.click({ timeout: 3000, trial: true }); console.log("New session: trial click ok"); } catch (e) { console.log("New session trial:", e.message.split("\n").slice(0, 12).join(" | ")); }
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await add.click();
await page.getByRole("menu").first().waitFor();
await page.getByRole("menuitem").filter({ hasText: /^\s*Prompt/ }).first().click();
for (const ms of [0, 50, 200, 600, 1500]) {
  await page.waitForTimeout(ms);
  console.log(`after +${ms}ms`, await page.evaluate(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, Math.max(1, Math.min(r.top + 10, innerHeight - 1))); return `${a.tagName} ${a.getAttribute("data-testid") ?? ""} ${a.getAttribute("aria-label") ?? a.getAttribute("placeholder") ?? (a.textContent || "").trim().slice(0, 30)} top=${Math.round(r.top)} bottom=${Math.round(r.bottom)} vh=${innerHeight} scrollY=${Math.round(scrollY)} under=${top ? top.tagName + ":" + (top.getAttribute("data-testid") ?? (top.textContent || "").trim().slice(0, 15)) : "-"}`; }));
}
await page.screenshot({ path: new URL(`../measurements/screens/add-prompt-after-${profile}.png`, import.meta.url).pathname });
await browser.close();
