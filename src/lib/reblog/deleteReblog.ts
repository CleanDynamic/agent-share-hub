import { supabase } from "@/integrations/supabase/client";
import { assertReblogAuthoringEnabled } from "./media";

/**
 * Soft-delete a reblog (author or admin).
 *
 * FROZEN — NS-P43. Throws ReblogValidationError("REBLOG_RETIRED") while
 * REBLOG_COMPOSE_ENABLED is false.
 *
 * WHY FREEZING THIS COSTS NOTHING TODAY. Its one call site,
 * FeedReblogAdapter.handleDelete, passes `{ reblogId, rebloggerId }` behind an
 * `as any` cast while this function reads `args.userId` — so `userId` arrives
 * undefined, the ownership check below never matches, the admin RPC is called
 * with an undefined id, and the call already ended in a throw for every
 * caller. That call site catches and shows "Couldn't delete" either way, so
 * the freeze changes the error thrown and nothing a reader sees.
 *
 * Removing a reblog is therefore an operator action for now — a soft delete on
 * the archived `reblogs` table, per docs/retired-surfaces.md — until either
 * this is unfrozen (flag flip, and fix the argument name) or the table goes.
 */
export async function deleteReblog(args: {
  reblogId: string;
  userId: string;
}): Promise<void> {
  assertReblogAuthoringEnabled();
  const { data: row, error: readErr } = await (supabase.from("reblogs") as any)
    .select("reblogger_id, deleted_at")
    .eq("id", args.reblogId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!row) throw new Error("Reblog not found");
  if (row.deleted_at) return;

  // Admin check (best-effort; the RPC may not be exposed in all environments).
  let isAdmin = false;
  if (row.reblogger_id !== args.userId) {
    try {
      const { data } = await (supabase.rpc("is_admin", { _user_id: args.userId } as any) as any);
      isAdmin = !!data;
    } catch {
      isAdmin = false;
    }
    if (!isAdmin) throw new Error("Not authorized to delete this reblog");
  }

  const { error } = await (supabase.from("reblogs") as any)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", args.reblogId);
  if (error) throw error;
}
