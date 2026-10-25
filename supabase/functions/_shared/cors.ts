import { isAllowedOrigin } from "./origins.ts";

const ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

export interface CorsOptions {
  /** A public read (public-api, post-json, sitemap-xml, mcp discovery) answers every origin. */
  open?: boolean;
  methods?: string;
}

/**
 * The CORS headers for one request. An allowed origin is reflected; any other
 * origin, and a call with no origin, gets no allow header, so a browser page on
 * another site cannot read the answer. Nothing here is kept between requests.
 */
export function corsHeaders(req: Request, options: CorsOptions = {}): Record<string, string> {
  const headers: Record<string, string> = { "Access-Control-Allow-Headers": ALLOW_HEADERS };
  if (options.methods) headers["Access-Control-Allow-Methods"] = options.methods;
  if (options.open) {
    headers["Access-Control-Allow-Origin"] = "*";
    return headers;
  }
  headers["Vary"] = "Origin";
  const origin = req.headers.get("origin");
  if (isAllowedOrigin(origin)) headers["Access-Control-Allow-Origin"] = origin as string;
  return headers;
}

export function preflight(req: Request, options: CorsOptions = {}): Response {
  return new Response(null, { headers: corsHeaders(req, options) });
}
