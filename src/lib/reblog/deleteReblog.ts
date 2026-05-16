import { supabase } from "@/integrations/supabase/client";

export async function deleteReblog(args: {
  reblogId: string;
  userId: string;
}): Promise<void> {
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
