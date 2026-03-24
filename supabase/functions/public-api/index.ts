import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

// Simple in-memory rate limiter
const ipCounts = new Map<string, { count: number; resetAt: number }>();
function rateLimit(ip: string, max = 60): boolean {
  const now = Date.now();
  const entry = ipCounts.get(ip);
  if (!entry || now > entry.resetAt) {
    ipCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimit(ip)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 429,
    });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/public-api\/?/, "/").replace(/\/+/g, "/");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );

  try {
    // GET /blueprints
    if (path === "/" || path === "/blueprints" || path === "/blueprints/") {
      const page = parseInt(url.searchParams.get("page") || "1");
      const perPage = Math.min(parseInt(url.searchParams.get("per_page") || "20"), 50);
      const typeFilter = url.searchParams.get("type");
      const toolFilter = url.searchParams.get("tool");
      const difficultyFilter = url.searchParams.get("difficulty");
      const topicFilter = url.searchParams.get("topic");

      let query = supabase
        .from("content_items")
        .select("id, title, description, content_type, difficulty, ai_tools, use_cases, topics, custom_tags, download_count, view_count, avg_rating, rating_count, created_at, creator_id, current_version", { count: "exact" })
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .range((page - 1) * perPage, page * perPage - 1);

      if (typeFilter) query = query.eq("content_type", typeFilter);
      if (difficultyFilter) query = query.eq("difficulty", difficultyFilter);
      if (toolFilter) query = query.contains("ai_tools", [toolFilter]);
      if (topicFilter) query = query.contains("topics" as any, [topicFilter]);

      const { data, count, error } = await query;
      if (error) throw error;

      return json({ data, page, per_page: perPage, total: count ?? 0 });
    }

    // GET /blueprints/:id
    const bpMatch = path.match(/^\/blueprints\/([a-f0-9-]+)$/);
    if (bpMatch) {
      const { data: item, error } = await supabase
        .from("content_items")
        .select("id, title, description, content_type, difficulty, ai_tools, use_cases, topics, custom_tags, download_count, view_count, avg_rating, rating_count, created_at, creator_id, current_version")
        .eq("id", bpMatch[1])
        .eq("status", "approved")
        .single();
      if (error || !item) {
        return json({ error: "Not found" }, 404);
      }

      // Fetch blocks
      const { data: blocks } = await supabase
        .from("content_blocks")
        .select("id, block_type, text_content, formatting_type, position, image_url, image_description, is_preview")
        .eq("content_id", bpMatch[1])
        .order("position");

      return json({ ...item, blocks: blocks ?? [] });
    }

    // GET /tools
    if (path === "/tools" || path === "/tools/") {
      const { data, error } = await supabase
        .from("ai_tools_registry")
        .select("name, slug, description, website_url, category, is_official")
        .eq("status", "approved")
        .order("is_official", { ascending: false })
        .order("name");
      if (error) throw error;
      return json({ data });
    }

    return json({ error: "Not found", endpoints: ["/blueprints", "/blueprints/:id", "/tools"] }, 404);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
