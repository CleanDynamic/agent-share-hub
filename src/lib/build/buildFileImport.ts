// Writing a confirmed Build File into a draft build.
//
// This is the writing half of the drop, and it is deliberately a separate
// module from intake.ts. materialiseProposal is the shared writer — the
// transcript parser, the Lovable reader, the repository reader and this one all
// go through it, and none of them may change it. What follows is additive: it
// calls that writer unchanged and then does the one thing a Build File needs
// that a transcript does not.
//
// WHY A PLACEMENT PASS EXISTS. materialiseProposal writes every node with
// position NULL, which is correct for its callers: a transcript parser guessing
// at structure should not also decide where things sit, so the creator places
// them. A Build File is not a guess. The extractor was handed the shape and
// asked to fill it in, and `local_id` IS the node's path in that shape — "1",
// "1.2", "1.2.1" — allocated by the parser and unique by construction. Throwing
// that structure away and asking the creator to rebuild it by dragging would be
// discarding work the file did.
//
// So the nodes are written by the shared writer exactly as they always are, and
// then moved into the tree they came with. Two steps rather than one, and the
// first is untouched.
//
// WHAT STAYS IN THE TRAY. A node is placed only if every ancestor above it was
// also kept. Un-tick a parent at the review and its children have nothing to
// hang from, so they stay unplaced and land in the tray for the creator to
// re-home — which is the honest outcome, and is why the tray banner names a
// count rather than assuming everything arrived placed.
//
// NOTHING PUBLISHES. createBuild writes status "draft" and no step here changes
// it. Publication stays behind the PublishSheet.

import {
  getNodeTree,
  getTray,
  reorderNodes,
  type NodeMove,
} from "./nodes";
import { createBuild, updateBuild } from "./builds";
import { materialiseProposal, type IntakeSelections, type MaterialiseCounts } from "./intake";
import type { BuildFileHeader, BuildFileSuccess } from "./buildfile";
import { buildLayerError, type Build, type BuildPatch, type BuildShape } from "./types";

/** A build is never asked to name itself before it exists. */
export const DRAFT_TITLE = "Untitled build";

const BUILD_SHAPES: BuildShape[] = [
  "app",
  "agent",
  "workflow",
  "prompt",
  "dataset",
  "study",
  "media",
  "technique",
  "other",
];

/** The file states a shape as free text. Anything unrecognised becomes "other". */
function readShape(stated: string | null): BuildShape {
  if (!stated) return "other";
  const key = stated.trim().toLowerCase();
  return BUILD_SHAPES.find((shape) => shape === key) ?? "other";
}

function cleanList(values: string[] | null): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen];
}

