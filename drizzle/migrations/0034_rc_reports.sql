ALTER TABLE public.builds
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Hidden builds are read by their creator and admins" ON public.builds;
CREATE POLICY "Hidden builds are read by their creator and admins"
  ON public.builds
  AS RESTRICTIVE
  FOR SELECT
  TO anon, authenticated
  USING (
    NOT is_hidden
    OR creator_id = (select auth.uid())
    OR public.is_admin((select auth.uid()))
  );

CREATE TABLE IF NOT EXISTS public.content_reports (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type text        NOT NULL CHECK (target_type IN ('build','comment')),
  target_id   uuid        NOT NULL,
  reporter_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      text        NOT NULL CHECK (reason IN ('spam','broken','harmful','stolen','other')),
  note        text        NULL CHECK (note IS NULL OR char_length(note) <= 500),
  status      text        NOT NULL DEFAULT 'open' CHECK (status IN ('open','hidden','dismissed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL,
  resolved_by uuid        NULL REFERENCES auth.users(id),
  UNIQUE (target_type, target_id, reporter_id),
  CONSTRAINT content_reports_reporter_profile_fkey
    FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_content_reports_open
  ON public.content_reports (status, created_at DESC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_content_reports_reporter
  ON public.content_reports (reporter_id);

CREATE INDEX IF NOT EXISTS idx_content_reports_resolved_by
  ON public.content_reports (resolved_by)
  WHERE resolved_by IS NOT NULL;

COMMENT ON TABLE public.content_reports IS
  'RC-P17b. A reader''s report of a build or a comment: one per (target, reporter), a reason from five, an optional note of at most 500 characters. Read by its reporter and admins; closed only through resolve_report.';

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Readers file reports as themselves" ON public.content_reports;
CREATE POLICY "Readers file reports as themselves"
  ON public.content_reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = (select auth.uid()));

DROP POLICY IF EXISTS "Reporters and admins read reports" ON public.content_reports;
CREATE POLICY "Reporters and admins read reports"
  ON public.content_reports FOR SELECT
  TO authenticated
  USING (
    reporter_id = (select auth.uid())
    OR public.is_admin((select auth.uid()))
  );

REVOKE ALL ON public.content_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.content_reports TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_report(report uuid, action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin       uuid := (select auth.uid());
  _target_type text;
  _target_id   uuid;
BEGIN
  IF _admin IS NULL OR NOT public.is_admin(_admin) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF action IS NULL OR action NOT IN ('hide', 'dismiss') THEN
    RAISE EXCEPTION 'resolve_report: action must be hide or dismiss' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT r.target_type, r.target_id INTO _target_type, _target_id
    FROM public.content_reports r
   WHERE r.id = report
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'resolve_report: no report %', report USING ERRCODE = 'no_data_found';
  END IF;

  IF action = 'hide' THEN
    IF _target_type = 'build' THEN
      UPDATE public.builds SET is_hidden = true WHERE id = _target_id;
    ELSE
      UPDATE public.build_comments SET is_hidden = true WHERE id = _target_id;
    END IF;

    UPDATE public.content_reports
       SET status = 'hidden', resolved_at = now(), resolved_by = _admin
     WHERE target_type = _target_type
       AND target_id = _target_id
       AND (id = report OR status = 'open');
  ELSE
    UPDATE public.content_reports
       SET status = 'dismissed', resolved_at = now(), resolved_by = _admin
     WHERE id = report;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.resolve_report(uuid, text) IS
  'RC-P17b. Admin only (raises "not allowed" otherwise). hide: sets the reported build or comment is_hidden and closes every open report on it as hidden; dismiss: closes this report as dismissed. Both stamp resolved_at and resolved_by.';

REVOKE ALL ON FUNCTION public.resolve_report(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_report(uuid, text) TO authenticated;