// Rebuild: a fork that changed something, and the computed diff that says what.
//
// WHAT A REBUILD IS
// -----------------
// A fork is a starting point. A REBUILD is that fork published — and what makes
// it worth publishing, rather than a duplicate of someone else's page, is the
// difference between the two. So the diff is not decoration on a rebuild. The
// diff IS the rebuild's content: it is what the feed shows, what the card
// shows, and what the publish sheet asks the creator to confirm before the
// record goes live. rebuild_note is gloss on top of it and is optional for
// exactly that reason (see publishRebuild).
//
// That is why the gate below exists at all. Nothing stops someone forking a
// build and publishing it untouched; the platform simply declines to call that
// a rebuild, because a rebuild with an empty change set credits a source while
// adding nothing to it.
//
// WHAT SURVIVES A FORK, AND WHAT THAT COSTS THE DIFF
// --------------------------------------------------
// Read fork.ts before changing anything here. What it copies onto each new
// build_nodes row is: position, parent_id (remapped), type, title, note,
// payload (with node references remapped), source_ref and is_gap. What it does
// NOT copy is any pointer back to the node it came from. The three lineage
// columns — parent_build_id, root_build_id, forked_from_event_id — live on
// `builds`, not on `build_nodes`, so at the node level a fork and its source
// share no identifier at all. Every node id is minted fresh.
//
// source_ref is the one carried identity there is, and it is only half an
// identity: it is IMPORT provenance ({ source, session_id, index, local_id },
// written by intake.ts, repo.ts and buildfile.ts), copied through the fork
// verbatim. On a build that arrived from a transcript, a repo read or a Build
// File it is stable, per-node and unique, which makes it the strongest key
// available. On a build authored in compose it is null on every row. So it
// leads the matching, and it can never be the whole of it.
//
// Hence the two-tier strategy in matchNodes, stated once here and enforced
// there:
//
//   1. CARRIED IDENTITY — equal source_ref, when that source_ref is unique on
//      both sides. Survives a rename, a move and a reorder.
//   2. STRUCTURE — descend from each matched parent (the roots being the first
//      matched "parent"), and within one parent pair the remaining children of
//      the same type: first where the title is unique on both sides, then the
//      leftovers in tree order. This is "same type, same path", widened so that
//      inserting or removing one sibling does not shift every sibling below it
//      into a false pairing.
//
// The known limit, written down rather than discovered later: a node whose type
// was changed AND which carries no source_ref reads as one removal plus one
// addition. That is the honest answer for a diff with nothing to match on, and
// it is the right shape of wrong — it over-reports change rather than hiding
// it.
//
// WHY THE DIFF IS PURE
// --------------------
// changeSet takes two BuildRecords and queries nothing, for the same reason
// resolveCover does: the publish sheet, the card and the feed all hold the
// records already, and a diff that fetched would be a diff no card body could
// call and no test could pin down. Only startRebuild and publishRebuild touch
// the database.

import { supabase } from "@/integrations/supabase/client";
import { deleteBuild, getBuildHeader, updateBuild } from "./builds";
import { forkBuild } from "./fork";
import { canonicalJson } from "./layers";
import {
  publishBuild,
  publishReadiness,
  type PublishReadiness,
  type PublishTarget,
} from "./publish";
import {
  buildLayerError,
  type Build,
  type BuildEvent,
  type BuildNode,
  type BuildRecord,
  type FieldDef,
  type NodeTree,
  type NodeType,
} from "./types";

// =============================================================================
// The shapes
// =============================================================================

/** What a change line is, so a renderer can colour it without parsing it. */
export type ChangeKind = "changed" | "added" | "removed" | "header";

/** One field that differs, with both sides as a reader would see them. */
export interface FieldChange {
  /** A payload field key, or one of "title", "note", "outcome", "cover". */
  key: string;
  /** The registry's label for the field, or a plain word for the rest. */
  label: string;
  /** Absent, empty and whitespace-only all arrive here as null. */
  before: string | null;
  after: string | null;
}

/** A node that exists on both sides and reads differently. */
export interface NodeChange {
  /** The draft's node. This is the one a reader is looking at. */
  node_id: string;
  /** The source node it was matched to, for a renderer that wants both. */
  source_node_id: string;
  type: string;
  /** The registry's label for the type, falling back to the type key. */
  type_label: string;
  /** The draft's title. */
  title: string | null;
  /** Only the fields that differ, in registry order. Never empty. */
  fields: FieldChange[];
}

