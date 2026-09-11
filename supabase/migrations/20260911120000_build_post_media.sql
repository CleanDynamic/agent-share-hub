-- =============================================================================
-- buildgallery.ai — the post's ordered cover set (BG-P07b)
-- =============================================================================
-- A post shows up to FOUR pictures, in an order the creator sets, at their own
-- aspect ratios. Until now a build could designate exactly one: builds.
-- cover_media_id, added by NS-P27. One column, one picture, no order.
--
-- This migration adds the set. It is ADDITIVE in the strict sense — no existing
-- column is dropped, repurposed or made to mean something new, and no row's
-- current behaviour changes. Nothing in the application reads post_position
-- yet: BG-P09 rebuilds the card's media block to render it and BG-P23 gives the
-- composer the interface to set it. Until then this is data with no reader,
-- which is deliberate. The schema lands first and alone, so that the surfaces
-- that follow have something stable to build against.
--
--
-- WHY A COLUMN ON build_media AND NOT A JOIN TABLE
-- -----------------------------------------------
-- The obvious alternative is build_post_media(build_id, media_id, position).
-- It was rejected because the relationship it would model is one a build_media
-- row ALREADY carries: every row in this table belongs to exactly one build via
-- build_id, so a join table would restate that key and then need a constraint
-- to stop the two copies disagreeing. What is actually being recorded is a
-- property OF the media row — "this one is in the post, at this place" — and a
-- nullable column is what a sparse property of an existing row looks like.
--
-- Sparse is the operative word. The overwhelming majority of build_media rows
-- are attached to a node and are not part of the post's own set; for them
-- post_position stays NULL and costs one bit in the row's null bitmap, which is
-- already allocated. The partial index below indexes only the rows that are in
-- a set, so the reading cost is proportional to four rows per build rather than
-- to the table.
--
--
-- WHAT NULL MEANS, PRECISELY
-- --------------------------
-- NULL is not "position unknown" and not "position zero". It means the row is
-- not part of the post's set at all. That is the default and the majority
-- state, and it is why the column is nullable rather than NOT NULL DEFAULT -1
-- or any other sentinel: a sentinel would have to be excluded by hand from
-- every query, every index and every constraint, and the one that gets
-- forgotten is the bug.
--
--
-- cover_media_id IS NOW A MIRROR — READ THIS BEFORE CHANGING EITHER
-- ----------------------------------------------------------------
-- THE SET IS THE SOURCE OF TRUTH. builds.cover_media_id is a derived copy of
-- the set's FIRST entry, maintained by the trigger in section 6.
--
-- It is kept because dozens of call sites still read it — resolveCover, the
-- gallery embed, the build page, every card body — and this prompt changes no
-- component. Making them all read the set at once would be a rewrite of the
-- read path disguised as a schema change. Instead the old pointer keeps
-- answering the old question correctly, forever, without any of those call
-- sites knowing the set exists.
--
-- The invariant, stated once so it can be checked:
--
--   builds.cover_media_id = the build_media row with post_position = 0,
--   whenever such a row exists; NULL from this mechanism when none does.
--
-- Write to the SET, never to the mirror, in any code added from here on.
-- setCover() still writes the mirror directly and is left alone on purpose —
-- it is the pre-set way to choose a cover and every existing caller of it
-- stays correct — but a build whose cover was set that way simply has no set,
-- which resolveCover already handles by falling through its existing chain.
--
--
-- NO RLS CHANGE, AND THE READING THAT ESTABLISHED THAT
-- ---------------------------------------------------
-- Checked rather than assumed. build_media carries four policies, created by
-- NS-P11 (20260823140000_build_media_storage.sql) and unchanged since:
--
--   "Build media follow build readability"            SELECT
--   "Build media follow build writability on insert"  INSERT
--   "Build media follow build writability on update"  UPDATE
--   "Build media follow build writability on delete"  DELETE
--
-- Every one of them is an EXISTS subquery against the parent build and none
-- names a column of build_media other than build_id. They are row filters, not
-- column filters, so a new column on the table is covered by them the moment
-- it exists: a row a viewer may read carries its post_position, and a row they
-- may not read stays invisible with or without one. Postgres has no
-- column-level RLS to fall out of step here, and the grants are table-wide
-- (SELECT to anon and authenticated, INSERT/UPDATE/DELETE to authenticated),
-- so no grant needs widening either.
--
-- All four already wrap their current-user calls as (select auth.uid()). This
-- migration adds no policy and rewrites none.
-- =============================================================================


