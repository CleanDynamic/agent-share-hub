import { supabase } from "@/integrations/supabase/client";
import type { EmbeddedOriginal, Reblog, ReblogFull, RebloggerProfile } from "./types";
import { checkExcerptStillValid } from "./checkExcerptStillValid";

const PROFILE_COLS = "id, username, display_name, avatar_url";

async function loadReblogger(userId: string): Promise<RebloggerProfile | null> {
  const { data } = await (supabase.from("profiles") as any)
    .select(PROFILE_COLS)
    .eq("id", userId)
    .maybeSingle();
  return (data as RebloggerProfile) ?? null;
}

async function loadEmbeddedOriginal(postId: string): Promise<EmbeddedOriginal | null> {
  const { data } = await (supabase.from("content_items") as any)
    .select("id, title, slug, post_type, cover_image_url, creator_id, visibility, status")
    .eq("id", postId)
    .maybeSingle();
  if (!data) {
    return {
      id: postId,
      title: "",
      slug: null,
      post_type: "",
      cover_image_url: null,
      creator_id: "",
      visibility: "private",
      unavailable: true,
      unavailable_reason: "deleted",
      reblogger: null,
    };
  }
  const isPublic = data.visibility === "public" && data.status === "approved";
  return {
    id: data.id,
    title: data.title,
    slug: data.slug,
    post_type: data.post_type,
    cover_image_url: data.cover_image_url,
    creator_id: data.creator_id,
    visibility: data.visibility,
    unavailable: !isPublic,
    unavailable_reason: isPublic ? null : "private",
    reblogger: null,
  };
}

async function loadParentReblog(parentId: string): Promise<Reblog | null> {
  const { data } = await (supabase.from("reblogs") as any)
    .select("*")
    .eq("id", parentId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  const reblogger = await loadReblogger(data.reblogger_id);
  return { ...(data as Reblog), reblogger };
}

async function viewerState(reblogId: string, viewerId?: string | null) {
  if (!viewerId) {
    return { hasLiked: false, hasBookmarked: false, hasReblogged: false };
  }
  const [{ data: likeRow }, { data: bookmarkRow }, { data: reblogOfReblog }] = await Promise.all([
    (supabase.from("reblog_likes") as any)
      .select("reblog_id")
      .eq("reblog_id", reblogId)
      .eq("liker_id", viewerId)
      .maybeSingle(),
    (supabase.from("reblog_bookmarks") as any)
      .select("reblog_id")
      .eq("reblog_id", reblogId)
      .eq("bookmarker_id", viewerId)
      .maybeSingle(),
    (supabase.from("reblogs") as any)
      .select("id")
      .eq("parent_reblog_id", reblogId)
      .eq("reblogger_id", viewerId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);
  return {
    hasLiked: !!likeRow,
    hasBookmarked: !!bookmarkRow,
    hasReblogged: !!reblogOfReblog,
  };
}

export interface GetReblogInput {
  slug: string;
  viewerId?: string | null;
}

export async function getReblog(input: GetReblogInput): Promise<ReblogFull | null> {
  const { data, error } = await (supabase.from("reblogs") as any)
    .select("*")
    .eq("slug", input.slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as Reblog;
  const [reblogger, embeddedOriginal, parentReblog, viewer, excerptCheck] = await Promise.all([
    loadReblogger(row.reblogger_id),
    loadEmbeddedOriginal(row.original_post_id),
    row.parent_reblog_id ? loadParentReblog(row.parent_reblog_id) : Promise.resolve(null),
    viewerState(row.id, input.viewerId),
    row.excerpt_text
      ? checkExcerptStillValid(row.id, row.original_post_id, row.excerpt_text)
      : Promise.resolve({ isStillValid: true }),
  ]);

  return {
    ...row,
    reblogger,
    embeddedOriginal,
    parentReblog,
    viewer,
    isExcerptStillValid: excerptCheck.isStillValid,
  };
}
