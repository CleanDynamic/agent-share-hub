import { supabase } from "@/integrations/supabase/client";

export interface ContentStats {
  wordCount: number;
  readingMinutes: number;
  stageCount: number;
  blockCount: number;
  connectionCount: number;
}

const WORDS_PER_MINUTE = 220;

/** Recursively collect every string leaf in any JSON value. */
function collectStrings(node: unknown, out: string[]): void {
  if (node == null) return;
  if (typeof node === "string") {
    if (node.trim()) out.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectStrings(item, out);
    return;
  }
  if (typeof node === "object") {
    for (const v of Object.values(node as Record<string, unknown>)) {
      collectStrings(v, out);
    }
  }
}

/** Whitespace-split word count over a list of text fragments. */
function countWords(fragments: string[]): number {
  let total = 0;
  for (const f of fragments) {
    const tokens = f.trim().split(/\s+/);
    if (tokens.length === 1 && tokens[0] === "") continue;
    total += tokens.length;
  }
  return total;
}

/**
 * Pull the candidate text fields out of a single content_blocks row.
 * The `formatting` jsonb varies by block_type, so we sample the well-known
 * keys (prompt/systemPrompt/code/body/text) plus text_content as a fallback.
 */
function blockTextFragments(row: {
  text_content: string | null;
  formatting: Record<string, unknown> | null;
}): string[] {
  const out: string[] = [];
  const fmt = (row.formatting ?? {}) as Record<string, unknown>;
  for (const key of ["prompt", "systemPrompt", "code", "body", "text"]) {
    const v = fmt[key];
    if (typeof v === "string" && v.trim()) out.push(v);
  }
  if (row.text_content && row.text_content.trim()) out.push(row.text_content);
  return out;
}

/**
 * Pull text fragments out of a Stage Grid block descriptor.
 * Stage Grid blocks live inside content_items.stage_grids.blocks[*].properties
 * with shape varying by type (richText, userPrompt, code, …).
 */
function stageBlockTextFragments(block: Record<string, unknown>): string[] {
  const out: string[] = [];
  const props = (block.properties ?? {}) as Record<string, unknown>;
  for (const key of [
    "richText",
    "userPrompt",
    "systemPrompt",
    "prompt",
    "code",
    "body",
    "text",
    "caption",
  ]) {
    const v = props[key];
    if (typeof v === "string" && v.trim()) out.push(v);
    else if (v && typeof v === "object") collectStrings(v, out);
  }
  if (typeof block.name === "string" && block.name.trim()) out.push(block.name);
  return out;
}

/**
 * Compute stats for a single post.
 *
 * Two parallel Supabase reads:
 *   1. content_items (article_body + stage_grids)
 *   2. content_blocks rows for this post
 * Counts (stage / block / connection) are derived from stage_grids since
 * this project has no separate stages / blocks / block_connections tables.
 */
export async function extractStats(
  contentItemId: string
): Promise<ContentStats> {
  const empty: ContentStats = {
    wordCount: 0,
    readingMinutes: 1,
    stageCount: 0,
    blockCount: 0,
    connectionCount: 0,
  };
  if (!contentItemId) return empty;

  const [itemRes, blocksRes] = await Promise.all([
    supabase
      .from("content_items")
      .select("article_body, stage_grids")
      .eq("id", contentItemId)
      .maybeSingle(),
    supabase
      .from("content_blocks")
      .select("text_content, formatting")
      .eq("content_id", contentItemId),
  ]);

  const item = itemRes.data as
    | { article_body: unknown | null; stage_grids: unknown | null }
    | null;
  const blockRows =
    (blocksRes.data as Array<{
      text_content: string | null;
      formatting: Record<string, unknown> | null;
    }> | null) ?? [];

  const fragments: string[] = [];

  // 1. Article body prose (TipTap JSON).
  if (item?.article_body) collectStrings(item.article_body, fragments);

  // 2. Document-level content_blocks text.
  for (const row of blockRows) fragments.push(...blockTextFragments(row));

  // 3. Stage Grid stages/blocks/connections.
  let stageCount = 0;
  let stageBlockCount = 0;
  let connectionCount = 0;

  const sg = (item?.stage_grids ?? null) as Record<string, unknown> | null;
  if (sg) {
    const stages = (sg.stages ?? {}) as Record<string, unknown>;
    const blocks = (sg.blocks ?? {}) as Record<string, unknown>;
    const connections = (sg.connections ?? {}) as Record<string, unknown>;
    stageCount = Object.keys(stages).length;
    stageBlockCount = Object.keys(blocks).length;
    connectionCount = Object.keys(connections).length;

    for (const block of Object.values(blocks)) {
      if (block && typeof block === "object") {
        fragments.push(
          ...stageBlockTextFragments(block as Record<string, unknown>)
        );
      }
    }
  }

  const wordCount = countWords(fragments);
  const readingMinutes = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));

  return {
    wordCount,
    readingMinutes,
    stageCount,
    // Total addressable blocks = document blocks + spatial stage-grid blocks.
    blockCount: blockRows.length + stageBlockCount,
    connectionCount,
  };
}
