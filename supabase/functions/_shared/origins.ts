// The addresses that may call these functions from a browser, and the only
// addresses a buyer may be sent back to after Stripe. One list, read by cors.ts
// and by the checkout functions, so the two can never disagree.
//
// Pure TypeScript with no imports, so Deno and the repo's Vitest run both load it.

export const ALLOWED_ORIGINS: readonly string[] = [
  "https://buildgallery.ai",
  "https://www.buildgallery.ai",
  // The Lovable published domain, until the custom domain is the only one.
  "https://agent-share-hub.lovable.app",
  // This project's Lovable preview (the id is the one in index.html's og:image).
  "https://id-preview--6ef15597-ce5e-4a28-b61c-f6583cb5d718.lovable.app",
  // Development.
  "http://localhost:8080",
];

export function isAllowedOrigin(origin: string | null | undefined): boolean {
  return !!origin && ALLOWED_ORIGINS.includes(origin);
}

/**
 * True when `url` is an absolute http(s) address on an allowed origin. The URL
 * is parsed, not prefix-matched, so `https://buildgallery.ai.evil.example` and
 * `https://buildgallery.ai@evil.example` are both refused.
 */
export function isAllowedReturnUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.username || parsed.password) return false;
  return isAllowedOrigin(parsed.origin);
}
