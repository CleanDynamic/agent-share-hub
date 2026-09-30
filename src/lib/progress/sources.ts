// RC-P27 — the six sources of XP, as the progress page lists them under "How you earn".
//
// docs/reconciliation/XP-DESIGN.md › Sources is the specification. The event
// and the XP are its words, in its order; sources.test.ts reads the document's
// table and holds this list to it, so the page cannot promise XP the database
// does not pay. Nothing here pays anything: the database writes XP, from the
// triggers of 20261001240000_rc_xp_build_events.sql, and nothing else does.

export interface XpSource {
  /** XP-DESIGN.md's Event column, word for word. */
  event: string;
  /** XP-DESIGN.md's XP column, word for word. */
  xp: string;
}

/** The complete list: there is no XP for likes, comments, saves, follows, logins or streaks. */
export const XP_SOURCES: readonly XpSource[] = [
  { event: "Your build is published (first time only)", xp: "10" },
  { event: "Someone else runs your build and it works", xp: "25" },
  { event: "You run someone else's build and report the result", xp: "5" },
  { event: "Someone publishes a rebuild of your build", xp: "30" },
  { event: "Your solution is accepted", xp: "50 plus 1 per £ of reward, at most 150" },
  { event: "Your build is confirmed working again after being stale", xp: "15" },
];
