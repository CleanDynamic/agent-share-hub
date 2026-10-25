// CA-15 P9: the three tiles that record what a build was made from: a System prompt, a Dataset and a GitHub repository.
//
// Each is an existing node type (`system_prompt`, `dataset`, `repo`, seeded in 20260823130000_node_type_registry_seed.sql) and
// everything the tile adds is kept in that node's own `payload`. A key that is absent means "not given". Nothing here is a
// migration, and nothing here keeps a secret: a repository's run instructions name environment variables, never their values.
//
// The readers are defensive (a payload with a bad part reads as less, never as an error). `fetchRepoFacts` is the one function
// that goes out to the network: GitHub's public API, from the browser, unauthenticated, once per URL.

import type { Json } from "@/integrations/supabase/types";

import { clean, cleanList, cleanUrl, cleanVariablesValue, finite, linesOf, registerCleaners } from "./tileExtras";

type Raw = Record<string, unknown>;

const isRecord = (value: unknown): value is Raw => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/* ── a system prompt ── */

export const SYSTEM_PROMPT_TEXT_MAX = 20_000;
export const SYSTEM_PROMPT_VERSION_MAX = 40;
export const SYSTEM_PROMPT_MODEL_MAX = 80;

/** Where a system prompt applies: every prompt, one session's prompts, or a chosen few. */
export type SystemPromptScope = { kind: "all" } | { kind: "session"; key: string } | { kind: "prompts"; ids: string[] };

/** The scope as stored in `payload.scope`: `all`, `session:<key>` or `prompts:<id,id>`. */
export function scopeValue(scope: SystemPromptScope): string {
  return scope.kind === "all" ? "all" : scope.kind === "session" ? `session:${scope.key}` : `prompts:${scope.ids.join(",")}`;
}

/** A stored scope, read; anything that is not one of the three reads as "all". */
export function scopeOf(raw: unknown): SystemPromptScope {
  const value = clean(raw);
  if (value.startsWith("session:") && value.length > 8) return { kind: "session", key: value.slice(8) };
  if (value.startsWith("prompts:")) {
    const ids = value
      .slice(8)
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length > 0) return { kind: "prompts", ids: [...new Set(ids)] };
  }
  return { kind: "all" };
}

export interface SystemPromptFacts {
  text: string;
  scope: SystemPromptScope;
  version: string | null;
}

export function systemPromptOf(payload: Raw): SystemPromptFacts {
  return { text: clean(payload.text), scope: scopeOf(payload.scope), version: clean(payload.version, SYSTEM_PROMPT_VERSION_MAX) || null };
}

/* ── a dataset ── */

export const DATASET_USES = ["training", "finetuning", "evaluation", "retrieval", "testing"] as const;
export type DatasetUse = (typeof DATASET_USES)[number];
export const DATASET_USE_LABEL: Record<DatasetUse, string> = { training: "Training", finetuning: "Fine-tuning", evaluation: "Evaluation", retrieval: "Retrieval", testing: "Testing" };

export const DATASET_DESCRIPTION_MAX = 600;
export const DATASET_FORMAT_MAX = 40;
export const DATASET_SOURCE_MAX = 200;
export const DATASET_LICENCE_MAX = 80;
export const DATASET_COLUMNS_MAX = 60;
export const DATASET_COLUMN_MAX = 60;
export const DATASET_SAMPLE_MAX = 5;
export const DATASET_SAMPLE_LINE_MAX = 600;
export const DATASET_EMBEDDING_MAX = 80;
export const DATASET_CHUNK_STRATEGY_MAX = 60;

export interface DatasetFacts {
  description: string;
  use: DatasetUse | null;
  format: string | null;
  recordCount: number | null;
  columns: string[];
  source: string | null;
  sample: string[];
  licence: string | null;
  /** Retrieval only. */
  chunkStrategy: string | null;
  chunkSize: number | null;
  chunkOverlap: number | null;
  embeddingModel: string | null;
}

const wholeOrNull = (value: unknown): number | null => {
  const n = finite(value);
  return n !== null && Number.isInteger(n) && n >= 0 ? n : null;
};

