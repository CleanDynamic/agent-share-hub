-- =============================================================================
-- RC-P26 — The badge and challenge catalogue, on builds
-- =============================================================================
-- docs/reconciliation/XP-DESIGN.md is the specification: ten badges in three
-- tiers, and three weekly challenges. Badges are awarded by the database, as the
-- side effect of the same events that earn XP, and by nothing else.
--
-- THE TABLES THE PROMPT NAMED ARE NOT LIVE, SO THIS FILE CREATES THEM. RC-P26
-- was written against a `badges` table and a `challenges` table, as
-- 20260612120000_gamification_schema.sql defines them. That file was never
-- applied: src/integrations/supabase/types.ts, generated from the live schema,
-- has neither table; it has user_badges in the badge_key shape of
-- 20260629163904 (no badge_id, no tier), and it keeps challenges per person in
-- daily_challenges. So the catalogue lives in two new, publicly readable tables,
-- badges and challenges, and user_badges keeps the shape it has. Section 0
-- refuses to run, changing nothing, if user_badges is not that shape or if a
-- table of either name already exists in a different one.
--
--   ten badges (tier as XP-DESIGN.md writes it: common, rare, highest)
--   first-build  Hammer      common   publish a build
--   runner       Play        common   run 10 other people's builds and report back
--   solver       Puzzle      common   one accepted solution
--   proven       BadgeCheck  rare     a build of yours is run successfully by 3 other people
--   rebuilt      GitFork     rare     someone publishes a rebuild of your work
--   keeper       RefreshCw   rare     re-confirm a stale build of yours
--   founder      Flag        rare     held an account before the reset
--   well-proven  ShieldCheck highest  a build of yours is run successfully by 10 other people
--   family       Network     highest  a build of yours has 5 published rebuilds
--   fixer        Wrench      highest  five accepted solutions
--
-- WHAT RUNS, IN THIS ORDER. The badges outside the ten are copied to
-- rc_backup.user_badges_pre_rc_p26 and then deleted from user_badges and badges;
-- the ten are inserted or updated; every profile that exists now is given
-- founder; the writer and four AFTER triggers are created; every challenge is
-- deactivated and the three weekly ones are inserted as active.
--
-- ONE WRITER. rc_award_badge(recipient, badge_slug) reads the badge from the
-- catalogue and inserts the user_badges row ON CONFLICT (user_id, badge_key) DO
-- NOTHING, so a badge is held once and an award that repeats writes nothing. It
-- takes the row's title and description from the catalogue because the toast
-- that greets a new badge (GamificationToasts) prints them from the row. It is
-- SECURITY DEFINER and executable by no client role, and so are the four trigger
-- functions: a trigger runs as the reader who caused it, and fires without
-- EXECUTE ⟦supabase-postgres-best-practices › references/security-privileges.md⟧.
--
--   badge        earner                  condition, checked when the event happens     trigger hangs on
--   first-build  the creator             the build becomes visible                     builds (INSERT, status)
--   rebuilt      the parent's creator    someone else's rebuild becomes visible        builds (INSERT, status)
--   family       the parent's creator    5 visible rebuilds by other people            builds (INSERT, status)
--   keeper       the creator             re-confirms their own build after it went     builds (last_confirmed_at)
--                                        stale (the stale test of rc_xp_build_reconfirmed)
--   runner       the runner              reports on 10 other people's builds           build_reproductions
--   proven       the creator             3 other people got one build working          build_reproductions
--   well-proven  the creator             10 other people got one build working         build_reproductions
--   solver       the solver              1 accepted solution                           solution_acceptance_log
--   fixer        the solver              5 accepted solutions                          solution_acceptance_log
--   founder      every profile now       backfilled below; nothing awards it after     (no trigger)
--
-- SELF-ACTIONS EARN NOTHING, as in XP-DESIGN.md, except the two it names: a run
-- of your own build, a rebuild by the parent's own creator and a solution its own
-- poster accepted count toward no badge, and family counts rebuilds by other
-- people only. Publishing (first-build) and a creator re-confirming their own
-- stale build (keeper) are the two self-actions. For keeper the trigger asks who
-- is signed in, (select auth.uid()), because a stranger's successful run also
-- refreshes last_confirmed_at: the XP trigger pays the creator for that, and the
-- badge does not make them a Keeper for it.
--
-- A COUNT THAT CROSSES ITS LINE IS NOT MISSED. Runner, proven, well-proven,
-- family, solver and fixer count rows, and two writes that commit together can
-- each count one short. Each trigger takes an advisory lock on the thing it
-- counts (the runner, the build, the parent, the solver) before it counts, so the
-- second counts after the first has committed ⟦references/lock-advisory.md⟧.
--
-- NOT BACKFILLED. Only founder is awarded for what happened before this file: XP
-- was reset, and so were the other nine. A creator who already has published
-- builds earns first-build on their next publication.
--
-- STALE. The window here is a third copy of STALE_AFTER_DAYS in
-- src/lib/build/signals.ts (the first is rc_xp_build_reconfirmed, the second is
-- that constant). badgeCatalogue.test.ts reads this file and signals.ts and
-- fails if the two numbers differ.
--
-- CHALLENGES. XP-DESIGN.md lists the sources of XP and completing a challenge is
-- not one, so the table has no xp_reward column: nothing here can pay XP. "Active"
-- is is_active; every challenge is set inactive first, and the three weekly ones
-- are inserted or updated as active, so the active count after this file is 3.
-- The live daily_challenges rows of every person are ended (expires_at is set to
-- now) and kept; nothing on the client can insert a new one (no INSERT policy).
--
-- NOT TOUCHED: the policies and privileges of user_badges (its owner can still
-- UPDATE a row of their own; see the RC-P26 diary entry), creator_marks, the
-- XP triggers of 20261001240000, and claim_challenge.
-- =============================================================================


