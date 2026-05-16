-- Soft delete RPC for primitive_comments
CREATE OR REPLACE FUNCTION public.soft_delete_primitive_comment(_comment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_delete_primitive_comment(_comment_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to delete this comment';
  END IF;
  UPDATE public.primitive_comments
     SET deleted_at = now()
   WHERE id = _comment_id AND deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_primitive_comment(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.soft_delete_primitive_comment(uuid) TO authenticated;