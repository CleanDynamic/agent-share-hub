// SV-22 P1: briefs. A brief is a published build marked `is_brief` whose gaps (`build_nodes.is_gap`) are open steps; its answers are
// its rebuilds (`parent_build_id`, the rows `listRebuilds` reads).
//
// TWO ROUNDS FOR A PAGE, NONE IN A LOOP: the briefs, then together every brief's answers (one request for the page) and every
// brief's open-step count. `listRebuilds` would answer for one brief; asked per brief it would be a request each.
//
// THE COLUMN MAY NOT BE THERE YET. Before the migration is applied the tab reads "no briefs" and marking one says so, when the
// error's code says the column is missing (`isMissingColumn`, never its words).

import { supabase } from "@/integrations/supabase/client";
import { publishBuild, type PublishTarget } from "@/lib/build/publish";
import { updateBuild } from "@/lib/build/builds";
import type { BuildPatch } from "@/lib/build/types";
import { isMissingColumn } from "@/lib/classify/storage";
import { briefRefusal } from "./briefRules";
import { bountyLayerError } from "./types";

/** Briefs per page, and the answers kept of each (the newest). */
export const BRIEFS_PAGE_SIZE = 10;
export const BRIEF_ANSWERS_KEPT = 5;
const ANSWER_ROWS = 100;

export interface BriefAnswerRecord {
  id: string;
  slug: string;
  title: string;
  userId: string;
  handle: string | null;
  runs: number;
  createdAt: string;
}

export interface BriefRecord {
  id: string;
  slug: string;
  title: string;
  maker: string | null;
  publishedAt: string | null;
  openSteps: number;
  /** Every published rebuild counted (up to the read's cap); `answers` holds the newest few. */
  answerCount: number;
  /** How many of those someone has run. */
  reproduced: number;
  answers: BriefAnswerRecord[];
}

export interface BriefsPage {
  briefs: BriefRecord[];
  nextOffset: number | null;
}

interface Query extends PromiseLike<{ data: unknown; error: unknown }> {
  eq(column: string, value: unknown): Query;
  in(column: string, values: readonly unknown[]): Query;
  order(column: string, options: { ascending: boolean }): Query;
  range(from: number, to: number): Query;
  limit(count: number): Query;
  select(columns: string): Query;
  maybeSingle(): PromiseLike<{ data: unknown; error: unknown }>;
}
const table = (name: string) => (supabase as unknown as { from: (name: string) => { select: (columns: string) => Query } }).from(name);

interface BriefRow {
  id: string;
  slug: string;
  title: string;
  published_at: string | null;
  creator: { username: string | null } | { username: string | null }[] | null;
}
interface AnswerRow {
  parent_build_id: string;
  id: string;
  slug: string;
  title: string;
  created_at: string;
  reproduction_count: number | null;
  creator: { id: string; username: string | null } | { id: string; username: string | null }[] | null;
}
const one = <T>(value: T | T[] | null): T | null => (Array.isArray(value) ? (value[0] ?? null) : value);

/** One page of briefs, newest published first, each with its newest answers and its open-step count. */
export async function listBriefs({ offset = 0, limit = BRIEFS_PAGE_SIZE }: { offset?: number; limit?: number } = {}): Promise<BriefsPage> {
  const size = Math.min(Math.max(1, limit), 50);
  const { data, error } = await table("builds")
    .select("id, slug, title, published_at, creator:profiles!builds_creator_id_fkey(username)")
    .eq("is_brief", true)
    .in("status", ["published", "gallery"])
    .order("published_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + size);
  if (error) {
    if (isMissingColumn(error)) return { briefs: [], nextOffset: null };
    throw bountyLayerError("listBriefs", error);
  }
  const all = (data ?? []) as BriefRow[];
  const rows = all.slice(0, size);
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return { briefs: [], nextOffset: null };

  const [answers, gaps] = await Promise.all([
    table("builds")
      .select("parent_build_id, id, slug, title, created_at, reproduction_count, creator:profiles!builds_creator_id_fkey(id, username)")
      .in("parent_build_id", ids)
      .in("status", ["published", "gallery"])
      .order("created_at", { ascending: false })
      .limit(ANSWER_ROWS),
    table("build_nodes").select("build_id").in("build_id", ids).eq("is_gap", true).limit(ids.length * 50),
  ]);
  if (answers.error) throw bountyLayerError("listBriefs (answers)", answers.error);
  if (gaps.error) throw bountyLayerError("listBriefs (steps)", gaps.error);

  const answersOf = new Map<string, AnswerRow[]>();
  for (const row of (answers.data ?? []) as AnswerRow[]) answersOf.set(row.parent_build_id, [...(answersOf.get(row.parent_build_id) ?? []), row]);
  const stepsOf = new Map<string, number>();
  for (const row of (gaps.data ?? []) as { build_id: string }[]) stepsOf.set(row.build_id, (stepsOf.get(row.build_id) ?? 0) + 1);

  return {
    briefs: rows.map((row) => {
      const mine = answersOf.get(row.id) ?? [];
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        maker: one(row.creator)?.username ?? null,
        publishedAt: row.published_at,
        openSteps: stepsOf.get(row.id) ?? 0,
        answerCount: mine.length,
        reproduced: mine.filter((answer) => (answer.reproduction_count ?? 0) > 0).length,
        answers: mine.slice(0, BRIEF_ANSWERS_KEPT).map((answer) => ({
          id: answer.id,
          slug: answer.slug,
          title: answer.title,
          userId: one(answer.creator)?.id ?? "",
          handle: one(answer.creator)?.username ?? null,
          runs: Math.max(0, answer.reproduction_count ?? 0),
          createdAt: answer.created_at,
        })),
      };
    }),
    nextOffset: all.length > size ? offset + size : null,
  };
}

/** Marks a published build as a brief, or takes the mark off. Refused, in words, for a build that cannot be one. */
export async function setBrief(buildId: string, on: boolean): Promise<void> {
  if (on) {
    const [build, gaps] = await Promise.all([
      table("builds").select("id, status, title").eq("id", buildId).maybeSingle(),
      table("build_nodes").select("id").eq("build_id", buildId).eq("is_gap", true).limit(1),
    ]);
    if (build.error) throw bountyLayerError("setBrief", build.error);
    if (gaps.error) throw bountyLayerError("setBrief (steps)", gaps.error);
    const row = build.data as { status: string; title: string | null } | null;
    if (!row) throw new Error("That build could not be found.");
    const refusal = briefRefusal(row, ((gaps.data ?? []) as unknown[]).length);
    if (refusal) throw new Error(refusal);
  }
  try {
    await updateBuild(buildId, { is_brief: on } as unknown as BuildPatch);
  } catch (error) {
    if (isMissingColumn(error)) throw new Error("Briefs are not available yet.");
    throw error;
  }
}

/** Publishes a build and marks it a brief. Publishing goes through `publishBuild`, which refuses a build with no title. */
export async function publishBrief(build: PublishTarget): Promise<void> {
  await publishBuild(build);
  await setBrief(build.id, true);
}
