// The two generated explanation layers: reading them, asking for them, and
// recording what the creator decided about them.
//
// NS-P22 added the table and the edge function. This module is everything the
// app does with them, and it is deliberately the only place that knows:
//
//   READS ARE SPLIT BY AUDIENCE. getLayers returns every row for a build and
//   is for its creator, inside compose. getApprovedLayers filters on
//   approved = true in the QUERY and is what the public build page calls.
//   RLS makes a published build's layers readable by anyone, approved or not,
//   so "unapproved text is never shown to a reader" is enforced here, in the
//   filter, rather than by remembering to check a flag in every renderer.
//
//   EDITING IS APPROVAL. A creator who rewrites a step has taken the words as
//   their own, so editLayer writes edited_by_creator AND approved together.
//   There is no path that saves a creator's words without approving them, and
//   no path that approves without the creator pressing something.
//
//   THE HASH IS MIRRORED, NOT FETCHED. staleness is "the record moved since
//   these words were written", and the record is already in the browser. The
//   hash below is a line-for-line port of
//   supabase/functions/generate-build-layers/hash.ts so compose can answer
//   that question without calling the function — which is what makes "never
//   regenerate without asking" affordable. A drift between the two files
//   shows up as a build that always looks stale, and layers.hash.test.ts
//   fails against the real function source before it can reach anyone.
//
// Nothing here regenerates on its own. Every call to the function comes from a
// creator pressing something: the review pass at publish, or the one quiet
// line that offers to rewrite a stale layer.

import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables, TablesUpdate } from "@/integrations/supabase/types";
// buildLayerError is the data layer's error wrapper from NS-P03 — "layer" as
// in the app's layering, not as in build_layers. The collision is unfortunate
// and is not worth a rename across nine modules.
import { buildLayerError } from "./types";
import type { NodeTree } from "./types";

// -----------------------------------------------------------------------------
// Shapes
// -----------------------------------------------------------------------------

export type Layer = "run" | "understand";

export const LAYERS: readonly Layer[] = ["run", "understand"] as const;

export function isLayer(value: unknown): value is Layer {
  return value === "run" || value === "understand";
}

/** One step of a generated layer, exactly as stored in build_layers.content. */
export interface LayerStep {
  n: number;
  title: string;
  body: string;
  /** A build_nodes.id in this build, or null. Resolved by the renderer. */
  node_ref: string | null;
}

export interface LayerContent {
  steps: LayerStep[];
}

type BuildLayerRow = Tables<"build_layers">;

/** A row with its two open columns narrowed to what the function writes. */
export interface BuildLayer extends Omit<BuildLayerRow, "content" | "layer"> {
  layer: Layer;
  content: LayerContent;
}

export const LAYER_COLUMNS =
  "id, build_id, layer, content, generated_at, generated_from_hash, approved, approved_at, edited_by_creator, model_used";

/**
 * The line every generated layer carries wherever it is rendered.
 *
 * One constant, used by the review pass and by the public page, so the promise
 * a creator approves is the sentence a reader is shown. Generated text is
 * never presented as the creator's own words, and this is what says so.
 */
export const LAYER_ATTRIBUTION =
  "Written by NeoScale from this build’s record, reviewed by the creator.";

export const LAYER_TITLE: Record<Layer, string> = {
  run: "Run it",
  understand: "Understand it",
};

export const LAYER_BLURB: Record<Layer, string> = {
  run: "Do this, then this. No understanding required.",
  understand: "What each step does, and why, in plain language.",
};

// -----------------------------------------------------------------------------
// Reading
// -----------------------------------------------------------------------------

/**
 * One row, with content coerced to the documented shape.
 *
 * content is jsonb with one CHECK on it — steps is an array — so everything
 * inside a step is checked here rather than trusted. A step missing its body
 * renders as an empty body; a row whose layer is not one of the two is
 * dropped, because nothing in the app knows where to put it.
 */
function parseLayer(row: BuildLayerRow): BuildLayer | null {
  if (!isLayer(row.layer)) return null;

  const raw = row.content as { steps?: unknown } | null;
  const steps = Array.isArray(raw?.steps) ? raw.steps : [];

  const parsed: LayerStep[] = steps
    .filter((step): step is Record<string, unknown> =>
      Boolean(step) && typeof step === "object" && !Array.isArray(step)
    )
    .map((step, index) => ({
      n: typeof step.n === "number" ? step.n : index + 1,
      title: typeof step.title === "string" ? step.title : "",
      body: typeof step.body === "string" ? step.body : "",
      node_ref: typeof step.node_ref === "string" ? step.node_ref : null,
    }));

  return { ...row, layer: row.layer, content: { steps: parsed } };
}

