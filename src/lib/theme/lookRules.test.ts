// CA-03 P1 — the look's rules as a test.
//
// Every source file CA-03 adds or changes is listed in CA03_FILES and read here as text. The rules are the prompt's
// "Never do these" and "Components: one way to draw each thing", where a regular expression can see them. Each
// failure names the file and the line.
//
// WHAT IS READ. Comments are blanked first (line breaks kept, so line numbers hold): a comment that says "no
// gradients" is not a gradient. Strings, JSX text and code are read as they are.
//
// THIS FILE IS NOT IN THE LIST. It has to spell out every pattern it forbids. Nor is compliance.test.ts (CA-06 P5
// and P6 add two capped entries to it), for the same reason: its allowlist quotes the values it allows.
//
// CA-06, THE ONE EXCEPTION TO "NO COLOURED CARD EDGES": a tile or a session may carry the colour its maker chose
// (`payload.colour`, `sessions_meta[key].colour`), drawn only through `borderFor` and `outlineFor` in
// src/lib/theme/partColour.ts. Nothing is coloured by default and no colour is chosen for the maker. The rule below
// lets a border's colour come from those helpers, or a token, and from nothing else.
//
// Two readings, said once here:
//   - `outline: "none"` (or 0) is the absence of an outline, which is what keeps the browser's own ring off; any
//     other outline value must come from `ring()`.
//   - The one upper-case style is `EYEBROW` in refinedStyles.ts, the Details eyebrow; everything else that is upper
//     case on the page spends it.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { SPACE_REFINED } from "./space";

