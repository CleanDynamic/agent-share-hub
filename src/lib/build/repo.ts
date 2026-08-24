// Repository URL intake: recognising one, parsing one, applying what it found.
//
// NS-P21's client half. It sits beside intake.ts and lovable.ts rather than
// inside either, for the reason NS-P20 gave: the proposal contract is shared
// and unchanged. parse-repo returns exactly the envelope parse-transcript
// returns, so everything downstream of the parse — IntakeProposal,
// keepEverything, materialiseProposal — is reused verbatim and needs no
// source-specific branch. The only things that differ are WHICH function is
// called and WHAT is sent to it, and both decisions live here.
//
// A URL IS NOT A DROPPED FILE. lovable.ts detects by reading a file's content
// because a creator drops what they have and working out what it is, is the
// system's job. There is nothing to read here: a URL either names a GitHub
// repository or it does not, and that is decided by looking at it. So this
// detection is a regex and not a reading, and it deliberately mirrors
// parse-repo's own parseRepoUrl — a URL this accepts must be one the function
// accepts, or a creator gets routed somewhere that cannot read it.

import { supabase } from "@/integrations/supabase/client";
import { getBuildHeader, updateBuild } from "./builds";
import { buildLayerError, type BuildPatch } from "./types";
import type { ProposedField, TranscriptProposal } from "./intake";

/**
 * parse-repo's summary, which carries one field beyond the shared envelope.
 *
 * made_with is a `builds` column exactly like title and outcome, and
 * ProposedField is how this envelope has always modelled a proposed builds
 * column — so parse-repo proposes them the same way, by narrowing the shared
 * summary rather than by amending it. Restated here as an optional field so
 * that a proposal from either of the other two parsers still satisfies the
 * type: neither of them sets it, and neither of them had to change.
 */
export interface RepoProposal extends TranscriptProposal {
  summary: TranscriptProposal["summary"] & {
    proposed_made_with?: ProposedField[];
    /** Instrumentation for NS-P21's 40-file cap. */
    files_fetched?: number;
    fetch_budget?: number;
  };
}

/**
 * Mirrors parse-repo's own `parseRepoUrl` (supabase/functions/parse-repo/
 * github.ts). Kept in step with it deliberately — the function is the
 * authority, and this is the client refusing to send it something it will
 * reject.
 */
const GITHUB_URL = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s?#]+)\/([^/\s?#]+)/i;

/** github.com paths that are not owners. Mirrors the function's own list. */
const NOT_AN_OWNER = new Set([
  "features", "topics", "collections", "trending", "marketplace", "sponsors",
  "settings", "notifications", "explore", "orgs", "users", "about", "pricing",
  "login", "join", "search", "apps", "enterprise", "security", "readme",
]);

export interface RepoCoordinates {
  owner: string;
  repo: string;
}

/** `owner/repo`, or null when this is not a GitHub repository URL. */
export function parseRepoUrl(raw: string): RepoCoordinates | null {
  const match = GITHUB_URL.exec(raw.trim());
  if (!match) return null;

  const owner = match[1];
  const repo = match[2].replace(/\.git$/i, "");
  if (!owner || !repo) return null;
  if (NOT_AN_OWNER.has(owner.toLowerCase())) return null;

  return { owner, repo };
}

/** Is this worth sending to parse-repo at all? */
export function isRepoUrl(raw: string): boolean {
  return parseRepoUrl(raw) !== null;
}

/**
 * What a URL that is not a GitHub repository should be told, in one sentence.
 *
 * Separate from parseRepoUrl because the two questions are different: whether
 * to route somewhere is a boolean, and what to say when the answer is no
 * depends on how it failed. A GitLab URL is a different message from a typo.
 */
export function repoUrlComplaint(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "Paste a repository URL first.";

  if (/^(?:https?:\/\/)?(?:www\.)?(gitlab\.com|bitbucket\.org|codeberg\.org)/i.test(trimmed)) {
    return "Only GitHub repositories are read for now. Paste a github.com URL, or bring the chat instead.";
  }
  if (/github\.com/i.test(trimmed)) {
    return "That is a github.com URL, but not a repository one. It should look like https://github.com/owner/repository.";
  }
  return "That is not a GitHub repository URL. It should look like https://github.com/owner/repository.";
}

// -----------------------------------------------------------------------------
// Calling the parser
// -----------------------------------------------------------------------------

