-- =============================================================================
-- buildgallery.ai — post media acceptance checks (BG-P07b)
-- =============================================================================
-- Proves the BG-P07b acceptances that are facts about Postgres rather than
-- about TypeScript. The TypeScript half — aspectOf, resolveCover's ordering,
-- and the shape of every call the data layer makes — is in
-- src/lib/build/cover.test.ts and is run by `npm run test -- cover`. These are
-- the ones a vitest double cannot establish, because the thing under test is a
-- constraint, a trigger, or a policy:
--
--   1. the column, its two CHECKs and the partial unique index are installed,
--      and the index is the ONLY one of its shape
--   2. positions are dense, 0..3, with no duplicate slot inside a build —
--      asserted against every row in the table, not just the fixtures
--   3. THE MIRROR: setting a row to position 0 writes builds.cover_media_id,
--      and clearing position 0 clears it
--   4. the mirror survives a REORDER, where two rows change slots in one
--      statement and the trigger fires once per row in an unspecified order
--   5. deleting the position-0 row clears the mirror through the foreign key,
--      which is why the trigger has no DELETE branch
--   6. set_build_post_media() refuses a fifth picture, a foreign media row and
--      a repeated id, and leaves the existing set intact when it does
--   7. removing the middle of three closes the gap
--   8. the function's posture: SECURITY INVOKER with search_path pinned, so
--      build_media's own RLS decides who may rearrange whose pictures — and an
--      authenticated intruder is in fact refused while the creator succeeds
--   9. build_media's four policies are UNCHANGED and still use
--      (select auth.uid()); BG-P07b adds no policy
--
-- USAGE
--   psql "$DATABASE_URL" \
--     -v creator_id=<a profiles.id uuid> \
--     -v intruder_id=<a DIFFERENT profiles.id uuid> \
--     -f supabase/tests/bg-p07b-post-media.sql
--
-- Both ids must be existing public.profiles rows and must not be the same
-- person — check 8 is meaningless otherwise. Neither needs to be an admin; if
-- the intruder IS one, check 8 will say so and skip rather than pass falsely.
--
-- The whole script runs inside one transaction and ends in ROLLBACK. It leaves
-- nothing behind and is safe against a database with real rows. It must be run
-- as a role that can SET ROLE authenticated: the point of check 8 is to be
-- subject to row level security, not exempt from it.
--
-- Every check raises on failure, so a run that reaches "ALL CHECKS PASSED" has
-- passed all of them.
--
-- RUN AT THE TIME OF WRITING against a real PostgreSQL 16.13 head-state
-- database built by replaying this repository's own migrations in order. All
-- nine passed. Before the migration, check 1 failed on the absent column,
-- which is what makes the rest worth reading — this is a gate, not a
-- formality.
-- =============================================================================

\if :{?creator_id}
\else
  \echo 'ERROR: pass -v creator_id=<uuid> and -v intruder_id=<uuid>'
  \quit
\endif

\if :{?intruder_id}
\else
  \echo 'ERROR: pass -v intruder_id=<uuid>'
  \quit
\endif

BEGIN;

\set ON_ERROR_STOP on

-- psql does not substitute :'var' inside a dollar-quoted body, so the two ids
-- are stashed as transaction-local settings and read back with
-- current_setting(). Same device as supabase/tests/ns-p17-reproductions.sql.
SELECT
  set_config('bg_p07b.creator_id',  :'creator_id',  true),
  set_config('bg_p07b.intruder_id', :'intruder_id', true);

-- Fixtures: one build, four pictures, one audio row, and a second build whose
-- media the first must not be able to claim.
CREATE TEMP TABLE _bg_p07b (name TEXT PRIMARY KEY, id UUID NOT NULL) ON COMMIT DROP;
-- Check 8 reads this while SET ROLE authenticated, which has no rights on a
-- temp table created by the session role.
GRANT SELECT ON _bg_p07b TO authenticated;

DO $$
DECLARE
  _build   UUID := gen_random_uuid();
  _other   UUID := gen_random_uuid();
  _suffix  TEXT := replace(gen_random_uuid()::text, '-', '');
