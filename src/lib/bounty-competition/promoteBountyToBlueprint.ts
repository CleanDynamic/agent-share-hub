import { supabase } from "@/integrations/supabase/client";

/**
 * Clone a fully-solved bounty into a new published blueprint.
 * - Validates bounty.status === 'solved'
 * - Copies content fields, stage_grids, article_body
 * - Duplicates content_blocks and content_collaborators
 * - New blueprint references the original via fork_of_content_id
 */
export async function promoteBountyToBlueprint(
  bountyId: string,
): Promise<{ newBlueprintId: string }> {
  const { data: src, error } = await (supabase as any)
    .from("content_items")
    .select("*")
    .eq("id", bountyId)
    .single();
  if (error) throw error;
  if ((src as any).post_type !== "bounty") {
    throw new Error("Source is not a bounty");
  }
  if ((src as any).bounty_status !== "solved") {
    throw new Error("Bounty must be fully solved before promotion");
  }

  const now = new Date().toISOString();
  const baseTitle = (src as any).title ?? "Untitled";
  const insertPayload: any = {
    creator_id: (src as any).creator_id,
    title: baseTitle,
    description: (src as any).description,
    subtitle: (src as any).subtitle,
    content_type: (src as any).content_type ?? "Workflow Template",
    post_type: "blueprint",
    status: "approved",
    visibility: "public",
    approved_at: now,
    published_at: now,
    difficulty: (src as any).difficulty ?? "Any",
    monetisation_type: (src as any).monetisation_type ?? "free",
    cover_image_url: (src as any).cover_image_url,
    stage_grids: (src as any).stage_grids,
    article_body: (src as any).article_body,
    what_to_expect: (src as any).what_to_expect,
    what_to_expect_blocks: (src as any).what_to_expect_blocks,
    use_instructions: (src as any).use_instructions,
    ai_tools: (src as any).ai_tools ?? [],
    tools_referenced: (src as any).tools_referenced ?? [],
    models_referenced: (src as any).models_referenced ?? [],
    block_types_used: (src as any).block_types_used ?? [],
    topics: (src as any).topics ?? [],
    custom_tags: (src as any).custom_tags ?? [],
    tags: (src as any).tags ?? [],
    fork_of_content_id: bountyId,
    fork_of_creator_id: (src as any).creator_id,
  };

  const { data: created, error: insErr } = await (supabase as any)
    .from("content_items")
    .insert(insertPayload)
    .select("id")
    .single();
  if (insErr) throw insErr;
  const newBlueprintId = (created as any).id as string;

  // Copy content_blocks
  const { data: blocks } = await (supabase as any)
    .from("content_blocks")
    .select(
      "block_type, formatting_type, position, text_content, image_url, image_description, file_name, file_url, external_file_url, file_size_bytes, github_url, sub_blocks, formatting, use_instructions, is_preview",
    )
    .eq("content_id", bountyId)
    .order("position", { ascending: true });
  if ((blocks ?? []).length > 0) {
    const cloned = (blocks as any[]).map((b) => ({
      ...b,
      content_id: newBlueprintId,
    }));
    await (supabase as any).from("content_blocks").insert(cloned as any);
  }

  // Copy collaborators (preserve attribution)
  const { data: collabs } = await (supabase as any)
    .from("content_collaborators")
    .select("collaborator_id, is_primary_author")
    .eq("content_id", bountyId);
  if ((collabs ?? []).length > 0) {
    const cloned = (collabs as any[]).map((c) => ({
      content_id: newBlueprintId,
      collaborator_id: c.collaborator_id,
      is_primary_author: c.is_primary_author,
    }));
    // Insert one at a time so RLS per-row checks pass cleanly
    for (const row of cloned) {
      await (supabase as any)
        .from("content_collaborators")
        .insert(row as any);
    }
  }

  return { newBlueprintId };
}
