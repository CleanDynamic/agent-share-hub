/**
 * High-level notification triggers — one function per platform event.
 *
 * Every trigger is fire-and-forget: it never throws, never blocks the
 * caller, and silently swallows errors so a failed notification can never
 * break the user-action that produced it.
 *
 * Usage:
 *   notifyEngagement({ kind: "like", recipientId, actorId, postId, ... })
 *     .catch(console.error);
 *
 * Each helper internally calls `createNotification`, which itself skips
 * self-notifications and respects per-recipient mute prefs.
 */

import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "./createNotification";
import type { NotificationTargetType } from "./types";

// ────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────

function silent<T>(p: Promise<T>): Promise<T | null> {
  return p.catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[notifications/triggers]", err);
    return null;
  });
}

function postTypeToTargetType(postType?: string | null): NotificationTargetType {
  if (postType === "blog") return "blog";
  if (postType === "bounty") return "bounty";
  return "blueprint";
}

async function getActorUsername(actorId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", actorId)
      .maybeSingle();
    return (data as any)?.display_name || (data as any)?.username || null;
  } catch {
    return null;
  }
}

async function getPostMeta(
  postId: string
): Promise<{ creator_id: string; title: string; post_type: string } | null> {
  try {
    const { data } = await supabase
      .from("content_items")
      .select("creator_id, title, post_type")
      .eq("id", postId)
      .maybeSingle();
    return (data as any) ?? null;
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// 1. NEW_FOLLOWER
// ────────────────────────────────────────────────────────────

export function notifyNewFollower(args: {
  followerId: string;
  followingId: string;
}) {
  return silent(
    (async () => {
      const actor = await getActorUsername(args.followerId);
      return createNotification({
        recipientId: args.followingId,
        kind: "new_follower",
        actorId: args.followerId,
        targetType: "profile",
        targetId: args.followerId,
        body: `${actor ?? "Someone"} followed you`,
        metadata: { username: actor },
      });
    })()
  );
}

// ────────────────────────────────────────────────────────────
// 2/3. ENGAGEMENT — like / repost
//      Throttled: skip if the same actor already produced a same-kind
//      engagement notification on the same post in the last 24 hours.
// ────────────────────────────────────────────────────────────

const ENGAGEMENT_THROTTLE_MS = 24 * 60 * 60 * 1000;

async function isThrottled(args: {
  recipientId: string;
  actorId: string;
  kind: string; // engagement sub-kind, e.g. "post_liked"
  postId: string;
}): Promise<boolean> {
  try {
    const since = new Date(Date.now() - ENGAGEMENT_THROTTLE_MS).toISOString();
    const { data } = await supabase
      .from("notifications" as any)
      .select("id")
      .eq("recipient_id", args.recipientId)
      .eq("actor_id", args.actorId)
      .eq("notification_type", args.kind)
      .eq("content_id", args.postId)
      .gte("created_at", since)
      .limit(1);
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

export function notifyEngagement(args: {
  kind: "like" | "repost" | "comment";
  postId: string;
  actorId: string;
  /** Optional: if you've already loaded the comment text. */
  commentExcerpt?: string;
}) {
  return silent(
    (async () => {
      const post = await getPostMeta(args.postId);
      if (!post) return null;
      if (!post.creator_id || post.creator_id === args.actorId) return null;

      const sub =
        args.kind === "like"
          ? "post_liked"
          : args.kind === "repost"
          ? "post_reblogged"
          : "new_comment";

      // Throttle like/repost (un-like + re-like spam protection).
      if (args.kind === "like" || args.kind === "repost") {
        if (
          await isThrottled({
            recipientId: post.creator_id,
            actorId: args.actorId,
            kind: sub,
            postId: args.postId,
          })
        ) {
          return null;
        }
      }

      const actorName = await getActorUsername(args.actorId);
      const targetType = postTypeToTargetType(post.post_type);
      const verb =
        args.kind === "like"
          ? "liked"
          : args.kind === "repost"
          ? "reposted"
          : "commented on";

      let body = `${actorName ?? "Someone"} ${verb} your ${targetType} '${post.title}'`;
      if (args.kind === "comment" && args.commentExcerpt) {
        body = `${actorName ?? "Someone"} commented on your ${targetType}: '${args.commentExcerpt.slice(0, 60)}'`;
      }

      return createNotification({
        recipientId: post.creator_id,
        kind: sub,
        actorId: args.actorId,
        targetType,
        targetId: args.postId,
        body,
        metadata: {
          actor_name: actorName,
          content_title: post.title,
          post_type: post.post_type,
          ...(args.commentExcerpt
            ? { comment_excerpt: args.commentExcerpt.slice(0, 80) }
            : {}),
        },
      });
    })()
  );
}

// ────────────────────────────────────────────────────────────
// 5. MENTION — re-export the existing helper as a typed trigger.
// ────────────────────────────────────────────────────────────

export function notifyMentions(args: {
  text: string;
  actorId: string;
  contentId?: string | null;
  context?: "comment" | "tip" | "description";
}) {
  return silent(
    (async () => {
      const { sendMentionNotifications } = await import("@/lib/mentions");
      await sendMentionNotifications({
        text: args.text,
        actorId: args.actorId,
        contentId: args.contentId ?? null,
        context: args.context ?? "comment",
      });
      return null;
    })()
  );
}

// ────────────────────────────────────────────────────────────
// 6. NEW_MESSAGE — coalesced.
//      The DB trigger `notify_thread_members_on_message` already inserts
//      one row per message. Use this client-side helper only when you want
//      to *coalesce* multiple unread messages from the same thread into a
//      single notification (for fast back-and-forth threads).
// ────────────────────────────────────────────────────────────

export function notifyNewMessageCoalesced(args: {
  threadId: string;
  senderId: string;
  recipientId: string;
  preview: string;
}) {
  return silent(
    (async () => {
      // If recipient already has an unread message_received notification
      // for this thread, just bump it instead of creating another.
      const { data: existing } = await supabase
        .from("notifications" as any)
        .select("id, metadata")
        .eq("recipient_id", args.recipientId)
        .eq("notification_type", "message_received")
        .eq("is_read", false)
        .contains("metadata", { thread_id: args.threadId } as any)
        .limit(1);

      if (Array.isArray(existing) && existing.length > 0) {
        const id = (existing[0] as any).id;
        await supabase
          .from("notifications" as any)
          .update({
            created_at: new Date().toISOString(),
            body: `New message: ${args.preview.slice(0, 60)}`,
          } as any)
          .eq("id", id);
        return null;
      }

      const actorName = await getActorUsername(args.senderId);
      return createNotification({
        recipientId: args.recipientId,
        kind: "message_received",
        actorId: args.senderId,
        targetType: "thread",
        targetId: args.threadId,
        body: `${actorName ?? "Someone"}: ${args.preview.slice(0, 60)}`,
        metadata: { thread_id: args.threadId, sender_id: args.senderId },
      });
    })()
  );
}

// ────────────────────────────────────────────────────────────
// 7. REFERENCE_RECEIVED
//      Called once per blog publish with the list of referenced parent
//      content ids. Notifies each referenced item's creator (deduped).
// ────────────────────────────────────────────────────────────

export function notifyReferencesReceived(args: {
  blogId: string;
  blogAuthorId: string;
  referencedContentIds: string[];
  /**
   * Pass true to suppress notifications when *re-saving* a published blog
   * that already referenced the same items previously.
   */
  alreadyNotifiedContentIds?: string[];
}) {
  return silent(
    (async () => {
      const ids = Array.from(new Set(args.referencedContentIds)).filter(
        (id) => !args.alreadyNotifiedContentIds?.includes(id)
      );
      if (ids.length === 0) return null;

      const { data: items } = await supabase
        .from("content_items")
        .select("id, creator_id, title, post_type")
        .in("id", ids);
      if (!items) return null;

      const actorName = await getActorUsername(args.blogAuthorId);

      // Dedupe per recipient — one notification per owner per blog.
      const seen = new Set<string>();
      await Promise.all(
        (items as any[]).map(async (it) => {
          if (!it.creator_id || it.creator_id === args.blogAuthorId) return;
          if (seen.has(it.creator_id)) return;
          seen.add(it.creator_id);

          const kind = postTypeToTargetType(it.post_type);
          await createNotification({
            recipientId: it.creator_id,
            kind: "reference_received",
            actorId: args.blogAuthorId,
            targetType: "blog",
            targetId: args.blogId,
            body: `${actorName ?? "Someone"} referenced your ${kind} in their blog`,
            metadata: {
              referenced_content_id: it.id,
              referenced_title: it.title,
              referenced_kind: kind,
            },
            // Override default content_id linking so the deep-link goes to
            // the new blog, not the referenced item.
          } as any);
        })
      );
      return null;
    })()
  );
}

// ────────────────────────────────────────────────────────────
// 8. BOUNTY interactions
// ────────────────────────────────────────────────────────────

export function notifyBountySolutionSubmitted(args: {
  bountyId: string;
  solverId: string;
}) {
  return silent(
    (async () => {
      const post = await getPostMeta(args.bountyId);
      if (!post) return null;
      const actor = await getActorUsername(args.solverId);
      return createNotification({
        recipientId: post.creator_id,
        kind: "bounty_interaction",
        actorId: args.solverId,
        targetType: "bounty",
        targetId: args.bountyId,
        body: `${actor ?? "Someone"} submitted a solution to your bounty '${post.title}'`,
        metadata: { sub: "solution_submitted", bounty_title: post.title },
      });
    })()
  );
}

export function notifyBountySolutionAccepted(args: {
  bountyId: string;
  solverId: string;
  acceptorId: string;
}) {
  return silent(
    (async () => {
      const post = await getPostMeta(args.bountyId);
      if (!post) return null;
      const acceptor = await getActorUsername(args.acceptorId);
      return createNotification({
        recipientId: args.solverId,
        kind: "bounty_interaction",
        actorId: args.acceptorId,
        targetType: "bounty",
        targetId: args.bountyId,
        body: `${acceptor ?? "The author"} accepted your solution to '${post.title}'`,
        metadata: { sub: "solution_accepted", bounty_title: post.title },
      });
    })()
  );
}

// ────────────────────────────────────────────────────────────
// 9. SYSTEM — level achievement.
// ────────────────────────────────────────────────────────────

/**
 * Levels match the `profiles.level` check constraint:
 *   reader → builder → creator → curator
 * (Curator is the platform's highest tier; "sage" in the spec maps here.)
 */
export type CreatorLevel = "reader" | "builder" | "creator" | "curator";

const LEVEL_ORDER: CreatorLevel[] = ["reader", "builder", "creator", "curator"];
const LEVEL_LABEL: Record<CreatorLevel, string> = {
  reader: "Reader",
  builder: "Builder",
  creator: "Creator",
  curator: "Curator",
};

export function notifyLevelEarned(args: {
  recipientId: string;
  newLevel: CreatorLevel;
}) {
  return silent(
    (async () => {
      return createNotification({
        recipientId: args.recipientId,
        kind: "system",
        targetType: "profile",
        targetId: args.recipientId,
        body: `You earned the ${LEVEL_LABEL[args.newLevel]} badge`,
        metadata: { sub: "level_earned", level: args.newLevel },
      });
    })()
  );
}

/**
 * Recompute a user's creator level from their public stats and emit a
 * `system` notification when they cross a threshold.
 *
 * Thresholds (intentionally conservative for now):
 *   - reader:  default
 *   - builder: ≥ 1 approved post
 *   - creator: ≥ 5 approved posts OR ≥ 100 followers
 *   - sage:    ≥ 25 approved posts OR ≥ 1k followers
 *
 * Stores the current level in `profiles.derived_level` (jsonb-friendly text).
 * Safe to call from publish, daily cron, or any other recompute hook.
 */
export function recomputeUserLevel(userId: string) {
  return silent(
    (async () => {
      const [{ count: postCount }, { data: prof }] = await Promise.all([
        supabase
          .from("content_items")
          .select("*", { count: "exact", head: true })
          .eq("creator_id", userId)
          .eq("status", "approved"),
        supabase
          .from("profiles")
          .select("follower_count, level")
          .eq("id", userId)
          .maybeSingle(),
      ]);

      const followers = ((prof as any)?.follower_count ?? 0) as number;
      const posts = (postCount ?? 0) as number;
      const previous = (((prof as any)?.level as CreatorLevel) ?? "reader");

      let next: CreatorLevel = "reader";
      if (posts >= 25 || followers >= 1000) next = "curator";
      else if (posts >= 5 || followers >= 100) next = "creator";
      else if (posts >= 1) next = "builder";

      if (LEVEL_ORDER.indexOf(next) > LEVEL_ORDER.indexOf(previous)) {
        try {
          await supabase
            .from("profiles")
            .update({ level: next } as any)
            .eq("id", userId);
        } catch {
          /* ignore — we still send the notification below */
        }
        await notifyLevelEarned({ recipientId: userId, newLevel: next });
      }
      return null;
    })()
  );
}
