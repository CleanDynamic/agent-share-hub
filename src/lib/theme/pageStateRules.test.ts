// G30: the page states stay in one place. A guard beside the look rules (lookRules.test.ts): it fails if any file under
// src/pages/site
//   - imports ErrorState or EmptyState directly (they are drawn through PageState; only src/components/pagestate imports them),
//   - writes its own "didn't load" or "Retry" (the words are the copy module's: "Couldn't load <thing>. Try again."),
//   - or puts a timer around a read (the one time limit is the client's, src/lib/query/readLimit.ts).
//
// WHAT IS READ. Every .ts and .tsx under src/pages/site except tests, audits and harnesses; comments are blanked first (line
// breaks kept), so a comment that names a rule is not a breach of it. Each finding names the file and the line.
//
// A TIMER AROUND A READ is any of: Promise.race; an AbortController in a file that also starts a timer; a timer whose callback
// rejects or aborts; the retired useStalled hook.
//
// WRITES ARE NOT READS. A save that stopped offers "Retry" (the save line, a write's toast): that is a mutation's own error
// handling, which this work does not change, and each place is listed in WRITE_RETRY with the write it retries.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../../..");
const SITE = path.join(ROOT, "src/pages/site");

/** The places a write that stopped offers "Retry", by file, with the write. Nothing here is a read. */
const WRITE_RETRY: Record<string, string> = {
  "src/pages/site/compose/SaveLine.tsx": "the build's save: not saved · Retry",
  "src/pages/site/compose/ComposePage.tsx": "publishing: the Build not published toast",
  "src/pages/site/compose/draftStart.ts": "every composer write's failure toast (sayFailed)",
  "src/pages/site/compose/SessionHead.tsx": "importing a session's prompts again (it writes the tiles)",
};

/** A timer pattern that is not around a read, by file, with what it waits for. */
const NOT_A_READ: Record<string, string> = {
  "src/pages/site/compose/pageScroll.ts": "Promise.race of the scroll ending and the scroll being stopped",
};

function stripComments(source: string): string {
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

interface Finding {
  file: string;
  line: number;
  rule: string;
  text: string;
}

function siteFiles(dir: string = SITE): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__audit__") continue;
      out.push(...siteFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec|audit|harness)\.|\.d\.ts$/.test(entry.name) && !/harness/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** The findings for one file's source. Exported so the rules themselves are tested on snippets below. */
export function pageStateFindings(source: string, file: string): Finding[] {
  const code = stripComments(source);
  const lines = code.split("\n");
  const findings: Finding[] = [];
  const add = (rule: string, index: number) => {
    const line = lineOf(code, index);
    findings.push({ file, line, rule, text: lines[line - 1].trim().slice(0, 140) });
  };
  for (const match of code.matchAll(/from\s+["'][^"']*\/(ErrorState|EmptyState)["']/g)) add(`imports ${match[1]} directly`, match.index ?? 0);
  for (const match of code.matchAll(/did(?:n'|n\\'|n’)t load/g)) add(`writes its own "didn't load"`, match.index ?? 0);
  if (!(file in WRITE_RETRY)) for (const match of code.matchAll(/(?<![A-Za-z0-9_$])Retry(?![A-Za-z0-9_$])/g)) add(`writes its own "Retry"`, match.index ?? 0);
  if (!(file in NOT_A_READ)) for (const match of code.matchAll(/Promise\.race\(/g)) add("a timer around a read (Promise.race)", match.index ?? 0);
  const timers = /\b(setTimeout|setInterval)\s*\(/.test(code);
  if (timers) for (const match of code.matchAll(/new\s+AbortController\s*\(/g)) add("a timer around a read (an AbortController beside a timer)", match.index ?? 0);
  for (const match of code.matchAll(/\bsetTimeout\s*\(\s*(?:\(\)\s*=>|function\b)[^;]{0,160}?\b(reject|abort)\s*\(/g)) add(`a timer around a read (a timer that ${match[1]}s)`, match.index ?? 0);
  for (const match of code.matchAll(/\buseStalled\b/g)) add("a timer around a read (useStalled)", match.index ?? 0);
  return findings;
}

const report = (findings: Finding[]) => findings.map((f) => `${f.file}:${f.line} ${f.rule}: ${f.text}`).join("\n");

describe("G30: page states stay in PageState", () => {
  const files = siteFiles();

  it("reads the site's pages", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("no file under src/pages/site breaks the rules", () => {
    const findings = files.flatMap((full) => pageStateFindings(fs.readFileSync(full, "utf8"), path.relative(ROOT, full)));
    expect(report(findings)).toBe("");
  });

  it("every write that offers Retry is still where the list says", () => {
    for (const [file, write] of Object.entries(WRITE_RETRY)) {
      const source = stripComments(fs.readFileSync(path.join(ROOT, file), "utf8"));
      expect(/(?<![A-Za-z0-9_$])Retry(?![A-Za-z0-9_$])/.test(source), `${file}: ${write}`).toBe(true);
    }
  });
});

describe("the rules, on snippets", () => {
  const rules = (source: string) => pageStateFindings(source, "src/pages/site/x/X.tsx").map((f) => f.rule);

  it("catches a direct import of ErrorState or EmptyState, not PageState", () => {
    expect(rules('import { ErrorState } from "@/components/brand/ErrorState";')).toEqual(["imports ErrorState directly"]);
    expect(rules('import { EmptyState } from "../../components/brand/EmptyState";')).toEqual(["imports EmptyState directly"]);
    expect(rules('import { PageState } from "@/components/pagestate/PageState";')).toEqual([]);
  });

  it("catches its own words, in a string or in JSX, and not in a comment or a name", () => {
    expect(rules('const line = "Your drafts didn\'t load.";')).toEqual([`writes its own "didn't load"`]);
    expect(rules("<p>Sources didn't load</p>")).toEqual([`writes its own "didn't load"`]);
    expect(rules("<button>Retry</button>")).toEqual([`writes its own "Retry"`]);
    expect(rules('toast.error(line, { action: { label: "Retry", onClick } });')).toEqual([`writes its own "Retry"`]);
    expect(rules("// Retry: didn't load\nconst onRetry = () => undefined; const retry = 1; function RetryButton() {}")).toEqual([]);
  });

  it("catches a timer around a read", () => {
    expect(rules("await Promise.race([read(), wait(10)]);")).toEqual(["a timer around a read (Promise.race)"]);
    expect(rules("const c = new AbortController(); setTimeout(() => c.abort(), 5000);")).toEqual([
      "a timer around a read (an AbortController beside a timer)",
      "a timer around a read (a timer that aborts)",
    ]);
    expect(rules("new Promise((_, reject) => setTimeout(() => reject(new Error('slow')), 10));")).toEqual(["a timer around a read (a timer that rejects)"]);
    expect(rules("const stalled = useStalled(query);")).toEqual(["a timer around a read (useStalled)"]);
    expect(rules("window.setTimeout(() => setShown(true), 300);")).toEqual([]);
  });
});
