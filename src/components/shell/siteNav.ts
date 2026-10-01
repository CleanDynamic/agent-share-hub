/* UI-P17 — where the site frame's chrome goes, and which section a route is in.

   THE HREFS ARE `allNavItems`' (src/components/AppShell.tsx), copied rather than
   invented, because that table lives inside a component and the old frame must
   not be edited. `siteNav.test.ts` reads AppShell's source and fails if any of
   these drifts from it, so the two cannot disagree quietly. */

export const SITE_NAV = {
  home: "/",
  gallery: "/gallery",
  bounties: "/bounties",
  library: "/library",
  /** The create route: AppShell's `upload` item, "New build". */
  create: "/compose/new",
  activity: "/notifications",
  profile: "/profile",
} as const;

export type PrimarySection = "home" | "gallery" | "bounties" | "library";

/** The four links in the header's primary nav, in order. Library is signed-in only, as in `allNavItems`. */
export const PRIMARY_LINKS: readonly { key: PrimarySection; label: string; href: string; authOnly?: boolean }[] = [
  { key: "home", label: "Home", href: SITE_NAV.home },
  { key: "gallery", label: "Gallery", href: SITE_NAV.gallery },
  { key: "bounties", label: "Bounties", href: SITE_NAV.bounties },
  { key: "library", label: "Library", href: SITE_NAV.library, authOnly: true },
];

/**
 * The primary link a route belongs to. A build page and the rebuild page count
 * as Gallery; import, compose and Activity belong to none (Activity is shown by
 * the bell instead).
 */
export function sectionForPath(pathname: string): PrimarySection | null {
  if (pathname === "/" || pathname === "") return "home";
  if (pathname === "/gallery" || pathname.startsWith("/b2/") || pathname.startsWith("/rebuild/")) return "gallery";
  if (pathname === "/bounties" || pathname.startsWith("/bounties/")) return "bounties";
  if (pathname === "/library" || pathname.startsWith("/library/")) return "library";
  return null;
}

/** True on the Activity page. */
export function isActivityPath(pathname: string): boolean {
  return pathname === SITE_NAV.activity || pathname.startsWith(`${SITE_NAV.activity}/`);
}
