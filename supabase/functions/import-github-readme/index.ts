import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z, readBody } from "../_shared/body.ts";
import { fail, json, preflight } from "../_shared/cors.ts";
import { githubApiUrl, parseGithubUrl } from "./github.ts";

const Body = z.object({ url: z.string({ required_error: "Required" }).min(1, "Required").max(2048) });

serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== "POST") return fail(req, 405, "Method not allowed");

  try {
    const body = await readBody(req, Body);
    if (!body.ok) return fail(req, 400, body.error);

    // Supports: https://github.com/owner/repo
    //           https://github.com/owner/repo/blob/branch/path/to/file.md
    // Anything else is refused, and api.github.com is the only host fetched.
    const target = parseGithubUrl(body.data.url);
    if (!target) return fail(req, 400, "url: must be a github.com repository or file address");
    const { owner, repo } = target;

    const ghRes = await fetch(githubApiUrl(target), {
      headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "NeoScale" },
    });

    if (!ghRes.ok) {
      console.error("import-github-readme: GitHub answered", ghRes.status);
      return fail(req, ghRes.status === 404 ? 404 : 502, ghRes.status === 404 ? "GitHub has no such file" : "GitHub could not be read");
    }

    const ghData = await ghRes.json();
    const content = atob(ghData.content.replace(/\n/g, ""));

    // Parse markdown
    const lines = content.split("\n");
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

    return json(req, {
      title: title || repo,
      description: description.slice(0, 160),
      markdown: bodyLines.join("\n").trim(),
      source: `${owner}/${repo}`,
    });
  } catch (error) {
    console.error("import-github-readme:", error);
    return fail(req, 500, "Could not import the file");
  }
});
