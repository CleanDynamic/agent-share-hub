import { supabase } from "@/integrations/supabase/client";
import { resolveLegacyItemsByBounty } from "@/lib/bounty/resolveLegacy";
import type { FeedPost } from "@/components/feed-card";

export interface QueryBlueprintsParams {
  query?: string;
  postType?: "blueprint" | "blog" | "bounty";
  blockTypes?: string[];
  models?: string[];
  tools?: string[];
  tags?: string[];
  domain?: string;
  difficulty?: string;
  length?: "quick" | "medium" | "deep";
  bountyStatus?: "Open" | "Closed" | "Solved" | "Partially-solved" | "open" | "closed" | "solved";
  bountyRewardType?: "Cash" | "Token" | "Kudos" | "None";
  bountyHasUnsolvedSlots?: boolean;
  bountyHealthScore?: "High" | "Medium" | "Low";
  timeRange?: "24h" | "week" | "month" | "3months" | "all";
  sort?: "recent" | "engaged" | "referenced" | "newest";
  // When true, hint to the search backend that bounties matching the searcher's
  // profile-derived specialty get a small ranking boost.
  specialtyBoostTags?: string[];
  limit?: number;
  offset?: number;
}

export interface QueryBlueprintsResult {
  rows: FeedPost[];
  total: number;
}

const SELECT_COLUMNS = `
  id, title, description, content_type, post_type, cover_image_url,
  created_at, published_at, view_count, comment_count, download_count,
  what_to_expect, ai_tools, use_cases, custom_tags, tags,
  bounty_status, bounty_reward_amount, bounty_reward_type, bounty_reward_currency,
  bounty_total_slots, bounty_solved_count, bounty_active_solvers,
  bounty_deadline, bounty_health_score, bounty_is_meta,
  bounty_acceptance_criteria,
  creator_id,
  profiles:creator_id ( username, display_name, avatar_url, bio )
` as const;

function applyFilters(qb: any, params: QueryBlueprintsParams, isAuthenticated: boolean) {
  // Status: only approved (== "published" in product terms).
  qb = qb.eq("status", "approved");

  // Visibility: public always, unlisted if signed in.
  if (isAuthenticated) {
    qb = qb.in("visibility", ["public", "unlisted"]);
  } else {
    qb = qb.eq("visibility", "public");
  }

  if (params.postType) {
    qb = qb.eq("post_type", params.postType);
  }

  // Free text — title / description / use_case, plus bounty-specific text
  // (acceptance_criteria) so searches surface bounty content when the user is
  // looking for criteria phrasing. Slot descriptions and sub-bounty definitions
  // are matched by a separate scope below.
  const q = (params.query ?? "").trim();
  if (q.length > 0) {
    const safe = q.split("%").join("").split(",").join(" ");
    qb = qb.or(
      [
        `title.ilike.%${safe}%`,
        `description.ilike.%${safe}%`,
        `use_case.ilike.%${safe}%`,
        `bounty_acceptance_criteria.ilike.%${safe}%`,
      ].join(","),
    );
  }

  // Array overlap filters.
  if (params.blockTypes && params.blockTypes.length > 0) {
    qb = qb.overlaps("block_types_used", params.blockTypes);
  }
  if (params.models && params.models.length > 0) {
    qb = qb.overlaps("models_referenced", params.models);
  }
  if (params.tools && params.tools.length > 0) {
    qb = qb.overlaps("tools_referenced", params.tools);
  }
  if (params.tags && params.tags.length > 0) {
    qb = qb.overlaps("tags", params.tags);
  }

  if (params.domain) qb = qb.eq("domain", params.domain);
  if (params.difficulty) qb = qb.eq("difficulty", params.difficulty);

  // Reading-length buckets.
  if (params.length === "quick") {
    qb = qb.lt("estimated_reading_minutes", 5);
  } else if (params.length === "medium") {
    qb = qb.gte("estimated_reading_minutes", 5).lte("estimated_reading_minutes", 15);
  } else if (params.length === "deep") {
    qb = qb.gt("estimated_reading_minutes", 15);
  }

  // Bounty status — accept both "Open" / "open" / "Partially-solved" forms.
  if (params.bountyStatus) {
    const norm = String(params.bountyStatus).toLowerCase();
    if (norm === "partially-solved" || norm === "partially solved") {
      // No dedicated status — model as open with at least one solved slot.
      qb = qb.eq("bounty_status", "open").gt("bounty_solved_count", 0);
    } else {
      qb = qb.eq("bounty_status", norm);
    }
  }

  // Reward type filter (Cash / Token / Kudos / None).
  if (params.bountyRewardType) {
    const rt = params.bountyRewardType.toLowerCase();
    if (rt === "none") {
      // either explicit "none" or no reward type recorded.
      qb = qb.or("bounty_reward_type.is.null,bounty_reward_type.eq.none");
    } else {
      qb = qb.eq("bounty_reward_type", rt);
    }
  }

  // Has unsolved slots: total > solved when true; total <= solved when false.
  if (params.bountyHasUnsolvedSlots === true) {
    qb = qb.gt("bounty_total_slots", 0);
    // Treat "unsolved" as solved < total.
    qb = qb.filter("bounty_solved_count", "lt", "bounty_total_slots" as any);
  } else if (params.bountyHasUnsolvedSlots === false) {
    qb = qb.filter("bounty_solved_count", "gte", "bounty_total_slots" as any);
  }

  // Health score buckets: high ≥ 0.7, medium 0.4–0.7, low < 0.4.
  if (params.bountyHealthScore) {
    const h = params.bountyHealthScore.toLowerCase();
    if (h === "high") qb = qb.gte("bounty_health_score", 0.7);
    else if (h === "medium")
      qb = qb.gte("bounty_health_score", 0.4).lt("bounty_health_score", 0.7);
    else if (h === "low") qb = qb.lt("bounty_health_score", 0.4);
  }

  // Time range — based on published_at.
  if (params.timeRange && params.timeRange !== "all") {
    const now = Date.now();
    const ms: Record<string, number> = {
      "24h": 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      "3months": 90 * 24 * 60 * 60 * 1000,
    };
    const cutoff = new Date(now - (ms[params.timeRange] ?? 0)).toISOString();
    qb = qb.gte("published_at", cutoff);
  }

  return qb;
}

