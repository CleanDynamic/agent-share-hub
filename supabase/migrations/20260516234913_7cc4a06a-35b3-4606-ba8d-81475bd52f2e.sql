-- Phase 15.1: quoted-excerpt reblogs
ALTER TABLE public.reblogs
  ADD COLUMN IF NOT EXISTS excerpt_text TEXT,
  ADD COLUMN IF NOT EXISTS excerpt_source_block_id UUID REFERENCES public.content_blocks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS excerpt_source_block_type_label TEXT,
  ADD COLUMN IF NOT EXISTS excerpt_text_hash TEXT;

-- Length validation via trigger (CHECK constraints stay immutable-friendly)
CREATE OR REPLACE FUNCTION public.validate_reblog_excerpt()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.excerpt_text IS NOT NULL THEN
    IF char_length(NEW.excerpt_text) < 4 OR char_length(NEW.excerpt_text) > 2000 THEN
      RAISE EXCEPTION 'Reblog excerpt_text must be between 4 and 2000 characters';
    END IF;
    IF NEW.original_post_id IS NULL THEN
      RAISE EXCEPTION 'Excerpt reblog must reference a source post';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_reblog_excerpt ON public.reblogs;
CREATE TRIGGER trg_validate_reblog_excerpt
  BEFORE INSERT OR UPDATE ON public.reblogs
  FOR EACH ROW EXECUTE FUNCTION public.validate_reblog_excerpt();

CREATE INDEX IF NOT EXISTS idx_reblogs_excerpt_source_block
  ON public.reblogs(excerpt_source_block_id)
  WHERE excerpt_source_block_id IS NOT NULL;