/** A node on one side only. */
export interface NodeRef {
  node_id: string;
  type: string;
  type_label: string;
  title: string | null;
}

export interface ChangeSet {
  /** In the draft, with no counterpart in the source. Tree order. */
  added: NodeRef[];
  /** In the source, with no counterpart in the draft. Tree order. */
  removed: NodeRef[];
  /** Matched, and differing in payload, title or note. Draft tree order. */
  changed: NodeChange[];
  outcome_changed: boolean;
  title_changed: boolean;
  /**
   * The build's cover pointer moved. See coverChanged for what that means on a
   * fork, which starts with no media rows of its own.
   */
  cover_changed: boolean;
  /** Visible events in the draft that the fork did not bring with it. */
  events_added: number;
  /**
   * The three header booleans above, with their values, for the lines that have
   * to name them. Same order as the booleans: title, outcome, cover.
   */
  header: FieldChange[];
}

/** One rendered line. Stable text, stable order, stable key. */
export interface ChangeLine {
  kind: ChangeKind;
  /** Stable within a change set. A list key, not an id to resolve. */
  key: string;
  text: string;
}

/** A matched pair of nodes. */
export interface NodeMatch {
  source: BuildNode;
  draft: BuildNode;
}

export interface NodeMatching {
  pairs: NodeMatch[];
  /** Draft nodes with no source counterpart, in draft tree order. */
  addedNodes: BuildNode[];
  /** Source nodes with no draft counterpart, in source tree order. */
  removedNodes: BuildNode[];
  /** source node id -> draft node id, for pointers held on the header. */
  draftBySource: Map<string, string>;
}

/** What the gate says when a fork has been published untouched. */
export const NO_CHANGES_REASON =
  "A rebuild has to change something. Adjust a part, add one, or remove one — then publish.";

/** Longest a value may run inside a change line before it is clipped. */
const LINE_VALUE_MAX = 60;

// =============================================================================
// startRebuild
// =============================================================================

export interface StartRebuildInput {
  sourceBuildId: string;
  /** The moment to fork at. Passed straight through to forkBuild. */
  atEventOrdinal?: number;
}

/**
 * Fork a build and freeze the credit onto the new draft, in one call.
 *
 * The snapshot columns are the whole reason this exists rather than the compose
 * route calling forkBuild directly. parent_build_id is ON DELETE SET NULL and a
 * source can be renamed at any time, so a credit line resolved live is a credit
 * line the credited party can revoke. source_title_at_fork and
 * source_handle_at_fork are written once, here, and never maintained again —
 * they record what this build was forked FROM, which does not change afterwards
 * however the parent's row does.
 *
 * The title is deliberately NOT touched: forkBuild copies the source's, and the
 * rebuilder renames it in compose. A prefix invented here ("Rebuild of ...")
 * would be a title nobody chose, arriving already in the slug.
 *
 * On any failure after the fork the draft is deleted rather than left holding
 * half a credit — the same cleanup fork.ts does between its own passes, for the
 * same reason. Retrying costs a fork; a published rebuild crediting nobody
 * costs the source their attribution.
 */
export async function startRebuild({
  sourceBuildId,
  atEventOrdinal,
}: StartRebuildInput): Promise<Build> {
  const draft = await forkBuild({ sourceBuildId, atEventOrdinal });

  try {
    // Read the source rather than trusting the copy: draft.title is the
    // source's title today, but that is forkBuild's business and this column
    // has to stay right if forkBuild ever changes how it names a fork.
    const source = await getBuildHeader(sourceBuildId);
    if (!source) {
      throw buildLayerError("startRebuild", new Error(`no build ${sourceBuildId}`));
    }

    return await updateBuild(draft.id, {
      source_title_at_fork: source.title,
      source_handle_at_fork: await creatorHandle(source.creator_id),
    });
  } catch (error) {
    await deleteBuild(draft.id).catch(() => undefined);
    throw error;
  }
}

/**
 * profiles.username for a creator, or null.
 *
 * The handle, not the display name: it is the stable address and the thing a
 * credit line can link to. A profile with no username yet, or none at all,
 * snapshots as null and the renderer falls back to the live parent — which is
 * the NS-P16-era behaviour, so nothing regresses.
 */