function applySort(qb: any, sort: QueryBlueprintsParams["sort"]) {
  switch (sort) {
    case "newest":
      return qb.order("created_at", { ascending: false });
    case "engaged":
      // No engagement_score column — fall back to view_count then comment_count.
      return qb
        .order("view_count", { ascending: false, nullsFirst: false })
        .order("comment_count", { ascending: false, nullsFirst: false });
    case "referenced":
      // No reference_count column — fall back to recent.
      return qb.order("published_at", { ascending: false, nullsFirst: false });
    case "recent":
    default:
      return qb.order("published_at", { ascending: false, nullsFirst: false });
  }
}

function rowToFeedPost(row: any): FeedPost {
  const author = (row.profiles ?? {}) as {
    username?: string;
    display_name?: string;
    avatar_url?: string;
    bio?: string;
  };
  const isBounty = (row.post_type ?? null) === "bounty";
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    content_type: row.content_type ?? "Blueprint",
    post_type: row.post_type ?? null,
    cover_image_url: row.cover_image_url ?? undefined,
    created_at: row.published_at ?? row.created_at,
    view_count: row.view_count ?? 0,
    comment_count: row.comment_count ?? 0,
    download_count: row.download_count ?? 0,
    what_to_expect: row.what_to_expect ?? undefined,
    ai_tools: row.ai_tools ?? [],
    use_cases: row.use_cases ?? [],
    custom_tags: row.custom_tags ?? [],
    bounty_enabled: isBounty || (row.bounty_reward_amount ?? 0) > 0,
    bounty_amount: row.bounty_reward_amount ?? null,
    bounty_status: row.bounty_status ?? null,
    bounty_reward_type: row.bounty_reward_type ?? null,
    bounty_reward_currency: row.bounty_reward_currency ?? null,
    bounty_total_slots: row.bounty_total_slots ?? 0,
    bounty_solved_count: row.bounty_solved_count ?? 0,
    bounty_active_solvers: row.bounty_active_solvers ?? 0,
    bounty_deadline: row.bounty_deadline ?? null,
    bounty_health_score: row.bounty_health_score ?? null,
    bounty_is_meta: !!row.bounty_is_meta,
    author: {
      display_name: author.display_name || author.username || "Anonymous",
      username: author.username || "anon",
      avatar_url: author.avatar_url,
      bio: author.bio,
    },
  };
}

