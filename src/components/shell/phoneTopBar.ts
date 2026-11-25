// What sits in the phone's top bar on each route (prompt 19). One table, so the bar never decides by page code: the container
// asks `phoneBarFor(pathname)` and draws the answer. A page that knows more (a person's name, a build's source) tells the bar
// through `phoneBarRegistry`, and the bar prefers that over the table's fallback.
//
// The current section's name is never repeated in the bar: Home, Builds and OpenBuilds show the logo, and the dock names them.

import { SITE_NAV } from "./siteNav";

export type BarLeft = "account" | "back" | "close" | "none";
/** `logo`, `none`, or the words drawn in the centre. */
export type BarCentre = { kind: "logo" } | { kind: "none" } | { kind: "title"; text: string };
/** What the right slot holds. `more` and `action` come from the page (see the registry); the rest are the bar's own. */
export type BarRight = "search" | "markAll" | "more" | "newBuild" | "settings" | "messageSettings" | "skip" | "none";

export interface PhoneBarSpec {
  left: BarLeft;
  centre: BarCentre;
  right: BarRight;
  /** The back control's accessible name when it is not plain "Back". */
  backLabel?: string;
  /** Where Back goes when the page was opened directly and there is no history to step back through. */
  backTo?: string;
}

const logo: BarCentre = { kind: "logo" };
const none: BarCentre = { kind: "none" };
const title = (text: string): BarCentre => ({ kind: "title", text });

/** The pages that show Search at the right: the three primary sections. */
const PRIMARY_ROUTES = new Set<string>([SITE_NAV.home, SITE_NAV.gallery, "/gallery", SITE_NAV.openbuilds]);

/** The route's bar. `pathname` has no query. A trailing slash is ignored. */
export function phoneBarFor(pathname: string): PhoneBarSpec {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname || "/";

  if (PRIMARY_ROUTES.has(path)) return { left: "account", centre: logo, right: "search" };
  if (path === SITE_NAV.activity) return { left: "account", centre: title("Activity"), right: "markAll" };

  // Sign in, consent, onboarding.
  if (path === "/onboarding" || path.startsWith("/onboarding/")) return { left: "none", centre: none, right: "skip" };
  if (path === "/auth/callback" || path.startsWith("/oauth") || path.startsWith("/consent")) return { left: "close", centre: none, right: "none" };

  // Editor, Start a build, Rebuild.
  if (path.startsWith("/rebuild/")) return { left: "back", centre: logo, right: "more", backTo: SITE_NAV.gallery };
  if (path === SITE_NAV.create || path.startsWith("/compose")) return { left: "back", centre: logo, right: "more", backLabel: "Back to Drafts", backTo: SITE_NAV.drafts };

  // A build, its Lineage and Compare.
  if (path.startsWith("/b2/")) {
    // Mobile 28: Lineage and Compare have nothing at the right.
    if (path.includes("/compare/")) return { left: "back", centre: title("Compare two builds"), right: "none" };
    if (path.endsWith("/lineage")) return { left: "back", centre: title("Lineage"), right: "none" };
    return { left: "back", centre: none, right: "more" };
  }

  // A space, a topic.
  if (path.startsWith("/openbuilds/topics/")) return { left: "back", centre: title("Topic"), right: "more" };
  if (path.startsWith("/openbuilds/spaces/")) return { left: "back", centre: none, right: "more" };
  if (path.startsWith("/openbuilds/")) return { left: "back", centre: none, right: "more" };

  // Followers and Following carry the person's name, which only the page knows; the table's fallback is the word.
  if (/^\/profile\/[^/]+\/(followers|following)$/.test(path)) return { left: "back", centre: title(path.endsWith("followers") ? "Followers" : "Following"), right: "none" };
  if (path === SITE_NAV.profile || path.startsWith("/profile/")) return { left: "back", centre: none, right: "more" };

  if (path === SITE_NAV.library || path.startsWith("/library")) return { left: "back", centre: title("Library"), right: "none" };
  if (path === SITE_NAV.drafts || path.startsWith("/drafts")) return { left: "back", centre: title("Drafts"), right: "newBuild" };
  if (path === SITE_NAV.settings || path.startsWith(`${SITE_NAV.settings}/`)) return { left: "back", centre: title("Settings"), right: "none" };
  // Messages (prompt 26): the list has the settings gear; a conversation names the person (the page registers it) and has More.
  if (path === "/messages") return { left: "back", centre: title("Messages"), right: "messageSettings", backTo: "/" };
  if (path.startsWith("/messages/")) return { left: "back", centre: title("Messages"), right: "more", backTo: "/messages" };
  if (path === "/search") return { left: "back", centre: title("Search"), right: "none" };
  // Mobile 28: the admin page and the progress page name themselves.
  if (path === "/admin") return { left: "back", centre: title("Admin"), right: "none" };
  if (path === "/analytics") return { left: "back", centre: title("Your progress"), right: "none" };

  // Import and Connect are tasks that end: close, and the page's name.
  if (path === "/import") return { left: "close", centre: title("Import"), right: "none" };
  if (path === "/connect") return { left: "close", centre: title("Connect a tool"), right: "none" };

  // Any other page (legal, About): back, and the page's own name left to its heading.
  return { left: "back", centre: none, right: "none" };
}

/**
 * Routes where a pinned footer or a full-screen task replaces the dock: the editor, Start a build, Rebuild, onboarding and the
 * sign-in screen (the dialog is opened by `?signin=` on any page). Messages replaces it with the composer's reply bar.
 */
/**
 * Prompt 21: a topic pins its own reply bar to the bottom, so the dock slides down and away on that route and comes back on
 * leaving it. Unlike `dockHiddenFor` the dock stays mounted, so the move is a transform, not a pop.
 */
export function dockAwayFor(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname || "/";
  return /^\/openbuilds\/topics\/[^/]+$/.test(path);
}

export function dockHiddenFor(pathname: string, search = ""): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname || "/";
  if (new URLSearchParams(search).has("signin")) return true;
  if (path === SITE_NAV.create || path.startsWith("/compose") || path.startsWith("/rebuild/")) return true;
  if (path === "/onboarding" || path.startsWith("/onboarding/")) return true;
  /* Connect pins its main action to the bottom edge, where the dock would sit. */
  if (path === "/connect") return true;
  if (/^\/messages\/[^/]+$/.test(path)) return true;
  if (path === "/auth/callback" || path.startsWith("/oauth") || path.startsWith("/consent")) return true;
  return false;
}
