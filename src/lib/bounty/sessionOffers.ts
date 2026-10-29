// SV-21 P3: offering a session to a request for a session or a part, and the maker accepting it.
//
// OFFER. The contributor picks one of their imports. A fork of the request's build is made for them, the session is added to
// the fork by addSession's rule (prompt text, model and source only; the answers and the rest of the verbatim session stay in
// the import), they take the request's claim with the fork, and the offer is filed with a snapshot of the same prompts. The
// snapshot is what the maker reads and accepts: the fork is a draft the maker cannot open.
//
// ACCEPT. Only the build's maker. The snapshot is written into their own build at the end of the part the request was for,
// every tile and the session credited to the contributor (SV-16), the request's mark on the session or part is cleared, the
// offer is accepted and the request is solved. Other offers on the request stay as they are for the maker to decline.
//
// THE TABLE MAY NOT BE THERE YET. Reads answer "no offers" and an offer or an accept says so in a sentence, when the error's
// code says the table is missing (42P01 or PGRST205, never its words).

import { addOfferedSession, addSessionToBuild, loadOfferedSession } from "@/lib/build/addSession";
import { deleteBuild } from "@/lib/build/builds";
import { readMaking, sessionsMetaOf, setPartOpen, setSessionOpen } from "@/lib/build/making";
import { startRebuild } from "@/lib/build/rebuild";
import { claimRequest } from "./claims";
import { isMissingOfferTable, OFFER_COLUMNS, OFFERS_NOT_LIVE, offerTable, toOffer, type OfferRow, type SessionOffer } from "./sessionOffersRead";
import { bountyLayerError } from "./types";

export type { SessionOffer } from "./sessionOffersRead";
export { listOpenOffers } from "./sessionOffersRead";

interface RequestRow {
  id: string;
  build_id: string | null;
  status: string;
  size: "session" | "part" | null;
  target_key: string | null;
  author_id: string;
}

async function readRequest(requestId: string, caller: string): Promise<RequestRow & { build_id: string; target_key: string }> {
  const { data, error } = await offerTable("bounties").select("id, build_id, status, size, target_key, author_id").eq("id", requestId).maybeSingle();
  if (error) throw bountyLayerError(`${caller} (request)`, error);
  const row = data as RequestRow | null;
  if (!row) throw new Error("That request is not there any more");
  if (row.status !== "open") throw new Error("That request is closed");
  if (!row.size || !row.target_key || !row.build_id) throw new Error("That request is not for a session or a part");
  return row as RequestRow & { build_id: string; target_key: string };
}

/** The part a session joins: the part itself for a request for a part, the session's own part for a request for a session. */
async function partOfRequest(request: { build_id: string; size: "session" | "part"; target_key: string }): Promise<string | undefined> {
  if (request.size === "part") return request.target_key;
  return sessionsMetaOf(await readMaking(request.build_id))[request.target_key]?.workstream;
}

/**
 * Offer one of the reader's sessions to a request. Everything made for the offer is undone if any of it fails: a fork
 * that holds no offer is deleted. The claim is the board's courtesy: someone else holding it never stops an offer.
 */
export async function offerSession({ requestId, importId, userId }: { requestId: string; importId: string; userId: string }): Promise<SessionOffer> {
  const request = await readRequest(requestId, "offerSession");
  if (request.author_id === userId) throw new Error("You made this build, so you can add the session to it yourself");
  const session = await loadOfferedSession(importId);
  const part = await partOfRequest(request);

  const fork = await startRebuild({ sourceBuildId: request.build_id });
  try {
    await addSessionToBuild(importId, { kind: "existing", buildId: fork.id, ...(part ? { workstream: part } : null) });
    const { data, error } = await offerTable("request_offers")
      .insert({ request_id: requestId, user_id: userId, fork_build_id: fork.id, session_key: importId, snapshot: session })
      .select(OFFER_COLUMNS)
      .single();
    if (error) {
      if (isMissingOfferTable(error)) throw new Error(OFFERS_NOT_LIVE);
      if ((error as { code?: string }).code === "23505") throw new Error("You have already offered that session to this request");
      throw bountyLayerError("offerSession", error);
    }
    await claimRequest({ requestId, userId, forkBuildId: fork.id }).catch(() => false);
    return toOffer(data as OfferRow);
  } catch (error) {
    await deleteBuild(fork.id).catch(() => undefined);
    throw error;
  }
}

/** Accept an offer into the maker's own build. Resolves with the build's id. */
export async function acceptOffer({ offerId, makerId }: { offerId: string; makerId: string }): Promise<string> {
  const { data, error } = await offerTable("request_offers").select(OFFER_COLUMNS).eq("id", offerId).maybeSingle();
  if (error) {
    if (isMissingOfferTable(error)) throw new Error(OFFERS_NOT_LIVE);
    throw bountyLayerError("acceptOffer", error);
  }
  if (!data) throw new Error("That offer is not there any more");
  const offer = toOffer(data as OfferRow);
  if (offer.status !== "offered") throw new Error("That offer has been decided");
  const request = await readRequest(offer.requestId, "acceptOffer");
  if (request.author_id !== makerId) throw new Error("Only the person who made the build can accept an offer");

  const part = await partOfRequest(request);
  await addOfferedSession(request.build_id, offer.session, offer.userId, part);

  // The session is in. What is left is bookkeeping, and each step is its own: a failure here is told, not undone.
  const settled = new Date().toISOString();
  const marks = request.size === "part" ? setPartOpen(request.build_id, request.target_key, null) : setSessionOpen(request.build_id, request.target_key, null);
  const [offerWrite, requestWrite] = await Promise.all([
    offerTable("request_offers").update({ status: "accepted", decided_at: settled }).eq("id", offerId),
    offerTable("bounties").update({ status: "solved", solved_at: settled }).eq("id", request.id),
    marks.catch(() => undefined),
  ]);
  if (offerWrite.error) throw bountyLayerError("acceptOffer (offer)", offerWrite.error);
  if (requestWrite.error) throw bountyLayerError("acceptOffer (request)", requestWrite.error);
  return request.build_id;
}

/** The maker declines an offer. The contributor's fork is theirs and stays. */
export async function declineOffer(offerId: string): Promise<void> {
  const { error } = await offerTable("request_offers").update({ status: "declined", decided_at: new Date().toISOString() }).eq("id", offerId);
  if (error) {
    if (isMissingOfferTable(error)) throw new Error(OFFERS_NOT_LIVE);
    throw bountyLayerError("declineOffer", error);
  }
}
