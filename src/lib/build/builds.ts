// builds: the build header, and the one call that composes a whole build
// record for a consumer.

import { supabase } from "@/integrations/supabase/client";
import { differingFields, mergeMaking, rowClashes, same } from "./clash";
import { getEvents } from "./events";
import { getNodeTree, getTray } from "./nodes";
import { getNodeTypes } from "./nodeTypes";
import { isStaleWrite, StaleWriteError } from "./pendingWrites";
import { acceptColumns, baseRow, clashHandler, isWatched, isZeroRows, knownStamp, latestRow, noteBuildRow, noteLatest, serial, tellMerged, type RawClash } from "./staleWrites";
import {
  buildLayerError,
  type Build,
  type BuildPatch,
  type BuildRecord,
  type BuildShape,
} from "./types";

// post_doc (PT-01) is newer than the generated types, so PostgREST's type-level
// parser reports it as missing and every read of this list casts through
// unknown to Build, which carries the column as a typed extension (types.ts).
//
// One string literal, not a concatenation: PostgREST parses the column list at
// the type level, and `+` erases the literal type it needs.
//
// The five rebuild columns are on the end because NS-P36 added them and every
// caller of this list already types its result as `Build`, which claims them —
// a header that did not select them was a row lying about its own shape, and
// startRebuild would have written the attribution snapshot and handed back a
// build with no sign of it.
//
// CA-12: `making` is on the end because the composer and the build page both read the build's sessions from it
// (`sessions`, `sessions_meta`: the sessions made here, their app and their day, and which were added the CA-12 way), and a
// record without it showed none of them after a reload.
export const BUILD_COLUMNS =
  "id, creator_id, slug, title, outcome, shape, status, made_for, made_with, live_url, repo_url, hero_node_id, cover_media_id, cost_setup, cost_monthly, currency, time_to_first_result, completeness, reproduction_count, last_confirmed_at, last_confirmed_model, parent_build_id, root_build_id, forked_from_event_id, source_content_item_id, monetisation_type, price_gbp, donation_enabled, created_at, updated_at, published_at, rebuild_note, rebuild_count, source_title_at_fork, source_handle_at_fork, solves_node_id, post_doc, making";

/**
 * SV-03 P2: BUILD_COLUMNS without `post_doc` and `making`, the two large ones. A list of builds (a maker's builds, their
 * drafts) never draws a post or a making, so it does not carry them; opening one build still reads BUILD_COLUMNS.
 *
 * One string literal for the same reason as above: PostgREST parses the list at the type level.
 */
export const BUILD_LIST_COLUMNS =
  "id, creator_id, slug, title, outcome, shape, status, made_for, made_with, live_url, repo_url, hero_node_id, cover_media_id, cost_setup, cost_monthly, currency, time_to_first_result, completeness, reproduction_count, last_confirmed_at, last_confirmed_model, parent_build_id, root_build_id, forked_from_event_id, source_content_item_id, monetisation_type, price_gbp, donation_enabled, created_at, updated_at, published_at, rebuild_note, rebuild_count, source_title_at_fork, source_handle_at_fork, solves_node_id";

/** A build as a list reads it: the header with no post and no making. */
export type BuildListRow = Omit<Build, "post_doc" | "making">;

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
  return data as unknown as Build;
}

