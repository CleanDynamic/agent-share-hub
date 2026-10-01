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

/** The fixture's pre-formatted relative time ("3 days ago", "yesterday", "4 months ago") as whole days. */
function daysAgo(confirmed: string | null): number | null {
  if (!confirmed) return null;
  if (confirmed === "yesterday") return 1;
  const match = /^(\d+) (day|week|month)s? ago$/.exec(confirmed);
  if (!match) return null;
  const n = Number(match[1]);
  return match[2] === "day" ? n : match[2] === "week" ? n * 7 : n * 31;
}

/**
 * A fixture build as the plaque and the picture lamp read it: the pre-formatted
 * "3 days ago" turned back into the timestamps the real record carries, against
 * `FIXTURE_NOW`, so a catalogue card computes its lamp and its freshness line
 * the way the live card does. "4 months ago" lands past STALE_AFTER_DAYS.
 */
export function fixturePlaque(build: FixtureBuild): {
  reproduction_count: number;
  rebuild_count: number;
  last_confirmed_at: string | null;
  last_confirmed_model: string | null;
  published_at: string;
} {
  const days = daysAgo(build.confirmed);
  const at = (d: number) => new Date(FIXTURE_NOW.getTime() - d * 86_400_000).toISOString();
  return {
    reproduction_count: build.reproduction_count,
    rebuild_count: 0,
    last_confirmed_at: days === null ? null : at(days),
    last_confirmed_model: days === null ? null : build.last_confirmed_model,
    published_at: at((days ?? 0) + 30),
  };
}

export default fixtures;
