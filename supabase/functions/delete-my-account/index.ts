// =============================================================================
// delete-my-account (UX-15 P6)
// =============================================================================
// Deletes the signed-in person's account: their files, their rows, and the sign-in itself. The step list, its order and why each step
// can be repeated are in core.ts.
//
// WHO. verify_jwt = true. The caller is read from the verified token (_shared/caller.ts) and nothing in the body names a user. The
// body carries only the username the person typed, which the server compares with the profile's.
//
// THE SERVICE ROLE is used for four things and nothing else: listing and removing the person's storage objects, calling
// delete_account_rows(uid) (20261111120000_ux15_settings_blocking.sql), writing account_deletions, and auth.admin.deleteUser.
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCaller } from "../_shared/caller.ts";
import { readBody, z } from "../_shared/body.ts";
import { fail, json, preflight } from "../_shared/cors.ts";
import { deleteAccount, DeleteStopped, type DeleteDeps } from "./core.ts";

const Body = z.object({ confirm: z.string().min(1).max(100) });

export function depsFor(admin: ReturnType<typeof createClient>, userId: string, typed: string): DeleteDeps {
  return {
    userId,
    typed,
    usernameOf: async (id) => {
      const { data, error } = await admin.from("profiles").select("username").eq("id", id).limit(1).maybeSingle();
      if (error) throw error;
      return (data as { username?: string | null } | null)?.username ?? null;
    },
    logRequested: async (id) => {
      const { error } = await admin.from("account_deletions").upsert({ user_id: id }, { onConflict: "user_id", ignoreDuplicates: true });
      if (error) throw error;
    },
    listObjects: async (id) => {
      const { data, error } = await admin.rpc("list_account_objects", { _uid: id });
      if (error) throw error;
      return ((data ?? []) as { bucket_id: string; name: string }[]).map((row) => ({ bucket: row.bucket_id, name: row.name }));
    },
    removeObjects: async (bucket, names) => {
      const { error } = await admin.storage.from(bucket).remove(names);
      if (error) throw error;
    },
    deleteRows: async (id) => {
      const { error } = await admin.rpc("delete_account_rows", { _uid: id });
      if (error) throw error;
    },
    deleteAuthUser: async (id) => {
      const { error } = await admin.auth.admin.deleteUser(id);
      // A user that is already gone is a step done.
      if (error && !/not.?found/i.test(`${error.message} ${(error as { code?: string }).code ?? ""}`)) throw error;
      return true;
    },
    logCompleted: async (id) => {
      const { error } = await admin.from("account_deletions").update({ completed_at: new Date().toISOString() }).eq("user_id", id);
      if (error) throw error;
    },
  };
}

serve(async (req: Request) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== "POST") return fail(req, 405, "Use POST.");

  const caller = await getCaller(req);
  if (!caller) return fail(req, 401, "Sign in to delete your account.");

  const body = await readBody(req, Body);
  if (!body.ok) return fail(req, 400, body.error);

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const result = await deleteAccount(depsFor(admin, caller.id, body.data.confirm));
    return json(req, { ok: true, filesRemoved: result.filesRemoved });
  } catch (error) {
    if (error instanceof DeleteStopped) {
      // The step that stopped, and the sentence for the person. Nothing the database said is passed on.
      return fail(req, error.step === "check" ? 400 : 500, error.step === "check" ? error.message : `Couldn't finish deleting your account (${error.step}). Try again: it carries on where it stopped.`);
    }
    return fail(req, 500, "Couldn't delete your account. Try again.");
  }
});
