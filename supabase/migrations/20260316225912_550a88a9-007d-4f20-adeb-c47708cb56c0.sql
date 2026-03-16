
CREATE OR REPLACE FUNCTION public.increment_content_view_count(_content_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.content_items
  SET view_count = view_count + 1
  WHERE id = _content_id;
END;
$$;
