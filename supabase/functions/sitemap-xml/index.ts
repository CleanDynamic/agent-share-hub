import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders as corsFor } from "../_shared/cors.ts";
import { publicClient } from "../_shared/publicRead.ts";

const SITE = Deno.env.get("PUBLIC_SITE_URL") ?? "https://neoscaleai.com";

serve(async (req) => {
  // A public read: every origin may read the answer.
  const corsHeaders = corsFor(req, { open: true, methods: "GET, OPTIONS" });
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // The public key: this is a public read, so the database's own rules apply.
  const supabase = publicClient();

  const { data: posts } = await supabase
    .from("content_items")
    .select("slug, id, updated_at, published_at, post_type")
    .eq("status", "approved")
    .order("published_at", { ascending: false })
    .limit(5000);

  const staticUrls = [
    { loc: "/", changefreq: "daily", priority: 1.0 },
    { loc: "/browse", changefreq: "daily", priority: 0.9 },
    { loc: "/about", changefreq: "monthly", priority: 0.4 },
  ];

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  for (const u of staticUrls) {
    lines.push(`  <url><loc>${SITE}${u.loc}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`);
  }
  for (const p of posts ?? []) {
    const slug = (p as any).slug || (p as any).id;
    const lastmod = (p as any).updated_at || (p as any).published_at;
    lines.push(
      `  <url><loc>${SITE}/b/${esc(slug)}</loc>` +
        (lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : "") +
        `<changefreq>weekly</changefreq><priority>0.8</priority></url>`,
    );
  }
  lines.push("</urlset>");

  return new Response(lines.join("\n"), {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=21600",
    },
  });
});
