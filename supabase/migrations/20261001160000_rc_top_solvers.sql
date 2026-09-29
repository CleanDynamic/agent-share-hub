-- =============================================================================
-- RC-P13 — top_solvers: the people whose solutions were accepted
-- =============================================================================
-- WHAT IT ANSWERS. One row per solver: how many of their solutions were
-- accepted on bounties that live on a build, the rewards those bounties
-- carried, and when they last solved one. Most solved first; ties go to the
-- larger reward total (a solver whose bounties named no reward sorts after one
-- whose did), then to the most recent solve. At most 100 rows, whatever
-- max_results asks for, and at least one.
--
-- WHAT COUNTS AS A SOLVE. A solutions row whose status is 'accepted', on a
-- bounties row with a build_id. Solving on the build path means exactly that
-- (accept_bounty_solution sets both status and accepted_at). A legacy bounty
-- (legacy_item_id, no build_id) is not counted: /b/:id/leaderboard ranked
-- people against one legacy post, and after the clear there is nothing there
-- to rank. since_days, when given, keeps only solves accepted within that many
-- days; the page does not pass it, because the board offers no time range.
--
-- SECURITY INVOKER ⟦supabase-postgres-best-practices ›
-- references/security-rls-basics.md⟧: the caller's own row-level security on
-- solutions and bounties decides which solves are counted. For every reader
-- that includes each accepted solution on a bounty whose build is not a draft
-- ("Public can view non-draft solutions on published bounties", 20260828160000),
-- so the board is the same signed in or out, and it never counts a row the
-- caller could not read for themselves. It never reads the caller's id.
-- STABLE; it writes nothing.
--
-- THE INDEX ⟦references/query-partial-indexes.md⟧ holds only accepted
-- solutions, the rows this function reads, keyed by solver: the other statuses
-- (draft, submitted, withdrawn) are most of the table and none of the answer.
-- CREATE INDEX takes a short lock on solutions, which is small.
--
-- THE CHECK TO RUN once applied (L-P13-1):
--   select * from public.top_solvers(5);
-- =============================================================================


-- =============================================================================
-- 1. top_solvers
-- =============================================================================
CREATE OR REPLACE FUNCTION public.top_solvers(
  max_results INT DEFAULT 25,
  since_days  INT DEFAULT NULL
)
RETURNS TABLE (
  user_id        UUID,
  solved         BIGINT,
  reward_total   NUMERIC,
  last_solved_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT s.solver_id        AS user_id,
         count(*)           AS solved,
         sum(b.reward_gbp)  AS reward_total,
         max(s.accepted_at) AS last_solved_at
    FROM public.solutions s
    JOIN public.bounties b ON b.id = s.bounty_id
   WHERE s.status = 'accepted'
     AND b.build_id IS NOT NULL
     AND (since_days IS NULL OR s.accepted_at >= now() - make_interval(days => since_days))
   GROUP BY s.solver_id
   ORDER BY solved DESC, reward_total DESC NULLS LAST, last_solved_at DESC
   LIMIT LEAST(GREATEST(max_results, 1), 100);
$$;

COMMENT ON FUNCTION public.top_solvers(INT, INT) IS
  'The solvers board: one row per solver with the number of their solutions accepted on bounties that live on a build, the total reward of those bounties and the latest acceptance, most solved first, then larger reward total, then most recent; optionally only solves accepted within since_days; between 1 and 100 rows. SECURITY INVOKER — row-level security decides which solves count. Consumed by src/lib/bounty/solvers.ts.';


-- =============================================================================
-- 2. Grants
-- =============================================================================
-- The board is read signed out as well as signed in, so both roles may call
-- it; row-level security, not the grant, keeps the answer honest.
REVOKE ALL ON FUNCTION public.top_solvers(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.top_solvers(INT, INT) TO anon, authenticated;


-- =============================================================================
-- 3. The partial index
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_solutions_accepted_solver
  ON public.solutions (solver_id, accepted_at)
  WHERE status = 'accepted';