/** Every source file CA-03 and CA-04 add or change, from the repository root. */
export const CA03_FILES: readonly string[] = [
  // P2
  "src/components/brand/Segmented.tsx",
  "src/lib/theme/contrast.test.ts",
  "src/pages/site/compose/AddAgentDialog.test.tsx",
  "src/pages/site/compose/AddAgentDialog.tsx",
  "src/pages/site/compose/AddCodeDialog.test.tsx",
  "src/pages/site/compose/AddCodeDialog.tsx",
  "src/pages/site/compose/AddManualStepDialog.tsx",
  "src/pages/site/compose/AgentSetupFields.tsx",
  "src/pages/site/compose/BuildList.tsx",
  "src/pages/site/compose/BuildMap.test.tsx",
  "src/pages/site/compose/BuildMap.tsx",
  "src/pages/site/compose/ChoiceRows.tsx",
  "src/pages/site/compose/composeControls.tsx",
  "src/pages/site/compose/DetailsPanel.test.tsx",
  "src/pages/site/compose/DetailsPanel.tsx",
  "src/pages/site/compose/ModelPicker.tsx",
  "src/pages/site/compose/PickMenu.tsx",
  "src/pages/site/compose/refinedStyles.ts",
  // P3
  "src/lib/build/graph.test.ts",
  "src/lib/build/graph.ts",
  "src/lib/build/mapLayout.ts",
  "src/lib/build/readerSteps.test.ts",
  "src/lib/build/readerSteps.ts",
  "src/pages/site/build/BuildSteps.test.tsx",
  "src/pages/site/build/BuildSteps.tsx",
  "src/pages/site/compose/BuildList.test.tsx",
  "src/pages/site/compose/detailsModel.test.ts",
  "src/pages/site/compose/detailsModel.ts",
  "src/pages/site/compose/refinedPieces.tsx",
  // P4
  "src/lib/build/mapLayout.test.ts",
  "src/pages/site/compose/buildListModel.ts",
  // P5
  "src/components/build/renderers/evidence.tsx",
  "src/components/build/renderers/renderers.test.tsx",
  "src/dev/fixtures/buildSteps.tsx",
  "src/pages/dev/SandboxDemo.tsx",
  "src/pages/site/build/BuildView.test.tsx",
  "src/pages/site/compose/AddCheckDialog.test.tsx",
  "src/pages/site/compose/AddCheckDialog.tsx",
  "src/pages/site/compose/detailsView.ts",
  "src/pages/site/compose/SandboxPage.tsx",
  "src/pages/site/compose/SandboxView.test.tsx",
  "src/pages/site/compose/SandboxView.tsx",
  "src/pages/site/compose/useComposePrompts.ts",
  // P6
  "src/components/build/renderers/configuration.tsx",
  // P7
  "src/lib/build/outsideContent.test.ts",
  "src/lib/build/outsideContent.ts",
  "src/lib/build/shapes.test.ts",
  "src/lib/tools/registry.test.ts",
  "src/lib/tools/registry.ts",
  "src/pages/site/compose/OutsideWarning.tsx",
  // P8
  "src/lib/build/buildSummary.test.ts",
  "src/lib/build/buildSummary.ts",
  "src/pages/site/build/buildModel.ts",
  "src/pages/site/build/BuildView.tsx",
  // P9
  "src/dev/fixtures/shapes.ts",
  // CA-04 P1
  "src/components/build/FullPromptWindow.tsx",
  "src/lib/build/composePrompts.ts",
  "src/lib/build/making.test.ts",
  "src/lib/build/making.ts",
  "src/lib/build/onePrompt.snapshot.test.tsx",
  "src/pages/site/compose/AddSessionDialog.test.tsx",
  "src/pages/site/compose/AddSessionDialog.tsx",
  "src/pages/site/compose/sourcesModel.ts",
  // CA-04 P2
  "src/lib/build/copyTogether.ts",
  "src/lib/build/nest.test.ts",
  "src/lib/build/sentWithSuggest.ts",
  "src/pages/site/compose/BuildList.nest.test.tsx",
  "src/pages/site/compose/composeModel.ts",
  "src/pages/site/compose/listNest.tsx",
  // CA-04 P4
  "src/lib/build/setup.test.ts",
  "src/lib/build/setup.ts",
  "src/lib/build/setupFolder.ts",
  "src/lib/build/zip.ts",
  "src/pages/site/compose/dropFolders.ts",
  "src/pages/site/compose/setup.ui.test.tsx",
  // CA-04 P5
  "src/pages/site/compose/connection.test.tsx",
  // CA-04 P6
  "src/lib/build/runsFrom.test.ts",
  "src/lib/build/runsFrom.ts",
  "src/pages/site/compose/goal.ui.test.tsx",
  // CA-04 P7
  "src/pages/dev/BuildStepsDemo.tsx",
  // CA-05 P1
  "src/components/build/ChangedText.tsx",
  "src/components/build/FullPromptWindow.changes.test.tsx",
  "src/lib/build/changes.copy.test.ts",
  "src/lib/build/changes.test.ts",
  "src/lib/build/changes.ts",
  // CA-05 P2
  "src/lib/build/sessionFacts.test.ts",
  "src/lib/build/sessionFacts.ts",
  "src/pages/site/compose/SessionExtrasFields.tsx",
  "src/pages/site/compose/facts.ui.test.tsx",
  // CA-05 P3
  "src/lib/build/startedWith.test.ts",
  "src/lib/build/startedWith.ts",
  "src/pages/site/compose/started.ui.test.tsx",
  // CA-05 P4 wrote no code. CA-05 P5
  "src/pages/site/compose/together.ui.test.tsx",
  // CA-05 P7
  "src/lib/build/testCases.test.ts",
  "src/lib/build/testCases.ts",
  "src/pages/site/compose/checkRuns.ui.test.tsx",
  // CA-05 P8
  "src/lib/build/modelRun.test.ts",
  "src/lib/build/modelRun.ts",
  "src/pages/site/compose/ModelRunFields.tsx",
  "src/pages/site/compose/modelRun.ui.test.tsx",
  // CA-05 P9
  "src/pages/site/compose/AgentNotesFields.tsx",
  "src/pages/site/compose/agentNotes.ui.test.tsx",
  // CA-05 P10
  "src/pages/site/compose/trainedModel.ui.test.tsx",
  // CA-05 P11
  "src/lib/build/everything.test.ts",
  // CA-06 P1
  "src/components/post/editor/extensions.ts",
  "src/lib/build/onePrompt.composer.snapshot.test.tsx",
  "src/lib/build/thread.ts",
  "src/lib/build/threadRefs.test.tsx",
  // CA-06 P2
  "src/components/brand/glyphs.test.tsx",
  "src/components/brand/glyphs.ts",
  "src/components/post/editor/PostToolbar.tsx",
  "src/components/post/editor/ReferencePicker.tsx",
  "src/components/post/editor/references.test.tsx",
  "src/components/post/editor/references.ts",
  "src/components/post/editor/usePostEditor.ts",
  "src/lib/build/postRefs.ts",
  "src/pages/site/compose/PostTab.tsx",
  // CA-06 P3
  "e2e/tier3/post-links.spec.ts",
  "src/components/build/PartWindow.tsx",
  "src/components/build/partNav.tsx",
  "src/components/post/PostBody.tsx",
  "src/components/post/RefLinks.test.tsx",
  "src/components/post/RefLinks.tsx",
  "src/dev/fixtures/postLinks.ts",
  "src/lib/theme/luminance.ts",
  "src/lib/theme/partColour.ts",
  "src/pages/dev/LinksDemo.tsx",
  "src/pages/site/build/BuildPage.tsx",
  "src/pages/site/build/useReaderPostLinks.ts",
  "src/pages/site/compose/usePostLinks.ts",
  // CA-06 P4
  "src/components/brand/ColourButton.tsx",
  "src/components/brand/IconButton.tsx",
  "src/lib/build/colour.test.ts",
  "src/lib/theme/partColour.test.ts",
  "src/pages/site/compose/SourcesPanel.tsx",
  "src/pages/site/compose/colour.ui.test.tsx",
  // CA-06 P5
  "src/components/brand/ColourPicker.test.tsx",
  "src/components/brand/ColourPicker.tsx",
  "src/components/brand/useColourSwatches.ts",
  "src/lib/build/colourPreview.ts",
  "src/lib/theme/colourWheel.ts",
  "src/pages/site/compose/useColourPicking.tsx",
  // CA-06 P6
  "src/lib/profile/colourSwatches.test.tsx",
  "src/lib/profile/colourSwatches.ts",
  // CA-06 P7
  "e2e/audit/support/harness.ts",
  // CA-07 P1
  "src/components/post/postType.ts",
  "src/pages/site/compose/PostTab.proportions.test.tsx",
  "src/pages/site/compose/PostTab.test.tsx",
  "src/pages/site/compose/PostTab.preview.test.tsx",
  // CA-07 P2
  "src/components/post/editor/BlockHandle.tsx",
  "src/components/post/editor/GridView.tsx",
  "src/components/post/editor/SlashMenu.tsx",
  "src/components/post/editor/gridShape.test.tsx",
  "src/components/post/editor/pictures.ts",
  "src/lib/build/threadEditor.ts",
  "src/lib/build/toGrids.test.ts",
  "src/pages/site/compose/PostTab.bars.test.tsx",
];

