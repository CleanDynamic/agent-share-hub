-- =============================================================================
-- RC-P25 — XP is earned from build events, written by the database and by
-- nothing else
-- =============================================================================
-- docs/reconciliation/XP-DESIGN.md is the specification. Six events write XP.
-- Each is something another person caused or verified, except publishing, which
-- is once per build. One function writes every row, and nothing but the
-- database's own triggers can call it:
--
--   reason             earner               XP                   key in xp_events (source_type, source_id)   cap
--   build_published    the creator          10                   build, the build                            once per build; 3 a day
--   build_reproduced   the creator          25                   build, md5(build || runner)::uuid           once per (build, runner)
--   run_reported       the runner           5                    build, the build                            once per build; 10 a day
--   build_rebuilt      the parent's creator 30                   build, the rebuild                          once per (parent, rebuild)
--   solution_accepted  the solver           50 + 1 a £, at most 150   solution, the solution                  once per solution
--   build_reconfirmed  the creator          15                   build, md5(build || window)::uuid           once per build per 120 days
--
-- ONE WRITER. rc_grant_xp(recipient, amount, reason, source_type, source_id)
-- writes nothing when the recipient is missing or the amount is not positive,
-- enforces the daily caps, inserts the ledger row, and, only if a row went in,
-- adds the amount to user_progress.xp_total and sets user_progress.level from
-- calc_level_from_xp, the existing curve, which is called and never changed.
-- It is SECURITY DEFINER and executable by nobody but its owner: not PUBLIC, not
-- anon, not authenticated ⟦supabase-postgres-best-practices › references/
-- security-privileges.md⟧. The four trigger functions are SECURITY DEFINER for
-- that reason, since a trigger runs as the reader who caused it, and none of
-- them is executable by anyone either: a trigger fires without EXECUTE.
--
-- EVERY "ONCE PER" CAP IS THE DATABASE'S. A partial unique index on xp_events
-- (user_id, reason, source_type, source_id) WHERE source_id IS NOT NULL is the
-- cap, and the insert is ON CONFLICT DO NOTHING, so a repeat writes neither the
-- ledger row nor the total. Where the cap names a pair, the source_id is that
-- pair hashed to a uuid: md5(build || runner) for one run per person, and
-- md5(build || window) for the 120-day cap, where window is the epoch cut into
-- 120-day steps. The two daily caps count today's xp_events for the recipient
-- and reason (events, as the ledger reads; today is the UTC day, as streaks
-- use), under an advisory lock on that pair so two simultaneous grants cannot
-- both pass the count ⟦references/lock-advisory.md⟧.
--
-- SELF-ACTIONS EARN NOTHING, except the two the design names. A run of your own
-- build is refused by the reproductions policy already and skipped here as
-- well; a rebuild by the parent's own creator and a solution its own poster
-- accepted earn nothing. Publishing, and re-confirming a stale build of your
-- own (recordSelfConfirmation, the Keeper path), earn by design.
--
-- WHERE EACH TRIGGER HANGS, AND WHY THE SOLVER'S IS NOT ON solutions.status.
--   builds (INSERT or status)        build_published, build_rebuilt
--   builds (last_confirmed_at)       build_reconfirmed
--   build_reproductions              run_reported, build_reproduced
--   solution_acceptance_log          solution_accepted
-- "Solver can update own solution" lets a solver write any column of their own
-- row, status included, so a trigger on solutions.status would let a solver
-- accept themselves. solution_acceptance_log has no insert policy: only
-- accept_bounty_solution writes it, which only the bounty's author or an admin
-- can run, and in the transaction that marks the solution accepted.
--
-- STALE. build_reconfirmed uses the same test as isStale in
-- src/lib/build/signals.ts: whole days since the last confirmation, or since
-- publication when there never was one, past STALE_AFTER_DAYS, and a build that
-- was never published is never stale. The award is for the update that turns a
-- stale build fresh. rcGuards.test.ts reads this file and signals.ts and fails
-- if the two numbers differ.
--
-- eligible_at. award_xp also set user_progress.eligible_at the first time the
-- total reached 250. rc_grant_xp keeps that, so the column the reset empties is
-- filled again by the same rule.
--
-- NOT TOUCHED: award_xp (closed by 20261001230000), calc_level_from_xp, the
-- policies of xp_events and user_progress, and the streak columns and tables.
-- Applying the reset (20261001250000) after this file empties the ledger, so
-- any XP earned in between goes with it.
-- =============================================================================


