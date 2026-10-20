/* The syntax highlighter behind `CodeFileBlock`.

   `lowlight` is already a dependency (the article and blog viewers use it through TipTap), so nothing is installed.
   It is loaded by a dynamic `import()` the first time a code block mounts, so it is a chunk of its own and is never in
   the bundle a page starts with (`neoscale-performance`: no heavy dependency on the first paint). Only the languages the
   build knows are registered. Until the chunk arrives the code is drawn as plain text in the same font and line height,
   so nothing moves when the colours come in.

   Colours are the `--code-*` tokens and `--text2` for comments. No italics, no bold. */

import type { ReactNode } from "react";

import type { CodeLanguage } from "@/lib/build/graph";
import { t } from "@/lib/theme/tokens";

/** The part of lowlight's tree this file reads. */
export type HNode = { type: "text"; value: string } | { type: "element"; properties?: { className?: string[] }; children: HNode[] };

export type Highlight = (source: string, language: CodeLanguage) => HNode[] | null;

/** The build's languages, as highlight.js names them. "other" is drawn plain. */
const GRAMMAR: Readonly<Record<Exclude<CodeLanguage, "other">, string>> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  python: "python",
  sql: "sql",
  json: "json",
  yaml: "yaml",
  bash: "bash",
  html: "xml",
  css: "css",
};

/** Past this, the code is drawn plain: highlighting runs on every keystroke in the editor. */
export const HIGHLIGHT_MAX = 30_000;

let loading: Promise<Highlight> | null = null;

/** The highlighter, loaded once. */
export function loadHighlighter(): Promise<Highlight> {
  loading ??= import("lowlight").then(({ createLowlight, common }) => {
    const low = createLowlight(Object.fromEntries(Object.values(GRAMMAR).map((name) => [name, common[name]])));
    return (source, language) => {
      if (language === "other" || source.length > HIGHLIGHT_MAX) return null;
      try {
        return low.highlight(GRAMMAR[language], source).children as HNode[];
      } catch {
        return null;
      }
    };
  });
  return loading;
}

const KEYWORD = new Set(["keyword", "built_in", "literal", "type", "selector-tag", "doctag", "tag"]);
const STRING = new Set(["string", "regexp", "template-string", "meta-string", "selector-attr", "selector-pseudo"]);
const NUMBER = new Set(["number", "symbol", "bullet"]);
const NAME = new Set(["title", "function", "class", "name", "attr", "property", "selector-class", "selector-id", "section"]);
const QUIET = new Set(["comment", "quote", "meta", "formula"]);

/** The colour token for a node's classes ("hljs-title class_"), or none. */
function colourOf(classes: readonly string[] | undefined): string | undefined {
  for (const name of classes ?? []) {
    if (!name.startsWith("hljs-")) continue;
    const kind = name.slice(5);
    if (QUIET.has(kind)) return t.text2;
    if (KEYWORD.has(kind)) return t.codeKeyword;
    if (STRING.has(kind)) return t.codeString;
    if (NUMBER.has(kind)) return t.codeNumber;
    if (NAME.has(kind)) return t.codeName;
  }
  return undefined;
}

/** A highlighted tree as React nodes. Text stays text, so the characters are exactly the source's. */
export function renderTree(nodes: readonly HNode[]): ReactNode[] {
  return nodes.map((node, index) => {
    if (node.type === "text") return node.value;
    const colour = colourOf(node.properties?.className);
    const inner = renderTree(node.children);
    return colour ? (
      <span key={index} style={{ color: colour }}>
        {inner}
      </span>
    ) : (
      <span key={index}>{inner}</span>
    );
  });
}
