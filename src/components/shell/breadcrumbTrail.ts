/* UI-P18 — route → breadcrumb trail, as the boards draw it.

   Pure. `title` is the current record's name (a build's title, a profile's
   display name) once the page has loaded it; null while it is loading, which
   draws the skeleton. A crumb without `href` is the current page. The last
   crumb is always current; an ancestor that carries the record's title is a
   link back to the record.

     /                          Home
     /builds                    Home / Builds
     /b2/:slug                  Home / Builds / {build}
     /b2/:slug/lineage          Home / Builds / {build} / Lineage
     /rebuild/:slug             Home / Builds / {build} / Rebuild
     /import                    Home / New build / Import
     /drafts                    Home / Drafts
     /drafts/posts              Home / Drafts / Older post drafts
     /compose/*                 Home / Drafts / {title}
     /openbuilds                Home / OpenBuilds
     /openbuilds/solvers        Home / OpenBuilds / Solvers
     /profile/:handle           Home / {display name}
     /notifications             Home / Activity
     /connect                   Home / Connect a tool
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
const GALLERY: Crumb = { label: "Builds", href: SITE_NAV.gallery };
const DRAFTS: Crumb = { label: "Drafts", href: SITE_NAV.drafts };
const NEW_BUILD: Crumb = { label: "New build", href: SITE_NAV.create };

const here = (pathname: string, pattern: string) => matchPath({ path: pattern, end: true }, pathname);

export function trailFor(pathname: string, title: string | null): Crumb[] {
  if (pathname === "/" || pathname === "") return [{ label: "Home" }];
  if (here(pathname, "/builds") || here(pathname, "/gallery")) return [HOME, { label: "Builds" }];

  const lineage = here(pathname, "/b2/:slug/lineage");
  if (lineage) {
    return [HOME, GALLERY, { label: title, href: `/b2/${lineage.params.slug}` }, { label: "Lineage" }];
  }
  // CA-13 P9: two builds of the same thing, side by side.
  const compare = here(pathname, "/b2/:slug/compare/:otherSlug");
  if (compare) return [HOME, GALLERY, { label: title, href: `/b2/${compare.params.slug}` }, { label: "Compare" }];
  const build = here(pathname, "/b2/:slug");
  if (build) return [HOME, GALLERY, { label: title }];
  const rebuild = here(pathname, "/rebuild/:slug");
  if (rebuild) {
    return [HOME, GALLERY, { label: title, href: `/b2/${rebuild.params.slug}` }, { label: "Rebuild" }];
  }

  if (here(pathname, "/import")) return [HOME, NEW_BUILD, { label: "Import" }];
  if (here(pathname, "/drafts")) return [HOME, { label: "Drafts" }];
  if (here(pathname, "/drafts/posts")) return [HOME, DRAFTS, { label: "Older post drafts" }];
  if (here(pathname, "/compose/*")) return [HOME, DRAFTS, { label: title ?? "Untitled build" }];

  if (here(pathname, "/openbuilds/solvers") || here(pathname, "/bounties/solvers")) {
    return [HOME, { label: "OpenBuilds", href: SITE_NAV.bounties }, { label: "Solvers" }];
  }
  if (here(pathname, "/openbuilds") || here(pathname, "/bounties")) return [HOME, { label: "OpenBuilds" }];

  if (here(pathname, "/profile/:handle") || here(pathname, "/profile")) return [HOME, { label: title }];
  if (here(pathname, "/notifications")) return [HOME, { label: "Activity" }];
  if (here(pathname, "/connect")) return [HOME, { label: "Connect a tool" }];
  if (here(pathname, "/library")) return [HOME, { label: "Library" }];

  return [{ label: "Home" }];
}
