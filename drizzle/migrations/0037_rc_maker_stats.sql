CREATE OR REPLACE FUNCTION public.maker_stats(uid uuid)
RETURNS TABLE (
  builds                 bigint,
  reproductions_received bigint,
  rebuilds_of_their_work bigint,
  gaps_solved            bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH theirs AS (
    SELECT b.id
      FROM public.builds b
     WHERE b.creator_id = maker_stats.uid
       AND b.status IN ('published', 'gallery')
  )
  SELECT
    (SELECT count(*) FROM theirs) AS builds,
    (SELECT count(*)
       FROM public.build_reproductions r
       JOIN theirs t ON t.id = r.build_id
      WHERE r.worked
        AND r.user_id <> maker_stats.uid) AS reproductions_received,
    (SELECT count(*)
       FROM public.builds c
       JOIN public.builds p ON p.id = c.parent_build_id
      WHERE p.creator_id = maker_stats.uid
        AND c.creator_id <> maker_stats.uid
        AND c.status IN ('published', 'gallery')) AS rebuilds_of_their_work,
    (SELECT count(*)
       FROM public.solutions s
       JOIN public.bounties bo ON bo.id = s.bounty_id
      WHERE s.solver_id = maker_stats.uid
        AND s.status = 'accepted'
        AND bo.build_id IS NOT NULL) AS gaps_solved;
$$;

COMMENT ON FUNCTION public.maker_stats(uuid) IS
  'A maker''s four figures, in one row: their published or gallery builds; worked runs of those builds recorded by other people; published or gallery builds by other people whose parent is one of theirs; their accepted solutions on bounties that live on a build. SECURITY INVOKER — row-level security decides what counts. Consumed by src/lib/profile/makerStats.ts (RC-P21).';

CREATE OR REPLACE FUNCTION public.maker_build_metrics(uid uuid)
RETURNS TABLE (
  build_id            uuid,
  runs                bigint,
  worked              bigint,
  failed_last_30_days bigint,
  open_bounties       bigint,
  solutions_waiting   bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH theirs AS (
    SELECT b.id, b.reproduction_count, b.last_confirmed_at, b.published_at
      FROM public.builds b
     WHERE b.creator_id = maker_build_metrics.uid
       AND b.status IN ('published', 'gallery')
     ORDER BY b.reproduction_count DESC,
              b.last_confirmed_at DESC NULLS LAST,
              b.published_at DESC NULLS LAST,
              b.id DESC
     LIMIT 50
  )
  SELECT t.id AS build_id,
         runs.total                  AS runs,
         runs.worked                 AS worked,
         runs.failed_last_30_days    AS failed_last_30_days,
         asks.open_bounties          AS open_bounties,
         waiting.solutions_waiting   AS solutions_waiting
    FROM theirs t
    CROSS JOIN LATERAL (
      SELECT count(*)                                  AS total,
             count(*) FILTER (WHERE r.worked)          AS worked,
             count(*) FILTER (WHERE NOT r.worked
                                AND r.confirmed_at >= now() - interval '30 days')
                                                       AS failed_last_30_days
        FROM public.build_reproductions r
       WHERE r.build_id = t.id
         AND r.user_id <> maker_build_metrics.uid
    ) runs
    CROSS JOIN LATERAL (
      SELECT count(*) AS open_bounties
        FROM public.bounties bo
       WHERE bo.build_id = t.id
         AND bo.status = 'open'
    ) asks
    CROSS JOIN LATERAL (
      SELECT count(*) AS solutions_waiting
        FROM public.solutions s
        JOIN public.bounties bo ON bo.id = s.bounty_id
       WHERE bo.build_id = t.id
         AND bo.status = 'open'
         AND s.status = 'submitted'
    ) waiting
   ORDER BY t.reproduction_count DESC,
            t.last_confirmed_at DESC NULLS LAST,
            t.published_at DESC NULLS LAST,
            t.id DESC;
$$;

COMMENT ON FUNCTION public.maker_build_metrics(uuid) IS
  'Per published or gallery build of a maker, at most 50 in the gallery''s order (reproductions, last confirmed, published, id): runs reported by other people, how many worked, how many did not work within 30 days, open bounties, and submitted solutions waiting on those open bounties. SECURITY INVOKER — row-level security decides what counts. Consumed by src/lib/analytics/buildStats.ts (RC-P23).';

REVOKE ALL ON FUNCTION public.maker_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maker_stats(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.maker_build_metrics(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maker_build_metrics(uuid) TO anon, authenticated;