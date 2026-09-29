-- =============================================================================
-- RC-P20 — a message can carry a build
-- =============================================================================
-- WHAT IT ADDS. The clear emptied dm_messages.shared_content_id and
-- dm_threads.pinned_content_id and kept every message; nothing let a message
-- point at a build. Two nullable columns do:
--
--   dm_messages.shared_build_id   the build a message carries
--   dm_threads.pinned_build_id    a build pinned to a conversation
--
-- ON DELETE SET NULL, as the content links were: a deleted build leaves the
-- message and its words, and the message draws its text alone.
--
-- A BUILD MESSAGE IS A TEXT MESSAGE (kind 'text') whose shared_build_id is set,
-- so neither dm_messages' kind check nor its shared_content_type check changes,
-- and no policy changes: whoever may send and read a message in a thread may
-- send and read this one. What the build shows is decided by the builds read
-- policy, under the reader's own rights, when the card is drawn.
--
-- Each column is indexed where it is set ⟦supabase-postgres-best-practices ›
-- references/schema-foreign-key-indexes.md; references/query-partial-indexes.md⟧:
-- almost no message carries a build, and the index serves the cascade.
-- =============================================================================

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