/**
 * Mirrors intake.ts's readFunctionError. Restated rather than imported because
 * intake.ts keeps it private and NS-P21 does not modify that file — the
 * proposal contract it owns is shared and unchanged.
 *
 * It matters more here than for the other two parsers: parse-repo answers 404
 * for a private or missing repository and 429 for a rate limit, each with a
 * sentence written for a creator. Throwing that away would turn all of them
 * into "Edge Function returned a non-2xx status code".
 */
async function readFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: unknown })?.context;
  const response = context as Response | undefined;

  if (response && typeof response.json === "function") {
    try {
      const body = await response.json();
      const message = (body as { error?: unknown })?.error;
      if (typeof message === "string" && message.trim()) return message;
    } catch {
      // Body already consumed, or not JSON. Fall through to the generic text.
    }
  }

  const message = (error as { message?: unknown })?.message;
  return typeof message === "string" && message.trim()
    ? message
    : "parse-repo could not be reached.";
}

/**
 * Ask parse-repo for a proposal against a build the caller owns.
 *
 * Returns the same TranscriptProposal the other two parsers return — same
 * envelope, same source_ref and inferred rules — so the caller hands it to
 * IntakeProposal and materialiseProposal unchanged.
 */
export async function requestRepoProposal(
  buildId: string,
  repoUrl: string,
  sourceHint?: string | null
): Promise<RepoProposal> {
  const { data, error } = await supabase.functions.invoke("parse-repo", {
    body: {
      repo_url: repoUrl,
      build_id: buildId,
      source_hint: sourceHint ?? null,
    },
  });

  if (error) {
    throw buildLayerError("parse-repo", new Error(await readFunctionError(error)));
  }

  const proposal = data as RepoProposal | null;
  if (!proposal || typeof proposal !== "object" || !proposal.summary?.session_id) {
    throw buildLayerError(
      "parse-repo",
      new Error("The parser returned a response this version does not understand.")
    );
  }

  return {
    events: proposal.events ?? [],
    nodes: proposal.nodes ?? [],
    summary: proposal.summary,
    warnings: proposal.warnings ?? [],
  };
}

// -----------------------------------------------------------------------------
// The build header
// -----------------------------------------------------------------------------

/** What applyRepoHeader actually changed, so the arrival message can say so. */
export interface RepoHeaderApplied {
  repoUrlSet: boolean;
  madeWithAdded: string[];
}

/**
 * Apply the two header facts a repo intake establishes that the shared writer
 * does not: builds.repo_url, and the made_with candidates the proposal carried.
 *
 * A SEPARATE STEP, after materialiseProposal rather than inside it. made_with
 * is proposed by exactly one of the three parsers, and teaching the shared
 * writer about a field only one source sets would put a source-specific branch
 * into the one place that has deliberately never had one. This runs on the repo
 * path only and touches nothing the other two use.
 *
 * BOTH WRITES ARE ADDITIVE AND NEITHER OVERWRITES.
 *
 *   repo_url is set only when the build has none. A creator who already
 *   recorded a repository is not corrected by an import.
 *
 *   made_with is merged, not replaced, and matched case-insensitively. A
 *   creator who typed "Claude" before importing does not lose it because a
 *   manifest said "Anthropic API".
 *
 * The build is re-read first rather than assumed empty, so a resubmission adds
 * nothing twice and a build edited between the parse and the confirm keeps
 * whatever was edited.
 */
export async function applyRepoHeader(
  buildId: string,
  proposal: RepoProposal,
  repoUrl: string
): Promise<RepoHeaderApplied> {
  const build = await getBuildHeader(buildId);
  if (!build) return { repoUrlSet: false, madeWithAdded: [] };

  const patch: BuildPatch = {};

  const currentUrl = typeof build.repo_url === "string" ? build.repo_url.trim() : "";
  const repoUrlSet = currentUrl === "" && repoUrl.trim() !== "";
  if (repoUrlSet) patch.repo_url = repoUrl.trim();

  const current = (build.made_with ?? []).filter(
    (tool): tool is string => typeof tool === "string" && tool.trim() !== ""
  );
  const seen = new Set(current.map((tool) => tool.trim().toLowerCase()));

  const madeWithAdded: string[] = [];
  for (const field of proposal.summary.proposed_made_with ?? []) {
    const value = field?.value?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    madeWithAdded.push(value);
  }
  if (madeWithAdded.length > 0) patch.made_with = [...current, ...madeWithAdded];

  if (Object.keys(patch).length > 0) await updateBuild(buildId, patch);
  return { repoUrlSet, madeWithAdded };
}