/** run before understand, whatever order the rows arrived in. */
function inLayerOrder(rows: BuildLayer[]): BuildLayer[] {
  return LAYERS.map((layer) => rows.find((row) => row.layer === layer)).filter(
    (row): row is BuildLayer => Boolean(row)
  );
}

async function readLayers(
  buildId: string,
  approvedOnly: boolean,
  operation: string
): Promise<BuildLayer[]> {
  let query = supabase.from("build_layers").select(LAYER_COLUMNS).eq("build_id", buildId);
  if (approvedOnly) query = query.eq("approved", true);

  const { data, error } = await query;
  if (error) throw buildLayerError(operation, error);

  return inLayerOrder(
    ((data ?? []) as BuildLayerRow[])
      .map(parseLayer)
      .filter((row): row is BuildLayer => row !== null)
  );
}

/**
 * Every layer this build has, approved or not. The creator's view.
 *
 * Only ever called from compose, where the caller is the owner: the review
 * pass needs to show unapproved text, and the staleness line needs to see a
 * row a reader is not being shown.
 */
export function getLayers(buildId: string): Promise<BuildLayer[]> {
  return readLayers(buildId, false, "getLayers");
}

/**
 * Only what a creator has signed off. The reader's view.
 *
 * The filter is in the query, not in the caller. A build page that forgets to
 * check a flag is the one bug this whole feature cannot afford, so the
 * unapproved rows never reach the browser in the first place.
 */
export function getApprovedLayers(buildId: string): Promise<BuildLayer[]> {
  return readLayers(buildId, true, "getApprovedLayers");
}

export function layerOf(layers: BuildLayer[], layer: Layer): BuildLayer | null {
  return layers.find((row) => row.layer === layer) ?? null;
}

// -----------------------------------------------------------------------------
// Generating
// -----------------------------------------------------------------------------

export type LayerStatus = "generated" | "unchanged" | "stale" | "failed";

export interface LayerOutcome {
  layer: Layer;
  status: LayerStatus;
  /** True when an existing row was protected from being overwritten. */
  stale: boolean;
  /** Which flag protected it. What the creator is told about it. */
  protectedBy: "approved" | "edited_by_creator" | null;
  row: BuildLayer | null;
  error: string | null;
}

export interface GenerateLayersResult {
  buildId: string;
  /** The hash the function computed over the record it read. */
  hash: string | null;
  modelUsed: string | null;
  /** True when any requested layer came back protected rather than rewritten. */
  stale: boolean;
  layers: LayerOutcome[];
  warnings: { code: string; message: string }[];
}

export interface GenerateLayersInput {
  buildId: string;
  /** Both, when omitted. */
  layers?: Layer[];
  /**
   * The creator's own answer to a protected row. ONLY set from an explicit
   * press — this is the flag that lets a regeneration overwrite approved text.
   */
  force?: boolean;
}

/** The function's own message, when it sent one, rather than "non-2xx". */
async function readFunctionError(error: unknown): Promise<string> {
  const response = (error as { context?: unknown })?.context as Response | undefined;

  if (response && typeof response.json === "function") {
    try {
      const body = await response.json();
      const message = (body as { error?: unknown })?.error;
      if (typeof message === "string" && message.trim()) return message;
    } catch {
      // Body already consumed, or not JSON. Fall through to the generic text.
    }
  }

  const message = (error as { message?: unknown })?.message;
  return typeof message === "string" && message.trim()
    ? message
    : "generate-build-layers could not be reached.";
}

function parseOutcome(value: unknown): LayerOutcome | null {
  const item = value as {
    layer?: unknown;
    status?: unknown;
    stale?: unknown;
    protected_by?: unknown;
    row?: unknown;
    error?: unknown;
  } | null;
  if (!item || !isLayer(item.layer)) return null;

  const row = item.row ? parseLayer(item.row as BuildLayerRow) : null;

  return {
    layer: item.layer,
    status:
      item.status === "generated" ||
      item.status === "unchanged" ||
      item.status === "stale" ||
      item.status === "failed"
        ? item.status
        : "failed",
    stale: item.stale === true,
    protectedBy:
      item.protected_by === "approved" || item.protected_by === "edited_by_creator"
        ? item.protected_by
        : null,
    row,
    error: typeof item.error === "string" ? item.error : null,
  };
}

