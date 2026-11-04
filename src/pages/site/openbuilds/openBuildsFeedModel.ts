// UX-05 Part 2: the OpenBuilds feed's address, keys and words. Pure.

import { postKey } from "@/lib/openbuilds/types";

/** Where the reader is lives in the address: `?scope=everyone` and `?open=1`. A default value leaves it. */
export type FeedScope = "mine" | "everyone";

export interface FeedAddress {
  scope: FeedScope;
  open: boolean;
}

/** Signed in, the default is Your spaces; signed out there is only Everyone. */
export function readFeedAddress(params: URLSearchParams, signedIn: boolean): FeedAddress {
  return { scope: signedIn && params.get("scope") !== "everyone" ? "mine" : "everyone", open: params.get("open") === "1" };
}

/** The address with `next` in it; a default value leaves the address. Other parameters stay. */
export function feedSearch(params: URLSearchParams, next: Partial<FeedAddress>, signedIn: boolean): URLSearchParams {
  const out = new URLSearchParams(params);
  if (next.scope !== undefined) {
    if (next.scope === "mine" || !signedIn) out.delete("scope");
    else out.set("scope", "everyone");
  }
  if (next.open !== undefined) {
    if (next.open) out.set("open", "1");
    else out.delete("open");
  }
  return out;
}

/** The reads' keys, shared by the page and the route table's prefetch: ['posts', '<fn>', ...args]. */
export const feedKey = (scope: FeedScope, open: boolean, viewerId: string | null) => postKey("listPostCards", "feed", scope, open, viewerId);
export const mySpacesKey = (viewerId: string | null) => postKey("listMySpaces", viewerId);
export const busySpacesKey = postKey("listBusySpaces");
export const recentTimesKey = (ids: readonly string[]) => postKey("listRecentPostTimes", ...ids);

/** Posts a page. */
export const FEED_PAGE = 20;

/** "3 new", or nothing at zero. */
export const newWords = (n: number): string | null => (n > 0 ? `${n} new` : null);

/** "Made by @sam · 412 members". */
export function busyMeta(handle: string | null, members: number): string {
  return `Made by ${handle ? `@${handle}` : "someone"} · ${members} ${members === 1 ? "member" : "members"}`;
}

/** How many of a space's posts are newer than the reader's last visit (or the week, when there was none). */
export function freshCount(times: readonly string[] | undefined, seenAt: string | null): number {
  if (!times) return 0;
  const since = seenAt ? Date.parse(seenAt) : 0;
  return times.filter((time) => Date.parse(time) > since).length;
}

const SEEN_PREFIX = "openbuilds:seen:";
/** The time the reader last opened a space. Browser storage can be missing or refuse: then there is none. */
export function readSeen(slug: string): string | null {
  try {
    return window.localStorage.getItem(`${SEEN_PREFIX}${slug}`);
  } catch {
    return null;
  }
}
export function markSeen(slug: string, now: number = Date.now()): void {
  try {
    window.localStorage.setItem(`${SEEN_PREFIX}${slug}`, new Date(now).toISOString());
  } catch {
    /* a per-reader convenience only */
  }
}