export function datasetOf(payload: Raw): DatasetFacts {
  return {
    description: clean(payload.description, DATASET_DESCRIPTION_MAX),
    use: DATASET_USES.includes(payload.use as DatasetUse) ? (payload.use as DatasetUse) : null,
    format: clean(payload.format, DATASET_FORMAT_MAX) || null,
    recordCount: wholeOrNull(payload.record_count),
    columns: cleanList(payload.columns, DATASET_COLUMN_MAX, DATASET_COLUMNS_MAX),
    source: clean(payload.source, DATASET_SOURCE_MAX) || null,
    sample: cleanList(payload.sample, DATASET_SAMPLE_LINE_MAX, DATASET_SAMPLE_MAX),
    licence: clean(payload.licence, DATASET_LICENCE_MAX) || null,
    chunkStrategy: clean(payload.chunk_strategy, DATASET_CHUNK_STRATEGY_MAX) || null,
    chunkSize: wholeOrNull(payload.chunk_size),
    chunkOverlap: wholeOrNull(payload.chunk_overlap),
    embeddingModel: clean(payload.embedding_model, DATASET_EMBEDDING_MAX) || null,
  };
}

/* ── a GitHub repository ── */

export const REPO_OWNERSHIPS = ["created", "owned", "third_party"] as const;
export type RepoOwnership = (typeof REPO_OWNERSHIPS)[number];
export const REPO_OWNERSHIP_LABEL: Record<RepoOwnership, string> = { created: "Created in this build", owned: "Maker's existing repository", third_party: "Third-party repository" };

export const REPO_USAGES = ["dependency", "copied", "docs", "tool", "context", "fork"] as const;
export type RepoUsage = (typeof REPO_USAGES)[number];
export const REPO_USAGE_LABEL: Record<RepoUsage, string> = {
  dependency: "Installed as a dependency",
  copied: "Copied source code",
  docs: "Followed its documentation",
  tool: "Ran as a tool or MCP server",
  context: "Provided as model context",
  fork: "Forked and modified",
};

export const REPO_DESCRIPTION_MAX = 500;
export const REPO_AUTHOR_MAX = 80;
export const REPO_PATH_MAX = 200;
export const REPO_PIN_VALUE_MAX = 80;
export const REPO_MODIFICATIONS_MAX = 600;
export const REPO_KEY_FILES_MAX = 20;
export const REPO_KEY_FILE_MAX = 200;
export const REPO_RUN_MAX = 20;
export const REPO_RUN_LINE_MAX = 300;

export const REPO_PIN_KINDS = ["branch", "tag", "commit"] as const;
export type RepoPinKind = (typeof REPO_PIN_KINDS)[number];
export const REPO_PIN_LABEL: Record<RepoPinKind, string> = { branch: "Branch", tag: "Tag", commit: "Commit" };

export const REPO_VISIBILITIES = ["public", "private"] as const;
export type RepoVisibility = (typeof REPO_VISIBILITIES)[number];

