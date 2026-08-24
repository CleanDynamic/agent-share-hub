// Forking: a new build that starts from someone else's, at a chosen moment in
// their sequence.
//
// WHAT A FORK IS
// --------------
// Not a copy. A copy takes the work and drops the provenance; a fork takes the
// work and keeps a pointer at where it came from, so the source is credited on
// the fork's own page and the lineage survives a fork of a fork. Three columns
// carry it: parent_build_id is who this came from, root_build_id is where the
// line started, forked_from_event_id is the moment.
//
// root_build_id resolves the same way the old content path resolves
// root_post_id in src/lib/remix/createRemix.ts — the source's root when it has
// one, the source itself when it does not — so a fork of a fork of a fork all
// point at the original rather than at each other. That system is untouched;
// only the pattern is borrowed.
//
// WHAT IS NOT COPIED, AND WHY
// ---------------------------
// MEDIA. Not one build_media row, not one storage object. A fork references
// its source's media through the payloads it copied, and a forker who changes
// an image uploads their own. Copying the rows would duplicate every byte in
// storage for every fork and leave two builds claiming the same upload; the
// cost of the choice is that a fork whose source deletes an image loses that
// image, which is the honest outcome — it was never the fork's image.
//
// THE TRAY. Tray nodes are unplaced by definition. They are the source's
// workings, they render nowhere public, and a fork starts from what was
// published, not from what was left out.
//
// THE SOURCE'S EARNED NUMBERS. Reproduction counts, confirmations,
// completeness, costs, timings and the live and repo URLs stay with the build
// that earned them. A fork that inherited "reproduced 12 times" would be
// claiming someone else's evidence on day one.
//
// HIDDEN EVENTS. RLS lets any reader of a published build select every one of
// its events, hidden included — visibility is enforced by getEvents in the
// query, not by the database. So a fork of someone else's build takes only the
// events its forker can already see. Forking your own build keeps everything,
// because it is all yours already.

import { supabase } from "@/integrations/supabase/client";
import { BUILD_COLUMNS, deleteBuild, getBuildHeader, slugifyTitle, updateBuild } from "./builds";
import { getEvents } from "./events";
import { getNodeTree } from "./nodes";
import { getNodeTypes } from "./nodeTypes";
import type { Json } from "@/integrations/supabase/types";
import {
  buildLayerError,
  type Build,
  type BuildEvent,
  type BuildNode,
  type FieldDef,
  type NodeTree,
  type NodeType,
} from "./types";

export interface ForkBuildInput {
  sourceBuildId: string;
  /**
   * The moment to fork at. Omitted, the whole build is taken.
   *
   * An ordinal that no visible event carries is not an error: the fork lands
   * on the last event at or below it, which is what a reader scrubbing past a
   * folded run means by "here".
   */
  atEventOrdinal?: number;
}

/** Where a forked build came from. Null for a build that is not a fork. */
export interface ForkOrigin {
  build: Build;
  /** The ordinal of the event forked from, when the fork named one. */
  ordinal: number | null;
}

/**
 * Fork a build into a new draft owned by the caller.
 *
 * The write is four statements and cannot be one: build_nodes.event_id and
 * build_events.produced_node_id reference each other, and neither constraint
 * is deferrable, so the nodes go in without their events, the events go in
 * pointing at the nodes, and a third pass closes the loop. The seed does the
 * same dance for the same reason.
 *
 * If any pass after the header fails, the new build is deleted rather than
 * left as an orphan draft holding half a record.
 */