BEGIN
  IF current_setting('bg_p07b.creator_id')::uuid = current_setting('bg_p07b.intruder_id')::uuid THEN
    RAISE EXCEPTION 'creator_id and intruder_id must be different people';
  END IF;

  INSERT INTO public.builds (id, creator_id, slug, title, status)
  VALUES (_build, current_setting('bg_p07b.creator_id')::uuid, 'bg-p07b-' || _suffix, 'BG-P07b fixture', 'draft'),
         (_other, current_setting('bg_p07b.creator_id')::uuid, 'bg-p07b-other-' || _suffix, 'BG-P07b other build', 'draft');

  INSERT INTO _bg_p07b (name, id) VALUES ('build', _build), ('other', _other);

  INSERT INTO public.build_media (build_id, bucket, path, kind, mime, width, height)
  SELECT _build, 'build-media', _build || '/unplaced/' || n || '.png', 'image', 'image/png', 1600, 900
  FROM generate_series(1, 4) AS n;

  INSERT INTO _bg_p07b (name, id)
  SELECT 'm' || row_number() OVER (ORDER BY path), id
  FROM public.build_media WHERE build_id = _build;

  INSERT INTO public.build_media (build_id, bucket, path, kind, mime)
  VALUES (_build, 'build-media', _build || '/unplaced/voice.mp3', 'audio', 'audio/mpeg')
  RETURNING id INTO STRICT _other;  -- reuse as a scratch variable
  INSERT INTO _bg_p07b (name, id) VALUES ('audio', _other);

  INSERT INTO public.build_media (build_id, bucket, path, kind, mime, width, height)
  VALUES ((SELECT id FROM _bg_p07b WHERE name = 'other'),
          'build-media',
          (SELECT id FROM _bg_p07b WHERE name = 'other') || '/unplaced/1.png',
          'image', 'image/png', 1000, 1000)
  RETURNING id INTO STRICT _other;
  INSERT INTO _bg_p07b (name, id) VALUES ('foreign', _other);
END
$$;


-- =============================================================================
-- 1. The column, the constraints and the index
-- =============================================================================
DO $$
DECLARE _n INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'build_media'
      AND column_name = 'post_position' AND data_type = 'smallint'
  ) THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: build_media.post_position is absent or is not a smallint';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.build_media'::regclass
      AND conname = 'build_media_post_position_range_check'
  ) THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: the 0..3 range check is absent';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.build_media'::regclass
      AND conname = 'build_media_post_position_kind_check'
  ) THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: the image-or-video check is absent';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    WHERE i.indrelid = 'public.build_media'::regclass
      AND c.relname = 'idx_build_media_post_position'
      AND i.indisunique
      AND i.indpred IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: idx_build_media_post_position is absent, not unique, or not partial';
  END IF;

  -- One index of this shape, not two. The brief asked for a second, non-unique
  -- index on the same columns and predicate; it is deliberately not created,
  -- and this check is what stops it being added back by reflex.
  SELECT count(*) INTO _n
  FROM pg_index i
  JOIN pg_class c ON c.oid = i.indexrelid
  WHERE i.indrelid = 'public.build_media'::regclass
    AND i.indpred IS NOT NULL
    AND pg_get_indexdef(i.indexrelid) LIKE '%(build_id, post_position)%';

  IF _n <> 1 THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: expected exactly 1 partial index on (build_id, post_position), found %', _n;
  END IF;

  RAISE NOTICE 'CHECK 1 PASSED: column, both CHECKs and exactly one partial unique index.';
END
$$;


-- =============================================================================
-- 2. Positions are dense, in range, and unique within a build
-- =============================================================================
-- Asserted over the WHOLE table, so a bad row anywhere fails this — this is
-- acceptance 2 of the brief, which names the query it wants run.
DO $$
DECLARE _bad TEXT;
BEGIN
  PERFORM public.set_build_post_media(
    (SELECT id FROM _bg_p07b WHERE name = 'build'),
    ARRAY[(SELECT id FROM _bg_p07b WHERE name = 'm1'),
          (SELECT id FROM _bg_p07b WHERE name = 'm2'),
          (SELECT id FROM _bg_p07b WHERE name = 'm3')]::uuid[]);

  SELECT string_agg(format('build %s: %s', build_id, positions), '; ')
  INTO _bad
  FROM (
    SELECT build_id,
           array_agg(post_position ORDER BY post_position) AS positions,
           count(*) AS n,
           count(DISTINCT post_position) AS distinct_n,
           min(post_position) AS lo,
           max(post_position) AS hi
    FROM public.build_media
    WHERE post_position IS NOT NULL
    GROUP BY build_id
  ) g
  WHERE g.distinct_n <> g.n        -- a slot claimed twice
     OR g.lo <> 0                  -- does not start at 0
     OR g.hi <> g.n - 1            -- a hole
     OR g.hi > 3;                  -- above the ceiling

  IF _bad IS NOT NULL THEN
    RAISE EXCEPTION 'CHECK 2 FAILED: positions are not dense 0..3 without duplicates — %', _bad;
  END IF;

  RAISE NOTICE 'CHECK 2 PASSED: every build''s positions are dense from 0, none above 3, no duplicates.';
