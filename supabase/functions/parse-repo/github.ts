// =============================================================================
// NeoScale — parse-repo (NS-P21): the fetching
// =============================================================================
// COPIED, NOT EXTENDED. supabase/functions/import-github-readme/ sits on the
// existing content path, which NS-P21's first hard constraint puts out of
// bounds. Its GitHub approach is lifted here rather than imported from, and
// rather than refactored into a shared module: duplication is cheaper than
// coupling the old path to the new one, and import-github-readme is left with
// a zero diff. Anything that changes here changes nothing there.
//
// WHAT WAS LIFTED, line for line in spirit:
//   * the owner/repo/path regex over a github.com URL
//   * api.github.com/repos/{owner}/{repo}/contents/{path}
//   * Accept: application/vnd.github.v3+json and an explicit User-Agent
//   * base64 content out of the contents API
//
// WHAT WAS ADDED, because NS-P21 asks for it:
//   * an optional GITHUB_TOKEN. import-github-readme sends none and this works
//     with none — unauthenticated GitHub allows 60 requests an hour per IP,
//     which one creator's parse fits inside and a busy afternoon does not. When
//     the secret is set it is sent; when it is absent nothing changes.
//   * a FETCH BUDGET. Hard cap of 40 file reads per parse, counted and
//     reported, and every GitHub request spends from it — so the cap is a
//     ceiling on the whole parse and not just on the file half of it.
//   * ONE tree request instead of directory walking. /git/trees?recursive=1
//     returns every path AND its byte size in a single response, so presence is
//     checked without probing and the 200KB cap is applied BEFORE a read rather
//     than after it. This is what keeps a real parse at around a dozen requests
//     rather than at the ceiling.
//   * UTF-8 decoding. import-github-readme uses atob alone, which reads the
//     decoded bytes as latin-1 and mangles any non-ASCII character. That is a
//     defect in a file this prompt may not touch, so it is fixed here rather
//     than there: atob then TextDecoder over the byte array.
//
// NEVER CLONES. There is no git operation anywhere in this file.
// =============================================================================

import { chooseEntrypoint } from "./parse.ts";
import {
  MAX_FILE_BYTES,
  MAX_FILE_FETCHES,
  type RepoFile,
  type RepoSnapshot,
  type SkippedFile,
} from "./snapshot.ts";

const API_ROOT = "https://api.github.com";

/**
 * Thrown for anything a creator should read as a sentence rather than as a
 * stack trace. `status` is what the function answers with, so a private repo
 * leaves here as a 404 and a rate limit as a 429 — never as a 500.
 */
export class RepoReadError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "RepoReadError";
    this.status = status;
  }
}

/** owner/repo out of any github.com URL shape a creator is likely to paste. */
export interface RepoCoordinates {
  owner: string;
  repo: string;
}

/**
 * The regex is import-github-readme's, widened only at the tail so a URL with a
 * /tree/ path, a query string, a fragment or a trailing slash still resolves to
 * the repository rather than failing. `.git` is stripped: a clone URL pasted
 * out of a terminal is the same repository.
 */
const GITHUB_URL = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s?#]+)\/([^/\s?#]+)/i;

/** Reserved GitHub paths that are not owners. Cheap guard against /features/… */
const NOT_AN_OWNER = new Set([
  "features", "topics", "collections", "trending", "marketplace", "sponsors",
  "settings", "notifications", "explore", "orgs", "users", "about", "pricing",
  "login", "join", "search", "apps", "enterprise", "security", "readme",
]);

/** null when this is not a repository URL. The caller decides what that means. */
export function parseRepoUrl(raw: string): RepoCoordinates | null {
  const match = GITHUB_URL.exec(raw.trim());
  if (!match) return null;

  const owner = match[1];
  const repo = match[2].replace(/\.git$/i, "");
  if (!owner || !repo) return null;
  if (NOT_AN_OWNER.has(owner.toLowerCase())) return null;

  return { owner, repo };
}

/**
 * The 40-file cap, made countable.
 *
 * Every request through here spends one unit, so `spent` is an upper bound on
 * files read and the acceptance check is a read of one number rather than an
 * audit of the call sites. `take()` refuses rather than throwing: running out
 * of budget is a partial read, not a failure, and a proposal built from twelve
 * of fifteen manifests is still worth showing.
 */
