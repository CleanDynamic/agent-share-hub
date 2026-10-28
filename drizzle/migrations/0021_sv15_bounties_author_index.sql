DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = i.indkey[0]
    WHERE n.nspname = 'public' AND c.relname = 'bounties' AND a.attname = 'author_id'
  ) THEN
    CREATE INDEX idx_bounties_author_created ON public.bounties (author_id, created_at DESC);
  END IF;
END
$$;