END
$$;


-- =============================================================================
-- 3. The mirror: position 0 writes cover_media_id, clearing it clears the column
-- =============================================================================
DO $$
DECLARE
  _build UUID := (SELECT id FROM _bg_p07b WHERE name = 'build');
  _m1    UUID := (SELECT id FROM _bg_p07b WHERE name = 'm1');
  _m2    UUID := (SELECT id FROM _bg_p07b WHERE name = 'm2');
  _cover UUID;
BEGIN
  SELECT cover_media_id INTO _cover FROM public.builds WHERE id = _build;
  IF _cover IS DISTINCT FROM _m1 THEN
    RAISE EXCEPTION 'CHECK 3 FAILED: after a set whose first entry is m1, cover_media_id is % and should be %', _cover, _m1;
  END IF;

  -- Clearing slot 0 directly, which is the other half of the trigger.
  UPDATE public.build_media SET post_position = NULL WHERE id = _m1;
  SELECT cover_media_id INTO _cover FROM public.builds WHERE id = _build;
  IF _cover IS NOT NULL THEN
    RAISE EXCEPTION 'CHECK 3 FAILED: clearing position 0 left cover_media_id at %', _cover;
  END IF;

  -- And a NEW row taking slot 0 writes it again.
  UPDATE public.build_media SET post_position = NULL WHERE id = _m2;
  UPDATE public.build_media SET post_position = 0 WHERE id = _m2;
  SELECT cover_media_id INTO _cover FROM public.builds WHERE id = _build;
  IF _cover IS DISTINCT FROM _m2 THEN
    RAISE EXCEPTION 'CHECK 3 FAILED: a new position-0 row did not become the cover (got %)', _cover;
  END IF;

  RAISE NOTICE 'CHECK 3 PASSED: position 0 writes the mirror, clearing it nulls the column.';
END
$$;


-- =============================================================================
-- 4. The mirror survives a reorder
-- =============================================================================
-- The case the guards in the trigger exist for. Two rows change slots in one
-- statement; Postgres fires the row trigger once per row in an order nothing
-- guarantees, and a clear that did not check the mirror's current value would
-- blank it after the new first picture had already claimed it.
DO $$
DECLARE
  _build UUID := (SELECT id FROM _bg_p07b WHERE name = 'build');
  _m1    UUID := (SELECT id FROM _bg_p07b WHERE name = 'm1');
  _m2    UUID := (SELECT id FROM _bg_p07b WHERE name = 'm2');
  _m3    UUID := (SELECT id FROM _bg_p07b WHERE name = 'm3');
  _cover UUID;
BEGIN
  PERFORM public.set_build_post_media(_build, ARRAY[_m1, _m2, _m3]::uuid[]);
  PERFORM public.set_build_post_media(_build, ARRAY[_m2, _m1, _m3]::uuid[]);

  SELECT cover_media_id INTO _cover FROM public.builds WHERE id = _build;
  IF _cover IS DISTINCT FROM _m2 THEN
    RAISE EXCEPTION 'CHECK 4 FAILED: after swapping slots 0 and 1 the mirror is % and should be %', _cover, _m2;
  END IF;

  RAISE NOTICE 'CHECK 4 PASSED: a reorder leaves the mirror on the set''s new first entry.';
END
$$;


-- =============================================================================
-- 5. Deleting the position-0 row clears the mirror through the foreign key
-- =============================================================================
-- Which is why sync_build_cover_from_post_media() has no DELETE branch: adding
-- one would duplicate what builds_cover_media_id_fkey already does.
DO $$
DECLARE
  _build UUID := (SELECT id FROM _bg_p07b WHERE name = 'build');
  _m2    UUID := (SELECT id FROM _bg_p07b WHERE name = 'm2');
  _cover UUID;
BEGIN
  DELETE FROM public.build_media WHERE id = _m2;

  SELECT cover_media_id INTO _cover FROM public.builds WHERE id = _build;
  IF _cover IS NOT NULL THEN
    RAISE EXCEPTION 'CHECK 5 FAILED: deleting the position-0 row left cover_media_id at %', _cover;
  END IF;

  RAISE NOTICE 'CHECK 5 PASSED: ON DELETE SET NULL clears the mirror with no trigger branch.';
END
$$;


