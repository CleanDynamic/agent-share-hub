
CREATE OR REPLACE FUNCTION public.increment_project_view_count(_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.projects
  SET view_count = view_count + 1
  WHERE id = _project_id;
END;
$$;