/** The build header alone. Prefer getBuild unless you truly only need this. */
export async function getBuildHeader(id: string): Promise<Build | null> {
  const { data, error } = await supabase
    .from("builds")
    .select(BUILD_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw buildLayerError("getBuildHeader", error);
  return (data as unknown as Build | null) ?? null;
}

/**
 * The build header, addressed by slug. One indexed read and no composition.
 *
 * The sibling of getBuildHeader, and it exists for the same reason: a caller
 * that only needs to know WHICH build a slug names should not pay for the tree,
 * the tray, the events and the registry to find out. /rebuild/:slug is exactly
 * that caller — it wants an id to fork and a title to say out loud, and the
 * fork it starts reads the whole record a moment later anyway.
 */
export async function getBuildHeaderBySlug(slug: string): Promise<Build | null> {
  const { data, error } = await supabase
    .from("builds")
    .select(BUILD_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw buildLayerError("getBuildHeaderBySlug", error);
  return (data as unknown as Build | null) ?? null;
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

/**
 * The composed build record, addressed by slug. Same shape as getBuild, plus
 * the maker's name and avatar for the page's credit line (RC-P17b), embedded on the same
 * request rather than asked for separately.
 */
export async function getBuildBySlug(slug: string): Promise<BuildRecord | null> {
  const { data, error } = await supabase
    .from("builds")
    .select(`${BUILD_COLUMNS}, models_used, maker:profiles!builds_creator_id_fkey(username, display_name, avatar_url)`)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw buildLayerError("getBuildBySlug", error);
  if (!data) return null;
  type MakerEmbed = { username: string | null; display_name: string | null; avatar_url: string | null };
  const { maker, ...row } = data as unknown as Build & { maker?: MakerEmbed | MakerEmbed[] | null };
  const embed = Array.isArray(maker) ? (maker[0] ?? null) : (maker ?? null);
  const record = await composeRecord(row as Build);
  return {
    ...record,
    maker: embed ? { username: embed.username, displayName: embed.display_name, avatarUrl: embed.avatar_url ?? null } : null,
  };
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

/** The patch as a plain write, guarded by `updated_at` when a stamp is given: a stale write changes no rows (CA-23 P4). */
async function updateBuildOnce(id: string, patch: BuildPatch, stamp?: string | null): Promise<Build> {
  let query = supabase.from("builds").update(patch).eq("id", id);
  if (stamp) query = query.eq("updated_at", stamp);
  const { data, error, status } = await query.select(BUILD_COLUMNS).single();

  // CA-10: the HTTP status rides with the error, so a save can tell a refusal from a failure that may pass later.
  if (error) {
    if (stamp && isZeroRows(error)) throw new StaleWriteError("builds", id);
    throw buildLayerError("updateBuild", { code: error.code, details: error.details, hint: error.hint, message: error.message, status });
  }
  return data as unknown as Build;
}

/** Patch the header. Returns the row as it stands after the write. */
export async function updateBuild(
  id: string,
  patch: BuildPatch
): Promise<Build> {
  // Not open in the composer: nobody else's change to look out for, and the write is as it always was.
  if (!isWatched(id)) return updateBuildOnce(id, patch);
  return serial(id, () => updateBuildChecked(id, patch));
}

/** A write made offline and kept across a reload, whose edit may collide with what was changed meanwhile: settled as any stale write is (CA-23 P4). */
export function replayBuildPatch(id: string, patch: BuildPatch, base: Record<string, unknown>): Promise<Build> {
  if (!isWatched(id)) return updateBuildOnce(id, patch);
  return serial(id, () => updateBuildChecked(id, patch, { base }));
}

const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/**
 * The write the composer makes (CA-23 P4). It is compared first with what the database last showed this tab: a column both this tab
 * and the other place changed, to different things, is left as the other place has it and handed to the page as a clash; a column
 * only one changed merges. Then what is left is written with the `updated_at` that last showed: if the row has moved on since, the
 * database refuses it (no rows change), the row is read again, and the comparison is made again.
 */
async function updateBuildChecked(id: string, patch: BuildPatch, from?: { base: Record<string, unknown> }): Promise<Build> {
  let wanted: Record<string, unknown> = { ...(patch as Record<string, unknown>) };
  // A write kept across a reload is compared with what is there now, against what it was based on.
  if (from) noteLatest(id, ((await getBuildHeader(id)) as unknown as Record<string, unknown> | null) ?? {});
  let merged = false;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const there = latestRow(id);
    if (!there || !knownStamp(id)) return updateBuildOnce(id, wanted as BuildPatch);
    const base = from && attempt === 0 ? { ...baseRow(id), ...from.base } : baseRow(id);
    const handler = clashHandler(id);
    const theirsAt = Date.parse(String(there.updated_at ?? "")) || Date.now();

    const next: Record<string, unknown> = { ...wanted };
    const clashes: RawClash[] = [];
    const raise = (clash: Omit<RawClash, "mineAt" | "theirsAt">) => clashes.push({ ...clash, mineAt: Date.now(), theirsAt });

    for (const clash of rowClashes(base, wanted, there)) {
      delete next[clash.key];
      const post = clash.key === "post_doc";
      raise({
        kind: post ? "post" : "field",
        key: post ? "post" : clash.key,
        fields: [{ key: clash.key, mine: clash.mine, theirs: clash.theirs }],
        write: async (side) => void (await updateBuild(id, { [clash.key]: side === "mine" ? clash.mine : clash.theirs } as unknown as BuildPatch)),
      });
      // The maker settles it in the window: from here on what the database holds for it is the base.
      base[clash.key] = there[clash.key];
      acceptColumns(id, [clash.key]);
    }

    if ("making" in wanted) {
      const result = mergeMaking(base.making, wanted.making, there.making);
      if (!same(result.merged, wanted.making)) merged = true;
      if (same(result.merged, there.making)) delete next.making;
      else next.making = result.merged;
      for (const clash of result.clashes) {
        raise({
          kind: clash.kind,
          key: clash.key,
          fields: differingFields(asRecord(clash.mine), asRecord(clash.theirs)),
          write: async (side) => {
            const chosen = side === "mine" ? clash.mine : clash.theirs;
            const making = asRecord(((await getBuildHeader(id)) as unknown as Record<string, unknown> | null)?.making);
            if (clash.kind === "session") {
              const meta = { ...asRecord(making.sessions_meta) };
              if (chosen === null) delete meta[clash.key];
              else meta[clash.key] = chosen;
              await updateBuild(id, { making: { ...making, sessions_meta: meta } } as unknown as BuildPatch);
            } else {
              const list = Array.isArray(making.workstreams) ? (making.workstreams as Record<string, unknown>[]) : [];
              const at = list.findIndex((part) => part?.key === clash.key);
              const parts = list.filter((part) => part?.key !== clash.key);
              if (chosen !== null) parts.splice(at < 0 ? parts.length : at, 0, chosen as Record<string, unknown>);
              await updateBuild(id, { making: { ...making, workstreams: parts } } as unknown as BuildPatch);
            }
          },
        });
      }
    }

    if (handler) for (const clash of clashes) handler(clash);
    if (clashes.length > 0 || merged) tellMerged(id);
    wanted = next;
    if (Object.keys(wanted).length === 0) {
      if (clashes.length > 0) acceptColumns(id, ["making"]);
      return there as unknown as Build;
    }

    try {
      const row = await updateBuildOnce(id, wanted as BuildPatch, String(there.updated_at));
      noteBuildRow(id, row as unknown as Record<string, unknown>, Object.keys(wanted));
      return row;
    } catch (cause) {
      if (!isStaleWrite(cause)) throw cause;
      // The row moved on since this tab last saw it: read it again and compare again.
      const fresh = await getBuildHeader(id);
      if (!fresh) throw new StaleWriteError("builds", id, "That build is no longer available.");
      noteLatest(id, fresh as unknown as Record<string, unknown>);
    }
  }
  throw new StaleWriteError("builds", id);
}

/**
 * A creator's builds, newest first. Headers only — a list never needs the
 * nodes, and fetching them is how a profile page turns into fifty queries.
 */
export async function listBuildsByCreator(
  creatorId: string,
  { limit = CREATOR_LIST_LIMIT, offset = 0 }: ListBuildsOptions = {}
): Promise<BuildListRow[]> {
  const { data, error } = await supabase
    .from("builds")
    .select(BUILD_LIST_COLUMNS)
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)
    .limit(limit);

  if (error) throw buildLayerError("listBuildsByCreator", error);
  return (data ?? []) as unknown as BuildListRow[];
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
): Promise<BuildListRow[]> {
  const { data, error } = await supabase
    .from("builds")
    .select(BUILD_LIST_COLUMNS)
    .eq("creator_id", creatorId)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1)
    .limit(limit);

  if (error) throw buildLayerError("listDraftBuildsByCreator", error);
  return (data ?? []) as unknown as BuildListRow[];
}

/** Delete a build. Nodes and events go with it — the FKs cascade. */
export async function deleteBuild(id: string): Promise<void> {
  const { error } = await supabase.from("builds").delete().eq("id", id);
  if (error) throw buildLayerError("deleteBuild", error);
}
