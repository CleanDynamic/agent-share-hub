-- =============================================================================
-- NeoScale — build reproductions (NS-P17)
-- =============================================================================
-- Lets users say "I reproduced this build". Each row records who reproduced it,
-- which model/variant they used, what the result was, and an optional note.
-- A trigger on the table keeps the denormalized counters on the parent build
-- up to date so the gallery and feed never need to count rows.
-- =============================================================================


-- =============================================================================
-- 1. build_reproductions
-- =============================================================================
CREATE TABLE public.build_reproductions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id        UUID NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- model / tool the reproducer used
  model_used      TEXT NULL,
  -- overall result: success, partial, failure
  result          TEXT NOT NULL,
  -- free-text note about what happened
  note            TEXT NULL,
  -- optional cost/time metadata
  metadata        JSONB NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT build_reproductions_result_check
    CHECK (result IN ('success','partial','failure'))
);

-- One repro per user per build.
CREATE UNIQUE INDEX idx_build_reproductions_unique_user_build
  ON public.build_reproductions (build_id, user_id);


-- =============================================================================
-- 2. Indexes
-- =============================================================================
CREATE INDEX idx_build_reproductions_build
  ON public.build_reproductions (build_id, created_at DESC);

CREATE INDEX idx_build_reproductions_user
  ON public.build_reproductions (user_id, created_at DESC);


-- =============================================================================
-- 3. Row level security
-- =============================================================================
ALTER TABLE public.build_reproductions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reproductions are readable by build readers"
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

CREATE POLICY "Users create their own reproductions"
  ON public.build_reproductions FOR INSERT
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.builds b
      WHERE b.id = build_reproductions.build_id
        AND b.status = 'published'
    )
  );

CREATE POLICY "Users update their own reproductions"
  ON public.build_reproductions FOR UPDATE
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users and admins delete reproductions"
  ON public.build_reproductions FOR DELETE
  USING (
    user_id = (select auth.uid())
    OR public.is_admin((select auth.uid()))
  );


-- =============================================================================
-- 4. Grants
-- =============================================================================
GRANT SELECT ON public.build_reproductions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.build_reproductions TO authenticated;
GRANT ALL ON public.build_reproductions TO service_role;


-- =============================================================================
-- 5. Trigger: keep build reproduction counters up to date
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_reproduction_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_build_id UUID;
  new_count INT;
  latest_at TIMESTAMPTZ;
  latest_model TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_build_id := OLD.build_id;
  ELSE
    target_build_id := NEW.build_id;
  END IF;

  SELECT
    COUNT(*),
    MAX(created_at),
    (ARRAY_AGG(model_used ORDER BY created_at DESC))[1]
  INTO new_count, latest_at, latest_model
  FROM public.build_reproductions
  WHERE build_id = target_build_id
    AND result IN ('success','partial');

  UPDATE public.builds
  SET
    reproduction_count = COALESCE(new_count, 0),
    last_confirmed_at = latest_at,
    last_confirmed_model = latest_model
  WHERE id = target_build_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_build_reproductions_change
  AFTER INSERT OR UPDATE OR DELETE ON public.build_reproductions
  FOR EACH ROW EXECUTE FUNCTION public.handle_reproduction_change();