export class FetchBudget {
  #spent = 0;
  readonly limit: number;

  constructor(limit: number = MAX_FILE_FETCHES) {
    this.limit = limit;
  }

  get spent(): number {
    return this.#spent;
  }

  get remaining(): number {
    return Math.max(0, this.limit - this.#spent);
  }

  /** true when a request may proceed, and it is charged for. */
  take(): boolean {
    if (this.#spent >= this.limit) return false;
    this.#spent += 1;
    return true;
  }
}

function headers(): HeadersInit {
  // Optional. import-github-readme sends no token and neither does this when
  // the secret is unset; the anonymous path stays supported deliberately.
  const token = Deno.env.get("GITHUB_TOKEN") ?? Deno.env.get("GITHUB_API_TOKEN");
  const base: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "NeoScale",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token && token.trim()) base.Authorization = `Bearer ${token.trim()}`;
  return base;
}

/**
 * A private repository and a repository that was never there answer
 * identically — GitHub returns 404 for both, deliberately, so that an
 * unauthenticated caller cannot enumerate private names. Saying "private or
 * does not exist" is therefore the only honest message, and it is a better one
 * than either guess would be.
 */
function describeFailure(status: number, owner: string, repo: string, body: string): RepoReadError {
  if (status === 404) {
    return new RepoReadError(
      `${owner}/${repo} is private, does not exist, or has been renamed. This reads public ` +
        `repositories only — GitHub answers the same way for all three, so there is nothing ` +
        `more specific to say. Check the URL, or make the repository public.`,
      404,
    );
  }
  if (status === 403 || status === 429) {
    const rateLimited = /rate limit/i.test(body);
    return new RepoReadError(
      rateLimited
        ? `GitHub is rate-limiting this server. Try again in a few minutes.`
        : `GitHub refused to serve ${owner}/${repo} (403). It may be private, or blocked by an ` +
          `organisation policy.`,
      429,
    );
  }
  if (status === 451) {
    return new RepoReadError(`${owner}/${repo} has been made unavailable for legal reasons.`, 404);
  }
  if (status >= 500) {
    return new RepoReadError(`GitHub is returning errors right now (${status}). Try again shortly.`, 502);
  }
  return new RepoReadError(`GitHub could not read ${owner}/${repo} (${status}).`, 502);
}

async function apiGet(
  path: string,
  budget: FetchBudget,
  owner: string,
  repo: string,
): Promise<unknown | null> {
  if (!budget.take()) return null;

  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, { headers: headers() });
  } catch (cause) {
    throw new RepoReadError(
      `GitHub could not be reached: ${(cause as Error).message}`,
      502,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw describeFailure(response.status, owner, repo, body);
  }

  return await response.json();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** base64 -> bytes -> UTF-8. atob alone would read the bytes as latin-1. */
function decodeBase64(encoded: string): string {
  const binary = atob(encoded.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

/**
 * Read the repository record: the three fields the repo node carries, plus the
 * description the outcome falls back to and the private flag NS-P21 rejects on.
 */
async function readRepository(
  owner: string,
  repo: string,
  budget: FetchBudget,
): Promise<{
  url: string;
  default_branch: string;
  stars: number;
  description: string | null;
  is_private: boolean;
}> {
  const raw = await apiGet(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, budget, owner, repo);
  if (!isRecord(raw)) {
    throw new RepoReadError(`GitHub returned something unreadable for ${owner}/${repo}.`, 502);
  }

  if (raw.private === true) {
    // Reachable only with a token that can see it. Still out of scope: a
    // proposal built from a private repository would leak it into a draft.
    throw new RepoReadError(
      `${owner}/${repo} is private. Private repositories are out of scope — a build published ` +
        `from one would carry code nobody else can reach.`,
      403,
    );
  }

  return {
    url: typeof raw.html_url === "string" ? raw.html_url : `https://github.com/${owner}/${repo}`,
    default_branch: typeof raw.default_branch === "string" ? raw.default_branch : "main",
    stars: typeof raw.stargazers_count === "number" ? raw.stargazers_count : 0,
    description: typeof raw.description === "string" && raw.description.trim()
      ? raw.description.trim()
      : null,
    is_private: false,
  };
}

/** Every blob path and its size, in ONE request. The reason the cap is easy. */
async function readTree(
  owner: string,
  repo: string,
  ref: string,
  budget: FetchBudget,
): Promise<{ sizes: Map<string, number>; truncated: boolean }> {
  const raw = await apiGet(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    budget,
    owner,
    repo,
  );

  const sizes = new Map<string, number>();
  if (!isRecord(raw)) return { sizes, truncated: false };

  const tree = Array.isArray(raw.tree) ? raw.tree : [];
  for (const entry of tree) {
    if (!isRecord(entry)) continue;
    if (entry.type !== "blob") continue;
    if (typeof entry.path !== "string") continue;
    sizes.set(entry.path, typeof entry.size === "number" ? entry.size : 0);
  }

  return { sizes, truncated: raw.truncated === true };
}

/** One file, through the contents API, as import-github-readme reads one. */
async function readFile(
  owner: string,
  repo: string,
  path: string,
  ref: string,
  budget: FetchBudget,
): Promise<string | null> {
  const raw = await apiGet(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${
      path.split("/").map(encodeURIComponent).join("/")
    }?ref=${encodeURIComponent(ref)}`,
    budget,
    owner,
    repo,
  );

  if (!isRecord(raw)) return null;
  if (typeof raw.content !== "string") return null;
  if (raw.encoding !== "base64") return null;

  try {
    return decodeBase64(raw.content);
  } catch {
    return null;
  }
}

/**
 * Which files are worth opening, in the order they are worth opening in.
 *
 * Ordered because the budget is spent top down: if a repository somehow exhausts
 * 40 reads, what it runs out on should be the entrypoint rather than the README.
 * Every candidate is checked against the tree first, so a name that is not there
 * costs nothing.
 */
export const README_CANDIDATES = [
  "README.md", "readme.md", "Readme.md", "README.MD",
  "README.rst", "README.txt", "README", "readme",
  "docs/README.md", ".github/README.md",
];

export const MANIFEST_CANDIDATES = [
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "go.mod",
  "Gemfile",
  "composer.json",
];

export const ENV_EXAMPLE_CANDIDATES = [
  ".env.example", ".env.sample", ".env.template", ".env.dist", "env.example",
];

/**
 * Read a repository into a snapshot.
 *
 * Two requests establish what is there; everything after that is a file read
 * against a path already known to exist and already known to be small enough.
 * A real repository lands at roughly a dozen requests against a ceiling of 40.
 */
export async function readRepoSnapshot(
  coordinates: RepoCoordinates,
  budget: FetchBudget = new FetchBudget(),
): Promise<RepoSnapshot> {
  const { owner, repo } = coordinates;

  const repository = await readRepository(owner, repo, budget);
  const { sizes, truncated } = await readTree(owner, repo, repository.default_branch, budget);

  const paths = [...sizes.keys()];
  const present = new Set(paths);

  const entrypoint = chooseEntrypoint(present);

  // First present README only: a repository with three of them has one README.
  const readme = README_CANDIDATES.find((candidate) => present.has(candidate));

  const wanted = [
    ...(readme ? [readme] : []),
    ...MANIFEST_CANDIDATES.filter((candidate) => present.has(candidate)),
    ...ENV_EXAMPLE_CANDIDATES.filter((candidate) => present.has(candidate)),
    ...(entrypoint.path ? [entrypoint.path] : []),
  ];

  const files: RepoFile[] = [];
  const skipped: SkippedFile[] = [];

  for (const path of wanted) {
    const size = sizes.get(path) ?? 0;

    // The cap is applied BEFORE the read, from the size the tree already gave
    // us. Fetching a 4MB lockfile in order to discover it is 4MB would spend
    // the bandwidth the limit exists to protect.
    if (size > MAX_FILE_BYTES) {
      skipped.push({ path, size, reason: "too_large" });
      continue;
    }
    if (budget.remaining === 0) {
      skipped.push({ path, size, reason: "budget_spent" });
      continue;
    }

    const text = await readFile(owner, repo, path, repository.default_branch, budget);
    if (text === null) {
      skipped.push({ path, size, reason: "budget_spent" });
      continue;
    }
    files.push({ path, text, size });
  }

  return {
    owner,
    repo,
    url: repository.url,
    default_branch: repository.default_branch,
    stars: repository.stars,
    description: repository.description,
    paths,
    files,
    skipped,
    tree_truncated: truncated,
    files_fetched: budget.spent,
    fetch_budget: budget.limit,
  };
}
