-- =============================================================================
-- Security step 0: a member cannot raise their own privileges
-- =============================================================================
-- The own-row update policy on profiles ("Users can update their own profile")
-- had no WITH CHECK and no limit on columns, and authenticated holds UPDATE on
-- every column, is_admin included. So any signed-in member could make
-- themselves an admin, a curator or a creator with one request to the API.
--
-- This migration:
--   1. adds a BEFORE UPDATE trigger that refuses any change to is_admin,
--      is_curator or is_creator when the statement runs as anon or
--      authenticated (that is, through the API with a member's token or the
--      public key). The function is SECURITY INVOKER and tests current_user,
--      so the dashboard, the service role and SECURITY DEFINER functions owned
--      by postgres can still change them.
--   2. adds a BEFORE INSERT trigger that forces the three to false for the
--      same two roles.
--   3. adds WITH CHECK ((select auth.uid()) = id) to the own-row update policy.
--   4. adds admin_audit, an append-only log of admin writes (Part E, G22,
--      starts here), and request_ip() to read the caller's address.
--   5. adds admin_set_curator(user_id, value): the one way an admin changes
--      someone's curator flag. It requires is_admin for the caller and writes
--      one admin_audit row. (Part E adds the aal2 check.)
--
-- is_creator: nothing in the app or the database sets it or reads it (see the
-- comment above Analytics in src/App.tsx), so guarding it costs nothing.
--
-- The live database also has a trigger profiles_guard_privileged that is not
-- in this folder. This migration leaves it alone and adds its own, under
-- different names.
--
-- The live database has drifted from this folder (RULES.md section 8): every
-- object is found in the catalogue, nothing is dropped, and the file is safe
-- to run twice. Apply exactly as written, then run the security advisor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 and 2. The guard on profiles' privileged flags
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profiles_lock_privileged_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only the API's two roles are held back. postgres (the dashboard and
  -- SECURITY DEFINER functions it owns) and service_role pass.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_admin := false;
    NEW.is_curator := false;
    NEW.is_creator := false;
    RETURN NEW;
  END IF;

  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
     OR NEW.is_curator IS DISTINCT FROM OLD.is_curator
     OR NEW.is_creator IS DISTINCT FROM OLD.is_creator THEN
    RAISE EXCEPTION 'is_admin, is_curator and is_creator cannot be changed from the API'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.profiles_lock_privileged_flags() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  _missing text[];
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'sec00: public.profiles is not in this database';
  END IF;

  SELECT array_agg(c) INTO _missing
  FROM unnest(ARRAY['is_admin', 'is_curator', 'is_creator']) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.profiles'::regclass AND attname = c AND NOT attisdropped
  );
  IF _missing IS NOT NULL THEN
    RAISE EXCEPTION 'sec00: public.profiles has no column(s) %; the guard was not installed', _missing;
  END IF;

  -- CREATE OR REPLACE TRIGGER (Postgres 14 and up) re-points rather than collides on a second run.
  EXECUTE 'CREATE OR REPLACE TRIGGER profiles_lock_privileged_flags_update
             BEFORE UPDATE ON public.profiles
             FOR EACH ROW EXECUTE FUNCTION public.profiles_lock_privileged_flags()';
  EXECUTE 'CREATE OR REPLACE TRIGGER profiles_lock_privileged_flags_insert
             BEFORE INSERT ON public.profiles
             FOR EACH ROW EXECUTE FUNCTION public.profiles_lock_privileged_flags()';
END $$;

-- -----------------------------------------------------------------------------
-- 3. WITH CHECK on the own-row update policy
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.profiles'::regclass AND polname = 'Users can update their own profile'
  ) THEN
    EXECUTE 'ALTER POLICY "Users can update their own profile" ON public.profiles
               USING ((SELECT auth.uid()) = id)
               WITH CHECK ((SELECT auth.uid()) = id)';
  ELSE
    RAISE WARNING 'sec00: the policy "Users can update their own profile" is not on public.profiles; its WITH CHECK was not added. Look at the update policies on profiles by hand.';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. admin_audit and request_ip()
-- -----------------------------------------------------------------------------
-- The caller's address as the API gateway passed it, or null outside a request.
-- Same order as the edge functions read it (_shared/rateLimit.ts).
CREATE OR REPLACE FUNCTION public.request_ip()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  _headers jsonb;
BEGIN
  BEGIN
    _headers := nullif(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN others THEN
    RETURN null;
  END;
  IF _headers IS NULL THEN
    RETURN null;
  END IF;
  RETURN left(coalesce(
    nullif(_headers ->> 'cf-connecting-ip', ''),
    nullif(_headers ->> 'x-real-ip', ''),
    nullif(btrim(split_part(_headers ->> 'x-forwarded-for', ',', 1)), '')
  ), 64);
END $$;

REVOKE EXECUTE ON FUNCTION public.request_ip() FROM PUBLIC, anon, authenticated;

-- No foreign key on actor_id: an admin's account can be deleted without
-- touching the log, and the log never blocks that.
CREATE TABLE IF NOT EXISTS public.admin_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (length(action) BETWEEN 1 AND 100),
  target_table text,
  target_id text,
  details jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_created_at ON public.admin_audit (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_actor ON public.admin_audit (actor_id, created_at DESC);

ALTER TABLE public.admin_audit ENABLE ROW LEVEL SECURITY;

-- Rows arrive only through SECURITY DEFINER functions. Nobody writes, updates,
-- deletes or truncates through the API; admins read.
REVOKE ALL ON TABLE public.admin_audit FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.admin_audit TO authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.admin_audit'::regclass AND polname = 'Admins read the admin audit'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins read the admin audit" ON public.admin_audit
               FOR SELECT TO authenticated
               USING (public.is_admin((SELECT auth.uid())))';
  END IF;
END $$;

-- Append-only for every role, even one that holds the privilege or bypasses
-- row level security. Only someone who can disable triggers (the database
-- owner, in the dashboard) can change a row.
CREATE OR REPLACE FUNCTION public.admin_audit_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit is append-only' USING ERRCODE = '42501';
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_audit_append_only() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER admin_audit_no_update_or_delete
  BEFORE UPDATE OR DELETE ON public.admin_audit
  FOR EACH ROW EXECUTE FUNCTION public.admin_audit_append_only();
CREATE OR REPLACE TRIGGER admin_audit_no_truncate
  BEFORE TRUNCATE ON public.admin_audit
  FOR EACH STATEMENT EXECUTE FUNCTION public.admin_audit_append_only();

-- -----------------------------------------------------------------------------
-- 5. admin_set_curator
-- -----------------------------------------------------------------------------
-- Approving sets is_curator and marks the application approved; removing
-- clears is_curator and leaves the application's status as it was.
CREATE OR REPLACE FUNCTION public.admin_set_curator(_user_id uuid, _value boolean)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL OR NOT public.is_admin(_caller) THEN
    RAISE EXCEPTION 'Only an admin can do this' USING ERRCODE = '42501';
  END IF;
  IF _user_id IS NULL OR _value IS NULL THEN
    RAISE EXCEPTION 'admin_set_curator: user_id and value are required' USING ERRCODE = '22004';
  END IF;

  UPDATE public.profiles
  SET is_curator = _value,
      curator_application_status = CASE WHEN _value THEN 'approved' ELSE curator_application_status END
  WHERE id = _user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin_set_curator: no such profile' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.admin_audit (actor_id, action, target_table, target_id, details, ip)
  VALUES (_caller, 'set_curator', 'profiles', _user_id::text, jsonb_build_object('value', _value), public.request_ip());
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_set_curator(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_curator(uuid, boolean) TO authenticated, service_role;
