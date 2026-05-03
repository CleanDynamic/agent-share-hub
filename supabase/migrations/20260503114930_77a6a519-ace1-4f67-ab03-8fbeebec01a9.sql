
INSERT INTO storage.buckets (id, name, public) VALUES ('ai-pdfs', 'ai-pdfs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "ai-pdfs public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'ai-pdfs');
