// SV-22 P3: reviews and the week's goal.
//
// A REVIEW is a published build its maker has put in review (`builds.in_review`): Builds leaves it out (gallery.ts) until the
// maker ends the review, and the people who run it and comment on its parts are the review. A page is two rounds: the builds,
// then together their runs (`build_reproductions`), their step comments (`build_comments` on a part) and their open requests.
//
// THE WEEK'S GOAL is the `weekly-requests-closed` row of `site_challenges` and a count of the requests closed (`status =
// 'solved'`) since Monday 00:00 UTC, the week `weekly.ts` counts by. The count is shown in full, so it is exact.
//
// THE COLUMNS AND THE TABLE MAY NOT BE THERE YET. Reads answer "nothing" when the error's code says so.

import { supabase } from "@/integrations/supabase/client";
import { updateBuild } from "@/lib/build/builds";
import type { BuildPatch } from "@/lib/build/types";
import { weekStartUtc } from "@/lib/progress/weekly";
import { isMissingColumn } from "@/lib/classify/storage";
import { bountyLayerError } from "./types";

export const REVIEWS_PAGE_SIZE = 10;
export const WEEK_GOAL_SLUG = "weekly-requests-closed";
const ROWS = 1000;

const MISSING_TABLE = new Set(["42P01", "PGRST205"]);
const isMissingTable = (error: unknown): boolean => MISSING_TABLE.has(String((error as { code?: unknown } | null)?.code));

interface Query extends PromiseLike<{ data: unknown; error: unknown; count?: number | null }> {
  eq(column: string, value: unknown): Query;
  in(column: string, values: readonly unknown[]): Query;
  gte(column: string, value: unknown): Query;
  not(column: string, operator: string, value: unknown): Query;
  order(column: string, options: { ascending: boolean }): Query;
  range(from: number, to: number): Query;
  limit(count: number): Query;
  maybeSingle(): PromiseLike<{ data: unknown; error: unknown }>;
}
const table = (name: string) =>
  (supabase as unknown as { from: (name: string) => { select: (columns: string, options?: { count: "exact"; head: true }) => Query } }).from(name);

export interface ReviewRecord {
  buildId: string;
  slug: string;
  title: string;
  maker: string | null;
  since: string | null;
  runs: number;
  failed: number;
  stepComments: number;
  requests: number;
}

export interface ReviewsPage {
  reviews: ReviewRecord[];
  nextOffset: number | null;
}

interface BuildRow {
  id: string;
  slug: string;
  title: string;
  in_review_since: string | null;
  creator: { username: string | null } | { username: string | null }[] | null;
}

function tally<T extends { build_id: string }>(rows: readonly T[], keep: (row: T) => boolean = () => true): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) if (keep(row)) out.set(row.build_id, (out.get(row.build_id) ?? 0) + 1);
  return out;
}

/** One page of builds in review, longest in review first. */
export async function listReviews({ offset = 0, limit = REVIEWS_PAGE_SIZE }: { offset?: number; limit?: number } = {}): Promise<ReviewsPage> {
  const size = Math.min(Math.max(1, limit), 50);
  const { data, error } = await table("builds")
    .select("id, slug, title, in_review_since, creator:profiles!builds_creator_id_fkey(username)")
    .eq("in_review", true)
    .in("status", ["published", "gallery"])
    .order("in_review_since", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + size);
  if (error) {
    if (isMissingColumn(error)) return { reviews: [], nextOffset: null };
    throw bountyLayerError("listReviews", error);
  }
  const all = (data ?? []) as BuildRow[];
  const rows = all.slice(0, size);
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return { reviews: [], nextOffset: null };

  const [runs, comments, requests] = await Promise.all([
    table("build_reproductions").select("build_id, worked").in("build_id", ids).limit(ROWS),
    table("build_comments").select("build_id").in("build_id", ids).not("node_id", "is", null).eq("is_hidden", false).limit(ROWS),
    table("bounties").select("build_id").in("build_id", ids).eq("status", "open").limit(ROWS),
  ]);
  for (const [name, result] of [["runs", runs], ["comments", comments], ["requests", requests]] as const) {
    if (result.error) throw bountyLayerError(`listReviews (${name})`, result.error);
  }
  const runRows = (runs.data ?? []) as { build_id: string; worked: boolean }[];
  const runsOf = tally(runRows);
  const failedOf = tally(runRows, (row) => row.worked === false);
  const commentsOf = tally((comments.data ?? []) as { build_id: string }[]);
  const requestsOf = tally((requests.data ?? []) as { build_id: string }[]);

  return {
    reviews: rows.map((row) => {
      const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
      return {
        buildId: row.id,
        slug: row.slug,
        title: row.title,
        maker: creator?.username ?? null,
        since: row.in_review_since,
        runs: runsOf.get(row.id) ?? 0,
        failed: failedOf.get(row.id) ?? 0,
        stepComments: commentsOf.get(row.id) ?? 0,
        requests: requestsOf.get(row.id) ?? 0,
      };
    }),
    nextOffset: all.length > size ? offset + size : null,
  };
}

/** The maker puts a published build in review, or ends the review. Builds shows it again the moment the review ends. */
export async function setInReview(buildId: string, on: boolean, now: Date = new Date()): Promise<void> {
  if (on) {
    const { data, error } = await table("builds").select("status").eq("id", buildId).maybeSingle();
    if (error) throw bountyLayerError("setInReview", error);
    const status = (data as { status: string } | null)?.status;
    if (status !== "published" && status !== "gallery") throw new Error("Publish the build before you put it in review.");
  }
  try {
    await updateBuild(buildId, { in_review: on, in_review_since: on ? now.toISOString() : null } as unknown as BuildPatch);
  } catch (error) {
    if (isMissingColumn(error)) throw new Error("Reviews are not available yet.");
    throw error;
  }
}

export interface WeekGoal {
  closed: number;
  goal: number;
}

/** The site's goal for requests closed this week and how many are. Null while no goal is set (or the table is not there yet). */
export async function getWeekGoal(now: Date = new Date()): Promise<WeekGoal | null> {
  const [challenge, closed] = await Promise.all([
    table("site_challenges").select("goal").eq("slug", WEEK_GOAL_SLUG).maybeSingle(),
    table("bounties").select("id", { count: "exact", head: true }).eq("status", "solved").not("build_id", "is", null).gte("solved_at", weekStartUtc(now).toISOString()),
  ]);
  if (challenge.error) {
    if (isMissingTable(challenge.error)) return null;
    throw bountyLayerError("getWeekGoal", challenge.error);
  }
  const goal = (challenge.data as { goal: number } | null)?.goal;
  if (!goal) return null;
  if (closed.error) throw bountyLayerError("getWeekGoal (count)", closed.error);
  return { closed: closed.count ?? 0, goal };
}