export async function forkBuild({
  sourceBuildId,
  atEventOrdinal,
}: ForkBuildInput): Promise<Build> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw buildLayerError("forkBuild (session)", sessionError);

  const forkerId = sessionData.session?.user?.id;
  if (!forkerId) throw buildLayerError("forkBuild", new Error("no signed-in user"));

  const source = await getBuildHeader(sourceBuildId);
  if (!source) {
    throw buildLayerError("forkBuild", new Error(`no build ${sourceBuildId}`));
  }

  const ownBuild = source.creator_id === forkerId;
  const [tree, sourceEvents, nodeTypes] = await Promise.all([
    getNodeTree(sourceBuildId),
    getEvents(sourceBuildId, { includeHidden: ownBuild }),
    getNodeTypes(),
  ]);

  const sourceNodes = flatten(tree);
  const events =
    atEventOrdinal === undefined
      ? sourceEvents
      : sourceEvents.filter((event) => event.ordinal <= atEventOrdinal);

  const nodes = nodesToCopy(sourceNodes, events, atEventOrdinal);

  // Ids are minted here rather than by the database, so every reference —
  // parent_id, event_id, produced_node_id, hero_node_id and the node_id
  // references buried in payloads — can be rewritten in one pass before the
  // first row is written.
  const copiedNodeIds = new Map(nodes.map((node) => [node.id, newId()]));
  const eventIds = new Map(events.map((event) => [event.id, newId()]));

  const build = await insertForkHeader({
    source,
    forkerId,
    forkedFromEventId: atEventOrdinal === undefined ? null : (events[events.length - 1]?.id ?? null),
  });

  try {
    const typesByKey = new Map(nodeTypes.map((type) => [type.key, type]));

    // Pass one: the nodes, without their events, which do not exist yet.
    const nodeRows = nodes.map((node) => ({
      id: copiedNodeIds.get(node.id) as string,
      build_id: build.id,
      parent_id: node.parent_id ? (copiedNodeIds.get(node.parent_id) ?? null) : null,
      position: node.position,
      type: node.type,
      title: node.title,
      note: node.note,
      payload: rewritePayload(node.payload, typesByKey.get(node.type), copiedNodeIds),
      // Provenance of the original capture, which is still true of this text.
      source_ref: node.source_ref,
      event_id: null,
      is_gap: node.is_gap,
    }));

    if (nodeRows.length > 0) {
      const { error } = await supabase.from("build_nodes").insert(nodeRows);
      if (error) throw buildLayerError("forkBuild (nodes)", error);
    }

    // Pass two: the events, pointing at the nodes they produced. An event whose
    // node was not copied keeps its place in the sequence and loses the link.
    const eventRows = events.map((event) => ({
      id: eventIds.get(event.id) as string,
      build_id: build.id,
      ordinal: event.ordinal,
      occurred_at: event.occurred_at,
      kind: event.kind,
      payload: event.payload,
      phase: event.phase,
      phase_title: event.phase_title,
      visibility: event.visibility,
      produced_node_id: event.produced_node_id
        ? (copiedNodeIds.get(event.produced_node_id) ?? null)
        : null,
    }));

    if (eventRows.length > 0) {
      const { error } = await supabase.from("build_events").insert(eventRows);
      if (error) throw buildLayerError("forkBuild (events)", error);
    }

    // Pass three: the loop closed. Only the nodes that had an event, and only
    // where that event came along.
    // eventIds only holds the events that came along, so a node linked to an
    // event above the fork point simply finds nothing and stays unlinked.
    const linked = nodeRows
      .map((row, index) => {
        const eventId = nodes[index].event_id;
        const copied = eventId ? eventIds.get(eventId) : undefined;
        return copied ? { ...row, event_id: copied } : null;
      })
      .filter((row): row is (typeof nodeRows)[number] & { event_id: string } => row !== null);

    if (linked.length > 0) {
      const { error } = await supabase
        .from("build_nodes")
        .upsert(linked, { onConflict: "id" });
      if (error) throw buildLayerError("forkBuild (node events)", error);
    }

    // The hero, when the node it points at came along.
    const hero = source.hero_node_id ? copiedNodeIds.get(source.hero_node_id) : undefined;
    if (hero) return await updateBuild(build.id, { hero_node_id: hero });

    return build;
  } catch (error) {
    // A half-copied fork is worse than none: the forker would open a workspace
    // holding a tree with no sequence and no way to tell what went missing.
    await deleteBuild(build.id).catch(() => undefined);
    throw error;
  }
}

/**
 * The build a fork came from, and the step it was taken at.
 *
 * Returns null for a build with no parent. The parent is read through the same
 * RLS as any other build, so a fork of a build that has since been unpublished
 * resolves to null and the attribution line simply does not render — a dangling
 * "forked from" naming nothing is worse than no line.
 */
export async function getForkOrigin(
  build: Pick<Build, "parent_build_id" | "forked_from_event_id">
): Promise<ForkOrigin | null> {
  if (!build.parent_build_id) return null;

  const parent = await getBuildHeader(build.parent_build_id);
  if (!parent) return null;

  if (!build.forked_from_event_id) return { build: parent, ordinal: null };

  const { data, error } = await supabase
    .from("build_events")
    .select("ordinal")
    .eq("id", build.forked_from_event_id)
    .maybeSingle();

  if (error) throw buildLayerError("getForkOrigin", error);
  return { build: parent, ordinal: (data?.ordinal as number | undefined) ?? null };
}

// --- the copy rules ----------------------------------------------------------

/** Depth-first, parents before children. */
function flatten(nodes: NodeTree[]): BuildNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function newId(): string {
  return crypto.randomUUID();
}

