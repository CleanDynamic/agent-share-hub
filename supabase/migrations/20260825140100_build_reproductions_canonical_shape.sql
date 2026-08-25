-- =============================================================================
-- NeoScale — bring build_reproductions back to the NS-P17 shape
-- =============================================================================
-- WHY THIS EXISTS
-- ---------------
-- The same split as build_media. The application is written against NS-P17
-- (20260824120000_build_reproductions.sql); what reached the database was
-- 20260825113022, which re-created the table with `result` and `created_at`
-- where NS-P17 has `worked` and `confirmed_at`.
--
-- src/lib/build/signals.ts names all four of the missing columns —
-- REPRODUCTION_COLUMNS selects confirmed_at and worked, recordReproduction
-- writes both, getReproductions orders by confirmed_at — so the live database
-- answers with:
--
--   42703: column build_reproductions.confirmed_at does not exist
--   42703: column build_reproductions.worked does not exist
--
-- NS-P17 is the intended design. This moves the table to it.
--
-- WHAT IT CHANGES
-- ---------------
--   + confirmed_at   when they ran it, backfilled from created_at
--   + worked         whether it worked for them, backfilled from result
--   + the (build_id, confirmed_at DESC) index NS-P17 declares
--   ~ result relaxed to nullable
--   ~ the counter trigger replaced with the one NS-P17 specifies
--
-- ON THE TRIGGER
-- --------------
-- This is the part that matters most, and the part a column-only fix would
-- miss. handle_reproduction_change (20260825113022) recomputes
-- builds.reproduction_count from `result IN ('success','partial')` and
-- MAX(created_at). Nothing writes `result` any more, so under that trigger
-- every reproduction recorded from here on would count as zero and every
-- build's header would read "0 reproductions" no matter how many people
-- confirmed it.
--
-- It is replaced by NS-P17's refresh_build_reproduction_signals, which counts
-- `worked` and takes MAX(confirmed_at). Two further differences are
-- deliberate, not incidental:
--
--   SECURITY DEFINER. The person recording a reproduction is by definition not
--   the build's creator, and the builds UPDATE policy admits only the creator
--   and admins — so the old trigger, running as the caller, could not write
--   the counter it exists to write.
--
--   An UPDATE that moves a row between builds recomputes both headers rather
--   than only the new one.
--
-- ON result, metadata AND THE user_id FOREIGN KEY
-- -----------------------------------------------
-- `result` was NOT NULL with no default and no application code writes it, so
-- recordReproduction's upsert could not have succeeded whatever else was in
-- place. It is relaxed rather than dropped, on the same reasoning as
-- build_media's filename: nothing reads it, dropping is not reversible, and
-- this migration cannot see what may already be in it.
--
-- user_id references auth.users(id) here where NS-P17 references
-- profiles(id). profiles.id IS auth.users.id, so the same values satisfy both
-- and no row is at risk either way. Rewriting a foreign key on a live table to
-- change nothing observable is not worth the exclusive lock; left as it is,
-- deliberately.
--
-- Likewise the once-per-person rule, which is a unique INDEX here and a named
-- CONSTRAINT in NS-P17. PostgREST's on_conflict resolves against either, so
-- recordReproduction's upsert works unchanged.
-- =============================================================================


-- =============================================================================
-- 1. confirmed_at
-- =============================================================================
-- Added nullable, backfilled, then constrained. Adding it NOT NULL DEFAULT
-- now() in one statement would stamp every existing row with the time this
-- migration ran and lose when the reproduction actually happened.
ALTER TABLE public.build_reproductions
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'build_reproductions' AND column_name = 'created_at'
  ) THEN
    UPDATE public.build_reproductions
    SET confirmed_at = created_at
    WHERE confirmed_at IS NULL;
  END IF;
END $$;

UPDATE public.build_reproductions SET confirmed_at = now() WHERE confirmed_at IS NULL;

ALTER TABLE public.build_reproductions ALTER COLUMN confirmed_at SET DEFAULT now();
ALTER TABLE public.build_reproductions ALTER COLUMN confirmed_at SET NOT NULL;

COMMENT ON COLUMN public.build_reproductions.confirmed_at IS
  'When this person last ran the build. Set explicitly on every upsert, so re-running moves the row forward rather than adding a second one.';


-- =============================================================================
-- 2. worked
-- =============================================================================
-- Backfilled to match what the old trigger counted, so no build's
-- reproduction_count moves as a result of this migration: it counted
-- success and partial, and both become worked = true. Only an explicit
-- 'failure' becomes false.
ALTER TABLE public.build_reproductions
  ADD COLUMN IF NOT EXISTS worked BOOLEAN NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'build_reproductions' AND column_name = 'result'
  ) THEN
    UPDATE public.build_reproductions
    SET worked = (result IS DISTINCT FROM 'failure')
    WHERE worked IS NULL;
  END IF;
END $$;

UPDATE public.build_reproductions SET worked = true WHERE worked IS NULL;

ALTER TABLE public.build_reproductions ALTER COLUMN worked SET DEFAULT true;
ALTER TABLE public.build_reproductions ALTER COLUMN worked SET NOT NULL;

