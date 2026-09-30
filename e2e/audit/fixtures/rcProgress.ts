/* RC-P28a — the phase-6 world: identity and progress.
 *
 * ONE MAKER WITH A RECORD. Maya Okafor (maya.o), the first of rcBuilds.ts's
 * makers, whose five builds already sit in the gallery (rc-build-1, 4, 7, 10
 * and 13), plus a sixth of hers that has gone stale and two drafts. Everything
 * the profile, the progress page and the drafts page say about her is here:
 *
 *   - her four figures (maker_stats): 6 builds, 64 got working by others,
 *     0 rebuilt by others, 1 gap solved;
 *   - her builds' numbers (maker_build_metrics), with one build for each NEEDS
 *     YOU reason: solutions waiting (rc-build-4, the open ask the bounties
 *     board already shows with two answers), a recent run that did not work
 *     (rc-build-10, last confirmed 60 days ago) and not confirmed since
 *     (rc-build-14, 200 days ago);
 *   - level 6 at 1,230 XP (user_progress);
 *   - badges in every tier, earned and not: first-build and solver (common),
 *     founder, proven and keeper (rare) and well-proven (highest) earned;
 *     runner (common), rebuilt (rare), family and fixer (highest) not yet;
 *   - this week's three challenges under way (xp_events since Monday 00:00
 *     UTC): two of three new builds run, a gap solved, a stale build
 *     re-confirmed. The two one-step challenges can only read 0 or 1 of 1, so
 *     under way is 1;
 *   - two drafts in the build workspace, and none in the previous tool (the
 *     legacy clear leaves content_items empty).
 *
 * ONE NEW READER. Noor Haddad (noor.h) joined after the reset: no builds, no
 * XP, no badges, the reset note not yet read in this browser, and the row the
 * sign-up trigger writes (handle_new_user, 20260629162842), whose
 * welcome_xp_shown_at is still null.
 *
 * READ AS ROW-LEVEL SECURITY READS THEM. user_progress, xp_events and
 * user_badges are readable by their owner only (users_read_own_progress,
 * users_read_own_xp_events, user_badges_select_own), so the spec answers them
 * through `ownRows`: a visitor to Maya's profile gets none of her rows.
 *
 * NO REAL USER DATA. Every name, handle and id is invented here.
 */

import { RC_MAKERS } from "./rcBuilds";
import { RC_SOCIAL_BUILDS } from "./rcSocial";

type Row = Record<string, unknown>;

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();
const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

/** Monday 00:00 UTC of this week, where the challenges start counting (lib/progress/weekly.ts). */
const WEEK_START = (() => {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
})();
/** n minutes ago, but never before the week began, so a run early on a Monday still finds the week's events. */
const thisWeek = (n: number) => new Date(Math.max(Date.now() - n * 60_000, WEEK_START)).toISOString();

/** The maker the phase is about. */
export const PHASE6_MAKER = RC_MAKERS[0];

/** A reader who joined after the reset. */
export const PHASE6_NEWCOMER = {
  id: "7a000000-0000-4000-8000-000000000009",
  username: "noor.h",
  display_name: "Noor Haddad",
} as const;

