import { supabase } from "@/integrations/supabase/client";

/**
 * Canonical 16-type block list. Values returned by extractBlockTypes
 * are filtered against this set so unknown/legacy types are excluded.
 */
export const KNOWN_BLOCK_TYPES = [
  "text",
  "heading",
  "prompt",
  "code",
  "result",
  "image",
  "video",
  "agent",
  "workflow",
  "compare",
  "tool",
  "model",
  "tutorial",
  "resource",
  "note",
  "quote",
] as const;

export type KnownBlockType = (typeof KNOWN_BLOCK_TYPES)[number];

const KNOWN_SET = new Set<string>(KNOWN_BLOCK_TYPES);

/**
 * Scan a content item's blocks and return the unique block types used,
 * sorted alphabetically. Performs a single query.
 *
 * Edge cases:
 *  - No blocks (e.g. blog posts, empty drafts) → returns []
 *  - Unknown legacy block types → filtered out
 *  - Query error → returns []
 */
export async function extractBlockTypes(
  contentItemId: string
): Promise<string[]> {
  if (!contentItemId) return [];

  const { data, error } = await supabase
    .from("content_blocks")
    .select("block_type")
    .eq("content_id", contentItemId);

  if (error || !data || data.length === 0) return [];

  const types = new Set<string>();
  for (const row of data) {
    const t = (row as { block_type: string | null }).block_type;
    if (t && KNOWN_SET.has(t)) types.add(t);
  }

  return Array.from(types).sort();
}
