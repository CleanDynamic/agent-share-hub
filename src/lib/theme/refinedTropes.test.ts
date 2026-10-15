/* UI-P96 — the trope list, kept out of the refined look.

   Reads every `Refined*.tsx` and the files UI-P84 to UI-P87 and UI-P95 changed, as source, and fails on what the
   series rules never allow under the refined look: blur, gradient text, italic, a font named outside the `--font-*`
   tokens, a gradient that is not the picture light or a chart or map or framed work, a colour literal outside a named
   constant, opacity on hover, an em dash or an emoji in shown copy, and spacing off the series scale.

   It reads the AST, not the text, so a comment that explains a rule never trips it. */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(path);
  }
  return out;
};

/** Files UI-P84 to UI-P87 changed (the primitives and the frame) and UI-P95's inline fixes. */
const CHANGED = [
  "src/components/brand/Avatar.tsx",
  "src/components/brand/BuildCard.tsx",
  "src/components/brand/Button.tsx",
  "src/components/brand/CardHead.tsx",
  "src/components/brand/CategoryChip.tsx",
  "src/components/brand/Checkbox.tsx",
  "src/components/brand/CoverFallback.tsx",
  "src/components/brand/Eyebrow.tsx",
  "src/components/brand/Figure.tsx",
  "src/components/brand/FilterChip.tsx",
  "src/components/brand/FramedWork.tsx",
  "src/components/brand/IconButton.tsx",
  "src/components/brand/LampDot.tsx",
  "src/components/brand/Lockup.tsx",
  "src/components/brand/MenuButton.tsx",
  "src/components/brand/Panel.tsx",
  "src/components/brand/PictureLamp.tsx",
  "src/components/brand/Pill.tsx",
  "src/components/brand/Plaque.tsx",
  "src/components/brand/Row.tsx",
  "src/components/brand/SearchField.tsx",
  "src/components/brand/Segmented.tsx",
  "src/components/brand/Stat.tsx",
  "src/components/brand/StreakDay.tsx",
  "src/components/brand/StripedBar.tsx",
  "src/components/brand/Tile.tsx",
  "src/components/brand/Timeline.tsx",
  "src/components/brand/UnderlineTabs.tsx",
  "src/components/brand/charts.tsx",
  "src/components/shell/BottomSheet.tsx",
  "src/components/shell/Breadcrumb.tsx",
  "src/components/shell/Dock.tsx",
  "src/components/shell/HeaderSearch.tsx",
  "src/components/shell/MobileHeader.tsx",
  "src/components/shell/SiteFooter.tsx",
  "src/components/shell/SiteFrame.tsx",
  "src/components/shell/SiteHeader.tsx",
  "src/lib/theme/refinedControl.ts",
  // UI-P95
  "src/components/brand/ModelMark.tsx",
  "src/pages/site/signin/SignInView.tsx",
  "src/pages/site/signin/AuthParts.tsx",
  "src/pages/site/profile/ProfileBanner.tsx",
  "src/pages/site/profile/ProfileView.tsx",
  "src/pages/site/rebuild/FamilyPanel.tsx",
  "src/pages/site/rebuild/ReadinessPanel.tsx",
  "src/pages/site/rebuild/ChangesPanel.tsx",
  "src/pages/site/rebuild/LineageView.tsx",
  "src/pages/site/drafts/DraftsView.tsx",
];

export const FILES: string[] = [
  ...new Set([
    ...walk(join(ROOT, "src")).map((p) => relative(ROOT, p)).filter((p) => /\/Refined[^/]*\.tsx$/.test(p)),
    ...CHANGED,
  ]),
].sort();

/** Where a gradient is the work itself: the framed picture, the picture light, charts and the map's box. */
const GRADIENT_OK = new Set([
  "src/components/brand/FramedWork.tsx",
  "src/components/brand/PictureLamp.tsx",
  "src/components/brand/charts.tsx",
  "src/components/brand/CoverFallback.tsx",
  "src/components/brand/StripedBar.tsx",
  "src/pages/site/build/RefinedReaderMap.tsx",
  "src/pages/site/compose/RefinedBuildMap.tsx",
  "src/pages/site/compose/RefinedSandboxView.tsx",
  "src/pages/site/compose/RefinedSandboxCard.tsx",
  "src/pages/site/home/RefinedHomeView.tsx",
]);