-- =============================================================================
-- 0. Stop, changing nothing, unless the live shapes are the ones this file knows
-- =============================================================================
DO $$
DECLARE
  _missing  text;
  _mismatch text;
BEGIN
  -- The columns the backfill, the writer and the four triggers read and write.
  SELECT string_agg(need, ', ' ORDER BY need) INTO _missing
    FROM unnest(ARRAY[
      'profiles.id',
      'builds.id', 'builds.creator_id', 'builds.status', 'builds.parent_build_id',
      'builds.last_confirmed_at', 'builds.published_at',
      'build_reproductions.build_id', 'build_reproductions.user_id', 'build_reproductions.worked',
      'solution_acceptance_log.solver_id', 'solution_acceptance_log.bounty_author_id',
      'solution_acceptance_log.solution_id',
      'user_badges.user_id', 'user_badges.badge_key', 'user_badges.state', 'user_badges.title',
      'user_badges.description', 'user_badges.metadata', 'user_badges.earned_at',
      'daily_challenges.expires_at'
    ]) AS need
   WHERE NOT EXISTS (
     SELECT 1
       FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name   = split_part(need, '.', 1)
        AND c.column_name  = split_part(need, '.', 2)
   );

  IF _missing IS NOT NULL THEN
    RAISE EXCEPTION 'RC-P26: not found in public: %. This file is written for the live shapes in src/integrations/supabase/types.ts, with user_badges keyed by badge_key; nothing was changed. Send the live column list of the tables named', _missing;
  END IF;

  -- ON CONFLICT (user_id, badge_key) needs a plain unique index on exactly that pair.
  IF NOT EXISTS (
    SELECT 1
      FROM pg_index i
     WHERE i.indrelid = 'public.user_badges'::regclass
       AND i.indisunique
       AND i.indisvalid
       AND i.indpred IS NULL
       AND i.indexprs IS NULL
       AND i.indnatts = 2
       AND (
         SELECT string_agg(a.attname::text, ',' ORDER BY k.ord)
           FROM unnest(i.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ord)
           JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
       ) = 'user_id,badge_key'
  ) THEN
    RAISE EXCEPTION 'RC-P26: public.user_badges has no plain unique index on (user_id, badge_key), which every award needs; nothing was changed';
  END IF;

  -- A table that already carries one of the two catalogue names must be the shape written below.
  SELECT string_agg(format('%s.%s is %s, expected %s', t.tbl, t.col, COALESCE(c.data_type, 'missing'), t.typ), '; ' ORDER BY t.tbl, t.col)
    INTO _mismatch
    FROM (VALUES
      ('badges', 'slug', 'text'), ('badges', 'name', 'text'), ('badges', 'description', 'text'),
      ('badges', 'tier', 'text'), ('badges', 'icon_name', 'text'), ('badges', 'sort_order', 'smallint'),
      ('badges', 'is_active', 'boolean'),
      ('challenges', 'slug', 'text'), ('challenges', 'cadence', 'text'), ('challenges', 'title', 'text'),
      ('challenges', 'criteria', 'jsonb'), ('challenges', 'sort_order', 'smallint'),
      ('challenges', 'is_active', 'boolean')
    ) AS t(tbl, col, typ)
    LEFT JOIN information_schema.columns c
      ON c.table_schema = 'public' AND c.table_name = t.tbl AND c.column_name = t.col
   WHERE to_regclass('public.' || t.tbl) IS NOT NULL
     AND c.data_type IS DISTINCT FROM t.typ;

  IF _mismatch IS NOT NULL THEN
    RAISE EXCEPTION 'RC-P26: a catalogue table already exists in another shape (%); nothing was changed. Send its live column list; the file is not edited to get past this', _mismatch;
  END IF;

  -- The badges this file removes are kept first, and the schema that keeps them comes from item 3.
  IF to_regnamespace('rc_backup') IS NULL THEN
    RAISE EXCEPTION 'RC-P26: the schema rc_backup does not exist, so the badges this file removes cannot be kept first; nothing was changed. Apply the legacy backup (Deploy queue item 3), then this file';
  END IF;
