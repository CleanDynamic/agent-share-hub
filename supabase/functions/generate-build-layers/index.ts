// =============================================================================
// NeoScale — generate-build-layers (NS-P22)
// =============================================================================
// A build id in, its two explanation layers out:
//
//   run         do this, then this. No understanding required.
//   understand  what each step does and why, in plain language.
//
// THIS IS ONLY MECHANICALLY POSSIBLE BECAUSE THE RECORD IS TYPED. The model is
// given a structured description assembled from typed nodes, their declared
// required fields and the kept sequence — never prose, and never the whole
// payloads. Do not add a path that generates layers from a document.
//
// Unlike parse-transcript, parse-lovable and parse-repo, THIS FUNCTION WRITES.
// It is the first in the NS series that does, so the three rules that keep it
// from destroying work are in one place here:
//
//   1. SAME HASH, NO MODEL CALL. If a row already records the same node tree
//      hash, it is returned untouched. generated_at does not move and nothing
//      is billed. (Acceptance 2 is a timing check, and this is what it times.)
//
//   2. APPROVED CONTENT IS NEVER OVERWRITTEN. A row whose hash no longer
//      matches but which a human approved comes back with stale: true and its
//      content intact. The client asks the creator; it does not decide.
//
//   3. force: true IS THE CREATOR'S OWN ANSWER TO 2. Only NS-P23 sets it, only
//      from an explicit action, and it regenerates even on an unchanged tree —
//      "regenerate this" from a creator who has edited the text must actually
//      regenerate, or the button does nothing.
//
// AUTHENTICATION. verify_jwt = true in supabase/config.toml, for the same
// reason as the three parsers: this acts on a build the caller must own, so
// the gateway rejects an unauthenticated call before this code runs. The
// header check below is the second lock, not the first. The Supabase client
// carries the CALLER's token, so every read and every write runs under their
// RLS. The service role key is never used here.
// =============================================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildTree, describeRecord, mintRefs } from "./describe.ts";
import { hashNodeTree } from "./hash.ts";
import {
  generateLayer,
  missingKeyMessage,
  ModelError,
  resolveModel,
} from "./model.ts";
import { isLayer, LAYERS } from "./types.ts";
import type {
  BuildRow,
  EventRow,
  Layer,
  NodeRow,
  NodeTypeRow,
  Step,
} from "./types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface LayerRow {
  id: string;
  build_id: string;
  layer: Layer;
  content: { steps: Step[] };
  generated_at: string;
  generated_from_hash: string;
  approved: boolean;
  approved_at: string | null;
  edited_by_creator: boolean;
  model_used: string | null;
}

type LayerStatus = "generated" | "unchanged" | "stale" | "failed";

interface LayerResult {
  layer: Layer;
  status: LayerStatus;
  /** Present and true only when an existing row was protected from a rewrite. */
  stale?: true;
  /** Which flag protected it: what NS-P23 tells the creator. */
  protected_by?: "approved" | "edited_by_creator";
  row: LayerRow | null;
  error?: string;
}

interface Warning {
  code: string;
  message: string;
}

