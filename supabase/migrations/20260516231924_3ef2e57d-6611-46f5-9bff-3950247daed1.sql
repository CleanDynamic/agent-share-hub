-- Extend dm_messages to support sharing reblogs
ALTER TABLE public.dm_messages
  DROP CONSTRAINT IF EXISTS dm_messages_shared_content_type_check;

ALTER TABLE public.dm_messages
  ADD CONSTRAINT dm_messages_shared_content_type_check
  CHECK (shared_content_type IS NULL OR shared_content_type = ANY (ARRAY['blueprint'::text, 'stage'::text, 'block'::text, 'reblog'::text]));

ALTER TABLE public.dm_messages
  ADD COLUMN IF NOT EXISTS shared_reblog_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'dm_messages_shared_reblog_id_fkey'
      AND table_name = 'dm_messages'
  ) THEN
    ALTER TABLE public.dm_messages
      ADD CONSTRAINT dm_messages_shared_reblog_id_fkey
      FOREIGN KEY (shared_reblog_id) REFERENCES public.reblogs(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS dm_messages_shared_reblog_idx
  ON public.dm_messages(shared_reblog_id)
  WHERE shared_reblog_id IS NOT NULL;