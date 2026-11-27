-- Mobile 29g: what Everyone may show.
--
-- WHAT THIS DOES.
--   1. profiles.is_test_account boolean NOT NULL DEFAULT false: the owner's mark for an account that exists to try the site out.
--      Only the dashboard, the service role and functions owned by postgres can set it: a member can neither mark nor unmark
--      themselves through the API (the same guard sec00 put on is_admin, under its own trigger names).
--   2. public.is_test_account(uuid): true when that person is marked. SECURITY DEFINER so it answers for anon as well; it reads
--      one boolean by primary key.
--   3. get_build_feed's Everyone scope (only_following = false) shows a build or a rebuild only when
--        - its title was typed by the maker: not empty after trimming and not the title a new draft is given, "Untitled build";
--        - it has at least one published step: builds.step_count > 0 (SV-23's stored count; NULL means "not counted yet" and is
--          left out, so run the SV-23 backfill at /dev/backfill-counts before applying this, or a build nobody has saved since
--          SV-23 disappears from Everyone until it is saved);
--        - its maker is not a test account.
--      Topics and replies by a test account are left out of Everyone too. Following is unchanged: it shows what the people you
--      chose to follow made.
--   The OpenBuilds list (src/lib/openbuilds/posts.ts, listPosts with scope "everyone") reads openbuild_posts directly and filters
--   on the author's is_test_account in the same request, so its pages and counts agree with this.
--
-- HOW. get_build_feed is patched in place, as 20261111120000_ux15_settings_blocking.sql patched it: the live text is read with
-- pg_get_functiondef, each anchor must be found exactly as often as expected or nothing is changed, and a second run changes
-- nothing (it returns when the text already names is_test_account).
--
-- WHICH ACCOUNTS TO MARK. This file marks nobody. After applying it, the owner marks the accounts seen live making test content
-- (builds titled "gbngd" or "Untitled build", posts of random letters), for example:
--   UPDATE public.profiles SET is_test_account = true WHERE username IN ('<handle>', '<handle>');
--
-- CHECKS to run once applied:
--   SELECT count(*) FROM public.get_build_feed(now(), 50, false) f JOIN public.builds b ON b.id = f.build_id
--    WHERE f.item_kind IN ('build', 'rebuild') AND (btrim(b.title) IN ('', 'Untitled build') OR coalesce(b.step_count, 0) = 0);
--   -- SHOULD BE 0.
--   EXPLAIN (ANALYZE, BUFFERS) SELECT item_kind, item_at FROM public.get_build_feed(now(), 20, false);
--   -- SHOULD SHOW: the same plan as before with an Index Scan on profiles_pkey per candidate row; no Seq Scan on profiles.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_test_account boolean NOT NULL DEFAULT false;

-- Few accounts are marked: a partial index keeps the marked ones findable without weighing on the rest.
CREATE INDEX IF NOT EXISTS idx_profiles_test_accounts ON public.profiles (id) WHERE is_test_account;


-- 1. The guard -----------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.profiles_lock_test_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.is_test_account := false;
    RETURN NEW;
  END IF;
  IF NEW.is_test_account IS DISTINCT FROM OLD.is_test_account THEN
    RAISE EXCEPTION 'is_test_account cannot be changed from the API' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.profiles_lock_test_account() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER profiles_lock_test_account_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_lock_test_account();
CREATE OR REPLACE TRIGGER profiles_lock_test_account_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_lock_test_account();


-- 2. The helper ----------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_test_account(_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce((SELECT p.is_test_account FROM public.profiles p WHERE p.id = _user), false);
$$;

REVOKE ALL ON FUNCTION public.is_test_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_test_account(uuid) TO anon, authenticated, service_role;


-- 3. get_build_feed's Everyone -------------------------------------------------------------------------------------------------

DO $patch$
DECLARE
  _fn   regprocedure := to_regprocedure('public.get_build_feed(timestamptz, integer, boolean)');
  _def  text;
  _olds text[] := ARRAY[
      -- the 'build' and the 'rebuild' legs
      $o$          AND (NOT only_following OR b.creator_id IN (SELECT following_id FROM followed))
          AND NOT public.is_blocked_between((select auth.uid()), b.creator_id)
$o$,
      -- topics, Everyone
      $o$        WHERE NOT only_following
          AND p.parent_id IS NULL
          AND NOT public.is_blocked_between((select auth.uid()), p.author_id)
$o$,
      -- replies, Everyone
      $o$        WHERE NOT only_following
          AND r.parent_id IS NOT NULL
          AND NOT public.is_blocked_between((select auth.uid()), r.author_id)
$o$
  ];
  _news text[] := ARRAY[
      $n$          AND (NOT only_following OR b.creator_id IN (SELECT following_id FROM followed))
          AND NOT public.is_blocked_between((select auth.uid()), b.creator_id)
          AND (only_following OR (
                btrim(coalesce(b.title, '')) NOT IN ('', 'Untitled build')
            AND coalesce(b.step_count, 0) > 0
            AND NOT public.is_test_account(b.creator_id)))
$n$,
      $n$        WHERE NOT only_following
          AND p.parent_id IS NULL
          AND NOT public.is_blocked_between((select auth.uid()), p.author_id)
          AND NOT public.is_test_account(p.author_id)
$n$,
      $n$        WHERE NOT only_following
          AND r.parent_id IS NOT NULL
          AND NOT public.is_blocked_between((select auth.uid()), r.author_id)
          AND NOT public.is_test_account(r.author_id)
$n$
  ];
  _cnts int[]  := ARRAY[2, 1, 1];
  _i    int;
  _n    int;
BEGIN
  IF _fn IS NULL THEN
    RAISE EXCEPTION 'M29g: get_build_feed (public.get_build_feed(timestamptz, integer, boolean)) was not found; nothing was changed';
  END IF;
  _def := pg_get_functiondef(_fn);
  IF position('is_test_account' in _def) > 0 THEN
    RETURN; -- already patched: running this twice changes nothing
  END IF;
  FOR _i IN 1 .. array_length(_olds, 1) LOOP
    _n := (length(_def) - length(replace(_def, _olds[_i], ''))) / length(_olds[_i]);
    IF _n <> _cnts[_i] THEN
      RAISE EXCEPTION 'M29g: get_build_feed no longer has the text patch % (found % times, expected %); nothing was changed', _i, _n, _cnts[_i];
    END IF;
    _def := replace(_def, _olds[_i], _news[_i]);
  END LOOP;
  EXECUTE _def;
END;
$patch$;
