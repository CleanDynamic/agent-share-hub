// Block search for Discover.
//
// NOTE on schema: there is no separate `blocks` table or `block_references`
// table in this project. Stage blocks live inside the `stage_grids` jsonb on
// `content_items`. We therefore fetch matching parent blueprints, unfold their
// stage grids, and filter the blocks client-side.
//
// `referenceCount` is approximated as the number of times a block's named
// model/tool appears across the parent's `models_referenced` /
// `tools_referenced` arrays — there is no per-block reference table.

import {
  authorFromParent,
  blockTextHaystack,
  expandGrids,
  fetchParentItems,
  type DiscoverFilterParams,
  type RawGridBlock,
} from "./queryStageGrids";

export interface BlockSearchResult {
  block: {
    id: string;
    type: string;
    name?: string;
    properties: Record<string, unknown>;
    /** Best-effort flattened text preview. */
    content: string;
  };
  parent: {
    blueprintId: string;
    blueprintTitle: string;
    blueprintSlug: string | null;
    stageId: string | null;
    stageName: string;
  };
  author: {
    id: string;
    name: string;
    handle: string;
    avatarUrl?: string;
  };
  referenceCount: number;
}

export interface QueryBlocksResult {
  rows: BlockSearchResult[];
  total: number;
}

function flatTextFor(b: RawGridBlock): string {
  const props = (b.properties ?? {}) as Record<string, unknown>;
  const candidates = [
    props.prompt,
    props.userPrompt,
    props.systemPrompt,
    props.text,
    props.body,
    props.content,
    props.code,
    props.placeholder,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c;
  }
  return "";
}

export async function queryBlocks(
  params: DiscoverFilterParams,
): Promise<QueryBlocksResult> {
  const limit = Math.max(1, Math.min(params.limit ?? 20, 100));
  const offset = Math.max(0, params.offset ?? 0);

  // Pull a wide window of parents so that after client-side expansion and
  // per-block filtering we still produce at least `limit` results.
  const { items, totalParents } = await fetchParentItems(
    { ...params, limit: 25, offset: 0 },
    8,
  );

  const q = (params.query ?? "").trim().toLowerCase();
  const blockTypeFilter = params.blockTypes && params.blockTypes.length
    ? new Set(params.blockTypes.map((t) => t.toLowerCase()))
    : null;

  const all: BlockSearchResult[] = [];

  for (const p of items) {
    const { stages, blocks } = expandGrids(p);
    const stageNameById = new Map<string, string>();
    stages.forEach((s) => {
      stageNameById.set(s.id, s.stage_name || "Untitled stage");
    });

    for (const b of blocks) {
      if (blockTypeFilter && !blockTypeFilter.has(b.type.toLowerCase())) continue;

      if (q.length > 0) {
        const hay = blockTextHaystack(b);
        const inBlock = hay.includes(q);
        const inParent = (p.title || "").toLowerCase().includes(q);
        if (!inBlock && !inParent) continue;
      }

      // Approx referenceCount: how many of this parent's
      // models_referenced / tools_referenced match this block's model/tool.
      const props = (b.properties ?? {}) as Record<string, unknown>;
      const blockModel = (props.model as string) || (props.modelName as string) || "";
      const blockTool = (props.tool as string) || (props.toolName as string) || "";
      let refCount = 0;
      if (blockModel) {
        refCount += (p.models_referenced ?? []).filter(
          (m) => m.toLowerCase() === blockModel.toLowerCase(),
        ).length;
      }
      if (blockTool) {
        refCount += (p.tools_referenced ?? []).filter(
          (t) => t.toLowerCase() === blockTool.toLowerCase(),
        ).length;
      }

      const stageName = (b.stage_id && stageNameById.get(b.stage_id)) || "Stage";

      all.push({
        block: {
          id: b.id,
          type: b.type,
          name: b.name,
          properties: props,
          content: flatTextFor(b),
        },
        parent: {
          blueprintId: p.id,
          blueprintTitle: p.title,
          blueprintSlug: p.slug,
          stageName,
        },
        author: authorFromParent(p),
        referenceCount: refCount,
      });
    }
  }

  // Sort: when sort === "referenced", order by approx refCount; otherwise
  // preserve parent order (already sorted by published_at / view_count).
  if (params.sort === "referenced") {
    all.sort((a, b) => b.referenceCount - a.referenceCount);
  }

  const total = all.length >= limit ? Math.max(all.length, totalParents) : all.length;
  const rows = all.slice(offset, offset + limit);

  return { rows, total };
}
