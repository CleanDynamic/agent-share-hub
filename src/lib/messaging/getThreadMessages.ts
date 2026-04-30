import { supabase } from "@/integrations/supabase/client";
import type { Message, MessageKind, SharedContentMeta, SharedContentType } from "./types";

interface GetThreadMessagesArgs {
  threadId: string;
  userId: string;
  limit?: number;
  /** Cursor: return messages older than this message id */
  beforeMessageId?: string;
}

interface GetThreadMessagesResult {
  messages: Message[];
  hasMore: boolean;
}

/**
 * Loads a page of messages for a thread, newest-first internally then
 * returned oldest-first. Resolves the current state of any shared content
 * (so renderers can show a 'broken' badge when the referenced item was
 * deleted).
 */
export async function getThreadMessages({
  threadId,
  userId: _userId,
  limit = 50,
  beforeMessageId,
}: GetThreadMessagesArgs): Promise<GetThreadMessagesResult> {
  let cursorSentAt: string | null = null;
  if (beforeMessageId) {
    const { data: cursor } = await supabase
      .from("dm_messages")
      .select("sent_at")
      .eq("id", beforeMessageId)
      .maybeSingle();
    cursorSentAt = (cursor as any)?.sent_at ?? null;
  }

  let q = supabase
    .from("dm_messages")
    .select(
      "id, thread_id, sender_id, kind, body, text_content, message_type, image_url, voice_url, voice_duration_seconds, is_liked, reply_to_message_id, shared_content_type, shared_content_id, shared_content_meta, edited_at, sent_at, read_at, delivered_at, is_unsent"
    )
    .eq("thread_id", threadId)
    .order("sent_at", { ascending: false })
    .limit(limit + 1);

  if (cursorSentAt) q = q.lt("sent_at", cursorSentAt);

  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []) as any[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  // Resolve shared content references in one query
  const sharedIds = page
    .filter((r) => r.kind === "content-share" && r.shared_content_id)
    .map((r) => r.shared_content_id as string);
  const resolvedMap = new Map<string, any>();
  if (sharedIds.length > 0) {
    const { data: items } = await supabase
      .from("content_items")
      .select("id, title, slug, post_type, cover_image_url, creator_id, status")
      .in("id", sharedIds);
    for (const it of (items ?? []) as any[]) resolvedMap.set(it.id, it);
  }

  const messages: Message[] = page
    .reverse()
    .map((r): Message => {
      const meta = (r.shared_content_meta ?? null) as SharedContentMeta | null;
      let resolvedContent: Message["resolvedContent"] = null;
      if (r.kind === "content-share" && r.shared_content_id) {
        const found = resolvedMap.get(r.shared_content_id);
        if (found) {
          resolvedContent = {
            id: found.id,
            title: found.title,
            slug: found.slug,
            post_type: found.post_type,
            cover_image_url: found.cover_image_url,
            creator_id: found.creator_id,
            isBroken: found.status !== "approved",
          };
        } else {
          resolvedContent = {
            id: r.shared_content_id,
            title: meta?.title ?? "Removed content",
            slug: meta?.slug ?? null,
            post_type: (r.shared_content_type as string) ?? null,
            cover_image_url: meta?.cover_image_url ?? null,
            creator_id: (meta?.author_id as string) ?? "",
            isBroken: true,
          };
        }
      }
      return {
        id: r.id,
        thread_id: r.thread_id,
        sender_id: r.sender_id,
        kind: (r.kind ?? "text") as MessageKind,
        body: r.body,
        text_content: r.text_content,
        message_type: r.message_type,
        image_url: r.image_url,
        voice_url: r.voice_url,
        voice_duration_seconds: r.voice_duration_seconds,
        is_liked: r.is_liked,
        reply_to_message_id: r.reply_to_message_id,
        shared_content_type: (r.shared_content_type ?? null) as SharedContentType | null,
        shared_content_id: r.shared_content_id,
        shared_content_meta: meta,
        resolvedContent,
        edited_at: r.edited_at,
        sent_at: r.sent_at,
        read_at: r.read_at,
        delivered_at: r.delivered_at,
        is_unsent: r.is_unsent,
      };
    });

  return { messages, hasMore };
}