/**
 * Which placed nodes the fork takes.
 *
 * With no ordinal, all of them. With one, the nodes whose linked event is at or
 * below it — plus every ancestor of those, whatever the ancestor's own link
 * says, because a child with no parent is not a tree.
 *
 * A node with no event_id at all is not "at or below" anything and is left
 * behind unless an ancestor rule pulls it in. That is the ordinal case doing
 * what it says: fork at step 6 and you get the build as it stood at step 6, not
 * the build as it stands now with six events attached.
 */
export function nodesToCopy(
  nodes: BuildNode[],
  events: BuildEvent[],
  atEventOrdinal?: number
): BuildNode[] {
  if (atEventOrdinal === undefined) return nodes;

  const ordinalByEvent = new Map(events.map((event) => [event.id, event.ordinal]));
  const byId = new Map(nodes.map((node) => [node.id, node]));

  const keep = new Set<string>();
  for (const node of nodes) {
    const ordinal = node.event_id ? ordinalByEvent.get(node.event_id) : undefined;
    if (ordinal === undefined || ordinal > atEventOrdinal) continue;

    // Walk up. The guard is on `keep`, so a shared ancestor is visited once and
    // a parent_id cycle cannot spin.
    let current: BuildNode | undefined = node;
    while (current && !keep.has(current.id)) {
      keep.add(current.id);
      current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
  }

  // Original order, so parents still precede their children on insert.
  return nodes.filter((node) => keep.has(node.id));
}

async function insertForkHeader({
  source,
  forkerId,
  forkedFromEventId,
}: {
  source: Build;
  forkerId: string;
  forkedFromEventId: string | null;
}): Promise<Build> {
  const { data, error } = await supabase
    .from("builds")
    .insert({
      creator_id: forkerId,
      slug: slugifyTitle(source.title),
      title: source.title,
      outcome: source.outcome,
      shape: source.shape,
      status: "draft",
      made_for: source.made_for ?? [],
      made_with: source.made_with ?? [],
      parent_build_id: source.id,
      // The original, never the intermediate: a fork of a fork points at where
      // the line started.
      root_build_id: source.root_build_id ?? source.id,
      forked_from_event_id: forkedFromEventId,
    })
    .select(BUILD_COLUMNS)
    .single();

  if (error) throw buildLayerError("forkBuild (header)", error);
  return data as Build;
}

// --- payload rewriting -------------------------------------------------------

/**
 * A payload with its node references pointed at the copied nodes.
 *
 * Which keys hold a reference is read from the type's schema — a string field
 * whose format is node_id, at the top level or inside a list — so a type added
 * to the registry tomorrow with a reference field is rewritten tomorrow, with
 * no change here. A declared reference whose target was not copied is cleared
 * rather than left dangling into someone else's build.
 *
 * Undeclared references are rewritten too, but never cleared: a string that
 * happens to be a copied node's id is rewritten wherever it appears, while a
 * string this function cannot prove is a reference is left exactly as it was.
 */
export function rewritePayload(
  payload: Json | null,
  nodeType: NodeType | undefined,
  idMap: Map<string, string>
): Json {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return (payload ?? {}) as Json;
  }

  const fields = nodeType?.schema?.fields ?? [];
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const out: Record<string, Json> = {};

  for (const [key, value] of Object.entries(payload as Record<string, Json>)) {
    const field = byKey.get(key);

    if (isReference(field)) {
      out[key] = typeof value === "string" ? (idMap.get(value) ?? null) : value;
      continue;
    }

    if (field?.type === "list" && Array.isArray(value)) {
      const members = (field.of ?? []).filter(isReference).map((member) => member.key);
      out[key] = value.map((row) =>
        row && typeof row === "object" && !Array.isArray(row)
          ? rewriteRow(row as Record<string, Json>, members, idMap)
          : (remap(row, idMap) as Json)
      ) as Json;
      continue;
    }

    out[key] = remap(value, idMap) as Json;
  }

  return out as Json;
}

function isReference(field: FieldDef | undefined): boolean {
  return field?.type === "string" && field.format === "node_id";
}

function rewriteRow(
  row: Record<string, Json>,
  references: string[],
  idMap: Map<string, string>
): Json {
  const out: Record<string, Json> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = references.includes(key)
      ? typeof value === "string"
        ? (idMap.get(value) ?? null)
        : value
      : (remap(value, idMap) as Json);
  }
  return out as Json;
}

/** Deep-replaces any string that is a copied node's id. Clears nothing. */
function remap(value: unknown, idMap: Map<string, string>): unknown {
  if (typeof value === "string") return idMap.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => remap(item, idMap));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        remap(item, idMap),
      ])
    );
  }
  return value;
}
