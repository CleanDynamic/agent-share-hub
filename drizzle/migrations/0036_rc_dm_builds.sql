ALTER TABLE public.dm_messages
  ADD COLUMN IF NOT EXISTS shared_build_id uuid NULL REFERENCES public.builds(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dm_messages_shared_build
  ON public.dm_messages (shared_build_id)
  WHERE shared_build_id IS NOT NULL;

ALTER TABLE public.dm_threads
  ADD COLUMN IF NOT EXISTS pinned_build_id uuid NULL REFERENCES public.builds(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dm_threads_pinned_build
  ON public.dm_threads (pinned_build_id)
  WHERE pinned_build_id IS NOT NULL;