function cleanText(value: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * The draft the file describes.
 *
 * Header facts are applied at creation rather than left for the creator to
 * retype. materialiseProposal may set title and outcome again from the same
 * header a moment later if the creator kept them — the same value written
 * twice, which is cheaper than teaching the shared writer about this path.
 */
export async function createBuildFromHeader(header: BuildFileHeader): Promise<Build> {
  const title = cleanText(header?.title) ?? DRAFT_TITLE;

  const build = await createBuild({
    title,
    outcome: cleanText(header?.outcome),
    shape: readShape(header?.shape ?? null),
    made_for: cleanList(header?.made_for ?? null),
    made_with: cleanList(header?.made_with ?? null),
    live_url: cleanText(header?.live_url ?? null),
    repo_url: cleanText(header?.repo_url ?? null),
  });

  // The four columns createBuild does not take. Stated by the file, so writing
  // them is the same promise the rest of this makes: what the creator already
  // said somewhere else is not asked for a second time.
  const patch: BuildPatch = {};
  if (typeof header?.time_to_first_result === "number") {
    patch.time_to_first_result = header.time_to_first_result;
  }
  if (typeof header?.cost?.setup === "number") patch.cost_setup = header.cost.setup;
  if (typeof header?.cost?.monthly === "number") patch.cost_monthly = header.cost.monthly;
  if (cleanText(header?.cost?.currency ?? null)) patch.currency = header.cost.currency.trim();

  if (Object.keys(patch).length === 0) return build;

  try {
    return await updateBuild(build.id, patch);
  } catch {
    // Deliberately swallowed. The build exists and holds everything that
    // matters; a cost the creator can retype is not worth losing it over.
    return build;
  }
}

// -----------------------------------------------------------------------------
// Placement
// -----------------------------------------------------------------------------

/** "1.2.1" -> "1.2". A root node's parent is the empty path. */
function parentPath(path: string): string {
  const cut = path.lastIndexOf(".");
  return cut === -1 ? "" : path.slice(0, cut);
}

function depthOf(path: string): number {
  return path ? path.split(".").length : 0;
}

/**
 * Sibling order as the file wrote it.
 *
 * Segment-wise and numeric, because these are numbers in a string: "10" sorts
 * before "9" under a plain string compare, which would silently reorder any
 * build with ten or more siblings.
 */
function comparePaths(a: string, b: string): number {
  const left = a.split(".");
  const right = b.split(".");
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const x = Number(left[i] ?? -1);
    const y = Number(right[i] ?? -1);
    if (Number.isNaN(x) || Number.isNaN(y)) {
      const raw = (left[i] ?? "").localeCompare(right[i] ?? "");
      if (raw !== 0) return raw;
      continue;
    }
    if (x !== y) return x - y;
  }
  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export interface PlacementResult {
  /** Nodes moved out of the tray into the tree. */
  placed: number;
  /** Written, but left unplaced because an ancestor was not kept. */
  leftInTray: number;
}

/**
 * Move this session's imported nodes into the tree their paths describe.
 *
 * Reads the tray rather than trusting the proposal: only rows that actually
 * exist are moved, so a partial write followed by a retry places what is there
 * instead of failing on a row that was never inserted.
 */
export async function placeImportedNodes(
  buildId: string,
  sessionId: string
): Promise<PlacementResult> {
  if (!sessionId) {
    throw buildLayerError(
      "placeImportedNodes",
      new Error("The proposal carries no id, so its nodes cannot be identified.")
    );
  }

  const tray = await getTray(buildId);

  /** local_id (the file's path) -> row id, for this import only. */
  const idByPath = new Map<string, string>();
  for (const row of tray) {
    const ref = row.source_ref;
    if (!isRecord(ref) || ref.session_id !== sessionId) continue;
    const localId = ref.local_id;
    if (typeof localId === "string" && localId) idByPath.set(localId, row.id);
  }

  if (idByPath.size === 0) return { placed: 0, leftInTray: 0 };

  // Shallowest first, so a node is only ever considered after its parent has
  // been decided. That ordering is what makes the ancestor test one lookup.
  const paths = [...idByPath.keys()].sort(
    (a, b) => depthOf(a) - depthOf(b) || comparePaths(a, b)
  );

  const placeable = new Set<string>();
  for (const path of paths) {
    const parent = parentPath(path);
    if (parent === "" || placeable.has(parent)) placeable.add(path);
  }

  /** Existing roots keep their slots; the import continues after them. */
  const existingRoots = (await getNodeTree(buildId)).length;

  const byParent = new Map<string, string[]>();
  for (const path of paths) {
    if (!placeable.has(path)) continue;
    const parent = parentPath(path);
    const siblings = byParent.get(parent) ?? [];
    siblings.push(path);
    byParent.set(parent, siblings);
  }

  const moves: NodeMove[] = [];
  for (const [parent, siblings] of byParent) {
    siblings.sort(comparePaths);
    const parentId = parent === "" ? null : idByPath.get(parent) ?? null;
    // Positions are dense and zero-based, matching what a drag recomputes.
    const offset = parent === "" ? existingRoots : 0;
    siblings.forEach((path, index) => {
      moves.push({ id: idByPath.get(path), parent_id: parentId, position: offset + index });
    });
  }

  if (moves.length > 0) await reorderNodes(buildId, moves);

  return { placed: moves.length, leftInTray: idByPath.size - moves.length };
}

// -----------------------------------------------------------------------------
// The whole write
// -----------------------------------------------------------------------------

export interface BuildFileImportResult {
  buildId: string;
  counts: MaterialiseCounts;
  placement: PlacementResult;
}

/**
 * Create the draft, write what the creator confirmed, then place it.
 *
 * The build is created here rather than before the parse, because a Build File
 * is read locally and synchronously: there is no server call that needs a build
 * to exist first, so a file that turns out to be unreadable leaves no empty
 * draft behind. That is the opposite of the transcript path, and for the
 * opposite reason.
 */
export async function importBuildFile(
  result: BuildFileSuccess,
  selections: IntakeSelections
): Promise<BuildFileImportResult> {
  const build = await createBuildFromHeader(result.meta.header);
  const counts = await materialiseProposal(build.id, result.proposal, selections);

  let placement: PlacementResult = { placed: 0, leftInTray: counts.nodes };
  try {
    placement = await placeImportedNodes(build.id, result.proposal.summary.session_id);
  } catch {
    // Deliberately swallowed. Every row is written and reachable in the tray;
    // failing the whole import over an arrangement the creator can redo by
    // dragging would cost them far more than it saves.
  }

  return { buildId: build.id, counts, placement };
}