async function creatorHandle(creatorId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", creatorId)
    .maybeSingle();

  if (error) throw buildLayerError("startRebuild (handle)", error);
  return (data?.username as string | null | undefined) ?? null;
}

// =============================================================================
// Matching
// =============================================================================

interface FlatNode {
  node: BuildNode;
  parentId: string | null;
}

/** The key a parentId takes in the child index. Roots share one bucket. */
const ROOT = " root";

/**
 * Match the two trees, tier one then tier two. See the file header for why
 * these two tiers and no others.
 *
 * TRAY NODES CANNOT REACH HERE. Both arguments are the PLACED tree; a
 * BuildRecord keeps its tray in a separate field and changeSet never passes it.
 * Unplaced material is the creator's workings, it renders nowhere public, and
 * forkBuild does not copy it — so a tray edit is not a change to the record and
 * must not unlock the publish gate.
 */
export function matchNodes(
  sourceTree: NodeTree[],
  draftTree: NodeTree[]
): NodeMatching {
  const sourceFlat = flattenTree(sourceTree);
  const draftFlat = flattenTree(draftTree);
  const sourceKids = childIndex(sourceFlat);
  const draftKids = childIndex(draftFlat);

  const draftBySource = new Map<string, string>();
  const sourceByDraft = new Map<string, string>();
  const pairs: NodeMatch[] = [];

  // The roots are a pair by definition: two trees always have a top.
  const queue: [string | null, string | null][] = [[null, null]];

  const free = (source: BuildNode, draft: BuildNode) =>
    !draftBySource.has(source.id) && !sourceByDraft.has(draft.id);

  const pair = (source: BuildNode, draft: BuildNode) => {
    draftBySource.set(source.id, draft.id);
    sourceByDraft.set(draft.id, source.id);
    pairs.push({ source, draft });
    queue.push([source.id, draft.id]);
  };

  // Tier one: carried identity. Only where the key is unique on BOTH sides —
  // two nodes materialised from the same transcript turn identify a turn, not a
  // node, and pairing on that would be a coin toss.
  const sourceByRef = uniqueBy(nodesOf(sourceFlat), identityKey);
  const draftByRef = uniqueBy(nodesOf(draftFlat), identityKey);
  for (const [key, source] of sourceByRef) {
    const draft = draftByRef.get(key);
    if (draft && free(source, draft)) pair(source, draft);
  }

  // Tier two: structure, descending from what is already matched.
  while (queue.length > 0) {
    const [sourceParent, draftParent] = queue.shift() as [string | null, string | null];
    const sourceLeft = unmatched(sourceKids.get(bucket(sourceParent)), draftBySource);
    const draftLeft = unmatched(draftKids.get(bucket(draftParent)), sourceByDraft);
    if (sourceLeft.length === 0 || draftLeft.length === 0) continue;

    // Insertion order, so the walk is the same on every run.
    const types = new Set([
      ...sourceLeft.map((node) => node.type),
      ...draftLeft.map((node) => node.type),
    ]);

    for (const type of types) {
      const ofType = (nodes: BuildNode[]) => nodes.filter((node) => node.type === type);

      // (a) By title, where the title picks out exactly one node on each side.
      // A rename falls through to (b) rather than pairing with a stranger.
      const sourceTitles = uniqueBy(ofType(sourceLeft), titleKey);
      const draftTitles = uniqueBy(ofType(draftLeft), titleKey);
      for (const [key, source] of sourceTitles) {
        const draft = draftTitles.get(key);
        if (draft && free(source, draft)) pair(source, draft);
      }

      // (b) What is left, in tree order. This is where a renamed node pairs:
      // same parent, same type, same place in the run.
      const sourceRun = unmatched(ofType(sourceLeft), draftBySource);
      const draftRun = unmatched(ofType(draftLeft), sourceByDraft);
      const runs = Math.min(sourceRun.length, draftRun.length);
      for (let i = 0; i < runs; i += 1) pair(sourceRun[i], draftRun[i]);
    }
  }

  return {
    pairs,
    addedNodes: draftFlat
      .filter(({ node }) => !sourceByDraft.has(node.id))
      .map(({ node }) => node),
    removedNodes: sourceFlat
      .filter(({ node }) => !draftBySource.has(node.id))
      .map(({ node }) => node),
    draftBySource,
  };
}

