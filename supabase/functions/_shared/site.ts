// The site's one address in the edge functions (UX-13). Every function that
// writes an absolute link to the site reads it from here. The app has its own
// twin in src/lib/site.ts.
//
// Pure TypeScript with no imports, so Deno and the repo's Vitest run both load it.
// PUBLIC_SITE_URL is a Supabase Edge Function secret; outside Deno there is none.

const DEFAULT_SITE_URL = "https://openbuilds.ai";

function readEnv(): string | undefined {
  try {
    const deno = (globalThis as { Deno?: { env?: { get(name: string): string | undefined } } }).Deno;
    return deno?.env?.get("PUBLIC_SITE_URL")?.trim() || undefined;
  } catch {
    // Deno without --allow-env: use the default.
    return undefined;
  }
}

/** The site's address with no trailing slash. */
export const SITE_URL: string = (readEnv() ?? DEFAULT_SITE_URL).replace(/\/+$/, "");

/** `path` on the site, with exactly one slash between them; the query and hash are kept. */
export function siteUrl(path = ""): string {
  return `${SITE_URL}/${path.replace(/^\/+/, "")}`;
}
