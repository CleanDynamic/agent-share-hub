// =============================================================================
// NeoScale — parse-repo (NS-P21)
// =============================================================================
// A public repository URL in, a PROPOSED draft out. Like parse-transcript and
// parse-lovable it writes nothing: no build_events row, no build_nodes row, no
// builds column. It reads one row of builds to confirm the caller owns the
// build it is proposing against, reads ai_tools_registry for canonical tool
// names, and everything else it returns is a suggestion the intake surface
// (NS-P14) lets a creator accept, edit or throw away.
//
// This shell is parse-lovable's, which is parse-transcript's, deliberately: the
// same CORS header set, the same {error} body, the same explicit statuses, the
// same caller-token client. Three parsers that answered differently to the same
// bad request would be three contracts, and the point is that there is one.
//
// AUTHENTICATION. verify_jwt = true in supabase/config.toml, deliberately, and
// for the same reason as the other two: this proposes against a build the
// caller must own, so the gateway must reject an unauthenticated call before
// this code runs. The header check below is the second lock, not the first.
//
// The Supabase client is built with the CALLER's token, so every read runs
// under their RLS. The service role key is never used here.
//
// A REPOSITORY IS A SUGGESTION SOURCE, NOT AN IMPORT TARGET. The limits live in
// github.ts and snapshot.ts and are absolute: at most 40 file reads, nothing
// over 200KB, and no clone anywhere in the path.
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { FetchBudget, parseRepoUrl, RepoReadError, readRepoSnapshot } from "./github.ts";
import { parseRepo } from "./parse.ts";
import type { RegistryTool } from "./snapshot.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SOURCE_HINT_CHARS = 120;
const MAX_URL_CHARS = 500;

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
    return fail("parse-repo accepts POST only.", 405);
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
      return fail("Request body must be JSON: { repo_url, build_id, source_hint? }.", 400);
    }
    if (!body || typeof body !== "object") {
      return fail("Request body must be JSON: { repo_url, build_id, source_hint? }.", 400);
    }

    const { repo_url, build_id, source_hint } = body as {
      repo_url?: unknown;
      build_id?: unknown;
      source_hint?: unknown;
    };

    if (typeof repo_url !== "string" || repo_url.trim() === "") {
      return fail("repo_url is required and must be a string.", 400);
    }
    if (repo_url.length > MAX_URL_CHARS) {
      return fail("repo_url is too long to be a repository URL.", 400);
    }
    if (typeof build_id !== "string" || !UUID.test(build_id)) {
      return fail("build_id is required and must be a uuid.", 400);
    }
    if (source_hint !== undefined && source_hint !== null && typeof source_hint !== "string") {
      return fail("source_hint must be a string when present.", 400);
    }
    const hint = typeof source_hint === "string" ? source_hint.trim().slice(0, MAX_SOURCE_HINT_CHARS) : null;

    const coordinates = parseRepoUrl(repo_url);
    if (!coordinates) {
      return fail(
        `That is not a GitHub repository URL. It should look like ` +
          `https://github.com/owner/repository. Only GitHub is read for now.`,
        400,
      );
    }

    // Ownership, before any fetching. A build the caller cannot see and a build
    // the caller does not own answer identically, so this cannot be used to
    // probe for build ids — and nothing reaches GitHub until it passes.
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

    // The canonical names made_with has to match. Read under the caller's RLS,
    // which allows approved rows to anyone — see ai_tools_registry's policy.
    // A registry that cannot be read is not fatal: the proposal falls back to
    // the reader's own display names, which the gallery already tolerates.
    let registry: RegistryTool[] = [];
    const { data: tools, error: registryError } = await supabase
      .from("ai_tools_registry")
      .select("name, slug")
      .eq("status", "approved");

    if (!registryError && Array.isArray(tools)) {
      registry = tools as RegistryTool[];
    }

    const budget = new FetchBudget();
    const snapshot = await readRepoSnapshot(coordinates, budget);

    const result = parseRepo(snapshot, registry, {
      session_id: crypto.randomUUID(),
      source_hint: hint ?? `${coordinates.owner}/${coordinates.repo}`,
    });

    if (registryError) {
      result.warnings.push({
        code: "registry_unavailable",
        message: `The tool registry could not be read, so tool names are this reader's own ` +
          `spelling rather than the canonical ones. They will still save.`,
      });
    }

    // A proposal. Nothing above wrote, and nothing below writes.
    return respond(result, 200);
  } catch (error) {
    // A repository that is private, missing, rate-limited or unreachable is a
    // readable sentence and its own status — never a 500. NS-P21 acceptance 3.
    if (error instanceof RepoReadError) {
      return fail(error.message, error.status);
    }
    return fail((error as Error).message ?? "parse-repo failed.", 500);
  }
});