/** Depth-first, parents before children — the order the tree reads in. */
function flattenTree(
  tree: NodeTree[],
  parentId: string | null = null,
  out: FlatNode[] = []
): FlatNode[] {
  for (const node of tree) {
    out.push({ node, parentId });
    flattenTree(node.children, node.id, out);
  }
  return out;
}

/** Siblings by parent, each list in tree order. */
function childIndex(flat: FlatNode[]): Map<string, BuildNode[]> {
  const index = new Map<string, BuildNode[]>();
  for (const { node, parentId } of flat) {
    const key = bucket(parentId);
    const kids = index.get(key);
    if (kids) kids.push(node);
    else index.set(key, [node]);
  }
  return index;
}

function bucket(parentId: string | null): string {
  return parentId ?? ROOT;
}

function nodesOf(flat: FlatNode[]): BuildNode[] {
  return flat.map(({ node }) => node);
}

function unmatched(
  nodes: BuildNode[] | undefined,
  taken: Map<string, string>
): BuildNode[] {
  return (nodes ?? []).filter((node) => !taken.has(node.id));
}

/**
 * The carried identity of a node, or null when it has none.
 *
 * An empty object is not an identity, and the type is part of the key: two
 * nodes materialised from one turn of a transcript are the same PROVENANCE, and
 * only the type tells them apart.
 */
function identityKey(node: BuildNode): string | null {
  if (!node.source_ref || typeof node.source_ref !== "object") return null;
  const key = canonicalJson(node.source_ref);
  return key === "{}" || key === "[]" || key === "null" ? null : `${node.type} ${key}`;
}

/** Type is already fixed by the caller, so the title alone keys the bucket. */
function titleKey(node: BuildNode): string | null {
  const title = trimToNull(node.title);
  return title === null ? null : title.toLowerCase();
}

/** Keys that name exactly one node. A key on two nodes names neither. */
function uniqueBy(
  nodes: BuildNode[],
  keyOf: (node: BuildNode) => string | null
): Map<string, BuildNode> {
  const seen = new Map<string, BuildNode | null>();
  for (const node of nodes) {
    const key = keyOf(node);
    if (key === null) continue;
    seen.set(key, seen.has(key) ? null : node);
  }

  const unique = new Map<string, BuildNode>();
  for (const [key, node] of seen) if (node) unique.set(key, node);
  return unique;
}

// =============================================================================
// changeSet
// =============================================================================

/**
 * What the draft changed about the source. Pure; queries nothing.
 *
 * Both sides are read as the record, not as the workspace: the placed tree
 * only, and visible events only. Hidden events are the creator's own workings —
 * getEvents already drops them for anyone but the owner, and a diff that
 * counted them would report a change no reader can see.
 */
export function changeSet(source: BuildRecord, draft: BuildRecord): ChangeSet {
  const matching = matchNodes(source.tree, draft.tree);
  const types = typeIndex(source.nodeTypes, draft.nodeTypes);
  const order = new Map(
    flattenTree(draft.tree).map(({ node }, index) => [node.id, index])
  );

  const changed: NodeChange[] = [];
  for (const { source: before, draft: after } of matching.pairs) {
    const fields = fieldChanges(before, after, types.get(after.type));
    if (fields.length === 0) continue;
    changed.push({
      node_id: after.id,
      source_node_id: before.id,
      type: after.type,
      type_label: typeLabel(after.type, types),
      title: trimToNull(after.title),
      fields,
    });
  }

  // Match order is deterministic but it is not reading order. The draft's tree
  // is what a reader has in front of them.
  changed.sort((a, b) => (order.get(a.node_id) ?? 0) - (order.get(b.node_id) ?? 0));

  return {
    added: matching.addedNodes.map((node) => nodeRef(node, types)),
    removed: matching.removedNodes.map((node) => nodeRef(node, types)),
    changed,
    outcome_changed: !sameText(source.build.outcome, draft.build.outcome),
    title_changed: !sameText(source.build.title, draft.build.title),
    cover_changed: coverChanged(source, draft, matching.draftBySource),
    events_added: eventsAdded(source, draft),
    header: headerChanges(source, draft, matching.draftBySource),
  };
}