END
$$;


-- =============================================================================
-- a. The two catalogues (publicly readable; nobody on the client writes them)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.badges (
  slug        text        PRIMARY KEY,
  name        text        NOT NULL,
  description text        NOT NULL,
  tier        text        NOT NULL CONSTRAINT badges_tier_check CHECK (tier IN ('common', 'rare', 'highest')),
  icon_name   text        NOT NULL,
  sort_order  smallint    NOT NULL,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.badges IS
  'RC-P26. The complete badge catalogue of docs/reconciliation/XP-DESIGN.md: ten rows, the tier written as common, rare or highest. user_badges.badge_key names a slug. Written by migrations only.';

CREATE TABLE IF NOT EXISTS public.challenges (
  slug       text        PRIMARY KEY,
  cadence    text        NOT NULL DEFAULT 'weekly' CONSTRAINT challenges_cadence_check CHECK (cadence = 'weekly'),
  title      text        NOT NULL,
  criteria   jsonb       NOT NULL,
  sort_order smallint    NOT NULL,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.challenges IS
  'RC-P26. The weekly challenges of docs/reconciliation/XP-DESIGN.md, at most three active. No xp_reward: completing a challenge is not a source of XP. Written by migrations only.';

ALTER TABLE public.badges     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Badges are readable by everyone" ON public.badges;
CREATE POLICY "Badges are readable by everyone"
  ON public.badges FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Challenges are readable by everyone" ON public.challenges;
CREATE POLICY "Challenges are readable by everyone"
  ON public.challenges FOR SELECT TO anon, authenticated
  USING (true);

-- Read only, to everyone. Supabase's default privileges would otherwise hand
-- anon and authenticated every verb on a new table.
REVOKE ALL ON public.badges     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.challenges FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.badges     TO anon, authenticated;
GRANT SELECT ON public.challenges TO anon, authenticated;
GRANT ALL ON public.badges     TO service_role;
GRANT ALL ON public.challenges TO service_role;


-- =============================================================================
-- b. Every badge that is not one of the ten goes: kept in rc_backup, then deleted
-- =============================================================================
DO $$
DECLARE
  _keep      constant text[] := ARRAY[
    'first-build', 'runner', 'solver', 'proven', 'rebuilt',
    'keeper', 'founder', 'well-proven', 'family', 'fixer'
  ];
  _kept      bigint;
  _removed   bigint;
  _catalogue bigint;
BEGIN
  CREATE TABLE IF NOT EXISTS rc_backup.user_badges_pre_rc_p26 AS
    SELECT * FROM public.user_badges WHERE false;
  REVOKE ALL ON rc_backup.user_badges_pre_rc_p26 FROM PUBLIC, anon, authenticated;

  INSERT INTO rc_backup.user_badges_pre_rc_p26
    SELECT ub.* FROM public.user_badges ub WHERE ub.badge_key <> ALL (_keep);
  GET DIAGNOSTICS _kept = ROW_COUNT;

  DELETE FROM public.user_badges ub WHERE ub.badge_key <> ALL (_keep);
  GET DIAGNOSTICS _removed = ROW_COUNT;

  DELETE FROM public.badges b WHERE b.slug <> ALL (_keep);
  GET DIAGNOSTICS _catalogue = ROW_COUNT;

  RAISE NOTICE 'RC-P26: % user badge row(s) kept in rc_backup.user_badges_pre_rc_p26 and % deleted; % catalogue row(s) outside the ten deleted', _kept, _removed, _catalogue;
END
$$;


-- =============================================================================
-- c. The ten, exactly as XP-DESIGN.md writes them
-- =============================================================================
INSERT INTO public.badges (slug, name, description, tier, icon_name, sort_order, is_active) VALUES
  ('first-build', 'First build',  'publish a build',                                          'common',  'Hammer',      1, true),
  ('runner',      'Runner',       'run 10 other people''s builds and report back',            'common',  'Play',        2, true),
  ('solver',      'Solver',       'one accepted solution',                                    'common',  'Puzzle',      3, true),
  ('proven',      'Proven',       'a build of yours is run successfully by 3 other people',   'rare',    'BadgeCheck',  4, true),
  ('rebuilt',     'Rebuilt',      'someone publishes a rebuild of your work',                 'rare',    'GitFork',     5, true),
  ('keeper',      'Keeper',       're-confirm a stale build of yours',                        'rare',    'RefreshCw',   6, true),
  ('founder',     'Founder',      'held an account before the reset',                         'rare',    'Flag',        7, true),
  ('well-proven', 'Well proven',  'a build of yours is run successfully by 10 other people',  'highest', 'ShieldCheck', 8, true),
  ('family',      'Family',       'a build of yours has 5 published rebuilds',                'highest', 'Network',     9, true),
  ('fixer',       'Fixer',        'five accepted solutions',                                  'highest', 'Wrench',     10, true)
ON CONFLICT (slug) DO UPDATE
   SET name        = EXCLUDED.name,
       description = EXCLUDED.description,
       tier        = EXCLUDED.tier,
       icon_name   = EXCLUDED.icon_name,
       sort_order  = EXCLUDED.sort_order,
       is_active   = EXCLUDED.is_active;

-- A row already held for one of the ten takes the catalogue's words: the old
-- founder row says "the first 100 members of NeoScale", and the toast and the
-- reveal read title and description from the row.
UPDATE public.user_badges ub
   SET title       = b.name,
       description = b.description,
       metadata    = ub.metadata || jsonb_build_object('tier', b.tier)
  FROM public.badges b
 WHERE b.slug = ub.badge_key
   AND (ub.title IS DISTINCT FROM b.name
        OR ub.description IS DISTINCT FROM b.description
        OR ub.metadata->>'tier' IS DISTINCT FROM b.tier);


-- =============================================================================
-- d. Founder: every profile that exists before this file
-- =============================================================================
-- profiles.id references auth.users, which user_badges.user_id does too, so
-- every profile can hold a row. ON CONFLICT leaves the old founder rows as the
-- update above made them.
INSERT INTO public.user_badges (user_id, badge_key, state, title, description, metadata)
SELECT p.id, b.slug, 'earned', b.name, b.description, jsonb_build_object('tier', b.tier)
  FROM public.profiles p
 CROSS JOIN public.badges b
 WHERE b.slug = 'founder'
ON CONFLICT (user_id, badge_key) DO NOTHING;


-- =============================================================================
-- e. The one writer, and the four triggers that call it
-- =============================================================================
-- Parameters share names with user_badges columns, so every reference below is
-- qualified: a parameter as rc_award_badge.<name>, a column through its alias.
CREATE OR REPLACE FUNCTION public.rc_award_badge(recipient uuid, badge_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF rc_award_badge.recipient IS NULL OR rc_award_badge.badge_slug IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_badges (user_id, badge_key, state, title, description, metadata)
  SELECT rc_award_badge.recipient, b.slug, 'earned', b.name, b.description,
         jsonb_build_object('tier', b.tier)
    FROM public.badges b
   WHERE b.slug = rc_award_badge.badge_slug
     AND b.is_active
  ON CONFLICT (user_id, badge_key) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.rc_award_badge(uuid, text) IS
  'RC-P26. The one writer of badges, called by triggers only. Writes nothing for a missing recipient or a slug that is not an active badge in the catalogue, and holds a badge once: ON CONFLICT (user_id, badge_key) DO NOTHING. Title and description are copied from the catalogue.';

REVOKE EXECUTE ON FUNCTION public.rc_award_badge(uuid, text) FROM PUBLIC, anon, authenticated;


-- e1. builds: first-build, rebuilt, family
-- Fires when a build BECOMES visible (published or gallery): inserted visible,
-- or updated from draft. The same test as rc_xp_build_visible. A build that is
-- visible already and changes again earns nothing; one that goes back to draft
-- and out again is caught by the once-per-badge key, not by this test.
CREATE OR REPLACE FUNCTION public.rc_badge_build_visible()
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

  -- Publishing a build: first-build, to the creator.
  PERFORM public.rc_award_badge(NEW.creator_id, 'first-build');

  -- A rebuild: rebuilt to the parent's creator, unless they rebuilt their own.
  IF NEW.parent_build_id IS NOT NULL THEN
    SELECT b.creator_id INTO _parent_creator
      FROM public.builds b
     WHERE b.id = NEW.parent_build_id;

    IF _parent_creator IS NOT NULL AND _parent_creator IS DISTINCT FROM NEW.creator_id THEN
      PERFORM public.rc_award_badge(_parent_creator, 'rebuilt');

      -- Five visible rebuilds by other people: family. Counted under a lock on the parent.
      PERFORM pg_advisory_xact_lock(hashtextextended('family:' || NEW.parent_build_id::text, 0));

      IF (
        SELECT count(*)
          FROM public.builds r
         WHERE r.parent_build_id = NEW.parent_build_id
           AND r.status IN ('published', 'gallery')
           AND r.creator_id <> _parent_creator
      ) >= 5 THEN
        PERFORM public.rc_award_badge(_parent_creator, 'family');
      END IF;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_badge_build_visible ON public.builds;
CREATE TRIGGER trg_rc_badge_build_visible
AFTER INSERT OR UPDATE OF status ON public.builds
FOR EACH ROW EXECUTE FUNCTION public.rc_badge_build_visible();


-- e2. builds: keeper
-- UPDATE OF fires whenever the column is named in the SET list, changed or not,
-- and refresh_build_reproduction_signals names it on every reproduction and can
-- move it back or to NULL, so the old and new values are compared here, exactly
-- as rc_xp_build_reconfirmed compares them. The signed-in person must be the
-- creator: a run by somebody else refreshes the build through the same column.
CREATE OR REPLACE FUNCTION public.rc_badge_build_reconfirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- STALE_AFTER_DAYS in src/lib/build/signals.ts is 120: a build is stale past
  -- this many whole days.
  stale_days constant integer := 120;
  _since     timestamptz;
BEGIN
  IF NEW.last_confirmed_at IS NULL THEN
    RETURN NULL;
  END IF;

  IF (SELECT auth.uid()) IS DISTINCT FROM NEW.creator_id THEN
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

  PERFORM public.rc_award_badge(NEW.creator_id, 'keeper');

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_badge_build_reconfirmed ON public.builds;
CREATE TRIGGER trg_rc_badge_build_reconfirmed
AFTER UPDATE OF last_confirmed_at ON public.builds
FOR EACH ROW EXECUTE FUNCTION public.rc_badge_build_reconfirmed();


-- e3. build_reproductions: runner, proven, well-proven
-- One row per person per build (a unique index on build_id, user_id), written
-- by an upsert, so the row is inserted and later updated as the person re-runs
-- it or changes what they said. Both checks run on every write; the badge key
-- lets the first one in.
CREATE OR REPLACE FUNCTION public.rc_badge_reproduction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _creator uuid;
  _worked  bigint;
BEGIN
  SELECT b.creator_id INTO _creator
    FROM public.builds b
   WHERE b.id = NEW.build_id;

  -- A run of your own build earns nothing.
  IF _creator IS NULL OR _creator = NEW.user_id THEN
    RETURN NULL;
  END IF;

  -- The runner has reported on ten other people's builds: runner.
  PERFORM pg_advisory_xact_lock(hashtextextended('runner:' || NEW.user_id::text, 0));

  IF (
    SELECT count(*)
      FROM public.build_reproductions r
      JOIN public.builds rb ON rb.id = r.build_id
     WHERE r.user_id = NEW.user_id
       AND rb.creator_id <> r.user_id
  ) >= 10 THEN
    PERFORM public.rc_award_badge(NEW.user_id, 'runner');
  END IF;

  -- And it worked: other people have got this build working, 3 and 10.
  IF NEW.worked THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('proven:' || NEW.build_id::text, 0));

    SELECT count(*) INTO _worked
      FROM public.build_reproductions r
     WHERE r.build_id = NEW.build_id
       AND r.worked
       AND r.user_id <> _creator;

    IF _worked >= 3 THEN
      PERFORM public.rc_award_badge(_creator, 'proven');
    END IF;
    IF _worked >= 10 THEN
      PERFORM public.rc_award_badge(_creator, 'well-proven');
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_badge_reproduction ON public.build_reproductions;
CREATE TRIGGER trg_rc_badge_reproduction
AFTER INSERT OR UPDATE ON public.build_reproductions
FOR EACH ROW EXECUTE FUNCTION public.rc_badge_reproduction();


-- e4. solution_acceptance_log: solver, fixer
-- Hangs where rc_xp_solution_accepted hangs, and for the same reason: only
-- accept_bounty_solution writes this table, and solutions.status is writable by
-- the solver. One solution can fill more than one slot, so solutions are counted,
-- not rows.
CREATE OR REPLACE FUNCTION public.rc_badge_solution_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _accepted bigint;
BEGIN
  -- Accepting your own solution earns nothing.
  IF NEW.solver_id IS NOT DISTINCT FROM NEW.bounty_author_id THEN
    RETURN NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('solver:' || NEW.solver_id::text, 0));

  SELECT count(DISTINCT l.solution_id) INTO _accepted
    FROM public.solution_acceptance_log l
   WHERE l.solver_id = NEW.solver_id
     AND l.solver_id <> l.bounty_author_id;

  IF _accepted >= 1 THEN
    PERFORM public.rc_award_badge(NEW.solver_id, 'solver');
  END IF;
  IF _accepted >= 5 THEN
    PERFORM public.rc_award_badge(NEW.solver_id, 'fixer');
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_rc_badge_solution_accepted ON public.solution_acceptance_log;
CREATE TRIGGER trg_rc_badge_solution_accepted
AFTER INSERT ON public.solution_acceptance_log
FOR EACH ROW EXECUTE FUNCTION public.rc_badge_solution_accepted();


-- Nobody calls the trigger functions
REVOKE EXECUTE ON FUNCTION public.rc_badge_build_visible()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rc_badge_build_reconfirmed()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rc_badge_reproduction()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rc_badge_solution_accepted()  FROM PUBLIC, anon, authenticated;


-- =============================================================================
-- f. Challenges: every one deactivated, the three weekly ones active
-- =============================================================================
UPDATE public.challenges SET is_active = false WHERE is_active;

INSERT INTO public.challenges (slug, cadence, title, criteria, sort_order, is_active) VALUES
  ('run-three-new',   'weekly', 'Run three builds you haven''t run before',
     '{"event": "run_reported", "count": 3, "distinct": "build", "window": "week"}', 1, true),
  ('solve-a-gap',     'weekly', 'Solve a gap',
     '{"event": "solution_accepted", "count": 1, "window": "week"}', 2, true),
  ('reconfirm-stale', 'weekly', 'Re-confirm one of your stale builds',
     '{"event": "build_reconfirmed", "count": 1, "window": "week"}', 3, true)
ON CONFLICT (slug) DO UPDATE
   SET cadence    = EXCLUDED.cadence,
       title      = EXCLUDED.title,
       criteria   = EXCLUDED.criteria,
       sort_order = EXCLUDED.sort_order,
       is_active  = EXCLUDED.is_active;

-- The challenges people already hold are the daily ones of the old product:
-- ended now and kept. A row never becomes active again; nothing on the client
-- can insert one.
UPDATE public.daily_challenges SET expires_at = now() WHERE expires_at > now();


-- =============================================================================
-- g. Read it all back
-- =============================================================================
DO $$
DECLARE
  _keep constant text[] := ARRAY[
    'first-build', 'runner', 'solver', 'proven', 'rebuilt',
    'keeper', 'founder', 'well-proven', 'family', 'fixer'
  ];
  _fn   text;
  _role text;
BEGIN
  IF (SELECT array_agg(b.slug ORDER BY b.slug) FROM public.badges b WHERE b.is_active)
     IS DISTINCT FROM (SELECT array_agg(k ORDER BY k) FROM unnest(_keep) AS k)
     OR (SELECT count(*) FROM public.badges) <> 10 THEN
    RAISE EXCEPTION 'RC-P26: the catalogue is not the ten badges of XP-DESIGN.md, all active';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_badges ub WHERE ub.badge_key <> ALL (_keep)) THEN
    RAISE EXCEPTION 'RC-P26: a user_badges row is left that is not one of the ten';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.profiles p
     WHERE NOT EXISTS (
       SELECT 1 FROM public.user_badges ub WHERE ub.user_id = p.id AND ub.badge_key = 'founder'
     )
  ) THEN
    RAISE EXCEPTION 'RC-P26: a profile that exists holds no founder badge';
  END IF;

  IF (SELECT count(*) FROM public.challenges WHERE is_active) <> 3 THEN
    RAISE EXCEPTION 'RC-P26: the active challenges are not three';
  END IF;

  IF EXISTS (SELECT 1 FROM public.daily_challenges dc WHERE dc.expires_at > now()) THEN
    RAISE EXCEPTION 'RC-P26: a daily challenge is still running';
  END IF;

  FOREACH _fn IN ARRAY ARRAY[
    'public.rc_award_badge(uuid, text)',
    'public.rc_badge_build_visible()',
    'public.rc_badge_build_reconfirmed()',
    'public.rc_badge_reproduction()',
    'public.rc_badge_solution_accepted()'
  ] LOOP
    FOREACH _role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF has_function_privilege(_role::name, _fn::regprocedure, 'EXECUTE') THEN
        RAISE EXCEPTION 'RC-P26: % can execute %', _role, _fn;
      END IF;
    END LOOP;
  END LOOP;

  IF (
    SELECT count(*)
      FROM pg_trigger tg
     WHERE NOT tg.tgisinternal
       AND tg.tgenabled <> 'D'
       AND tg.tgname IN ('trg_rc_badge_build_visible', 'trg_rc_badge_build_reconfirmed',
                         'trg_rc_badge_reproduction', 'trg_rc_badge_solution_accepted')
  ) <> 4 THEN
    RAISE EXCEPTION 'RC-P26: the four badge triggers are not all in place and enabled';
  END IF;

  RAISE NOTICE 'RC-P26: ten badges and three active challenges are in place; rc_award_badge and its four triggers are not executable by anon or authenticated';
END
$$;
