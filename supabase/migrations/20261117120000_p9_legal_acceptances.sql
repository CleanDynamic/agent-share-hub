-- =============================================================================
-- Prompt 9, G17: which terms a person accepted, and when, recorded by the server
-- =============================================================================
-- 1. public.legal_versions(): the current Terms and Privacy policy versions. A
--    version is the text's lastUpdated date in src/content/legal (read from
--    legalConstants.ts); legalConstants.test.ts fails if these dates differ.
--    When a text changes, a new migration replaces this function.
--
-- 2. public.legal_acceptances: append-only, one row per acceptance. A member
--    reads only their own rows. Nobody writes it through the API: rows come from
--    the sign-up trigger (3) and accept_legal_terms (4), both SECURITY DEFINER,
--    and accepted_at is always the server's clock. A row is never changed; it
--    goes only with its account (ON DELETE CASCADE from auth.users).
--
-- 3. On sign-up with an email and password, the trigger reads the versions the
--    sign-up form sent in the user metadata (terms_version, privacy_version).
--    If they are not the current versions the sign-up is refused, so no email
--    account exists without an acceptance. Google, GitHub and X accounts carry
--    no such metadata: they, and members from before this migration, accept
--    through the site's dialog (4). This trigger is separate from
--    handle_new_user, which this migration does not touch.
--
-- 4. public.accept_legal_terms(terms, privacy): a signed-in member accepts the
--    current versions. Anything else is refused.
--
-- Safe to run twice; drops nothing.
-- =============================================================================

-- 1. The current versions -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.legal_versions()
RETURNS TABLE (terms_version date, privacy_version date)
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT DATE '2026-11-06' AS terms_version, DATE '2026-11-06' AS privacy_version;
$$;

GRANT EXECUTE ON FUNCTION public.legal_versions() TO anon, authenticated;

-- 2. The record -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  terms_version date NOT NULL,
  privacy_version date NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('signup', 'dialog'))
);

CREATE INDEX IF NOT EXISTS legal_acceptances_user_id_idx ON public.legal_acceptances (user_id, accepted_at DESC);

ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.legal_acceptances FROM anon, authenticated;
GRANT SELECT ON public.legal_acceptances TO authenticated;

DROP POLICY IF EXISTS "Members read their own acceptances" ON public.legal_acceptances;
CREATE POLICY "Members read their own acceptances" ON public.legal_acceptances
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Append-only: no row is ever changed, by anyone.
CREATE OR REPLACE FUNCTION public.legal_acceptances_no_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'legal_acceptances is append-only';
END;
$$;

DROP TRIGGER IF EXISTS legal_acceptances_no_update ON public.legal_acceptances;
CREATE TRIGGER legal_acceptances_no_update
  BEFORE UPDATE ON public.legal_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.legal_acceptances_no_update();

-- 3. At sign-up ------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_signup_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_terms date;
  current_privacy date;
  sent_terms text := NEW.raw_user_meta_data ->> 'terms_version';
  sent_privacy text := NEW.raw_user_meta_data ->> 'privacy_version';
BEGIN
  -- Only an email and password sign-up carries the form's acceptance. Other providers, and people invited from the
  -- dashboard (who set a password from the invitation), accept in the dialog.
  IF coalesce(NEW.raw_app_meta_data ->> 'provider', 'email') <> 'email' OR NEW.invited_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT v.terms_version, v.privacy_version INTO current_terms, current_privacy FROM public.legal_versions() AS v;

  IF sent_terms IS DISTINCT FROM current_terms::text OR sent_privacy IS DISTINCT FROM current_privacy::text THEN
    RAISE EXCEPTION 'Accept the current Terms and Privacy policy to sign up.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.legal_acceptances (user_id, terms_version, privacy_version, accepted_at, source)
  VALUES (NEW.id, current_terms, current_privacy, now(), 'signup');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.record_signup_acceptance() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_record_acceptance ON auth.users;
CREATE TRIGGER on_auth_user_created_record_acceptance
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.record_signup_acceptance();

-- 4. Accepting later --------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.accept_legal_terms(p_terms_version date, p_privacy_version date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := auth.uid();
  current_terms date;
  current_privacy date;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Sign in to continue.' USING ERRCODE = 'P0001';
  END IF;

  SELECT v.terms_version, v.privacy_version INTO current_terms, current_privacy FROM public.legal_versions() AS v;

  IF p_terms_version IS DISTINCT FROM current_terms OR p_privacy_version IS DISTINCT FROM current_privacy THEN
    RAISE EXCEPTION 'Those are not the current Terms and Privacy policy.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.legal_acceptances (user_id, terms_version, privacy_version, accepted_at, source)
  VALUES (caller, current_terms, current_privacy, now(), 'dialog');
END;
$$;

REVOKE ALL ON FUNCTION public.accept_legal_terms(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_legal_terms(date, date) TO authenticated;
