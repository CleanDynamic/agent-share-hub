// A build's family of rebuilds, as a tree (RC-P14).
//
// THE FAMILY IS THE REBUILD, NOT THE REMIX. The old /b/:slug/lineage drew remix
// derivations out of post_lineage, a legacy idea over data the clear emptied.
// A build's lineage now is its rebuilds: builds.parent_build_id, followed down
// from the family's root (root_build_id, or the build itself when it has none).
//
// TWO REQUESTS ⟦neoscale-performance⟧: rebuild_tree walks the family, orders it
// and caps it in one round trip
// (supabase/migrations/20261001170000_rc_rebuild_tree.sql), and one profiles
// read, by id, with named columns, names the makers. Nothing is asked per node.
//
// buildTree IS PURE: it nests the flat rows the function returns and queries
// nothing, so the tab, the page and the tests all hand it rows and read the
// same tree back.
//
// WHY THE ROW TYPE IS HAND-WRITTEN: rebuild_tree is newer than the generated
// types in src/integrations/supabase/types.ts, so the call is made through the
// same narrow cast src/lib/feed/getBuildFeed.ts uses.

import { supabase } from "@/integrations/supabase/client";
import { buildLayerError } from "./types";

/** How far below the root the family is drawn. The function stops at the same depth. */
export const REBUILD_TREE_DEPTH_CAP = 20;

/** The most builds one family returns. The function caps at the same number. */
export const REBUILD_TREE_ROW_CAP = 200;

/** Who made one build in the family, as the tree names them. */
export interface RebuildTreeMaker {
  id: string;
  /** The handle. Null on a profile that has not set one. */
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

/** One row of rebuild_tree, exactly as the migration's RETURNS TABLE declares it. */
export interface RebuildTreeRow {
  id: string;
  parent_build_id: string | null;
  /** Levels below the root, as the function counted them; the root is 0. */
  depth: number;
  slug: string;
  title: string;
  creator_id: string;
  published_at: string | null;
  reproduction_count: number;
  rebuild_note: string | null;
  /** Attached by getRebuildTree; absent on rows straight from the function. */
  maker?: RebuildTreeMaker | null;
}

/** One build in the nested family. */
export interface RebuildTreeNode {
  id: string;
  parent_build_id: string | null;
  /** Levels below the root in THIS tree: the root is 0, its rebuilds 1. */
  depth: number;
  slug: string;
  title: string;
  creator_id: string;
  published_at: string | null;
  reproduction_count: number;
  rebuild_note: string | null;
  maker: RebuildTreeMaker | null;
  /** Its rebuilds, in the order the rows arrived: oldest first. */
  children: RebuildTreeNode[];
}

/**
 * Nest the flat rows into one tree. Pure; queries nothing.
 *
 * THE ROOT is the shallowest row (the function returns it first, at depth 0).
 * Every other row hangs under its parent, in the order it arrived.
 *
 * AN ORPHAN — a row whose parent is not among the rows — is attached to the
 * root rather than dropped: the function only returns builds below the root,
 * so a missing parent means the reader could not see it (or the cap cut it),
 * not that the build is outside the family.
 *
 * THE DEPTH CAP holds here as well as in the function: a row that would sit
 * deeper than REBUILD_TREE_DEPTH_CAP below the root is left out, and so is
 * everything under it, so a longer chain cannot be drawn past the cap by
 * arriving as orphans. A row seen twice is placed once.
 */
export function buildTree(rows: readonly RebuildTreeRow[]): RebuildTreeNode | null {
  if (rows.length === 0) return null;

  /* Shallowest first, keeping the arrival order within a depth, so a parent
     is always placed before its children. */
  const ordered = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => a.row.depth - b.row.depth || a.index - b.index)
    .map(({ row }) => row);

  const present = new Set(ordered.map((row) => row.id));
  const placed = new Map<string, RebuildTreeNode>();
  const cut = new Set<string>();

  const toNode = (row: RebuildTreeRow, depth: number): RebuildTreeNode => ({
    id: row.id,
    parent_build_id: row.parent_build_id,
    depth,
    slug: row.slug,
    title: row.title,
    creator_id: row.creator_id,
    published_at: row.published_at,
    reproduction_count: row.reproduction_count,
    rebuild_note: row.rebuild_note,
    maker: row.maker ?? null,
    children: [],
  });

  const [first, ...rest] = ordered;
  const root = toNode(first, 0);
  placed.set(root.id, root);

  for (const row of rest) {
    if (placed.has(row.id) || cut.has(row.id)) continue;

    const parentId = row.parent_build_id;
    if (parentId !== null && cut.has(parentId)) {
      cut.add(row.id);
      continue;
    }

    /* A parent among the rows but not yet placed arrived out of order and
       deeper than this row claims; it is treated like any absent parent. */
    const parent =
      parentId !== null && present.has(parentId) ? (placed.get(parentId) ?? root) : root;
    const depth = parent.depth + 1;
    if (depth > REBUILD_TREE_DEPTH_CAP) {
      cut.add(row.id);
      continue;
    }

    const node = toNode(row, depth);
    parent.children.push(node);
    placed.set(node.id, node);
  }

  return root;
}

/** Every node in reading order: the root, then each child and its family. */
export function flattenFamily(root: RebuildTreeNode | null): RebuildTreeNode[] {
  if (!root) return [];
  const out: RebuildTreeNode[] = [];
  const walk = (node: RebuildTreeNode) => {
    out.push(node);
    node.children.forEach(walk);
  };
  walk(root);
  return out;
}

/**
 * The family under `rootId`: the root build and its published rebuilds, their
 * rebuilds and so on, each with its maker. Null when the root is not readable
 * (a draft that is not the reader's, or no build at that id).
 */
export async function getRebuildTree(rootId: string): Promise<RebuildTreeNode | null> {
  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: string,
      params: Record<string, unknown>,
    ) => Promise<{ data: RebuildTreeRow[] | null; error: unknown }>
  )("rebuild_tree", { root: rootId, max_nodes: REBUILD_TREE_ROW_CAP });
  if (error) throw buildLayerError("getRebuildTree", error);

  const rows = data ?? [];
  if (rows.length === 0) return null;

  const makerIds = [...new Set(rows.map((row) => row.creator_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", makerIds)
    .limit(makerIds.length);
  if (profilesError) throw buildLayerError("getRebuildTree", profilesError);

  const byId = new Map(
    ((profiles ?? []) as RebuildTreeMaker[]).map((profile) => [profile.id, profile]),
  );

  return buildTree(rows.map((row) => ({ ...row, maker: byId.get(row.creator_id) ?? null })));
}