-- =============================================================================
-- 1. The column
-- =============================================================================
-- SMALLINT because the domain is 0..3. The CHECK in section 3 is what actually
-- holds that range; the type just refuses to pretend a position could be a
-- bigint.
ALTER TABLE public.build_media
  ADD COLUMN IF NOT EXISTS post_position SMALLINT NULL;

COMMENT ON COLUMN public.build_media.post_position IS
  'This row''s place in the post''s ordered cover set, 0 to 3. NULL — the default and the majority state — means the row is attached to a node but is NOT part of the post''s own set. Positions are dense: a set of three occupies 0, 1 and 2. The set is the source of truth for which pictures a post leads with; builds.cover_media_id mirrors position 0 (BG-P07b).';


-- =============================================================================
-- 2. Four maximum, and pictures only
-- =============================================================================
-- Guarded on the catalog because Postgres has no ADD CONSTRAINT IF NOT EXISTS
-- and this migration must be re-runnable against a database that already has
-- part of it.

-- Positions 0..3. Four is the design's limit, not a tuning parameter: BG-P09's
-- media block has four arrangements and no fifth.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.build_media'::regclass
      AND conname  = 'build_media_post_position_range_check'
  ) THEN
    ALTER TABLE public.build_media
      ADD CONSTRAINT build_media_post_position_range_check
      CHECK (post_position IS NULL OR post_position BETWEEN 0 AND 3);
  END IF;
END $$;

-- Audio and files are not pictures. They can hang off a node all they like;
-- they cannot be one of the four things a post shows. Without this the
-- composer could put a CSV in slot 2 and the card would have to invent a
-- rendering for it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.build_media'::regclass
      AND conname  = 'build_media_post_position_kind_check'
  ) THEN
    ALTER TABLE public.build_media
      ADD CONSTRAINT build_media_post_position_kind_check
      CHECK (post_position IS NULL OR kind IN ('image','video'));
  END IF;
END $$;


-- =============================================================================
-- 3. One row per slot
-- =============================================================================
-- A PARTIAL UNIQUE index, which is doing two jobs at once and is deliberately
-- the only index this migration creates.
--
-- Job one, correctness: two rows cannot claim the same slot on the same build.
-- Without it a composer bug silently produces a post whose picture order
-- depends on which row the planner happened to return first.
--
-- Job two, reading: it is an ordinary btree on (build_id, post_position)
-- covering exactly the rows that have a position, so the one query this
-- feature makes —
--
--   WHERE build_id = $1 AND post_position IS NOT NULL ORDER BY post_position
--
-- is an index scan that returns the four rows already in order, with no sort.
--
-- BG-P07b's brief asked for a separate non-unique index of the same shape as
-- well. That is NOT created: it would be byte-for-byte the same btree on the
-- same predicate, so it could never be chosen over this one, and it would add
-- a second index to maintain on every insert, update and delete of a media row
-- in exchange for nothing. One index, both jobs.
--
-- NOT deferrable, and it cannot be made so — a partial unique index is an
-- index and not a constraint, and only constraints defer. Anything that
-- REORDERS a set must therefore never hold two rows in one slot even
-- momentarily, which is why set_build_post_media() in section 7 clears every
-- position before it assigns any.
CREATE UNIQUE INDEX IF NOT EXISTS idx_build_media_post_position
  ON public.build_media (build_id, post_position)
  WHERE post_position IS NOT NULL;

COMMENT ON INDEX public.idx_build_media_post_position IS
  'One row per slot per build, and the read path for the post''s set: an ordered index scan of the at-most-four rows with a position (BG-P07b).';