function respond(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(message: string, status: number): Response {
  return respond({ error: message }, status);
}

/** Which layers the caller asked for, deduped and ordered. Both by default. */
function requestedLayers(value: unknown): Layer[] | string {
  if (value === undefined || value === null) return [...LAYERS];
  if (!Array.isArray(value)) {
    return "layers must be an array of 'run' and/or 'understand'.";
  }
  if (value.length === 0) {
    return "layers must name at least one of 'run' and 'understand'.";
  }
  const chosen: Layer[] = [];
  for (const entry of value) {
    if (!isLayer(entry)) {
      return `'${String(entry)}' is not a layer. Only 'run' and 'understand' exist.`;
    }
    if (!chosen.includes(entry)) chosen.push(entry);
  }
  return LAYERS.filter((l) => chosen.includes(l));
}

type Decision =
  | { kind: "unchanged"; row: LayerRow }
  | { kind: "stale"; row: LayerRow; protectedBy: "approved" | "edited_by_creator" }
  | { kind: "generate" };

/**
 * The whole overwrite policy, in one readable place. Read it against the three
 * rules at the top of this file — it is the only code that implements them.
 */
function decide(
  existing: LayerRow | undefined,
  hash: string,
  force: boolean,
): Decision {
  if (force) return { kind: "generate" };
  if (!existing) return { kind: "generate" };
  if (existing.generated_from_hash === hash) {
    return { kind: "unchanged", row: existing };
  }
  if (existing.approved) {
    return { kind: "stale", row: existing, protectedBy: "approved" };
  }
  // Not in the handover, and deliberate: content a creator has rewritten is
  // their work whether or not they got as far as approving it. Overwriting it
  // silently is exactly the failure the approved rule exists to prevent, and
  // force: true unblocks it the same way.
  if (existing.edited_by_creator) {
    return { kind: "stale", row: existing, protectedBy: "edited_by_creator" };
  }
  return { kind: "generate" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return fail("generate-build-layers accepts POST only.", 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !/^Bearer\s+\S/i.test(authHeader)) {
      return fail(
        "Authentication required: send the signed-in user's access token as a Bearer token.",
        401,
      );
    }
    const token = authHeader.replace(/^Bearer\s+/i, "");

    // The caller's token, not the service role: every read and write below
    // runs under their RLS.
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
      return fail(
        "Request body must be JSON: { build_id, layers?, force? }.",
        400,
      );
    }
    if (!body || typeof body !== "object") {
      return fail(
        "Request body must be JSON: { build_id, layers?, force? }.",
        400,
      );
    }

    const { build_id, layers, force } = body as {
      build_id?: unknown;
      layers?: unknown;
      force?: unknown;
    };

    if (typeof build_id !== "string" || !UUID.test(build_id)) {
      return fail("build_id is required and must be a uuid.", 400);
    }
    if (force !== undefined && typeof force !== "boolean") {
      return fail("force must be true or false when present.", 400);
    }
    const wanted = requestedLayers(layers);
    if (typeof wanted === "string") return fail(wanted, 400);
    const forced = force === true;

    // Ownership, before anything is read or generated. A build the caller
    // cannot see and a build the caller does not own answer identically, so
    // this cannot be used to probe for build ids.
    const { data: build, error: buildError } = await supabase
      .from("builds")
      .select("id, creator_id, title, outcome, shape, made_for, made_with")
      .eq("id", build_id)
      .maybeSingle<BuildRow>();

    if (buildError) {
      return fail(`Could not read that build: ${buildError.message}`, 500);
    }
    if (!build) {
      return fail("That build does not exist or is not yours to generate for.", 403);
    }
    if (build.creator_id !== user.id) {
      const { data: admin } = await supabase.rpc("is_admin", { _user_id: user.id });
      if (admin !== true) {
        return fail(
          "That build does not exist or is not yours to generate for.",
          403,
        );
      }
    }

    const [nodesResult, eventsResult, typesResult, existingResult] = await Promise.all([
      supabase
        .from("build_nodes")
        .select("id, parent_id, position, type, title, note, payload, is_gap")
        .eq("build_id", build_id),
      supabase
        .from("build_events")
        .select("id, ordinal, kind, phase_title, visibility, payload, produced_node_id")
        .eq("build_id", build_id)
        .eq("visibility", "kept")
        .order("ordinal", { ascending: true }),
      supabase.from("node_types").select("key, label, category, schema"),
      supabase.from("build_layers").select("*").eq("build_id", build_id),
    ]);

    if (nodesResult.error) {
      return fail(`Could not read this build's nodes: ${nodesResult.error.message}`, 500);
    }
    if (eventsResult.error) {
      return fail(`Could not read this build's events: ${eventsResult.error.message}`, 500);
    }
    if (typesResult.error) {
      return fail(`Could not read the node type registry: ${typesResult.error.message}`, 500);
    }
    if (existingResult.error) {
      return fail(
        `Could not read this build's existing layers: ${existingResult.error.message}`,
        500,
      );
    }

    const nodes = (nodesResult.data ?? []) as NodeRow[];
    const events = (eventsResult.data ?? []) as EventRow[];
    const nodeTypes = (typesResult.data ?? []) as NodeTypeRow[];
    const existingRows = (existingResult.data ?? []) as LayerRow[];

    const tree = buildTree(nodes);
    if (tree.length === 0) {
      return fail(
        "This build has no placed nodes yet, so there is nothing to explain. " +
          "Place at least one node in the tree first — material sitting in the tray is not part of the record.",
        422,
      );
    }

    const { refOf } = mintRefs(tree);
    const hash = await hashNodeTree(tree);

    const existingByLayer = new Map<Layer, LayerRow>(
      existingRows.map((row) => [row.layer, row]),
    );

    const decisions = new Map<Layer, Decision>(
      wanted.map((layer) => [layer, decide(existingByLayer.get(layer), hash, forced)]),
    );
    const toGenerate = wanted.filter((l) => decisions.get(l)?.kind === "generate");

    const warnings: Warning[] = [];
    const results = new Map<Layer, LayerResult>();

    for (const layer of wanted) {
      const decision = decisions.get(layer)!;
      if (decision.kind === "unchanged") {
        results.set(layer, { layer, status: "unchanged", row: decision.row });
      } else if (decision.kind === "stale") {
        results.set(layer, {
          layer,
          status: "stale",
          stale: true,
          protected_by: decision.protectedBy,
          row: decision.row,
        });
      }
    }

    let modelUsed: string | null = null;

    if (toGenerate.length > 0) {
      const resolved = resolveModel((name) => Deno.env.get(name));
      if (!resolved) {
        return fail(missingKeyMessage((name) => Deno.env.get(name)), 503);
      }
      modelUsed = resolved.label;

      // One description, both layers. It is the expensive thing to assemble and
      // the two layers describe the same record.
      const description = describeRecord(build, tree, events, nodeTypes, refOf);
      if (description.reduction) {
        warnings.push({
          code: "record_summarised",
          message:
            `This build is large, so ${description.reduction} before the record ` +
            `was described. The shape of the build is intact; the deepest detail is not.`,
        });
      }

      const generated = await Promise.allSettled(
        toGenerate.map((layer) =>
          generateLayer(resolved, layer, description.text, description.refs)
        ),
      );

      const rowsToWrite: Array<Record<string, unknown>> = [];
      const generatedAt = new Date().toISOString();

      generated.forEach((outcome, index) => {
        const layer = toGenerate[index];
        if (outcome.status === "fulfilled") {
          rowsToWrite.push({
            build_id,
            layer,
            content: { steps: outcome.value },
            generated_at: generatedAt,
            generated_from_hash: hash,
            model_used: resolved.label,
            // Freshly generated content has not been reviewed by anyone. A
            // forced regeneration over an approved row resets that: NS-P23
            // shows it for approval again rather than inheriting a tick that
            // was given to different words.
            approved: false,
            approved_at: null,
            edited_by_creator: false,
          });
        } else {
          const error = outcome.reason;
          const message = error instanceof ModelError
            ? error.message
            : `Generating the ${layer} layer failed: ${(error as Error).message}`;
          results.set(layer, { layer, status: "failed", row: null, error: message });
          warnings.push({ code: "layer_failed", message });
        }
      });

      if (rowsToWrite.length > 0) {
        const { data: written, error: writeError } = await supabase
          .from("build_layers")
          .upsert(rowsToWrite, { onConflict: "build_id,layer" })
          .select();

        if (writeError) {
          return fail(
            `The layers were generated but could not be saved: ${writeError.message}`,
            500,
          );
        }

        for (const row of (written ?? []) as LayerRow[]) {
          results.set(row.layer, { layer: row.layer, status: "generated", row });
        }
      }

      // Every requested layer needed the model and every call failed.
      const anyRow = wanted.some((l) => results.get(l)?.row);
      if (!anyRow) {
        const first = wanted
          .map((l) => results.get(l))
          .find((r) => r?.status === "failed");
        return fail(
          first?.error ?? "No layer could be generated.",
          first?.error?.includes("did not answer within") ? 504 : 502,
        );
      }
    }

    const ordered = wanted.map((layer) =>
      results.get(layer) ?? { layer, status: "failed" as const, row: null }
    );

    return respond({
      build_id,
      generated_from_hash: hash,
      model_used: modelUsed,
      stale: ordered.some((r) => r.status === "stale"),
      layers: ordered,
      warnings,
    }, 200);
  } catch (error) {
    if (error instanceof ModelError) {
      return fail(error.message, error.status);
    }
    return fail((error as Error).message ?? "generate-build-layers failed.", 500);
  }
});
