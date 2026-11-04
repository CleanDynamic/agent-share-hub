-- UX-04: media on topics and replies lives in the private build-media bucket, under its own prefix.
--
-- No new bucket. A topic's or reply's picture, video or file is an object in build-media at
--     entries/<author id>/<uuid>.<ext>
-- The bucket's existing rules are by build (the first folder is a build id) and refuse this prefix, so these policies add it. They
-- change nothing about the existing ones; Postgres ORs policies.
--
--   upload, replace, remove   the author, only under entries/<their own id>/
--   read                      the author; and anyone who can read an entry that attaches the object (openbuild_posts' own policies
--                             decide, so an object on a hidden entry is read by the people who can read the entry). Signed URLs are
--                             made through signedMediaUrl as for every other build-media object.
--
-- THE ATTACHMENT RULE is in the authorship trigger (20261107140000): media_path must start entries/<author id>/.
--
-- NOT DONE HERE: a build_media row. That table is a build's (build_id NOT NULL, read through the build), and an entry may have no build.
-- The attachment row holds the path, which is all a signed URL needs. See the report.
--
-- Correct whether or not any of it already exists.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied:
--   1. The read check for one object:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT 1 FROM public.post_attachments WHERE media_path = 'entries/<author id>/<uuid>.png' LIMIT 1;
--      SHOULD SHOW: an Index Scan on idx_post_attachments_media_path, no Seq Scan on post_attachments.

CREATE INDEX IF NOT EXISTS idx_post_attachments_media_path ON public.post_attachments (media_path) WHERE media_path IS NOT NULL;

DROP POLICY IF EXISTS "Authors upload entry media" ON storage.objects;
CREATE POLICY "Authors upload entry media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'build-media'
    AND (storage.foldername(name))[1] = 'entries'
    AND (storage.foldername(name))[2] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "Authors replace entry media" ON storage.objects;
CREATE POLICY "Authors replace entry media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'build-media'
    AND (storage.foldername(name))[1] = 'entries'
    AND (storage.foldername(name))[2] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "Authors remove entry media" ON storage.objects;
CREATE POLICY "Authors remove entry media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'build-media'
    AND (storage.foldername(name))[1] = 'entries'
    AND (storage.foldername(name))[2] = (select auth.uid())::text
  );

DROP POLICY IF EXISTS "Entry media follows its entry" ON storage.objects;
CREATE POLICY "Entry media follows its entry"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'build-media'
    AND (storage.foldername(name))[1] = 'entries'
    AND (
      (storage.foldername(name))[2] = (select auth.uid())::text
      OR EXISTS (SELECT 1 FROM public.post_attachments a WHERE a.media_path = storage.objects.name)
    )
  );
