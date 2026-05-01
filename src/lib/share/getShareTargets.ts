import { supabase } from "@/integrations/supabase/client";
import { getCollections } from "@/lib/library/getCollections";
import type { CollectionPreview } from "@/lib/library/types";

export interface RecentThreadPreview {
  id: string;
  title: string | null;
  otherParticipant: {
    id: string | null;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
}

export interface ShareTargets {
  recentThreads: RecentThreadPreview[];
  collections: CollectionPreview[];
}

/**
 * Returns the data needed to populate the share menu's secondary popovers:
 * - the user's 5 most recent DM threads, with the other participant resolved
 * - the user's collections (own only)
 */
export async function getShareTargets(userId: string): Promise<ShareTargets> {
  // ---- recent threads
  const { data: threads, error: tErr } = await supabase
    .from("dm_threads")
    .select(
      "id, title, participant_a, participant_b, last_message_at, last_message_preview"
    )
    .or(`participant_a.eq.${userId},participant_b.eq.${userId}`)
    .order("last_message_at", { ascending: false })
    .limit(5);
  if (tErr) throw tErr;

  const otherIds = Array.from(
    new Set(
      ((threads ?? []) as any[])
        .map((t) =>
          t.participant_a === userId ? t.participant_b : t.participant_a
        )
        .filter(Boolean)
    )
  );

  const profileById = new Map<string, any>();
  if (otherIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", otherIds);
    for (const p of (profs ?? []) as any[]) profileById.set(p.id, p);
  }

  const recentThreads: RecentThreadPreview[] = ((threads ?? []) as any[]).map(
    (t) => {
      const otherId =
        t.participant_a === userId ? t.participant_b : t.participant_a;
      const prof = otherId ? profileById.get(otherId) : null;
      return {
        id: t.id,
        title: t.title ?? null,
        otherParticipant: otherId
          ? {
              id: otherId,
              username: prof?.username ?? null,
              display_name: prof?.display_name ?? null,
              avatar_url: prof?.avatar_url ?? null,
            }
          : null,
        lastMessageAt: t.last_message_at ?? null,
        lastMessagePreview: t.last_message_preview ?? null,
      };
    }
  );

  // ---- collections (own)
  const { collections } = await getCollections({
    userId,
    viewerId: userId,
    sort: "recent",
    limit: 50,
  });

  return { recentThreads, collections };
}
