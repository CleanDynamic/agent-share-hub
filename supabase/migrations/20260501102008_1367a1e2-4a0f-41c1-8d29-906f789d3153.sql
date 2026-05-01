-- 1) NOTIFICATIONS additive fields
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS body        text,
  ADD COLUMN IF NOT EXISTS target_type text,
  ADD COLUMN IF NOT EXISTS target_id   uuid,
  ADD COLUMN IF NOT EXISTS read_at     timestamptz;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_target_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_target_type_check
  CHECK (target_type IS NULL OR target_type IN
    ('blueprint','blog','bounty','stage','block','comment','message','thread','profile'));

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON public.notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications (recipient_id, is_read);

CREATE OR REPLACE FUNCTION public.sync_notification_read_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_read = true AND NEW.read_at IS NULL THEN NEW.read_at := now(); END IF;
  IF NEW.is_read = false THEN NEW.read_at := NULL; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_notification_read_at ON public.notifications;
CREATE TRIGGER trg_sync_notification_read_at
  BEFORE INSERT OR UPDATE OF is_read ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.sync_notification_read_at();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Recipients can read own notifications"   ON public.notifications;
DROP POLICY IF EXISTS "Recipients can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Recipients can delete own notifications" ON public.notifications;
CREATE POLICY "Recipients can read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Recipients can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());
CREATE POLICY "Recipients can delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (recipient_id = auth.uid());

-- 2) COLLECTIONS additive fields + default uniqueness
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '#9CA3AF',
  ADD COLUMN IF NOT EXISTS is_default   boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_collections_one_default_per_owner
  ON public.collections (owner_id) WHERE is_default = true;

-- 3) COLLECTION_ITEMS generic columns
ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS item_kind   text,
  ADD COLUMN IF NOT EXISTS item_id     uuid,
  ADD COLUMN IF NOT EXISTS cached_meta jsonb;

ALTER TABLE public.collection_items
  DROP CONSTRAINT IF EXISTS collection_items_item_kind_check;
ALTER TABLE public.collection_items
  ADD CONSTRAINT collection_items_item_kind_check
  CHECK (item_kind IS NULL OR item_kind IN ('blueprint','blog','bounty','stage','block'));

UPDATE public.collection_items
   SET item_id = content_id,
       item_kind = COALESCE(item_kind, 'blueprint')
 WHERE item_id IS NULL AND content_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_collection_items_kind_id
  ON public.collection_items (collection_id, item_kind, item_id)
  WHERE item_kind IS NOT NULL AND item_id IS NOT NULL;

-- 4) Auto-create default "Saved items" collection
CREATE OR REPLACE FUNCTION public.create_default_collection_for_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.collections (owner_id, title, is_default, is_public, visibility, accent_color)
  VALUES (NEW.id, 'Saved items', true, false, 'private', '#9CA3AF')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_create_default_collection ON public.profiles;
CREATE TRIGGER trg_create_default_collection
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_default_collection_for_user();

-- Backfill for existing users
INSERT INTO public.collections (owner_id, title, is_default, is_public, visibility, accent_color)
SELECT p.id, 'Saved items', true, false, 'private', '#9CA3AF'
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.collections c
  WHERE c.owner_id = p.id AND c.is_default = true
);