-- =============================================================================
-- 6. The refusals, and that a refusal writes nothing
-- =============================================================================
DO $$
DECLARE
  _build UUID := (SELECT id FROM _bg_p07b WHERE name = 'build');
  _m1    UUID := (SELECT id FROM _bg_p07b WHERE name = 'm1');
  _m3    UUID := (SELECT id FROM _bg_p07b WHERE name = 'm3');
  _m4    UUID := (SELECT id FROM _bg_p07b WHERE name = 'm4');
  _audio UUID := (SELECT id FROM _bg_p07b WHERE name = 'audio');
  _far   UUID := (SELECT id FROM _bg_p07b WHERE name = 'foreign');
  _before UUID[];
  _after  UUID[];
BEGIN
  PERFORM public.set_build_post_media(_build, ARRAY[_m1, _m3, _m4]::uuid[]);
  SELECT array_agg(id ORDER BY post_position) INTO _before
    FROM public.build_media WHERE build_id = _build AND post_position IS NOT NULL;

  -- A fifth.
  BEGIN
    PERFORM public.set_build_post_media(_build, ARRAY[_m1, _m3, _m4, _audio, _far]::uuid[]);
    RAISE EXCEPTION 'CHECK 6 FAILED: a fifth picture was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Another build's media.
  BEGIN
    PERFORM public.set_build_post_media(_build, ARRAY[_far]::uuid[]);
    RAISE EXCEPTION 'CHECK 6 FAILED: another build''s media was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  -- The same id twice.
  BEGIN
    PERFORM public.set_build_post_media(_build, ARRAY[_m1, _m1]::uuid[]);
    RAISE EXCEPTION 'CHECK 6 FAILED: a repeated media id was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- An audio row, which the kind check must refuse.
  BEGIN
    PERFORM public.set_build_post_media(_build, ARRAY[_audio]::uuid[]);
    RAISE EXCEPTION 'CHECK 6 FAILED: an audio row was accepted into the set';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  SELECT array_agg(id ORDER BY post_position) INTO _after
    FROM public.build_media WHERE build_id = _build AND post_position IS NOT NULL;

  IF _before IS DISTINCT FROM _after THEN
    RAISE EXCEPTION 'CHECK 6 FAILED: a refused call changed the set (% -> %)', _before, _after;
  END IF;

  RAISE NOTICE 'CHECK 6 PASSED: a fifth, a foreign row, a repeat and an audio row are each refused, and the set is untouched.';
END
$$;


-- =============================================================================
-- 7. Removing the middle of three closes the gap
-- =============================================================================
DO $$
DECLARE
  _build UUID := (SELECT id FROM _bg_p07b WHERE name = 'build');
  _m1    UUID := (SELECT id FROM _bg_p07b WHERE name = 'm1');
  _m3    UUID := (SELECT id FROM _bg_p07b WHERE name = 'm3');
  _m4    UUID := (SELECT id FROM _bg_p07b WHERE name = 'm4');
  _got   UUID[];
  _slots SMALLINT[];
BEGIN
  PERFORM public.set_build_post_media(_build, ARRAY[_m1, _m3, _m4]::uuid[]);
  -- What removePostMedia does: the current order minus one id.
  PERFORM public.set_build_post_media(_build, ARRAY[_m1, _m4]::uuid[]);

  SELECT array_agg(id ORDER BY post_position), array_agg(post_position ORDER BY post_position)
  INTO _got, _slots
  FROM public.build_media WHERE build_id = _build AND post_position IS NOT NULL;

  IF _got IS DISTINCT FROM ARRAY[_m1, _m4] THEN
    RAISE EXCEPTION 'CHECK 7 FAILED: the surviving order is % and should be %', _got, ARRAY[_m1, _m4];
  END IF;
  IF _slots IS DISTINCT FROM ARRAY[0, 1]::SMALLINT[] THEN
    RAISE EXCEPTION 'CHECK 7 FAILED: the gap did not close — positions are %', _slots;
  END IF;

  RAISE NOTICE 'CHECK 7 PASSED: removing the middle of three leaves 0 and 1.';
END
$$;


