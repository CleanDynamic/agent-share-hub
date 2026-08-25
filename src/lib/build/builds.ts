// builds: the build header, and the one call that composes a whole build
// record for a consumer.

import { supabase } from "@/integrations/supabase/client";
import { getEvents } from "./events";
import { getNodeTree, getTray } from "./nodes";
import { getNodeTypes } from "./nodeTypes";
import {
  buildLayerError,
  type Build,
  type BuildPatch,
  type BuildRecord,
  type BuildShape,
} from "./types";

// One string literal, not a concatenation: PostgREST parses the column list at
// the type level, and `+` erases the literal type it needs.
export const BUILD_COLUMNS =
  "id, creator_id, slug, title, outcome, shape, status, made_for, made_with, live_url, repo_url, hero_node_id, cost_setup, cost_monthly, currency, time_to_first_result, completeness, reproduction_count, last_confirmed_at, last_confirmed_model, parent_build_id, root_build_id, forked_from_event_id, source_content_item_id, monetisation_type, price_gbp, donation_enabled, created_at, updated_at, published_at";

const CREATOR_LIST_LIMIT = 50;

/** Longest slug body before the uniqueness suffix. */
const SLUG_BODY_MAX = 60;

const SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const SUFFIX_LENGTH = 6;

export interface CreateBuildInput {
  title: string;
  outcome?: string | null;
  shape?: BuildShape;
  made_for?: string[];
  made_with?: string[];
  live_url?: string | null;
  repo_url?: string | null;
}

export interface ListBuildsOptions {
  limit?: number;
  offset?: number;
}

/** Six random characters from a-z0-9, so two identical titles never collide. */
function randomSuffix(): string {
  const bytes = new Uint8Array(SUFFIX_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) out += SUFFIX_ALPHABET[byte % SUFFIX_ALPHABET.length];
  return out;
}

/**
 * "Inbox Triage Agent" -> "inbox-triage-agent-k3f9x1".
 *
 * The suffix is what guarantees uniqueness, so a title that reduces to nothing
 * (all punctuation, or a non-Latin script) still yields a usable slug.
 */
export function slugifyTitle(title: string): string {
  const body = (title ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_BODY_MAX)
    .replace(/-+$/g, "");

  return `${body || "build"}-${randomSuffix()}`;
}

/**
 * Create a draft build owned by the signed-in user.
 *
 * creator_id comes from the session rather than the caller — the RLS insert
 * policy checks it against (select auth.uid()) anyway, so accepting it as an
 * argument would only invite a confusing 403.
 */
export async function createBuild(input: CreateBuildInput): Promise<Build> {
  const title = (input.title ?? "").trim();
  if (!title) throw buildLayerError("createBuild", new Error("title is required"));

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  if (sessionError) throw buildLayerError("createBuild (session)", sessionError);

  const creatorId = sessionData.session?.user?.id;
  if (!creatorId) {
    throw buildLayerError("createBuild", new Error("no signed-in user"));
  }

  const { data, error } = await supabase
    .from("builds")
    .insert({
      creator_id: creatorId,
      slug: slugifyTitle(title),
      title,
      outcome: input.outcome ?? null,
      shape: input.shape ?? "other",
      status: "draft",
      made_for: input.made_for ?? [],
      made_with: input.made_with ?? [],
      live_url: input.live_url ?? null,
      repo_url: input.repo_url ?? null,
    })
    .select(BUILD_COLUMNS)
    .single();

  if (error) throw buildLayerError("createBuild", error);
  return data as Build;
}

/** The build header alone. Prefer getBuild unless you truly only need this. */
export async function getBuildHeader(id: string): Promise<Build | null> {
  const { data, error } = await supabase
    .from("builds")
    .select(BUILD_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw buildLayerError("getBuildHeader", error);
  return (data as Build | null) ?? null;
}

/**
 * The composed build record: header, placed tree, tray, events and the node
 * type registry, in one call.
 *
 * This is the shape every consumer in this sequence takes. Components do not
 * assemble it themselves — that is the mistake that produced the fifteen-query
 * home feed. The four dependent reads run concurrently.
 */
export async function getBuild(id: string): Promise<BuildRecord | null> {
  const build = await getBuildHeader(id);
  if (!build) return null;
  return composeRecord(build);
}

/** The composed build record, addressed by slug. Same shape as getBuild. */
export async function getBuildBySlug(slug: string): Promise<BuildRecord | null> {
  const { data, error } = await supabase
    .from("builds")
    .select(BUILD_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw buildLayerError("getBuildBySlug", error);
  if (!data) return null;
  return composeRecord(data as Build);
}

async function composeRecord(build: Build): Promise<BuildRecord> {
  const [tree, tray, events, nodeTypes] = await Promise.all([
    getNodeTree(build.id),
    getTray(build.id),
    getEvents(build.id),
    getNodeTypes(),
  ]);
  return { build, tree, tray, events, nodeTypes };
}

/** Patch the header. Returns the row as it stands after the write. */
export async function updateBuild(
  id: string,
  patch: BuildPatch
): Promise<Build> {
  const { data, error } = await supabase
    .from("builds")
    .update(patch)
    .eq("id", id)
    .select(BUILD_COLUMNS)
    .single();

  if (error) throw buildLayerError("updateBuild", error);
  return data as Build;
}

/**
 * A creator's builds, newest first. Headers only — a list never needs the
 * nodes, and fetching them is how a profile page turns into fifty queries.
 */
export async function listBuildsByCreator(
  creatorId: string,
  { limit = CREATOR_LIST_LIMIT, offset = 0 }: ListBuildsOptions = {}
): Promise<Build[]> {
  const { data, error } = await supabase
    .from("builds")
    .select(BUILD_COLUMNS)
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)
    .limit(limit);

  if (error) throw buildLayerError("listBuildsByCreator", error);
  return (data ?? []) as Build[];
}

/**
 * A creator's unpublished builds, most recently worked on first.
 *
 * Ordered by updated_at rather than created_at because this feeds a drafts
 * list, where "what was I last in the middle of" is the question being asked.
 */
export async function listDraftBuildsByCreator(
  creatorId: string,
  { limit = CREATOR_LIST_LIMIT, offset = 0 }: ListBuildsOptions = {}
): Promise<Build[]> {
  const { data, error } = await supabase
    .from("builds")
    .select(BUILD_COLUMNS)
    .eq("creator_id", creatorId)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1)
    .limit(limit);

  if (error) throw buildLayerError("listDraftBuildsByCreator", error);
  return (data ?? []) as Build[];
}

/** Delete a build. Nodes and events go with it — the FKs cascade. */
export async function deleteBuild(id: string): Promise<void> {
  const { error } = await supabase.from("builds").delete().eq("id", id);
  if (error) throw buildLayerError("deleteBuild", error);
}
