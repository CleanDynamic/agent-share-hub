// =============================================================================
// my-sessions (G16)
// =============================================================================
// Lists the signed-in member's own sessions and signs one of them out.
//
//   POST { "action": "list" }                          -> { sessions: SessionView[] }
//   POST { "action": "revoke", "sessionId": "<uuid>" } -> { ok: true }
//
// WHO. verify_jwt = true. The member is read from the verified token (_shared/caller.ts); the body never names a
// user. The current session is the token's session_id claim, read only after the token has been verified.
//
// THE SERVICE ROLE is used for two calls and nothing else: public.sessions_of_user and public.revoke_user_session
// (20261116140000_c16_my_sessions.sql), each given the caller's own id.
//
// Ending a session stops that device refreshing. The access token it holds works until it expires (an hour by
// default); the Devices group says so.
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCaller } from "../_shared/caller.ts";
import { readBody, z } from "../_shared/body.ts";
import { fail, json, preflight } from "../_shared/cors.ts";
import { endSession, listSessions, SessionRefused, sessionIdOf, type SessionDeps, type SessionRow } from "./core.ts";

const Body = z.object({
  action: z.enum(["list", "revoke"]),
  sessionId: z.string().max(64).optional(),
});

serve(async (req: Request) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== "POST") return fail(req, 405, "Use POST.");

  const caller = await getCaller(req);
  if (!caller) return fail(req, 401, "Sign in to see your devices.");
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

  const body = await readBody(req, Body);
  if (!body.ok) return fail(req, 400, body.error);

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const deps: SessionDeps = {
    userId: caller.id,
    currentSessionId: sessionIdOf(token),
    list: async (userId) => {
      const { data, error } = await admin.rpc("sessions_of_user", { _user_id: userId });
      if (error) throw error;
      return (data ?? []) as SessionRow[];
    },
    revoke: async (userId, sessionId) => {
      const { data, error } = await admin.rpc("revoke_user_session", { _user_id: userId, _session_id: sessionId });
      if (error) throw error;
      return data === true;
    },
  };

  try {
    if (body.data.action === "list") return json(req, { sessions: await listSessions(deps) });
    await endSession(deps, body.data.sessionId ?? "");
    return json(req, { ok: true });
  } catch (error) {
    if (error instanceof SessionRefused) return fail(req, error.status, error.message);
    return fail(req, 500, "Couldn't reach your devices. Try again.");
  }
});
