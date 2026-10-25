// The origins this project's pages are served from. Two things read this list and
// nothing else keeps a copy: cors.ts answers these origins, and a checkout sends a
// buyer back only to an address on one of them.
//
// buildgallery.ai is the site. The Lovable hosts are this project's preview and
// published addresses (the project id is the one in index.html's preview image;
// previewAuthStorage.ts lists the zones). localhost:8080 is the dev server.
// An origin is scheme, host and port with no path, no wildcard and no trailing slash.
export const ALLOWED_ORIGINS: readonly string[] = [
  "https://buildgallery.ai",
  "https://id-preview--6ef15597-ce5e-4a28-b61c-f6583cb5d718.lovable.app",
  "https://id-preview-dcdc4a32--6ef15597-ce5e-4a28-b61c-f6583cb5d718.lovable.app",
  "https://project--6ef15597-ce5e-4a28-b61c-f6583cb5d718.lovable.app",
  "https://6ef15597-ce5e-4a28-b61c-f6583cb5d718.lovableproject.com",
  "http://localhost:8080",
];

export function isAllowedOrigin(origin: string | null | undefined): boolean {
  return !!origin && ALLOWED_ORIGINS.includes(origin);
}

/** True for an absolute http(s) address whose origin is on the list. Compared as parsed origins, so a lookalike host or a user-info prefix does not pass. */
export function isAllowedReturnUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  return isAllowedOrigin(parsed.origin);
}
