// Which GitHub address this function will fetch.
//
// Only https://github.com/<owner>/<repo> and
// https://github.com/<owner>/<repo>/blob/<branch>/<path> are accepted, and the
// only host ever fetched is api.github.com. The old pattern found
// "github.com/..." anywhere in the string, so a caller could steer the path;
// this parses the address and builds the API address from checked parts.

export interface GithubTarget {
  owner: string;
  repo: string;
  /** The file inside the repo, or undefined for the README. */
  filePath?: string;
}

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;

export function parseGithubUrl(input: string): GithubTarget | null {
  // A pasted "github.com/owner/repo" has no scheme; the address is only ever
  // parsed here, never fetched, so http and https both pass.
  const text = input.trim();
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || (url.hostname !== "github.com" && url.hostname !== "www.github.com")) return null;
  if (url.username || url.password || url.port) return null;

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const [owner, repo, kind, branch, ...file] = parts;
  if (!NAME.test(owner) || !NAME.test(repo) || owner === ".." || repo === ".." || owner === "." || repo === ".") return null;

  if (parts.length === 2) return { owner, repo };
  if (kind !== "blob" || !branch || file.length === 0) return null;
  const segments = file.map((segment) => decodeURIComponent(segment));
  if (segments.some((segment) => segment === ".." || segment === "." || segment.includes("/") || segment.includes("\\") || segment === "")) return null;
  return { owner, repo, filePath: segments.join("/") };
}

export function githubApiUrl(target: GithubTarget): string {
  const base = `https://api.github.com/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}`;
  if (!target.filePath) return `${base}/readme`;
  return `${base}/contents/${target.filePath.split("/").map(encodeURIComponent).join("/")}`;
}
