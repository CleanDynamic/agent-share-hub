/* SV-03: the pages `npm run audit:pages` measures, and what each must meet.

   ONE LIST, read by the spec. A page prompt (SV-08 to SV-14) adds or changes its page by editing one entry here and
   nothing in the spec.

   `readyMark` is the name `usePageReady` is given, so the page is ready when <html data-page-ready="<readyMark>"> and
   `performance.getEntriesByName("page-ready:<readyMark>")` exist. `maxRounds` is the most request rounds the page may take
   before that mark (a round is the longest chain of requests where each starts after the one before it ended); null leaves
   the page unchecked until a prompt sets it. */

export interface PageTarget {
  key: string;
  path: string;
  readyMark: string;
  /** Signed in as ME. */
  auth: boolean;
  maxRounds: number | null;
}

export const PAGE_TARGETS: PageTarget[] = [
  { key: "home", path: "/", readyMark: "home", auth: true, maxRounds: 2 },
  { key: "builds", path: "/builds", readyMark: "builds", auth: true, maxRounds: 1 },
  /* SV-12: the Maps view reads the page's builds' Maps once the list has answered (the ids come from it): two rounds, the
     second one request for 24 builds. */
  { key: "builds-maps", path: "/builds?view=maps", readyMark: "builds", auth: true, maxRounds: 2 },
  /* SV-13: Classification draws the classifications the list already carries, so it takes the Table's one round. */
  { key: "builds-classification", path: "/builds?view=classification", readyMark: "builds", auth: true, maxRounds: 1 },
  /* SV-14: the step requests, then (together) their counts, makers, steps strips and the reader's Me too marks: two rounds. */
  { key: "openbuilds", path: "/openbuilds", readyMark: "openbuilds", auth: true, maxRounds: 2 },
  { key: "library-saved", path: "/library", readyMark: "library", auth: true, maxRounds: 1 },
  { key: "library-collections", path: "/library?tab=collections", readyMark: "library", auth: true, maxRounds: null },
  { key: "drafts", path: "/drafts", readyMark: "drafts", auth: true, maxRounds: 1 },
  { key: "composer", path: "/compose/{draft}", readyMark: "composer", auth: true, maxRounds: 2 },
  { key: "build", path: "/b2/{build}", readyMark: "build", auth: true, maxRounds: null },
  /* UX-10: the profile, its side column and its feed's rows together; then each kind's cards (builds: one request, and their own
     display choices beside it). Topics and replies add a third round for their cards' extras, which this harness's feed has none of. */
  { key: "profile", path: "/profile/{maker}", readyMark: "profile", auth: true, maxRounds: 2 },
  /* UX-10 P5b: the profile and the list's first page, with the follow states in it, together: one round. */
  { key: "profile-followers", path: "/profile/{maker}/followers", readyMark: "followers", auth: true, maxRounds: 1 },
  /* UX-15: Settings. Each section reads its own data once on screen: Account two reads in one round, Privacy two in one round. */
  { key: "settings", path: "/settings/privacy", readyMark: "settings", auth: true, maxRounds: 2 },
  { key: "profile-following", path: "/profile/{maker}/following", readyMark: "following", auth: true, maxRounds: 1 },
];

/** Every database request is answered this many milliseconds late. */
export const DB_DELAY_MS = 120;
