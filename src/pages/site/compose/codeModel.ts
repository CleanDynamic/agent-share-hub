// What the composer knows about code before it is a step (CA-02 P7), pure.
//
// The language a code step is saved with comes from `detectLanguage` through one map to the code node type's enum; a
// file name that names a language (.tsx, .jsx, .yml, and the plain ones such as .ts or .py) overrides the guess. A file is taken only when it is text: its type says so
// and its first 8 KB hold no NUL byte. NOTHING HERE RUNS CODE, and nothing in the composer imports `codeRunner`.

import { CODE_LANGUAGES, CODE_MAX, type CodeLanguage } from "@/lib/build/graph";
import { detectLanguage, type CodeLanguage as DetectedLanguage } from "@/lib/detectLanguage";

export const CODE_COPY = {
  /** CA-02 P7: the refusals of a file, after its name. */
  notText: "That file isn't text.",
  tooLong: "Code is at most 100,000 characters. Upload it as a file instead.",
  empty: "Code needs its lines.",
  /** CA-02 P7: the offer under Typed here when the text pasted there reads as code. */
  looksLikeCode: "This looks like code.",
  keepAsCode: "Keep it as code",
} as const;

/** `detectLanguage`'s names, as the code node type's enum. */
export const LANGUAGE_OF_DETECTED: Readonly<Record<DetectedLanguage, CodeLanguage>> = {
  javascript: "js",
  typescript: "ts",
  python: "python",
  json: "json",
  html: "html",
  css: "css",
  sql: "sql",
  shell: "bash",
  markdown: "other",
  plaintext: "other",
};

/**
 * File endings that name the language better than a guess from the text. The prompt names .tsx, .jsx and .yml, which
 * the guess cannot tell; the rest are as plain, and a guess would get `app.ts` wrong whenever it reads like JavaScript.
 */
const LANGUAGE_OF_ENDING: Readonly<Record<string, CodeLanguage>> = {
  tsx: "tsx",
  jsx: "jsx",
  yml: "yaml",
  yaml: "yaml",
  ts: "ts",
  mts: "ts",
  cts: "ts",
  js: "js",
  mjs: "js",
  cjs: "js",
  py: "python",
  sql: "sql",
  json: "json",
  sh: "bash",
  bash: "bash",
  html: "html",
  htm: "html",
  css: "css",
};

/** The ending of a file name, in lower case, or "". */
const endingOf = (filename: string | null | undefined): string => {
  const match = /\.([a-z0-9]+)$/i.exec(filename?.trim() ?? "");
  return match ? match[1].toLowerCase() : "";
};

/** The language to prefill: the file name's when its ending names one, else the guess from the text. */
export function codeLanguageFor(source: string, filename?: string | null): CodeLanguage {
  return LANGUAGE_OF_ENDING[endingOf(filename)] ?? LANGUAGE_OF_DETECTED[detectLanguage(source)];
}

export const isCodeLanguage = (value: string): value is CodeLanguage => (CODE_LANGUAGES as readonly string[]).includes(value);

/** Lines in a text: one more than its line breaks, none for empty text. A last empty line is not counted. */
export function lineCount(source: string): number {
  if (!source) return 0;
  return source.replace(/\r?\n$/, "").split(/\r?\n/).length;
}

/** The first `n` lines, for the List's well. */
export const firstLines = (source: string, n = 6): string => source.split(/\r?\n/).slice(0, n).join("\n");

/** Whether text pasted into Typed here reads as code: at least 3 lines, in a language that is not plain text or markdown. */
export function looksLikeCode(text: string): boolean {
  if (lineCount(text.trim()) < 3) return false;
  const guess = detectLanguage(text);
  return guess !== "plaintext" && guess !== "markdown";
}

/** File types that are text whatever their name. */
const TEXT_TYPES = new Set([
  "application/json",
  "application/javascript",
  "application/x-javascript",
  "application/typescript",
  "application/x-typescript",
  "application/x-sh",
  "application/x-shellscript",
  "application/sql",
  "application/xml",
  "application/x-yaml",
  "application/yaml",
  "application/toml",
]);

/** Endings of code files a browser often gives no type, or a wrong one (a .ts file comes as video/mp2t). */
const CODE_ENDINGS = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "sql", "json", "yml", "yaml", "sh", "bash", "html", "htm", "css", "md", "txt", "toml", "ini", "env", "rb", "go", "rs", "java", "kt", "swift", "c", "h", "cpp", "cs", "php", "vue", "svelte"]);

/** Whether a file's type, or for a type a browser gets wrong its ending, says it is text. */
export function isTextType(file: Pick<File, "name" | "type">): boolean {
  const type = file.type.toLowerCase();
  if (type.startsWith("text/") || TEXT_TYPES.has(type)) return true;
  const unsure = type === "" || type === "application/octet-stream" || type === "video/mp2t";
  return unsure && CODE_ENDINGS.has(endingOf(file.name));
}

/** True when the bytes hold a NUL. */
export const hasNul = (bytes: Uint8Array): boolean => bytes.includes(0);

/** How many bytes are looked at for a NUL. */
export const NUL_WINDOW = 8 * 1024;

export type ReadCode = { ok: true; source: string; filename: string; language: CodeLanguage } | { ok: false; filename: string; reason: string };

/** Read an uploaded file as one code step, or say why it cannot be one. */
export async function readCodeFile(file: File): Promise<ReadCode> {
  const filename = file.name;
  if (!isTextType(file)) return { ok: false, filename, reason: CODE_COPY.notText };
  const head = new Uint8Array(await file.slice(0, NUL_WINDOW).arrayBuffer());
  if (hasNul(head)) return { ok: false, filename, reason: CODE_COPY.notText };
  const source = await file.text();
  if (!source.trim()) return { ok: false, filename, reason: CODE_COPY.empty };
  if (source.length > CODE_MAX) return { ok: false, filename, reason: CODE_COPY.tooLong };
  return { ok: true, source, filename, language: codeLanguageFor(source, filename) };
}
