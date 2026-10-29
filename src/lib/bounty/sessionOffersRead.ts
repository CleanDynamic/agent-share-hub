// SV-21 P3: the offers on requests for a session or a part, read. Kept apart from the writes (`sessionOffers.ts`, which
// forks and writes whole sessions) so the OpenBuilds read does not carry them.
//
// THE TABLE MAY NOT BE THERE YET. A read answers "no offers" when the error's code says the table is missing (42P01 or
// PGRST205, never its words).

import { supabase } from "@/integrations/supabase/client";
import type { OfferedSession } from "@/lib/build/addSession";
import { bountyLayerError } from "./types";

export interface SessionOffer {
  id: string;
  requestId: string;
  userId: string;
  /** Without the @. */
  handle: string | null;
  status: "offered" | "accepted" | "declined";
  createdAt: string;
  session: OfferedSession;
}

export interface OfferQuery extends PromiseLike<{ data: unknown; error: unknown }> {
  eq(column: string, value: unknown): OfferQuery;
  in(column: string, values: readonly unknown[]): OfferQuery;
  order(column: string, options: { ascending: boolean }): OfferQuery;
  limit(count: number): OfferQuery;
  select(columns: string): OfferQuery;
  maybeSingle(): PromiseLike<{ data: unknown; error: unknown }>;
  single(): PromiseLike<{ data: unknown; error: unknown }>;
}

export interface OfferTable {
  select(columns: string): OfferQuery;
  insert(row: Record<string, unknown>): OfferQuery;
  update(row: Record<string, unknown>): OfferQuery;
}

export const offerTable = (name: string) => (supabase as unknown as { from: (name: string) => OfferTable }).from(name);

const MISSING_TABLE = new Set(["42P01", "PGRST205"]);
export const isMissingOfferTable = (error: unknown): boolean => MISSING_TABLE.has(String((error as { code?: unknown } | null)?.code));
export const OFFERS_NOT_LIVE = "Offering a session is not available yet";

/** Most offers a screen reads. */
const OFFERS_LIMIT = 50;

export interface OfferRow {
  id: string;
  request_id: string;
  user_id: string;
  status: SessionOffer["status"];
  created_at: string;
  snapshot: OfferedSession;
  profiles: { username: string | null } | null;
}

export const OFFER_COLUMNS = "id, request_id, user_id, status, created_at, snapshot, profiles!request_offers_user_id_fkey(username)";

export const toOffer = (row: OfferRow): SessionOffer => ({
  id: row.id,
  requestId: row.request_id,
  userId: row.user_id,
  handle: row.profiles?.username ?? null,
  status: row.status,
  createdAt: row.created_at,
  session: row.snapshot,
});

/** The offers on these requests that nobody has decided, newest first. Only the offerer and the request's maker can read them. */
export async function listOpenOffers(requestIds: readonly string[]): Promise<SessionOffer[]> {
  if (requestIds.length === 0) return [];
  const { data, error } = await offerTable("request_offers")
    .select(OFFER_COLUMNS)
    .in("request_id", [...requestIds])
    .eq("status", "offered")
    .order("created_at", { ascending: false })
    .limit(OFFERS_LIMIT);
  if (error) {
    if (isMissingOfferTable(error)) return [];
    throw bountyLayerError("listOpenOffers", error);
  }
  return ((data ?? []) as OfferRow[]).map(toOffer);
}
