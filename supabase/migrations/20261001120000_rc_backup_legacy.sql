-- RC-P02 — private backup of everything the legacy clear can touch. Writes nothing in public.*
--
-- Copies into the private schema rc_backup every table that
-- 20261001130000_rc_clear_legacy_posts.sql can delete from or change. The list
-- is found from the live catalogue when this runs, not from supabase/migrations,
-- because the live database has drifted from the migration files. It follows
-- the same rules as the clear:
--
--   - public.content_items, and the legacy notifications and legacy bounties
--     the clear deletes, are copied whole;
--   - so is every table whose rows go with them: reached through a foreign key
--     that cascades, or through a NOT NULL one that does not, at any depth;
--   - a table whose rows stay with a link emptied (a nullable key that does not
--     cascade, and always profiles, builds, build_nodes, dm_messages,
--     dm_threads and follows) is copied only where one of those links is set.
--
-- rc_backup._manifest records each copy and its row count.
--
-- The schema is revoked from PUBLIC, anon and authenticated and is not an
-- exposed API schema, so its tables carry no RLS, policies or grants: nothing
-- but the database owner can reach them. The copies are plain reads of public.*
-- and take no row locks on it. This runs once: it refuses to overwrite a backup.
DO $$
DECLARE
  keep constant text[] := array['profiles', 'builds', 'build_nodes', 'dm_messages', 'dm_threads', 'follows'];
  survivor_links constant text[] := array['dm_messages.shared_content_id', 'dm_threads.pinned_content_id', 'builds.source_content_item_id'];
  doomed oid[] := '{}';
  emptied text[] := '{}';  -- 'oid:column' pairs whose link the clear empties
  i int := 1;
  fk record;
  child_col name;
  child_notnull boolean;
  child_keep boolean;
  src record;
  copy_name text;
  cond text;
  n bigint;
  link text;
BEGIN
  IF to_regclass('public.content_items') IS NULL THEN
    RAISE EXCEPTION 'RC-P02: public.content_items does not exist';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'rc_backup' AND c.relkind IN ('r', 'p')
  ) THEN
    RAISE EXCEPTION 'RC-P02: rc_backup already holds a backup, and a backup is never overwritten';
  END IF;

  CREATE SCHEMA IF NOT EXISTS rc_backup;
  REVOKE ALL ON SCHEMA rc_backup FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA rc_backup FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA rc_backup FROM authenticated;
  END IF;

  CREATE TABLE rc_backup._manifest (
    source    text PRIMARY KEY,
    copy      text NOT NULL,
    rows      bigint NOT NULL,
    scope     text NOT NULL,
    copied_at timestamptz NOT NULL DEFAULT now()
  );

  -- The tables the clear deletes rows from, breadth-first from its three starting points.
  doomed := array['public.content_items'::regclass::oid];
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('public.notifications') AND attname = 'content_id' AND NOT attisdropped) THEN
    doomed := doomed || 'public.notifications'::regclass::oid;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('public.bounties') AND attname = 'legacy_item_id' AND NOT attisdropped) THEN
    doomed := doomed || 'public.bounties'::regclass::oid;
  END IF;

  WHILE i <= cardinality(doomed) LOOP
    FOR fk IN
      SELECT c.conname, c.conrelid, c.conkey, c.confdeltype
      FROM pg_constraint c
      WHERE c.contype = 'f' AND c.confrelid = doomed[i] AND c.conrelid <> doomed[i]
      ORDER BY c.conrelid, c.conname
    LOOP
      IF cardinality(fk.conkey) <> 1 THEN
        RAISE EXCEPTION 'RC-P02: % is a multi-column foreign key into %, which the clear does not handle', fk.conname, doomed[i]::regclass;
      END IF;
      IF fk.confdeltype = 'd' THEN
        RAISE EXCEPTION 'RC-P02: % uses ON DELETE SET DEFAULT, which the clear does not handle', fk.conname;
      END IF;
      SELECT a.attname, a.attnotnull INTO child_col, child_notnull
      FROM pg_attribute a WHERE a.attrelid = fk.conrelid AND a.attnum = fk.conkey[1];
      SELECT ns.nspname = 'public' AND c.relname = ANY (keep) INTO child_keep
      FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace WHERE c.oid = fk.conrelid;

      IF child_keep OR (fk.confdeltype <> 'c' AND NOT child_notnull) THEN
        emptied := emptied || (fk.conrelid::text || ':' || child_col);
      ELSIF NOT fk.conrelid = ANY (doomed) THEN
        doomed := doomed || fk.conrelid;
      END IF;
    END LOOP;
    i := i + 1;
  END LOOP;

  -- The survivor links the RC plan names, even where the live table has lost the key.
  FOREACH link IN ARRAY survivor_links LOOP
    IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('public.' || split_part(link, '.', 1)) AND attname = split_part(link, '.', 2) AND NOT attisdropped) THEN
      emptied := emptied || (to_regclass('public.' || split_part(link, '.', 1))::oid::text || ':' || split_part(link, '.', 2));
    END IF;
  END LOOP;

  -- Whole copies of every table the clear deletes from.
  FOR src IN
    SELECT c.oid, ns.nspname, c.relname
    FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE c.oid = ANY (doomed)
    ORDER BY ns.nspname, c.relname
  LOOP
    copy_name := CASE WHEN src.nspname = 'public' THEN src.relname ELSE src.nspname || '__' || src.relname END;
    EXECUTE format('CREATE TABLE rc_backup.%I AS TABLE %I.%I', copy_name, src.nspname, src.relname);
    GET DIAGNOSTICS n = ROW_COUNT;
    INSERT INTO rc_backup._manifest (source, copy, rows, scope)
    VALUES (format('%I.%I', src.nspname, src.relname), copy_name, n, 'whole table');
  END LOOP;

  -- Row copies of every table that keeps its rows, where one of the emptied links is set.
  FOR src IN
    SELECT c.oid, ns.nspname, c.relname,
           string_agg(DISTINCT format('%I IS NOT NULL', split_part(e, ':', 2)), ' OR ') AS cond
    FROM unnest(emptied) AS e
    JOIN pg_class c ON c.oid = split_part(e, ':', 1)::oid
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE NOT c.oid = ANY (doomed)
    GROUP BY c.oid, ns.nspname, c.relname
    ORDER BY ns.nspname, c.relname
  LOOP
    copy_name := CASE WHEN src.nspname = 'public' THEN src.relname ELSE src.nspname || '__' || src.relname END;
    EXECUTE format('CREATE TABLE rc_backup.%I AS SELECT * FROM %I.%I WHERE %s', copy_name, src.nspname, src.relname, src.cond);
    GET DIAGNOSTICS n = ROW_COUNT;
    INSERT INTO rc_backup._manifest (source, copy, rows, scope)
    VALUES (format('%I.%I', src.nspname, src.relname), copy_name, n, 'rows where ' || src.cond);
  END LOOP;

  RAISE NOTICE 'RC-P02: % tables copied into rc_backup', (SELECT count(*) FROM rc_backup._manifest);
END $$;
