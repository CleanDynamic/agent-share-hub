-- SV-24 Part 1: saved filter sets, and Groups.
--
-- A FILTER SET is the Builds filters a reader saved under a name: `query` holds { "search": "<the address's query string>",
-- "layout": { ... } } (the filters' order, which are open, their heights, the columns and the footer's calculations: SV-24 Part 2). A
-- set is private to its owner until the owner makes it public; a public set is read by anyone, signed in or not.
--
-- A GROUP IS A PUBLIC FILTER SET WITH MEMBERS, not a guild. guilds has a purpose, an emblem, a founder role and a member cap, its writes
-- are service-role only and it sits behind FLAG_GUILDS; it carries no filter. A Group on OpenBuilds is "the field and tools of your
-- builds": a filter someone can open. Nothing here reads or writes guilds or guild_members.
--
-- filter_set_members (filter_set_id, user_id): a reader follows a public set by adding their own row, and leaves by removing it. A
-- set's owner joins their own set when they make it public (the app does it; nothing here does). Nobody is notified by a join, so
-- no trigger writes a notification.
--
-- GRANTS ARE EXPLICIT, AND COME BEFORE THE POLICIES, as saved_items' are (20261029120000): the tables are revoked from anon,
-- authenticated and service_role, then each is granted exactly the verbs its policies serve. anon may only SELECT, and the policy
-- lets it see public sets and the member rows of public sets.
--
-- list_filter_set_groups(p_limit): OpenBuilds' Groups, one request: the public sets, the reader's own first, then by members. It is
-- SECURITY INVOKER, so the policies above decide what a caller sees; it returns the address's query string and not the layout.
--
-- Correct whether or not any of it already exists.
--
-- EXPLAIN (ANALYZE, BUFFERS) to run once applied:
--   1. The reader's own sets, newest first:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT id, name, is_public FROM public.filter_sets
--        WHERE user_id = '<a reader with saved sets>' ORDER BY created_at DESC LIMIT 50;
--      SHOULD SHOW: an Index Scan on idx_filter_sets_user_created, no Sort, no Seq Scan on filter_sets.
--   2. The Groups:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.list_filter_set_groups(20);
--      SHOULD SHOW: a scan of filter_sets on idx_filter_sets_public (or a Seq Scan while the table has a few hundred rows), the
--      members counted through the primary key of filter_set_members (Index Only Scan or Bitmap Scan), a Sort over at most the
--      public sets, and 20 rows out.
--   3. The reader's memberships:
--      EXPLAIN (ANALYZE, BUFFERS) SELECT filter_set_id FROM public.filter_set_members WHERE user_id = '<a reader>' LIMIT 100;
--      SHOULD SHOW: an Index Scan on idx_filter_set_members_user.
--   If any plan shows a Seq Scan on a table of more than a few thousand rows, send the plan back.

-- 1. filter_sets -----------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.filter_sets (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  query      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  is_public  boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT filter_sets_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  CONSTRAINT filter_sets_query_object CHECK (jsonb_typeof(query) = 'object' AND pg_column_size(query) <= 8192)
);

CREATE INDEX IF NOT EXISTS idx_filter_sets_user_created
  ON public.filter_sets (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_filter_sets_public
  ON public.filter_sets (created_at DESC)
  WHERE is_public;

-- 2. filter_set_members ----------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.filter_set_members (
  filter_set_id uuid        NOT NULL REFERENCES public.filter_sets(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (filter_set_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_filter_set_members_user
  ON public.filter_set_members (user_id);

-- 3. grants ----------------------------------------------------------------------------------------------------------------

ALTER TABLE public.filter_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.filter_set_members ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.filter_sets FROM anon, authenticated, service_role;
GRANT SELECT ON public.filter_sets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.filter_sets TO authenticated;
GRANT ALL ON public.filter_sets TO service_role;

REVOKE ALL ON public.filter_set_members FROM anon, authenticated, service_role;
GRANT SELECT ON public.filter_set_members TO anon;
GRANT SELECT, INSERT, DELETE ON public.filter_set_members TO authenticated;
GRANT ALL ON public.filter_set_members TO service_role;

-- 4. policies --------------------------------------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public filter sets are read by anyone, private ones by their owner" ON public.filter_sets;
CREATE POLICY "Public filter sets are read by anyone, private ones by their owner"
  ON public.filter_sets FOR SELECT
  TO anon, authenticated
  USING (is_public OR user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Readers add their own filter sets" ON public.filter_sets;
CREATE POLICY "Readers add their own filter sets"
  ON public.filter_sets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Readers change their own filter sets" ON public.filter_sets;
CREATE POLICY "Readers change their own filter sets"
  ON public.filter_sets FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Readers remove their own filter sets" ON public.filter_sets;
CREATE POLICY "Readers remove their own filter sets"
  ON public.filter_sets FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Members of public filter sets are read by anyone, a reader's own rows by them" ON public.filter_set_members;
CREATE POLICY "Members of public filter sets are read by anyone, a reader's own rows by them"
  ON public.filter_set_members FOR SELECT
  TO anon, authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (SELECT 1 FROM public.filter_sets s WHERE s.id = filter_set_members.filter_set_id AND s.is_public)
  );

DROP POLICY IF EXISTS "Readers join a public filter set, or their own" ON public.filter_set_members;
CREATE POLICY "Readers join a public filter set, or their own"
  ON public.filter_set_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.filter_sets s
        WHERE s.id = filter_set_members.filter_set_id
         AND (s.is_public OR s.user_id = (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Readers leave a filter set" ON public.filter_set_members;
CREATE POLICY "Readers leave a filter set"
  ON public.filter_set_members FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

COMMENT ON TABLE public.filter_sets IS
  'SV-24. A reader''s saved Builds filters (query.search is the address''s query string, query.layout the panel and columns). Private to the owner until is_public; a public set is a Group on OpenBuilds.';
COMMENT ON TABLE public.filter_set_members IS
  'SV-24. A reader following a public filter set (a Group). Written only by the member''s own row.';

-- 5. OpenBuilds' Groups ----------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_filter_set_groups(p_limit integer DEFAULT 20)
RETURNS TABLE (id uuid, name text, search text, members bigint, is_member boolean, is_owner boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT s.id,
         s.name,
         coalesce(s.query ->> 'search', '') AS search,
         count(m.user_id) AS members,
         coalesce(bool_or(m.user_id = (select auth.uid())), false) AS is_member,
         s.user_id = (select auth.uid()) AS is_owner
    FROM public.filter_sets s
    LEFT JOIN public.filter_set_members m ON m.filter_set_id = s.id
   WHERE s.is_public
   GROUP BY s.id
   ORDER BY (coalesce(bool_or(m.user_id = (select auth.uid())), false) OR s.user_id = (select auth.uid())) DESC,
            count(m.user_id) DESC,
            s.created_at DESC
   LIMIT greatest(1, least(coalesce(p_limit, 20), 50))
$$;

REVOKE ALL ON FUNCTION public.list_filter_set_groups(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_filter_set_groups(integer) TO anon, authenticated, service_role;