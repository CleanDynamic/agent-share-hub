-- =============================================================================
-- buildgallery.ai — post text acceptance checks (BG-P07c)
-- =============================================================================
-- Proves the BG-P07c acceptances that are facts about Postgres rather than
-- about TypeScript. The TypeScript half — POST_TEXT_MAX, the trimming and
-- refusals in setPostMediaText, and the whole of the postEntriesOf resolver —
-- is in src/lib/build/cover.test.ts and is run by `npm run test -- cover`.
-- These are the ones a vitest double cannot establish, because the thing under
-- test is a CHECK, a function body, or a policy:
--
--   1. the column and its CHECK are installed, and the column is TEXT
--   2. THE BRIEF'S OWN QUERY: text on a row with no post_position is REFUSED.
--      This is acceptance 2 of the prompt, run verbatim
--   3. 281 characters is refused, 280 is accepted — the boundary, both sides
--   4. the limit counts CHARACTERS, not bytes: 280 emoji are accepted and 281
--      are refused, so a client counting code points agrees with the database
--   5. text on an entry of the post round-trips, and NULL is always legal
--   6. A ROW LEAVING THE SET loses its text in the same statement that clears
--      its position, so removing a captioned picture does not raise
--   7. A REORDER carries each row's text with it, because the text is on the
--      row and not on the position
--   8. the invariant holds over every row in the table, not just the fixtures
--   9. build_media's four policies are UNCHANGED and still use
--      (select auth.uid()); BG-P07c adds no policy and rewrites none
--
-- USAGE
--   psql "$DATABASE_URL" \
--     -v creator_id=<a profiles.id uuid> \
--     -f supabase/tests/bg-p07c-post-text.sql
--
-- creator_id must be an existing public.profiles row. Unlike the BG-P07b
-- script this one needs no second identity: BG-P07c adds no policy and changes
-- no function's security posture, so there is no access decision to probe —
-- check 9 asserts that absence from the catalog instead.
--
-- The whole script runs inside one transaction and ends in ROLLBACK. It leaves
-- nothing behind and is safe against a database with real rows.
--
-- Every check raises on failure, so a run that reaches "ALL CHECKS PASSED" has
-- passed all of them.
--
-- RUN AT THE TIME OF WRITING against a real PostgreSQL 16.13 head-state
-- database built by replaying this repository's own migrations in order. All
-- nine passed. Before the migration, check 1 failed on the absent column, and
-- supabase/tests/bg-p07b-post-media.sql still passes all nine of ITS checks
-- afterwards — which is what makes the change to set_build_post_media() in
-- section 3 of the migration safe to have made.
-- =============================================================================

\if :{?creator_id}
\else
  \echo 'ERROR: pass -v creator_id=<uuid>'
  \quit
\endif

BEGIN;

\set ON_ERROR_STOP on

-- psql does not substitute :'var' inside a dollar-quoted body, so the id is
-- stashed as a transaction-local setting and read back with current_setting().
-- Same device as supabase/tests/bg-p07b-post-media.sql.
SELECT set_config('bg_p07c.creator_id', :'creator_id', true);

-- Fixtures: one build with three pictures in its post and one picture that is
-- attached to the build but NOT part of the post — which is the row checks 2
-- and 8 need, because the CHECK's first job is to keep text off it.
CREATE TEMP TABLE _bg_p07c (name TEXT PRIMARY KEY, id UUID NOT NULL) ON COMMIT DROP;

DO $$
DECLARE
  _build  UUID := gen_random_uuid();
  _suffix TEXT := replace(gen_random_uuid()::text, '-', '');
  _loose  UUID;
