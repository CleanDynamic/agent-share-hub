// =============================================================================
// NeoScale — parse-transcript (NS-P13)
// =============================================================================
// Pasted chat transcript in, a PROPOSED draft out. This function writes
// nothing: no build_events row, no build_nodes row, no builds column. It reads
// one row of builds to confirm the caller owns the build it is being asked to
// propose against, and everything else it returns is a suggestion the intake
// surface (NS-P14) will let a creator accept, edit or throw away.
//
// AUTHENTICATION. verify_jwt = true in supabase/config.toml, deliberately.
// Several of the seed functions in this repo are configured verify_jwt = false
// and are therefore publicly invokable; that is a known defect and not a
// pattern to copy. The gateway rejects an unauthenticated call before this
// code runs, and the header check below is the second lock rather than the
// first — a function that only works because of its configuration is one
// config edit away from being open.
//
// The Supabase client is built with the CALLER's token, so every read runs
// under their RLS. The service role key is never used here: this function has
// no reason to see a build its caller cannot.
//
// Shape and error handling follow import-github-readme — the same CORS header
// set, the same JSON {error} body, the same catch-all — with one deliberate
// difference: statuses are explicit rather than collapsed to 400, because the
// caller has to be able to tell "not signed in" (401) from "not yours" (403)
// from "too big" (413).
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Body } from "./schema.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { fieldError, jsonResponse } from "../_shared/http.ts";
import { MAX_RAW_TEXT_CHARS, parseTranscript } from "../_shared/intake/parsers/transcript.ts";

const MAX_SOURCE_HINT_CHARS = 120;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return preflight(req);
  }
  const respond = (body: unknown, status: number): Response => jsonResponse(body, status, corsHeaders(req));
  const fail = (message: string, status: number): Response => respond({ error: message }, status);

  if (req.method !== "POST") {
    return fail("parse-transcript accepts POST only.", 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !/^Bearer\s+\S/i.test(authHeader)) {
      return fail("Authentication required: send the signed-in user's access token as a Bearer token.", 401);
    }
    const token = authHeader.replace(/^Bearer\s+/i, "");

    // The caller's token, not the service role: reads run under the caller's RLS.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) {
      return fail("Authentication failed: that access token is not valid.", 401);
    }

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail(fieldError(parsed.error), 400);
    const { raw_text, build_id, source_hint } = parsed.data;

    if (raw_text.length > MAX_RAW_TEXT_CHARS) {
      return fail(
        `raw_text is ${raw_text.length.toLocaleString("en-GB")} characters, over the ` +
          `${MAX_RAW_TEXT_CHARS.toLocaleString("en-GB")} character limit. Split the transcript and ` +
          `parse it in parts — each part becomes its own proposal you can accept into the same build.`,
        413,
      );
    }
    const hint = typeof source_hint === "string" ? source_hint.trim().slice(0, MAX_SOURCE_HINT_CHARS) : null;

    // Ownership, before any work. A build the caller cannot see and a build the
    // caller does not own answer identically, so this cannot be used to probe
    // for build ids.
    const { data: build, error: buildError } = await supabase
      .from("builds")
      .select("id, creator_id")
      .eq("id", build_id)
      .maybeSingle();

    if (buildError) {
      console.error("parse-transcript: could not read the build:", buildError);
      return fail("Could not read that build.", 500);
    }
    if (!build || build.creator_id !== user.id) {
      return fail("That build does not exist or is not yours to draft against.", 403);
    }

    const result = parseTranscript(raw_text, {
      session_id: crypto.randomUUID(),
      source_hint: hint,
    });

    // A proposal. Nothing above wrote, and nothing below writes.
    return respond(result, 200);
  } catch (error) {
    console.error("parse-transcript failed:", error);
    return fail("parse-transcript failed.", 500);
  }
});
