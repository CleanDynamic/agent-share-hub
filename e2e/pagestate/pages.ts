// G29: every page type, its address, and the state each condition must end in.

import type { Condition } from "./network";
import type { Seen } from "./classify";

export interface PageType {
  name: string;
  path: string;
  /** What "empty" must end in: lists empty, single rows missing. Several are allowed where the page has data of its own. */
  empty: Seen[];
  /** Messages is legacy: G24 applies to it, G11 does not. It is in the run, reported apart. */
  legacy?: boolean;
}

const SLUG = "pagestate-missing";
const OTHER = "pagestate-other";
const HANDLE = "pagestate-somebody";
const UUID = (n: string) => `00000000-0000-4000-8000-0000000000${n}`;

export const PAGE_TYPES: PageType[] = [
  { name: "Home", path: "/", empty: ["empty"] },
  { name: "Builds table", path: "/builds", empty: ["empty"] },
  { name: "Builds maps", path: "/builds?view=maps", empty: ["empty"] },
  { name: "Builds classification", path: "/builds?view=classification", empty: ["empty"] },
  { name: "Build", path: `/b2/${SLUG}`, empty: ["notfound"] },
  { name: "Compare", path: `/b2/${SLUG}/compare/${OTHER}`, empty: ["notfound"] },
  { name: "Lineage", path: `/b2/${SLUG}/lineage`, empty: ["notfound"] },
  { name: "Rebuild", path: `/rebuild/${SLUG}`, empty: ["notfound"] },
  // G27: the member's own profile row is missing under "empty", and that is a failed read, not a missing page.
  { name: "Profile (own)", path: "/profile", empty: ["failed"] },
  { name: "Profile (someone's)", path: `/profile/${HANDLE}`, empty: ["notfound"] },
  { name: "Followers", path: `/profile/${HANDLE}/followers`, empty: ["notfound"] },
  { name: "Following", path: `/profile/${HANDLE}/following`, empty: ["notfound"] },
  { name: "Activity", path: "/notifications", empty: ["empty"] },
  { name: "Library (own)", path: "/library", empty: ["empty"] },
  { name: "Library (someone's)", path: `/library/${HANDLE}`, empty: ["notfound"] },
  { name: "Collection", path: `/library?collection=${UUID("c1")}`, empty: ["notfound"] },
  { name: "Drafts", path: "/drafts", empty: ["empty"] },
  { name: "Settings account", path: "/settings/account", empty: ["ready", "empty"] },
  { name: "Settings notifications", path: "/settings/notifications", empty: ["ready", "empty"] },
  { name: "Settings privacy", path: "/settings/privacy", empty: ["ready", "empty"] },
  { name: "Settings apps", path: "/settings/apps", empty: ["empty"] },
  { name: "OpenBuilds feed", path: "/openbuilds", empty: ["empty"] },
  { name: "Space", path: `/openbuilds/spaces/${SLUG}`, empty: ["notfound"] },
  { name: "Post", path: `/openbuilds/topics/${UUID("d1")}`, empty: ["notfound"] },
  { name: "Editor (new)", path: "/compose/new", empty: ["ready", "empty"] },
  { name: "Editor (existing)", path: `/compose/${UUID("e1")}`, empty: ["notfound"] },
  { name: "Messages", path: "/messages", empty: ["empty"], legacy: true },
];

/** The state `condition` must end in on `page`. */
export function expectedFor(page: PageType, condition: Condition): Seen[] {
  switch (condition) {
    case "aborted":
    case "server-error":
    case "never":
      return ["failed"];
    case "refused":
      return ["signedout"];
    case "empty":
      return page.empty;
  }
}