/**
 * Ask generate-build-layers for this build's layers.
 *
 * WHAT THIS COSTS depends on the function, not on the caller: an unchanged
 * record returns its stored rows without calling a model, and an approved row
 * whose record has moved comes back protected. So calling this on the way into
 * the review pass is cheap for a build nothing has changed about, and calling
 * it can never silently rewrite work a creator has signed off.
 */
export async function generateLayers({
  buildId,
  layers,
  force,
}: GenerateLayersInput): Promise<GenerateLayersResult> {
  const { data, error } = await supabase.functions.invoke("generate-build-layers", {
    body: {
      build_id: buildId,
      ...(layers ? { layers } : {}),
      ...(force ? { force: true } : {}),
    },
  });

  if (error) {
    throw buildLayerError(
      "generate-build-layers",
      new Error(await readFunctionError(error))
    );
  }

  const body = data as {
    generated_from_hash?: unknown;
    model_used?: unknown;
    stale?: unknown;
    layers?: unknown;
    warnings?: unknown;
  } | null;

  if (!body || typeof body !== "object" || !Array.isArray(body.layers)) {
    throw buildLayerError(
      "generate-build-layers",
      new Error("The generator returned a response this version does not understand.")
    );
  }

  const outcomes = body.layers
    .map(parseOutcome)
    .filter((outcome): outcome is LayerOutcome => outcome !== null);

  return {
    buildId,
    hash: typeof body.generated_from_hash === "string" ? body.generated_from_hash : null,
    modelUsed: typeof body.model_used === "string" ? body.model_used : null,
    stale: body.stale === true || outcomes.some((outcome) => outcome.stale),
    layers: outcomes,
    warnings: Array.isArray(body.warnings)
      ? (body.warnings as { code: string; message: string }[])
      : [],
  };
}

// -----------------------------------------------------------------------------
// What the creator decided
// -----------------------------------------------------------------------------

async function writeLayer(
  id: string,
  patch: TablesUpdate<"build_layers">,
  operation: string
): Promise<BuildLayer> {
  const { data, error } = await supabase
    .from("build_layers")
    .update(patch)
    .eq("id", id)
    .select(LAYER_COLUMNS)
    .single();

  if (error) throw buildLayerError(operation, error);

  const row = parseLayer(data as BuildLayerRow);
  if (!row) {
    throw buildLayerError(operation, new Error("That row is not a layer this app knows."));
  }
  return row;
}

/** Sign off the text as generated. Nothing about the words changes. */
export function approveLayer(id: string): Promise<BuildLayer> {
  return writeLayer(
    id,
    { approved: true, approved_at: new Date().toISOString() },
    "approveLayer"
  );
}

/**
 * The creator's words replace the generated ones.
 *
 * edited_by_creator and approved are written TOGETHER, and that is the whole
 * point: rewriting a step is taking the words as your own, and text a creator
 * has rewritten must never be silently regenerated over. The function reads
 * both flags and protects a row carrying either.
 */
export function editLayer(id: string, steps: LayerStep[]): Promise<BuildLayer> {
  return writeLayer(
    id,
    {
      content: {
        steps: steps.map((step, index) => ({ ...step, n: index + 1 })),
      } as unknown as Json,
      edited_by_creator: true,
      approved: true,
      approved_at: new Date().toISOString(),
    },
    "editLayer"
  );
}

export interface LayerDecision {
  row: BuildLayer;
  /** The creator's text, when they changed it. Absent means untouched. */
  steps?: LayerStep[] | null;
  /** False is a real answer: leave this one unapproved and publish anyway. */
  approve: boolean;
}

/**
 * Everything the review pass decided, in one call.
 *
 * A DECLINED LAYER IS NOT WRITTEN AND NOT DELETED. Skipping leaves the row
 * exactly as generated with approved false, which is what keeps it out of the
 * public page while leaving it there to be approved later without paying for
 * another generation.
 */
export async function commitLayerReview(
  decisions: LayerDecision[]
): Promise<BuildLayer[]> {
  const written = await Promise.all(
    decisions.map((decision) => {
      if (decision.steps) return editLayer(decision.row.id, decision.steps);
      if (decision.approve) return approveLayer(decision.row.id);
      return Promise.resolve(null);
    })
  );

  return written.filter((row): row is BuildLayer => row !== null);
}

// -----------------------------------------------------------------------------
// Staleness — the mirrored hash
// -----------------------------------------------------------------------------
//
// A port of supabase/functions/generate-build-layers/hash.ts. Read that file
// for why the tree is hashed and the sequence is not; this half exists so
// compose can tell a creator their layers have gone stale without calling the
// function to find out.

const HASH_VERSION = "v1";

