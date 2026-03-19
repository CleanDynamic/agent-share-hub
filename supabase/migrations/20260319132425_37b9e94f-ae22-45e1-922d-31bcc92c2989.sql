
-- Add dm_presence to realtime (dm_messages and dm_threads already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'dm_presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_presence;
  END IF;
END $$;