const buildId = (n: number) => `7b000001-0000-4000-8000-${String(n).padStart(12, "0")}`;
const extraId = (n: number, kind: string) => `7e0000${kind}-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** The columns a build row carries beyond the gallery's, so every select finds them. */
const LEDGER_COLUMNS: Row = {
  cost_setup: null,
  cost_monthly: null,
  currency: "GBP",
  time_to_first_result: null,
  like_count: 0,
  comment_count: 0,
  save_count: 0,
  is_hidden: false,
  live_url: null,
  repo_url: null,
  hero_node_id: null,
  forked_from_event_id: null,
  source_content_item_id: null,
  monetisation_type: null,
  price_gbp: null,
  donation_enabled: false,
  solves_node_id: null,
  parent_build_id: null,
  root_build_id: null,
  rebuild_count: 0,
  rebuild_note: null,
  source_title_at_fork: null,
  source_handle_at_fork: null,
};

/** Maya's sixth build: published long ago, last confirmed 200 days ago, so stale. */
const STALE_BUILD: Row = {
  ...LEDGER_COLUMNS,
  id: extraId(14, "01"),
  creator_id: PHASE6_MAKER.id,
  slug: "rc-build-14",
  title: "Receipt photos to an expenses sheet",
  outcome: "Reads a photo of a receipt and adds the line to the month's expenses.",
  shape: "workflow",
  status: "published",
  made_for: ["freelancer"],
  made_with: ["Claude", "Sheets"],
  cover_media_id: null,
  completeness: 80,
  reproduction_count: 3,
  last_confirmed_at: daysAgo(200),
  last_confirmed_model: "sonnet-4",
  published_at: daysAgo(400),
  created_at: daysAgo(402),
  updated_at: daysAgo(200),
  like_count: 2,
  save_count: 1,
  build_nodes: [{ id: extraId(14, "04"), type: "prompt", title: "The prompt", payload: {}, position: 0, is_gap: false }],
  build_media: [],
  bounties: [],
};

/** Maya's two drafts in the build workspace, the one worked on last first. */
const DRAFTS: Row[] = [
  { n: 15, title: "Calendar triage for a two-person studio", completeness: 60, updated: minutesAgo(90) },
  { n: 16, title: "Refund request sorter", completeness: 100, updated: daysAgo(3) },
].map(({ n, title, completeness, updated }) => ({
  ...LEDGER_COLUMNS,
  id: extraId(n, "01"),
  creator_id: PHASE6_MAKER.id,
  slug: `rc-draft-${n}`,
  title,
  outcome: null,
  shape: "workflow",
  status: "draft",
  made_for: [],
  made_with: ["Claude"],
  cover_media_id: null,
  completeness,
  reproduction_count: 0,
  last_confirmed_at: null,
  last_confirmed_model: null,
  published_at: null,
  created_at: daysAgo(10),
  updated_at: updated,
  build_nodes: [],
  build_media: [],
  bounties: [],
}));

/** Every build the phase-6 world holds: the gallery's thirteen, Maya's stale one and her drafts. */
export const PHASE6_BUILDS: Row[] = [...RC_SOCIAL_BUILDS, STALE_BUILD, ...DRAFTS].map((row) => ({
  created_at: row.published_at ?? daysAgo(10),
  updated_at: row.last_confirmed_at ?? row.published_at ?? daysAgo(10),
  ...row,
}));

/** maker_build_metrics(uid) for Maya: one row per published build. */
export const PHASE6_METRICS: Row[] = [
  { build_id: buildId(1), runs: 44, worked: 41, failed_last_30_days: 0, open_bounties: 0, solutions_waiting: 0 },
  { build_id: buildId(4), runs: 13, worked: 12, failed_last_30_days: 0, open_bounties: 1, solutions_waiting: 2 },
  { build_id: buildId(7), runs: 5, worked: 5, failed_last_30_days: 0, open_bounties: 0, solutions_waiting: 0 },
  { build_id: buildId(10), runs: 3, worked: 1, failed_last_30_days: 1, open_bounties: 0, solutions_waiting: 0 },
  { build_id: buildId(13), runs: 2, worked: 2, failed_last_30_days: 0, open_bounties: 0, solutions_waiting: 0 },
  { build_id: extraId(14, "01"), runs: 3, worked: 3, failed_last_30_days: 0, open_bounties: 0, solutions_waiting: 0 },
];

/** maker_stats(uid), by whose figures are asked for. A maker with no record answers zeros. */
export function makerStatsFor(uid: unknown): Row[] {
  if (uid === PHASE6_MAKER.id) {
    return [{ builds: 6, reproductions_received: 64, rebuilds_of_their_work: 0, gaps_solved: 1 }];
  }
  return [{ builds: 0, reproductions_received: 0, rebuilds_of_their_work: 0, gaps_solved: 0 }];
}

/** The profile rows the phase reads, beyond the harness's reader: the maker and the newcomer. */
export const PHASE6_PROFILES: Row[] = [
  {
    ...PHASE6_MAKER,
    avatar_url: null,
    banner_url: null,
    bio: "Builds agents for small support teams, mostly with Claude and n8n.",
    website_url: null,
    location: "Leeds",
    follower_count: 212,
    following_count: 38,
    created_at: "2025-11-04T09:00:00.000Z",
    joined_at: "2025-11-04T09:00:00.000Z",
    is_verified: false,
    level: "builder",
    derived_bio: null,
    last_derived_at: null,
    is_private: false,
    is_trusted_solver: false,
    is_admin: false,
    is_creator: true,
  },
  {
    ...PHASE6_NEWCOMER,
    avatar_url: null,
    banner_url: null,
    bio: null,
    website_url: null,
    location: null,
    follower_count: 0,
    following_count: 0,
    created_at: daysAgo(1),
    joined_at: daysAgo(1),
    is_verified: false,
    level: "reader",
    derived_bio: null,
    last_derived_at: null,
    is_private: false,
    is_trusted_solver: false,
    is_admin: false,
    is_creator: false,
  },
];

/** user_progress, one row a person. The newcomer's is the sign-up trigger's: welcome not yet shown. */
export const PHASE6_PROGRESS: Row[] = [
  { user_id: PHASE6_MAKER.id, xp_total: 1230, level: 6, streak_days: 0, welcome_xp_shown_at: daysAgo(300) },
  { user_id: PHASE6_NEWCOMER.id, xp_total: 0, level: 1, streak_days: 0, welcome_xp_shown_at: null },
];

/** user_badges: Maya's six. The newcomer holds none: founder is for accounts held before the reset. */
export const PHASE6_BADGES: Row[] = [
  ["first-build", "common", 250],
  ["solver", "common", 2],
  ["founder", "rare", 330],
  ["proven", "rare", 200],
  ["keeper", "rare", 1],
  ["well-proven", "highest", 40],
].map(([badge_key, tier, age], n) => ({
  id: `7d000000-0000-4000-8000-${String(n + 1).padStart(12, "0")}`,
  user_id: PHASE6_MAKER.id,
  badge_key,
  state: "earned",
  earned_at: daysAgo(Number(age)),
  metadata: { tier },
}));

/** xp_events: Maya's week so far, and one older row the week's read must leave out. */
export const PHASE6_XP_EVENTS: Row[] = [
  { reason: "run_reported", source_id: buildId(2), created_at: thisWeek(30), amount: 5 },
  { reason: "run_reported", source_id: buildId(3), created_at: thisWeek(50), amount: 5 },
  { reason: "solution_accepted", source_id: "7c100000-0000-4000-8000-000000000001", created_at: thisWeek(70), amount: 50 },
  { reason: "build_reconfirmed", source_id: buildId(13), created_at: thisWeek(80), amount: 15 },
  { reason: "build_reproduced", source_id: buildId(1), created_at: daysAgo(40), amount: 25 },
].map((row, n) => ({ id: `7f000000-0000-4000-8000-00000000000${n}`, user_id: PHASE6_MAKER.id, metadata: {}, ...row }));
