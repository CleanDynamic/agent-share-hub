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

CREATE UNIQUE INDEX IF NOT EXISTS uq_xp_events_once_per_source
  ON public.xp_events (user_id, reason, source_type, source_id)
  WHERE source_id IS NOT NULL;

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

  PERFORM public.rc_grant_xp(NEW.creator_id, 10, 'build_published', 'build', NEW.id);

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

  _since := COALESCE(OLD.last_confirmed_at, OLD.published_at);
  IF _since IS NULL
     OR floor(extract(epoch FROM (now() - _since)) / 86400) <= stale_days THEN
    RETURN NULL;
  END IF;

  IF floor(extract(epoch FROM (now() - NEW.last_confirmed_at)) / 86400) > stale_days THEN
    RETURN NULL;
  END IF;

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

  IF _creator IS NULL OR _creator = NEW.user_id THEN
    RETURN NULL;
  END IF;

  PERFORM public.rc_grant_xp(NEW.user_id, 5, 'run_reported', 'build', NEW.build_id);

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

CREATE OR REPLACE FUNCTION public.rc_xp_solution_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _reward numeric;
BEGIN
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

REVOKE EXECUTE ON FUNCTION public.rc_xp_build_visible()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rc_xp_build_reconfirmed()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rc_xp_reproduction()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rc_xp_solution_accepted()   FROM PUBLIC, anon, authenticated;

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