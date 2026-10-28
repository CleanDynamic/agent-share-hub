ALTER TABLE public.build_nodes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.build_nodes SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE public.build_nodes ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE public.build_nodes ALTER COLUMN updated_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.build_nodes_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.type, NEW.title, NEW.note, NEW.payload) IS DISTINCT FROM (OLD.type, OLD.title, OLD.note, OLD.payload) THEN
    NEW.updated_at := now();
  ELSE
    NEW.updated_at := OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.build_nodes_touch_updated_at() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_build_nodes_touch_updated_at ON public.build_nodes;
CREATE TRIGGER trg_build_nodes_touch_updated_at
  BEFORE UPDATE ON public.build_nodes
  FOR EACH ROW EXECUTE FUNCTION public.build_nodes_touch_updated_at();

COMMENT ON COLUMN public.build_nodes.updated_at IS
  'SV-19. When the node''s type, title, note or payload last changed. Moving it does not change it.';