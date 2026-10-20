// Usage: node shoot.mjs <outdir> <name> <path> [selector]
import { chromium } from "playwright";
const [, , out, prefix, ...pairs] = process.argv;
const base = process.env.BASE ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const spec of pairs) {
  const [name, path, click] = spec.split("|");
  for (const theme of ["noon", "dusk"]) {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      const url = `${base}${path}${path.includes("?") ? "&" : "?"}theme=${theme}`;
      await page.goto(url, { waitUntil: "networkidle" }).catch(() => {});
      await page.evaluate((th) => { document.documentElement.setAttribute("data-theme", th); try { localStorage.setItem("theme", th); } catch {} }, theme);
      if (click) { for (const c of click.split(";")) { await page.locator(c).first().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(400); } }
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${out}/${prefix}-${name}-${theme}-${width}.png`, fullPage: true });
      await page.close();
    }
  }
}
await browser.close();
