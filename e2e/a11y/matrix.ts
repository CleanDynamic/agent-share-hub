// G25 to G27: every page in the matrix, the address it is opened at, and how it gets its data.
//
// `kit` pages are the dev kit pages (src/pages/dev/KitPages.tsx), drawn from sample data with no request. `route` pages are
// the real addresses with the network faked as "empty" (e2e/pagestate/network.ts): a page that needs a row shows its
// not-found or failed state, which is the state the guard checks for that page. `state` says which, for the report.

export type Theme = "light" | "dark";

export interface Variant {
  theme: Theme;
  width: 1440 | 390;
}

/** D4: the full matrix at 1440 in both themes; at 390, dark only. */
export const VARIANTS: readonly Variant[] = [
  { theme: "light", width: 1440 },
  { theme: "dark", width: 1440 },
  { theme: "dark", width: 390 },
];

export interface MatrixPage {
  name: string;
  /** A dev kit page key, or a real address. */
  kit?: string;
  path?: string;
  signedIn?: boolean;
  /** A kit page's real address, for the checks a fixed-width board cannot answer (reflow at 320). */
  real?: string;
  /** A selector that is there once the page's lazily loaded parts are (the editor's thread). */
  ready?: string;
  /** What the page shows under the faked network, for the report. */
  state: string;
}

const MISSING = "a11y-missing";
const OTHER = "a11y-other";
const HANDLE = "a11y-somebody";
const UUID = (n: string) => `00000000-0000-4000-8000-0000000000${n}`;

export const MATRIX: readonly MatrixPage[] = [
  { name: "Home (signed out)", path: "/", state: "empty" },
  { name: "Home (signed in)", kit: "vision-home", real: "/", state: "sample data" },
  { name: "Builds table", kit: "vision-builds-table", real: "/builds", state: "sample data" },
  { name: "Builds maps", kit: "vision-builds-maps", real: "/builds?view=maps", state: "sample data" },
  { name: "Builds classification", kit: "vision-builds-classification", real: "/builds?view=classification", state: "sample data" },
  { name: "Build", kit: "build", real: `/b2/${MISSING}`, state: "sample data" },
  { name: "Build steps", kit: "build-steps", state: "sample data" },
  { name: "Compare", path: `/b2/${MISSING}/compare/${OTHER}`, state: "not found" },
  { name: "Lineage", kit: "lineage", real: `/b2/${MISSING}/lineage`, state: "sample data" },
  { name: "Rebuild", kit: "rebuild", real: `/rebuild/${MISSING}`, state: "sample data" },
  { name: "Profile (own)", path: "/profile", signedIn: true, state: "failed (own row missing)" },
  { name: "Profile (someone's)", kit: "profile", real: `/profile/${HANDLE}`, state: "sample data" },
  { name: "Followers", path: `/profile/${HANDLE}/followers`, state: "not found" },
  { name: "Activity", kit: "activity", real: "/notifications", state: "sample data" },
  { name: "Library", kit: "vision-library", real: "/library", state: "sample data" },
  { name: "Collection", path: `/library?collection=${UUID("c1")}`, signedIn: true, state: "not found" },
  { name: "Drafts", kit: "vision-drafts", real: "/drafts", state: "sample data" },
  { name: "Settings account", path: "/settings/account", signedIn: true, state: "ready" },
  { name: "Settings notifications", path: "/settings/notifications", signedIn: true, state: "ready" },
  { name: "Settings privacy", path: "/settings/privacy", signedIn: true, state: "ready" },
  { name: "Settings apps", path: "/settings/apps", signedIn: true, state: "empty" },
  { name: "Settings data", path: "/settings/data", signedIn: true, state: "ready" },
  { name: "Settings appearance", path: "/settings/appearance", signedIn: true, state: "ready" },
  { name: "OpenBuilds feed", path: "/openbuilds", state: "empty" },
  { name: "Space", path: `/openbuilds/spaces/${MISSING}`, state: "not found" },
  { name: "Post", kit: "post-thread", real: `/openbuilds/topics/${UUID("d1")}`, state: "sample data" },
  { name: "Editor (new)", path: "/compose/new", signedIn: true, ready: ".ProseMirror", state: "ready" },
  { name: "Editor (existing)", kit: "compose", real: `/compose/${UUID("e1")}`, state: "sample data" },
  { name: "Sign in", path: "/?signin=login", state: "dialog" },
  { name: "Sign up", path: "/?signin=signup", state: "dialog" },
  { name: "Reset password", path: "/?signin=reset", state: "dialog" },
  { name: "Reset password (from link)", path: "/?signin=reset&token=a11y-token", state: "dialog" },
  { name: "Verify email", path: "/?signin=verify", state: "dialog" },
  { name: "About", path: "/about", state: "static" },
  { name: "Privacy", path: "/privacy", state: "static" },
  { name: "Terms", path: "/terms", state: "static" },
  { name: "Not found", path: "/a11y-no-such-page", state: "not found" },
  { name: "Connect", path: "/connect", state: "static" },
];

export const addressOf = (page: MatrixPage, variant: Variant): string =>
  page.kit ? `/dev/kit/pages/${page.kit}?theme=${variant.theme === "dark" ? "dusk" : "noon"}&viewport=${variant.width === 390 ? "mobile" : "desktop"}` : (page.path as string);

export const slugOf = (name: string, variant?: Variant): string =>
  `${name}${variant ? `-${variant.theme}-${variant.width}` : ""}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
