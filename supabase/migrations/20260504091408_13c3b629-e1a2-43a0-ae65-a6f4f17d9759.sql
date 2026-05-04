-- Sequential bounty id starting at 1000, populated on insert via trigger.
CREATE SEQUENCE IF NOT EXISTS public.bounty_sequential_id_seq START 1000 INCREMENT 1;

ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS bounty_sequential_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_items_bounty_seq
  ON public.content_items(bounty_sequential_id)
  WHERE bounty_sequential_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assign_bounty_sequential_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.post_type = 'bounty' AND NEW.bounty_sequential_id IS NULL THEN
    NEW.bounty_sequential_id := nextval('public.bounty_sequential_id_seq');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_bounty_sequential_id ON public.content_items;
CREATE TRIGGER trg_assign_bounty_sequential_id
  BEFORE INSERT ON public.content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_bounty_sequential_id();

-- Backfill existing bounties (oldest first, so newer get higher numbers).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM public.content_items
    WHERE post_type = 'bounty' AND bounty_sequential_id IS NULL
    ORDER BY created_at ASC
  LOOP
    UPDATE public.content_items
      SET bounty_sequential_id = nextval('public.bounty_sequential_id_seq')
      WHERE id = r.id;
  END LOOP;
END $$;