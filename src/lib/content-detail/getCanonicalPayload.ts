import { supabase } from "@/integrations/supabase/client";
import { getResultsForContentItem } from "@/lib/results";
import type { CanonicalPostPayload, CanonicalProseBlock, CanonicalStage } from "./types";

const STALE_MS = 60_000; // 1 min — recompute if older than this AND not pre-cached fresh

function tipTapToProse(doc: any): CanonicalProseBlock[] {
  if (!doc || typeof doc !== "object") return [];
  const out: CanonicalProseBlock[] = [];
  const visit = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(visit);
    const t = node.type;
    if (t === "paragraph" || /^heading/.test(t)) {
      const text = (node.content ?? [])
        .map((c: any) => (c?.type === "text" ? c.text : ""))
        .join("");
      out.push({ type: t, text, data: node.attrs });
    } else if (t === "stageGrid" || t === "embeddedCanvas") {
      out.push({ type: t, data: node.attrs });
    } else if (Array.isArray(node.content)) {
      node.content.forEach(visit);
    }
  };
  if (Array.isArray(doc.content)) doc.content.forEach(visit);
  return out;
}

function buildStagesFromGrids(stageGrids: any): CanonicalStage[] {
  if (!stageGrids || typeof stageGrids !== "object") return [];
  const stages = stageGrids.stages ?? {};
  const blocks = stageGrids.blocks ?? {};
  const connections = stageGrids.connections ?? {};
  const stageList: CanonicalStage[] = [];
  for (const [sid, sval] of Object.entries(stages)) {
    const stageBlocks: any[] = [];
    for (const [bid, bval] of Object.entries(blocks)) {
      const b = bval as any;
      if (b?.stage_id === sid) {
        stageBlocks.push({
          id: bid,
          type: b.type ?? "unknown",
          position: b.position ?? 0,
          text: b.text_content ?? null,
          formatting: b.formatting ?? null,
          image_url: b.image_url ?? null,
          file_url: b.file_url ?? null,
          file_name: b.file_name ?? null,
          use_instructions: b.use_instructions ?? null,
          sub_blocks: b.sub_blocks ?? null,
          raw: b,
        });
      }
    }
    stageBlocks.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const stageConns: any[] = [];
    for (const [cid, cval] of Object.entries(connections)) {
      const c = cval as any;
      if (c?.stage_id === sid) stageConns.push({ id: cid, ...c });
    }
    const s = sval as any;
    stageList.push({
      id: sid,
      name: s?.name ?? "",
      missingDescription: s?.missing_description ?? null,
      blocks: stageBlocks,
      connections: stageConns,
    });
  }
  return stageList;
}

export async function recomputeCanonicalPayload(postId: string): Promise<CanonicalPostPayload> {
  if (!postId) throw new Error("recomputeCanonicalPayload: missing id");

  const { data: post, error } = await (supabase as any)
    .from("content_items")
    .select("*")
    .eq("id", postId)
    .maybeSingle();
  if (error) throw error;
  if (!post) throw new Error(`Post not found: ${postId}`);

  const [author, results, refRows, contentBlocks] = await Promise.all([
    (supabase as any)
      .from("profiles")
      .select("username, display_name, derived_bio")
      .eq("id", post.creator_id)
      .maybeSingle(),
    getResultsForContentItem(postId).catch(() => []),
    post.blog_referenced_post_ids?.length
      ? (supabase as any)
          .from("content_items")
          .select("id, title, slug")
          .in("id", post.blog_referenced_post_ids)
      : Promise.resolve({ data: [] }),
    (supabase as any)
      .from("content_blocks")
      .select("*")
      .eq("content_id", postId)
      .order("position", { ascending: true }),
  ]);

  const prose = tipTapToProse(post.article_body);
  const stages = buildStagesFromGrids(post.stage_grids);

  // If there are no stage_grids but there are content_blocks, expose them as a
  // single synthetic "stage" so consumers always have a structured surface.
  if (stages.length === 0 && (contentBlocks.data ?? []).length > 0) {
    stages.push({
      id: "default",
      name: "Content",
      blocks: ((contentBlocks.data ?? []) as any[]).map((b) => ({
        id: b.id,
        type: b.block_type,
        position: b.position ?? 0,
        text: b.text_content,
        formatting: b.formatting,
        image_url: b.image_url,
        file_url: b.file_url,
        file_name: b.file_name,
        use_instructions: b.use_instructions,
        sub_blocks: b.sub_blocks,
        raw: b,
      })),
      connections: [],
    });
  }

  const meta: Record<string, any> = {
    id: post.id,
    title: post.title,
    subtitle: post.subtitle,
    description: post.description,
    slug: post.slug,
    post_type: post.post_type,
    content_type: post.content_type,
    difficulty: post.difficulty,
    visibility: post.visibility,
    status: post.status,
    monetisation_type: post.monetisation_type,
    price_gbp: post.price_gbp,
    is_pwyw: post.is_pwyw,
    cover_image_url: post.cover_image_url,
    custom_tags: post.custom_tags ?? [],
    topics: post.topics ?? [],
    tools_referenced: post.tools_referenced ?? [],
    models_referenced: post.models_referenced ?? [],
    block_types_used: post.block_types_used ?? [],
    word_count: post.word_count ?? 0,
    estimated_reading_minutes: post.estimated_reading_minutes ?? null,
    created_at: post.created_at,
    published_at: post.published_at,
    current_version: post.current_version,
  };

  const bountyMeta =
    post.post_type === "bounty"
      ? {
          status: post.bounty_status,
          deadline: post.bounty_deadline,
          reward_type: post.bounty_reward_type,
          reward_amount: post.bounty_reward_amount,
          reward_currency: post.bounty_reward_currency,
          acceptance_criteria: post.bounty_acceptance_criteria,
          missing_stage_count: post.missing_stage_count,
          missing_block_count: post.missing_block_count,
        }
      : undefined;

  let acceptedSolutions: any[] | undefined;
  if (post.post_type === "bounty") {
    const { data: sols } = await (supabase as any)
      .from("content_items")
      .select("id, title, slug, creator_id, status")
      .eq("fork_of_content_id", postId)
      .eq("status", "approved");
    acceptedSolutions = (sols ?? []) as any[];
  }

  const a = (author.data ?? {}) as any;
  const handle = a.username ?? "";
  const payload: CanonicalPostPayload = {
    meta,
    content: {
      prose,
      stages,
      results,
      references: (refRows.data ?? []) as any[],
    },
    bountyMeta,
    acceptedSolutions,
    authorAttribution: {
      name: a.display_name ?? a.username ?? "Anonymous",
      handle,
      derivedBio: a.derived_bio ?? null,
      profileUrl: handle ? `/u/${handle}` : "",
    },
  };

  // Cache on row.
  await (supabase as any)
    .from("content_items")
    .update({ canonical_export_payload: payload as any } as any)
    .eq("id", postId);

  return payload;
}

export async function getCanonicalPayload(postId: string): Promise<CanonicalPostPayload> {
  const { data } = await (supabase as any)
    .from("content_items")
    .select("canonical_export_payload, last_metadata_recompute_at")
    .eq("id", postId)
    .maybeSingle();

  const cached = (data as any)?.canonical_export_payload;
  const recomputedAt = (data as any)?.last_metadata_recompute_at
    ? new Date((data as any).last_metadata_recompute_at).getTime()
    : 0;
  const fresh = cached && Date.now() - recomputedAt < STALE_MS;
  if (fresh) return cached as CanonicalPostPayload;

  return recomputeCanonicalPayload(postId);
}