const ROOT = path.resolve(__dirname, "../../..");

/* ── reading a file ── */

/**
 * The source with every comment replaced by spaces, line breaks kept. A small lexer: strings ('…', "…", `…` with
 * `${}` inside), line and block comments, and code. A quote string never crosses a line, so an apostrophe in JSX
 * text costs at most the rest of its own line.
 */
export function stripComments(source: string): string {
  let out = "";
  let i = 0;
  const stack: ("code" | "template")[] = ["code"];
  let braces: number[] = [0];
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  while (i < source.length) {
    const c = source[i];
    const next = source[i + 1];
    const mode = stack[stack.length - 1];
    if (mode === "template") {
      if (c === "\\") {
        out += source.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (c === "`") {
        out += c;
        stack.pop();
        i += 1;
        continue;
      }
      if (c === "$" && next === "{") {
        out += "${";
        stack.push("code");
        braces.push(0);
        i += 2;
        continue;
      }
      out += c;
      i += 1;
      continue;
    }
    // code
    if (c === "/" && next === "/") {
      const end = source.indexOf("\n", i);
      const stop = end < 0 ? source.length : end;
      out += blank(source.slice(i, stop));
      i = stop;
      continue;
    }
    if (c === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end < 0 ? source.length : end + 2;
      out += blank(source.slice(i, stop));
      i = stop;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== c && source[j] !== "\n") j += source[j] === "\\" ? 2 : 1;
      out += source.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === "`") {
      out += c;
      stack.push("template");
      i += 1;
      continue;
    }
    if (c === "{") braces[braces.length - 1] += 1;
    if (c === "}") {
      if (stack.length > 1 && braces[braces.length - 1] === 0) {
        // The end of a `${…}`.
        stack.pop();
        braces = braces.slice(0, -1);
        out += c;
        i += 1;
        continue;
      }
      braces[braces.length - 1] -= 1;
    }
    out += c;
    i += 1;
  }
  return out;
}

