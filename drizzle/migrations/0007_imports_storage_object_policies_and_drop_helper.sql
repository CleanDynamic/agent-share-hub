CREATE POLICY "Import objects are readable by their owner"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'imports'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY "Import objects are written by their owner"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'imports'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY "Import objects are updated by their owner"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'imports'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'imports'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

CREATE POLICY "Import objects are deleted by their owner"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'imports'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

DROP FUNCTION IF EXISTS public.__tmp_apply_migration(TEXT);