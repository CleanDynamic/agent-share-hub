// =============================================================================
// NeoScale — parse-repo (NS-P21): what a repository looks like once read
// =============================================================================
// Types only. No I/O, no Deno API, no runtime code at all — which is what lets
// parse.ts stay pure and testable while github.ts does the fetching.
//
// A SNAPSHOT IS NOT A CLONE. It is a file listing plus a handful of files read
// out of it, bounded by the two hard limits NS-P21 sets: at most
// MAX_FILE_FETCHES files, none over MAX_FILE_BYTES. A repository is a
// suggestion source, not an import target, and the shape below is deliberately
// too small to be anything else.
// =============================================================================

/** At most this many file reads per parse. Instrumented — see FetchBudget. */
export const MAX_FILE_FETCHES = 40;

/** A file over this is listed but never read. 200KB. */
export const MAX_FILE_BYTES = 200 * 1024;

/** One file that was actually read. `text` is decoded UTF-8. */
export interface RepoFile {
  /** Repo-relative path, exactly as the tree reports it. */
  path: string;
  text: string;
  /** Bytes, as the tree reported them before the read. */
  size: number;
}

/** A file that exists and was deliberately not read, and why. */
export interface SkippedFile {
  path: string;
  size: number;
  reason: "too_large" | "budget_spent";
}

/** A row of ai_tools_registry, narrowed to what canonical naming needs. */
export interface RegistryTool {
  name: string;
  slug: string | null;
}

/**
 * Everything parse.ts is allowed to see. Assembled by github.ts.
 *
 * `paths` is the whole tree — presence is checked against it rather than by
 * probing, which is what keeps the fetch count in single figures on a repo of
 * any size. `files` is only what was read.
 */
export interface RepoSnapshot {
  owner: string;
  repo: string;
  /** The canonical html_url GitHub reports, not the URL the creator pasted. */
  url: string;
  default_branch: string;
  stars: number;
  description: string | null;
  /** Every blob path in the default branch. Not content. */
  paths: string[];
  files: RepoFile[];
  skipped: SkippedFile[];
  /** GitHub truncates its own tree response on very large repositories. */
  tree_truncated: boolean;
  /** Instrumentation for the 40-file cap. Reported in the summary. */
  files_fetched: number;
  fetch_budget: number;
}

/** Look one file up in a snapshot. Paths are compared case-sensitively. */
export function fileAt(snapshot: RepoSnapshot, path: string): RepoFile | null {
  return snapshot.files.find((file) => file.path === path) ?? null;
}

/** Does the tree carry this path at all, read or not? */
export function hasPath(snapshot: RepoSnapshot, path: string): boolean {
  return snapshot.paths.includes(path);
}
