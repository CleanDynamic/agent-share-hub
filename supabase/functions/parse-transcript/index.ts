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
import { MAX_RAW_TEXT_CHARS, parseTranscript } from "./parse.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SOURCE_HINT_CHARS = 120;

function respond(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(message: string, status: number): Response {
  return respond({ error: message }, status);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return fail("Request body must be JSON: { raw_text, build_id, source_hint? }.", 400);
    }
    if (!body || typeof body !== "object") {
      return fail("Request body must be JSON: { raw_text, build_id, source_hint? }.", 400);
    }

    const { raw_text, build_id, source_hint } = body as {
      raw_text?: unknown;
      build_id?: unknown;
      source_hint?: unknown;
    };

    if (typeof raw_text !== "string") {
      return fail("raw_text is required and must be a string.", 400);
    }
    if (raw_text.trim() === "") {
      return fail("raw_text is empty. Paste the transcript before parsing.", 400);
    }
    if (raw_text.length > MAX_RAW_TEXT_CHARS) {
      return fail(
        `raw_text is ${raw_text.length.toLocaleString("en-GB")} characters, over the ` +
          `${MAX_RAW_TEXT_CHARS.toLocaleString("en-GB")} character limit. Split the transcript and ` +
          `parse it in parts — each part becomes its own proposal you can accept into the same build.`,
        413,
      );
    }
    if (typeof build_id !== "string" || !UUID.test(build_id)) {
      return fail("build_id is required and must be a uuid.", 400);
    }
    if (source_hint !== undefined && source_hint !== null && typeof source_hint !== "string") {
      return fail("source_hint must be a string when present.", 400);
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
      return fail(`Could not read that build: ${buildError.message}`, 500);
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
    return fail((error as Error).message ?? "parse-transcript failed.", 500);
  }
});