BEGIN
  INSERT INTO public.builds (id, creator_id, slug, title, status, outcome)
  VALUES (_build, current_setting('bg_p07c.creator_id')::uuid,
          'bg-p07c-' || _suffix, 'BG-P07c fixture', 'draft',
          'Turns a week of scattered notes into one publishable build.');

  INSERT INTO _bg_p07c (name, id) VALUES ('build', _build);

  INSERT INTO public.build_media (build_id, bucket, path, kind, mime, width, height)
  SELECT _build, 'build-media', _build || '/unplaced/' || n || '.png', 'image', 'image/png', 1600, 900
  FROM generate_series(1, 3) AS n;

  INSERT INTO _bg_p07c (name, id)
  SELECT 'm' || row_number() OVER (ORDER BY path), id
  FROM public.build_media WHERE build_id = _build;

  -- Attached to the build, deliberately never given a position.
  INSERT INTO public.build_media (build_id, bucket, path, kind, mime, width, height)
  VALUES (_build, 'build-media', _build || '/unplaced/loose.png', 'image', 'image/png', 800, 600)
  RETURNING id INTO STRICT _loose;
  INSERT INTO _bg_p07c (name, id) VALUES ('loose', _loose);

  -- The three pictures become the post, in order.
  PERFORM public.set_build_post_media(
    _build,
    ARRAY[(SELECT id FROM _bg_p07c WHERE name = 'm1'),
          (SELECT id FROM _bg_p07c WHERE name = 'm2'),
          (SELECT id FROM _bg_p07c WHERE name = 'm3')]
  );
END
$$;


-- =============================================================================
-- 1. The column and its CHECK
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'build_media'
      AND column_name = 'post_text' AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: build_media.post_text is absent or is not TEXT';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'build_media'
      AND column_name = 'post_text' AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: post_text is NOT NULL; no text is the normal state';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.build_media'::regclass
      AND conname = 'build_media_post_text_check'
  ) THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: build_media_post_text_check is absent';
  END IF;

  -- The CHECK must name both halves of the rule. A constraint that only capped
  -- the length would let text sit on a row that is not in the post.
  IF pg_get_constraintdef(
       (SELECT oid FROM pg_constraint
         WHERE conrelid = 'public.build_media'::regclass
           AND conname = 'build_media_post_text_check')
     ) NOT LIKE '%post_position IS NOT NULL%' THEN
    RAISE EXCEPTION 'CHECK 1 FAILED: the CHECK does not require post_position IS NOT NULL';
  END IF;

  RAISE NOTICE 'CHECK 1 PASSED: post_text is a nullable TEXT column held by build_media_post_text_check.';
END
$$;


-- =============================================================================
-- 2. Text on a row that is not in the post is REFUSED
-- =============================================================================
-- Acceptance 2 of the brief, run as the brief writes it. Postgres has no LIMIT
-- on UPDATE, so the one row is chosen by subquery; the refusal is the CHECK's,
-- identified by SQLSTATE 23514 and by name so that a DIFFERENT constraint
-- failing could never be mistaken for a pass.
DO $$
DECLARE _sqlstate TEXT; _message TEXT;
BEGIN
  BEGIN
    UPDATE public.build_media
       SET post_text = 'x'
     WHERE id = (SELECT id FROM public.build_media WHERE post_position IS NULL LIMIT 1);

    RAISE EXCEPTION 'CHECK 2 FAILED: text was accepted on a row with no post_position';
  EXCEPTION
    WHEN check_violation THEN
      GET STACKED DIAGNOSTICS _sqlstate = RETURNED_SQLSTATE, _message = MESSAGE_TEXT;
      IF _message NOT LIKE '%build_media_post_text_check%' THEN
        RAISE EXCEPTION 'CHECK 2 FAILED: refused, but by the wrong constraint: %', _message;
      END IF;
  END;

  RAISE NOTICE 'CHECK 2 PASSED: the CHECK refused text on a positionless row (SQLSTATE %).', _sqlstate;
END
$$;


-- =============================================================================
-- 3. 280 is the cap — the boundary from both sides
-- =============================================================================
DO $$
DECLARE _m1 UUID := (SELECT id FROM _bg_p07c WHERE name = 'm1');
BEGIN
  BEGIN
    UPDATE public.build_media SET post_text = repeat('a', 281) WHERE id = _m1;
    RAISE EXCEPTION 'CHECK 3 FAILED: 281 characters were accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  -- Exactly 280 is inside the limit, so the cap is 280 and not 279.
  UPDATE public.build_media SET post_text = repeat('a', 280) WHERE id = _m1;

  IF (SELECT char_length(post_text) FROM public.build_media WHERE id = _m1) <> 280 THEN
    RAISE EXCEPTION 'CHECK 3 FAILED: 280 characters did not round-trip';
  END IF;

  UPDATE public.build_media SET post_text = NULL WHERE id = _m1;
  RAISE NOTICE 'CHECK 3 PASSED: 281 refused, 280 accepted.';
END
$$;


