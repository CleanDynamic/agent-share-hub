
-- Create storage buckets for DM media
INSERT INTO storage.buckets (id, name, public) VALUES ('dm-images', 'dm-images', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('dm-voice', 'dm-voice', false);

-- RLS policies for dm-images bucket
CREATE POLICY "Users can upload DM images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'dm-images' AND (storage.foldername(name))[1] IN (
  SELECT id::text FROM dm_threads
  WHERE participant_a = auth.uid() OR participant_b = auth.uid()
));

CREATE POLICY "Users can view DM images in their threads"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'dm-images' AND (storage.foldername(name))[1] IN (
  SELECT id::text FROM dm_threads
  WHERE participant_a = auth.uid() OR participant_b = auth.uid()
));

-- RLS policies for dm-voice bucket
CREATE POLICY "Users can upload DM voice"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'dm-voice' AND (storage.foldername(name))[1] IN (
  SELECT id::text FROM dm_threads
  WHERE participant_a = auth.uid() OR participant_b = auth.uid()
));

CREATE POLICY "Users can view DM voice in their threads"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'dm-voice' AND (storage.foldername(name))[1] IN (
  SELECT id::text FROM dm_threads
  WHERE participant_a = auth.uid() OR participant_b = auth.uid()
));
