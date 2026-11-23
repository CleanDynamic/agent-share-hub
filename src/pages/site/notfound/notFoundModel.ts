// UX-12 P5: what the 404 page says about the address. Pure.

/** The longest address the page shows. */
export const SHOWN_PATH_MAX = 60;

export const NOT_FOUND_TITLE = "This page isn't here";
export const NOT_FOUND_LINE = "The link may be old, or the page may have been removed.";

/** The project line, which ProjectDetail's own not-found state says too. */
export const PROJECT_HINT = "If you were looking for a project, it may have been removed.";

/** A second sentence for an address that looks like one of the site's own kinds (a build, a profile, a project); null for any other. */
export function hintFor(pathname: string): string | null {
  if (pathname.startsWith("/b/")) return "If you were looking for a build, it may have been made private or deleted.";
  if (pathname.startsWith("/u/")) return "If you were looking for a profile, the username may have changed.";
  if (pathname.startsWith("/project/")) return PROJECT_HINT;
  return null;
}

/** The address, cut to 60 characters. */
export function shownPath(pathname: string): string {
  const chars = [...pathname];
  return chars.length > SHOWN_PATH_MAX ? `${chars.slice(0, SHOWN_PATH_MAX - 1).join("")}…` : pathname;
}