-- =============================================================================
-- 4. The limit counts CHARACTERS, not bytes
-- =============================================================================
-- char_length rather than octet_length, so an emoji or a non-Latin script costs
-- one of a creator's 280 rather than the four bytes it encodes to. This is the
-- check that keeps the database in step with a client counting code points: if
-- the constraint were ever rewritten to octet_length, 280 emoji would start
-- being refused here while the composer still offered them.
DO $$
DECLARE
  _m1   UUID := (SELECT id FROM _bg_p07c WHERE name = 'm1');
  _280  TEXT := repeat('🛠', 280);   -- 280 characters, 1120 bytes
BEGIN
  UPDATE public.build_media SET post_text = _280 WHERE id = _m1;

  IF (SELECT octet_length(post_text) FROM public.build_media WHERE id = _m1) <= 280 THEN
    RAISE EXCEPTION 'CHECK 4 FAILED: the fixture is not multi-byte, so this proves nothing';
  END IF;

  BEGIN
    UPDATE public.build_media SET post_text = _280 || '🛠' WHERE id = _m1;
    RAISE EXCEPTION 'CHECK 4 FAILED: 281 characters were accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  UPDATE public.build_media SET post_text = NULL WHERE id = _m1;
  RAISE NOTICE 'CHECK 4 PASSED: 280 multi-byte characters accepted, 281 refused — the cap is characters.';
END
$$;


-- =============================================================================
-- 5. Text on an entry of the post round-trips, and NULL is always legal
-- =============================================================================
DO $$
DECLARE
  _m2 UUID := (SELECT id FROM _bg_p07c WHERE name = 'm2');
  _got TEXT;
BEGIN
  UPDATE public.build_media SET post_text = 'Then it drew the graph.' WHERE id = _m2;
  SELECT post_text INTO _got FROM public.build_media WHERE id = _m2;

  IF _got IS DISTINCT FROM 'Then it drew the graph.' THEN
    RAISE EXCEPTION 'CHECK 5 FAILED: text did not round-trip, got %', COALESCE(_got, '<null>');
  END IF;

  -- Clearing is legal from any state, including on a row with no position —
  -- which is what makes removePostMedia's clear-then-reorder safe.
  UPDATE public.build_media SET post_text = NULL
   WHERE id IN (SELECT id FROM _bg_p07c WHERE name IN ('m2', 'loose'));

  RAISE NOTICE 'CHECK 5 PASSED: text round-trips on an entry; NULL is legal everywhere.';
END
$$;


-- =============================================================================
-- 6. A row LEAVING the set loses its text, and removing it does not raise
-- =============================================================================
-- The failure this prevents: a creator writes a caption, then deletes the
-- picture it sits under. Clearing post_position re-evaluates the CHECK, and
-- without section 3 of the migration it would find text on a row with no
-- position and refuse — so the picture could not be removed at all.
DO $$
DECLARE
  _build UUID := (SELECT id FROM _bg_p07c WHERE name = 'build');
  _m1    UUID := (SELECT id FROM _bg_p07c WHERE name = 'm1');
  _m2    UUID := (SELECT id FROM _bg_p07c WHERE name = 'm2');
  _m3    UUID := (SELECT id FROM _bg_p07c WHERE name = 'm3');
BEGIN
  UPDATE public.build_media SET post_text = 'the middle one' WHERE id = _m2;

  -- What removePostMedia sends: the surviving ids, in order.
  PERFORM public.set_build_post_media(_build, ARRAY[_m1, _m3]);

  IF (SELECT post_text FROM public.build_media WHERE id = _m2) IS NOT NULL THEN
    RAISE EXCEPTION 'CHECK 6 FAILED: the departing row kept its text';
  END IF;

  IF (SELECT post_position FROM public.build_media WHERE id = _m2) IS NOT NULL THEN
    RAISE EXCEPTION 'CHECK 6 FAILED: the departing row kept its position';
  END IF;

  -- And the gap closed behind it, which is BG-P07b's guarantee still holding.
  IF (SELECT post_position FROM public.build_media WHERE id = _m3) <> 1 THEN
    RAISE EXCEPTION 'CHECK 6 FAILED: the gap did not close';
  END IF;

  RAISE NOTICE 'CHECK 6 PASSED: a departing row loses position and text together; the gap still closes.';
END
$$;


