// The site's one address in the app (UX-13). Every canonical, Open Graph URL,
// share link and Build File link is built from this, never from a literal.
// VITE_SITE_URL overrides it for a preview deploy that should point at itself.

const DEFAULT_SITE_URL = "https://openbuilds.ai";

const fromEnv = (import.meta.env?.VITE_SITE_URL as string | undefined)?.trim();

/** The site's address with no trailing slash. */
export const SITE_URL: string = (fromEnv || DEFAULT_SITE_URL).replace(/\/+$/, "");

/** `path` on the site: exactly one slash between them; the query and hash are kept. */
export function siteUrl(path = ""): string {
  return `${SITE_URL}/${path.replace(/^\/+/, "")}`;
}
