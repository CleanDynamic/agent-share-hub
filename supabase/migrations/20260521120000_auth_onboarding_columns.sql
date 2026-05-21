-- Phase 17 — auth flows integration (sessions C & D)
--
-- 1. Track when a user completes onboarding.
-- 2. Update handle_new_user so OAuth signups — which carry no username /
--    display_name in user metadata — leave those columns NULL. The app uses
--    that signal to detect first-time OAuth users and route them to
--    /onboarding/profile. Email signups still pass username + display_name
--    in user metadata, so the trigger fills them as before.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, account_type)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'display_name',
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'user')
  );
  RETURN NEW;
END;
$$;

-- The on_auth_user_created trigger already references handle_new_user();
-- CREATE OR REPLACE above swaps the function body in place.
