/* UI-P17 — where the site frame's chrome goes, and which section a route is in.

   THE HREFS are the routes the old frame's rail used, copied here because the
   table that held them no longer exists. `siteNav.test.ts` snapshots
   `PRIMARY_LINKS`, so a change to the header's links is a visible diff. */

export const SITE_NAV = {
  home: "/",
  gallery: "/gallery",
  bounties: "/bounties",
  library: "/library",
  drafts: "/drafts",
  /** The create route: AppShell's `upload` item, "New build". */
  create: "/compose/new",
  activity: "/notifications",
  profile: "/profile",
} as const;

export type PrimarySection = "home" | "gallery" | "bounties" | "library" | "drafts";

/** The links in the header's primary nav, in order. Library is signed-in only, as in `allNavItems`. */
export const PRIMARY_LINKS: readonly { key: PrimarySection; label: string; href: string; authOnly?: boolean }[] = [
  { key: "home", label: "Home", href: SITE_NAV.home },
  { key: "gallery", label: "Gallery", href: SITE_NAV.gallery },
  { key: "bounties", label: "Bounties", href: SITE_NAV.bounties },
  { key: "library", label: "Library", href: SITE_NAV.library, authOnly: true },
  { key: "drafts", label: "Drafts", href: SITE_NAV.drafts, authOnly: true },
];

/**
 * The primary link a route belongs to. A build page and the rebuild page count
 * as Gallery; import and Activity belong to none, compose belongs to Drafts (Activity is shown by
 * the bell instead).
 */
export function sectionForPath(pathname: string): PrimarySection | null {
  if (pathname === "/" || pathname === "") return "home";
  if (pathname === "/gallery" || pathname.startsWith("/b2/") || pathname.startsWith("/rebuild/")) return "gallery";
  if (pathname === "/bounties" || pathname.startsWith("/bounties/")) return "bounties";
  if (pathname === "/library" || pathname.startsWith("/library/")) return "library";
  if (pathname === "/drafts" || pathname.startsWith("/drafts/") || pathname.startsWith("/compose/")) return "drafts";
  return null;
}

/** True on the Activity page. */
export function isActivityPath(pathname: string): boolean {
  return pathname === SITE_NAV.activity || pathname.startsWith(`${SITE_NAV.activity}/`);
}
