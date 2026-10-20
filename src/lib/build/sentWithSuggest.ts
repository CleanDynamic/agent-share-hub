// CA-04 P2 — code a person sent with an imported prompt, offered as a tile inside it.
//
// PURE. The importer files code blocks out of the AI's answers into the tray; it does not file the code a person
// pasted under their own prompt. That code is still in the prompt's text, word for word, inside its fences. Each
// fence of an imported prompt is offered as a dashed suggestion: Accept makes a code tile inside the prompt with
// that block exactly; Ignore keeps it from being offered again (`payload.dismissed`, "sent:<n>"). Nothing is offered
// for a prompt typed here, for a block already inside it, or for a block ignored before.

import { CODE_LANGUAGES, type CodeLanguage, type Step } from "./graph";

export const SENT_WITH_COPY = {
  line: "Sent with this prompt in the chat. Keep it inside?",
  accept: "Accept",
  ignore: "Ignore",
} as const;

export interface CodeSuggestion {
  /** "sent:<n>": the block's place among the prompt's fences, the key Ignore stores. */
  key: string;
  stepId: string;
  source: string;
  language: CodeLanguage;
  filename: string | null;
}

const ALIASES: Record<string, CodeLanguage> = {
  ts: "ts",
  typescript: "ts",
  tsx: "tsx",
  js: "js",
  javascript: "js",
  jsx: "jsx",
  py: "python",
  python: "python",
  sql: "sql",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  bash: "bash",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  html: "html",
  css: "css",
};

const FILENAME = /^[\w./-]+\.[A-Za-z0-9]{1,8}$/;

/** A fence's info line read as a language from the schema's list and a file name, when it names one. */
function readInfo(info: string): { language: CodeLanguage; filename: string | null } {
  const tokens = info.trim().split(/\s+/).filter(Boolean);
  let language: CodeLanguage = "other";
  let filename: string | null = null;
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (language === "other" && ALIASES[lower]) language = ALIASES[lower];
    else if (language === "other" && (CODE_LANGUAGES as readonly string[]).includes(lower)) language = lower as CodeLanguage;
    else if (!filename && FILENAME.test(token)) filename = token;
  }
  return { language, filename };
}

/** The fenced blocks in a text, in order: their info line and their lines exactly. An unclosed fence is not a block. */
export function fencedBlocks(text: string): { info: string; source: string }[] {
  const out: { info: string; source: string }[] = [];
  const pattern = /^(`{3,})([^\n`]*)\n([\s\S]*?)\n\1[ \t]*$/gm;
  for (const match of text.matchAll(pattern)) out.push({ info: match[2], source: match[3] });
  return out;
}

/** The code blocks of an imported prompt not yet inside it and not ignored. */
export function codeInPrompt(step: Step): CodeSuggestion[] {
  if (step.kind !== "prompt" || !step.sessionId) return [];
  const inside = new Set((step.sentWith ?? []).filter((tile) => tile.kind === "code").map((tile) => tile.text.trim()));
  const ignored = new Set(step.dismissed ?? []);
  return fencedBlocks(step.text).flatMap((block, at) => {
    const key = `sent:${at}`;
    const source = block.source;
    if (!source.trim() || ignored.has(key) || inside.has(source.trim())) return [];
    return [{ key, stepId: step.id, source, ...readInfo(block.info) }];
  });
}
