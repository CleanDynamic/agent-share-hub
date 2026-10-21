// CA-09 Part 5: the phone, at 390 and 430 points wide (iPhone 15 Pro Max emulation in Chromium, touch, DPR 3), on
// every route. Reads computed boxes and styles; changes nothing. Per route:
//   - fixed and sticky bars, and how many points of the screen are left for the page;
//   - 100vh in use (iOS Safari's 100vh is the tallest viewport, so a 100vh box runs under the toolbar) and
//     whether anything pads for the safe area (env(safe-area-inset-*));
//   - fields whose text is under 16 px (iOS zooms the page when one is focused);
//   - horizontal scroll, and the elements wider than the screen;
//   - touch targets under 44 × 44;
//   - desktop-only words ("click", "double-click", "hover", "right-click", "mouse");
//   - the spacing method Miles approved: one 16 pt left edge; gaps 4, 8, 16, 32 only; drawn buttons 36 tall inside
//     44 touch areas; text at 22, 18, 15, 13, 11. Reported as counts and the most common values that break it.
// Usage: node docs/audits/ca-09/scripts/phone.mjs  (writes phone/phone-<width>.json and screenshots)
import { chromium, devices } from "@playwright/test";
import { SITE, CHROMIUM, STORAGE_KEY, session, landmarks, write, OUT } from "./lib.mjs";
import path from "node:path";
import { mkdirSync } from "node:fs";

const L = await landmarks();
const ROUTES = [
  ["home", "/"], ["gallery", "/gallery"], ["build", `/b2/${L.showcaseSlug}`], ["drafts", "/drafts"], ["compose-new", "/compose/new"],
  ["compose-7step", `/compose/${L.sevenStep}`], ["compose-thread", `/compose/${L.thread}`], ["profile", `/profile/${L.profileHandle}`], ["messages", "/messages"],
];
const base = { ...devices["iPhone 15 Pro Max"] };
delete base.defaultBrowserType;
const WIDTHS = { 430: { width: 430, height: 739 }, 390: { width: 390, height: 664 } };
mkdirSync(path.join(OUT, "phone"), { recursive: true });

