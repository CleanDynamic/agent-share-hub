ALTER TABLE public.content_items
ADD COLUMN post_type TEXT NOT NULL DEFAULT 'blueprint';

ALTER TABLE public.content_items
ADD CONSTRAINT content_items_post_type_check
CHECK (post_type IN ('blueprint', 'blog', 'bounty'));

UPDATE public.content_items SET post_type = 'blueprint' WHERE post_type IS NULL OR post_type NOT IN ('blueprint', 'blog', 'bounty');

CREATE INDEX IF NOT EXISTS idx_content_items_post_type ON public.content_items(post_type);