-- RC-P01 — the live reconnaissance. Read-only: nothing here writes.
--
-- Run each query against the live database and paste its rows, verbatim, under
-- the matching heading in docs/reconciliation/CLEAR-RECON.md, replacing
-- "Not supplied". Run it before 20261001120000_rc_backup_legacy.sql, so Q1, Q3
-- and Q7 record the state the clear starts from.

-- Q1 — legacy posts
select count(*) as n from public.content_items;

-- Q2 — every foreign key into content_items. on_delete: a no action, r restrict,
-- c cascade, n set null, d set default.
select c.conrelid::regclass as "table", a.attname as "column", c.confdeltype as on_delete, a.attnotnull as not_null
from pg_constraint c
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
where c.contype = 'f' and c.confrelid = 'public.content_items'::regclass
order by 1, 2;

-- Q3 — how many rows each of those columns points at a post with
select c.conrelid::regclass as "table", a.attname as "column",
  (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from %s where %I is not null', c.conrelid::regclass, a.attname), false, true, '')))[1]::text::bigint as rows
from pg_constraint c
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
where c.contype = 'f' and c.confrelid = 'public.content_items'::regclass
order by 1, 2;

-- Q4 — storage objects per bucket (the clear leaves every one of them in place)
select bucket_id, count(*) as objects from storage.objects group by 1 order by 1;

-- Q5 — triggers on content_items and the Q2 tables, and whether each calls out of the database
select t.tgrelid::regclass as "table", t.tgname as "trigger", p.proname as "function",
  (t.tgtype & 8) <> 0 as on_delete, (t.tgtype & 16) <> 0 as on_update,
  (ns.nspname = 'supabase_functions' or p.prosrc ~* '(net\.http_|http_request|http_post|http_get)') as calls_out
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
join pg_namespace ns on ns.oid = p.pronamespace
where not t.tgisinternal
  and t.tgrelid in (
    select 'public.content_items'::regclass
    union select conrelid::regclass from pg_constraint where contype = 'f' and confrelid = 'public.content_items'::regclass)
order by 1, 2;

-- Q6 — the columns of builds (rebuild_count must be among them)
select string_agg(column_name, ', ' order by ordinal_position) as columns
from information_schema.columns
where table_schema = 'public' and table_name = 'builds';

-- Q7 — the row counts the clear must not change, and the demo accounts
select 'profiles' as what, count(*) as n from public.profiles
union all select 'builds', count(*) from public.builds
union all select 'build_nodes', count(*) from public.build_nodes
union all select 'dm_messages', count(*) from public.dm_messages
union all select 'dm_threads', count(*) from public.dm_threads
union all select 'follows', count(*) from public.follows
union all select 'demo accounts', count(*) from auth.users
  where lower(email) like '%@neoscale.demo' or lower(email) like '%@ecosystem.demo'
union all select 'demo accounts that are admins', count(*) from auth.users u
  where (lower(u.email) like '%@neoscale.demo' or lower(u.email) like '%@ecosystem.demo') and public.is_admin(u.id);
