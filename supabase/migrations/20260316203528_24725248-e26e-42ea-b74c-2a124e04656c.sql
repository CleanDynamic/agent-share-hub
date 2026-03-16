
-- RPC to atomically increment download count
CREATE OR REPLACE FUNCTION public.increment_download_count(_content_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.content_items
  SET download_count = download_count + 1
  WHERE id = _content_id;
END;
$$;
