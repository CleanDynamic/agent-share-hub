
-- Make content-files bucket private
UPDATE storage.buckets SET public = false WHERE id = 'content-files';

-- Remove the public SELECT policy
DROP POLICY IF EXISTS "Anyone can read content files" ON storage.objects;

-- Replace with authenticated-only read via signed URLs
CREATE POLICY "Authenticated users can read content files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'content-files');
