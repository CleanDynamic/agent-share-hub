// CA-09 Part 7: writes docs/audits/ca-09/live-checks.sql from the repository's migration folders, so the list of
// migrations in it is exactly the files on disk. Usage: node docs/audits/ca-09/scripts/make-live-checks.mjs
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { write } from "./lib.mjs";

const ROOT = path.resolve(new URL("../../../..", import.meta.url).pathname);
const supa = readdirSync(path.join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
const journal = JSON.parse(readFileSync(path.join(ROOT, "drizzle/migrations/meta/_journal.json"), "utf8")).entries;
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** A migration's own mark in the catalogue: an object it creates that nothing earlier does. Checked by existence. */
const MARKS = {
  "20261017110000_tf07_document_fields": ["node_types document schema lists made_by", "EXISTS (SELECT 1 FROM public.node_types WHERE key = 'document' AND schema::text LIKE '%\"made_by\"%')"],
  "20261016120000_post_threads": ["builds.post_doc", "EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'builds' AND column_name = 'post_doc')"],
  "20261020120000_ca06_colour_swatches": ["profiles.colour_swatches", "EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'colour_swatches')"],
  "20261001180000_rc_build_social": ["builds.like_count and table build_likes", "EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'builds' AND column_name = 'like_count') AND to_regclass('public.build_likes') IS NOT NULL"],
  "20261001190000_rc_reports": ["table content_reports", "to_regclass('public.content_reports') IS NOT NULL"],
  "20261001220000_rc_maker_stats": ["function maker_stats", "EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'maker_stats')"],
  "20261001160000_rc_top_solvers": ["function top_solvers", "EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'top_solvers')"],
  "20261001170000_rc_rebuild_tree": ["function rebuild_tree", "EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'rebuild_tree')"],
  "20261001140000_rc_search_builds": ["function search_build_ids", "EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'search_build_ids')"],
  "20261001280000_sessions_and_making": ["builds.making", "EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'builds' AND column_name = 'making')"],
  "20261001300000_sandbox_node_types": ["node_types team and manual_step", "(SELECT count(*) FROM public.node_types WHERE key IN ('team', 'manual_step')) = 2"],
  "20261001290000_rls_initplan": ["builds policies call (select auth.uid())", "EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'builds') AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('builds','build_nodes','build_media','build_events') AND (coalesce(qual,'') || coalesce(with_check,'')) ~ 'auth\\.uid\\(\\)' AND (coalesce(qual,'') || coalesce(with_check,'')) !~* 'select auth\\.uid\\(\\)')"],
  "20260917120000_import_sessions": ["table import_sessions", "to_regclass('public.import_sessions') IS NOT NULL"],
  "20261001200000_rc_build_notifications": ["notifications.build_id", "EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'build_id')"],
};

const supaRows = supa.map((f) => {
  const name = f.replace(/\.sql$/, "");
  const version = name.split("_")[0];
  const mark = MARKS[name];
  return `(${q(version)}, ${q(name)}, ${mark ? q(mark[0]) : "NULL"}, ${mark ? `(${mark[1]})` : "NULL::boolean"})`;
});
const drizzleRows = journal.map((e) => `(${q(e.tag)}, ${e.when})`);

const HOT = ["builds", "build_nodes", "build_media", "build_events", "import_sessions", "profiles", "node_types", "dm_presence", "user_progress", "notifications", "follows", "dm_threads", "dm_messages"];
const hotList = HOT.map(q).join(", ");

const sql = `-- =============================================================================
-- CA-09 · live checks: slow pages, buttons that do nothing, drafts
-- =============================================================================
--
-- READ ONLY. THIS FILE IS SELECT ONLY: one SELECT statement and nothing else.
-- No INSERT, UPDATE, DELETE, ALTER, CREATE, DROP, GRANT, SET, DO or CALL. It
-- changes nothing and can be run as often as you like.
--
-- HOW TO RUN IT. Paste the whole file, once, into the SQL editor in Lovable and
-- run it. It returns ONE table, one row per check, with five columns:
-- section, check, expected, found, ok. Copy the whole table back (or export it
-- as CSV).
--
-- HOW TO READ IT. ok = true: as the repository expects. ok = false: a finding.
-- ok empty: information only (a size, a timing, an index).
--
--   M · every migration in supabase/migrations: recorded as applied or not,
--       and, for the ones that matter now, whether the object it makes exists.
--   D · every drizzle migration Lovable recorded.
--   S · table sizes, and the size of import_sessions.proposal.
--   I · the indexes on the tables the site reads most.
--   Q · the 20 slowest statements by mean time (pg_stat_statements), if it is on.
--   T · statement_timeout for the authenticated and anon roles.
--   P · policies on those tables that call a function on every row.
--   G · triggers on those tables.
--   X · functions that run with their owner's rights and that anyone signed
--       out may call (a light security check; names only).
--   U · how the tables are being read (sequential vs index scans).
--
-- NO ROW SHOWS ANYONE'S DATA. Sizes and counts are aggregates; statement texts
-- from pg_stat_statements carry $1, $2 in place of every value; nothing reads a
-- name, an email, a title or any content.
--
-- Three reads are dynamic (supabase_migrations, drizzle, pg_stat_statements):
-- they go through query_to_xml(), a built-in that runs a SELECT given as text,
-- and only when the table exists and can be read, so the file runs either way.
--
-- Generated by docs/audits/ca-09/scripts/make-live-checks.mjs from the
-- repository at cc6cc8c (20 October 2026). See docs/audits/ca-09/report.md.
-- =============================================================================

WITH
repo_migrations (version, name, mark, mark_present) AS (
  VALUES
  ${supaRows.join(",\n  ")}
),
drizzle_journal (tag, created_at) AS (
  VALUES
  ${drizzleRows.join(",\n  ")}
),
supabase_doc AS (
  SELECT CASE WHEN to_regclass('supabase_migrations.schema_migrations') IS NOT NULL
               AND has_table_privilege(to_regclass('supabase_migrations.schema_migrations'), 'SELECT')
              THEN query_to_xml('SELECT version FROM supabase_migrations.schema_migrations', false, false, '') END AS doc
),
supabase_recorded AS (
  SELECT (xpath('/row/version/text()', r))[1]::text AS version
  FROM supabase_doc CROSS JOIN LATERAL unnest(xpath('/table/row', supabase_doc.doc)) AS r
),
drizzle_doc AS (
  SELECT CASE WHEN to_regclass('drizzle.__drizzle_migrations') IS NOT NULL
               AND has_table_privilege(to_regclass('drizzle.__drizzle_migrations'), 'SELECT')
              THEN query_to_xml('SELECT created_at FROM drizzle.__drizzle_migrations', false, false, '') END AS doc
),
drizzle_recorded AS (
  SELECT ((xpath('/row/created_at/text()', r))[1]::text)::bigint AS created_at
  FROM drizzle_doc CROSS JOIN LATERAL unnest(xpath('/table/row', drizzle_doc.doc)) AS r
),
pss_table AS (
  SELECT coalesce(to_regclass('extensions.pg_stat_statements'), to_regclass('public.pg_stat_statements')) AS rel
),
pss_doc AS (
  SELECT CASE WHEN rel IS NOT NULL AND has_table_privilege(rel, 'SELECT')
              THEN query_to_xml(format(
                'SELECT left(regexp_replace(query, %L, %L, %L), 200) AS q, calls, round(mean_exec_time::numeric, 1) AS mean_ms, round(max_exec_time::numeric, 1) AS max_ms, round(total_exec_time::numeric) AS total_ms, rows FROM %s WHERE query NOT ILIKE %L ORDER BY mean_exec_time DESC LIMIT 20',
                '\\s+', ' ', 'g', rel::text, '%pg_stat_statements%'), false, false, '') END AS doc
  FROM pss_table
),
pss_rows AS (
  SELECT row_number() OVER () AS n,
         (xpath('/row/q/text()', r))[1]::text AS q, (xpath('/row/calls/text()', r))[1]::text AS calls,
         (xpath('/row/mean_ms/text()', r))[1]::text AS mean_ms, (xpath('/row/max_ms/text()', r))[1]::text AS max_ms,
         (xpath('/row/total_ms/text()', r))[1]::text AS total_ms, (xpath('/row/rows/text()', r))[1]::text AS nrows
  FROM pss_doc CROSS JOIN LATERAL unnest(xpath('/table/row', pss_doc.doc)) AS r
),
hot (tbl) AS (SELECT unnest(ARRAY[${hotList}])),
checks (section, sort, "check", expected, found, ok) AS (

  -- M · migrations
  SELECT 'M', 0, 'M · migrations recorded in supabase_migrations.schema_migrations',
         'readable (how Lovable or the CLI records applied files)',
         CASE WHEN (SELECT doc FROM supabase_doc) IS NULL THEN 'table missing or unreadable' ELSE (SELECT count(*)::text || ' recorded' FROM supabase_recorded) END,
         NULL::boolean
  UNION ALL
  SELECT 'M', 1, 'M · ' || m.name,
         CASE WHEN m.mark IS NULL THEN 'recorded as applied' ELSE 'applied: ' || m.mark END,
         concat_ws('; ',
           CASE WHEN EXISTS (SELECT 1 FROM supabase_recorded s WHERE s.version = m.version) THEN 'recorded' ELSE 'not recorded' END,
           CASE WHEN m.mark IS NULL THEN NULL WHEN m.mark_present THEN m.mark || ': present' ELSE m.mark || ': MISSING' END),
         CASE WHEN m.mark IS NOT NULL THEN m.mark_present
              WHEN (SELECT doc FROM supabase_doc) IS NULL THEN NULL
              ELSE EXISTS (SELECT 1 FROM supabase_recorded s WHERE s.version = m.version) END
  FROM repo_migrations m

  -- D · drizzle
  UNION ALL
  SELECT 'D', 2, 'D · drizzle ' || d.tag, 'recorded in drizzle.__drizzle_migrations',
         CASE WHEN (SELECT doc FROM drizzle_doc) IS NULL THEN 'table missing or unreadable'
              WHEN EXISTS (SELECT 1 FROM drizzle_recorded r WHERE r.created_at = d.created_at) THEN 'recorded' ELSE 'not recorded' END,
         CASE WHEN (SELECT doc FROM drizzle_doc) IS NULL THEN NULL ELSE EXISTS (SELECT 1 FROM drizzle_recorded r WHERE r.created_at = d.created_at) END
  FROM drizzle_journal d

  -- S · sizes
  UNION ALL
  SELECT 'S', 3, 'S · size of ' || c.relname, 'information',
         pg_size_pretty(pg_total_relation_size(c.oid)) || ' total, ' || pg_size_pretty(pg_relation_size(c.oid)) || ' table, about ' || greatest(c.reltuples, 0)::bigint || ' rows',
         NULL
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname IN (SELECT tbl FROM hot)
  UNION ALL
  SELECT 'S', 4, 'S · import_sessions.proposal size (all users, stored)', 'information: average and largest, and how many over 1 MB',
         (SELECT 'avg ' || coalesce(pg_size_pretty(avg(pg_column_size(proposal))::bigint), 'n/a') || ', max ' || coalesce(pg_size_pretty(max(pg_column_size(proposal))::bigint), 'n/a')
                 || ', ' || count(*) FILTER (WHERE pg_column_size(proposal) > 1000000) || ' over 1 MB, ' || count(proposal) || ' with a proposal'
          FROM public.import_sessions),
         NULL
  UNION ALL
  SELECT 'S', 5, 'S · import_sessions.proposal size as text (what a JSON path read decompresses)', 'information',
         (SELECT 'avg ' || coalesce(pg_size_pretty(avg(octet_length(proposal::text))::bigint), 'n/a') || ', max ' || coalesce(pg_size_pretty(max(octet_length(proposal::text))::bigint), 'n/a')
          FROM public.import_sessions),
         NULL
  UNION ALL
  SELECT 'S', 6, 'S · import_sessions rows per status', 'information',
         (SELECT string_agg(status || ' ' || n, ', ' ORDER BY status) FROM (SELECT status, count(*) AS n FROM public.import_sessions GROUP BY status) s),
         NULL
  UNION ALL
  SELECT 'S', 7, 'S · the most sessions any one account has (parsed + claimed + expired)', 'information: the composer and Drafts read up to 50 of them every 10 s',
         (SELECT coalesce(max(n), 0)::text || ' sessions, ' || coalesce(pg_size_pretty(max(b)), '0') || ' of proposal'
          FROM (SELECT user_id, count(*) AS n, sum(octet_length(proposal::text))::bigint AS b FROM public.import_sessions WHERE status IN ('parsed','claimed','expired') GROUP BY user_id) u),
         NULL

  -- I · indexes
  UNION ALL
  SELECT 'I', 8, 'I · ' || tablename || ' · ' || indexname, 'information', indexdef, NULL
  FROM pg_indexes WHERE schemaname = 'public' AND tablename IN (SELECT tbl FROM hot)
  UNION ALL
  SELECT 'I', 9, 'I · ' || x.want, 'an index leads with these columns', CASE WHEN x.present THEN 'present' ELSE 'MISSING' END, x.present
  FROM (VALUES
    ('builds (creator_id, status, updated_at)', EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'builds' AND indexdef ~ '\\(creator_id, status')),
    ('builds (creator_id)', EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'builds' AND indexdef ~ '\\(creator_id')),
    ('build_nodes (build_id, …position)', EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'build_nodes' AND indexdef ~ '\\(build_id')),
    ('build_media (build_id, post_position)', EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'build_media' AND indexdef ~ '\\(build_id, post_position')),
    ('import_sessions (user_id, status, created_at)', EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'import_sessions' AND indexdef ~ '\\(user_id, status, created_at')),
    ('dm_presence (user_id) unique, for the upsert', EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'dm_presence' AND indexdef ~* 'unique' AND indexdef ~ '\\(user_id\\)'))
  ) AS x(want, present)

  -- Q · slowest statements
  UNION ALL
  SELECT 'Q', 10, 'Q · pg_stat_statements', 'on, and readable',
         CASE WHEN (SELECT rel FROM pss_table) IS NULL THEN 'NOT ENABLED (no pg_stat_statements view)'
              WHEN (SELECT doc FROM pss_doc) IS NULL THEN 'present but not readable'
              ELSE 'on: the 20 slowest by mean time follow' END,
         (SELECT doc FROM pss_doc) IS NOT NULL
  UNION ALL
  SELECT 'Q', 11, 'Q · #' || lpad(n::text, 2, '0') || ' mean ' || mean_ms || ' ms, max ' || max_ms || ' ms, ' || calls || ' calls, ' || total_ms || ' ms total, ' || nrows || ' rows', 'information', q, NULL
  FROM pss_rows

  -- T · statement timeout
  UNION ALL
  SELECT 'T', 12, 'T · statement_timeout for role ' || r.rolname, 'information: Supabase sets authenticated to 8s and anon to 3s',
         coalesce((SELECT string_agg(c, ', ') FROM unnest(r.rolconfig) c WHERE c LIKE 'statement_timeout=%'), 'not set on the role (database default ' || current_setting('statement_timeout') || ')'),
         NULL
  FROM pg_roles r WHERE r.rolname IN ('authenticated', 'anon', 'authenticator')
  UNION ALL
  SELECT 'T', 13, 'T · statement_timeout set on the database', 'information',
         coalesce((SELECT string_agg(c, ', ') FROM pg_db_role_setting s CROSS JOIN LATERAL unnest(s.setconfig) c WHERE s.setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database()) AND s.setrole = 0 AND c LIKE 'statement_timeout=%'), 'none'),
         NULL
  UNION ALL
  SELECT 'T', 15, 'T · connections now (by state, no query text)', 'information',
         (SELECT string_agg(coalesce(state, 'background') || ' ' || n, ', ') FROM (SELECT state, count(*) AS n FROM pg_stat_activity GROUP BY state) a),
         NULL
  UNION ALL
  SELECT 'T', 16, 'T · longest running statement now', 'under 8 s',
         coalesce((SELECT round(extract(epoch FROM max(now() - query_start)))::text || ' s' FROM pg_stat_activity WHERE state = 'active' AND query_start IS NOT NULL AND pid <> pg_backend_pid()), 'none running'),
         coalesce((SELECT max(now() - query_start) < interval '8 seconds' FROM pg_stat_activity WHERE state = 'active' AND pid <> pg_backend_pid()), true)

  -- P · policies that call a function per row
  UNION ALL
  SELECT 'P', 17, 'P · ' || tablename || ' · ' || policyname || ' (' || cmd || ')',
         'auth.uid() and is_admin() wrapped in (select …), so they run once per statement, not once per row',
         left(concat_ws(' | ', 'USING ' || qual, 'CHECK ' || with_check), 200),
         NOT ((coalesce(qual,'') || coalesce(with_check,'')) ~ '(auth\\.uid\\(\\)|is_admin\\()' AND (coalesce(qual,'') || coalesce(with_check,'')) !~* 'select (auth\\.uid\\(\\)|is_admin\\()')
  FROM pg_policies WHERE schemaname = 'public' AND tablename IN (SELECT tbl FROM hot)

  -- G · triggers
  UNION ALL
  SELECT 'G', 18, 'G · ' || c.relname || ' · ' || t.tgname, 'information (enabled = O)',
         'enabled=' || t.tgenabled::text || ', calls ' || p.proname || '()', NULL
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE NOT t.tgisinternal AND n.nspname = 'public' AND c.relname IN (SELECT tbl FROM hot)

  -- X · security, light: functions that run with their owner's rights and that anyone (anon) may call
  UNION ALL
  SELECT 'X', 20, 'X · anon may execute public.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         'SECURITY DEFINER functions that read auth.users or private rows should not be callable signed out',
         'SECURITY DEFINER, executable by anon', CASE WHEN p.proname = 'get_email_by_username' THEN false END
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE')

  -- U · how the tables are read
  UNION ALL
  SELECT 'U', 19, 'U · ' || relname || ' reads', 'information: many sequential scans on a big table means a missing index',
         seq_scan || ' sequential scans (' || seq_tup_read || ' rows read), ' || coalesce(idx_scan, 0) || ' index scans, ' || n_live_tup || ' live rows, ' || n_dead_tup || ' dead',
         NULL
  FROM pg_stat_user_tables WHERE schemaname = 'public' AND relname IN (SELECT tbl FROM hot)
)
SELECT section, "check", expected, found, ok
FROM checks
ORDER BY sort, "check";
`;
write("live-checks.sql", sql);
console.log(`live-checks.sql: ${supa.length} migrations, ${journal.length} drizzle entries`);
