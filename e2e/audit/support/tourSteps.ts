/* SV-04: the page change tour `npm run audit:pages` plays (page-changes.spec.ts), beside SV-03's page targets.

   ONE LIST, read by the spec. A page prompt (SV-08 to SV-14) adds its page's steps here (the Builds view switch, Library's
   kinds, OpenBuilds' tabs) and changes nothing in the spec.

   The tour starts on Home, opened by address, and follows the nav's links (SV-02's names), never the redirects from
   /gallery and /bounties. Each step is one input and the page it ends on:
     nav       the primary nav link with this name;
     click     the first element inside the page area matching this selector;
     account   the account menu, then the item with this name;
     back      the browser's Back.
   `readyMark` is the `usePageReady` name of the page the step ends on. `scroll` scrolls that page to its foot once it is
   ready, so a later `back` to it can be checked; `restores` names the step whose scroll position a `back` must bring back.
   `sameParams` marks a step that keeps the page and changes its parameters (no fade, the old content kept). */

export type TourAction =
  | { do: "nav"; name: string }
  | { do: "click"; selector: string }
  | { do: "account"; item: string }
  | { do: "back" };

export interface TourStep {
  name: string;
  action: TourAction;
  readyMark: string;
  scroll?: boolean;
  restores?: string;
  sameParams?: boolean;
}

export const TOUR_START = { path: "/", readyMark: "home" };

export const TOUR_STEPS: TourStep[] = [
  { name: "Home → Builds", action: { do: "nav", name: "Builds" }, readyMark: "builds", scroll: true },
  { name: "Builds → a build", action: { do: "click", selector: 'a[href^="/b2/"]' }, readyMark: "build" },
  { name: "Back to Builds", action: { do: "back" }, readyMark: "builds", restores: "Home → Builds" },
  { name: "Builds → OpenBuilds", action: { do: "nav", name: "OpenBuilds" }, readyMark: "openbuilds" },
  { name: "OpenBuilds → Library", action: { do: "nav", name: "Library" }, readyMark: "library" },
  { name: "Library → Drafts", action: { do: "nav", name: "Drafts" }, readyMark: "drafts", scroll: true },
  { name: "Drafts → a draft", action: { do: "click", selector: 'a[href^="/compose/7"]' }, readyMark: "composer" },
  { name: "Back to Drafts", action: { do: "back" }, readyMark: "drafts", restores: "Library → Drafts" },
  { name: "Drafts → Profile", action: { do: "account", item: "Profile" }, readyMark: "profile" },
];

/** The warm tour starts back on Home, from the nav. */
export const TOUR_HOME: TourStep = { name: "Profile → Home", action: { do: "nav", name: "Home" }, readyMark: "home" };
