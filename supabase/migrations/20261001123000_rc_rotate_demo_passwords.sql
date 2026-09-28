-- RC-P03 — retire the demo accounts' seeded password. Nothing else changes.
--
-- The deleted seed functions created the demo accounts (@neoscale.demo and
-- @ecosystem.demo) with the same password. Each of those accounts now gets its
-- own random password, generated inside the database and never shown to
-- anyone, and every session it holds is ended. The accounts and their profiles
-- stay.
--
-- Running it again rotates the passwords again, which is harmless.
DO $$
DECLARE
  crypto text;
  demo uuid[];
  rotated bigint;
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE NOTICE 'RC-P03: auth.users does not exist here; nothing to rotate';
    RETURN;
  END IF;

  -- pgcrypto lives in `extensions` on Supabase; look it up rather than assume it.
  SELECT ns.nspname INTO crypto
  FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE p.proname = 'gen_salt'
  ORDER BY ns.nspname = 'extensions' DESC
  LIMIT 1;
  IF crypto IS NULL THEN
    RAISE EXCEPTION 'RC-P03: pgcrypto is not installed, so no password can be generated';
  END IF;

  SELECT coalesce(array_agg(u.id), '{}') INTO demo
  FROM auth.users u
  WHERE lower(u.email) LIKE '%@neoscale.demo' OR lower(u.email) LIKE '%@ecosystem.demo';

  EXECUTE format(
    'UPDATE auth.users SET encrypted_password = %1$I.crypt(encode(%1$I.gen_random_bytes(32), ''base64''), %1$I.gen_salt(''bf'')) WHERE id = ANY ($1)',
    crypto)
  USING demo;
  GET DIAGNOSTICS rotated = ROW_COUNT;

  IF to_regclass('auth.refresh_tokens') IS NOT NULL THEN
    DELETE FROM auth.refresh_tokens WHERE user_id = ANY (demo::text[]);
  END IF;
  IF to_regclass('auth.sessions') IS NOT NULL THEN
    DELETE FROM auth.sessions WHERE user_id = ANY (demo);
  END IF;

  RAISE NOTICE 'RC-P03: % demo account(s) given a new random password, and signed out', rotated;
END $$;
