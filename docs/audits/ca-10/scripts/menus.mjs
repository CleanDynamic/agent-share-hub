// CA-10 Part 2: every composer menu fits the screen. On the CA-09 stand-in (docs/audits/ca-09/standin.md), at
// 1280×600, 1280×900, 390×664 and 430×739, with the menu's button scrolled to the top, the middle and the bottom of the
// screen, open each menu in the Build panel (Add, each step's "… options", the session and picker menus, Add › Session
// on a computer) and check every row: its box is fully inside the viewport and clear of the header (and on a phone of
// the dock and action bar), or the menu itself is, and scrolls inside itself to reach the row. On a phone Add is a
// bottom sheet: the same check on its rows. Usage: node docs/audits/ca-10/scripts/menus.mjs [desktop|phone]
// Writes docs/audits/ca-10/after/menus.json and prints one line per menu and position.
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PROFILES, open, SITE, standin, resetData, landmarks } from "../../ca-09/scripts/lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../after");
const only = process.argv[2];

const desktop = (w, h) => ({ name: `${w}x${h}`, context: { viewport: { width: w, height: h }, deviceScaleFactor: 1 }, cpu: 1, network: null });
const phone = (w, h) => ({ name: `${w}x${h}`, context: { ...PROFILES.iphone.context, viewport: { width: w, height: h } }, cpu: 1, network: null });
const VIEWPORTS = [
  ["desktop", desktop(1280, 600)],
  ["desktop", desktop(1280, 900)],
  ["phone", phone(390, 664)],
  ["phone", phone(430, 739)],
].filter(([kind]) => !only || kind === only);

// Mirrors src/pages/site/compose/composeChrome.ts: header 48; on a phone the dock (57) + gap (35) + action bar (66).
const HEADER = 48;
const PHONE_BOTTOM = 158;

const L = await landmarks();
const results = [];
let failures = 0;

