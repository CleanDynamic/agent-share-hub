// G28: the accessibility guard over the site's source (src/pages/site and the site's component folders). It fails on:
//   1. an onClick on a div, span, li, td or tr without both a role and a keyboard handler (a row that wraps a real button, which the
//      keyboard and screen readers use, is allowed by name below, with the reason);
//   2. a positive tabIndex;
//   3. an img with no alt;
//   4. an aria-label on a div or span with no role (the label is then not exposed).
// Elements that spread props ({...rest}) may get their role or handlers from them, so rules 1 and 4 skip them. The legacy
// pages (Upload, ProjectDetail, ContentEdit, Messages, Admin, Analytics, PublishMetadata) are outside the folders read.

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOTS = ["src/pages/site", "src/components/shell", "src/components/brand", "src/components/vision", "src/components/post", "src/components/build", "src/components/pagestate"];
const CLICKABLE = new Set(["div", "span", "li", "td", "tr"]);
const LABEL_NEEDS_ROLE = new Set(["div", "span"]);
const KEYS = ["onKeyDown", "onKeyUp", "onKeyPress"];

/** A pointer convenience round a real control, which is what the keyboard and screen readers use: allowed, with its reason. */
const ALLOWED: { file: string; tag: string; rule: string; reason: string }[] = [
];

/** A file whose first line says it is a test's own host (ca26.menuHost.tsx) is not the site. */
const testOnly = (file: string) => /\(test only\)/.test(fs.readFileSync(file, "utf8").split("\n", 1)[0]);

function files(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__audit__" ? [] : files(full);
    return /\.tsx$/.test(entry.name) && !/\.test\.tsx$|harness|Harness|\.stories\./.test(entry.name) && !testOnly(full) ? [full] : [];
  });
}

interface Finding {
  file: string;
  line: number;
  tag: string;
  rule: "click" | "tabindex" | "alt" | "label";
}

function scan(file: string): Finding[] {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Finding[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      const props = node.attributes.properties;
      const spread = props.some((p) => ts.isJsxSpreadAttribute(p));
      const attr = (name: string) => props.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(source) === name);
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      const role = attr("role");
      // A click handler that only stops the click going on to the tile round it is no action of its own.
      const click = attr("onClick");
      const onlyStops = click?.initializer && /^\{?\s*\(?\w*\)?\s*=>\s*\w+\.stopPropagation\(\)\s*\}?$/.test(click.initializer.getText(source));
      // Both are needed: a role says it can be pressed, a key handler lets a keyboard press it. An option or a menu item is the
      // exception: the listbox or menu that owns it takes the keys (the arrows and Enter on its field or itself).
      const owned = role?.initializer && /^["'](option|menuitem|menuitemradio|menuitemcheckbox|treeitem)["']$/.test(role.initializer.getText(source));
      if (CLICKABLE.has(tag) && click && !onlyStops && !spread && !owned && (!role || !KEYS.some((k) => attr(k)))) out.push({ file, line, tag, rule: "click" });
      const tab = attr("tabIndex");
      if (tab?.initializer) {
        const value = ts.isJsxExpression(tab.initializer) ? tab.initializer.expression : tab.initializer;
        const text = value?.getText(source) ?? "";
        if (/^["']?[1-9]\d*["']?$/.test(text)) out.push({ file, line, tag, rule: "tabindex" });
      }
      if (tag === "img" && !attr("alt") && !spread) out.push({ file, line, tag, rule: "alt" });
      if (LABEL_NEEDS_ROLE.has(tag) && attr("aria-label") && !role && !spread) out.push({ file, line, tag, rule: "label" });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

describe("G28: the accessibility guard", () => {
  const all = ROOTS.flatMap(files).flatMap(scan);
  const allowed = (f: Finding) => ALLOWED.some((a) => a.file === f.file && a.tag === f.tag && a.rule === f.rule);
  const show = (rule: Finding["rule"]) => all.filter((f) => f.rule === rule && !allowed(f)).map((f) => `${f.file}:${f.line} <${f.tag}>`);

  it("reads the site's source", () => {
    expect(all.length + ROOTS.flatMap(files).length).toBeGreaterThan(100);
  });
  it("no onClick on a div, span, li, td or tr without both a role and a keyboard handler", () => {
    expect(show("click")).toEqual([]);
  });
  it("no positive tabIndex", () => {
    expect(show("tabindex")).toEqual([]);
  });
  it("no img without alt", () => {
    expect(show("alt")).toEqual([]);
  });
  it("no aria-label on a div or span with no role", () => {
    expect(show("label")).toEqual([]);
  });
  it("every allowed entry still exists and says why", () => {
    for (const entry of ALLOWED) {
      expect(entry.reason.length).toBeGreaterThan(20);
      expect(all.some((f) => f.file === entry.file && f.tag === entry.tag && f.rule === entry.rule), `${entry.file} <${entry.tag}> ${entry.rule} is no longer found`).toBe(true);
    }
  });
});
