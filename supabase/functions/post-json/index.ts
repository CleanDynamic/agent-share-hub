import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders as corsFor } from "../_shared/cors.ts";
import { publicClient } from "../_shared/publicRead.ts";

serve(async (req) => {
  // A public read: every origin may read the answer.
  const corsHeaders = corsFor(req, { open: true, methods: "GET, OPTIONS" });
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    // Accept ?slug=... or trailing path /post-json/<slug>
    let slug = url.searchParams.get("slug") || "";
    if (!slug) {
      const m = url.pathname.match(/\/post-json\/([^\/]+?)(?:\.json)?$/);
      if (m) slug = decodeURIComponent(m[1]);
    }
    if (!slug) {
      return new Response(JSON.stringify({ error: "Missing slug" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The public key: this is a public read, so the database's own rules apply.
    const supabase = publicClient();

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
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
    console.error("post-json:", e);
    return new Response(JSON.stringify({ error: "Could not read the post" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