-- =============================================================================
-- 0. The index needs a ledger with no repeated key
-- =============================================================================
-- award_xp could be called again and again with the same arguments, and the
-- ledger has never had a unique key. If the live ledger holds a repeat, the
-- index below cannot be built; this says so before anything else runs, and the
-- reset, which empties the ledger, is the way through. A NULL never collides in
-- a unique index, so a row with no source_type is not counted here either.
DO $$
DECLARE
  _repeats bigint;
BEGIN
  SELECT count(*) INTO _repeats
    FROM (
      SELECT 1
        FROM public.xp_events e
       WHERE e.source_id IS NOT NULL
         AND e.source_type IS NOT NULL
       GROUP BY e.user_id, e.reason, e.source_type, e.source_id
      HAVING count(*) > 1
    ) r;

  IF _repeats > 0 THEN
    RAISE EXCEPTION 'RC-P25: xp_events holds % key(s) on more than one row, so the once-per index cannot be built; nothing was changed. Apply the reset (Deploy queue item 16), which empties the ledger, and then this file', _repeats;
  END IF;
END
$$;


-- =============================================================================
-- a. rc_grant_xp: the one writer
-- =============================================================================
-- Parameters share names with xp_events columns, so every reference below is
-- qualified: a parameter as rc_grant_xp.<name>, a column through its alias.
CREATE OR REPLACE FUNCTION public.rc_grant_xp(
  recipient   uuid,
  amount      int,
  reason      text,
  source_type text,
  source_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cap     integer;
  _written bigint;
BEGIN
  IF rc_grant_xp.recipient IS NULL
     OR rc_grant_xp.amount IS NULL
     OR rc_grant_xp.amount <= 0 THEN
    RETURN;
  END IF;

  -- The daily caps, by reason. Every other reason has none.
  _cap := CASE rc_grant_xp.reason
            WHEN 'build_published' THEN 3
            WHEN 'run_reported'    THEN 10
          END;

  IF _cap IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(rc_grant_xp.recipient::text || ':' || rc_grant_xp.reason, 0));

    IF (
      SELECT count(*)
        FROM public.xp_events e
       WHERE e.user_id = rc_grant_xp.recipient
         AND e.reason = rc_grant_xp.reason
         AND e.created_at >= (date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
    ) >= _cap THEN
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.xp_events (user_id, amount, reason, source_type, source_id)
  VALUES (rc_grant_xp.recipient, rc_grant_xp.amount, rc_grant_xp.reason, rc_grant_xp.source_type, rc_grant_xp.source_id)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS _written = ROW_COUNT;
  IF _written = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.user_progress AS up (user_id, xp_total, level, eligible_at)
  VALUES (
    rc_grant_xp.recipient,
    rc_grant_xp.amount,
    public.calc_level_from_xp(rc_grant_xp.amount),
    CASE WHEN rc_grant_xp.amount >= 250 THEN now() END
  )
  ON CONFLICT (user_id) DO UPDATE
     SET xp_total    = up.xp_total + EXCLUDED.xp_total,
         level       = public.calc_level_from_xp(up.xp_total + EXCLUDED.xp_total),
         eligible_at = COALESCE(up.eligible_at, CASE WHEN up.xp_total + EXCLUDED.xp_total >= 250 THEN now() END);
END;
$$;

COMMENT ON FUNCTION public.rc_grant_xp(uuid, integer, text, text, uuid) IS
  'RC-P25. The one writer of XP, called by triggers only. Writes nothing for a missing recipient or an amount that is not positive, holds the daily caps (build_published 3, run_reported 10, counted in the UTC day), inserts the ledger row ON CONFLICT DO NOTHING against the once-per index, and only when a row went in adds the amount to user_progress and sets level from calc_level_from_xp.';

REVOKE EXECUTE ON FUNCTION public.rc_grant_xp(uuid, integer, text, text, uuid) FROM PUBLIC, anon, authenticated;


-- =============================================================================
-- b. Every "once per" cap, enforced by the database
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS uq_xp_events_once_per_source
  ON public.xp_events (user_id, reason, source_type, source_id)
  WHERE source_id IS NOT NULL;


-- =============================================================================
-- c. The six sources
-- =============================================================================

-- c1. builds: build_published and build_rebuilt
-- Fires when a build BECOMES visible (published or gallery): inserted visible,
-- or updated from draft. The same test as RC-P19's notification. A build that
-- is visible already and changes again earns nothing, and one that goes back to
-- draft and out again is caught by the once-per index, not by this test.
CREATE OR REPLACE FUNCTION public.rc_xp_build_visible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _parent_creator uuid;
BEGIN
  IF NEW.status NOT IN ('published', 'gallery') THEN
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('published', 'gallery') THEN
    RETURN NULL;
  END IF;

  -- Publishing: 10 to the creator. Once per build, 3 a day.
  PERFORM public.rc_grant_xp(NEW.creator_id, 10, 'build_published', 'build', NEW.id);

  -- A rebuild: 30 to the parent's creator, unless they rebuilt their own.
  -- A rebuild has one parent, so its id alone is the (parent, rebuild) pair.
  IF NEW.parent_build_id IS NOT NULL THEN
    SELECT b.creator_id INTO _parent_creator
      FROM public.builds b
     WHERE b.id = NEW.parent_build_id;

    IF _parent_creator IS DISTINCT FROM NEW.creator_id THEN
      PERFORM public.rc_grant_xp(_parent_creator, 30, 'build_rebuilt', 'build', NEW.id);
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_xp_build_visible ON public.builds;
CREATE TRIGGER trg_rc_xp_build_visible
AFTER INSERT OR UPDATE OF status ON public.builds
FOR EACH ROW EXECUTE FUNCTION public.rc_xp_build_visible();


-- c2. builds: build_reconfirmed
-- UPDATE OF fires whenever the column is named in the SET list, changed or not,
-- and refresh_build_reproduction_signals names it on every reproduction and can
-- move it back or to NULL, so the old and new values are compared here.
CREATE OR REPLACE FUNCTION public.rc_xp_build_reconfirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- STALE_AFTER_DAYS in src/lib/build/signals.ts is 120: a build is stale past
  -- this many whole days. The 120-day cap below uses the same number.
  stale_days constant integer := 120;
  _since     timestamptz;
BEGIN
  IF NEW.last_confirmed_at IS NULL THEN
    RETURN NULL;
  END IF;

  -- Stale before this update? As isStale: the last confirmation, or the
  -- publication date if there never was one; never published is never stale.
  _since := COALESCE(OLD.last_confirmed_at, OLD.published_at);
  IF _since IS NULL
     OR floor(extract(epoch FROM (now() - _since)) / 86400) <= stale_days THEN
    RETURN NULL;
  END IF;

  -- Fresh now? A confirmation that is itself past the window is not one.
  IF floor(extract(epoch FROM (now() - NEW.last_confirmed_at)) / 86400) > stale_days THEN
    RETURN NULL;
  END IF;

  -- 15 to the creator, once per build per window.
  PERFORM public.rc_grant_xp(
    NEW.creator_id, 15, 'build_reconfirmed', 'build',
    md5(NEW.id::text || ':' || (floor(extract(epoch FROM now()) / (stale_days * 86400)))::bigint::text)::uuid
  );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_xp_build_reconfirmed ON public.builds;
CREATE TRIGGER trg_rc_xp_build_reconfirmed
AFTER UPDATE OF last_confirmed_at ON public.builds
FOR EACH ROW EXECUTE FUNCTION public.rc_xp_build_reconfirmed();


-- c3. build_reproductions: run_reported and build_reproduced
-- One row per person per build, written by an upsert, so the row is inserted
-- and later updated as the person re-runs it or changes what they said. Both
-- grants are tried on every write and the once-per index lets the first one in.
CREATE OR REPLACE FUNCTION public.rc_xp_reproduction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator uuid;
BEGIN
  SELECT b.creator_id INTO _creator
    FROM public.builds b
   WHERE b.id = NEW.build_id;

  -- A run of your own build earns nothing.
  IF _creator IS NULL OR _creator = NEW.user_id THEN
    RETURN NULL;
  END IF;

  -- The runner reported a result on someone else's build: 5, once per build.
  PERFORM public.rc_grant_xp(NEW.user_id, 5, 'run_reported', 'build', NEW.build_id);

  -- And it worked: 25 to the creator, once per (build, runner).
  IF NEW.worked THEN
    PERFORM public.rc_grant_xp(
      _creator, 25, 'build_reproduced', 'build',
      md5(NEW.build_id::text || NEW.user_id::text)::uuid
    );
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_xp_reproduction ON public.build_reproductions;
CREATE TRIGGER trg_rc_xp_reproduction
AFTER INSERT OR UPDATE ON public.build_reproductions
FOR EACH ROW EXECUTE FUNCTION public.rc_xp_reproduction();


-- c4. solution_acceptance_log: solution_accepted
-- 50 plus 1 for each whole £ of the bounty's reward, at most 150, to the solver.
CREATE OR REPLACE FUNCTION public.rc_xp_solution_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _reward numeric;
BEGIN
  -- Accepting your own solution earns nothing.
  IF NEW.solver_id IS NOT DISTINCT FROM NEW.bounty_author_id THEN
    RETURN NULL;
  END IF;

  SELECT bo.reward_gbp INTO _reward
    FROM public.bounties bo
   WHERE bo.id = NEW.bounty_id;

  PERFORM public.rc_grant_xp(
    NEW.solver_id,
    LEAST(150, 50 + GREATEST(0, floor(COALESCE(_reward, 0))))::int,
    'solution_accepted', 'solution', NEW.solution_id
  );

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_xp_solution_accepted ON public.solution_acceptance_log;
CREATE TRIGGER trg_rc_xp_solution_accepted
AFTER INSERT ON public.solution_acceptance_log
FOR EACH ROW EXECUTE FUNCTION public.rc_xp_solution_accepted();


-- =============================================================================
-- d. Nobody calls the trigger functions
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.rc_xp_build_visible()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rc_xp_build_reconfirmed()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rc_xp_reproduction()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rc_xp_solution_accepted()   FROM PUBLIC, anon, authenticated;


-- =============================================================================
-- e. Read it all back
-- =============================================================================
DO $$
DECLARE
  _fn   text;
  _role text;
BEGIN
  FOREACH _fn IN ARRAY ARRAY[
    'public.rc_grant_xp(uuid, integer, text, text, uuid)',
    'public.rc_xp_build_visible()',
    'public.rc_xp_build_reconfirmed()',
    'public.rc_xp_reproduction()',
    'public.rc_xp_solution_accepted()'
  ] LOOP
    FOREACH _role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF has_function_privilege(_role::name, _fn::regprocedure, 'EXECUTE') THEN
        RAISE EXCEPTION 'RC-P25: % can execute %', _role, _fn;
      END IF;
    END LOOP;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
     WHERE c.relname = 'uq_xp_events_once_per_source'
       AND i.indrelid = 'public.xp_events'::regclass
       AND i.indisunique
       AND i.indisvalid
  ) THEN
    RAISE EXCEPTION 'RC-P25: the once-per index on xp_events is missing or not valid';
  END IF;

  IF (
    SELECT count(*)
      FROM pg_trigger tg
     WHERE NOT tg.tgisinternal
       AND tg.tgenabled <> 'D'
       AND tg.tgname IN ('trg_rc_xp_build_visible', 'trg_rc_xp_build_reconfirmed',
                         'trg_rc_xp_reproduction', 'trg_rc_xp_solution_accepted')
  ) <> 4 THEN
    RAISE EXCEPTION 'RC-P25: the four XP triggers are not all in place and enabled';
  END IF;

  RAISE NOTICE 'RC-P25: rc_grant_xp and its four triggers are in place; none is executable by anon or authenticated';
END
$$;
