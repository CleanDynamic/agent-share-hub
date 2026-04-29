/**
 * Counts stages and blocks marked as `is_missing` inside a content_items
 * `stage_grids` JSONB blob.
 *
 * The shape mirrors the document store and the server-side trigger
 * `validate_bounty_publish`:
 *   { stages: { [id]: { is_missing?: boolean, ... } },
 *     blocks: { [id]: { is_missing?: boolean, ... } } }
 *
 * Returns { stages, blocks, total }. Resilient to null / unexpected shapes —
 * any non-object input yields zero counts.
 */
export interface MissingCounts {
  stages: number;
  blocks: number;
  total: number;
}

const ZERO: MissingCounts = { stages: 0, blocks: 0, total: 0 };

export function countMissingInStageGrids(stageGrids: unknown): MissingCounts {
  if (!stageGrids || typeof stageGrids !== "object") return ZERO;
  const root = stageGrids as Record<string, unknown>;

  const countMap = (m: unknown): number => {
    if (!m || typeof m !== "object") return 0;
    let n = 0;
    for (const v of Object.values(m as Record<string, unknown>)) {
      if (v && typeof v === "object" && (v as { is_missing?: boolean }).is_missing) {
        n += 1;
      }
    }
    return n;
  };

  const stages = countMap(root.stages);
  const blocks = countMap(root.blocks);
  return { stages, blocks, total: stages + blocks };
}
