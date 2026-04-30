import { supabase } from "@/integrations/supabase/client";
import type { ThreadSummary, ThreadType, MessageKind, SharedContentType } from "./types";

interface GetThreadsArgs {
  userId: string;
  tab: "primary" | "requests";
  query?: string;
  limit?: number;
  offset?: number;
}

interface GetThreadsResult {
  threads: ThreadSummary[];
  total: number;
}

/**
 * Returns the threads the user belongs to, with last-message previews,
 * unread counts, pinned ordering, and primary/requests partition.
 *
 * Tab logic:
 *  - 'primary': threads where the current user is a member AND the
 *               other party is followed by the current user, OR the
 *               current user initiated the thread (created_by = userId),
 *               OR thread type is group/bounty/blueprint.
 *  - 'requests': direct threads opened by a non-followed user
 *                (created_by ≠ userId AND other participant not followed).
 */
export async function getThreads({
  userId,
  tab,
  query = "",
  limit = 30,
  offset = 0,
}: GetThreadsArgs): Promise<GetThreadsResult> {
  // 1. Memberships for this user (joined_at, last_read_at, is_pinned)
  const { data: memberships, error: memErr } = await supabase
    .from("dm_thread_members")
    .select("thread_id, last_read_at, is_pinned, is_muted, joined_at")
    .eq("user_id", userId);

  // Fall back to legacy participant_a/b membership if no rows in members table
  const membershipMap = new Map<
    string,
    { last_read_at: string | null; is_pinned: boolean }
  >();
  for (const m of (memberships ?? []) as any[]) {
    membershipMap.set(m.thread_id, {
      last_read_at: m.last_read_at,
      is_pinned: !!m.is_pinned,
    });
  }
  if (memErr) {
    // Don't throw — legacy participant lookup below will still work
    console.warn("[getThreads] members query failed", memErr);
  }

  // 2. Threads where user is participant_a/b OR in members table
  const memberThreadIds = Array.from(membershipMap.keys());
  let threadsQuery = supabase
    .from("dm_threads")
    .select(
      "id, type, title, created_by, pinned_content_id, pinned_content_type, participant_a, participant_b, is_pinned_a, is_pinned_b, is_deleted_a, is_deleted_b, request_status, last_message_at, last_message_preview, last_message_sender_id, is_archived"
    )
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (memberThreadIds.length > 0) {
    threadsQuery = threadsQuery.or(
      `participant_a.eq.${userId},participant_b.eq.${userId},id.in.(${memberThreadIds.join(",")})`
    );
  } else {
    threadsQuery = threadsQuery.or(
      `participant_a.eq.${userId},participant_b.eq.${userId}`
    );
  }

  const { data: threadRows, error: threadErr } = await threadsQuery;
  if (threadErr) throw threadErr;
  let threads = (threadRows ?? []) as any[];

  // Filter out archived/deleted-for-me
  threads = threads.filter((t) => {
    if (t.is_archived) return false;
    if (t.participant_a === userId && t.is_deleted_a) return false;
    if (t.participant_b === userId && t.is_deleted_b) return false;
    return true;
  });

  // 3. Followed user set (for tab partitioning)
  const otherUserIds = new Set<string>();
  for (const t of threads) {
    if (t.type === "direct") {
      const other =
        t.participant_a === userId ? t.participant_b : t.participant_a;
      if (other) otherUserIds.add(other);
    }
  }
  let followedSet = new Set<string>();
  if (otherUserIds.size > 0) {
    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId)
      .in("following_id", Array.from(otherUserIds));
    followedSet = new Set(((follows ?? []) as any[]).map((f) => f.following_id));
  }

  // 4. Partition by tab
  threads = threads.filter((t) => {
    if (t.type !== "direct") {
      // group/bounty/blueprint always primary
      return tab === "primary";
    }
    const other =
      t.participant_a === userId ? t.participant_b : t.participant_a;
    const isPrimary =
      t.created_by === userId || (other && followedSet.has(other));
    return tab === "primary" ? isPrimary : !isPrimary;
  });

  const total = threads.length;

  // 5. Apply search filter on title or last_message_preview
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    threads = threads.filter((t) => {
      const inTitle = (t.title ?? "").toLowerCase().includes(q);
      const inPreview = (t.last_message_preview ?? "")
        .toLowerCase()
        .includes(q);
      return inTitle || inPreview;
    });
  }

  // 6. Get participant profiles for direct threads + member rows for groups
  const directOtherIds = new Set<string>();
  const groupThreadIds: string[] = [];
  for (const t of threads) {
    if (t.type === "direct") {
      const other =
        t.participant_a === userId ? t.participant_b : t.participant_a;
      if (other) directOtherIds.add(other);
    } else {
      groupThreadIds.push(t.id);
    }
  }

  const profileIds = new Set<string>(directOtherIds);
  let groupMembersByThread = new Map<string, string[]>();
  if (groupThreadIds.length > 0) {
    const { data: groupMembers } = await supabase
      .from("dm_thread_members")
      .select("thread_id, user_id")
      .in("thread_id", groupThreadIds);
    for (const gm of (groupMembers ?? []) as any[]) {
      if (!groupMembersByThread.has(gm.thread_id)) {
        groupMembersByThread.set(gm.thread_id, []);
      }
      groupMembersByThread.get(gm.thread_id)!.push(gm.user_id);
      profileIds.add(gm.user_id);
    }
  }

  const profileMap = new Map<
    string,
    { id: string; avatar_url: string | null; display_name: string | null; username: string | null }
  >();
  if (profileIds.size > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, avatar_url, display_name, username")
      .in("id", Array.from(profileIds));
    for (const p of (profs ?? []) as any[]) profileMap.set(p.id, p);
  }

  // 7. Pull latest message per thread (one round-trip; fetch most-recent
  //    100 messages for these threads then group)
  const threadIds = threads.slice(offset, offset + limit).map((t) => t.id);
  let lastMsgByThread = new Map<string, any>();
  if (threadIds.length > 0) {
    const { data: msgs } = await supabase
      .from("dm_messages")
      .select(
        "id, thread_id, sender_id, kind, body, text_content, message_type, shared_content_type, shared_content_meta, sent_at"
      )
      .in("thread_id", threadIds)
      .order("sent_at", { ascending: false })
      .limit(threadIds.length * 4);
    for (const m of (msgs ?? []) as any[]) {
      if (!lastMsgByThread.has(m.thread_id)) lastMsgByThread.set(m.thread_id, m);
    }
  }

  // 8. Unread counts per thread (count rows after last_read_at)
  const unreadByThread = new Map<string, number>();
  if (threadIds.length > 0) {
    await Promise.all(
      threadIds.map(async (tid) => {
        const lastRead = membershipMap.get(tid)?.last_read_at;
        let q = supabase
          .from("dm_messages")
          .select("id", { count: "exact", head: true })
          .eq("thread_id", tid)
          .neq("sender_id", userId);
        if (lastRead) q = q.gt("sent_at", lastRead);
        const { count } = await q;
        unreadByThread.set(tid, count ?? 0);
      })
    );
  }

  // 9. Build summaries
  const buildPreview = (msg: any | undefined): ThreadSummary["lastMessage"] => {
    if (!msg) return null;
    const kind = (msg.kind ?? "text") as MessageKind;
    let preview = "";
    if (kind === "content-share") {
      const t = msg.shared_content_meta?.title ?? "Shared content";
      const indicator =
        msg.shared_content_type === "blueprint"
          ? "📘"
          : msg.shared_content_type === "stage"
          ? "🎯"
          : msg.shared_content_type === "block"
          ? "🧱"
          : msg.shared_content_type === "bounty"
          ? "💰"
          : msg.shared_content_type === "blog"
          ? "📝"
          : "🔗";
      preview = `${indicator} ${t}`;
    } else {
      const raw = msg.body ?? msg.text_content ?? "";
      preview = raw.length > 60 ? raw.slice(0, 60) + "…" : raw;
    }
    return {
      kind,
      preview,
      contentType: (msg.shared_content_type ?? null) as SharedContentType | null,
      isFromCurrentUser: msg.sender_id === userId,
      timestamp: msg.sent_at,
    };
  };

  const summaries: ThreadSummary[] = threads
    .slice(offset, offset + limit)
    .map((t): ThreadSummary => {
      let avatarUrls: string[] = [];
      let memberCount = 2;
      let title: string | null = t.title;

      if (t.type === "direct") {
        const otherId =
          t.participant_a === userId ? t.participant_b : t.participant_a;
        const other = otherId ? profileMap.get(otherId) : undefined;
        avatarUrls = other?.avatar_url ? [other.avatar_url] : [];
        memberCount = 2;
        if (!title) title = other?.display_name ?? other?.username ?? null;
      } else {
        const memIds = groupMembersByThread.get(t.id) ?? [];
        avatarUrls = memIds
          .slice(0, 4)
          .map((id) => profileMap.get(id)?.avatar_url)
          .filter((u): u is string => !!u);
        memberCount = memIds.length || 2;
      }

      const isPinnedFromMember = membershipMap.get(t.id)?.is_pinned ?? false;
      const legacyPinned =
        (t.participant_a === userId && t.is_pinned_a) ||
        (t.participant_b === userId && t.is_pinned_b);
      const isPinned = isPinnedFromMember || !!legacyPinned;

      return {
        id: t.id,
        type: (t.type ?? "direct") as ThreadType,
        title,
        avatarUrls,
        memberCount,
        lastMessage: buildPreview(lastMsgByThread.get(t.id)),
        unreadCount: unreadByThread.get(t.id) ?? 0,
        isPinned,
        pinnedContentId: t.pinned_content_id ?? null,
        pinnedContentType: t.pinned_content_type ?? null,
      };
    });

  // 10. Pinned-first ordering, then last_message_at DESC (already sorted)
  summaries.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const at = a.lastMessage?.timestamp ?? "";
    const bt = b.lastMessage?.timestamp ?? "";
    return bt.localeCompare(at);
  });

  return { threads: summaries, total };
}
