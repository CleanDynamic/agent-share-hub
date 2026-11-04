-- UX-04: media on topics and replies lives in the private build-media bucket, under its own prefix.
--
-- Correct whether or not any of it already exists.

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