ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_is_private_idx
  ON public.profiles (is_private)
  WHERE is_private = true;