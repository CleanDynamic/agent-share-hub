// Shared helpers for querying content_items and expanding the embedded
// `stage_grids` jsonb into stages/blocks/connections for Discover.
//
// The product spec describes "stages" and "blocks" as if they were separate
// tables. In reality, both live as nested objects inside
// `content_items.stage_grids`. We therefore query content_items with the same
// filters Blueprints search uses, and unfold the jsonb client-side.

import { supabase } from "@/integrations/supabase/client";

export interface DiscoverFilterParams {
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

export interface RawGridBlock {
  id: string;
  type: string;
  name?: string;
  stage_id?: string;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  properties?: Record<string, unknown>;
}

export interface RawGridStage {
  id: string;
  stage_name?: string | null;
  grid_spacing?: number;
  order_in_document?: number;
  width_mode?: string;
  height?: number;
}

export interface RawGridConnection {
  id: string;
  from_block_id: string;
  to_block_id: string;
  connection_type?: string;
}

export interface RawStageGrids {
  stages?: Record<string, RawGridStage>;
  blocks?: Record<string, RawGridBlock>;
  connections?: Record<string, RawGridConnection>;
}

export interface ParentItem {
  id: string;
  title: string;
  slug: string | null;
  visibility: string;
  status: string;
  published_at: string | null;
  created_at: string;
  view_count: number;
  comment_count: number;
  stage_grids: RawStageGrids | null;
  models_referenced: string[];
  tools_referenced: string[];
  block_types_used: string[];
  creator_id: string;
  profiles?: {
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

const PARENT_COLUMNS = `
  id, title, slug, visibility, status, published_at, created_at,
  view_count, comment_count, stage_grids,
  models_referenced, tools_referenced, block_types_used,
  creator_id,
  profiles:creator_id ( username, display_name, avatar_url )
` as const;

export function applyParentFilters(
  qb: any,
  params: DiscoverFilterParams,
  isAuthenticated: boolean,
) {
  qb = qb.eq("status", "approved");
  qb = isAuthenticated
    ? qb.in("visibility", ["public", "unlisted"])
    : qb.eq("visibility", "public");

  if (params.postType) qb = qb.eq("post_type", params.postType);

  const q = (params.query ?? "").trim();
  if (q.length > 0) {
    const safe = q.split("%").join("").split(",").join(" ");
    qb = qb.or(`title.ilike.%${safe}%,description.ilike.%${safe}%,use_case.ilike.%${safe}%`);
  }

  if (params.models?.length) qb = qb.overlaps("models_referenced", params.models);
  if (params.tools?.length) qb = qb.overlaps("tools_referenced", params.tools);
  if (params.tags?.length) qb = qb.overlaps("tags", params.tags);
  if (params.domain) qb = qb.eq("domain", params.domain);
  if (params.difficulty) qb = qb.eq("difficulty", params.difficulty);

  if (params.length === "quick") qb = qb.lt("estimated_reading_minutes", 5);
  else if (params.length === "medium")
    qb = qb.gte("estimated_reading_minutes", 5).lte("estimated_reading_minutes", 15);
  else if (params.length === "deep") qb = qb.gt("estimated_reading_minutes", 15);

  if (params.bountyStatus) qb = qb.eq("bounty_status", params.bountyStatus);

  if (params.timeRange && params.timeRange !== "all") {
    const ms: Record<string, number> = {
      "24h": 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      "3months": 90 * 24 * 60 * 60 * 1000,
    };
    const cutoff = new Date(Date.now() - (ms[params.timeRange] ?? 0)).toISOString();
    qb = qb.gte("published_at", cutoff);
  }

  return qb;
}

export function applyParentSort(qb: any, sort: DiscoverFilterParams["sort"]) {
  switch (sort) {
    case "newest":
      return qb.order("created_at", { ascending: false });
    case "engaged":
      return qb
        .order("view_count", { ascending: false, nullsFirst: false })
        .order("comment_count", { ascending: false, nullsFirst: false });
    case "referenced":
    case "recent":
    default:
      return qb.order("published_at", { ascending: false, nullsFirst: false });
  }
}

/**
 * Fetch parent content_items matching the discover filters. Stage- and
 * block-level filters (block types in a stage, etc.) must be applied on the
 * client because they live inside jsonb.
 *
 * We fetch a generous window per page (4× the requested limit) so that after
 * client-side expansion + per-stage / per-block filtering we still have enough
 * rows to display.
 */
export async function fetchParentItems(
  params: DiscoverFilterParams,
  fetchMultiplier = 4,
): Promise<{ items: ParentItem[]; totalParents: number }> {
  const limit = Math.max(1, Math.min(params.limit ?? 20, 100));
  const offset = Math.max(0, params.offset ?? 0);

  const { data: sessionData } = await supabase.auth.getSession();
  const isAuthenticated = !!sessionData?.session;

  let rowsQb = (supabase.from("content_items") as any).select(PARENT_COLUMNS);
  rowsQb = applyParentFilters(rowsQb, params, isAuthenticated);
  rowsQb = applyParentSort(rowsQb, params.sort).range(
    offset,
    offset + limit * fetchMultiplier - 1,
  );

  let countQb = (supabase.from("content_items") as any).select("id", {
    count: "exact",
    head: true,
  });
  countQb = applyParentFilters(countQb, params, isAuthenticated);

  const [rowsRes, countRes] = await Promise.all([rowsQb, countQb]);
  if (rowsRes.error) throw rowsRes.error;
  if (countRes.error) throw countRes.error;

  return {
    items: (rowsRes.data ?? []) as ParentItem[],
    totalParents: countRes.count ?? 0,
  };
}

export function authorFromParent(p: ParentItem) {
  const prof = p.profiles ?? {};
  return {
    id: p.creator_id,
    name: prof.display_name || prof.username || "Anonymous",
    handle: prof.username || "anon",
    avatarUrl: prof.avatar_url ?? undefined,
  };
}

export function expandGrids(p: ParentItem) {
  const grids = (p.stage_grids ?? {}) as RawStageGrids;
  const stages = Object.values(grids.stages ?? {});
  const blocks = Object.values(grids.blocks ?? {});
  const connections = Object.values(grids.connections ?? {});
  return { stages, blocks, connections };
}

/** Best-effort text content extracted from a block's properties. */
export function blockTextHaystack(b: RawGridBlock): string {
  const props = (b.properties ?? {}) as Record<string, unknown>;
  const parts = [
    b.name,
    props.prompt,
    props.userPrompt,
    props.systemPrompt,
    props.placeholder,
    props.code,
    props.text,
    props.body,
    props.content,
    props.modelName,
    props.model,
  ];
  return parts
    .filter((x) => typeof x === "string")
    .join("\n")
    .toLowerCase();
}
