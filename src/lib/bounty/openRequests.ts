// UX-09 Q3: whether any request is still open, the one test that retires Older requests.
//
// Requests are public.bounties rows; open is status = 'open', as listOpenBounties reads it. Once none is open, OpenBuilds stops
// offering "Older requests" and /openbuilds/requests sends the reader to /openbuilds. Nothing is deleted: each request's own page
// (/openbuilds/<id>/solve, /bounties/<id>/solve) stays where a build page or a notification links to it.
//
// One request, served by the (status, closes_at) index on bounties: at most one id is read, never a count. A failed read says nothing, so the
// caller keeps the way in (only a definite false retires it).

import { supabase } from "@/integrations/supabase/client";
import { bountyLayerError } from "./types";

export const OPEN_REQUESTS_KEY = ["bounty", "hasOpenRequests"] as const;

/** True while at least one request is open. Throws when the read fails. */
export async function hasOpenRequests(): Promise<boolean> {
  const { data, error } = await supabase.from("bounties").select("id").eq("status", "open").limit(1);
  if (error) throw bountyLayerError("hasOpenRequests", error);
  return (data ?? []).length > 0;
}
