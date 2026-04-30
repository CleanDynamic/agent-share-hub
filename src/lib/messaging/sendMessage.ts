import { supabase } from "@/integrations/supabase/client";
import type { Message, SharedContentMeta, SharedContentType } from "./types";

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Not authenticated");
  return id;
}

async function bumpThread(
  threadId: string,
  preview: string,
  senderId: string
): Promise<void> {
  const payload: any = {
    last_message_at: new Date().toISOString(),
    last_message_preview: preview.slice(0, 200),
    last_message_sender_id: senderId,
  };
  await supabase.from("dm_threads").update(payload).eq("id", threadId);
}

export async function sendTextMessage(
  threadId: string,
  body: string
): Promise<Message> {
  const userId = await currentUserId();
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Empty message");

  const insertPayload: any = {
    thread_id: threadId,
    sender_id: userId,
    kind: "text",
    message_type: "text",
    body: trimmed,
    text_content: trimmed,
  };

  const { data, error } = await supabase
    .from("dm_messages")
    .insert(insertPayload)
    .select(
      "id, thread_id, sender_id, kind, body, text_content, message_type, image_url, voice_url, voice_duration_seconds, is_liked, reply_to_message_id, shared_content_type, shared_content_id, shared_content_meta, edited_at, sent_at, read_at, delivered_at, is_unsent"
    )
    .single();
  if (error) throw error;

  await bumpThread(threadId, trimmed, userId);
  return data as unknown as Message;
}

export async function sendContentShareMessage(
  threadId: string,
  contentType: SharedContentType,
  contentId: string,
  senderNote?: string
): Promise<Message> {
  const userId = await currentUserId();

  // Snapshot title/slug/author into meta
  const { data: item } = await supabase
    .from("content_items")
    .select("title, slug, creator_id, cover_image_url, post_type")
    .eq("id", contentId)
    .maybeSingle();

  let authorMeta: { username: string | null; display_name: string | null } | null = null;
  if ((item as any)?.creator_id) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", (item as any).creator_id)
      .maybeSingle();
    authorMeta = (prof as any) ?? null;
  }

  const meta: SharedContentMeta = {
    title: (item as any)?.title ?? "Shared content",
    slug: (item as any)?.slug ?? null,
    author_id: (item as any)?.creator_id ?? null,
    author_username: authorMeta?.username ?? null,
    author_display_name: authorMeta?.display_name ?? null,
    cover_image_url: (item as any)?.cover_image_url ?? null,
  };

  const note = (senderNote ?? "").trim();
  const insertPayload: any = {
    thread_id: threadId,
    sender_id: userId,
    kind: "content-share",
    message_type: "text",
    shared_content_type: contentType,
    shared_content_id: contentId,
    shared_content_meta: meta,
    body: note || null,
    text_content: note || null,
  };

  const { data, error } = await supabase
    .from("dm_messages")
    .insert(insertPayload)
    .select(
      "id, thread_id, sender_id, kind, body, text_content, message_type, image_url, voice_url, voice_duration_seconds, is_liked, reply_to_message_id, shared_content_type, shared_content_id, shared_content_meta, edited_at, sent_at, read_at, delivered_at, is_unsent"
    )
    .single();
  if (error) throw error;

  const previewIndicator =
    contentType === "blueprint"
      ? "📘"
      : contentType === "stage"
      ? "🎯"
      : contentType === "block"
      ? "🧱"
      : contentType === "bounty"
      ? "💰"
      : contentType === "blog"
      ? "📝"
      : "🔗";
  await bumpThread(threadId, `${previewIndicator} ${meta.title}`, userId);

  return data as unknown as Message;
}
