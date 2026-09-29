-- =============================================================================
-- RC-P21 — maker_stats and maker_build_metrics: a maker's standing, counted
-- =============================================================================
-- WHAT A MAKER'S STANDING IS. Four figures, each something the maker built or
-- something other people did with it: what they published, how many times
-- other people got it working, how many times other people rebuilt it, and
-- how many gaps they solved on somebody's build. maker_stats answers all four
-- in one round trip, which is the profile's one request for its figures row
-- ⟦neoscale-performance⟧.
--
--   builds                   their builds whose status is 'published' or
--                            'gallery' ('gallery' is a curated published
--                            build, not a third state).
--   reproductions_received   runs of those builds that worked, recorded by
--                            somebody other than the maker (build_reproductions
--                            holds one row per person per build, and worked
--                            says whether it worked for them).
--   rebuilds_of_their_work   published or gallery builds by somebody else whose
--                            parent_build_id is one of the maker's builds, in
--                            any status: a rebuild still credits a build its
--                            maker later took back to draft, though a visitor,
--                            who cannot read that draft, does not count it.
--   gaps_solved              the maker's solutions that were accepted, on
--                            bounties that live on a build (bounties.build_id
--                            set); a legacy bounty on a post is not counted,
--                            exactly as top_solvers counts (RC-P13).
--
-- maker_build_metrics is the per-build view RC-P23's analytics table reads:
-- for each of the maker's published or gallery builds, at most 50, the runs
-- other people reported, how many worked, how many did not work within the
-- last 30 days, the open bounties on it, and the submitted solutions waiting
-- on those open bounties. The 50 are the maker's builds in the gallery's own
-- order (reproductions, then last confirmed, then published, then id), so a
-- caller reading the same builds in the same order with the same cap holds
-- exactly the rows this returns.
--
-- SECURITY INVOKER ⟦supabase-postgres-best-practices ›
-- references/security-rls-basics.md⟧: the caller's own row-level security on
-- builds, build_reproductions, bounties and solutions decides what is counted,
-- so neither function can report a row the caller could not read for
-- themselves. For a visitor that is every published build that is not hidden,
-- the runs on them, the bounties homed on them and the solutions that are not
-- drafts; the maker also counts their own hidden builds, as they read them
-- everywhere else. Neither function reads the caller's id. STABLE; neither
-- writes anything.
--
-- NO NEW INDEX ⟦references/query-composite-indexes.md⟧. Every question these
-- functions ask leads with an equality the existing indexes already serve:
--   builds by maker                  idx_builds_creator (creator_id)
--   runs of a build                  build_reproductions (build_id, user_id),
--                                    unique; the 30-day window reads
--                                    idx_build_reproductions_build_confirmed
--                                    (build_id, confirmed_at DESC), equality
--                                    first and the range last
--   rebuilds of a build              idx_builds_parent_build (parent_build_id)
--   the maker's accepted solutions   idx_solutions_solver_status
--                                    (solver_id, status), both equalities
--   bounties on a build              idx_bounties_build (build_id)
--   solutions waiting on a bounty    idx_solutions_bounty_slot_status
--                                    (bounty_id, slot_id, status)
-- The status filters then read a maker's own handful of rows. A composite
-- (creator_id, status) would duplicate idx_builds_creator for no measurable
-- gain at today's sizes, and every index is a cost on every builds write.
--
-- THE CHECK TO RUN once applied (L-P21-1):
--   select * from public.maker_stats((select id from public.profiles limit 1));
-- =============================================================================


-- =============================================================================
-- 1. maker_stats
-- =============================================================================
-- Parameters are written maker_stats.uid: a column named uid on any of the
-- four tables would otherwise take precedence over the argument in a SQL
-- function's body, silently.
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


-- =============================================================================
-- 2. maker_build_metrics
-- =============================================================================
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


-- =============================================================================
-- 3. Grants
-- =============================================================================
-- A profile is read signed out as well as signed in, so both roles may call
-- them; row-level security, not the grant, keeps each answer honest.
REVOKE ALL ON FUNCTION public.maker_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maker_stats(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.maker_build_metrics(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maker_build_metrics(uuid) TO anon, authenticated;
