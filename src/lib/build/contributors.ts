// SV-16: who made each tile and each session.
//
// A tile's `build_nodes.contributor_id` names the person whose work it is when that is not the build's maker; null means the
// maker. A session's is `making.sessions_meta[key].contributor_id`. Credit is method, not evidence: a fork keeps every
// tile's contributor as it is. Only the build's maker writes their build's rows, so these writers run only for the maker.
//
// THE COLUMN MAY NOT BE THERE YET. The app works before the migration is applied: a write that sets contributor_id is
// dropped, and a read that asks for it is asked again without it, when the error's code says the column is missing
// (42703 or PGRST204, never its words).

import { supabase } from "@/integrations/supabase/client";
import { isMissingColumn } from "@/lib/classify/storage";

export const CONTRIBUTOR_COLUMN = "contributor_id";

let columnMissing = false;

/** Whether the column is known to be missing. Reset for tests. */
export const contributorColumnMissing = (): boolean => columnMissing;
export const resetContributorColumn = (): void => {
  columnMissing = false;
};

/** Remember an error that says the column is missing. Returns true when it did. */
export function noteMissingContributorColumn(error: unknown): boolean {
  if (!isMissingColumn(error)) return false;
  columnMissing = true;
  return true;
}

/** `columns` with contributor_id on the end, unless the column is known to be missing. */
export const withContributorColumn = (columns: string): string => (columnMissing ? columns : `${columns}, ${CONTRIBUTOR_COLUMN}`);

/** Whose work a tile is: its contributor, else the build's maker. */
export const contributorOf = (node: { contributor_id?: string | null }, makerId: string): string => node.contributor_id || makerId;

/**
 * What a new tile's row carries for credit. `null` for the maker's own work (the column stays null), the contributor's id
 * otherwise. Pass the source tile's credit for a tile copied from another: its contributor, else the source's maker.
 */
export function creditFor(contributorId: string | null | undefined, makerId: string): string | null {
  return contributorId && contributorId !== makerId ? contributorId : null;
}

/** The credit a tile copied from a source tile carries: the source's contributor, else the source's maker, unless that is the copier. */
export const creditForInsert = (source: { contributor_id?: string | null }, sourceMakerId: string, copierId: string): string | null => creditFor(contributorOf(source, sourceMakerId), copierId);

/** Contributors other than the maker, most tiles first (ties by id, so the order is stable). */
export function tallyContributors(nodes: readonly { contributor_id?: string | null }[], makerId: string): { id: string; tiles: number }[] {
  const counts = new Map<string, number>();
  for (const node of nodes) {
    const id = node.contributor_id;
    if (id && id !== makerId) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts].map(([id, tiles]) => ({ id, tiles })).sort((a, b) => b.tiles - a.tiles || a.id.localeCompare(b.id));
}

/** `{ contributor_id }` for a row to write, or nothing: when there is no credit to record, or the column is not there yet. */
export const creditColumn = (contributorId: string | null): { contributor_id?: string } => (contributorId && !columnMissing ? { [CONTRIBUTOR_COLUMN]: contributorId } : {});

/** The rows without their credit, for a write that found the column missing. */
export const withoutCredit = <T extends object>(rows: readonly T[]): T[] => rows.map((row) => {
  const { contributor_id: _credit, ...rest } = row as T & { contributor_id?: unknown };
  return rest as unknown as T;
});

/** The contributors of sessions, counted as one tile each, together with tiles. */
export function sessionContributorIds(meta: Record<string, { contributor_id?: string }>, makerId: string): string[] {
  return Object.values(meta).flatMap((entry) => (entry.contributor_id && entry.contributor_id !== makerId ? [entry.contributor_id] : []));
}

/** "<maker> with @kit and @dax": at most two named, then "and n more". Just the maker when there are none. */
export function creditLine(maker: string, contributors: readonly string[]): string {
  const named = contributors.filter(Boolean);
  if (named.length === 0) return maker;
  const handle = (value: string) => `@${value.replace(/^@/, "")}`;
  if (named.length === 1) return `${maker} with ${handle(named[0])}`;
  if (named.length === 2) return `${maker} with ${handle(named[0])} and ${handle(named[1])}`;
  const more = named.length - 2;
  return `${maker} with ${handle(named[0])}, ${handle(named[1])} and ${more} more`;
}

/**
 * Set the contributor on tiles the maker has just filled or inserted. Best effort: false when the column is not there yet.
 * Touches contributor_id and nothing else, and only on the given ids.
 */
export async function setTileContributor(nodeIds: readonly string[], contributorId: string | null): Promise<boolean> {
  if (columnMissing || nodeIds.length === 0) return false;
  const { error } = await (supabase as unknown as { from: (t: string) => { update: (v: object) => { in: (c: string, v: readonly string[]) => PromiseLike<{ error: unknown }> } } })
    .from("build_nodes")
    .update({ [CONTRIBUTOR_COLUMN]: contributorId })
    .in("id", nodeIds);
  if (!error) return true;
  if (noteMissingContributorColumn(error)) return false;
  throw error;
}
