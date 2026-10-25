// Renders a Design canvas .dc.html board to static, script-free HTML.
// Supports what the eight vision boards use: <helmet>, {{path}} holes,
// <sc-for list as>, <sc-if value>, and a DCLogic renderVals() of plain data.
import fs from "node:fs";
import vm from "node:vm";

const [src, out] = process.argv.slice(2);
const html = fs.readFileSync(src, "utf8");
const pick = (re) => { const m = html.match(re); return m ? m[1] : ""; };

const title = pick(/<title>([\s\S]*?)<\/title>/);
const xdc = pick(/<x-dc>([\s\S]*?)<\/x-dc>/);
const helmet = (xdc.match(/<helmet>([\s\S]*?)<\/helmet>/) || ["", ""])[1];
const body = xdc.replace(/<helmet>[\s\S]*?<\/helmet>/, "");
const propsRaw = pick(/data-props='([^']*)'/);
const script = pick(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);

const declared = propsRaw ? JSON.parse(propsRaw) : {};
const props = {};
for (const [k, v] of Object.entries(declared)) if (k !== "$preview" && v && "default" in v) props[k] = v.default;
props.notes = false; // the boards' NEW notes and legend are never part of the reference

const ctx = vm.createContext({ PROPS: props });
const vals = vm.runInContext(
  `class DCLogic { constructor() { this.props = PROPS; } }\n${script}\n;JSON.stringify(new Component().renderVals())`,
  ctx, { timeout: 2000 });
const root = JSON.parse(vals);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => esc(s).replace(/"/g, "&quot;");
const lookup = (path, scope) => {
  path = path.trim();
  if (path === "true") return true;
  if (path === "false") return false;
  let v = scope;
  for (const part of path.split(".")) { if (v == null) return undefined; v = v[part]; }
  return v;
};
const holeOf = (attr) => { const m = attr.match(/^\{\{([\s\S]*?)\}\}$/); return m ? m[1] : null; };

function interpolate(text, scope) {
  // attribute values first (escaped for attributes), then text
  text = text.replace(/="\{\{([\s\S]*?)\}\}"/g, (_, p) => `="${escAttr(lookup(p, scope) ?? "")}"`);
  return text.replace(/\{\{([\s\S]*?)\}\}/g, (_, p) => esc(lookup(p, scope) ?? ""));
}
const attrsOf = (tag) => Object.fromEntries([...tag.matchAll(/([a-z-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));

function render(tpl, scope) {
  let outText = "";
  let i = 0;
  const open = /<(sc-for|sc-if)\b[^>]*>/g;
  while (true) {
    open.lastIndex = i;
    const m = open.exec(tpl);
    if (!m) { outText += interpolate(tpl.slice(i), scope); break; }
    outText += interpolate(tpl.slice(i, m.index), scope);
    const name = m[1];
    // find the matching close, counting nested tags of the same name
    const re = new RegExp(`<${name}\\b[^>]*>|</${name}>`, "g");
    re.lastIndex = m.index + m[0].length;
    let depth = 1, end = -1, closeLen = 0, mm;
    while ((mm = re.exec(tpl))) {
      if (mm[0].startsWith("</")) { depth--; if (depth === 0) { end = mm.index; closeLen = mm[0].length; break; } }
      else depth++;
    }
    if (end < 0) throw new Error(`unclosed <${name}> in ${src}`);
    const inner = tpl.slice(m.index + m[0].length, end);
    const a = attrsOf(m[0]);
    if (name === "sc-for") {
      const list = lookup(holeOf(a.list), scope) || [];
      for (const item of list) outText += render(inner, { ...scope, [a.as]: item });
    } else if (lookup(holeOf(a.value), scope)) {
      outText += render(inner, scope);
    }
    i = end + closeLen;
  }
  return outText;
}

const fonts = `<style>
@font-face{font-family:"Geist";src:url("../../fonts/Geist-Variable.woff2") format("woff2");font-weight:100 900;font-display:block}
@font-face{font-family:"Geist Mono";src:url("../../fonts/GeistMono-Variable.woff2") format("woff2");font-weight:100 900;font-display:block}
</style>`;
const head = helmet
  .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>\s*/g, "")
  .replace(/<link[^>]*fonts\.gstatic\.com[^>]*>\s*/g, "")
  .trim();
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1440">
<title>${esc(title)}</title>
${fonts}
${head}
</head>
<body>
${render(body, root).trim()}
</body>
</html>
`;
fs.writeFileSync(out, page);
console.log("ok", out, page.length);
