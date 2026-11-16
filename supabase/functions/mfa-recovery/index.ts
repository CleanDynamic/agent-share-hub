// =============================================================================
// mfa-recovery (Part A, G5)
// =============================================================================
// Backup codes, and removing a lost authenticator.
//
//   POST { "action": "create" }                       -> { codes: string[] }   ten new codes, shown once; the old set is void
//   POST { "action": "redeem", "code": "XXXXX-XXXXX" } -> { ok: true }          this session now counts as verified
//   POST { "action": "status" }                       -> { left: number }
//   POST { "action": "remove_factor", "factorId": … }  -> { ok: true }
//
// WHO. verify_jwt = true. The member is read from the verified token (_shared/caller.ts); the body never names a user.
// The session, its aal and when a code was last entered are read from that token's claims, after it is verified.
//
// THE SERVICE ROLE is used for: the backup-code functions of 20261116150000_a05_backup_codes.sql, each given the
// caller's own id; edge_rate_limit_hit for the redeem limit; and auth.admin.mfa.listFactors and deleteFactor for the
// caller's own factors. No code, hash or token is logged.
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCaller } from "../_shared/caller.ts";
import { readBody, z } from "../_shared/body.ts";
import { fail, json, preflight } from "../_shared/cors.ts";
import { claimsOf, codesLeft, createCodes, RecoveryRefused, redeemCode, removeFactor, type Candidate, type RecoveryDeps } from "./core.ts";

const Body = z.object({
  action: z.enum(["create", "redeem", "status", "remove_factor"]),
  code: z.string().max(32).optional(),
  factorId: z.string().max(64).optional(),
});

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== "POST") return fail(req, 405, "Use POST.");

  const caller = await getCaller(req);
  if (!caller) return fail(req, 401, "Sign in first.");
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

  const body = await readBody(req, Body);
  if (!body.ok) return fail(req, 400, body.error);

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const rpc = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await admin.rpc(fn, args);
    if (error) throw error;
    return data as T;
  };

  const deps: RecoveryDeps = {
    userId: caller.id,
    claims: claimsOf(token),
    now: () => Date.now(),
    random: (bytes) => crypto.getRandomValues(new Uint8Array(bytes)),
    sha256Hex,
    replace: (userId, salts, hashes) => rpc<void>("replace_backup_codes", { _user_id: userId, _salts: salts, _hashes: hashes }),
    candidates: (userId) => rpc<Candidate[]>("backup_code_candidates", { _user_id: userId }).then((rows) => rows ?? []),
    spend: (userId, codeId, sessionId) => rpc<boolean>("spend_backup_code", { _user_id: userId, _code_id: codeId, _session_id: sessionId }).then((ok) => ok === true),
    left: (userId) => rpc<number>("backup_codes_left", { _user_id: userId }).then((n) => n ?? 0),
    recoveredAt: (sessionId, userId) => rpc<string | null>("session_recovered_at", { _session_id: sessionId, _user_id: userId }),
    verifiedFactorIds: async (userId) => {
      const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });
      if (error) throw error;
      return (data?.factors ?? []).filter((factor: { status: string }) => factor.status === "verified").map((factor: { id: string }) => factor.id);
    },
    deleteFactor: async (userId, factorId) => {
      const { error } = await admin.auth.admin.mfa.deleteFactor({ id: factorId, userId });
      if (error) throw error;
    },
    hit: async (bucket, limit, windowSeconds) => {
      try {
        return await rpc<boolean>("edge_rate_limit_hit", { _bucket: bucket, _limit: limit, _window_seconds: windowSeconds });
      } catch {
        // The store failing must not open the door: refuse the attempt.
        return false;
      }
    },
  };

  try {
    switch (body.data.action) {
      case "create":
        return json(req, { codes: await createCodes(deps) });
      case "redeem":
        await redeemCode(deps, body.data.code ?? "");
        return json(req, { ok: true });
      case "status":
        return json(req, { left: await codesLeft(deps) });
      case "remove_factor":
        await removeFactor(deps, body.data.factorId ?? "");
        return json(req, { ok: true });
    }
  } catch (error) {
    if (error instanceof RecoveryRefused) return fail(req, error.status, error.message);
    return fail(req, 500, "Something went wrong. Try again.");
  }
  return fail(req, 400, "Unknown action.");
});