/**
 * Deterministic JSON: object keys sorted at every level, arrays left alone.
 * Two payloads differing only in key order hash identically.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "null";
  }
  if (typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return "null";
}

/** The exact string that gets hashed. Exported so a mismatch is inspectable. */
export function layerHashInput(tree: NodeTree[]): string {
  const lines: string[] = [HASH_VERSION];

  const walk = (nodes: NodeTree[], depth: number) => {
    for (const node of nodes) {
      lines.push(
        [
          depth,
          node.id,
          node.parent_id ?? "",
          node.position ?? "",
          node.type,
          node.title ?? "",
          node.note ?? "",
          node.is_gap ? "1" : "0",
          canonicalJson(node.payload ?? {}),
        ].join("\t")
      );
      walk(node.children, depth + 1);
    }
  };

  walk(tree, 0);
  return lines.join("\n");
}

/**
 * `v1:<sha-256 hex>` over the placed node tree, or null where the platform
 * has no SubtleCrypto — an http:// origin, an old embedded webview.
 *
 * Null is "cannot tell", and every caller treats it as such: no staleness
 * line is shown rather than a wrong one, and nothing is regenerated.
 */
export async function hashNodeTree(tree: NodeTree[]): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;

  try {
    const bytes = new TextEncoder().encode(layerHashInput(tree));
    const digest = await subtle.digest("SHA-256", bytes);
    const hex = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    return `${HASH_VERSION}:${hex}`;
  } catch {
    return null;
  }
}

/**
 * The layers whose record has moved on since they were written.
 *
 * An unknown hash means an empty answer, never a full one: "we cannot tell"
 * must not read as "everything is stale".
 */
export function staleLayers(layers: BuildLayer[], hash: string | null): BuildLayer[] {
  if (!hash) return [];
  return layers.filter((row) => row.generated_from_hash !== hash);
}

// -----------------------------------------------------------------------------
// Declining, remembered
// -----------------------------------------------------------------------------
//
// An expert who does not want a generated beginner layer on their post can
// decline in one press. Doing that once should not mean doing it again on
// every republish of a record that has not moved — and each re-offer costs a
// model call. So the decline is remembered against the hash of the record it
// was given for, in this browser, and expires the moment the record changes.
//
// localStorage rather than a column: this is a preference about a surface, not
// a fact about the build, and a creator on another machine being offered the
// review again is the harmless side of the trade.

const DECLINED_PREFIX = "neoscale.layer-review.declined.";

/** A hash that could not be computed still needs a stable key. */
function declineValue(hash: string | null): string {
  return hash ?? "unknown";
}

export function recordLayerReviewDeclined(buildId: string, hash: string | null): void {
  try {
    window.localStorage.setItem(DECLINED_PREFIX + buildId, declineValue(hash));
  } catch {
    // Private mode, or storage disabled. The review is offered again; that is
    // the correct failure.
  }
}

export function layerReviewDeclined(buildId: string, hash: string | null): boolean {
  try {
    return window.localStorage.getItem(DECLINED_PREFIX + buildId) === declineValue(hash);
  } catch {
    return false;
  }
}

/** Approving, or the record moving, both make the remembered decline stale. */
export function clearLayerReviewDeclined(buildId: string): void {
  try {
    window.localStorage.removeItem(DECLINED_PREFIX + buildId);
  } catch {
    // Nothing to clear if nothing could be stored.
  }
}

export interface OfferReviewInput {
  buildId: string;
  /** The PLACED tree. An empty one has nothing to explain. */
  tree: NodeTree[];
  /** Every layer the build has, from getLayers. */
  layers: BuildLayer[];
  /** The current record's hash, or null when it could not be computed. */
  hash: string | null;
}

/**
 * Whether pressing Publish should offer the review pass.
 *
 * Three noes, in order of how sure they are:
 *
 *   nothing placed        the generator refuses a build with an empty tree,
 *                         and publication does not wait on it either way.
 *   already reviewed      both layers approved, both written from this exact
 *                         record. There is nothing to show.
 *   already declined      for this exact record, in this browser.
 *
 * Anything else offers it — a missing layer, an unapproved one, a record that
 * has moved since. Declining is always one press, every time it is offered.
 */
export function shouldOfferLayerReview({
  buildId,
  tree,
  layers,
  hash,
}: OfferReviewInput): boolean {
  if (tree.length === 0) return false;

  const settled = LAYERS.every((layer) => {
    const row = layerOf(layers, layer);
    if (!row || !row.approved) return false;
    return hash === null || row.generated_from_hash === hash;
  });
  if (settled) return false;

  return !layerReviewDeclined(buildId, hash);
}
