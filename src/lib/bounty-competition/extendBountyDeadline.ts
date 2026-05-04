import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "@/lib/notifications/createNotification";

interface ExtendArgs {
  bountyId: string;
  extenderUserId: string;
  newDeadline: string; // ISO timestamp
  reason?: string | null;
}

export async function extendBountyDeadline({
  bountyId,
  extenderUserId,
  newDeadline,
  reason,
}: ExtendArgs): Promise<void> {
  const { data: bounty, error } = await (supabase as any)
    .from("content_items")
    .select("id, creator_id, bounty_deadline")
    .eq("id", bountyId)
    .single();
  if (error) throw error;
  if ((bounty as any).creator_id !== extenderUserId) {
    throw new Error("Only the bounty author can extend the deadline");
  }

  const previousDeadline = (bounty as any).bounty_deadline as string | null;

  const { error: insErr } = await (supabase as any)
    .from("bounty_deadline_extensions")
    .insert({
      bounty_id: bountyId,
      extended_by: extenderUserId,
      previous_deadline: previousDeadline,
      new_deadline: newDeadline,
      reason: reason ?? null,
    } as any);
  if (insErr) throw insErr;

  const { error: updErr } = await (supabase as any)
    .from("content_items")
    .update({ bounty_deadline: newDeadline } as any)
    .eq("id", bountyId);
  if (updErr) throw updErr;

  // Notify active solvers + commenters (best effort, deduped)
  void (async () => {
    try {
      const [{ data: solvers }, { data: commenters }] = await Promise.all([
        (supabase as any)
          .from("solutions")
          .select("solver_id")
          .eq("bounty_id", bountyId)
          .in("status", ["draft", "submitted"]),
        (supabase as any)
          .from("bounty_discussion_comments")
          .select("author_id")
          .eq("bounty_id", bountyId),
      ]);
      const recipients = new Set<string>([
        ...((solvers ?? []) as any[]).map((s) => s.solver_id),
        ...((commenters ?? []) as any[]).map((c) => c.author_id),
      ]);
      recipients.delete(extenderUserId);
      await Promise.all(
        [...recipients].map((rid) =>
          createNotification({
            recipientId: rid,
            actorId: extenderUserId,
            kind: "bounty_interaction",
            targetType: "bounty",
            targetId: bountyId,
            metadata: {
              subkind: "deadline_extended",
              previous_deadline: previousDeadline,
              new_deadline: newDeadline,
              reason: reason ?? null,
            },
          }).catch(() => null),
        ),
      );
    } catch (e) {
      console.warn("[extendBountyDeadline] notification fan-out failed", e);
    }
  })();
}
