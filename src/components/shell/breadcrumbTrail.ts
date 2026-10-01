/* UI-P18 — route → breadcrumb trail, as the boards draw it.

   Pure. `title` is the current record's name (a build's title, a profile's
   display name) once the page has loaded it; null while it is loading, which
   draws the skeleton. A crumb without `href` is the current page. The last
   crumb is always current; an ancestor that carries the record's title is a
   link back to the record.

     /                          Home
     /gallery                   Home / Gallery
     /b2/:slug                  Home / Gallery / {build}
     /b2/:slug/lineage          Home / Gallery / {build} / Lineage
     /rebuild/:slug             Home / Gallery / {build} / Rebuild
     /import                    Home / New build / Import
     /compose/*                 Home / New build / Compose
     /bounties                  Home / Bounties
     /bounties/solvers          Home / Bounties / Solvers
     /profile/:handle           Home / {display name}
     /notifications             Home / Activity
     /library                   Home / Library                                   */

import { matchPath } from "react-router-dom";

import { SITE_NAV } from "./siteNav";

export interface Crumb {
  /** The text, or null while a title is loading. */
  label: string | null;
  /** Absent on the current page. */
  href?: string;
}

const HOME: Crumb = { label: "Home", href: SITE_NAV.home };
const GALLERY: Crumb = { label: "Gallery", href: SITE_NAV.gallery };
const NEW_BUILD: Crumb = { label: "New build", href: SITE_NAV.create };

const here = (pathname: string, pattern: string) => matchPath({ path: pattern, end: true }, pathname);

export function trailFor(pathname: string, title: string | null): Crumb[] {
  if (pathname === "/" || pathname === "") return [{ label: "Home" }];
  if (here(pathname, "/gallery")) return [HOME, { label: "Gallery" }];

  const lineage = here(pathname, "/b2/:slug/lineage");
  if (lineage) {
    return [HOME, GALLERY, { label: title, href: `/b2/${lineage.params.slug}` }, { label: "Lineage" }];
  }
  const build = here(pathname, "/b2/:slug");
  if (build) return [HOME, GALLERY, { label: title }];
  const rebuild = here(pathname, "/rebuild/:slug");
  if (rebuild) {
    return [HOME, GALLERY, { label: title, href: `/b2/${rebuild.params.slug}` }, { label: "Rebuild" }];
  }

  if (here(pathname, "/import")) return [HOME, NEW_BUILD, { label: "Import" }];
  if (here(pathname, "/compose/*")) return [HOME, NEW_BUILD, { label: "Compose" }];

  if (here(pathname, "/bounties/solvers")) return [HOME, { label: "Bounties", href: SITE_NAV.bounties }, { label: "Solvers" }];
  if (here(pathname, "/bounties")) return [HOME, { label: "Bounties" }];

  if (here(pathname, "/profile/:handle") || here(pathname, "/profile")) return [HOME, { label: title }];
  if (here(pathname, "/notifications")) return [HOME, { label: "Activity" }];
  if (here(pathname, "/library")) return [HOME, { label: "Library" }];

  return [{ label: "Home" }];
}