/**
 * For free-text queries that target bounties (or all post types), also match
 * meta-bounty sub-definition titles/descriptions and return the parent
 * meta-bounty content_item ids so the main query can OR-include them.
 *
 * Slot descriptions for non-meta bounties live in `bounty_acceptance_criteria`
 * and are already covered by the main free-text predicate.
 */
async function expandBountySearchIds(
  params: QueryBlueprintsParams,
): Promise<string[]> {
  const q = (params.query ?? "").trim();
  if (q.length === 0) return [];
  // Don't waste a round-trip when filters already exclude bounties.
  if (params.postType && params.postType !== "bounty") return [];

  const safe = q.split("%").join("").split(",").join(" ");
  // NS-P50. meta_bounty_id has been a public.bounties id since NS-P48, and the
  // caller OR-includes what this returns into a content_items id filter, so the
  // matched headers are mapped back to the content_items ids they name. Two
  // round trips instead of one, and the second is an indexed lookup on at most
  // 200 ids.
  const { data } = await (supabase as any)
    .from("meta_bounty_sub_definitions")
    .select("meta_bounty_id")
    .or(`title.ilike.%${safe}%,description.ilike.%${safe}%`)
    .limit(200);

  const bountyIds = Array.from(
    new Set(((data ?? []) as any[]).map((r) => r.meta_bounty_id).filter(Boolean)),
  ) as string[];
  if (bountyIds.length === 0) return [];

  const legacyIds = await resolveLegacyItemsByBounty(bountyIds);
  return Array.from(
    new Set([...legacyIds.values()].filter(Boolean) as string[]),
  );
}

/**
 * Apply a small ranking boost for bounties whose tags overlap the searcher's
 * profile-derived specialty tags. We re-sort the page in-memory so we don't
 * mutate the canonical sort for non-bounty rows.
 */
function applySpecialtyBoost(rows: FeedPost[], boostTags: string[] | undefined): FeedPost[] {
  if (!boostTags || boostTags.length === 0) return rows;
  const boostSet = new Set(boostTags.map((t) => t.toLowerCase()));
  return [...rows].sort((a, b) => {
    const aIsBounty = (a.post_type ?? "") === "bounty";
    const bIsBounty = (b.post_type ?? "") === "bounty";
    if (!aIsBounty || !bIsBounty) return 0;
    const aScore = (a.custom_tags ?? []).some((t) => boostSet.has(String(t).toLowerCase())) ? 1 : 0;
    const bScore = (b.custom_tags ?? []).some((t) => boostSet.has(String(t).toLowerCase())) ? 1 : 0;
    return bScore - aScore;
  });
}

export async function queryBlueprints(
  params: QueryBlueprintsParams,
): Promise<QueryBlueprintsResult> {
  const limit = Math.max(1, Math.min(params.limit ?? 20, 100));
  const offset = Math.max(0, params.offset ?? 0);

  const { data: sessionData } = await supabase.auth.getSession();
  const isAuthenticated = !!sessionData?.session;

  // Optional: extend free-text matching to meta-bounty sub-definitions.
  const extraIds = await expandBountySearchIds(params);

  // Rows query.
  let rowsQb = (supabase.from("content_items") as any).select(SELECT_COLUMNS);
  rowsQb = applyFilters(rowsQb, params, isAuthenticated);
  if (extraIds.length > 0) {
    // Union: keep predicate-matched rows AND rows whose id is in extraIds.
    rowsQb = rowsQb.or(`id.in.(${extraIds.join(",")})`);
  }
  rowsQb = applySort(rowsQb, params.sort).range(offset, offset + limit - 1);

  // Count query.
  let countQb = (supabase.from("content_items") as any).select("id", {
    count: "exact",
    head: true,
  });
  countQb = applyFilters(countQb, params, isAuthenticated);
  if (extraIds.length > 0) {
    countQb = countQb.or(`id.in.(${extraIds.join(",")})`);
  }

  const [rowsRes, countRes] = await Promise.all([rowsQb, countQb]);

  if (rowsRes.error) throw rowsRes.error;
  if (countRes.error) throw countRes.error;

  const rawRows = (rowsRes.data ?? []).map(rowToFeedPost);
  const rows = applySpecialtyBoost(rawRows, params.specialtyBoostTags);
  const total = countRes.count ?? rows.length;

  return { rows, total };
}