/** added + removed + changed. The count the gate and the card both want. */
export function changeCount(changes: ChangeSet): number {
  return changes.added.length + changes.removed.length + changes.changed.length;
}

/**
 * The fields of one matched node that differ, in registry order.
 *
 * Title and note come first because they are what a reader sees before they
 * open anything. Payload keys follow the type's own field order, and any key
 * the schema does not declare — a payload written before a field was renamed,
 * or by an importer — is sorted after them, so the output can never depend on
 * the order the keys happen to sit in the object.
 */
function fieldChanges(
  source: BuildNode,
  draft: BuildNode,
  nodeType: NodeType | undefined
): FieldChange[] {
  const changes: FieldChange[] = [];

  if (!sameText(source.title, draft.title)) {
    changes.push(fieldChange("title", "Title", source.title, draft.title));
  }
  if (!sameText(source.note, draft.note)) {
    changes.push(fieldChange("note", "Note", source.note, draft.note));
  }

  const before = payloadOf(source);
  const after = payloadOf(draft);
  const declared = (nodeType?.schema?.fields ?? []) as FieldDef[];
  const labels = new Map(declared.map((field) => [field.key, field.label]));
  const keys = [
    ...declared.map((field) => field.key).filter((key) => key in before || key in after),
    ...[...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter((key) => !labels.has(key))
      .sort(),
  ];

  for (const key of keys) {
    if (sameValue(before[key], after[key])) continue;
    changes.push(fieldChange(key, labels.get(key) ?? key, before[key], after[key]));
  }

  return changes;
}

function fieldChange(
  key: string,
  label: string,
  before: unknown,
  after: unknown
): FieldChange {
  return { key, label, before: display(before), after: display(after) };
}

function payloadOf(node: BuildNode): Record<string, unknown> {
  const payload = node.payload;
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

/**
 * Two payload values that read the same to a reader.
 *
 * Absent, null and empty string are one state — a field cleared to "" and a
 * field never filled in say the same thing on a page, and reporting the
 * difference would put "changed" on a build nobody changed. Everything else
 * compares canonically, so re-saving a payload whose keys came back in another
 * order is not a change either.
 */
function sameValue(before: unknown, after: unknown): boolean {
  return canonicalJson(blankToNull(before)) === canonicalJson(blankToNull(after));
}

function blankToNull(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  return value;
}

function sameText(before: string | null, after: string | null): boolean {
  return trimToNull(before) === trimToNull(after);
}

/** A value as a reader would see it. Structures fall back to canonical JSON. */
function display(value: unknown): string | null {
  const settled = blankToNull(value);
  if (settled === null) return null;
  if (typeof settled === "string") return settled;
  if (typeof settled === "number" || typeof settled === "boolean") return String(settled);
  return canonicalJson(settled);
}

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

function typeIndex(...sets: NodeType[][]): Map<string, NodeType> {
  const index = new Map<string, NodeType>();
  for (const set of sets) for (const type of set) index.set(type.key, type);
  return index;
}

function typeLabel(key: string, types: Map<string, NodeType>): string {
  return types.get(key)?.label ?? key;
}

function nodeRef(node: BuildNode, types: Map<string, NodeType>): NodeRef {
  return {
    node_id: node.id,
    type: node.type,
    type_label: typeLabel(node.type, types),
    title: trimToNull(node.title),
  };
}

/**
 * Whether the build's cover pointer moved, in a way the creator caused.
 *
 * Two pointers decide a cover: cover_media_id, which the creator sets outright,
 * and hero_node_id, which forkBuild remaps onto the copied node. The hero is
 * compared THROUGH the matching, since the two builds share no node ids.
 *
 * A draft with no cover_media_id where the source had one is NOT a change:
 * forkBuild copies no build_media rows at all, deliberately, so an empty cover
 * is where every fork starts rather than something its creator did.
 */
function coverChanged(
  source: BuildRecord,
  draft: BuildRecord,
  draftBySource: Map<string, string>
): boolean {
  const heroFromSource = source.build.hero_node_id
    ? (draftBySource.get(source.build.hero_node_id) ?? null)
    : null;
  if ((draft.build.hero_node_id ?? null) !== heroFromSource) return true;

  const cover = draft.build.cover_media_id;
  return cover !== null && cover !== source.build.cover_media_id;
}

/**
 * Visible events in the draft that the fork did not bring with it.
 *
 * forkBuild copies an event's ordinal, occurred_at and kind unchanged, so those
 * three together identify a copied event across the two builds. Counting by
 * that rather than by length means a draft that both deleted an event and added
 * two reports two, not one.
 *
 * The source side is narrowed to the slice the fork actually took, resolved
 * from forked_from_event_id against the source's own sequence. A fork of the
 * whole build, or one whose fork point is not among the events passed in,
 * compares against everything visible — which costs nothing, since an event
 * added after a fork carries an ordinal beyond the slice either way.
 */
function eventsAdded(source: BuildRecord, draft: BuildRecord): number {
  const visibleSource = visibleEvents(source.events);
  const forkedAt = draft.build.forked_from_event_id
    ? (visibleSource.find((event) => event.id === draft.build.forked_from_event_id)
        ?.ordinal ?? null)
    : null;

  const taken =
    forkedAt === null
      ? visibleSource
      : visibleSource.filter((event) => event.ordinal <= forkedAt);

  const remaining = new Map<string, number>();
  for (const event of taken) {
    const key = eventKey(event);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }

  let added = 0;
  for (const event of visibleEvents(draft.events)) {
    const key = eventKey(event);
    const left = remaining.get(key) ?? 0;
    if (left > 0) remaining.set(key, left - 1);
    else added += 1;
  }

  return added;
}

function visibleEvents(events: BuildEvent[]): BuildEvent[] {
  return events.filter((event) => event.visibility !== "hidden");
}

function eventKey(event: BuildEvent): string {
  return `${event.ordinal} ${event.occurred_at} ${event.kind}`;
}

/** The header fields that differ, in the order the booleans are declared. */
function headerChanges(
  source: BuildRecord,
  draft: BuildRecord,
  draftBySource: Map<string, string>
): FieldChange[] {
  const changes: FieldChange[] = [];

  if (!sameText(source.build.title, draft.build.title)) {
    changes.push(fieldChange("title", "Title", source.build.title, draft.build.title));
  }
  if (!sameText(source.build.outcome, draft.build.outcome)) {
    changes.push(
      fieldChange("outcome", "What it does", source.build.outcome, draft.build.outcome)
    );
  }
  if (coverChanged(source, draft, draftBySource)) {
    // The values are media and node ids, which say nothing to a reader. The
    // line names the change; the page shows the picture.
    changes.push({ key: "cover", label: "Cover", before: null, after: null });
  }

  return changes;
}

// =============================================================================
// serialiseChangeSet
// =============================================================================

/**
 * The change set as lines, in one fixed order: what changed, what was added,
 * what was removed, then what moved on the header.
 *
 * ONE LINE PER CHANGE, and a changed node is one change however many of its
 * fields moved — three lines about one prompt is a feed nobody reads. The line
 * is field-aware where that is cheap and worth it: swapping the model is the
 * most common rebuild there is and the most useful thing to be able to read at
 * a glance, so it gets its values named. Everything else says what kind of part
 * changed and which one, and the page shows the rest.
 *
 * Deterministic by construction: the order comes from the change set's arrays,
 * which changeSet has already put in tree order, and nothing here reads a
 * clock, a locale or an id it was not handed.
 */
export function serialiseChangeSet(changes: ChangeSet): ChangeLine[] {
  const lines: ChangeLine[] = [];

  for (const change of changes.changed) {
    lines.push({
      kind: "changed",
      key: `changed:${change.node_id}`,
      text: changedText(change),
    });
  }

  for (const node of changes.added) {
    lines.push({
      kind: "added",
      key: `added:${node.node_id}`,
      text: `Added ${article(node.type_label)} ${partName(node)}`,
    });
  }

  for (const node of changes.removed) {
    lines.push({
      kind: "removed",
      key: `removed:${node.node_id}`,
      text: `Removed the ${partName(node)}`,
    });
  }

  for (const field of changes.header) {
    lines.push({ kind: "header", key: `header:${field.key}`, text: headerText(field) });
  }

  if (changes.events_added > 0) {
    const count = changes.events_added;
    lines.push({
      kind: "header",
      key: "header:events",
      text: `Added ${count} step${count === 1 ? "" : "s"} to the sequence`,
    });
  }

  return lines;
}

function changedText(change: NodeChange): string {
  const model = change.fields.find((field) => field.key === "model");

  // Named values only when there are two of them to name. A model set for the
  // first time, or cleared, reads better as an ordinary edit than as a swap.
  if (model && model.before && model.after) {
    const others = change.fields.length - 1;
    const rest = others > 0 ? ` (and ${others} other edit${others === 1 ? "" : "s"})` : "";
    return `Swapped model: ${clip(model.before)} → ${clip(model.after)}${rest}`;
  }

  return `Changed the ${partName(change)}`;
}

/** "prompt 'Draft the reply'", or just "prompt" for an untitled node. */
function partName(node: Pick<NodeRef, "type_label" | "title">): string {
  const label = node.type_label.toLowerCase();
  return node.title ? `${label} '${clip(node.title)}'` : label;
}

function headerText(field: FieldChange): string {
  if (field.key === "title") return `Renamed it to '${clip(field.after ?? "")}'`;
  if (field.key === "outcome") {
    return field.before ? "Rewrote what it does" : "Said what it does";
  }
  return "Changed the cover image";
}

function article(label: string): string {
  return /^[aeiou]/i.test(label) ? "an" : "a";
}

/** One line of it, at most. A 4,000-character prompt is not a feed line. */
function clip(value: string): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > LINE_VALUE_MAX ? `${flat.slice(0, LINE_VALUE_MAX - 1)}…` : flat;
}

// =============================================================================
// The gate
// =============================================================================

/**
 * Whether this rebuild can be published: everything publishing already asks,
 * and one thing more.
 *
 * The extra rule is the whole point of the mechanic — a fork published
 * untouched is a duplicate of someone else's page carrying their credit, so the
 * platform declines to call it a rebuild. A CHANGE means a node added, removed
 * or edited, or the outcome line rewritten. Deliberately not on that list:
 * renaming the build, changing the cover, and adding steps to the sequence.
 * Those are things you do to a copy, and a rebuild that only did them has not
 * rebuilt anything.
 *
 * `source` is part of the signature because the rule this adds is about the
 * PAIR rather than the draft, and because every caller holds both records; the
 * test itself reads the diff, which is that pair already computed. It is not
 * otherwise read here, and nothing should be inferred from that.
 *
 * The base gate goes first when both are outstanding: a draft missing its
 * outcome line has a more immediate problem than a draft that has not diverged,
 * and the rebuild reason surfaces as soon as the publish one is cleared. The
 * rebuild requirement is NOT added to `blocking`, which is defined as the
 * outstanding MINIMUM PUBLISH requirements and is keyed by RequirementKey —
 * inventing a key for it would put a rule into the completeness table that
 * scores every build on the site, forked or not.
 */
export function rebuildReadiness(
  source: BuildRecord,
  draft: BuildRecord,
  changes: ChangeSet
): PublishReadiness {
  const base = publishReadiness(draft.build, draft.tree, draft.nodeTypes);
  if (!base.ready) return base;

  const diverged = changeCount(changes) > 0 || changes.outcome_changed;
  if (diverged) return base;

  return { ready: false, blocking: base.blocking, reason: NO_CHANGES_REASON };
}

// =============================================================================
// publishRebuild
// =============================================================================

/**
 * Publish a rebuild, with the rebuilder's note.
 *
 * THE NOTE IS OPTIONAL, and that is a decision rather than an omission: the
 * DIFF is the content of a rebuild. Someone who swapped the model and got a
 * better result has said everything a reader needs by swapping the model, and
 * an empty box between them and publishing would buy prose nobody asked for.
 * The note is gloss — why they did it, what they would try next — and null is a
 * perfectly good answer.
 *
 * The note is written BEFORE the status, in its own statement, so the record is
 * never readable in a state where the rebuild is live and its note is not.
 * publishBuild then does exactly what it does for any other build; the counter
 * on the parent is the database's business, maintained by
 * trg_builds_rebuild_count_status, and is never written from here.
 *
 * The caller is expected to have asked rebuildReadiness first. As with
 * publishBuild, this does not re-check it: the requirements need both records
 * and this takes a header.
 */
export async function publishRebuild(
  draft: PublishTarget,
  note: string | null
): Promise<Build> {
  await updateBuild(draft.id, { rebuild_note: trimToNull(note) });
  return publishBuild(draft);
}
