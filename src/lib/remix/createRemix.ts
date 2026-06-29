import { supabase } from "@/integrations/supabase/client";

/**
 * Create a new draft that remixes an existing post. Copies the source
 * post's content into a new draft owned by the remixer and inserts a
 * `post_lineage` row linking the two.
 *
 * Returns `{ draftId, postType }` so the caller can route into the
 * correct editor mode (blueprint / blog).
 */
export async function createRemix(args: {
  sourcePostId: string;
  remixerId: string;
}): Promise<{ draftId: string; postType: "blueprint" | "blog" | "bounty" }> {
  const { sourcePostId, remixerId } = args;

  // Fetch the source post
  const { data: src, error: srcErr } = await (supabase as any)
    .from("content_items")
    .select("*")
    .eq("id", sourcePostId)
    .single();
  if (srcErr || !src) throw srcErr ?? new Error("Source post not found");
  if (!src.is_remixable) throw new Error("This post does not allow remixing.");

  const postType: "blueprint" | "blog" | "bounty" =
    src.post_type === "blog" ? "blog" : src.post_type === "bounty" ? "bounty" : "blueprint";

  // Clone a minimal set of fields into a new draft
  const draftPayload: any = {
    creator_id: remixerId,
    title: `Remix of: ${src.title || "Untitled"}`,
    post_type: postType,
    content_type: src.content_type ?? "Prompt(s)",
    description: src.description ?? null,
    difficulty: src.difficulty ?? "Beginner",
    ai_tools: src.ai_tools ?? [],
    use_cases: src.use_cases ?? [],
    use_instructions: src.use_instructions ?? null,
    what_to_expect: src.what_to_expect ?? null,
    what_to_expect_blocks: src.what_to_expect_blocks ?? null,
    custom_tags: src.custom_tags ?? [],
    tags: src.tags ?? [],
    topics: src.topics ?? [],
    article_body: src.article_body ?? null,
    stage_grids: src.stage_grids ?? null,
    monetisation_type: "free",
    donation_enabled: false,
    is_remixable: true,
    status: "draft",
    draft_saved_at: new Date().toISOString(),
    draft_name: `Remix of ${src.title || "Untitled"}`.slice(0, 100),
  };

  const { data: draft, error: insErr } = await (supabase as any)
    .from("content_items")
    .insert(draftPayload)
    .select("id")
    .single();
  if (insErr || !draft) throw insErr ?? new Error("Could not create remix draft");

  // Resolve the root: if the source itself is already a remix, inherit its root.
  const { data: parentLineage } = await (supabase as any)
    .from("post_lineage")
    .select("root_post_id")
    .eq("post_id", sourcePostId)
    .maybeSingle();
  const rootPostId = parentLineage?.root_post_id ?? sourcePostId;

  const { error: lineageErr } = await (supabase as any)
    .from("post_lineage")
    .insert({
      post_id: draft.id,
      parent_post_id: sourcePostId,
      root_post_id: rootPostId,
    });
  if (lineageErr) {
    // Roll back the draft so the user isn't left with an orphan
    await (supabase as any).from("content_items").delete().eq("id", draft.id);
    throw lineageErr;
  }

  return { draftId: draft.id as string, postType };
}
