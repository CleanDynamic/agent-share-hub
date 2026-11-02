// SV-30 P7: what a session produced, as links the maker gave. PURE.
//
// Stored as the maker gives them in `sessions_meta[key].outputs` (up to 20). A commit is a repository and a SHA of 7 to 40 hex
// characters; every other kind is an https address. Nothing is stored that the maker did not enter, no secret is asked for, and
// readers see the list only when the maker ticked Show readers (`showOutputs`), as `showCost` does for money.
// Imports carry no tool results (the connector folds a tool call to its name), so a commit SHA is never read from a run.

export const OUTPUT_KINDS = ["commit", "pull_request", "deployment", "document", "ticket"] as const;
export type OutputKind = (typeof OUTPUT_KINDS)[number];
export const OUTPUTS_MAX = 20;
export const REPO_MAX = 200;
export const OUTPUT_URL_MAX = 2000;
export const SHA = /^[0-9a-f]{7,40}$/i;

export type OutputLink = { kind: "commit"; repo: string; sha: string } | { kind: Exclude<OutputKind, "commit">; url: string };

export const OUTPUT_LABEL: Record<OutputKind, { one: string; many: string }> = {
  commit: { one: "commit", many: "commits" },
  pull_request: { one: "pull request", many: "pull requests" },
  deployment: { one: "deployment", many: "deployments" },
  document: { one: "document", many: "documents" },
  ticket: { one: "ticket", many: "tickets" },
};

/** An https address, as given; null for anything else. */
export function httpsUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const said = raw.trim();
  if (!said || said.length > OUTPUT_URL_MAX) return null;
  try {
    const url = new URL(said);
    return url.protocol === "https:" && url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

/** One stored output, read defensively; null when it is not whole. */
function outputOf(value: unknown): OutputLink | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.kind === "commit") {
    const repo = typeof raw.repo === "string" ? raw.repo.trim().slice(0, REPO_MAX) : "";
    const sha = typeof raw.sha === "string" ? raw.sha.trim().toLowerCase() : "";
    return repo && SHA.test(sha) ? { kind: "commit", repo, sha } : null;
  }
  if (raw.kind === "pull_request" || raw.kind === "deployment" || raw.kind === "document" || raw.kind === "ticket") {
    const url = httpsUrl(raw.url);
    return url ? { kind: raw.kind, url } : null;
  }
  return null;
}

/** A stored list, read defensively: whole entries only, at most 20. */
export function outputsOf(value: unknown): OutputLink[] {
  return Array.isArray(value) ? value.flatMap((entry) => (outputOf(entry) ? [outputOf(entry) as OutputLink] : [])).slice(0, OUTPUTS_MAX) : [];
}

/** Why a list cannot be saved, or null. A short or non-hex SHA, a non-https address and a list over 20 are refused. */
export function outputsRefusal(list: readonly OutputLink[]): string | null {
  if (list.length > OUTPUTS_MAX) return `Output links: ${OUTPUTS_MAX} max`;
  for (const entry of list) {
    if (entry.kind === "commit") {
      if (!entry.repo.trim()) return "A commit needs its repository.";
      if (entry.repo.trim().length > REPO_MAX) return `Repository: ${REPO_MAX} characters max`;
      if (!SHA.test(entry.sha.trim())) return "A commit SHA is 7 to 40 hex characters.";
    } else if (!httpsUrl(entry.url)) return "A link starts with https://.";
  }
  return null;
}

/** "3 commits · 1 pull request"; null when there are none. Kinds in the order above. */
export function outputsCountLine(list: readonly OutputLink[]): string | null {
  const parts = OUTPUT_KINDS.flatMap((kind) => {
    const n = list.filter((entry) => entry.kind === kind).length;
    return n > 0 ? [`${n} ${n === 1 ? OUTPUT_LABEL[kind].one : OUTPUT_LABEL[kind].many}`] : [];
  });
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** A row of the list: what it is called and where it points (null for a commit whose repository is not an address). */
export function outputRow(entry: OutputLink): { label: string; href: string | null } {
  if (entry.kind === "commit") {
    const base = httpsUrl(entry.repo);
    return { label: `Commit ${entry.sha.slice(0, 7)} in ${base ? new URL(base).pathname.replace(/^\/|\/$/g, "") || entry.repo : entry.repo}`, href: base ? `${base.replace(/\/$/, "")}/commit/${entry.sha}` : null };
  }
  const host = (() => {
    try {
      return new URL(entry.url).hostname.replace(/^www\./, "");
    } catch {
      return entry.url;
    }
  })();
  return { label: `${OUTPUT_LABEL[entry.kind].one.replace(/^./, (c) => c.toUpperCase())} · ${host}`, href: entry.url };
}