for (const [kind, profile] of VIEWPORTS) {
  PROFILES[profile.name] = profile;
  for (const route of [`/compose/${L.sevenStep}`, "/compose/new"]) {
    await resetData();
    await standin({ latency: 0 });
    const { browser, page } = await open(profile.name);
    await page.goto(SITE + route);
    await page.getByTestId("sandbox-add").filter({ visible: true }).first().waitFor({ timeout: 20_000 });
    await page.waitForTimeout(800);
    // Room above and below the page, so any button can be scrolled to any height on the screen.
    await page.evaluate(() => {
      const main = document.querySelector("#main");
      for (const where of ["afterbegin", "beforeend"]) main.insertAdjacentHTML(where, '<div data-ca10-spacer style="height:1600px;flex-shrink:0"></div>');
    });
    const buttons = await page.evaluate(() => {
      const build = document.querySelector('section[aria-label="Build"]');
      const out = [];
      for (const el of build.querySelectorAll('button[aria-haspopup="menu"], button[aria-haspopup="dialog"][data-testid="sandbox-add"]')) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2 || el.disabled) continue;
        el.setAttribute("data-ca10-menu", String(out.length));
        out.push(el.getAttribute("aria-label") || (el.textContent || "").trim().slice(0, 30) || el.getAttribute("data-testid"));
      }
      return out;
    });
    for (const [index, label] of buttons.entries()) {
      for (const at of ["top", "middle", "bottom"]) {
        const vh = profile.context.viewport.height;
        const bottomEdge = kind === "phone" ? vh - PHONE_BOTTOM : vh;
        const y = at === "top" ? HEADER + 12 : at === "middle" ? vh / 2 : bottomEdge - 50;
        await page.evaluate(([i, target]) => {
          const el = document.querySelector(`[data-ca10-menu="${i}"]`);
          window.scrollBy(0, el.getBoundingClientRect().top - target);
        }, [index, y]);
        await page.waitForTimeout(100);
        const button = page.locator(`[data-ca10-menu="${index}"]`);
        await button.click();
        const surface = page.locator('[role=menu], [data-testid="add-sheet"]').last();
        try {
          await surface.waitFor({ state: "visible", timeout: 3000 });
        } catch {
          results.push({ viewport: profile.name, route, menu: label, at, opened: false });
          console.log(`${profile.name} ${route.slice(0, 20)} ${label} @${at}: did not open`);
          continue;
        }
        await page.waitForTimeout(250);
        const check = async () =>
          page.evaluate(([phoneView, header, phoneBottom]) => {
            const vh = innerHeight;
            const vw = innerWidth;
            const sheet = document.querySelector('[data-testid="add-sheet"]');
            const menus = [...document.querySelectorAll("[role=menu]")];
            const surfaces = sheet ? [sheet] : menus;
            const floorOf = (el) => (el === sheet ? vh : phoneView ? vh - phoneBottom : vh);
            const topOf = (el) => (el === sheet ? 0 : header);
            const bad = [];
            let rows = 0;
            for (const s of surfaces) {
              const box = s.getBoundingClientRect();
              const surfaceInside = box.top >= topOf(s) - 0.5 && box.bottom <= floorOf(s) + 0.5 && box.left >= -0.5 && box.right <= vw + 0.5;
              const scrolls = s.scrollHeight > s.clientHeight + 1 && getComputedStyle(s).overflowY !== "visible";
              const items = sheet ? [...s.querySelectorAll('[role="group"] button')] : [...s.querySelectorAll("[role=menuitem], [role=menuitemcheckbox], [role=menuitemradio]")];
              for (const item of items) {
                rows += 1;
                const r = item.getBoundingClientRect();
                const inside = r.top >= topOf(s) - 0.5 && r.bottom <= floorOf(s) + 0.5 && r.left >= -0.5 && r.right <= vw + 0.5;
                // A row outside the screen is fine only inside a menu that is itself on screen and scrolls to it.
                const reachable = surfaceInside && scrolls && r.top >= box.top - s.scrollHeight && r.bottom <= box.top + s.scrollHeight;
                if (!inside && !reachable) bad.push(`${(item.textContent || "").trim().slice(0, 24)} ${Math.round(r.top)}..${Math.round(r.bottom)}`);
              }
              if (!surfaceInside) bad.push(`surface ${Math.round(box.top)}..${Math.round(box.bottom)} of ${vh}`);
            }
            return { rows, bad };
          }, [kind === "phone", HEADER, PHONE_BOTTOM]);
        let seen = await check();
        // Add › Session's submenu, on a computer.
        if (kind === "desktop" && label === "Add") {
          const session = page.getByRole("menuitem").filter({ hasText: /^\s*Session/ }).first();
          if (await session.isVisible().catch(() => false)) {
            await session.hover();
            await page.waitForTimeout(300);
            const sub = await check();
            seen = { rows: sub.rows, bad: [...new Set([...seen.bad, ...sub.bad])] };
          }
        }
        const ok = seen.rows > 0 && seen.bad.length === 0;
        if (!ok) failures += 1;
        results.push({ viewport: profile.name, route, menu: label, at, opened: true, rows: seen.rows, outside: seen.bad });
        console.log(`${profile.name.padEnd(8)} ${route.startsWith("/compose/new") ? "new  " : "draft"} ${String(label).padEnd(26)} @${at.padEnd(6)} rows ${String(seen.rows).padStart(2)}  ${ok ? "all on screen" : "OUTSIDE: " + seen.bad.join("; ")}`);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(150);
        if (await surface.isVisible().catch(() => false)) await page.keyboard.press("Escape");
        await page.waitForTimeout(150);
      }
    }
    await browser.close();
  }
}

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, `menus${only ? "-" + only : ""}.json`), JSON.stringify({ failures, results }, null, 2));
console.log(failures === 0 ? "PASS: every row of every composer menu is on screen or reachable inside its menu" : `FAIL: ${failures} menu openings had a row off screen`);
process.exit(failures === 0 ? 0 : 1);
