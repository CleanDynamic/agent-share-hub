import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "@/lib/notifications/createNotification";
import { extractMentions } from "@/lib/mentions";
import { resolveBountyByLegacyItem } from "@/lib/bounty/resolveLegacy";

export async function postDiscussionComment(args: {
  bountyId: string;
  parentCommentId?: string | null;
  body: string;
  taggedBountyAuthor?: boolean;
  authorId: string;
}) {
  const { bountyId, parentCommentId = null, body, taggedBountyAuthor = false, authorId } = args;

  // NS-P50. bountyId is the content_items id in the legacy bounty page's route;
  // bounty_discussion_comments.bounty_id is a public.bounties id, so the header
  // row is resolved before the insert.
  const bountyRowId = await resolveBountyByLegacyItem(bountyId);

  const { data, error } = await (supabase as any)
    .from("bounty_discussion_comments")
    .insert({
      bounty_id: bountyRowId,
      parent_comment_id: parentCommentId,
      author_id: authorId,
      body,
      tagged_bounty_author: taggedBountyAuthor,
    } as any)
    .select("*")
    .single();
  if (error) throw error;

  // Notifications (best-effort).
  void (async () => {
    try {
      // Mentions
      let mentions: string[] = [];
      try {
        mentions = (extractMentions as any)?.(body) ?? [];
      } catch {
        // Fallback regex
        mentions = Array.from(body.matchAll(/@([a-z0-9_-]+)/gi)).map((m) => m[1]);
      }
      if (mentions.length > 0) {
        const { data: mentioned } = await (supabase as any)
          .from("profiles")
          .select("id, username")
          .in("username", mentions);
        for (const m of (mentioned ?? []) as any[]) {
          if (m.id === authorId) continue;
          await createNotification({
            recipientId: m.id,
            actorId: authorId,
            kind: "mention",
            targetType: "bounty",
            targetId: bountyId,
            metadata: { subkind: "discussion_mention", comment_id: data.id },
          });
        }
      }
      // Tag bounty author
      if (taggedBountyAuthor) {
        const { data: bounty } = await (supabase as any)
          .from("content_items")
          .select("creator_id")
          .eq("id", bountyId)
          .maybeSingle();
        if (bounty?.creator_id && bounty.creator_id !== authorId) {
          await createNotification({
            recipientId: bounty.creator_id,
            actorId: authorId,
            kind: "bounty_interaction",
            targetType: "bounty",
            targetId: bountyId,
            metadata: { subkind: "discussion_tagged_author", comment_id: data.id },
          });
        }
      }
    } catch (e) {
      console.warn("[postDiscussionComment] notification failed", e);
    }
  })();

  return data;
}
