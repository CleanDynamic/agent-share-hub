-- Create the content-results storage bucket with public read access
INSERT INTO storage.buckets (id, name, public)
VALUES ('content-results', 'content-results', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for content-results bucket
CREATE POLICY "Result media is publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'content-results');

CREATE POLICY "Authenticated users can upload result media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'content-results' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own result media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'content-results' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own result media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'content-results' AND auth.uid()::text = (storage.foldername(name))[1]);