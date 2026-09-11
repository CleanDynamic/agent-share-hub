-- =============================================================================
-- buildgallery.ai — text on every entry of the post (BG-P07c)
-- =============================================================================
-- THE CARD IS BECOMING A THREAD. On the feed a build card reads like a tweet: a
-- passage of text sitting above a picture, and — when the creator added more —
-- further text-and-picture entries revealed in place. BG-P07b gave the post its
-- ordered set of up to four pictures (build_media.post_position). Each of those
-- rows now needs its own short text, and that is the column this migration adds.
--
-- Nothing renders it. BG-P09 rebuilds the card to draw the entries and BG-P23
-- gives the composer a thread editor to write them. This is data with no reader,
-- deliberately, so the surfaces that follow have something stable to build
-- against.
--
--
-- THE FIRST ENTRY'S TEXT IS THE BUILD'S ONE-SENTENCE DESCRIPTION, AND IS NOT
-- STORED HERE
-- ---------------------------------------------------------------------------
-- The composer already asks "What does it do? One sentence, your words." That
-- sentence is the text above the first picture, exactly as a tweet's text sits
-- above its image. It is NOT copied into this column: one sentence, one home.
--
-- The field the composer writes is builds.outcome — read from the save path in
-- src/components/compose/CoverStrip.tsx, which labels the input "Description"
-- for the creator and patches `outcome`. There is no builds.description column
-- in this schema and never has been; the prompt for this work assumed that name
-- and the reading corrected it. The column keeps its name; the word a creator
-- reads is Description.
--
-- So entry 0 has no post_text of its own until a creator overrides it, and the
-- resolver postEntriesOf() in src/lib/build/cover.ts supplies builds.outcome at
-- READ time. Every surface that renders the thread goes through that one
-- function, so this rule lives in exactly one place and no card, composer or
-- preview gets to reinvent it.
--
-- This is also why there is NO BACKFILL. Existing entries have no text and need
-- none: position 0 already reads as the description through the resolver, and
-- positions 1..3 genuinely have nothing to say yet. A backfill copying outcome
-- into position 0 would create the second copy this design exists to avoid, and
-- would then have to be kept in step with every edit of the description.
--
--
-- WHAT THE CHECK SAYS, AND WHY EACH HALF OF IT
-- --------------------------------------------
--   post_text IS NULL
--   OR (post_position IS NOT NULL AND char_length(post_text) <= 280)
--
-- TEXT ONLY EXISTS ON AN ENTRY OF THE POST. A build_media row with no
-- post_position is not part of the post — it is a picture hanging off a node —
-- and text on it would be text nothing can ever render. Worse, it would be
-- invisible: no surface reads it, so it would rot silently until someone put
-- that row into a post and found a sentence they never wrote sitting above it.
--
-- AND IT IS TWEET-LENGTH. 280 is the cap, and it is exported by name from the
-- data layer as POST_TEXT_MAX so the composer cannot invent its own number and
-- then disagree with the database about what fits.
--
-- char_length, not octet_length: the limit is 280 CHARACTERS, so an emoji or a
-- non-Latin script costs one each rather than the two to four bytes it encodes
-- to. The data layer counts code points to match (see setPostMediaText), which
-- is why a client-side refusal and a database refusal always agree.
--
-- TEXT rather than VARCHAR(280). The length rule is the CHECK's job; in Postgres
-- varchar(n) and text are the same storage with the same performance, and a
-- type-level length is the one that cannot be relaxed later without a table
-- rewrite. Empty string is left legal by the CHECK and is normalised to NULL by
-- the data layer before it is ever written, which keeps "no text" a single
-- state rather than two that render identically.
--
--
-- NO RLS CHANGE, AND THE READING THAT ESTABLISHED IT
-- -------------------------------------------------
-- Checked against the live catalog of a head-state database, not assumed.
-- build_media carries exactly four policies, created by NS-P11
-- (20260823140000_build_media_storage.sql) and unchanged since:
--
--   "Build media follow build readability"            SELECT
--   "Build media follow build writability on insert"  INSERT
--   "Build media follow build writability on update"  UPDATE
--   "Build media follow build writability on delete"  DELETE
--
-- Every one is an EXISTS subquery against the parent build, and none names any
-- column of build_media except build_id — SELECT admits a row whose build is
-- not a draft, or whose creator is the viewer, or an admin; the three write
-- policies admit the creator or an admin. They are ROW filters, not column
-- filters, so a new column is covered by them the moment it exists: a row a
-- viewer may read carries its post_text, and a row they may not read stays
-- invisible with or without one. Postgres has no column-level RLS for these to
-- fall out of step with, and the grants are table-wide (SELECT to anon and
-- authenticated, INSERT/UPDATE/DELETE to authenticated), so no grant needs
-- widening either.
--
-- All four already wrap their identity call as (select auth.uid()). This
-- migration adds no policy and rewrites none.
--
--
-- ADDITIVE, IN THE STRICT SENSE
-- -----------------------------
-- No column is dropped, renamed or repurposed. builds.cover_media_id and
-- sync_build_cover_from_post_media() are untouched, and post_position means
-- exactly what BG-P07b made it mean. The one existing object this migration
-- changes is set_build_post_media(), and section 3 explains why that change is
-- required rather than optional.
-- =============================================================================


