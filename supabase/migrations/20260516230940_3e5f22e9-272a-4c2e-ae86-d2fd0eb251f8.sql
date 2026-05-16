
-- ============================================================
-- Reblog notifications + reports + soft-hide
-- ============================================================

-- 1. Add soft-hide + report_count to reblogs
ALTER TABLE public.reblogs
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS report_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_reblogs_hidden_at ON public.reblogs(hidden_at);

-- 2. reblog_reports table
CREATE TABLE IF NOT EXISTS public.reblog_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reblog_id uuid NOT NULL REFERENCES public.reblogs(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text,
  status text NOT NULL DEFAULT 'pending', -- pending | reviewed | dismissed
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reblog_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_reblog_reports_reblog ON public.reblog_reports(reblog_id);
CREATE INDEX IF NOT EXISTS idx_reblog_reports_status ON public.reblog_reports(status);

ALTER TABLE public.reblog_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporter can insert own report"
  ON public.reblog_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Reporter can read own reports"
  ON public.reblog_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "Admin can update reports"
  ON public.reblog_reports FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admin can delete reports"
  ON public.reblog_reports FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

-- 3. Soft-hide trigger: when report_count >= 3, set hidden_at
CREATE OR REPLACE FUNCTION public.reblog_reports_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _new_count int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.reblogs
       SET report_count = report_count + 1
     WHERE id = NEW.reblog_id
     RETURNING report_count INTO _new_count;
    IF _new_count >= 3 THEN
      UPDATE public.reblogs
         SET hidden_at = COALESCE(hidden_at, now())
       WHERE id = NEW.reblog_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.reblogs
       SET report_count = GREATEST(report_count - 1, 0)
     WHERE id = OLD.reblog_id;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS reblog_reports_sync_trg ON public.reblog_reports;
CREATE TRIGGER reblog_reports_sync_trg
  AFTER INSERT OR DELETE ON public.reblog_reports
  FOR EACH ROW EXECUTE FUNCTION public.reblog_reports_sync();

-- 4. Tighten public read on reblogs to exclude hidden (owner can still see)
DROP POLICY IF EXISTS "Public can view active reblogs" ON public.reblogs;
DROP POLICY IF EXISTS "Public can view reblogs" ON public.reblogs;

CREATE POLICY "Public can view non-hidden active reblogs"
  ON public.reblogs FOR SELECT TO public
  USING (
    deleted_at IS NULL
    AND (hidden_at IS NULL OR reblogger_id = auth.uid() OR is_admin(auth.uid()))
  );

-- 5. Notification trigger on reblog insert
CREATE OR REPLACE FUNCTION public.notify_on_reblog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _recipient uuid;
  _notif_type text;
  _post_type text;
  _snippet text;
BEGIN
  -- Skip self-reblogs entirely
  IF NEW.is_self_reblog THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_reblog_id IS NULL THEN
    -- Reblog of an original post → notify the post author
    SELECT creator_id, post_type INTO _recipient, _post_type
      FROM public.content_items WHERE id = NEW.original_post_id;
    _notif_type := 'post_reblogged';
  ELSE
    -- Reblog of a reblog → notify only the previous reblogger
    SELECT reblogger_id INTO _recipient
      FROM public.reblogs WHERE id = NEW.parent_reblog_id;
    _notif_type := 'reblog_reblogged';
    _post_type := 'reblog';
  END IF;

  IF _recipient IS NULL OR _recipient = NEW.reblogger_id THEN
    RETURN NEW;
  END IF;

  _snippet := LEFT(COALESCE(NEW.text, ''), 140);

  INSERT INTO public.notifications
    (recipient_id, actor_id, notification_type, target_type, target_id, metadata)
  VALUES (
    _recipient,
    NEW.reblogger_id,
    _notif_type,
    'blueprint',  -- closest existing enum value for routing
    NEW.original_post_id,
    jsonb_build_object(
      'reblog_id', NEW.id,
      'reblog_slug', NEW.slug,
      'snippet', _snippet,
      'post_type', _post_type,
      'parent_reblog_id', NEW.parent_reblog_id
    )
  );

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS notify_on_reblog_trg ON public.reblogs;
CREATE TRIGGER notify_on_reblog_trg
  AFTER INSERT ON public.reblogs
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_reblog();