-- =============================================================================
-- 4. Backfill — every existing cover becomes its post's first picture
-- =============================================================================
-- The one row that moves per build, and nothing else. A build with a cover
-- already has a picture its creator chose to lead with; that choice is exactly
-- what position 0 means, so it carries across rather than being asked for
-- again. A build with no cover gets no set and is untouched — it renders from
-- resolveCover's existing chain precisely as it does today.
--
-- TWO GUARDS, both of which can actually bite:
--
--   m.build_id = b.id     cover_media_id has no constraint tying it to the
--                         build that points at it — setCover() says so in its
--                         own comment, because verifying it would cost a round
--                         trip to prevent a state that renders as nothing.
--                         Backfilling such a row would be worse than nothing:
--                         it would claim slot 0 on the media's OWN build, which
--                         is a DIFFERENT build than the one being backfilled.
--
--   m.kind IN (...)       a cover pointing at an audio or file row would
--                         violate section 2's kind check and abort the whole
--                         migration.
--
-- Rows failing either guard are left with post_position NULL and counted
-- separately below, so they are reported rather than silently skipped.
--
-- Runs BEFORE the trigger exists, on purpose: every row it touches already has
-- builds.cover_media_id pointing at it, so firing the mirror trigger here would
-- be an UPDATE of builds per build to write each row the value it already
-- holds.
DO $$
DECLARE
  _eligible INTEGER;
  _skipped_other_build INTEGER;
  _skipped_kind INTEGER;
  _total_with_cover INTEGER;
BEGIN
  SELECT count(*) INTO _total_with_cover
    FROM public.builds b
   WHERE b.cover_media_id IS NOT NULL;

  SELECT
    count(*) FILTER (WHERE m.build_id <> b.id),
    count(*) FILTER (WHERE m.build_id = b.id AND m.kind NOT IN ('image','video'))
  INTO _skipped_other_build, _skipped_kind
    FROM public.builds b
    JOIN public.build_media m ON m.id = b.cover_media_id;

  UPDATE public.build_media m
     SET post_position = 0
    FROM public.builds b
   WHERE b.cover_media_id = m.id
     AND m.build_id = b.id
     AND m.kind IN ('image','video')
     AND m.post_position IS NULL;

  GET DIAGNOSTICS _eligible = ROW_COUNT;

  RAISE NOTICE 'BG-P07b backfill: % build(s) carry a cover_media_id; % row(s) set to post_position = 0; % skipped (cover points at another build''s media); % skipped (cover is not an image or video).',
    _total_with_cover, _eligible, COALESCE(_skipped_other_build, 0), COALESCE(_skipped_kind, 0);
END $$;


-- =============================================================================
-- 5. The mirror
-- =============================================================================
-- Keeps builds.cover_media_id equal to the set's position-0 row, so that every
-- call site still reading the old pointer keeps getting a correct answer
-- without being touched.
--
-- SECURITY DEFINER, and the reason is narrower than it looks. The creator
-- editing their own build could write builds themselves — "Creators and admins
-- update builds" admits them. The cases that need the definer right are the
-- ones where the writer of the media row is not the writer of the build row:
-- an admin correcting someone else's post (build_media's policies admit
-- is_admin, and the mirror must follow the edit they are allowed to make), and
-- any service-role or edge-function path that moves media. Without it the
-- mirror would fail silently in exactly those cases and the two columns would
-- drift — which is the one failure this whole trigger exists to prevent.
--
-- The right it holds is tightly bounded: the function takes no argument, reads
-- its build id and media id off the row that fired it, and writes ONE column of
-- ONE row of ONE table. It cannot be pointed at anything else.
--
-- search_path is pinned EMPTY and every reference is schema-qualified, so no
-- search path a caller sets can put a different `builds` in front of this one.
--
-- WHY EVERY WRITE IS GUARDED ON THE MIRROR'S CURRENT VALUE
-- -------------------------------------------------------
-- `AND b.cover_media_id = OLD.id` on the clear is what makes this correct under
-- a REORDER, where two rows change slots in one statement and Postgres fires
-- the trigger once per row in an order nothing guarantees. Take a swap: row A
-- moves 0 -> 1, row B moves NULL -> 0.
--
--   B first: cover := B. Then A's clear looks for cover = A, finds B, and does
--            nothing. Correct.
--   A first: A's clear finds cover = A and nulls it. Then B sets cover := B.
--            Correct.
--
-- Both orders land on B. A clear that did not check would blank the mirror
-- after B had already claimed it, leaving a post with four pictures and no
-- cover for every call site still reading the old column.
--
-- DELETE IS ABSENT, AND THAT IS NOT AN OVERSIGHT
-- ----------------------------------------------
-- builds.cover_media_id REFERENCES build_media(id) ON DELETE SET NULL, so
-- deleting the position-0 row clears the mirror by itself, in the same
-- statement, without a trigger. Adding a DELETE branch here would duplicate the
-- foreign key's job. What deleting does NOT do is close the gap it leaves in
-- the set — positions 1..3 stay where they are. That is left to the data
-- layer's removePostMedia, which reassigns the whole set, because a trigger
-- that renumbered rows during a cascade would be renumbering rows that are
-- themselves being deleted.
CREATE OR REPLACE FUNCTION public.sync_build_cover_from_post_media()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Left slot 0 — cleared, moved down the set, or moved to another build.
  -- TG_OP is tested FIRST because plpgsql short-circuits AND, and OLD is not
  -- assigned on INSERT.
  IF TG_OP = 'UPDATE'
     AND OLD.post_position = 0
     AND (NEW.post_position IS DISTINCT FROM 0
          OR NEW.build_id IS DISTINCT FROM OLD.build_id)
  THEN
    UPDATE public.builds b
       SET cover_media_id = NULL
     WHERE b.id = OLD.build_id
       AND b.cover_media_id = OLD.id;
  END IF;

  -- Took slot 0. IS DISTINCT FROM keeps a re-save that changes nothing from
  -- writing a builds row for no reason.
  IF NEW.post_position = 0 THEN
    UPDATE public.builds b
       SET cover_media_id = NEW.id
     WHERE b.id = NEW.build_id
       AND b.cover_media_id IS DISTINCT FROM NEW.id;
  END IF;

  RETURN NULL;  -- AFTER FOR EACH ROW: the return value is ignored.
