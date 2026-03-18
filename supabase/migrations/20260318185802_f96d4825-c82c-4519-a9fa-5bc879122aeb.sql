ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url text;

-- Create profile-assets storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-assets', 'profile-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can view files
CREATE POLICY "Public can view profile assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-assets');

-- RLS: authenticated users can upload their own files
CREATE POLICY "Users can upload own profile assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: users can update their own files
CREATE POLICY "Users can update own profile assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: users can delete their own files
CREATE POLICY "Users can delete own profile assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);