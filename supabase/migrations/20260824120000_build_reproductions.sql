-- =============================================================================
-- NeoScale — reproductions and the trust signals they maintain (NS-P17)
-- =============================================================================
-- One table and one trigger.
--
-- build_reproductions is the record of someone OTHER than the creator running
-- a build and saying whether it worked. That is the whole point of the metric:
-- it cannot be self-served, so the exclusion is enforced in the insert and
-- update policies rather than left to the client.
--
-- The trigger keeps three denormalised columns on builds — reproduction_count,
-- last_confirmed_at and last_confirmed_model, all created by NS-P01 — in step
-- with this table. It RECOMPUTES from the table rather than incrementing a
-- counter, so a deleted row or a `worked` flipped to false corrects the header
-- instead of stranding it.
--
-- SIDE EFFECT WORTH KNOWING: builds already carries the BEFORE UPDATE trigger
-- trg_builds_updated_at, so a reproduction recorded by a stranger bumps
-- builds.updated_at. Nothing reads that column as an edit marker today — it
-- exists for draft autosave — but a future "last edited" line must not take it
-- at face value.
--
-- This migration adds a table, an index, policies, grants, one function and
-- one trigger. It alters no existing table, function or policy.
-- =============================================================================


-- =============================================================================
-- 1. build_reproductions
-- =============================================================================
-- One row per (build, person). Re-running a build later updates that row
-- rather than adding a second one, which is what the unique constraint is for:
-- reproduction_count counts people, not attempts.
CREATE TABLE public.build_reproductions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id      UUID NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  confirmed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- the model they actually ran it on, which is often not the one the creator
  -- used. NULL means they did not say — never guess one downstream.
  model_used    TEXT NULL,
  worked        BOOLEAN NOT NULL DEFAULT true,
  note          TEXT NULL,

  CONSTRAINT build_reproductions_once_per_person UNIQUE (build_id, user_id)
);


-- =============================================================================
-- 2. Index
-- =============================================================================
-- The read this table exists to serve: the most recent reproductions of one
-- build, newest first.
CREATE INDEX idx_build_reproductions_build_confirmed
  ON public.build_reproductions (build_id, confirmed_at DESC);


-- =============================================================================
-- 3. Row level security
-- =============================================================================
-- Every current-user call is wrapped as (select auth.uid()) so Postgres
-- evaluates it once per statement rather than once per row.

ALTER TABLE public.build_reproductions ENABLE ROW LEVEL SECURITY;

-- Readable by anyone who can read the parent build — the same three-way test
-- the builds SELECT policy applies.
CREATE POLICY "Reproductions follow build readability"
  ON public.build_reproductions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_reproductions.build_id
        AND (
          b.status <> 'draft'
          OR b.creator_id = (select auth.uid())
          OR public.is_admin((select auth.uid()))
        )
    )
  );

-- Writable only as yourself, and only against someone else's build. The
-- creator exclusion lives here rather than in the client because a signal that
-- a creator can award themselves is not a signal.
CREATE POLICY "Users record reproductions of builds that are not their own"
  ON public.build_reproductions FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_reproductions.build_id
        AND b.creator_id <> (select auth.uid())
        AND (
          b.status <> 'draft'
          OR public.is_admin((select auth.uid()))
        )
    )
  );

-- WITH CHECK repeats the creator test so an update cannot walk a row onto a
-- build the actor owns, and cannot reassign it to another person.
CREATE POLICY "Users update their own reproductions"
  ON public.build_reproductions FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_reproductions.build_id
        AND b.creator_id <> (select auth.uid())
    )
  );

-- Withdrawing a reproduction has to be possible for the counter to be honest,
-- and the trigger below is what makes withdrawal correct the header.
CREATE POLICY "Users delete their own reproductions"
  ON public.build_reproductions FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));


-- =============================================================================
-- 4. Grants — RLS above is what actually gates access
-- =============================================================================
GRANT SELECT ON public.build_reproductions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.build_reproductions TO authenticated;
GRANT ALL ON public.build_reproductions TO service_role;


-- =============================================================================
-- 5. The trust signal trigger
-- =============================================================================
-- Recompute, never increment. Three ways the header can go wrong under an
-- incrementing counter, all of which this avoids:
--
--   a row is deleted        -> count must fall and the timestamp may move back
--   worked flips to false   -> the same, without any row disappearing
--   confirmed_at is updated -> the newest working row may change identity
--
-- SECURITY DEFINER because the person recording the reproduction is by
-- definition NOT the build's creator, and the builds UPDATE policy admits only
-- the creator and admins. The function writes exactly three columns of one
-- row, keyed by a build id it read from the reproduction row itself.
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

-- AFTER, and row-level: the aggregate has to see the committed state of the
-- table, and DELETE needs the row gone before the recount runs.
CREATE TRIGGER trg_build_reproduction_signals
AFTER INSERT OR UPDATE OR DELETE ON public.build_reproductions
FOR EACH ROW EXECUTE FUNCTION public.refresh_build_reproduction_signals();