COMMENT ON COLUMN public.build_reproductions.worked IS
  'Whether the build worked for this person. false records that it did not, which is a reproduction the page shows and the counter does not.';


-- =============================================================================
-- 3. result — no longer written
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'build_reproductions' AND column_name = 'result'
  ) THEN
    ALTER TABLE public.build_reproductions ALTER COLUMN result DROP NOT NULL;
    COMMENT ON COLUMN public.build_reproductions.result IS
      'Superseded by worked. Not part of the NS-P17 design and not written by src/lib/build/signals.ts. Kept nullable rather than dropped.';
  END IF;
END $$;


-- =============================================================================
-- 4. The read this table exists to serve
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_build_reproductions_build_confirmed
  ON public.build_reproductions (build_id, confirmed_at DESC);


-- =============================================================================
-- 5. The trust signal trigger
-- =============================================================================
-- Recompute, never increment. Three ways the header can go wrong under an
-- incrementing counter, all of which this avoids:
--
--   a row is deleted        -> count must fall and the timestamp may move back
--   worked flips to false   -> the same, without any row disappearing
--   confirmed_at is updated -> the newest working row may change identity
CREATE OR REPLACE FUNCTION public.refresh_build_reproduction_signals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- an UPDATE that moves a row between builds leaves two headers stale, so
  -- this is a set rather than a single id
  _build_ids UUID[];
  _build_id  UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _build_ids := ARRAY[NEW.build_id];
  ELSIF TG_OP = 'DELETE' THEN
    _build_ids := ARRAY[OLD.build_id];
  ELSIF NEW.build_id IS DISTINCT FROM OLD.build_id THEN
    _build_ids := ARRAY[NEW.build_id, OLD.build_id];
  ELSE
    _build_ids := ARRAY[NEW.build_id];
  END IF;

  FOREACH _build_id IN ARRAY _build_ids
  LOOP
    UPDATE public.builds b
    SET reproduction_count   = COALESCE(s.total, 0),
        last_confirmed_at    = s.latest_at,
        last_confirmed_model = s.latest_model
    FROM (
      SELECT
        count(*)::INTEGER      AS total,
        max(r.confirmed_at)    AS latest_at,
        -- the model of the most recent WORKING row, not of the row that fired
        -- this trigger. id breaks a timestamp tie so the answer is stable.
        (
          SELECT r2.model_used
          FROM public.build_reproductions r2
          WHERE r2.build_id = _build_id
            AND r2.worked
          ORDER BY r2.confirmed_at DESC, r2.id DESC
          LIMIT 1
        )                      AS latest_model
      FROM public.build_reproductions r
      WHERE r.build_id = _build_id
        AND r.worked
    ) s
    WHERE b.id = _build_id;
  END LOOP;

  RETURN NULL;
END;
$$;

-- The superseded one goes first: leaving both attached would have them race to
-- write the same three columns from two different definitions of "counted".
DROP TRIGGER IF EXISTS trg_build_reproductions_change ON public.build_reproductions;
DROP FUNCTION IF EXISTS public.handle_reproduction_change();

-- AFTER, and row-level: the aggregate has to see the committed state of the
-- table, and DELETE needs the row gone before the recount runs.
DROP TRIGGER IF EXISTS trg_build_reproduction_signals ON public.build_reproductions;
CREATE TRIGGER trg_build_reproduction_signals
AFTER INSERT OR UPDATE OR DELETE ON public.build_reproductions
FOR EACH ROW EXECUTE FUNCTION public.refresh_build_reproduction_signals();


-- =============================================================================
-- 6. Bring the affected headers into step with the new definition
-- =============================================================================
-- The trigger only fires on write. Without this, a build whose counters were
-- last computed by the old trigger keeps those numbers until someone happens
-- to record a reproduction of it — and the two definitions disagree, because
-- the old one counted 'partial' rows the same as 'success' and this one counts
-- `worked`.
--
-- SCOPED TO BUILDS THAT HAVE A REPRODUCTION ROW, deliberately. last_confirmed_at
-- and last_confirmed_model are also written directly by recordSelfConfirmation
-- — the creator saying their own build still works — which never touches this
-- table. Recomputing across all builds would erase those, on exactly the builds
-- that have no reproduction to restore them from. A build with reproductions
-- has always had them overwritten by the trigger, so nothing is lost there that
-- the next write would not have taken anyway.
--
-- The FILTER clauses do the counting rather than a WHERE, so a build whose
-- reproductions are now all worked = false is still selected — and correctly
-- reset to zero, rather than left holding a count the old trigger gave it.
UPDATE public.builds b
SET reproduction_count   = s.total,
    last_confirmed_at    = s.latest_at,
    last_confirmed_model = s.latest_model
FROM (
  SELECT
    r.build_id,
    count(*) FILTER (WHERE r.worked)::INTEGER   AS total,
    max(r.confirmed_at) FILTER (WHERE r.worked) AS latest_at,
    (
      SELECT r2.model_used
      FROM public.build_reproductions r2
      WHERE r2.build_id = r.build_id
        AND r2.worked
      ORDER BY r2.confirmed_at DESC, r2.id DESC
      LIMIT 1
    )                                           AS latest_model
  FROM public.build_reproductions r
  GROUP BY r.build_id
) s
WHERE b.id = s.build_id;
