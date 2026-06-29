CREATE TABLE IF NOT EXISTS public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.feature_flags TO anon, authenticated;
GRANT ALL ON public.feature_flags TO service_role;

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feature_flags readable by everyone" ON public.feature_flags;
CREATE POLICY "feature_flags readable by everyone"
  ON public.feature_flags FOR SELECT USING (true);

INSERT INTO public.feature_flags (key, enabled) VALUES
  ('FLAG_REPUTATION',   false),
  ('FLAG_LEADERBOARDS', false),
  ('FLAG_SEASONAL',     false),
  ('FLAG_GUILDS',       false)
ON CONFLICT (key) DO NOTHING;