/** Known current-look code that sits in a shared file after the refined early return, and why. */
const CURRENT_ONLY: ReadonlyArray<{ file: string; rule: string; why: string }> = [
  { file: "src/pages/site/profile/ProfileBanner.tsx", rule: "gradient", why: "the current look's banner scrim; the refined banner returns before it" },
];

/** A shared file draws both looks; its current-look values stay until UI-P99, so spacing is held in Refined*.tsx only. */
const isShared = (file: string): boolean => !/\/Refined[^/]*\.tsx$/.test(file);

/** Spacing the series allows, in px. */
const SCALE = new Set([0, 1, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64]);
const SPACING = /^(gap|rowGap|columnGap|padding|margin)(Top|Right|Bottom|Left|Block|Inline)?(Start|End)?$/;

const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
/** Emoji as drawn: ©, ® and ™ are text, so Extended_Pictographic alone is too wide. */
const EMOJI = /\p{Emoji_Presentation}|\uFE0F/u;

interface Finding {
  file: string;
  line: number;
  rule: string;
  text: string;
}

const isNamedConstant = (node: ts.Node): boolean => {
  for (let n: ts.Node | undefined = node; n; n = n.parent) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && /^[A-Z][A-Z0-9_]*$/.test(n.name.text)) return true;
  }
  return false;
};

/** Code only the current look runs: a `Current*` view, or the other arm of a branch on `refined`. */
const inCurrentLook = (node: ts.Node): boolean => {
  for (let n: ts.Node | undefined = node; n; n = n.parent) {
    if ((ts.isFunctionDeclaration(n) || ts.isVariableDeclaration(n) || ts.isClassDeclaration(n)) && n.name && /^Current[A-Z]/.test(n.name.getText())) return true;
    if (ts.isConditionalExpression(n) && /\brefined\b/.test(n.condition.getText())) {
      const negated = /^!|!==|=== "current"/.test(n.condition.getText().trim());
      const arm = negated ? n.whenTrue : n.whenFalse;
      if (arm.pos <= node.pos && node.end <= arm.end) return true;
    }
  }
  return false;
};

const inHoverHandler = (node: ts.Node): boolean => {
  for (let n: ts.Node | undefined = node; n; n = n.parent) {
    if (ts.isJsxAttribute(n) && /^on(Mouse|Pointer)(Enter|Over)$/.test(n.name.getText())) return true;
    if (ts.isConditionalExpression(n) && /hover/i.test(n.condition.getText())) return n.whenTrue.pos <= node.pos && node.end <= n.whenTrue.end;
  }
  return false;
};

