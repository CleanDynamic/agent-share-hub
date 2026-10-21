// CA-09: makes the stand-in's picture: a 1600×1200 JPEG of about 180 KB, the size of a phone photo after upload
// resizing. Drawn by Chromium so it compresses like a photo (gradients and noise), not like a flat test card.
// Usage: node docs/audits/ca-09/scripts/make-picture.mjs /var/tmp/ca09-picture.jpg
import { chromium } from "@playwright/test";
const out = process.argv[2] ?? "/var/tmp/ca09-picture.jpg";
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
await page.setContent(`<canvas id=c width=1600 height=1200></canvas><style>body{margin:0}</style><script>
const c=document.getElementById('c').getContext('2d');const g=c.createLinearGradient(0,0,1600,1200);g.addColorStop(0,'#3a6b35');g.addColorStop(.5,'#cbd18f');g.addColorStop(1,'#e3b448');c.fillStyle=g;c.fillRect(0,0,1600,1200);
let s=7;const r=()=>(s=(s*16807)%2147483647)/2147483647;for(let i=0;i<9000;i++){c.fillStyle='rgba('+(r()*255|0)+','+(r()*255|0)+','+(r()*120|0)+','+(r()*.35)+')';c.beginPath();c.arc(r()*1600,r()*1200,r()*18,0,7);c.fill();}
</script>`);
await page.screenshot({ path: out, type: "jpeg", quality: 72 });
await browser.close();
console.log(out);