-- =============================================================================
-- 1. The column
-- =============================================================================
ALTER TABLE public.build_media
  ADD COLUMN IF NOT EXISTS post_text TEXT NULL;

COMMENT ON COLUMN public.build_media.post_text IS
  'The short text shown above this picture in the post''s thread, at most 280 characters. NULL means this entry carries no text of its own — which at position 0 is the normal state, because the resolver postEntriesOf() supplies builds.outcome (the composer''s "What does it do?" sentence) there at read time rather than copying it into this column. Only a row that is part of the post (post_position IS NOT NULL) may carry text; the CHECK holds that (BG-P07c).';


-- =============================================================================
-- 2. Tweet-length, and only on an entry of the post
-- =============================================================================
-- Guarded on the catalog because Postgres has no ADD CONSTRAINT IF NOT EXISTS
-- and this migration must be re-runnable against a database that already has
-- part of it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.build_media'::regclass
      AND conname  = 'build_media_post_text_check'
  ) THEN
    ALTER TABLE public.build_media
      ADD CONSTRAINT build_media_post_text_check
      CHECK (
        post_text IS NULL
        OR (post_position IS NOT NULL AND char_length(post_text) <= 280)
      );
  END IF;
END $$;


-- =============================================================================
-- 3. A row that LEAVES the set must lose its text in the same statement
-- =============================================================================
-- Without this, the CHECK added above turns an ordinary composer action into an
-- error. Removing a picture from a post clears its post_position; if that row
-- still holds text, the UPDATE re-evaluates the CHECK, finds text on a row with
-- no position, and raises — so a creator could write a caption and then be
-- unable to delete the picture it sits under.
--
-- WHY HERE AND NOT IN A TRIGGER. The obvious alternative is a BEFORE UPDATE
-- trigger that nulls post_text whenever post_position goes to NULL. It does not
-- work, and the reason is worth writing down so it is not tried again:
-- set_build_post_media() clears EVERY position first and assigns them second
-- (it has to — the partial unique index on (build_id, post_position) is an
-- index rather than a constraint and so cannot defer, and nothing may hold a
-- slot while a slot is being reassigned). A trigger watching for "position
-- became NULL" therefore fires for every row in the set on every REORDER, and
-- would wipe the text of pictures that are merely moving. Only this function
-- knows which ids are staying, so only this function can tell a departure from
-- a reorder.
--
-- WHY NOT A BLANKET TRIGGER THAT NULLS TEXT ON ANY POSITIONLESS ROW. That would
-- make the CHECK unreachable: setting text on a row that is not in the post
-- would be silently swallowed instead of refused, and the refusal is the point.
--
-- WHY THE TEXT IS STASHED AND GIVEN BACK RATHER THAN SIMPLY KEPT
-- --------------------------------------------------------------
-- The first version of this function tried the obvious thing — clear the
-- position of every row but keep the text of the ones that are staying:
--
--   SET post_position = NULL,
--       post_text = CASE WHEN id = ANY (_ids) THEN post_text ELSE NULL END
--
-- It fails, and it fails on the commonest action there is: reordering a post
-- whose pictures have captions. A CHECK constraint is evaluated per row per
-- statement and CANNOT be deferred — unlike a unique or foreign key constraint,
-- Postgres has no DEFERRABLE for CHECK at all. So the instant that statement
-- clears the position of a staying row that still holds text, the row IS in the
-- forbidden state, and the constraint refuses it there and then. It never
-- reaches step two to be given its new position.
--
-- Check 7 of supabase/tests/bg-p07c-post-text.sql is that failure, caught. The
-- coupling the CHECK expresses is worth keeping, so the function moves around
-- it instead: it remembers the text before clearing, clears position and text
-- together so no row is ever in the forbidden state, assigns the new positions,
-- and then gives each surviving row its words back. Every intermediate state
-- satisfies the CHECK, and the whole thing is one transaction, so no reader
-- ever observes a post with its captions missing.
--
--   a row STAYING in the set  is cleared, repositioned, and then handed its own
--                             text back in step three. This is what "reordering
--                             carries text with the row" means in practice: the
--                             text follows the ROW's id, not the position.
--   a row LEAVING the set     is cleared in step one and never appears in step
--                             three, so its position and its text go together
--                             and the CHECK is never presented with a row that
--                             has text and no position.
--
-- Everything else about this function — its arguments, its refusals, their
-- SQLSTATEs, its return shape, SECURITY INVOKER, the pinned search_path, the
-- clear-then-assign order — is BG-P07b's and is reproduced verbatim.
-- post_position semantics are untouched.
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
  IF _wanted > 4 THEN
    RAISE EXCEPTION 'post_media_too_many: a post shows at most 4 pictures, got %', _wanted
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
