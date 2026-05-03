import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "@/lib/notifications/createNotification";
import type { AnchorType } from "./types";

/** Walk a TipTap JSON doc and collect plain text. */
function extractPlainText(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractPlainText).join("");
  if (typeof node !== "object") return "";
  let out = "";
  if (node.type === "text" && typeof node.text === "string") out += node.text;
  if (Array.isArray(node.content)) out += node.content.map(extractPlainText).join("");
  // Newline between block-level nodes for readability.
  if (node.type && /paragraph|heading|listItem|blockquote/.test(node.type)) out += "\n";
  return out;
}

interface FoundMention {
  username: string;
  userId?: string;
}

interface FoundReference {
  refType: string;
  refId: string;
}

function walkDoc(
  node: any,
  mentions: FoundMention[],
  references: FoundReference[],
) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach((n) => walkDoc(n, mentions, references));
  const attrs = node.attrs ?? {};
  if (node.type === "mention") {
    if (attrs.username) mentions.push({ username: attrs.username, userId: attrs.id });
  }
  if (node.type === "reference" || node.type === "inlineReference") {
    if (attrs.refId) references.push({ refType: attrs.refType ?? "post", refId: attrs.refId });
  }
  if (Array.isArray(node.content)) walkDoc(node.content, mentions, references);
}

export async function postComment({
  anchorType,
  anchorId,
  parentCommentId,
  body,
  authorId,
}: {
  anchorType: AnchorType;
  anchorId: string;
  parentCommentId?: string | null;
  body: any;
  authorId: string;
}) {
  const bodyText = extractPlainText(body).trim();
  const mentions: FoundMention[] = [];
  const references: FoundReference[] = [];
  walkDoc(body, mentions, references);

  const { data, error } = await (supabase as any)
    .from("primitive_comments")
    .insert({
      anchor_type: anchorType,
      anchor_id: anchorId,
      parent_comment_id: parentCommentId ?? null,
      author_id: authorId,
      body,
      body_text: bodyText,
    })
    .select("*")
    .single();
  if (error) throw error;

  // Resolve mention user ids if not embedded.
  const unresolved = mentions.filter((m) => !m.userId).map((m) => m.username);
  let resolved: Record<string, string> = {};
  if (unresolved.length > 0) {
    const { data: profs } = await (supabase as any)
      .from("profiles")
      .select("id, username")
      .in("username", unresolved);
    for (const p of (profs ?? []) as any[]) resolved[p.username] = p.id;
  }
  const mentionUserIds = Array.from(
    new Set(
      mentions
        .map((m) => m.userId ?? resolved[m.username])
        .filter((x): x is string => !!x && x !== authorId),
    ),
  );

  // Notify mentions
  await Promise.all(
    mentionUserIds.map((uid) =>
      createNotification({
        recipientId: uid,
        actorId: authorId,
        kind: "mention_in_comment",
        targetType: "comment",
        targetId: data.id,
        metadata: { anchor_type: anchorType, anchor_id: anchorId },
      }).catch((e) => console.warn("[postComment] mention notify failed", e)),
    ),
  );

  // Notify thread parent author / post author for top-level on a post
  try {
    if (parentCommentId) {
      const { data: parent } = await (supabase as any)
        .from("primitive_comments")
        .select("author_id")
        .eq("id", parentCommentId)
        .maybeSingle();
      if (parent?.author_id && parent.author_id !== authorId) {
        await createNotification({
          recipientId: parent.author_id,
          actorId: authorId,
          kind: "comment_reply",
          targetType: "comment",
          targetId: data.id,
          metadata: { anchor_type: anchorType, anchor_id: anchorId },
        });
      }
    } else if (anchorType === "post") {
      const { data: post } = await (supabase as any)
        .from("content_items")
        .select("creator_id, title")
        .eq("id", anchorId)
        .maybeSingle();
      if (post?.creator_id && post.creator_id !== authorId) {
        await createNotification({
          recipientId: post.creator_id,
          actorId: authorId,
          kind: "new_comment",
          targetType: "blueprint",
          targetId: anchorId,
          metadata: { content_title: post.title, comment_excerpt: bodyText.slice(0, 80) },
        });
      }
    }
  } catch (e) {
    console.warn("[postComment] author notify failed", e);
  }

  // Reference notifications (best-effort)
  await Promise.all(
    references.map(async (ref) => {
      try {
        if (ref.refType !== "post") return;
        const { data: target } = await (supabase as any)
          .from("content_items")
          .select("creator_id")
          .eq("id", ref.refId)
          .maybeSingle();
        if (target?.creator_id && target.creator_id !== authorId) {
          await createNotification({
            recipientId: target.creator_id,
            actorId: authorId,
            kind: "referenced_in_comment",
            targetType: "comment",
            targetId: data.id,
            metadata: { ref_id: ref.refId },
          });
        }
      } catch (e) {
        console.warn("[postComment] reference notify failed", e);
      }
    }),
  );

  return data;
}
