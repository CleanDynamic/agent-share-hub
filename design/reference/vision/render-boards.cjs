// Renders the canvas's .dc.html boards to standalone HTML: runs each board's
// Component.renderVals() with notes off, expands <sc-for>, <sc-if> and {{holes}},
// and swaps the Google Fonts link for the repo's own Geist files.
// Usage: node design/reference/vision/render-boards.cjs design/reference/vision/source design/reference/vision/dusk
const fs = require("fs");
const path = require("path");

const [, , boardsDir, outDir] = process.argv;
fs.mkdirSync(outDir, { recursive: true });

const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function lookup(scope, expr) {
  expr = expr.trim();
  if (expr === "true") return true;
  if (expr === "false") return false;
  let cur = scope;
  for (const key of expr.split(".")) {
    if (cur == null) return undefined;
    cur = cur[key];
  }
  return cur;
}

function holes(text, scope) {
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, e) => {
    const v = lookup(scope, e);
    return v == null ? "" : esc(v);
  });
}

function attr(tag, name) {
  const m = tag.match(new RegExp(name + '="\\{\\{\\s*([^}]+?)\\s*\\}\\}"'));
  return m ? m[1] : null;
}

function render(tpl, scope) {
  let out = "";
  let i = 0;
  const open = /<(sc-for|sc-if)\b[^>]*>/g;
  while (true) {
    open.lastIndex = i;
    const m = open.exec(tpl);
    if (!m) { out += holes(tpl.slice(i), scope); break; }
    out += holes(tpl.slice(i, m.index), scope);
    const name = m[1];
    // find the matching close
    let depth = 1, j = m.index + m[0].length;
    const re = new RegExp("<(/?)" + name + "\\b[^>]*>", "g");
    let inner, end;
    re.lastIndex = j;
    let t;
    while ((t = re.exec(tpl))) {
      depth += t[1] ? -1 : 1;
      if (depth === 0) { inner = tpl.slice(j, t.index); end = t.index + t[0].length; break; }
    }
    if (inner === undefined) throw new Error("unclosed " + name);
    if (name === "sc-for") {
      const list = lookup(scope, attr(m[0], "list")) || [];
      const as = (m[0].match(/as="([^"]+)"/) || [])[1];
      list.forEach((item, idx) => { out += render(inner, Object.assign({}, scope, { [as]: item, $index: idx })); });
    } else {
      if (lookup(scope, attr(m[0], "value"))) out += render(inner, scope);
    }
    i = end;
  }
  return out;
}

const NAMES = {
  "Main.dc.html": "home",
  "OpenWork.dc.html": "openbuilds",
  "Builds.dc.html": "builds-table",
  "BuildsMaps.dc.html": "builds-maps",
  "BuildsClassification.dc.html": "builds-classification",
  "Library.dc.html": "library",
  "LibraryInsert.dc.html": "composer-add-from-library",
  "Drafts.dc.html": "drafts",
};

const fontFaces = `@font-face{font-family:"Geist";src:url("../../fonts/Geist-Variable.woff2") format("woff2");font-weight:100 900;font-display:block}
@font-face{font-family:"Geist Mono";src:url("../../fonts/GeistMono-Variable.woff2") format("woff2");font-weight:100 900;font-display:block}`;

for (const file of fs.readdirSync(boardsDir).filter((f) => f.endsWith(".dc.html"))) {
  const src = fs.readFileSync(path.join(boardsDir, file), "utf8");
  const xdc = src.match(/<x-dc>([\s\S]*)<\/x-dc>/)[1];
  const helmet = (xdc.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ""])[1];
  const style = (helmet.match(/<style>([\s\S]*?)<\/style>/) || [, ""])[1];
  const body = xdc.replace(/<helmet>[\s\S]*?<\/helmet>/, "");
  const title = (src.match(/<title>([^<]*)<\/title>/) || [, file])[1];
  const script = src.match(/<script type="text\/x-dc"[^>]*data-props='([^']*)'[^>]*>([\s\S]*?)<\/script>/);
  const props = {};
  const decl = JSON.parse(script[1]);
  for (const [k, v] of Object.entries(decl)) if (k !== "$preview" && v && "default" in v) props[k] = v.default;
  props.notes = false;
  const DCLogic = class { constructor(p) { this.props = p; this.state = {}; } setState() {} };
  const Component = new Function("DCLogic", script[2] + "\nreturn Component;")(DCLogic);
  const vals = new Component(props).renderVals();
  const html = `<!doctype html>
<html lang="en" data-theme="dusk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1440">
<title>${title} · vision reference</title>
<style>
${fontFaces}
${style}
</style>
</head>
<body>
${render(body, vals)}
</body>
</html>
`;
  const out = (NAMES[file] || file.replace(".dc.html", "")) + ".html";
  fs.writeFileSync(path.join(outDir, out), html);
  console.log("wrote", out, html.length);
}
