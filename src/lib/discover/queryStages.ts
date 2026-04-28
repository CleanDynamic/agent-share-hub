// Stage search for Discover.
//
// NOTE on schema: stages, blocks, and connections live inside the
// `stage_grids` jsonb column on `content_items`. We fetch matching parent
// blueprints with the same filters Blueprints search uses, then expand each
// parent into one card per stage. Per-stage filters (block types used in this
// stage) are applied client-side after expansion.

import {
  authorFromParent,
  expandGrids,
  fetchParentItems,
  type DiscoverFilterParams,
} from "./queryStageGrids";

export interface StageBlockPreview {
  id: string;
  type: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
}

export interface StageConnectionPreview {
  id: string;
  from_block_id: string;
  to_block_id: string;
  connection_type: string;
}

export interface StageSearchResult {
  stage: {
    id: string;
    name: string;
    gridSpacing: number;
    order: number;
  };
  blocks: StageBlockPreview[];
  connections: StageConnectionPreview[];
  parent: {
    blueprintId: string;
    blueprintTitle: string;
    blueprintSlug: string | null;
  };
  author: {
    id: string;
    name: string;
    handle: string;
    avatarUrl?: string;
  };
  blockTypesUsed: string[];
  blockCount: number;
  connectionCount: number;
  modelsUsed: string[];
}

export interface QueryStagesResult {
  rows: StageSearchResult[];
  total: number;
}

export async function queryStages(
  params: DiscoverFilterParams,
): Promise<QueryStagesResult> {
  const limit = Math.max(1, Math.min(params.limit ?? 20, 100));
  const offset = Math.max(0, params.offset ?? 0);

  const { items, totalParents } = await fetchParentItems(
    { ...params, limit: 25, offset: 0 },
    8,
  );

  const blockTypeFilter = params.blockTypes && params.blockTypes.length
    ? new Set(params.blockTypes.map((t) => t.toLowerCase()))
    : null;

  const q = (params.query ?? "").trim().toLowerCase();
  const all: StageSearchResult[] = [];

  for (const p of items) {
    const { stages, blocks, connections } = expandGrids(p);
    if (stages.length === 0) continue;

    // Group blocks/connections per stage.
    const blocksByStage = new Map<string, typeof blocks>();
    for (const b of blocks) {
      const sid = b.stage_id || "";
      const arr = blocksByStage.get(sid) ?? [];
      arr.push(b);
      blocksByStage.set(sid, arr);
    }
    const blockToStage = new Map<string, string>();
    for (const b of blocks) if (b.stage_id) blockToStage.set(b.id, b.stage_id);

    const connByStage = new Map<string, typeof connections>();
    for (const c of connections) {
      const sid = blockToStage.get(c.from_block_id) ?? blockToStage.get(c.to_block_id);
      if (!sid) continue;
      const arr = connByStage.get(sid) ?? [];
      arr.push(c);
      connByStage.set(sid, arr);
    }

    for (const s of stages) {
      const sBlocks = blocksByStage.get(s.id) ?? [];
      const sConns = connByStage.get(s.id) ?? [];
      const types = Array.from(new Set(sBlocks.map((b) => b.type.toLowerCase())));

      if (blockTypeFilter) {
        const hit = types.some((t) => blockTypeFilter.has(t));
        if (!hit) continue;
      }

      const stageName = s.stage_name || "Untitled stage";
      if (q.length > 0) {
        const inStage = stageName.toLowerCase().includes(q);
        const inParent = (p.title || "").toLowerCase().includes(q);
        if (!inStage && !inParent) continue;
      }

      const modelsUsed = Array.from(
        new Set(
          sBlocks
            .map((b) => {
              const props = (b.properties ?? {}) as Record<string, unknown>;
              return (props.model as string) || (props.modelName as string) || "";
            })
            .filter((m) => m.length > 0),
        ),
      );

      all.push({
        stage: {
          id: s.id,
          name: stageName,
          gridSpacing: s.grid_spacing ?? 20,
          order: s.order_in_document ?? 0,
        },
        blocks: sBlocks.map((b) => ({
          id: b.id,
          type: b.type,
          position_x: b.position_x ?? 0,
          position_y: b.position_y ?? 0,
          width: b.width ?? 200,
          height: b.height ?? 100,
        })),
        connections: sConns.map((c) => ({
          id: c.id,
          from_block_id: c.from_block_id,
          to_block_id: c.to_block_id,
          connection_type: c.connection_type ?? "feeds_into",
        })),
        parent: {
          blueprintId: p.id,
          blueprintTitle: p.title,
          blueprintSlug: p.slug,
        },
        author: authorFromParent(p),
        blockTypesUsed: types,
        blockCount: sBlocks.length,
        connectionCount: sConns.length,
        modelsUsed,
      });
    }
  }

  const total = all.length >= limit ? Math.max(all.length, totalParents) : all.length;
  const rows = all.slice(offset, offset + limit);
  return { rows, total };
}
