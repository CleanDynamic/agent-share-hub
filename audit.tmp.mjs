import { chromium } from "@playwright/test";
const BASE = "http://127.0.0.1:5199";
const ROUTES = [
  "/b/demo", "/b/demo/thread", "/b/demo/leaderboard", "/b/demo/lineage",
  "/content/demo", "/content/demo/edit", "/project/demo", "/collections/demo",
  "/search?q=agent", "/browse", "/discover", "/category/automation", "/recent", "/fyp",
  "/about", "/api-docs", "/admin", "/admin/login",
  "/upload", "/upload/blueprint", "/upload/blog", "/upload/bounty", "/bounty/new",
];
const OLD = {
  "rgb(46, 196, 182)": "#2EC4B6", "rgb(31, 122, 109)": "#1F7A6D",
  "rgb(232, 87, 26)": "#E8571A", "rgb(212, 71, 15)": "#D4470F",
  "rgb(139, 69, 19)": "#8B4513", "rgb(37, 37, 47)": "#25252F",
  "rgb(245, 158, 11)": "#F59E0B", "rgb(124, 58, 237)": "#7C3AED",
  "rgb(52, 211, 153)": "#34D399", "rgb(255, 230, 109)": "#FFE66D",
  "rgb(252, 186, 211)": "#FCBAD3", "rgb(245, 245, 220)": "#F5F5DC",
  "rgb(78, 205, 196)": "#4ECDC4", "rgb(209, 213, 219)": "#D1D5DB",
  "rgb(180, 83, 9)": "#B45309", "rgb(74, 207, 123)": "#4ACF7B",
};
// The Exhibition token values. Seeing one of these while the root says dusk
// means the page is painting the wrong room, which is its own kind of bug.
const EXHIBITION_ONLY = { "rgb(27, 32, 38)": "--text", "rgb(86, 94, 102)": "--text2", "rgb(228, 230, 232)": "--bg" };
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let pal = 0, contrast = 0, white = 0, wrongRoom = 0, navErrs = 0, done = 0;
for (const theme of ["exhibition", "dusk"]) {
  for (const width of [1400, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    await ctx.addInitScript((t) => { try { localStorage.setItem("bg-theme", t); } catch {} }, theme);
    const page = await ctx.newPage();
    page.on("pageerror", () => {});
    for (const route of ROUTES) {
      try {
        await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(900);
        const resolved = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
        if (resolved !== theme) { console.log(`THEME ${theme}/${width} ${route}: root says "${resolved}"`); }
        const res = await page.evaluate(([OLDMAP, EXONLY, isDusk]) => {
          const PROPS = ["color","backgroundColor","borderTopColor","borderBottomColor","borderLeftColor","borderRightColor","fill","stroke"];
          const out = { pal: [], low: [], white: [], room: [] }, sp = new Set(), sl = new Set(), sw = new Set(), sr = new Set();
          const toRGB = (s) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s); return m ? [+m[1],+m[2],+m[3], m[4]===undefined?1:+m[4]] : null; };
          const lum = (c) => { const f = c.slice(0,3).map(x=>{x/=255;return x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4;}); return 0.2126*f[0]+0.7152*f[1]+0.0722*f[2]; };
          function groundOf(el) { let n = el; while (n && n !== document.documentElement) { const c = toRGB(getComputedStyle(n).backgroundColor); if (c && c[3] > 0.92) return c; n = n.parentElement; } return toRGB(getComputedStyle(document.body).backgroundColor) || [255,255,255,1]; }
          for (const el of document.querySelectorAll("*")) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            const cs = getComputedStyle(el);
            if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
            const isSvg = el.namespaceURI === "http://www.w3.org/2000/svg";
            for (const p of PROPS) {
              if ((p === "fill" || p === "stroke") && !isSvg) continue;
              const v = cs[p]; if (!v) continue;
              if (OLDMAP[v]) { const k = p+v+el.tagName+(el.className||"").toString().slice(0,30); if (!sp.has(k)) { sp.add(k); out.pal.push({prop:p, hex:OLDMAP[v], tag:el.tagName, cls:(el.className||"").toString().slice(0,45)}); } }
              if (isDusk && EXONLY[v]) { const k = p+v+el.tagName+(el.className||"").toString().slice(0,30); if (!sr.has(k)) { sr.add(k); out.room.push({prop:p, tok:EXONLY[v], tag:el.tagName, cls:(el.className||"").toString().slice(0,45)}); } }
            }
            if (/^rgba\(255, 255, 255, 0?\.\d+\)$/.test(cs.color)) { const k = cs.color+el.tagName+(el.className||"").toString().slice(0,30); if (!sw.has(k)) { sw.add(k); out.white.push({ color: cs.color, tag: el.tagName, cls: (el.className||"").toString().slice(0,40), text: (el.textContent||"").trim().slice(0,26) }); } }
            const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
            if (!own) continue;
            const fg = toRGB(cs.color); if (!fg || fg[3] < 0.5) continue;
            const bg = groundOf(el);
            const comp = fg.slice(0,3).map((c,i)=> c*fg[3] + bg[i]*(1-fg[3]));
            const [hi, lo] = [lum(comp), lum(bg)].sort((a,b)=>b-a);
            const ratio = (hi + 0.05) / (lo + 0.05);
            const size = parseFloat(cs.fontSize) || 0, weight = +cs.fontWeight || 400;
            const floor = (size >= 24 || (size >= 18.66 && weight >= 700)) ? 3 : 4.5;
            if (ratio < floor - 0.02) { const k = cs.color+"|"+size+"|"+el.tagName+(el.className||"").toString().slice(0,30); if (!sl.has(k)) { sl.add(k); out.low.push({ ratio: Math.round(ratio*100)/100, floor, color: cs.color, size, weight, tag: el.tagName, cls: (el.className||"").toString().slice(0,40), text: (el.textContent||"").trim().slice(0,28) }); } }
          }
          return out;
        }, [OLD, EXHIBITION_ONLY, theme === "dusk"]);
        done++;
        for (const h of res.pal) { pal++; console.log(`PALETTE ${theme}/${width} ${route}  ${h.prop}=${h.hex} <${h.tag} class="${h.cls}">`); }
        for (const h of res.room) { wrongRoom++; console.log(`WRONGROOM ${theme}/${width} ${route}  ${h.prop}=${h.tok}(exhibition) <${h.tag} class="${h.cls}">`); }
        for (const h of res.white) { white++; console.log(`WHITEINK ${theme}/${width} ${route}  ${h.color} <${h.tag} class="${h.cls}"> "${h.text}"`); }
        for (const h of res.low) { contrast++; console.log(`CONTRAST ${theme}/${width} ${route}  ${h.ratio}:1 (floor ${h.floor}) ${h.color} ${h.size}px/${h.weight} <${h.tag} class="${h.cls}"> "${h.text}"`); }
      } catch (e) { navErrs++; console.log(`NAVERR ${theme}/${width} ${route}: ${String(e).split("\n")[0].slice(0,80)}`); }
    }
    await ctx.close();
    console.log(`-- finished ${theme}/${width} --`);
  }
}
await browser.close();
console.log(`\nSUMMARY renders=${done} palette=${pal} wrongRoom=${wrongRoom} whiteInk=${white} contrast=${contrast} navErrors=${navErrs}`);
