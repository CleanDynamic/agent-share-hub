ALTER TABLE public.import_sessions
  ADD COLUMN IF NOT EXISTS model TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.import_sessions'::regclass
      AND conname  = 'import_sessions_model_length_check'
  ) THEN
    ALTER TABLE public.import_sessions
      ADD CONSTRAINT import_sessions_model_length_check
      CHECK (model IS NULL OR char_length(model) <= 64);
  END IF;
END
$$;

COMMENT ON COLUMN public.import_sessions.model IS
  'The model version the session ran on, exactly as the client sent it (e.g. claude-sonnet-5-5). NULL when the client did not say. The app normalises it for display; this column is never rewritten to match.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'import_sessions'
      AND cmd IN ('UPDATE', 'ALL')
      AND roles && ARRAY['authenticated', 'public']::name[]
  ) THEN
    CREATE POLICY "Import sessions are updated by their owner"
      ON public.import_sessions FOR UPDATE
      TO authenticated
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END
$$;

GRANT UPDATE (model) ON public.import_sessions TO authenticated;

CREATE OR REPLACE FUNCTION public.expire_import_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _expired INTEGER;
BEGIN
  UPDATE public.import_sessions
  SET status     = 'expired',
      updated_at = now()
  WHERE expires_at < now()
    AND status IN ('open', 'assembling');

  GET DIAGNOSTICS _expired = ROW_COUNT;
  RETURN _expired;
END
$$;

COMMENT ON FUNCTION public.expire_import_sessions() IS
  'Nightly sweep: flips public.import_sessions past expires_at from open/assembling to expired. A parsed session is never swept: it stays its creator''s until they remove it (discardImport marks it expired) or claim it. Status only — it touches no storage. Returns the number of rows flipped.';

REVOKE ALL ON FUNCTION public.expire_import_sessions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_import_sessions() FROM anon, authenticated, service_role;

ALTER TABLE public.builds
  ADD COLUMN IF NOT EXISTS session_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prompt_count  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_turn_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS models_used   TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS making        JSONB   NOT NULL DEFAULT '{}'::jsonb;

DO $$
DECLARE
  _c RECORD;
BEGIN
  FOR _c IN
    SELECT * FROM (VALUES
      ('builds_session_count_check',  'CHECK (session_count >= 0)'),
      ('builds_prompt_count_check',   'CHECK (prompt_count >= 0)'),
      ('builds_ai_turn_count_check',  'CHECK (ai_turn_count >= 0)'),
      ('builds_making_object_check',  'CHECK (jsonb_typeof(making) = ''object'')')
    ) AS v(name, ddl)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.builds'::regclass AND conname = _c.name
    ) THEN
      EXECUTE format('ALTER TABLE public.builds ADD CONSTRAINT %I %s', _c.name, _c.ddl);
    END IF;
  END LOOP;
END
$$;

COMMENT ON COLUMN public.builds.session_count IS
  'How many AI sessions this build was made from. Written by its creator (refreshMakingStats); readable wherever the build is.';
COMMENT ON COLUMN public.builds.prompt_count IS
  'Prompts across those sessions (user turns). Written by its creator.';
COMMENT ON COLUMN public.builds.ai_turn_count IS
  'AI turns across those sessions (user turns plus assistant turns). Written by its creator.';
COMMENT ON COLUMN public.builds.models_used IS
  'Normalised model names across those sessions, e.g. {"Sonnet 5.5"}. Written by its creator.';
COMMENT ON COLUMN public.builds.making IS
  'Counts, client and model names only, never conversation text: {"sessions":[{"client":"claude-code","model":"Sonnet 5.5","prompts":9,"turns":38}],"excluded_models":[]}. Written by its creator.';