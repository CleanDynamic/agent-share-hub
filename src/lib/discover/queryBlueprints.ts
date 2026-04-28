import { supabase } from "@/integrations/supabase/client";
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
  bountyStatus?: "open" | "closed" | "solved";
  timeRange?: "24h" | "week" | "month" | "3months" | "all";
  sort?: "recent" | "engaged" | "referenced" | "newest";
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
  what_to_expect, ai_tools, use_cases, custom_tags,
  bounty_status, bounty_reward_amount,
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

  // Free text — title / description / use_case
  const q = (params.query ?? "").trim();
  if (q.length > 0) {
    const safe = q.split("%").join("").split(",").join(" ");
    qb = qb.or(
      `title.ilike.%${safe}%,description.ilike.%${safe}%,use_case.ilike.%${safe}%`,
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

  if (params.bountyStatus) qb = qb.eq("bounty_status", params.bountyStatus);

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
    author: {
      display_name: author.display_name || author.username || "Anonymous",
      username: author.username || "anon",
      avatar_url: author.avatar_url,
      bio: author.bio,
    },
  };
}

export async function queryBlueprints(
  params: QueryBlueprintsParams,
): Promise<QueryBlueprintsResult> {
  const limit = Math.max(1, Math.min(params.limit ?? 20, 100));
  const offset = Math.max(0, params.offset ?? 0);

  const { data: sessionData } = await supabase.auth.getSession();
  const isAuthenticated = !!sessionData?.session;

  // Rows query.
  let rowsQb = (supabase.from("content_items") as any).select(SELECT_COLUMNS);
  rowsQb = applyFilters(rowsQb, params, isAuthenticated);
  rowsQb = applySort(rowsQb, params.sort).range(offset, offset + limit - 1);

  // Count query.
  let countQb = (supabase.from("content_items") as any).select("id", {
    count: "exact",
    head: true,
  });
  countQb = applyFilters(countQb, params, isAuthenticated);

  const [rowsRes, countRes] = await Promise.all([rowsQb, countQb]);

  if (rowsRes.error) throw rowsRes.error;
  if (countRes.error) throw countRes.error;

  const rows = (rowsRes.data ?? []).map(rowToFeedPost);
  const total = countRes.count ?? rows.length;

  return { rows, total };
}
