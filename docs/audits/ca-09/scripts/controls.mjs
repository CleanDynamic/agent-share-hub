// CA-09 Part 3: list every button, link, menu trigger and field on a screen, with its name, box and whether it can
// be hit at its centre (nothing drawn over it). Usage: node docs/audits/ca-09/scripts/controls.mjs /drafts desktop
import { open, SITE, standin, resetData } from "./lib.mjs";

const route = process.argv[2] ?? "/drafts";
const profile = process.argv[3] ?? "desktop";
await resetData();
await standin({ latency: 0 });
const { browser, page } = await open(profile);
await page.goto(SITE + route);
await page.waitForTimeout(4000);
const list = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("button, a[href], [role=button], [role=tab], [role=menuitem], input, textarea, [contenteditable=true], select, [tabindex='0']")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const name = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || el.getAttribute("title") || "").trim().replace(/\s+/g, " ").slice(0, 60);
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const inView = cy >= 0 && cy <= innerHeight && cx >= 0 && cx <= innerWidth;
    const top = inView ? document.elementFromPoint(cx, cy) : null;
    out.push({ tag: el.tagName.toLowerCase(), role: el.getAttribute("role"), name, testid: el.getAttribute("data-testid"), x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), inView, hittable: inView ? Boolean(top && (top === el || el.contains(top))) : null, cover: inView && top && !(top === el || el.contains(top)) ? (top.getAttribute("data-testid") || top.tagName.toLowerCase() + (top.textContent ? ":" + top.textContent.trim().slice(0, 20) : "")) : null, disabled: el.disabled || el.getAttribute("aria-disabled") === "true" });
  }
  return out;
});
for (const c of list) console.log(`${c.tag}${c.role ? "[" + c.role + "]" : ""} "${c.name}" ${c.testid ? "#" + c.testid : ""} ${c.x},${c.y} ${c.w}x${c.h}${c.inView ? "" : " offscreen"}${c.hittable === false ? " COVERED by " + c.cover : ""}${c.disabled ? " disabled" : ""}`);
await browser.close();
