import { supabase } from "@/integrations/supabase/client";
import { extractBlockTypes } from "./extractBlockTypes";
import { extractModels, extractTools } from "./extractModelsAndTools";
import { extractStats, type ContentStats } from "./extractStats";
import { countMissingInStageGrids } from "@/lib/bounty/countMissing";
import { recomputeDerivedBio } from "@/lib/profile/recomputeDerivedBio";

/**
 * Run any async extractor with a label. If it throws, log + return `fallback`
 * so a single failure can't block the rest of the recompute.
 */
async function safeRun<T>(
  label: string,
  contentItemId: string,
  fn: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(
      `[recomputeMetadata] ${label} failed for ${contentItemId}:`,
      err
    );
    return fallback;
  }
}

const EMPTY_STATS: ContentStats = {
  wordCount: 0,
  readingMinutes: 1,
  stageCount: 0,
  blockCount: 0,
  connectionCount: 0,
};

/**
 * Master extractor: runs all auto-detectors in parallel and writes the
 * results back to the content_items row. Safe to call repeatedly — it's
 * idempotent and overwrites with freshly-computed values every time.
 *
 * Throws only if the post doesn't exist. Individual extractor failures are
 * swallowed (logged) so partial results still get persisted.
 */
export async function recomputeMetadata(contentItemId: string): Promise<void> {
  if (!contentItemId) throw new Error("recomputeMetadata: missing id");

  // 1. Resolve post_type so we know which extractors to run.
  const { data: row, error: fetchErr } = await supabase
    .from("content_items")
    .select("id, post_type, stage_grids, creator_id")
    .eq("id", contentItemId)
    .maybeSingle();

  if (fetchErr) {
    throw new Error(
      `recomputeMetadata: failed to load post ${contentItemId}: ${fetchErr.message}`
    );
  }
  if (!row) {
    throw new Error(`recomputeMetadata: post ${contentItemId} not found`);
  }

  const postType = (row as { post_type: string | null }).post_type ?? "blueprint";
  const isBlog = postType === "blog";
  const isBounty = postType === "bounty";

  // 2. Run extractors in parallel. Blog posts skip block-type detection.
  const [blockTypes, models, tools, stats] = await Promise.all([
    isBlog
      ? Promise.resolve<string[]>([])
      : safeRun("extractBlockTypes", contentItemId, () =>
          extractBlockTypes(contentItemId)
        , []),
    safeRun("extractModels", contentItemId, () => extractModels(contentItemId), []),
    safeRun("extractTools", contentItemId, () => extractTools(contentItemId), []),
    safeRun(
      "extractStats",
      contentItemId,
      () => extractStats(contentItemId),
      EMPTY_STATS
    ),
  ]);

  // Bounty-only: count missing stages/blocks straight from stage_grids JSONB.
  // Blueprints/blogs naturally end up with 0/0.
  const missing = isBounty
    ? countMissingInStageGrids((row as { stage_grids?: unknown }).stage_grids)
    : { stages: 0, blocks: 0, total: 0 };

  // 3. Build the update payload. For blog posts, force structural counts to 0.
  const payload = {
    block_types_used: blockTypes,
    models_referenced: models,
    tools_referenced: tools,
    word_count: stats.wordCount,
    estimated_reading_minutes: stats.readingMinutes,
    stage_count: isBlog ? 0 : stats.stageCount,
    block_count: isBlog ? 0 : stats.blockCount,
    connection_count: isBlog ? 0 : stats.connectionCount,
    missing_stage_count: missing.stages,
    missing_block_count: missing.blocks,
    last_metadata_recompute_at: new Date().toISOString(),
  };

  // 4. Persist. Cast to any per project convention for dynamic update payloads.
  const { error: updateErr } = await supabase
    .from("content_items")
    .update(payload as any)
    .eq("id", contentItemId);

  if (updateErr) {
    console.error(
      `[recomputeMetadata] update failed for ${contentItemId}:`,
      updateErr
    );
  }

  // Refresh the author's derived bio in the background. Non-blocking.
  const creatorId = (row as { creator_id?: string }).creator_id;
  if (creatorId) {
    void recomputeDerivedBio(creatorId);
  }

  // Refresh the cached canonical export payload. Non-blocking; lazy-imported
  // to avoid a circular dependency with content-detail → results → metadata.
  void import("@/lib/content-detail/recomputeCanonicalPayload")
    .then((m) => m.recomputeCanonicalPayload(contentItemId))
    .catch((err) =>
      console.warn(
        `[recomputeMetadata] canonical payload refresh failed for ${contentItemId}:`,
        err,
      ),
    );
}
