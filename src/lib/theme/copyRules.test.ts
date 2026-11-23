// Prompt 9, G12: the words' rules as a test, beside the look rules (lookRules.test.ts) and the page-state guard
// (pageStateRules.test.ts).
//
// WHAT IS READ. Screen text in the edit area: the words a person reads or a screen reader announces. The files are parsed
// with the TypeScript compiler, so comments are never read, and a string counts as screen text when it is
//   - JSX text,
//   - a JSX attribute that is not code (className, style, href, to, data-*, on*, key, id, type, role, test ids … are code),
//   - or any other string that reads as words (two words with a space, a capitalised word, or a sentence ending in . ! ? …),
//     unless it is code by its place: an import, an object key, a comparison, a case label, a type, or an argument to a
//     call that takes code (a query, storage, a selector, console, the error tracker, analytics).
// A template literal is read with each `${…}` as "{}".
//
// Each rule has a switch. A rule is turned on when its goal is done (ORDER in the prompt), so the switch list is also a
// record of how far the work has got. Each finding names the file, the line and the text.
//
// THE ALLOW LIST. Every exception is one entry, keyed by file and exact text, with its reason. A file that is fixture data
// or a harness (never a screen) is skipped whole, in NOT_SCREENS, with its reason.

import fs from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");

/** The edit area (D1), plus the copy module and the error mapper. */
export const EDIT_AREA: readonly string[] = [
  "src/pages/site",
  "src/components/shell",
  "src/components/brand",
  "src/components/vision",
  "src/components/post",
  "src/components/build",
  "src/components/pagestate",
  "src/lib/copy",
];

/** Files in the edit area that no person reads: fixtures, harnesses and dev pages. */
const NOT_SCREENS: Record<string, string> = {
  "src/pages/site/compose/ca20Fixture.ts": "fixture data for the CA-20 harness",
  "src/pages/site/compose/ca20Harness.tsx": "a test harness page, not routed in production",
  "src/pages/site/compose/sv07Harness.tsx": "a test harness page, not routed in production",
  "src/pages/site/compose/sv07Backend.ts": "the harness's fake backend",
  "src/pages/site/signin/signinTest.tsx": "test helpers for the sign-in dialog",
};

// ── reading screen text ──────────────────────────────────────────────────────────────────────────────────────────

const CODE_ATTRS = new Set([
  "className", "style", "id", "key", "href", "to", "type", "name", "role", "variant", "size", "src", "srcSet", "rel",
  "target", "method", "action", "autoComplete", "inputMode", "htmlFor", "as", "align", "side", "lang", "testId", "icon",
  "tone", "kind", "mode", "color", "width", "height", "viewBox", "d", "fill", "stroke", "accept", "pattern", "loading",
  "decoding", "sizes", "path", "value", "defaultValue", "dir", "form", "tabIndex", "xmlns", "transform", "points",
  "state", "status", "placement", "region", "slot", "thing", "storageKey", "anchor", "font", "weight", "track",
]);
const isCodeAttr = (name: string) => CODE_ATTRS.has(name) || name.startsWith("data-") || /^on[A-Z]/.test(name);

/** Object keys whose string values are code, not words. Keys that hold words (label, title, line …) are not here. */
const CODE_KEY =
  /^(context|source|className|style|background\w*|border\w*|font\w*|margin\w*|padding\w*|transition|animation\w*|boxShadow|outline\w*|grid\w*|flex\w*|color|colour|top|left|right|bottom|inset|transform\w*|zIndex|opacity|overflow\w*|whiteSpace|textTransform|letterSpacing|lineHeight|textAlign|max\w+|min\w+|width|height|filter|backdropFilter|WebkitBackdropFilter|clipPath|mask\w*|objectFit|objectPosition|pointerEvents|userSelect|verticalAlign|wordBreak|textDecoration\w*|textOverflow|boxSizing|willChange|contain|aspectRatio|place\w+|align\w+|justify\w+|content|accent\w*|easing|duration|delay|select|table|bucket|column|key|slug|event|channel|queryKey|storage\w*|icon|tone|variant|size|kind|id|path|route|href|to|type|mode|status|state|name|value|field|sort|order|platform|format|mime|ext|lang|locale|dir|tag|code|ref|source|origin|provider|scope|target|rel|method|url|src|image|thumbnail|avatar|cover|testId|cursor|display|position|gap|radius|shadow|fill|stroke|d|viewBox)$/;