const pxValues = (text: string): number[] | null => {
  const parts = text.trim().split(/\s+/);
  const out: number[] = [];
  for (const part of parts) {
    if (part === "auto" || part === "0" || /^(var|calc|clamp|min|max)\(/.test(part) || part.endsWith("%")) continue;
    const m = /^(-?\d+(?:\.\d+)?)px$/.exec(part);
    if (!m) return null;
    out.push(Math.abs(Number(m[1])));
  }
  return out;
};

export function scan(file: string, source: string): Finding[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found: Finding[] = [];
  const add = (node: ts.Node, rule: string) => {
    if (inCurrentLook(node)) return;
    if (CURRENT_ONLY.some((c) => c.file === file && c.rule === rule)) return;
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
    found.push({ file, line: line + 1, rule, text: node.getText().replace(/\s+/g, " ").slice(0, 80) });
  };

  const visit = (node: ts.Node): void => {
    const isText =
      ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node);
    if (isText) {
      const text = ts.isJsxText(node) ? node.text : node.text;
      if (/backdrop-filter/.test(text)) add(node, "backdrop-filter");
      if (/background-clip:\s*text/.test(text)) add(node, "gradient text");
      if (/(^|[^-])italic\b/.test(text) && /^(italic|oblique)$/.test(text.trim())) add(node, "italic");
      if (/linear-gradient|radial-gradient|conic-gradient/.test(text) && !GRADIENT_OK.has(file) && !/dot-grid|dotGrid/.test(source.slice(node.getStart(), node.getEnd() + 40))) add(node, "gradient");
      if (text.includes("—")) add(node, "em dash");
      if (EMOJI.test(text)) add(node, "emoji");
      if (/font-family\s*:/.test(text) && !/font-family\s*:\s*var\(--font-/.test(text)) add(node, "font name");
      if (!ts.isJsxText(node) && COLOUR.test(text) && !isNamedConstant(node)) add(node, "colour literal");
      if (/opacity/.test(text) && inHoverHandler(node)) add(node, "opacity on hover");
    }
    if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) {
      const name = node.name.text;
      if (name === "backdropFilter" || name === "WebkitBackdropFilter") add(node, "backdrop-filter");
      if (name === "backgroundClip" || name === "WebkitBackgroundClip") add(node, "gradient text");
      /* The only faces are the two `--font-*` tokens (or the constants that wrap them), never a name written out. */
      if (name === "fontFamily" && (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer)) && !/^var\(--font-/.test(node.initializer.text)) {
        add(node, "font name");
      }
      if (name === "fontStyle" && ts.isStringLiteral(node.initializer) && /^(italic|oblique)$/.test(node.initializer.text)) add(node, "italic");
      if (name === "opacity" && (inHoverHandler(node) || (ts.isConditionalExpression(node.initializer) && /hover/i.test(node.initializer.condition.getText())))) {
        add(node, "opacity on hover");
      }
      if (SPACING.test(name) && !isShared(file)) {
        const init = node.initializer;
        if (ts.isNumericLiteral(init) || (ts.isPrefixUnaryExpression(init) && ts.isNumericLiteral(init.operand))) {
          const value = Math.abs(Number(ts.isNumericLiteral(init) ? init.text : (init.operand as ts.NumericLiteral).text));
          if (!SCALE.has(value)) add(node, "spacing off the scale");
        } else if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
          const values = pxValues(init.text);
          if (values && values.some((v) => !SCALE.has(v))) add(node, "spacing off the scale");
        }
      }
    }
    if (ts.isPropertyAccessExpression(node) && node.name.text === "opacity" && inHoverHandler(node)) add(node, "opacity on hover");
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe("the refined look keeps the trope list out", () => {
  it("covers every Refined*.tsx and the files the earlier prompts changed", () => {
    expect(FILES.length).toBeGreaterThan(40);
    expect(FILES.filter((f) => /\/Refined/.test(f)).length).toBeGreaterThan(10);
  });

  it.each(FILES)("%s", (file) => {
    const findings = scan(file, readFileSync(join(ROOT, file), "utf8"));
    expect(findings.map((f) => `${f.file}:${f.line} ${f.rule}: ${f.text}`)).toEqual([]);
  });

  it("catches each rule on a planted line", () => {
    const planted = `
      const a = { backdropFilter: "blur(4px)", WebkitBackgroundClip: "text", fontStyle: "italic", gap: 10, padding: "5px 12px" };
      const b = { fontFamily: "Verdana, sans-serif" };
      const c = { background: "#ff00aa" };
      const d = "a — b";
      const e = "✨ hello";
      const f = { background: "linear-gradient(red, blue)" };
      const g = <button onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.5"; }} style={{ opacity: hover ? 0.5 : 1 }} />;
    `;
    const rules = new Set(scan("src/pages/RefinedPlanted.tsx", planted).map((f) => f.rule));
    for (const rule of ["backdrop-filter", "gradient text", "italic", "spacing off the scale", "font name", "colour literal", "em dash", "emoji", "gradient", "opacity on hover"]) {
      expect(rules.has(rule), rule).toBe(true);
    }
  });
});