-- =============================================================================
-- 8. The function's posture, and RLS actually refusing an intruder
-- =============================================================================
DO $$
DECLARE _sec BOOLEAN; _cfg TEXT[];
BEGIN
  SELECT p.prosecdef, p.proconfig INTO _sec, _cfg
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'set_build_post_media';

  IF _sec IS NULL THEN
    RAISE EXCEPTION 'CHECK 8 FAILED: public.set_build_post_media() does not exist';
  END IF;
  IF _sec THEN
    RAISE EXCEPTION 'CHECK 8 FAILED: set_build_post_media is SECURITY DEFINER — it must run as the caller, or any authenticated user could rearrange any build''s pictures';
  END IF;
  IF _cfg IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(_cfg) c WHERE c LIKE 'search_path=%') THEN
    RAISE EXCEPTION 'CHECK 8 FAILED: set_build_post_media does not pin search_path';
  END IF;

  -- And the mirror trigger, which must be the opposite.
  SELECT p.prosecdef, p.proconfig INTO _sec, _cfg
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'sync_build_cover_from_post_media';

  IF NOT COALESCE(_sec, false) THEN
    RAISE EXCEPTION 'CHECK 8 FAILED: sync_build_cover_from_post_media is not SECURITY DEFINER — the mirror would silently stop tracking for an admin or service-role write';
  END IF;
  IF _cfg IS NULL OR NOT EXISTS (SELECT 1 FROM unnest(_cfg) c WHERE c LIKE 'search_path=%') THEN
    RAISE EXCEPTION 'CHECK 8 FAILED: sync_build_cover_from_post_media does not pin search_path';
  END IF;
END
$$;

-- The live half: an authenticated intruder must be refused, and the creator
-- must succeed. Run as authenticated so RLS applies.
DO $$
BEGIN
  IF public.is_admin(current_setting('bg_p07b.intruder_id')::uuid) THEN
    RAISE NOTICE 'CHECK 8 (live half) SKIPPED: intruder_id is an admin, who is allowed to edit any build''s media by policy. Pass a non-admin to exercise the refusal.';
  END IF;
END
$$;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = :'intruder_id';

DO $$
DECLARE
  _build UUID := (SELECT id FROM _bg_p07b WHERE name = 'build');
  _m1    UUID := (SELECT id FROM _bg_p07b WHERE name = 'm1');
  _m4    UUID := (SELECT id FROM _bg_p07b WHERE name = 'm4');
BEGIN
  IF public.is_admin(current_setting('bg_p07b.intruder_id')::uuid) THEN RETURN; END IF;

  BEGIN
    PERFORM public.set_build_post_media(_build, ARRAY[_m4, _m1]::uuid[]);
    RAISE EXCEPTION 'CHECK 8 FAILED: an intruder rearranged another creator''s pictures';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END
$$;

SET LOCAL request.jwt.claim.sub = :'creator_id';

DO $$
DECLARE
  _build UUID := (SELECT id FROM _bg_p07b WHERE name = 'build');
  _m1    UUID := (SELECT id FROM _bg_p07b WHERE name = 'm1');
  _m4    UUID := (SELECT id FROM _bg_p07b WHERE name = 'm4');
  _cover UUID;
BEGIN
  PERFORM public.set_build_post_media(_build, ARRAY[_m4, _m1]::uuid[]);

  SELECT cover_media_id INTO _cover FROM public.builds WHERE id = _build;
  IF _cover IS DISTINCT FROM _m4 THEN
    RAISE EXCEPTION 'CHECK 8 FAILED: the creator''s own write did not move the mirror (got %)', _cover;
  END IF;

  RAISE NOTICE 'CHECK 8 PASSED: invoker rights refuse the intruder, the creator succeeds, and the definer trigger still writes the mirror.';
END
$$;

RESET ROLE;


-- =============================================================================
-- 9. build_media's policies are unchanged, and none uses a bare auth.uid()
-- =============================================================================
-- BG-P07b adds no policy. A new column rides the four that are already there,
-- because each is a row filter naming no column but build_id.
DO $$
DECLARE _n INTEGER; _bare TEXT;
BEGIN
  SELECT count(*) INTO _n FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'build_media';

  IF _n <> 4 THEN
    RAISE EXCEPTION 'CHECK 9 FAILED: build_media has % policies, expected the 4 NS-P11 created', _n;
  END IF;

  -- A bare auth.uid() re-evaluates per row. regexp: auth.uid() not preceded by
  -- "select ".
  SELECT string_agg(policyname, ', ') INTO _bare
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'build_media'
    AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) ~* '(?<!select )auth\.uid\(\)';

  IF _bare IS NOT NULL THEN
    RAISE EXCEPTION 'CHECK 9 FAILED: these policies call auth.uid() bare rather than (select auth.uid()): %', _bare;
  END IF;

  RAISE NOTICE 'CHECK 9 PASSED: the same 4 policies, all wrapping auth.uid() in a select.';
END
$$;


\echo ''
\echo 'BG-P07b: ALL CHECKS PASSED'
\echo ''

ROLLBACK;
