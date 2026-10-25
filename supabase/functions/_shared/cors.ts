// One CORS helper for every function that is not a public read.
//
// A browser origin gets an allow header only when it is on the list in
// origins.ts, and then the header is that origin, not "*". public-api,
// post-json, sitemap-xml and the mcp discovery address are public reads and
// pass `open: true`. A call from anywhere else still reaches the function (CORS
// is the browser's rule, not a firewall), so every function that matters also
// checks its caller; this only stops another website's script reading answers.
//
// Pure TypeScript apart from the origins list, so Vitest can load it.

import { isAllowedOrigin } from "./origins.ts";

const ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

export interface CorsOptions {
  /** A public read: answer every origin. */
  open?: boolean;
  /** Defaults to POST, OPTIONS. */
  methods?: string;
}

export function corsHeaders(req: Request, options: CorsOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Allow-Methods": options.methods ?? "POST, OPTIONS",
  };
  if (options.open) {
    headers["Access-Control-Allow-Origin"] = "*";
    return headers;
  }
  headers["Vary"] = "Origin";
  const origin = req.headers.get("origin");
  if (isAllowedOrigin(origin)) headers["Access-Control-Allow-Origin"] = origin as string;
  return headers;
}

/** The answer to a preflight, or null when the request is not one. */
export function preflight(req: Request, options: CorsOptions = {}): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: corsHeaders(req, options) });
}

export function json(req: Request, body: unknown, status = 200, options: CorsOptions = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req, options), "Content-Type": "application/json" },
  });
}

/** The one error shape: `{ error: "<what failed>" }` with the right status. */
export function fail(req: Request, status: number, message: string, options: CorsOptions = {}): Response {
  return json(req, { error: message }, status, options);
}

/**
 * Put this module's CORS headers on an answer another function already built.
 * For the functions whose own helpers (`respond`, `fail`) predate cors.ts and
 * have no request in hand: whatever allow-origin they wrote is replaced.
 */
export function withCors(req: Request, res: Response, options: CorsOptions = {}): Response {
  const headers = new Headers(res.headers);
  headers.delete("Access-Control-Allow-Origin");
  for (const [name, value] of Object.entries(corsHeaders(req, options))) headers.set(name, value);
  return new Response(res.body, { status: res.status, headers });
}
