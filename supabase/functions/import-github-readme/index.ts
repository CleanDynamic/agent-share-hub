import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      throw new Error("url is required");
    }

    // Parse GitHub URL
    // Supports: https://github.com/owner/repo
    //           https://github.com/owner/repo/blob/branch/path/to/file.md
    const ghMatch = url.match(/github\.com\/([^\/]+)\/([^\/]+)(?:\/blob\/[^\/]+\/(.+))?/);
    if (!ghMatch) throw new Error("Invalid GitHub URL");

    const [, owner, repo, filePath] = ghMatch;
    let apiUrl: string;

    if (filePath) {
      // Specific file
      apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    } else {
      // Default to README
      apiUrl = `https://api.github.com/repos/${owner}/${repo}/readme`;
    }

    const ghRes = await fetch(apiUrl, {
      headers: { Accept: "application/vnd.github.v3+json", "User-Agent": "NeoScale" },
    });

    if (!ghRes.ok) {
      const body = await ghRes.text();
      throw new Error(`GitHub API error ${ghRes.status}: ${body}`);
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

    return new Response(
      JSON.stringify({
        title: title || repo,
        description: description.slice(0, 160),
        markdown: bodyLines.join("\n").trim(),
        source: `${owner}/${repo}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
