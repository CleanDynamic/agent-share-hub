// Follow and unfollow a maker, from their profile (UI-P34a).
//
// THE SAME TWO WRITES THE PROFILE PAGE ALWAYS MADE — an insert into and a delete
// from `follows` — moved out of the page so that no component calls Supabase
// (RULES §3). The page keeps the optimistic count and the toast; these only
// write, and throw an error that carries identifiers and nothing the database
// said.

import { supabase } from "@/integrations/supabase/client";

/** The failure of a follow write: identifiers, a code and a status. */
export class FollowError extends Error {
  readonly operation: string;
  readonly userId: string;
  /** The Postgres or PostgREST code, e.g. "42501"; read by isPermissionError. */
  readonly code: string | null;
  /** The HTTP status; read by isPermissionError. */
  readonly status: number | null;

  constructor(operation: string, userId: string, code: string | null, status: number | null) {
    super(`${operation} failed (user ${userId})`);
    this.name = "FollowError";
    this.operation = operation;
    this.userId = userId;
    this.code = code;
    this.status = status;
  }
}

function failure(operation: string, userId: string, response: { error: unknown; status?: number }) {
  const { code } = (response.error ?? {}) as { code?: unknown };
  return new FollowError(
    operation,
    userId,
    typeof code === "string" && code ? code : null,
    typeof response.status === "number" && response.status > 0 ? response.status : null,
  );
}

/** `followerId` follows `makerId`. */
export async function followMaker(followerId: string, makerId: string): Promise<void> {
  const response = await supabase
    .from("follows")
    .insert({ follower_id: followerId, following_id: makerId } as never);
  if (response.error) throw failure("followMaker", followerId, response);
}

/** `followerId` stops following `makerId`. */
export async function unfollowMaker(followerId: string, makerId: string): Promise<void> {
  const response = await supabase.from("follows").delete().eq("follower_id", followerId).eq("following_id", makerId);
  if (response.error) throw failure("unfollowMaker", followerId, response);
}
