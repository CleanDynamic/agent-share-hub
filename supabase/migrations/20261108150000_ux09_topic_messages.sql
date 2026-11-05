-- UX-09 Q4: a message can carry a topic.
--
-- "Message @maya" on a topic opens (or creates) the ONE direct thread between the reader and the topic's author and puts the topic in
-- it as a card, the way a build is shared (RC-P20, 20261001210000_rc_dm_builds.sql: dm_messages.shared_build_id). There is no thread
-- per topic and nothing is pinned to the thread: dm_threads and its pinned_content_type check are unchanged.
--
--   dm_messages.shared_post_id   the topic a message carries (an openbuild_posts id)
--
-- ON DELETE SET NULL, as shared_build_id is: a deleted topic leaves the message and its words, and the message draws its text alone.
--
-- A TOPIC MESSAGE IS A TEXT MESSAGE (kind 'text') whose shared_post_id is set, so neither dm_messages' kind check nor its
-- shared_content_type check changes, and no policy changes: whoever may send and read a message in a thread may send and read this
-- one. What the card shows is decided by openbuild_posts' read policy, under the reader's own rights, when the card is drawn: a
-- hidden topic draws no card.
--
-- Indexed where it is set: almost no message carries a topic, and the index serves the cascade.
--
-- Correct whether or not any of it already exists.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied (the cascade's lookup when a topic is deleted):
--   EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM public.dm_messages WHERE shared_post_id = '<a topic id>';
--   SHOULD SHOW: an Index Scan (or Bitmap Index Scan) on idx_dm_messages_shared_post, no Seq Scan on dm_messages.

ALTER TABLE public.dm_messages
  ADD COLUMN IF NOT EXISTS shared_post_id uuid NULL REFERENCES public.openbuild_posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dm_messages_shared_post
  ON public.dm_messages (shared_post_id)
  WHERE shared_post_id IS NOT NULL;

COMMENT ON COLUMN public.dm_messages.shared_post_id IS
  'UX-09. The topic (openbuild_posts) this message carries, drawn as a card under the reader''s own rights. Null for every other message.';
