import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders as corsFor } from "../_shared/cors.ts";
import { publicClient } from "../_shared/publicRead.ts";
import { siteUrl } from "../_shared/site.ts";
import { buildSitemap, loadSitemapRows } from "../_shared/sitemap.js";

// UX-13 P3: one sitemap of what the site has. The list of pages, the escaping and the
// limits are in _shared/sitemap.js, which scripts/generate-sitemap.js shares, so the
// file this function answers and the one the build writes are the same.

serve(async (req) => {
  // A public read: every origin may read the answer.
  const corsHeaders = corsFor(req, { open: true, methods: "GET, OPTIONS" });
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // The public key: this is a public read, so the database's own rules apply.
  const rows = await loadSitemapRows(publicClient());
  const { xml } = buildSitemap(rows, siteUrl);

  return new Response(xml, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=21600",
    },
  });
});
