import { chromium } from "@playwright/test";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem("bg-theme", "exhibition"); } catch {} });
const p = await ctx.newPage(); p.on("pageerror", () => {});
await p.goto("http://127.0.0.1:5199/upload/blueprint", { waitUntil: "domcontentloaded", timeout: 30000 });
await p.waitForTimeout(3500);
console.log(JSON.stringify(await p.evaluate(() => {
  const want = ["Insert Grid", "main", "Saved"];
  const toRGB = (s) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s); return m ? [+m[1],+m[2],+m[3], m[4]===undefined?1:+m[4]] : null; };
  const out = [];
  for (const el of document.querySelectorAll("*")) {
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join("");
    if (!want.includes(own)) continue;
    const chain = [];
    let n = el;
    while (n && n !== document.documentElement && chain.length < 6) {
      const cs = getComputedStyle(n);
      chain.push(`${n.tagName}${n.className ? "." + String(n.className).split(" ")[0] : ""} bg=${cs.backgroundColor}`);
      const c = toRGB(cs.backgroundColor);
      if (c && c[3] > 0.92) break;
      n = n.parentElement;
    }
    out.push({ text: own, color: getComputedStyle(el).color, chain });
  }
  return out;
}, null), null, 1));
await b.close();
