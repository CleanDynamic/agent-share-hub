// RC-P27 — this week's challenges, and how far the reader has come on each.
//
// THE THREE ARE THE CATALOGUE OF XP-DESIGN.md › Challenges, held here as well
// as in 20261001260000_rc_badge_catalogue.sql, whose public.challenges table
// is not live yet (Deploy queue item 17): a page that read it would show an
// error until it is. weekly.test.ts holds the three copies together, title
// for title and criterion for criterion, the way badgeCatalogue.test.ts holds
// the badges.
//
// PROGRESS IS COUNTED FROM THE XP LEDGER, because each challenge is one of
// the ledger's reasons (the migration's criteria name them): run_reported,
// solution_accepted and build_reconfirmed. The database writes each at most
// once per build or solution, so a row is a build run for the first time, a
// solution accepted, a stale build confirmed again. One request, at most 100
// rows, for all three.
//
// THE WEEK starts on Monday at 00:00 UTC, date_trunc('week', now()) in the
// database's UTC, the clock its daily caps already count by.
//
// AT MOST THREE ⟦hicks-law › Budgets⟧: the page never shows a fourth.

import { supabase } from "@/integrations/supabase/client";
import { progressFailure } from "./errors";

/** An xp_events reason a weekly challenge counts. */
export type ChallengeEvent = "run_reported" | "solution_accepted" | "build_reconfirmed";

export interface WeeklyChallenge {
  /** public.challenges.slug. */
  slug: string;
  /** XP-DESIGN.md's words. */
  title: string;
  /** The ledger's reason that counts toward it. */
  event: ChallengeEvent;
  /** How many make it done. */
  count: number;
}

/** The most challenges the page shows at once ⟦hicks-law › Budgets⟧. */
export const WEEKLY_CHALLENGE_LIMIT = 3;

/** XP-DESIGN.md › Challenges, in its order. */
export const WEEKLY_CHALLENGES: readonly WeeklyChallenge[] = [
  { slug: "run-three-new", title: "Run three builds you haven't run before", event: "run_reported", count: 3 },
  { slug: "solve-a-gap", title: "Solve a gap", event: "solution_accepted", count: 1 },
  { slug: "reconfirm-stale", title: "Re-confirm one of your stale builds", event: "build_reconfirmed", count: 1 },
];

/** The most ledger rows one week's read returns; every challenge is done long before. */
export const WEEK_EVENTS_LIMIT = 100;

/** One ledger row, as much of it as the challenges need. */
export interface WeekEvent {
  reason: string;
  source_id: string | null;
  created_at: string;
}

/** How far one challenge has come: done, out of target. */
export interface ChallengeProgress {
  challenge: WeeklyChallenge;
  done: number;
  target: number;
}

/** Monday 00:00 UTC of the week that holds `now`. */
export function weekStartUtc(now: Date): Date {
  const sinceMonday = (now.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - sinceMonday));
}

/**
 * Each challenge's progress this week: the distinct builds or solutions its
 * reason names since the week began, never more than its count. At most
 * WEEKLY_CHALLENGE_LIMIT challenges.
 */
export function weeklyProgress(
  events: readonly WeekEvent[],
  now: Date,
  challenges: readonly WeeklyChallenge[] = WEEKLY_CHALLENGES,
): ChallengeProgress[] {
  const since = weekStartUtc(now).getTime();
  const thisWeek = events.filter((event) => Date.parse(event.created_at) >= since);
  return challenges.slice(0, WEEKLY_CHALLENGE_LIMIT).map((challenge) => {
    const sources = new Set(
      thisWeek
        .filter((event) => event.reason === challenge.event)
        .map((event, index) => event.source_id ?? `unnamed-${index}`),
    );
    return { challenge, done: Math.min(sources.size, challenge.count), target: challenge.count };
  });
}

/** The reader's ledger rows for the challenges' reasons since this week began. */
export async function getMyWeekEvents(userId: string, now: Date = new Date()): Promise<WeekEvent[]> {
  const reasons = [...new Set(WEEKLY_CHALLENGES.map((challenge) => challenge.event))];
  const response = await supabase
    .from("xp_events")
    .select("reason, source_id, created_at")
    .eq("user_id", userId)
    .in("reason", reasons)
    .gte("created_at", weekStartUtc(now).toISOString())
    .order("created_at", { ascending: false })
    .limit(WEEK_EVENTS_LIMIT);
  if (response.error) throw progressFailure("getMyWeekEvents", userId, response);
  return (response.data ?? []) as WeekEvent[];
}
