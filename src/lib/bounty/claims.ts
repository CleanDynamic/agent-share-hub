// SV-21 P2: claims. Someone saying "I'm on this request", for 3 days from the claim and from each change to their fork.
//
// ONE ACTIVE CLAIM PER REQUEST is the table's key (request_id), so two claims cannot exist at once. A claim that has run out is
// still a row until someone takes the request over (claimRequest clears it first) or the claimer lets go; every read asks
// for rows that have not run out, so a lapsed claim is invisible the moment it lapses.
//
// THE TABLE MAY NOT BE THERE YET. The app works before the migration is applied: reads answer "no claims" and a claim made is
// dropped, when the error's code says the table is missing (42P01 or PGRST205, never its words).

import { supabase } from "@/integrations/supabase/client";
import { bountyLayerError } from "./types";

export const CLAIM_DAYS = 3;

export interface RequestClaim {
  requestId: string;
  userId: string;
  /** Without the @; null when the claimer's profile has no username. */
  handle: string | null;
  expiresAt: string;
  /** The claimer's fork of the request's build, once there is one. */
  forkBuildId: string | null;
}

export interface MyClaim {
  requestId: string;
  build: { slug: string; title: string };
  gapTitle: string | null;
  expiresAt: string;
  forkBuildId: string | null;
}

interface Query extends PromiseLike<{ data: unknown; error: unknown }> {
  eq(column: string, value: unknown): Query;
  in(column: string, values: readonly unknown[]): Query;
  gt(column: string, value: unknown): Query;
  lte(column: string, value: unknown): Query;
  order(column: string, options: { ascending: boolean }): Query;
  limit(count: number): Query;
  select(columns: string): Query;
}

interface Table {
  select(columns: string): Query;
  insert(row: Record<string, unknown>): Query;
  update(row: Record<string, unknown>): Query;
  delete(): Query;
}

const table = () => (supabase as unknown as { from: (name: string) => Table }).from("request_claims");

const MISSING_TABLE = new Set(["42P01", "PGRST205"]);
const isMissingTable = (error: unknown): boolean => MISSING_TABLE.has(String((error as { code?: unknown } | null)?.code));

/** Most claims a screen reads. */
const CLAIMS_LIMIT = 100;

interface ClaimRow {
  request_id: string;
  user_id: string;
  expires_at: string;
  fork_build_id: string | null;
  profiles: { username: string | null } | null;
}

/** Whole days left, rounded up, never below 1 while the claim stands: "1 day left" until it runs out. */
export const claimDaysLeft = (expiresAt: string, now: number): number => Math.max(1, Math.ceil((Date.parse(expiresAt) - now) / 86_400_000));

/** The active claims of these requests, in one request. */
export async function listActiveClaims(requestIds: readonly string[], now: number = Date.now()): Promise<Map<string, RequestClaim>> {
  const claims = new Map<string, RequestClaim>();
  if (requestIds.length === 0) return claims;
  const { data, error } = await table()
    .select("request_id, user_id, expires_at, fork_build_id, profiles!request_claims_user_id_fkey(username)")
    .in("request_id", [...requestIds])
    .gt("expires_at", new Date(now).toISOString())
    .limit(CLAIMS_LIMIT);
  if (error) {
    if (isMissingTable(error)) return claims;
    throw bountyLayerError("listActiveClaims", error);
  }
  for (const row of (data ?? []) as ClaimRow[]) {
    claims.set(row.request_id, { requestId: row.request_id, userId: row.user_id, handle: row.profiles?.username ?? null, expiresAt: row.expires_at, forkBuildId: row.fork_build_id });
  }
  return claims;
}

interface MineRow {
  request_id: string;
  expires_at: string;
  fork_build_id: string | null;
  bounties: { status: string; builds: { slug: string; title: string } | null; build_nodes: { title: string | null } | null } | null;
}

/** The reader's active claims on open requests, soonest to run out first. */
export async function listMyClaims(userId: string, now: number = Date.now()): Promise<MyClaim[]> {
  const { data, error } = await table()
    .select("request_id, expires_at, fork_build_id, bounties!request_claims_request_id_fkey!inner(status, builds!bounties_build_id_fkey!inner(slug, title), build_nodes!bounties_gap_node_id_fkey(title))")
    .eq("user_id", userId)
    .eq("bounties.status", "open")
    .gt("expires_at", new Date(now).toISOString())
    .order("expires_at", { ascending: true })
    .limit(CLAIMS_LIMIT);
  if (error) {
    if (isMissingTable(error)) return [];
    throw bountyLayerError("listMyClaims", error);
  }
  return ((data ?? []) as MineRow[]).flatMap((row) =>
    row.bounties?.builds
      ? [{ requestId: row.request_id, build: row.bounties.builds, gapTitle: row.bounties.build_nodes?.title?.trim() || null, expiresAt: row.expires_at, forkBuildId: row.fork_build_id }]
      : [],
  );
}

/**
 * Claim a request. A claim that has run out is cleared first (the policy lets anyone clear one), then the claimer's goes in;
 * the key makes the second of two claimers fail, with a sentence rather than a code. Returns false when the table is not
 * there yet: nothing was claimed, and nothing broke.
 */
export async function claimRequest({ requestId, userId, forkBuildId = null }: { requestId: string; userId: string; forkBuildId?: string | null }, now: number = Date.now()): Promise<boolean> {
  const cleared = await table().delete().eq("request_id", requestId).lte("expires_at", new Date(now).toISOString());
  if (cleared.error) {
    if (isMissingTable(cleared.error)) return false;
    throw bountyLayerError("claimRequest (clear)", cleared.error);
  }
  const { error } = await table().insert({ request_id: requestId, user_id: userId, ...(forkBuildId ? { fork_build_id: forkBuildId } : null) });
  if (error) {
    if (isMissingTable(error)) return false;
    if ((error as { code?: string }).code === "23505") throw new Error("Someone else is already working on this request");
    throw bountyLayerError("claimRequest", error);
  }
  return true;
}

/** Point the reader's claim at their fork. This starts the 3 days again. */
export async function attachFork({ requestId, userId, forkBuildId }: { requestId: string; userId: string; forkBuildId: string }): Promise<void> {
  const { error } = await table().update({ fork_build_id: forkBuildId }).eq("request_id", requestId).eq("user_id", userId);
  if (error && !isMissingTable(error)) throw bountyLayerError("attachFork", error);
}

/** Let go of a claim. */
export async function releaseClaim({ requestId, userId }: { requestId: string; userId: string }): Promise<void> {
  const { error } = await table().delete().eq("request_id", requestId).eq("user_id", userId);
  if (error && !isMissingTable(error)) throw bountyLayerError("releaseClaim", error);
}
