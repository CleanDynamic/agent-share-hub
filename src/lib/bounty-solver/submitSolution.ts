import { supabase } from "@/integrations/supabase/client";
import { legacyItemForBounty } from "@/lib/bounty/resolveLegacy";
import { createNotification } from "@/lib/notifications/createNotification";
import type { Solution } from "./types";

function isEmptyPayload(p: any): boolean {
  if (!p) return true;
  if (typeof p !== "object") return false;
  return Object.keys(p).length === 0;
}

export async function submitSolution(solutionId: string): Promise<Solution> {
  const { data: existing, error: fetchErr } = await (supabase as any)
    .from("solutions")
    .select("*")
    .eq("id", solutionId)
    .single();
  if (fetchErr) throw fetchErr;
  const sol = existing as Solution;
  if (isEmptyPayload(sol.content_payload)) {
    throw new Error("Solution must have content before submitting");
  }

  const { data: updated, error: updErr } = await (supabase as any)
    .from("solutions")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
    } as any)
    .eq("id", solutionId)
    .select("*")
    .single();
  if (updErr) throw updErr;

  // Bounty author + solver count bump (best-effort; non-blocking).
  void (async () => {
    try {
      // NS-P50: sol.bounty_id is a public.bounties id, so the bounty's
      // content_items row is found by resolving the header's legacy_item_id. A
      // bounty on a build has none — that path notifies from
      // src/lib/bounty/solutions.ts — and the solver's counter below still runs
      // either way.
      const legacyBountyItemId = await legacyItemForBounty(sol.bounty_id);
      const { data: bounty } = legacyBountyItemId
        ? await (supabase as any)
            .from("content_items")
            .select("creator_id, title, slug")
            .eq("id", legacyBountyItemId)
            .maybeSingle()
        : { data: null };
      if (bounty?.creator_id && legacyBountyItemId) {
        await createNotification({
          recipientId: bounty.creator_id,
          actorId: sol.solver_id,
          kind: "bounty_interaction",
          targetType: "bounty",
          targetId: legacyBountyItemId,
          metadata: {
            subkind: "solution_submitted",
            solution_id: solutionId,
            slot_id: sol.slot_id,
            slot_kind: sol.slot_kind,
          },
        });
      }
      // Increment solver's submitted count via RPC-style RMW.
      const { data: prof } = await (supabase as any)
        .from("profiles")
        .select("bounty_solutions_submitted")
        .eq("id", sol.solver_id)
        .maybeSingle();
      const cur = (prof as any)?.bounty_solutions_submitted ?? 0;
      await (supabase as any)
        .from("profiles")
        .update({ bounty_solutions_submitted: cur + 1 } as any)
        .eq("id", sol.solver_id);
    } catch (e) {
      console.warn("[submitSolution] notification/stat update failed", e);
    }
  })();

  return updated as Solution;
}
