import { z } from "zod/v4";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { errorResponse, fieldError, jsonResponse } from "../_shared/http.ts";

const Body = z.object({ url: z.string().min(1).max(2000) });

export interface Deps {
  /** One GET to the GitHub API. The address it is given is always on api.github.com. */
  fetchJson(url: string): Promise<{ status: number; body: unknown }>;
}

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;

// Supports: https://github.com/owner/repo
//           https://github.com/owner/repo/blob/branch/path/to/file.md
function parseGithubUrl(value: string): { owner: string; repo: string; filePath: string | null } | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || (url.hostname !== "github.com" && url.hostname !== "www.github.com")) return null;
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const [owner, repo, kind, , ...file] = parts;
  if (!owner || !repo || !NAME.test(owner) || !NAME.test(repo.replace(/\.git$/, ""))) return null;
  if (parts.length === 2) return { owner, repo: repo.replace(/\.git$/, ""), filePath: null };
  if (kind === "blob" && file.length > 0 && file.every((part) => part !== "." && part !== ".." && !/[\\?#]/.test(part))) {
    return { owner, repo: repo.replace(/\.git$/, ""), filePath: file.map(encodeURIComponent).join("/") };
  }
  return null;
}

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return preflight(req);
    const cors = corsHeaders(req);
    if (req.method !== "POST") return errorResponse("Method not allowed", 405, cors);

    try {
      const raw = await req.json().catch(() => null);
      const parsed = Body.safeParse(raw);
      if (!parsed.success) return errorResponse(fieldError(parsed.error), 400, cors);

      const target = parseGithubUrl(parsed.data.url);
      if (!target) return errorResponse("url: must be a github.com repository or file address", 400, cors);
      const { owner, repo, filePath } = target;

      // The only address this function ever fetches is on api.github.com.
      const apiUrl = filePath
        ? `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`
        : `https://api.github.com/repos/${owner}/${repo}/readme`;
      if (new URL(apiUrl).hostname !== "api.github.com") return errorResponse("url: must be a github.com repository or file address", 400, cors);

      const res = await deps.fetchJson(apiUrl);
      if (res.status === 404) return errorResponse("Nothing found at that address", 404, cors);
      if (res.status < 200 || res.status >= 300) {
        console.error("import-github-readme: GitHub answered", res.status);
        return errorResponse("GitHub could not be reached", 502, cors);
      }

      const content = (res.body as { content?: unknown } | null)?.content;
      if (typeof content !== "string") return errorResponse("That address is not a file", 422, cors);
      const text = atob(content.replace(/\n/g, ""));

      // Parse markdown
      const lines = text.split("\n");
      let title = "";
      let description = "";
      const bodyLines: string[] = [];
      let foundTitle = false;

      for (const line of lines) {
        if (!foundTitle && line.startsWith("# ")) {
          title = line.replace(/^#\s+/, "").trim();
          foundTitle = true;
          continue;
        }
        if (foundTitle && !description && line.trim()) {
          description = line.trim().slice(0, 500);
          continue;
        }
        bodyLines.push(line);
      }

      return jsonResponse(
        {
          title: title || repo,
          description: description.slice(0, 160),
          markdown: bodyLines.join("\n").trim(),
          source: `${owner}/${repo}`,
        },
        200,
        cors,
      );
    } catch (err) {
      console.error("import-github-readme error:", err);
      return errorResponse("Could not import that README", 500, cors);
    }
  };
}
