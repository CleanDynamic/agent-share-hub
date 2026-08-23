// Build header reads and writes, and the composed record every consumer uses.

import { supabase } from "@/integrations/supabase/client";
import { getEvents } from "./events";
import { getNodeTypes } from "./nodeTypes";
import { getBuildNodes, splitNodes } from "./nodes";
import {
  buildLayerError,
  DEFAULT_LIMIT,
  type Build,
  type BuildRecord,
  type BuildShape,
  type BuildStatus,
  type BuildUpdate,
} from "./types";

// One string literal, not a concatenation: the typed client infers the row
// shape from this text, and a joined expression defeats that inference.
const BUILD_COLUMNS =
  "id, creator_id, slug, title, outcome, shape, status, made_for, made_with, live_url, repo_url, hero_node_id, cost_setup, cost_monthly, currency, time_to_first_result, completeness, reproduction_count, last_confirmed_at, last_confirmed_model, parent_build_id, root_build_id, forked_from_event_id, monetisation_type, price_gbp, donation_enabled, created_at, updated_at, published_at";

const SLUG_SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const SLUG_SUFFIX_LENGTH = 6;
const SLUG_BODY_MAX = 60;

export interface CreateBuildInput {
  title: string;
  outcome?: string | null;
  shape?: BuildShape;
  made_for?: string[];
  made_with?: string[];
}

export interface ComposeOptions {
  /** Pass true on the creator's own surfaces to include hidden events. */
  includeHidden?: boolean;
}

export interface ListBuildsOptions {
  status?: BuildStatus;
  limit?: number;
}

function randomSuffix(length: number): string {
  const bytes = new Uint8Array(length);
  const webCrypto = globalThis.crypto;
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += SLUG_SUFFIX_ALPHABET[bytes[i] % SLUG_SUFFIX_ALPHABET.length];
  }
  return out;
}

/**
 * Lowercased, hyphenated title plus a random suffix. The suffix is what
 * guarantees uniqueness, so two builds may share a title without a retry loop.
 */
export function slugifyTitle(title: string): string {
  const body =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, SLUG_BODY_MAX)
      .replace(/-+$/, "") || "build";
  return `${body}-${randomSuffix(SLUG_SUFFIX_LENGTH)}`;
}

/** Assembles the composed record around an already-loaded header. */
async function compose(build: Build, { includeHidden = false }: ComposeOptions): Promise<BuildRecord> {
  const [nodes, events, nodeTypes] = await Promise.all([
    getBuildNodes(build.id),
    getEvents(build.id, { includeHidden }),
    getNodeTypes(),
  ]);
  const { tree, tray } = splitNodes(nodes);
  return { build, tree, tray, events, nodeTypes };
}

/** Starts a draft owned by the signed-in user. */
export async function createBuild(input: CreateBuildInput): Promise<Build> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw buildLayerError("createBuild (session)", authError);
  const creatorId = auth?.user?.id;
  if (!creatorId) {
    throw buildLayerError("createBuild", { message: "no signed-in user" });
  }

  const { data, error } = await supabase
    .from("builds")
    .insert({
      creator_id: creatorId,
      slug: slugifyTitle(input.title),
      title: input.title,
      outcome: input.outcome ?? null,
      shape: input.shape ?? "other",
      status: "draft",
      made_for: input.made_for ?? [],
      made_with: input.made_with ?? [],
    })
    .select(BUILD_COLUMNS)
    .single();
  if (error) throw buildLayerError("createBuild", error);
  return data as Build;
}

/** The composed record for one build id. */
export async function getBuild(id: string, options: ComposeOptions = {}): Promise<BuildRecord> {
  const { data, error } = await supabase
    .from("builds")
    .select(BUILD_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw buildLayerError("getBuild", error);
  if (!data) throw buildLayerError("getBuild", { message: `no build with id ${id}` });
  return compose(data as Build, options);
}

/** The composed record for one build slug. */
export async function getBuildBySlug(
  slug: string,
  options: ComposeOptions = {}
): Promise<BuildRecord> {
  const { data, error } = await supabase
    .from("builds")
    .select(BUILD_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw buildLayerError("getBuildBySlug", error);
  if (!data) throw buildLayerError("getBuildBySlug", { message: `no build with slug ${slug}` });
  return compose(data as Build, options);
}

/** Patches the header. updated_at is maintained by a trigger, never here. */
export async function updateBuild(id: string, patch: BuildUpdate): Promise<Build> {
  const { data, error } = await supabase
    .from("builds")
    .update(patch)
    .eq("id", id)
    .select(BUILD_COLUMNS)
    .single();
  if (error) throw buildLayerError("updateBuild", error);
  return data as Build;
}

/** A creator's builds, newest first. Headers only — no nodes, no events. */
export async function listBuildsByCreator(
  creatorId: string,
  { status, limit = DEFAULT_LIMIT }: ListBuildsOptions = {}
): Promise<Build[]> {
  let query = supabase.from("builds").select(BUILD_COLUMNS).eq("creator_id", creatorId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw buildLayerError("listBuildsByCreator", error);
  return (data ?? []) as Build[];
}

/** Deletes a build. Nodes and events cascade. */
export async function deleteBuild(id: string): Promise<void> {
  const { error } = await supabase.from("builds").delete().eq("id", id);
  if (error) throw buildLayerError("deleteBuild", error);
}