const PROBE = () => {
  const vw = innerWidth;
  const vh = innerHeight;
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0;
  };
  const name = (el) => (el.getAttribute("data-testid") || el.getAttribute("aria-label") || el.tagName.toLowerCase() + ":" + (el.textContent || "").trim().slice(0, 24)).slice(0, 50);
  const all = [...document.querySelectorAll("body *")].filter((el) => !el.closest("canvas, svg, [aria-hidden=true]"));

  // bars
  const bars = [];
  for (const el of all) {
    const s = getComputedStyle(el);
    if (s.position !== "fixed" && s.position !== "sticky") continue;
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < vw * 0.5 || r.height > vh * 0.6) continue; // a bar spans the screen and is not a sheet
    const edge = r.top <= 1 ? "top" : r.bottom >= vh - 1 ? "bottom" : "floating";
    if (bars.some((b) => b.el.contains(el))) continue;
    bars.push({ el, edge, position: s.position, top: Math.round(r.top), height: Math.round(r.height), name: name(el) });
  }
  const covered = { top: 0, bottom: 0, floating: 0 };
  for (const b of bars) covered[b.edge] = Math.max(covered[b.edge], b.edge === "top" ? b.top + b.height : b.edge === "bottom" ? vh - b.top : b.height);
  const floatingSum = bars.filter((b) => b.edge === "floating").reduce((s, b) => s + b.height, 0);

  // 100vh and safe areas, from the stylesheets and inline styles
  let vhRules = 0;
  let dvhRules = 0;
  let safeRules = 0;
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        const t = rule.cssText;
        vhRules += (t.match(/100vh/g) || []).length;
        dvhRules += (t.match(/\d+(dvh|svh|lvh)/g) || []).length;
        safeRules += (t.match(/safe-area-inset/g) || []).length;
      }
    } catch {}
  }
  const inlineVh = all.filter((el) => /100vh/.test(el.getAttribute("style") || "")).map(name);
  const inlineSafe = all.filter((el) => /safe-area-inset/.test(el.getAttribute("style") || "")).length;
  const tallBoxes = all.filter((el) => vis(el) && Math.abs(el.getBoundingClientRect().height - vh) < 1 && /vh|h-screen|min-h-screen/.test((el.getAttribute("style") || "") + " " + (el.className?.baseVal ?? el.className ?? ""))).map(name);

  // fields under 16px
  const fields = all.filter((el) => (el.matches("input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]), textarea, select, [contenteditable=true]")) && vis(el));
  const smallFields = fields.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16).map((el) => `${name(el)} ${getComputedStyle(el).fontSize}`);

  // horizontal scroll
  const sw = document.scrollingElement.scrollWidth;
  const wide = all.filter((el) => vis(el) && el.getBoundingClientRect().right > vw + 1 && getComputedStyle(el).position !== "fixed").filter((el) => !all.some((p) => p !== el && p.contains(el) && p.getBoundingClientRect().right > vw + 1 && getComputedStyle(p).overflowX === "visible" && false)).slice(0, 8).map((el) => `${name(el)} right=${Math.round(el.getBoundingClientRect().right)}`);

  // touch targets
  const controls = all.filter((el) => el.matches("a[href], button, [role=button], [role=tab], [role=menuitem], [role=checkbox], [role=switch], input, select, textarea, summary, [tabindex='0']") && vis(el));
  const small = controls.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width < 44 || r.height < 44;
  });
  const smallList = small.slice(0, 400).map((el) => {
    const r = el.getBoundingClientRect();
    return `${name(el)} ${Math.round(r.width)}×${Math.round(r.height)}`;
  });

  // desktop words
  const words = [...new Set((document.body.innerText.match(/[^.\n]*\b(double-click|right-click|click|hover|mouse)\b[^.\n]*/gi) || []).map((s) => s.trim().slice(0, 90)))];

  // the spacing method
  const SIZES = [22, 18, 15, 13, 11];
  const GAPS = [0, 4, 8, 16, 32];
  const textLeaves = all.filter((el) => vis(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  const tally = (list) => Object.entries(list.reduce((m, v) => ((m[v] = (m[v] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
  const fontOff = textLeaves.map((el) => parseFloat(getComputedStyle(el).fontSize)).filter((v) => !SIZES.includes(Math.round(v * 10) / 10));
  const leftEdges = textLeaves.map((el) => Math.round(el.getBoundingClientRect().left)).filter((x) => x >= 0 && x < vw / 2);
  const gapsOff = [];
  const padOff = [];
  for (const el of all) {
    if (!vis(el)) continue;
    const s = getComputedStyle(el);
    if (s.display.includes("flex") || s.display.includes("grid")) for (const g of [s.rowGap, s.columnGap]) if (g !== "normal" && !GAPS.includes(Math.round(parseFloat(g)))) gapsOff.push(Math.round(parseFloat(g)));
    for (const p of [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft]) if (!GAPS.includes(Math.round(parseFloat(p)))) padOff.push(Math.round(parseFloat(p)));
  }
  const buttons = controls.filter((el) => el.matches("button, [role=button]"));
  const btnHeights = tally(buttons.map((el) => Math.round(el.getBoundingClientRect().height)));
  const main = document.querySelector("main") ?? document.body;
  const mainLeft = Math.round(main.getBoundingClientRect().left);
  return {
    viewport: { w: vw, h: vh },
    bars: bars.map(({ el, ...b }) => b),
    pointsLeft: Math.max(0, vh - covered.top - covered.bottom - floatingSum),
    coveredTop: covered.top,
    coveredBottom: covered.bottom,
    floatingBars: floatingSum,
    vh100Rules: vhRules,
    dynamicViewportRules: dvhRules,
    safeAreaRules: safeRules + inlineSafe,
    inline100vh: inlineVh,
    fullHeightBoxes: tallBoxes.slice(0, 6),
    fieldsUnder16: smallFields,
    horizontalScroll: sw > vw + 1 ? sw - vw : 0,
    tooWide: sw > vw + 1 ? wide : [],
    controls: controls.length,
    targetsUnder44: small.length,
    targetsUnder44List: smallList,
    desktopWords: words,
    spacing: {
      textElements: textLeaves.length,
      textOffScale: fontOff.length,
      textOffScaleTop: tally(fontOff.map((v) => `${v}px`)).slice(0, 8),
      leftEdges: tally(leftEdges).slice(0, 10),
      leftEdgesNot16: leftEdges.filter((x) => x !== 16).length,
      gapsOffScale: gapsOff.length,
      gapsOffScaleTop: tally(gapsOff).slice(0, 8),
      paddingsOffScale: padOff.length,
      paddingsOffScaleTop: tally(padOff).slice(0, 8),
      buttonHeights: btnHeights.slice(0, 8),
      buttonsAt36: buttons.filter((el) => Math.round(el.getBoundingClientRect().height) === 36).length,
      buttons: buttons.length,
      mainLeft,
    },
  };
};

for (const [width, viewport] of Object.entries(WIDTHS)) {
  const results = [];
  const browser = await chromium.launch({ executablePath: CHROMIUM, args: ["--ignore-certificate-errors"] });
  for (const [name, route] of ROUTES) {
    const context = await browser.newContext({ ...base, viewport, ignoreHTTPSErrors: true });
    const value = JSON.stringify(await session());
    await context.addInitScript(([k, v]) => localStorage.setItem(k, v), [STORAGE_KEY, value]);
    const page = await context.newPage();
    await page.goto(SITE + route);
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const r = await page.evaluate(PROBE);
    await page.screenshot({ path: path.join(OUT, "phone", `${width}-${name}.png`) });
    results.push({ route: name, ...r });
    console.log(`${width} ${name.padEnd(15)} left ${String(r.pointsLeft).padStart(4)}/${r.viewport.h} pt  bars ${r.bars.length}  fields<16 ${r.fieldsUnder16.length}  hscroll ${r.horizontalScroll}  targets<44 ${r.targetsUnder44}/${r.controls}  words ${r.desktopWords.length}  text off-scale ${r.spacing.textOffScale}/${r.spacing.textElements}  gaps off ${r.spacing.gapsOffScale}  left edges ${JSON.stringify(r.spacing.leftEdges.slice(0, 4))}`);
    await context.close();
  }
  await browser.close();
  write(`phone/phone-${width}.json`, results);
}
