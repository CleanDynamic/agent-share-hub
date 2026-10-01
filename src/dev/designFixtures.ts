/* UI-P01 — the design kit's sample content, typed.

   DEV ONLY. `design/fixtures/sample-data.json` is invented content (names,
   handles, counts, prices, dates) that exists so the compare pages can render a
   view the way the mockup shows it. None of it may reach a production bundle,
   so this module is imported ONLY from `src/dev/**` and `src/pages/dev/**`, and
   those are reached only through the `import.meta.env.DEV` guards in App.tsx.
   `npm run build` followed by a search of `dist/` for `sample-data` is the
   check.

   Vite serves the JSON from the repository root in dev, so the path below
   crosses out of `src/` on purpose. */

import sample from "../../design/fixtures/sample-data.json";

/** A build as the sample data describes it. `build` indices elsewhere in the file point into `builds`. */
export interface FixtureBuild {
  id: string;
  slug: string;
  title: string;
  maker: string;
  reproduction_count: number;
  /** Relative, pre-formatted: "3 days ago". */
  confirmed: string;
  last_confirmed_model: string;
  stale: boolean;
  part_categories: string[];
  cover_sky: number;
  shape: string;
  has_open_gap: boolean;
  open_gap_reward_gbp: number | null;
  rebuilt_from: string | null;
  change_summary: string | null;
}

export interface FixtureViewer {
  handle: string;
  name: string;
  initials: string;
  avatar_hue: number;
  unread: number;
  level: number;
  xp: number;
  xp_next: number;
  track: string;
  streak_days: number;
  streak_best: number;
}

/** The pages' sections are typed by the page that consumes them (UI-P27 to UI-P36), not here. */
type Sections = Omit<typeof sample, "_note" | "now" | "viewer" | "builds">;

export interface DesignFixtures extends Sections {
  now: string;
  viewer: FixtureViewer;
  builds: FixtureBuild[];
}

export const fixtures = sample as unknown as DesignFixtures;

/** The moment the mockups were drawn at. Render relative times against this, never `Date.now()`. */
export const FIXTURE_NOW = new Date(fixtures.now);

export default fixtures;
