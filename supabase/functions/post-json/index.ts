import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders as corsFor, preflight } from "../_shared/cors.ts";
import { errorResponse } from "../_shared/http.ts";

// A public read: every origin may call it, and it reads with the public key so
// the database's own rules decide which rows come back.
const cors = { open: true, methods: "GET, OPTIONS" };

serve(async (req) => {
  if (req.method === "OPTIONS") return preflight(req, cors);
  const corsHeaders = corsFor(req, cors);

  try {
    const url = new URL(req.url);
    // Accept ?slug=... or trailing path /post-json/<slug>
    let slug = url.searchParams.get("slug") || "";
    if (!slug) {
      const m = url.pathname.match(/\/post-json\/([^\/]+?)(?:\.json)?$/);
      if (m) slug = decodeURIComponent(m[1]);
    }
    if (!slug) {
      return errorResponse("Missing slug", 400, corsHeaders);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    // Look up by slug, fallback to id
    let { data: post } = await supabase
      .from("content_items")
      .select("id, canonical_export_payload, status, visibility")
      .eq("slug", slug)
      .maybeSingle();

    if (!post) {
      const r = await supabase
        .from("content_items")
        .select("id, canonical_export_payload, status, visibility")
        .eq("id", slug)
        .maybeSingle();
      post = r.data as any;
    }

    if (!post || post.status !== "approved" || (post.visibility && post.visibility !== "public")) {
      return errorResponse("Not found", 404, corsHeaders);
    }

    const payload = (post as any).canonical_export_payload;
    if (!payload) {
      return new Response(JSON.stringify({ error: "Payload not yet generated", id: post.id }), {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    });
  } catch (e) {
    console.error("post-json error:", e);
    return errorResponse("Could not read that post", 500, corsHeaders);
  }
});
