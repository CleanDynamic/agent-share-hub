-- PT-01: post threads.
--
-- A build's post becomes a thread: one TipTap document holding several posts,
-- each a run of text blocks and pictures, posts separated by postBreak nodes.
-- The document lives on builds.post_doc. The pictures it shows stay in the
-- post-media set on build_media (BG-P07b), in document order, so the cover
-- mirror and the Gallery's media embed keep working unchanged.
--
-- Safe to run twice, and correct against a live schema that has drifted from
-- these files: columns are added IF NOT EXISTS and constraints are looked up by
-- name in pg_constraint before they are dropped or added.
--
-- Untouched: post_text and its 280-character CHECK (old posts keep working),
-- build_media_post_position_kind_check, idx_build_media_post_position, and
-- every policy (the builds UPDATE policy already covers the new column).


-- =============================================================================
-- 1. builds.post_doc
-- =============================================================================

ALTER TABLE public.builds
  ADD COLUMN IF NOT EXISTS post_doc JSONB NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.builds'::regclass
      AND conname  = 'builds_post_doc_check'
  ) THEN
    ALTER TABLE public.builds DROP CONSTRAINT builds_post_doc_check;
  END IF;

  ALTER TABLE public.builds
    ADD CONSTRAINT builds_post_doc_check
    CHECK (
      post_doc IS NULL
      OR (jsonb_typeof(post_doc) = 'object' AND octet_length(post_doc::text) <= 200000)
    );
END $$;

COMMENT ON COLUMN public.builds.post_doc IS
  'The build''s post thread as a TipTap document, posts separated by postBreak nodes (PT-01). NULL means the build has no thread yet and renders its legacy post from the post-media set.';


-- =============================================================================
-- 2. Forty pictures per thread
-- =============================================================================
-- Ten posts of up to four pictures. Replaces the 0..3 range from BG-P07b.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.build_media'::regclass
      AND conname  = 'build_media_post_position_range_check'
  ) THEN
    ALTER TABLE public.build_media DROP CONSTRAINT build_media_post_position_range_check;
  END IF;

  ALTER TABLE public.build_media
    ADD CONSTRAINT build_media_post_position_range_check
    CHECK (post_position IS NULL OR post_position BETWEEN 0 AND 39);
END $$;

COMMENT ON COLUMN public.build_media.post_position IS
  'This row''s place in the post''s ordered picture set, 0 to 39. NULL — the default and the majority state — means the row is attached to a node but is NOT part of the post''s own set. Positions are dense and follow the order the pictures appear in the thread (PT-01). builds.cover_media_id mirrors position 0 (BG-P07b).';


-- =============================================================================
-- 3. set_build_post_media(), cap raised to 40
-- =============================================================================
-- Copied from its newest definition (20260911140000_build_post_text.sql) with
-- one change: the cap is 40 and its message says so. Signature, SECURITY
-- INVOKER, search_path, refusals, SQLSTATEs, the clear-then-assign order, the
-- post_text carry-over and the grants are unchanged.
CREATE OR REPLACE FUNCTION public.set_build_post_media(
  p_build_id  UUID,
  p_media_ids UUID[]
)
RETURNS SETOF public.build_media
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _ids     UUID[]  := COALESCE(p_media_ids, ARRAY[]::UUID[]);
  _wanted  INTEGER := COALESCE(array_length(_ids, 1), 0);
  _matched INTEGER;
  _distinct INTEGER;
  -- id -> post_text for every row in the set as it stands on entry. JSONB
  -- rather than a temp table because this is a handful of rows and a temp table
  -- per call would be a catalog write on every reorder.
  _texts   JSONB;
BEGIN
  IF _wanted > 40 THEN
    RAISE EXCEPTION 'post_media_too_many: a thread shows at most 40 pictures, got %', _wanted
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(DISTINCT x) INTO _distinct FROM unnest(_ids) AS x;
  IF _distinct <> _wanted THEN
    RAISE EXCEPTION 'post_media_duplicate: the same media cannot hold two slots'
      USING ERRCODE = 'unique_violation';
  END IF;

  -- Step zero (BG-P07c): remember what the set's pictures say, before step one
  -- clears it. Only rows that actually carry text are collected, so the common
  -- case — a post nobody has captioned yet — makes this an empty object and
  -- step three a no-op.
  SELECT COALESCE(jsonb_object_agg(id::text, post_text), '{}'::jsonb)
    INTO _texts
    FROM public.build_media
   WHERE build_id = p_build_id
     AND post_position IS NOT NULL
     AND post_text IS NOT NULL;

  -- Step one, alone and first. Nothing may hold a slot while a slot is being
  -- reassigned. Position and text are cleared TOGETHER (BG-P07c) — see the note
  -- above on why the text cannot simply be left in place for staying rows.
  UPDATE public.build_media
     SET post_position = NULL,
         post_text = NULL
   WHERE build_id = p_build_id
     AND post_position IS NOT NULL;

  -- Step two: the array's order IS the position. Dense by construction — there
  -- is no way to express a gap through this function.
  UPDATE public.build_media m
     SET post_position = v.slot
    FROM (
      SELECT t.id, (t.ordinality - 1)::SMALLINT AS slot
        FROM unnest(_ids) WITH ORDINALITY AS t(id, ordinality)
    ) v
   WHERE m.id = v.id
     AND m.build_id = p_build_id;

  GET DIAGNOSTICS _matched = ROW_COUNT;

  -- A media id that is not on this build matches nothing and would otherwise be
  -- dropped in silence, leaving the creator with fewer pictures than they
  -- chose and no reason why. RLS can also produce this: a row the caller may
  -- not update is a row that did not match.
  IF _matched <> _wanted THEN
    RAISE EXCEPTION 'post_media_not_on_build: % of % media row(s) are not writable rows of build %',
      _wanted - _matched, _wanted, p_build_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- Step three (BG-P07c): give every surviving picture its words back, now that
  -- it holds a position again and the CHECK will accept them. A row that left
  -- the set has no position here and so is not matched — its text stays cleared,
  -- which is the whole point. A row that is NEW to the set cannot appear in
  -- _texts, because the CHECK forbade it from carrying text while it had no
  -- position.
  IF _texts <> '{}'::jsonb THEN
    UPDATE public.build_media m
       SET post_text = _texts ->> m.id::text
     WHERE m.build_id = p_build_id
       AND m.post_position IS NOT NULL
       AND _texts ? m.id::text;
  END IF;

  RETURN QUERY
    SELECT m.*
      FROM public.build_media m
     WHERE m.build_id = p_build_id
       AND m.post_position IS NOT NULL
     ORDER BY m.post_position;
END $$;

COMMENT ON FUNCTION public.set_build_post_media(UUID, UUID[]) IS
  'Replaces a build''s ordered post-media set in one transaction, positions taken from the array order (BG-P07b). A row that stays keeps its post_text and is reordered with it; a row that leaves loses position and text together, so the post_text CHECK cannot trip (BG-P07c). SECURITY INVOKER: build_media''s own RLS decides who may call it for which build.';

-- Grants restated because CREATE OR REPLACE on an existing function keeps its
-- ACL, but this migration must also be correct when replayed against a database
-- built from scratch where the REVOKE/GRANT above it has not run yet.
REVOKE ALL ON FUNCTION public.set_build_post_media(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_build_post_media(UUID, UUID[]) TO authenticated, service_role;
