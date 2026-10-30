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

REVOKE ALL ON FUNCTION public.top_solvers(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.top_solvers(INT, INT) TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_solutions_accepted_solver
  ON public.solutions (solver_id, accepted_at)
  WHERE status = 'accepted';