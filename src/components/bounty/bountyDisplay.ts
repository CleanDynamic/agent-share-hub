// The words and figures a bounty is rendered with, in one place.
//
// Four surfaces print the same two facts about a bounty — the gap panel on the
// build page, the solve panel inside it, the gallery card's pill and the feed's
// bounty strip — and a reward formatted four ways is four chances for one of
// them to say £120 where another says £120.00. So the formatting lives here and
// the surfaces render what it returns.
//
// PLAIN FUNCTIONS, NOT COMPONENTS. Each one answers with a string or null, and
// null always means "say nothing": an unpriced bounty has no reward line, a
// bounty with no deadline has no deadline line, and neither is a zero to print.

/**
 * The reward, as money. Null for an unpriced bounty.
 *
 * reward_gbp is NUMERIC on the row, which PostgREST may hand back as a number
 * or as a string depending on its size, so both are accepted and anything else
 * — null, an empty string, a value that is not a number — reads as unpriced.
 * Whole pounds lose the decimals: "£120" is what a creator typed and "£120.00"
 * is a bank statement.
 */
export function rewardLabel(reward: number | string | null | undefined): string | null {
  if (reward === null || reward === undefined || reward === "") return null;
  const amount = typeof reward === "number" ? reward : Number(reward);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const whole = Number.isInteger(amount);
  return `£${amount.toLocaleString("en-GB", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * What the card pill and the feed strip say: "bounty · £120", or "bounty".
 *
 * THE UNPRICED FORM IS NOT A DEGRADED ONE. A gap with no reward is a real open
 * bounty — it is filed, it is on the board, and somebody can solve it — so the
 * pill says the same word with nothing after it rather than disappearing.
 */
export function bountyPillLabel(
  reward: number | string | null | undefined,
): string {
  const money = rewardLabel(reward);
  return money ? `bounty · ${money}` : "bounty";
}

/**
 * "closes today", "closes in 6 days", "closed 2 days ago". Null for no deadline.
 *
 * A PASSED DEADLINE IS REPORTED, NOT HIDDEN. bounties.status stays 'open' until
 * something sweeps deadlines — nothing does yet, as NS-P45 says in its comment
 * on the 'expired' status — so a reader looking at a bounty whose date has gone
 * is entitled to be told rather than shown a date they have to subtract from
 * today themselves.
 */
export function deadlineLabel(
  closesAt: string | null | undefined,
  now: number = Date.now(),
): string | null {
  if (!closesAt) return null;
  const at = Date.parse(closesAt);
  if (Number.isNaN(at)) return null;

  const days = Math.round((at - now) / 86_400_000);
  if (days < 0) {
    const ago = Math.abs(days);
    return ago === 1 ? "closed yesterday" : `closed ${ago} days ago`;
  }
  if (days === 0) return "closes today";
  if (days === 1) return "closes tomorrow";
  if (days < 14) return `closes in ${days} days`;
  if (days < 60) return `closes in ${Math.floor(days / 7)} weeks`;
  return `closes in ${Math.floor(days / 30)} months`;
}

/** "3 solutions", "1 solution", "no solutions yet". */
export function solutionCountLabel(count: number): string {
  if (count <= 0) return "no solutions yet";
  return count === 1 ? "1 solution" : `${count} solutions`;
}

/**
 * "3 REPROS" — the evidence under a rebuild-solution, in RebuildsTab's words.
 *
 * WHY A SOLUTION SHOWS THIS AT ALL. A rebuild-solution is a published build,
 * and a published build has the one number on this platform that cannot be
 * self-awarded: how many people ran it and said what happened. Two answers to
 * the same gap are otherwise ranked by votes, which measure who read them
 * first. This is what lets evidence rank them instead.
 */
export function reproductionLabel(count: number | null | undefined): string {
  const runs = Number(count ?? 0);
  if (!Number.isFinite(runs) || runs <= 0) return "no repros yet";
  return runs === 1 ? "1 repro" : `${runs} repros`;
}

/** "@rae", or "someone" for a solver whose profile is gone. */
export function solverHandle(
  solver: { username?: string | null; display_name?: string | null } | null,
): string {
  const handle = (solver?.username ?? "").trim();
  if (handle) return `@${handle}`;
  const name = (solver?.display_name ?? "").trim();
  return name || "someone";
}
