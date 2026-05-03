CREATE TABLE public.content_item_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_item_id UUID NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('photo', 'video', 'written')),
  media_url TEXT,
  text_content TEXT,
  caption TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_item_results_item_position
  ON public.content_item_results (content_item_id, position);

ALTER TABLE public.content_item_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view results of approved content"
  ON public.content_item_results FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.content_items ci
    WHERE ci.id = content_item_id
      AND (ci.status = 'approved' OR ci.creator_id = auth.uid() OR is_admin(auth.uid()))
  ));

CREATE POLICY "Creators can insert own results"
  ON public.content_item_results FOR INSERT
  WITH CHECK (content_item_id IN (
    SELECT id FROM public.content_items WHERE creator_id = auth.uid()
  ));

CREATE POLICY "Creators can update own results"
  ON public.content_item_results FOR UPDATE
  USING (content_item_id IN (
    SELECT id FROM public.content_items WHERE creator_id = auth.uid()
  ));

CREATE POLICY "Creators can delete own results"
  ON public.content_item_results FOR DELETE
  USING (content_item_id IN (
    SELECT id FROM public.content_items WHERE creator_id = auth.uid()
  ));

INSERT INTO public.content_item_results
  (content_item_id, kind, media_url, caption, position, created_at)
SELECT
  ci.id,
  'photo',
  url,
  CASE WHEN ord = 1 THEN ci.evidence_caption ELSE NULL END,
  (ord - 1)::int,
  COALESCE(ci.published_at, ci.created_at)
FROM public.content_items ci,
     LATERAL unnest(ci.evidence_media_urls) WITH ORDINALITY AS u(url, ord)
WHERE ci.evidence_media_type = 'photos'
  AND ci.evidence_media_urls IS NOT NULL
  AND array_length(ci.evidence_media_urls, 1) > 0;

INSERT INTO public.content_item_results
  (content_item_id, kind, media_url, caption, position, created_at)
SELECT
  ci.id, 'video', ci.evidence_media_urls[1], ci.evidence_caption, 0,
  COALESCE(ci.published_at, ci.created_at)
FROM public.content_items ci
WHERE ci.evidence_media_type = 'video'
  AND ci.evidence_media_urls IS NOT NULL
  AND array_length(ci.evidence_media_urls, 1) > 0;

INSERT INTO public.content_item_results
  (content_item_id, kind, text_content, caption, position, created_at)
SELECT
  ci.id, 'written', ci.evidence_caption, NULL, 0,
  COALESCE(ci.published_at, ci.created_at)
FROM public.content_items ci
WHERE ci.evidence_media_type = 'written'
  AND COALESCE(ci.evidence_caption, '') <> '';