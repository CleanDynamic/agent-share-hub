-- Stops anyone giving themselves admin, curator, verified or trusted status,
-- or changing their payment IDs, from the website. The site's own server
-- code and real admins are not affected. Nothing is deleted.
CREATE OR REPLACE FUNCTION public.profiles_guard_privileged()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND NOT COALESCE(public.is_admin(auth.uid()), false) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_admin := false;
      NEW.is_curator := false;
      NEW.is_verified := false;
      NEW.is_trusted_solver := false;
      NEW.stripe_account_id := NULL;
      NEW.subscription_price_id := NULL;
    ELSIF NEW.is_admin IS DISTINCT FROM OLD.is_admin
       OR NEW.is_curator IS DISTINCT FROM OLD.is_curator
       OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
       OR NEW.is_trusted_solver IS DISTINCT FROM OLD.is_trusted_solver
       OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
       OR NEW.subscription_price_id IS DISTINCT FROM OLD.subscription_price_id THEN
      RAISE EXCEPTION 'These profile fields can only be changed by the site'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER profiles_guard_privileged
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_privileged();