/** Calls whose string arguments are code. */
const CODE_CALL =
  /(^|\.)(from|select|eq|neq|in|order|rpc|channel|on|getItem|setItem|removeItem|addEventListener|removeEventListener|querySelector|querySelectorAll|getElementById|matchMedia|startsWith|endsWith|includes|split|replace|replaceAll|test|match|matchAll|indexOf|join|track|captureException|captureMessage|addBreadcrumb|setTag|setContext|get|set|has|delete|append|filter|or|ilike|like|is|contains|textSearch|upsert|insert|update|navigate|push|invoke|localeCompare|toLocaleDateString|toLocaleString|mark|measure|getPropertyValue|setProperty|createElement|setAttribute|getAttribute|closest|dispatchEvent|postMessage|open|prefetch|emit|log|warn|error|info|debug|require|cn|clsx|twMerge|cva|css|keyframes|reportError|reportFailure|useMediaQuery|useQuery|useInfiniteQuery|queryOptions|lazy|fetch|URL|Intl|CustomEvent|Event|RegExp|Symbol|Date|parse|stringify|padStart|padEnd|slice|substring|charAt|normalize|toLowerCase|toUpperCase|localStorageKey|withTimeout|logEvent|trackEvent)$/;

function looksLikeCode(s: string): boolean {
  if (!/[A-Za-z]/.test(s)) return true;
  if (/^[a-z0-9_.:/#?=&%{}-]+$/.test(s)) return true; // identifiers, keys, paths, slugs
  if (/^[A-Z0-9_{}]+$/.test(s)) return true;
  if (/^(https?:|mailto:|\/)/.test(s)) return true;
  if (/^[a-z]+(-[a-z]+)+$/.test(s)) return true;
  if (/\b(px|rem|vh|vw|rgba?|hsla?|oklch|var\(|calc\(|solid|cubic-bezier|translate[XY]?\(|minmax|repeat\()/.test(s) && !/[.!?…]$/.test(s)) return true;
  if (/^[\w\s,:*()!.{}]+$/.test(s) && /,\s*\w+\(|\w+:\w+\(|\*,|\w+,\w+/.test(s) && !/\s[a-z]+\s/.test(s)) return true; // selects
  return false;
}

const readsAsWords = (s: string) => /[A-Za-z]{2,}\s+[A-Za-z]/.test(s) || /^[A-Z][a-z]+$/.test(s) || /[.!?…]$/.test(s);

export interface ScreenString {
  file: string;
  line: number;
  text: string;
}

/** Every screen string in one source text. Exported for the self-tests below and for the report's counts. */
export function screenText(source: string, file: string): ScreenString[] {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
  const out: ScreenString[] = [];
  const emit = (node: ts.Node, raw: string) => {
    const text = raw.replace(/\s+/g, " ").trim();
    if (!text || !/[A-Za-z]/.test(text)) return;
    out.push({ file, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, text });
  };
  const templateText = (n: ts.TemplateExpression | ts.NoSubstitutionTemplateLiteral) =>
    ts.isNoSubstitutionTemplateLiteral(n) ? n.text : n.head.text + n.templateSpans.map((span) => "{}" + span.literal.text).join("");

  /** "code", "attr" (a JSX attribute that is words), or "loose" (anywhere else: counted only if it reads as words). */
  function placeOf(node: ts.Node): "code" | "attr" | "loose" {
    let child: ts.Node = node;
    let p: ts.Node | undefined = node.parent;
    while (p) {
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p) || ts.isExternalModuleReference(p)) return "code";
      if (ts.isPropertyAssignment(p) && p.name === child) return "code";
      if (ts.isPropertyAssignment(p)) return CODE_KEY.test(p.name.getText(sf).replace(/["']/g, "")) ? "code" : "loose";
      if (ts.isElementAccessExpression(p) && p.argumentExpression === child) return "code";
      if (ts.isCaseClause(p) && p.expression === child) return "code";
      if (ts.isBinaryExpression(p)) {
        const op = p.operatorToken.kind;
        if (
          op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
          op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
          op === ts.SyntaxKind.EqualsEqualsToken ||
          op === ts.SyntaxKind.ExclamationEqualsToken ||
          op === ts.SyntaxKind.InKeyword
        )
          return "code";
      }
      if (ts.isJsxAttribute(p)) return isCodeAttr(p.name.getText(sf)) ? "code" : "attr";
      if (ts.isCallExpression(p) || ts.isNewExpression(p)) {
        const callee = p.expression.getText(sf);
        if (CODE_CALL.test(callee)) return "code";
        return "loose";
      }
      if (ts.isTaggedTemplateExpression(p)) return "code";
      if (
        ts.isReturnStatement(p) ||
        ts.isVariableDeclaration(p) ||
        ts.isArrayLiteralExpression(p) ||
        ts.isConditionalExpression(p) ||
        ts.isBinaryExpression(p) ||
        ts.isParenthesizedExpression(p) ||
        ts.isTemplateSpan(p) ||
        ts.isTemplateExpression(p) ||
        ts.isAsExpression(p) ||
        ts.isSatisfiesExpression(p) ||
        ts.isArrowFunction(p) ||
        ts.isJsxExpression(p)
      ) {
        child = p;
        p = p.parent;
        continue;
      }
      return "loose";
    }
    return "loose";
  }

  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) {
      emit(node, node.text);
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      const text = ts.isStringLiteral(node) ? node.text : templateText(node);
      const place = placeOf(node);
      if (place !== "code" && !looksLikeCode(text) && (place === "attr" || readsAsWords(text))) emit(node, text);
      if (ts.isTemplateExpression(node)) {
        node.templateSpans.forEach((span) => visit(span.expression));
        return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return out;
}

function sourceFiles(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__audit__" && entry.name !== "__tests__") out.push(...sourceFiles(rel));
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$|\.d\.ts$/.test(entry.name) && !(rel in NOT_SCREENS)) {
      out.push(rel);
    }
  }
  return out;
}

export const editAreaFiles = (): string[] => EDIT_AREA.flatMap(sourceFiles);

// ── the rules ────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Rule {
  id: string;
  goal: string;
  /** Switched on when its goal is done. */
  on: boolean;
  /** Whether one screen string breaks the rule. */
  breaks: (text: string) => boolean;
  /** The copy module itself may hold the words this rule keeps out of every other file. */
  copyModuleMayHold?: boolean;
}

export const RULES: Rule[] = [
  // G3: errors
  { id: "could-not", goal: "G3", on: true, breaks: (s) => /\bCould not\b/i.test(s) },
  { id: "failed-to", goal: "G3", on: true, breaks: (s) => /\bFailed to\b/i.test(s) },
  { id: "unable-to", goal: "G3", on: true, breaks: (s) => /\bUnable to\b/i.test(s) },
  { id: "error-opening", goal: "G3", on: true, breaks: (s) => /^Error\b/.test(s) },
  { id: "oops", goal: "G3", on: true, breaks: (s) => /\bOops\b/i.test(s) },
  { id: "something-went-wrong", goal: "G3", on: true, breaks: (s) => /something went wrong/i.test(s) },
  { id: "didnt-save", goal: "G3", on: true, breaks: (s) => /\bdidn['’]t save\b/i.test(s) },
  // G5: sign-in prompts come from SIGN_IN only
  { id: "sign-in-to", goal: "G5", on: true, breaks: (s) => /\bSign in to\b/.test(s), copyModuleMayHold: true },
  // G6: an empty state is a sentence with a full stop
  {
    id: "empty-stop",
    goal: "G6",
    on: true,
    breaks: (s) => /^(No|Nothing)\b/.test(s) && /\b(yet|match|matches|recorded|has that name|listed|to post in)\b/.test(s) && !/[.?]$/.test(s),
  },
  // G7: waiting labels
  { id: "three-dots", goal: "G7", on: true, breaks: (s) => /\.\.\.\s*$/.test(s) },
  // G8: confirmations
  { id: "exclamation", goal: "G8", on: true, breaks: (s) => /!\s*$/.test(s) },
  { id: "tick-or-emoji", goal: "G8", on: true, breaks: (s) => /[✓✔✅🎉👍]/u.test(s) },
  // G9
  { id: "please", goal: "G9", on: true, breaks: (s) => /\bPlease /.test(s) },
  // G1, G2: the glossary
  { id: "log-in", goal: "G1", on: true, breaks: (s) => /\blog ?in\b/i.test(s) },
  { id: "log-out", goal: "G1", on: true, breaks: (s) => /\blog ?out\b/i.test(s) },
  // "Join" for an account (glossary row swapped after Part A): Sign up is the word; Join is only Join space.
  { id: "account-join", goal: "G1", on: true, breaks: (s) => /\bJoin (free|again|now|today|us)\b|\bBy joining\b|^Joining…?$/i.test(s) },
  { id: "register", goal: "G1", on: true, breaks: (s) => /\bregister\b/i.test(s) },
  { id: "create-account", goal: "G1", on: true, breaks: (s) => /\bcreate (an )?account\b/i.test(s) },
  { id: "blueprint", goal: "G1", on: true, breaks: (s) => /\bblueprints?\b/i.test(s) },
  { id: "project", goal: "G1", on: true, breaks: (s) => /\bprojects?\b/i.test(s) },
  { id: "workflow", goal: "G1", on: true, breaks: (s) => /\bworkflows?\b/i.test(s) },
  { id: "remix", goal: "G1", on: true, breaks: (s) => /\bremix/i.test(s) },
  { id: "fork", goal: "G1", on: true, breaks: (s) => /\bfork(s|ed|ing)?\b/i.test(s) },
  { id: "bare-join", goal: "G2", on: true, breaks: (s) => /^Join$/.test(s) },
  // G3 (after Part A): a failure is "Couldn't <verb> <thing>. Try again.", never the short "<Thing> not <done>".
  { id: "not-done", goal: "G3", on: true, breaks: (s) => /^[A-Z][A-Za-z {}·]*? not (added|saved|moved|removed|changed|made|deleted|copied|published|unpublished|updated|set|kept|linked|split|merged|imported|created|sent|renamed|started|loaded|dismissed|attached|uploaded|found|shared)\b[a-z ]*$/.test(s) },
  // G10: the product's name
  { id: "old-name", goal: "G10", on: true, breaks: (s) => /build ?gallery|neo ?scale/i.test(s) },
  { id: "name-literal", goal: "G10", on: true, breaks: (s) => /openbuilds\.ai/i.test(s) },
];

/**
 * Exceptions, keyed `file|exact screen text` (as screenText reads it), with the reason. `*` as the text excuses every string
 * in that file for that rule.
 */
export const ALLOW: Record<string, Record<string, string>> = {
  // Synth 11 gives this word: the small Join on each row of "Most new posts this week", beside the space's name. Its
  // accessible name is "Join <space>", so to a screen reader it is never bare.
  "bare-join": {
    "src/pages/site/openbuilds/OpenBuildsFeedView.tsx|Join": "the row's small Join beside the space's name (Synth 11); named \"Join <space>\" for screen readers",
  },
  "empty-stop": {
    "src/pages/site/profile/profileModel.ts|No streak yet": "a value in the streak stat line, beside \"12-day streak · best 31\"; not an empty state",
    "src/pages/site/settings/AppsView.tsx|No access listed": "a value in an app's hint, beside \"Can access: …\"; not an empty state",
    "src/components/build/FullPromptWindow.tsx|No variables yet": "a count in the window's meta line, beside \"3 variables\"; a value",
    "src/components/build/FullPromptWindow.tsx|Nothing added yet": "the placeholder of an empty reply box, not an empty state",
    "src/pages/site/library/LibraryPage.tsx|Nothing saved yet": "the heading of the Library's own empty state (a fact, as every heading is); the sentence under it ends with a full stop",
    "src/pages/site/compose/StillOpenSpaces.tsx|No spaces to post in": "a disabled menu option (menu options are not empty states)",
    "src/pages/site/openbuilds/NewPostWindow.tsx|No spaces to post in": "a disabled menu option (menu options are not empty states)",
  },
  // TB-02 Part 5.3 fixes this card subtitle's words; "Please don't" is the Terms' own lead-in, not an apology or a request to retry.
  please: {
    "src/pages/site/legal/FooterPageView.tsx|{} rules · Please don't": "the Rules card's subtitle, carrying the Terms' lead-in \"Please don't:\" (TB-02 Part 5.3)",
  },
  // Statuses, one entry per pattern: each describes the current state, not a failed action.
  "not-done": {
    "src/pages/site/compose/saveWindows.tsx|Prompt not sent": "status: the leave window's title while only unsent prompt text remains (beside \"Changes still saving\")",
    "src/pages/site/compose/SandboxCard.tsx|Classification not saved": "status: the card footer's state line (role=status), beside \"Required fields complete\"",
    "src/pages/site/build/BuildSteps.tsx|{} · not shared": "status: a row's sharing state, beside the kind",
    "src/pages/site/notfound/NotFoundPage.tsx|Page not found": "status: the page's title",
  },
  project: {
    "src/pages/site/build/BuildSteps.tsx|Put {} in your project": "the reader's own code project, where a file goes; not a build",
    "src/components/build/FullPromptWindow.tsx|Custom instructions or project knowledge that applied": "an AI provider's Projects feature; not a build",
  },
  workflow: {
    "src/pages/site/compose/detailsModel.ts|The command or workflow": "a tool's command or CI workflow file; not a build",
    "src/pages/site/compose/toolPickerModel.ts|Add its workflow with Add › File": "a tool's workflow file; not a build",
    "src/pages/site/signin/SignInDialogFrame.tsx|Publish, reproduce and rebuild AI-assisted workflows.": "the tagline, decided by the owner (prompt 9)",
    "src/pages/site/signin/SignInDialogFrame.tsx|AI-assisted workflows.": "the tagline's third line on a phone",
  },
};

export interface Finding extends ScreenString {
  rule: string;
}

export function findingsIn(strings: ScreenString[], rules: Rule[] = RULES.filter((r) => r.on)): Finding[] {
  const out: Finding[] = [];
  for (const s of strings) {
    for (const rule of rules) {
      if (!rule.breaks(s.text)) continue;
      if (rule.copyModuleMayHold && s.file.startsWith("src/lib/copy/")) continue;
      const allowed = ALLOW[rule.id];
      if (allowed && (`${s.file}|${s.text}` in allowed || `${s.file}|*` in allowed)) continue;
      out.push({ ...s, rule: rule.id });
    }
  }
  return out;
}

// ── the tests ────────────────────────────────────────────────────────────────────────────────────────────────────

describe("copy rules (prompt 9, G12)", () => {
  const files = editAreaFiles();
  const strings = files.flatMap((file) => screenText(fs.readFileSync(path.join(ROOT, file), "utf8"), file));

  it("reads the edit area", () => {
    expect(files.length).toBeGreaterThan(300);
    expect(strings.length).toBeGreaterThan(3000);
  });

  for (const rule of RULES.filter((r) => r.on)) {
    it(`${rule.goal} ${rule.id}: no screen string in the edit area breaks it`, () => {
      const found = findingsIn(strings, [rule]).map((f) => `${f.file}:${f.line} ${JSON.stringify(f.text)}`);
      expect(found).toEqual([]);
    });
  }

  it("every allow-list entry has a reason and still names a string that is there", () => {
    const present = new Set(strings.map((s) => `${s.file}|${s.text}`));
    const filesPresent = new Set(files);
    for (const [rule, entries] of Object.entries(ALLOW)) {
      expect(RULES.some((r) => r.id === rule), `unknown rule ${rule}`).toBe(true);
      for (const [key, reason] of Object.entries(entries)) {
        expect(reason.trim().length, `${rule} ${key}: no reason`).toBeGreaterThan(8);
        const [file, text] = key.split("|");
        expect(filesPresent.has(file), `${rule} ${key}: file not in the edit area`).toBe(true);
        if (text !== "*") expect(present.has(key), `${rule} ${key}: no such string any more`).toBe(true);
      }
    }
  });

  // COPY_REPORT=<file> writes every finding of every rule, on or off, for the report's before-and-after counts.
  it.runIf(Boolean(process.env.COPY_REPORT))("writes the report", () => {
    const all = findingsIn(strings, RULES);
    fs.writeFileSync(process.env.COPY_REPORT as string, JSON.stringify({ strings: strings.length, findings: all }, null, 1));
  });

  it("every skipped file is still there", () => {
    for (const file of Object.keys(NOT_SCREENS)) expect(fs.existsSync(path.join(ROOT, file)), file).toBe(true);
  });
});

describe("the reader and the rules catch what they should, whether switched on or not", () => {
  const read = (source: string, file = "x.tsx") => screenText(source, file).map((s) => s.text);
  const breaks = (id: string, text: string) => RULES.find((r) => r.id === id)!.breaks(text);

  it("reads JSX text, word attributes and sentences, and not code", () => {
    expect(read('<p title="Open it">Saved.</p>')).toEqual(["Open it", "Saved."]);
    expect(read('<a href="/login" className="a b" data-testid="x">Go</a>')).toEqual(["Go"]);
    expect(read('// Could not\nconst a = "Could not save that.";')).toEqual(["Could not save that."]);
    expect(read('import x from "Could not";\nif (k === "Log in") f(); localStorage.setItem("Sign in to x", "1");')).toEqual([]);
    expect(read('const s = { label: "Saving...", color: "red solid", key: "a b" };')).toEqual(["Saving..."]);
    expect(read("const line = `Couldn't load ${thing}. Try again.`;")).toEqual(["Couldn't load {}. Try again."]);
  });

  it("each rule catches its sample and passes the right way to say it", () => {
    const cases: [string, string, string][] = [
      ["could-not", "Could not save the draft.", "Couldn't save your draft. Try again."],
      ["failed-to", "Failed to send", "Couldn't send that. Try again."],
      ["something-went-wrong", "Something went wrong", "Couldn't do that. Try again."],
      ["didnt-save", "That didn't save. Try again.", "Couldn't save that. Try again."],
      ["sign-in-to", "Sign in to save this", "Sign in"],
      ["empty-stop", "No sessions yet", "No sessions yet."],
      ["three-dots", "Saving...", "Saving…"],
      ["exclamation", "Copied!", "Link copied."],
      ["please", "Please try again.", "Try again."],
      ["log-in", "Log in", "Sign in"],
      ["account-join", "Join free", "Sign up"],
      ["account-join", "By joining you agree", "By signing up you agree"],
      ["fork", "Publish, reproduce and fork", "Publish, reproduce and rebuild"],
      ["bare-join", "Join", "Join space"],
      ["not-done", "Step not moved", "Couldn't move the step. Try again."],
      ["create-account", "Create account", "Sign up"],
      ["old-name", "Welcome to NeoScale", "Welcome"],
    ];
    for (const [id, bad, good] of cases) {
      expect(breaks(id, bad), `${id} catches ${bad}`).toBe(true);
      expect(breaks(id, good), `${id} passes ${good}`).toBe(false);
    }
  });
});