/** `github.com/owner/name`, with or without `https://` or `www.`, a trailing slash or `.git`: the owner, the name and the address as stored. */
export function parseRepoUrl(raw: unknown): { owner: string; name: string; url: string } | null {
  const value = clean(raw);
  if (!value) return null;
  const match = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?\/?(?:[?#].*)?$/i.exec(value);
  if (!match) return null;
  const [, owner, name] = match;
  if (name === "." || name === ".." || /^\.+$/.test(name)) return null;
  return { owner, name, url: `https://github.com/${owner}/${name}` };
}

/** The licences a reader may reuse from: shown as "<licence> · reuse permitted". Compared by SPDX id. */
export const PERMISSIVE_LICENCES: readonly string[] = ["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "MPL-2.0", "Unlicense"];

/** The licence line of a retrieved repository: `spdx` is what GitHub says, null for none. `reuse` is the words in the evidence colour. */
export function licenceLine(spdx: string | null | undefined, name?: string | null): { text: string; reuse: string | null } {
  const id = (spdx ?? "").trim();
  if (!id) return { text: "No licence · reuse not granted", reuse: null };
  if (id === "NOASSERTION") return { text: (name ?? "").trim() || "Other licence", reuse: null };
  if (PERMISSIVE_LICENCES.includes(id)) return { text: id, reuse: "reuse permitted" };
  return { text: (name ?? "").trim() || id, reuse: null };
}

/** A pushed date more than twelve months before `now`. */
export function isPossiblyUnmaintained(pushedAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!pushedAt) return false;
  const at = new Date(pushedAt);
  if (Number.isNaN(at.getTime())) return false;
  const limit = new Date(now);
  limit.setFullYear(limit.getFullYear() - 1);
  return at.getTime() < limit.getTime();
}

/** What GitHub told us, as stored. `fetchedAt` is when. */
export interface RepoFetched {
  stars: number | null;
  defaultBranch: string | null;
  language: string | null;
  licenceSpdx: string | null;
  licenceName: string | null;
  pushedAt: string | null;
  fetchedAt: string;
}

export interface RepoFacts {
  url: string;
  owner: string;
  name: string;
  ownership: RepoOwnership | null;
  description: string | null;
  fetched: Omit<RepoFetched, "fetchedAt"> & { fetchedAt: string | null };
  author: string | null;
  usage: RepoUsage[];
  visibility: RepoVisibility | null;
  generatedWith: string | null;
  deployedUrl: string | null;
  pin: { kind: RepoPinKind; value: string } | null;
  path: string | null;
  modifications: string | null;
  keyFiles: string[];
  run: string[];
}

export function repoOf(payload: Raw): RepoFacts | null {
  const parsed = parseRepoUrl(payload.url);
  if (!parsed) return null;
  const pin = isRecord(payload.pin) && REPO_PIN_KINDS.includes(payload.pin.kind as RepoPinKind) && clean(payload.pin.value) ? { kind: payload.pin.kind as RepoPinKind, value: clean(payload.pin.value, REPO_PIN_VALUE_MAX) } : null;
  return {
    ...parsed,
    ownership: REPO_OWNERSHIPS.includes(payload.ownership as RepoOwnership) ? (payload.ownership as RepoOwnership) : null,
    description: clean(payload.description, REPO_DESCRIPTION_MAX) || null,
    fetched: {
      stars: wholeOrNull(payload.stars),
      defaultBranch: clean(payload.default_branch, 100) || null,
      language: clean(payload.language, 60) || null,
      licenceSpdx: clean(payload.licence_spdx, 60) || null,
      licenceName: clean(payload.licence_name, 80) || null,
      pushedAt: clean(payload.pushed_at, 40) || null,
      fetchedAt: clean(payload.fetched_at, 40) || null,
    },
    author: clean(payload.author, REPO_AUTHOR_MAX) || null,
    usage: Array.isArray(payload.usage) ? REPO_USAGES.filter((use) => (payload.usage as unknown[]).includes(use)) : [],
    visibility: REPO_VISIBILITIES.includes(payload.visibility as RepoVisibility) ? (payload.visibility as RepoVisibility) : null,
    generatedWith: clean(payload.generated_with, 40) || null,
    deployedUrl: cleanUrl(payload.deployed_url),
    pin,
    path: clean(payload.path, REPO_PATH_MAX) || null,
    modifications: clean(payload.modifications, REPO_MODIFICATIONS_MAX) || null,
    keyFiles: cleanList(payload.key_files, REPO_KEY_FILE_MAX, REPO_KEY_FILES_MAX),
    run: cleanList(payload.run, REPO_RUN_LINE_MAX, REPO_RUN_MAX),
  };
}

/** The date as "7 Oct 2026"; the text as given when it is not a date. */
export function repoDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return `${at.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][at.getUTCMonth()]} ${at.getUTCFullYear()}`;
}

/** What "Run instructions" asks, in one place: one command per line, naming keys, never their values. */
export const RUN_HINT = "One per line. Key names only";

/** A line that looks as if it holds a secret value: a long token after an equals sign, or a well-known key prefix. */
export function looksLikeSecret(line: string): boolean {
  return /\b(?:sk|pk|ghp|gho|ghs|xox[abp])[-_][A-Za-z0-9_-]{16,}/.test(line) || /\b[A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)\s*=\s*["']?[A-Za-z0-9_\-/+=]{16,}/.test(line);
}

/** The first line of the run instructions that looks as if it holds a secret value, or null. Used to refuse before anything is stored. */
export const firstSecretLine = (text: string): string | null => linesOf(text).find(looksLikeSecret) ?? null;

/* ── what GitHub says ── */

const retrieved = new Map<string, Promise<RepoFetched | null>>();

/**
 * Ask GitHub's public API about a repository, from the browser, unauthenticated. One request per owner and name for the life
 * of the page, whether it worked or not; null on any failure (a network error, a rate limit, a repository that is not there),
 * so the tile stays valid with its URL alone.
 */
export function fetchRepoFacts(owner: string, name: string, fetcher: typeof fetch = fetch): Promise<RepoFetched | null> {
  const key = `${owner}/${name}`.toLowerCase();
  const known = retrieved.get(key);
  if (known) return known;
  const asked = (async (): Promise<RepoFetched | null> => {
    try {
      const response = await fetcher(`https://api.github.com/repos/${owner}/${name}`, { headers: { Accept: "application/vnd.github+json" } });
      if (!response.ok) return null;
      const body: unknown = await response.json();
      if (!isRecord(body)) return null;
      const licence = isRecord(body.license) ? body.license : null;
      return {
        stars: wholeOrNull(body.stargazers_count),
        defaultBranch: clean(body.default_branch, 100) || null,
        language: clean(body.language, 60) || null,
        licenceSpdx: licence ? clean(licence.spdx_id, 60) || null : null,
        licenceName: licence ? clean(licence.name, 80) || null : null,
        pushedAt: clean(body.pushed_at, 40) || null,
        fetchedAt: new Date().toISOString(),
      };
    } catch {
      return null;
    }
  })();
  retrieved.set(key, asked);
  return asked;
}

/** For tests: forget what was retrieved. */
export const forgetRetrieved = (): void => retrieved.clear();

/* ── what each tile may write: one cleaner per key, shared by Add, Details and the writers ── */

/** One value per line, or an array of lines; refuses more than `limit` lines or a line over `max`. */
function linesValue(value: unknown, limit: number, max: number, what: string): string[] {
  const lines = Array.isArray(value) ? cleanList(value, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY) : typeof value === "string" ? linesOf(value) : [];
  if (lines.length > limit) throw new Error(`${what} is at most ${limit}, one per line.`);
  if (lines.some((line) => line.length > max)) throw new Error(`A line of ${what.toLowerCase()} is at most ${max} characters.`);
  return lines;
}

/** A one-line text, at most `max` characters; empty takes the key off. */
const lineValue =
  (what: string, max: number) =>
  (value: unknown): Json | null => {
    const said = clean(value);
    if (said.length > max) throw new Error(`${what} is at most ${max} characters.`);
    return said || null;
  };

/** A whole number from 0 up; empty takes the key off. */
const countValue =
  (what: string) =>
  (value: unknown): Json | null => {
    if (value === null || value === undefined || value === "") return null;
    const n = typeof value === "string" ? Number(value.replace(/,/g, "")) : value;
    if (typeof n !== "number" || !Number.isFinite(n) || !Number.isInteger(n) || n < 0) throw new Error(`${what} is a whole number, 0 or more.`);
    return n;
  };

registerCleaners("system_prompt", {
  text: (value) => {
    const said = clean(value);
    if (!said) throw new Error("A system prompt needs its text.");
    if (said.length > SYSTEM_PROMPT_TEXT_MAX) throw new Error(`A system prompt is at most ${SYSTEM_PROMPT_TEXT_MAX.toLocaleString("en-GB")} characters.`);
    return said;
  },
  model: lineValue("The model", SYSTEM_PROMPT_MODEL_MAX),
  version: lineValue("The version", SYSTEM_PROMPT_VERSION_MAX),
  scope: (value) => {
    const scope = typeof value === "string" ? scopeOf(value) : isRecord(value) ? (value as unknown as SystemPromptScope) : { kind: "all" as const };
    if (scope.kind === "prompts" && scope.ids.length === 0) throw new Error("Choose at least one prompt for it to apply to.");
    return scopeValue(scope);
  },
  variables: (value) => cleanVariablesValue(value),
});

registerCleaners("dataset", {
  description: (value) => {
    const said = clean(value);
    if (!said) throw new Error("A dataset needs its description.");
    if (said.length > DATASET_DESCRIPTION_MAX) throw new Error(`The description is at most ${DATASET_DESCRIPTION_MAX} characters.`);
    return said;
  },
  use: (value) => (DATASET_USES.includes(value as DatasetUse) ? (value as DatasetUse) : null),
  format: lineValue("The format", DATASET_FORMAT_MAX),
  record_count: countValue("The record count"),
  columns: (value) => {
    const lines = linesValue(value, DATASET_COLUMNS_MAX, DATASET_COLUMN_MAX, "Columns");
    return lines.length > 0 ? lines : null;
  },
  source: lineValue("The source", DATASET_SOURCE_MAX),
  sample: (value) => {
    const lines = linesValue(value, DATASET_SAMPLE_MAX, DATASET_SAMPLE_LINE_MAX, "Sample records");
    return lines.length > 0 ? lines : null;
  },
  licence: lineValue("The licence", DATASET_LICENCE_MAX),
  chunk_strategy: lineValue("The chunk strategy", DATASET_CHUNK_STRATEGY_MAX),
  chunk_size: countValue("The chunk size"),
  chunk_overlap: countValue("The chunk overlap"),
  embedding_model: lineValue("The embedding model", DATASET_EMBEDDING_MAX),
});

registerCleaners("repo", {
  url: (value) => {
    const parsed = parseRepoUrl(value);
    if (!parsed) throw new Error("A repository URL looks like github.com/owner/name.");
    return parsed.url;
  },
  ownership: (value) => (REPO_OWNERSHIPS.includes(value as RepoOwnership) ? (value as RepoOwnership) : null),
  description: lineValue("The description", REPO_DESCRIPTION_MAX),
  author: lineValue("The author", REPO_AUTHOR_MAX),
  usage: (value) => {
    const picked = Array.isArray(value) ? REPO_USAGES.filter((use) => (value as unknown[]).includes(use)) : [];
    return picked.length > 0 ? [...picked] : null;
  },
  visibility: (value) => (REPO_VISIBILITIES.includes(value as RepoVisibility) ? (value as RepoVisibility) : null),
  generated_with: lineValue("Generated with", 40),
  deployed_url: (value) => {
    if (!clean(value)) return null;
    const url = cleanUrl(value);
    if (!url) throw new Error("The deployed URL looks like example.com.");
    return url;
  },
  pin: (value) => {
    if (!isRecord(value) || !REPO_PIN_KINDS.includes(value.kind as RepoPinKind)) return null;
    const pinned = clean(value.value);
    if (pinned.length > REPO_PIN_VALUE_MAX) throw new Error(`The pinned version is at most ${REPO_PIN_VALUE_MAX} characters.`);
    return pinned ? { kind: value.kind as RepoPinKind, value: pinned } : null;
  },
  path: lineValue("The path", REPO_PATH_MAX),
  modifications: lineValue("Modifications", REPO_MODIFICATIONS_MAX),
  key_files: (value) => {
    const lines = linesValue(value, REPO_KEY_FILES_MAX, REPO_KEY_FILE_MAX, "Key files");
    return lines.length > 0 ? lines : null;
  },
  run: (value) => {
    const lines = linesValue(value, REPO_RUN_MAX, REPO_RUN_LINE_MAX, "Run instructions");
    if (lines.some(looksLikeSecret)) throw new Error("Contains a key value. Key names only, like GITHUB_TOKEN");
    return lines.length > 0 ? lines : null;
  },
  // What GitHub said, kept as it came back.
  stars: countValue("Stars"),
  default_branch: lineValue("The default branch", 100),
  language: lineValue("The language", 60),
  licence_spdx: lineValue("The licence", 60),
  licence_name: lineValue("The licence name", 80),
  pushed_at: lineValue("The last commit date", 40),
  fetched_at: lineValue("The retrieval date", 40),
});