const lineOf = (text: string, index: number): number => text.slice(0, index).split("\n").length;

export interface Finding {
  rule: string;
  line: number;
  text: string;
}

const found = (rule: string, code: string, index: number): Finding => ({
  rule,
  line: lineOf(code, index),
  text: code.split("\n")[lineOf(code, index) - 1].trim().slice(0, 140),
});

function every(pattern: RegExp, code: string): RegExpExecArray[] {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return [...code.matchAll(new RegExp(pattern.source, flags))];
}

/* ── rule 2: what never appears ── */

const FORBIDDEN: readonly { rule: string; pattern: RegExp }[] = [
  { rule: "no gradient (linear)", pattern: /linear-gradient/ },
  { rule: "no gradient (radial)", pattern: /radial-gradient/ },
  { rule: "no gradient (conic)", pattern: /conic-gradient/ },
  { rule: "no glass (backdrop-filter)", pattern: /backdrop-filter|backdropFilter/ },
  { rule: "no gradient text", pattern: /background-clip:\s*text|backgroundClip/ },
  // Spelt in two parts: type.test.ts holds the whole source to never naming the retired face.
  { rule: "no Inter", pattern: /"Int(?:er)"/ },
  { rule: "no Space Grotesk", pattern: /Space Grotesk/ },
  { rule: "no Instrument Serif", pattern: /Instrument Serif/ },
  { rule: "no italic", pattern: /fontStyle:\s*"italic"|font-style:\s*italic/ },
  { rule: "no fade-in on scroll", pattern: /IntersectionObserver/ },
  { rule: "no cursor-following light", pattern: /mousemove/ },
  { rule: "no untouched shadcn", pattern: /from "@\/components\/ui\// },
  { rule: "no emoji", pattern: /\p{Extended_Pictographic}/u },
  { rule: "no em dash in copy", pattern: /—/ },
];

/* ── rule 4: spacing only from SPACE_REFINED ── */

const SPACING_KEY = /\b(gap|rowGap|columnGap|padding(?:Top|Right|Bottom|Left|Inline|Block)?|margin(?:Top|Right|Bottom|Left|Inline|Block)?)\s*:\s*/;

/** The numbers a spacing value spells: `12`, `"4px 8px"`, `"0 12px 8px"`, a ternary of either. */
function spacingNumbers(value: string): number[] {
  const out: number[] = [];
  for (const match of value.matchAll(/(-?\d+(?:\.\d+)?)(px)?/g)) out.push(Math.abs(Number(match[1])));
  return out;
}

const SPACE_OK = new Set<number>([0, 1, ...SPACE_REFINED]);

function spacingFindings(code: string): Finding[] {
  const out: Finding[] = [];
  for (const match of every(SPACING_KEY, code)) {
    const start = (match.index ?? 0) + match[0].length;
    const rest = code.slice(start, start + 120);
    // A number, a string of px values, or a ternary of those; anything else (a variable, a sum) is not read.
    const value = /^(?:-?\d+(?:\.\d+)?|"[^"\n]*"|'[^'\n]*'|[\w.]+\s*\?\s*(?:-?\d+(?:\.\d+)?|"[^"\n]*")\s*:\s*(?:-?\d+(?:\.\d+)?|"[^"\n]*"))(?=\s*[,}\n)])/.exec(rest);
    if (!value) continue;
    const literal = value[0].replace(/^[\w.]+\s*\?/, "");
    if (/var\(|calc\(|clamp\(|%|auto|em\b|vw|vh/.test(literal)) continue;
    const bad = spacingNumbers(literal).filter((n) => !SPACE_OK.has(n));
    if (bad.length) out.push(found(`spacing ${bad.join(", ")} is not in SPACE_REFINED`, code, match.index ?? 0));
  }
  return out;
}

/* ── rule 5: the Components table ── */

function componentFindings(code: string, file: string): Finding[] {
  const out: Finding[] = [];
  for (const match of every(/<select\b/, code)) out.push(found("a native <select>", code, match.index ?? 0));

  for (const match of every(/type=\{?["'](radio|checkbox)["']\}?/, code)) {
    const at = match.index ?? 0;
    const before = code.slice(Math.max(0, at - 400), at);
    const tagStart = before.lastIndexOf("<");
    // An input closes itself: read to its "/>", past any arrow function in its props.
    const close = code.indexOf("/>", at);
    const tag = before.slice(tagStart) + code.slice(at, close < 0 ? code.indexOf(">", at) + 1 : close + 2);
    const hidden = /VisuallyHidden|VISUALLY_HIDDEN/.test(tag) || /<VisuallyHidden>\s*$/.test(before.slice(0, tagStart));
    if (!hidden) out.push(found(`a visible ${match[1]} input`, code, at));
  }

  for (const match of every(/textTransform:\s*["']uppercase["']/, code)) {
    const at = match.index ?? 0;
    const owner = code.slice(0, at).lastIndexOf("export const ");
    const isEyebrow = file.endsWith("src/pages/site/compose/refinedStyles.ts") && code.slice(owner, owner + 30).startsWith("export const EYEBROW");
    if (!isEyebrow) out.push(found("upper case outside the Details eyebrow", code, at));
  }

  // DM_MONO in a style object that also sets textTransform, or in a <label>'s style.
  for (const match of every(/DM_MONO/, code)) {
    const at = match.index ?? 0;
    const open = code.lastIndexOf("{", at);
    const close = code.indexOf("}", at);
    if (open >= 0 && close > 0 && /textTransform/.test(code.slice(open, close))) out.push(found("the data face with upper case", code, at));
    const tagAt = code.lastIndexOf("<", at);
    if (tagAt >= 0 && /^<label\b/.test(code.slice(tagAt)) && !code.slice(tagAt, at).includes(">")) out.push(found("the data face on a label", code, at));
  }

  // A lucide icon drawn as JSX on its own, rather than handed to IconButton's `icon`.
  const lucide = /import\s*\{([^}]*)\}\s*from\s*"lucide-react"/.exec(code);
  if (lucide) {
    const names = lucide[1].split(",").map((name) => name.trim().split(/\s+as\s+/).pop() ?? "").filter(Boolean);
    for (const name of names) for (const match of every(new RegExp(`<${name}[\\s/>]`), code)) out.push(found(`the lucide icon ${name} drawn on its own`, code, match.index ?? 0));
  }

  // An opacity in a hover style.
  for (const match of every(/hover[^\n]*opacity|opacity[^\n]*hover/i, code)) out.push(found("opacity on hover", code, match.index ?? 0));

  // CA-06: a border's colour is a token, or a maker's colour through partColour.ts and nothing else. A raw colour, or a
  // value read from anything named colour or hex, in a border anywhere else is a coloured card edge.
  // The helper, and its own test, which says what it returns.
  if (!/src\/lib\/theme\/partColour(\.test)?\.ts$/.test(file)) {
    for (const match of every(/\bborder(?:Top|Right|Bottom|Left|Block|Inline)?(?:Color)?\s*:\s*([^,}\n]+)/, code)) {
      if (/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(|\bcolou?r\b|\bhex\b/i.test(match[1])) out.push(found("a border colour not from a token or partColour", code, match.index ?? 0));
    }
  }

  // An outline that is not ring()'s: only `none` or 0 may be written by hand.
  for (const match of every(/\boutline(?:Offset|Color|Width|Style)?\s*:\s*([^,}\n]+)/, code)) {
    const value = match[1].trim();
    if (/^["']none["']$|^0$/.test(value)) continue;
    out.push(found("an outline other than ring()", code, match.index ?? 0));
  }
  return out;
}

/**
 * What may stay, each with its reason. Only an exact piece of a line, and only for the rule named: nothing here
 * excuses anything new.
 */
export const ALLOWED: readonly { rule: string; text: string; why: string }[] = [
  {
    rule: "no glass (backdrop-filter)",
    text: 'not.toContain("backdrop-filter")',
    why: "A test that asserts there is no glass names what it looks for.",
  },
  {
    rule: "no gradient (radial)",
    text: "radial-gradient(${t.dotGrid} 1px, transparent 1px)",
    why: "The map well's dot grid. RULES.md (UI-P99) makes it part of the well recipe for maps and media; it was there before CA-03.",
  },
  {
    rule: "no em dash in copy",
    text: 'export const MISSING = "—";',
    why: "The build page's mark for a fact the maker left empty, there before CA-03 and drawn site-wide; CA-03 only adds a field to the file that holds it.",
  },
  {
    rule: "an outline other than ring()",
    text: "outline: `1px solid ${t.selectedEdge}`, outlineOffset: 3",
    why: "A selected row of pictures in the post editor (PT-06), drawn by a ProseMirror decoration with the selected recipe's edge. It was there before CA-06, which only adds the reference mark to the file.",
  },
  {
    rule: "no em dash in copy",
    text: "the audit cannot",
    why: "The audit harness's own messages and sample rows, there before CA-06, which only adds its four link routes to the file. Not shown on any page.",
  },
  {
    rule: "no em dash in copy",
    text: "Not yet — it is the open gap on the overnight build.",
    why: "The audit harness's own messages and sample rows, there before CA-06, which only adds its four link routes to the file. Not shown on any page.",
  },
  {
    rule: "no em dash in copy",
    text: "React throws on the",
    why: "The audit harness's own messages and sample rows, there before CA-06, which only adds its four link routes to the file. Not shown on any page.",
  },
  {
    rule: "spacing 22 is not in SPACE_REFINED",
    text: 'marginLeft: 22, display: "flex", flexDirection: "column", gap: 2, paddingTop: 4',
    why: "Sources' prompts under a session (UI-P64), lined up under the session's name past its 22px chevron. There before CA-06, which only adds a session's colour dot to the file.",
  },
  {
    rule: "no fade-in on scroll",
    text: "const observer = useRef<IntersectionObserver | null>(null);",
    why: "The build page, before CA-06, which only adds the post's links to the file (useReaderPostLinks). Not new, and not CA-06's to restyle.",
  },
  {
    rule: "no fade-in on scroll",
    text: "if (typeof IntersectionObserver === \"undefined\") {",
    why: "The build page, before CA-06, which only adds the post's links to the file (useReaderPostLinks). Not new, and not CA-06's to restyle.",
  },
  {
    rule: "no fade-in on scroll",
    text: "const watch = new IntersectionObserver(",
    why: "The build page, before CA-06, which only adds the post's links to the file (useReaderPostLinks). Not new, and not CA-06's to restyle.",
  },
  {
    rule: "spacing 7 is not in SPACE_REFINED",
    text: "flexDirection: \"column\", gap: 7 }}>",
    why: "The build page, before CA-06, which only adds the post's links to the file (useReaderPostLinks). Not new, and not CA-06's to restyle.",
  },
  {
    rule: "spacing 7 is not in SPACE_REFINED",
    text: "flexDirection: \"column\", gap: 7, minWidth: 0 }} data-node-id={node.id}>",
    why: "The build page, before CA-06, which only adds the post's links to the file (useReaderPostLinks). Not new, and not CA-06's to restyle.",
  },
  {
    rule: "spacing 17 is not in SPACE_REFINED",
    text: "padding: \"12px 17px\", marginBottom: 9",
    why: "The build page, before CA-06, which only adds the post's links to the file (useReaderPostLinks). Not new, and not CA-06's to restyle.",
  },
  {
    rule: "spacing 9 is not in SPACE_REFINED",
    text: "padding: \"12px 17px\", marginBottom: 9",
    why: "The build page, before CA-06, which only adds the post's links to the file (useReaderPostLinks). Not new, and not CA-06's to restyle.",
  },
  {
    rule: "no cursor-following light",
    text: "root.addEventListener(\"mousemove\", onMove);",
    why: "The post editor's block handle (PT-06) finds the block level with the pointer to put its grip beside it; it draws no light. There before CA-07, which only stops it offering a picture.",
  },
  {
    rule: "no cursor-following light",
    text: "root.removeEventListener(\"mousemove\", onMove);",
    why: "The post editor's block handle (PT-06) finds the block level with the pointer to put its grip beside it; it draws no light. There before CA-07, which only stops it offering a picture.",
  },
];

/** Every finding for one file's source. Pure, so the rules can be tested on snippets. */
export function lookFindings(source: string, file = "snippet.tsx"): Finding[] {
  const code = stripComments(source);
  const out: Finding[] = [];
  for (const { rule, pattern } of FORBIDDEN) for (const match of every(pattern, code)) out.push(found(rule, code, match.index ?? 0));
  out.push(...spacingFindings(code), ...componentFindings(code, file));
  return out.filter((finding) => !ALLOWED.some((allowed) => allowed.rule === finding.rule && finding.text.includes(allowed.text)));
}

/* ── rule 3: no buzzwords in copy ── */

export const BUZZWORDS = [
  "seamless", "effortless", "powerful", "unlock", "supercharge", "elevate", "leverage", "robust", "cutting-edge",
  "next-level", "game-changer", "revolutionary", "magic", "streamline", "empower",
] as const;

const BUZZ = new RegExp(`(?<![\\w-])(${BUZZWORDS.map((word) => word.replace(/-/g, "\\-")).join("|")})(?![\\w-])`, "i");

/** Every string a *_COPY value holds: strings, the strings in objects and arrays, and what a function returns. */
export function copyStrings(value: unknown, depth = 0): string[] {
  if (depth > 6) return [];
  if (typeof value === "string") return [value];
  if (typeof value === "function") {
    const samples: unknown[][] = [[], [2], ["Gmail"], ["Gmail", "Notion"], [2, 3], [["Gmail", "Notion"]]];
    const said: string[] = [];
    for (const args of samples) {
      try {
        said.push(...copyStrings((value as (...a: unknown[]) => unknown)(...args), depth + 1));
      } catch {
        /* a sample the function does not take */
      }
    }
    return said;
  }
  if (Array.isArray(value)) return value.flatMap((entry) => copyStrings(entry, depth + 1));
  if (value && typeof value === "object") return Object.values(value).flatMap((entry) => copyStrings(entry, depth + 1));
  return [];
}

export const buzzwordIn = (text: string): string | null => BUZZ.exec(text)?.[1] ?? null;

/* ── the rules on snippets: each fires, and the allowed forms pass ── */

describe("the look rules, on snippets", () => {
  const rules = (source: string, file?: string) => lookFindings(source, file).map((finding) => finding.rule);

  it("finds every forbidden form, with its line", () => {
    const source = [
      "const a = { background: 'linear-gradient(red, blue)' };",
      "const b = { backdropFilter: 'blur(4px)' };",
      "const c = { fontStyle: \"italic\" };",
      "const d = 'Built with care — by you';",
      "const e = 'Launch \u{1F680}';",
      "import { Button } from \"@/components/ui/button\";",
      "new IntersectionObserver(() => {});",
    ].join("\n");
    const findings = lookFindings(source);
    expect(findings.map((finding) => [finding.rule, finding.line])).toEqual([
      ["no gradient (linear)", 1],
      ["no glass (backdrop-filter)", 2],
      ["no italic", 3],
      ["no fade-in on scroll", 7],
      ["no untouched shadcn", 6],
      ["no emoji", 5],
      ["no em dash in copy", 4],
    ]);
  });

  it("reads past comments, keeping the line numbers", () => {
    const source = "// a linear-gradient — in a comment\n/* backdrop-filter\n */ const x = { padding: 10 };";
    expect(lookFindings(source).map((finding) => [finding.rule, finding.line])).toEqual([["spacing 10 is not in SPACE_REFINED", 3]]);
    expect(stripComments("const u = 'https://example.com'; // x").trim()).toBe("const u = 'https://example.com';");
    expect(stripComments("const s = `a ${b} // not a comment`;")).toContain("// not a comment");
  });

  it("holds spacing to SPACE_REFINED, 0 and 1", () => {
    expect(rules("const s = { gap: 8, padding: \"4px 12px\", margin: 0, paddingTop: 1, rowGap: 16 };")).toEqual([]);
    expect(rules("const s = { gap: 14 };")).toEqual(["spacing 14 is not in SPACE_REFINED"]);
    expect(rules("const s = { padding: \"7px 10px\" };")).toEqual(["spacing 7, 10 is not in SPACE_REFINED"]);
    expect(rules("const s = { padding: phone ? 10 : 8 };")).toEqual(["spacing 10 is not in SPACE_REFINED"]);
    expect(rules("const s = { margin: \"-12px -4px\" };")).toEqual([]);
    expect(rules("const s = { padding: size / 2, gap: MAP.row - row };")).toEqual([]);
  });

  it("holds to the Components table", () => {
    expect(rules("<select value={a} />")).toEqual(["a native <select>"]);
    expect(rules("<input type=\"radio\" checked />")).toEqual(["a visible radio input"]);
    expect(rules("<VisuallyHidden><input type=\"radio\" checked /></VisuallyHidden>")).toEqual([]);
    expect(rules("<input type=\"checkbox\" style={VISUALLY_HIDDEN} />")).toEqual([]);
    expect(rules("<input type=\"radio\" onChange={() => pick(a)} style={VISUALLY_HIDDEN} />")).toEqual([]);
    expect(rules("const s = { textTransform: \"uppercase\" };")).toEqual(["upper case outside the Details eyebrow"]);
    expect(rules("export const EYEBROW = { textTransform: \"uppercase\" };", "src/pages/site/compose/refinedStyles.ts")).toEqual([]);
    expect(rules("const s = { fontFamily: DM_MONO, textTransform: \"none\" };")).toEqual(["the data face with upper case"]);
    expect(rules("<label style={{ fontFamily: DM_MONO }}>Name</label>")).toEqual(["the data face on a label"]);
    expect(rules("import { X } from \"lucide-react\";\nconst a = <X size={12} />;")).toEqual(["the lucide icon X drawn on its own"]);
    expect(rules("import { X } from \"lucide-react\";\nconst a = <IconButton icon={X} glyph=\"x\" label=\"Remove\" />;")).toEqual([]);
    expect(rules("const s = state.hovered ? { opacity: 0.8 } : {};")).toEqual(["opacity on hover"]);
    expect(rules("const s = { outline: \"2px solid red\" };")).toEqual(["an outline other than ring()"]);
    expect(rules("const s = { outline: \"none\", ...ring(focus) };")).toEqual([]);
  });

  it("lets a border take a maker's colour only through partColour.ts (CA-06)", () => {
    expect(rules("const s = { border: `1px solid ${t.hairline}`, borderColor: selected ? t.selectedEdge : t.tileBorder };")).toEqual([]);
    expect(rules("const s = { ...(step.colour ? borderFor(step.colour) : null) };")).toEqual([]);
    expect(rules("const s = { borderColor: step.colour };")).toEqual(["a border colour not from a token or partColour"]);
    expect(rules("const s = { border: `1px solid ${colour}` };")).toEqual(["a border colour not from a token or partColour"]);
    expect(rules("const s = { borderLeft: \"2px solid #7FA7D9\" };")).toEqual(["a border colour not from a token or partColour"]);
    expect(rules("const s = { borderColor: hex };", "src/lib/theme/partColour.ts")).toEqual([]);
  });

  it("lets the map well's dot grid stay, and no other gradient", () => {
    expect(rules("const w = { background: `radial-gradient(${t.dotGrid} 1px, transparent 1px) 0 0 / 16px 16px, ${t.well}` };")).toEqual([]);
    expect(rules("const w = { background: `radial-gradient(${t.lit} 1px, transparent 1px)` };")).toEqual(["no gradient (radial)"]);
  });

  it("finds a buzzword as a whole word only", () => {
    expect(buzzwordIn("A seamless way in")).toBe("seamless");
    expect(buzzwordIn("Unlock it")).toBe("Unlock");
    expect(buzzwordIn("The robustness of it")).toBeNull();
    expect(buzzwordIn("A next-level build")).toBe("next-level");
    expect(copyStrings({ a: "one", b: ["two"], c: (n: number) => `${n} three` })).toEqual(expect.arrayContaining(["one", "two", "2 three"]));
  });
});

/* ── the rules, on every file CA-03 adds or changes ── */

if (CA03_FILES.length > 0) describe.each(CA03_FILES.map((file) => [file]))("%s", (file) => {
  const source = fs.readFileSync(path.join(ROOT, file), "utf8");

  it("keeps the look's rules", () => {
    const findings = lookFindings(source, file).map((finding) => `${file}:${finding.line} ${finding.rule} · ${finding.text}`);
    expect(findings).toEqual([]);
  });

  it("uses no buzzword in its copy", async () => {
    if (!/export const \w+_COPY\b/.test(source)) return;
    const module = (await import(/* @vite-ignore */ path.join(ROOT, file))) as Record<string, unknown>;
    const hits: string[] = [];
    for (const [name, value] of Object.entries(module)) {
      if (!name.endsWith("_COPY")) continue;
      for (const said of copyStrings(value)) {
        const word = buzzwordIn(said);
        if (word) hits.push(`${file} ${name}: "${word}" in "${said}"`);
      }
    }
    expect(hits).toEqual([]);
  });
});

it("lists only files that exist", () => {
  for (const file of CA03_FILES) expect(fs.existsSync(path.join(ROOT, file)), file).toBe(true);
});
