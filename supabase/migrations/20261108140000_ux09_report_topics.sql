-- UX-09 P8: a reader can report a topic or a reply.
--
-- content_reports.target_type (RC-P17b, 20261001190000) takes 'openbuild_post' beside 'build' and 'comment': target_id is then an
-- openbuild_posts id (a topic or a reply). Reports go where they go today, the site's moderation (the admin queue), not a space's.
-- The insert and read policies are unchanged.
--
-- resolve_report: 'dismiss' closes a topic's report as it closes any. 'hide' on a topic or a reply is REFUSED with plain words.
-- Hiding a topic is the space moderators' act (openbuild_posts.hidden_by, guarded by posts_guard_update, which lets only the
-- topic's author or a moderator of its space hide); this file does not widen that guard to admins. Before, every target that was
-- not a build fell through to build_comments; that ELSE is now ELSIF 'comment', so a topic's id can never reach build_comments.
--
-- Correct whether or not any of it already exists. No new read and no new index: the queue's read is the existing partial index
-- on open reports, and a topic's summary is read by primary key.

-- 1. The check, found in the catalogue whatever it was named.
DO $$
DECLARE
  _name text;
BEGIN
  FOR _name IN
    SELECT c.conname
      FROM pg_constraint c
     WHERE c.conrelid = 'public.content_reports'::regclass
       AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) ILIKE '%target_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.content_reports DROP CONSTRAINT %I', _name);
  END LOOP;
END;
$$;

ALTER TABLE public.content_reports
  ADD CONSTRAINT content_reports_target_type_check CHECK (target_type IN ('build', 'comment', 'openbuild_post'));

-- 2. resolve_report, as RC-P17b wrote it, with the comment branch named and a topic's hide refused.
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
    ELSIF _target_type = 'comment' THEN
      UPDATE public.build_comments SET is_hidden = true WHERE id = _target_id;
    ELSE
      RAISE EXCEPTION 'A topic or reply is hidden by its space''s moderators. Dismiss the report here.' USING ERRCODE = 'P0001';
    END IF;

    -- Every open report on this target is answered by the same act.
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
  'RC-P17b, UX-09 P8. Admin only (raises "not allowed" otherwise). hide: sets the reported build or comment is_hidden and closes every open report on it as hidden (refused, in words, for a topic or reply: its space''s moderators hide it); dismiss: closes this report as dismissed. Both stamp resolved_at and resolved_by.';

REVOKE ALL ON FUNCTION public.resolve_report(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_report(uuid, text) TO authenticated;