-- =============================================================================
-- 7. A REORDER carries each row's text with it
-- =============================================================================
-- The text is on the ROW, not on the position, so moving a picture moves its
-- words. This is the case a naive fix for check 6 breaks: set_build_post_media
-- clears every position before assigning any, so anything keyed on "position
-- became NULL" wipes the text of pictures that are merely moving.
DO $$
DECLARE
  _build UUID := (SELECT id FROM _bg_p07c WHERE name = 'build');
  _m1    UUID := (SELECT id FROM _bg_p07c WHERE name = 'm1');
  _m3    UUID := (SELECT id FROM _bg_p07c WHERE name = 'm3');
BEGIN
  UPDATE public.build_media SET post_text = 'first words'  WHERE id = _m1;
  UPDATE public.build_media SET post_text = 'second words' WHERE id = _m3;

  -- Swap them.
  PERFORM public.set_build_post_media(_build, ARRAY[_m3, _m1]);

  IF (SELECT post_text FROM public.build_media WHERE id = _m1) IS DISTINCT FROM 'first words' THEN
    RAISE EXCEPTION 'CHECK 7 FAILED: a reordered row lost its text';
  END IF;
  IF (SELECT post_text FROM public.build_media WHERE id = _m3) IS DISTINCT FROM 'second words' THEN
    RAISE EXCEPTION 'CHECK 7 FAILED: a reordered row lost its text';
  END IF;

  -- The words moved with their pictures: m3 is now first and still says
  -- "second words", which is exactly what "text is on the row" means.
  IF (SELECT post_position FROM public.build_media WHERE id = _m3) <> 0
     OR (SELECT post_position FROM public.build_media WHERE id = _m1) <> 1 THEN
    RAISE EXCEPTION 'CHECK 7 FAILED: the reorder itself did not happen';
  END IF;

  RAISE NOTICE 'CHECK 7 PASSED: reordering carries each row''s text with it.';
END
$$;


-- =============================================================================
-- 8. The invariant over every row in the table
-- =============================================================================
DO $$
DECLARE _orphan INTEGER; _long INTEGER;
BEGIN
  SELECT count(*) INTO _orphan
    FROM public.build_media
   WHERE post_text IS NOT NULL AND post_position IS NULL;

  IF _orphan > 0 THEN
    RAISE EXCEPTION 'CHECK 8 FAILED: % row(s) carry text without being in a post', _orphan;
  END IF;

  SELECT count(*) INTO _long
    FROM public.build_media
   WHERE char_length(post_text) > 280;

  IF _long > 0 THEN
    RAISE EXCEPTION 'CHECK 8 FAILED: % row(s) exceed 280 characters', _long;
  END IF;

  RAISE NOTICE 'CHECK 8 PASSED: no row in the table carries orphaned or over-long text.';
END
$$;


-- =============================================================================
-- 9. No policy was added, and none grew a bare auth.uid()
-- =============================================================================
-- BG-P07c adds a column, and a column rides the table's existing row filters.
-- This check is what makes "no RLS change" a fact rather than a claim.
DO $$
DECLARE _n INTEGER; _bare INTEGER;
BEGIN
  SELECT count(*) INTO _n FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'build_media';

  IF _n <> 4 THEN
    RAISE EXCEPTION 'CHECK 9 FAILED: build_media has % policies, expected the original 4', _n;
  END IF;

  -- A bare auth.uid() re-evaluates per row and is the single largest database
  -- cost in this codebase. Every one of these four wraps it in a subselect;
  -- stripping the wrapped form and looking for what is left is how a new bare
  -- call would be caught.
  SELECT count(*) INTO _bare FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'build_media'
     AND replace(
           replace(COALESCE(qual, '') || ' ' || COALESCE(with_check, ''),
                   '( SELECT auth.uid() AS uid)', ''),
           '(select auth.uid())', '') LIKE '%auth.uid()%';

  IF _bare > 0 THEN
    RAISE EXCEPTION 'CHECK 9 FAILED: % policy/policies call auth.uid() unwrapped', _bare;
  END IF;

  RAISE NOTICE 'CHECK 9 PASSED: the original four policies, none with a bare auth.uid().';
END
$$;


DO $$ BEGIN RAISE NOTICE 'BG-P07c: ALL CHECKS PASSED.'; END $$;

ROLLBACK;