END $$;

COMMENT ON FUNCTION public.sync_build_cover_from_post_media() IS
  'Maintains builds.cover_media_id as a mirror of the post set''s position-0 row (BG-P07b). The set is the source of truth; the mirror exists so every pre-BG-P07b reader of cover_media_id stays correct without being changed.';

DROP TRIGGER IF EXISTS trg_build_media_cover_mirror ON public.build_media;
CREATE TRIGGER trg_build_media_cover_mirror
  AFTER INSERT OR UPDATE ON public.build_media
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_build_cover_from_post_media();


-- =============================================================================
-- 6. Writing the whole set at once
-- =============================================================================
-- The set is replaced, never edited in place, and this function is the only
-- thing that writes post_position. Two reasons it is here rather than in the
-- client:
--
-- ATOMICITY. Replacing a set means clearing the old positions and assigning the
-- new ones. Done as two round trips from the browser, a failure between them
-- leaves the build with NO set and NO cover — the creator's four chosen
-- pictures gone because a request timed out. Inside one function it is one
-- statement from PostgREST's point of view, so it either all lands or none of
-- it does.
--
-- THE UNIQUE INDEX CANNOT DEFER. Section 3 explains why. Clearing every
-- position before assigning any is what keeps a reorder from colliding with
-- itself, and it only works if both steps are inside one transaction.
--
-- SECURITY INVOKER — the default, stated here because it matters. This function
-- deliberately does NOT hold the definer right: it runs as the caller, so
-- build_media's UPDATE policy decides whether this caller may touch these rows,
-- exactly as it would for a direct write. A definer function here would be a
-- hole letting any authenticated user rearrange any build's pictures.
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

  -- Step one, alone and first. Nothing may hold a slot while a slot is being
  -- reassigned; see section 3.
  UPDATE public.build_media
     SET post_position = NULL
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

  RETURN QUERY
    SELECT m.*
      FROM public.build_media m
     WHERE m.build_id = p_build_id
       AND m.post_position IS NOT NULL
     ORDER BY m.post_position;
END $$;

COMMENT ON FUNCTION public.set_build_post_media(UUID, UUID[]) IS
  'Replaces a build''s ordered post-media set in one transaction, positions taken from the array order (BG-P07b). SECURITY INVOKER: build_media''s own RLS decides who may call it for which build.';

REVOKE ALL ON FUNCTION public.set_build_post_media(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_build_post_media(UUID, UUID[]) TO authenticated, service_role;
