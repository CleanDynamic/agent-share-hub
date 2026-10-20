-- =============================================================================
-- CA-08 · live checks: drafts don't load, and nothing can be added to a new post
-- =============================================================================
--
-- READ ONLY. THIS FILE IS SELECT ONLY: one SELECT statement, and nothing else.
-- No INSERT, UPDATE, DELETE, ALTER, CREATE, DROP, GRANT, SET or DO. It changes
-- nothing, writes nothing and can be run as often as you like.
--
-- HOW TO RUN IT. Paste the whole file, once, into the database SQL editor in
-- Lovable and run it. It returns ONE table, one row per check, with four
-- columns: check, expected, found, ok. Copy the whole table back, or take a
-- screenshot of every row.
--
-- HOW TO READ IT.
--   ok = true   the database is as the repository expects
--   ok = false  it is not: that row is a finding
--   ok = empty  information only (a count, a date, or something no migration
--               records either way)
-- The rows that decide the audit come first, under "A ·". The single most
-- important row is "A · builds.post_doc exists".
--
-- YOUR OWN DRAFTS. The row "I · your drafts (auth.uid())" counts the drafts of
-- whoever the editor runs as. The SQL editor usually runs as the database
-- itself, not as you, and then that row says so. To count your own drafts, find
-- the line marked PASTE-YOUR-USER-ID near the end, take out the two dashes at
-- its start, and replace PASTE-YOUR-USER-ID with your user id (the long id,
-- like 1a2b3c4d-…; NOT your email). Never paste your email here.
--
-- TWO READS ARE DYNAMIC. supabase_migrations.schema_migrations and
-- drizzle.__drizzle_migrations are read through query_to_xml(), a built-in that
-- runs a SELECT given as text, and only when the table exists and can be read.
-- That is what lets this file run whether or not either table is there.
-- Everything else is a plain SELECT on the catalogue.
--
-- No edge function is called by the two flows (Drafts, and Add on a new post),
-- so none is checked here.
--
-- Written for CA-08 against main at 6a5cd7f (20 October 2026). Sources are
-- cited as file:line in the repository (docs/audits/ca-08/report.md).
-- =============================================================================

WITH

-- ── A–B · every column the two flows read or write ───────────────────────────
-- From src/lib/build/builds.ts:28 (BUILD_COLUMNS), drafts.ts:55, making.ts:304,
-- nodes.ts:15, events.ts:13, nodeTypes.ts:13, media.ts:26, cover.ts:293,
-- sessions.ts:81, contexts/AuthContext.tsx:46, profile/colourSwatches.ts:70.
expected_columns (tbl, col, why) AS (
  VALUES
  ('builds', 'post_doc', 'BUILD_COLUMNS names it: Drafts, opening a draft, createBuild, updateBuild (20261016120000_post_threads.sql:22)'),
  ('builds', 'session_count', 'the Drafts list counts (20261001280000_sessions_and_making.sql:83)'),
  ('builds', 'prompt_count', 'refreshMakingStats (20261001280000:84)'),
  ('builds', 'ai_turn_count', 'refreshMakingStats (20261001280000:85)'),
  ('builds', 'models_used', 'refreshMakingStats (20261001280000:86)'),
  ('builds', 'making', 'every session write: setSessionMeta (20261001280000:87)'),
  ('builds', 'like_count', 'the Gallery feed since PT-09, not these flows (20261001180000_rc_build_social.sql)'),
  ('builds', 'comment_count', 'the Gallery feed since PT-09, not these flows (20261001180000_rc_build_social.sql)'),
  ('builds', 'id', 'BUILD_COLUMNS'), ('builds', 'creator_id', 'BUILD_COLUMNS, createBuild'), ('builds', 'slug', 'BUILD_COLUMNS, createBuild'),
  ('builds', 'title', 'BUILD_COLUMNS, createBuild, patchBuild'), ('builds', 'outcome', 'BUILD_COLUMNS, createBuild, patchBuild'),
  ('builds', 'shape', 'BUILD_COLUMNS, createBuild'), ('builds', 'status', 'BUILD_COLUMNS, createBuild, the Drafts filter'),
  ('builds', 'made_for', 'BUILD_COLUMNS, createBuild, patchBuild'), ('builds', 'made_with', 'BUILD_COLUMNS, createBuild, Made with'),
  ('builds', 'live_url', 'BUILD_COLUMNS, createBuild'), ('builds', 'repo_url', 'BUILD_COLUMNS, createBuild'),
  ('builds', 'hero_node_id', 'BUILD_COLUMNS'), ('builds', 'cover_media_id', 'BUILD_COLUMNS (20260827120000)'),
  ('builds', 'cost_setup', 'BUILD_COLUMNS, More details'), ('builds', 'cost_monthly', 'BUILD_COLUMNS, More details'),
  ('builds', 'currency', 'BUILD_COLUMNS'), ('builds', 'time_to_first_result', 'BUILD_COLUMNS, More details'),
  ('builds', 'completeness', 'BUILD_COLUMNS, patchBuild'), ('builds', 'reproduction_count', 'BUILD_COLUMNS'),
  ('builds', 'last_confirmed_at', 'BUILD_COLUMNS'), ('builds', 'last_confirmed_model', 'BUILD_COLUMNS'),
  ('builds', 'parent_build_id', 'BUILD_COLUMNS'), ('builds', 'root_build_id', 'BUILD_COLUMNS'),
  ('builds', 'forked_from_event_id', 'BUILD_COLUMNS'), ('builds', 'source_content_item_id', 'BUILD_COLUMNS'),
  ('builds', 'monetisation_type', 'BUILD_COLUMNS'), ('builds', 'price_gbp', 'BUILD_COLUMNS'), ('builds', 'donation_enabled', 'BUILD_COLUMNS'),
  ('builds', 'created_at', 'BUILD_COLUMNS'), ('builds', 'updated_at', 'BUILD_COLUMNS, the Drafts order'),
  ('builds', 'published_at', 'BUILD_COLUMNS'), ('builds', 'rebuild_note', 'BUILD_COLUMNS (20260827140000)'),
  ('builds', 'rebuild_count', 'BUILD_COLUMNS (20260827140000)'), ('builds', 'source_title_at_fork', 'BUILD_COLUMNS'),
  ('builds', 'source_handle_at_fork', 'BUILD_COLUMNS'), ('builds', 'solves_node_id', 'BUILD_COLUMNS'),
  ('build_nodes', 'id', 'NODE_COLUMNS'), ('build_nodes', 'build_id', 'NODE_COLUMNS'), ('build_nodes', 'parent_id', 'NODE_COLUMNS, nesting'),
  ('build_nodes', 'position', 'NODE_COLUMNS'), ('build_nodes', 'type', 'NODE_COLUMNS'), ('build_nodes', 'title', 'NODE_COLUMNS'),
  ('build_nodes', 'note', 'NODE_COLUMNS'), ('build_nodes', 'payload', 'NODE_COLUMNS: every step, tool, agent, code, file, colour'),
  ('build_nodes', 'source_ref', 'NODE_COLUMNS'), ('build_nodes', 'event_id', 'NODE_COLUMNS'), ('build_nodes', 'is_gap', 'NODE_COLUMNS'),
  ('build_nodes', 'created_at', 'NODE_COLUMNS'),
  ('build_events', 'id', 'EVENT_COLUMNS'), ('build_events', 'build_id', 'EVENT_COLUMNS'), ('build_events', 'ordinal', 'EVENT_COLUMNS'),
  ('build_events', 'occurred_at', 'EVENT_COLUMNS'), ('build_events', 'kind', 'EVENT_COLUMNS'), ('build_events', 'payload', 'EVENT_COLUMNS'),
  ('build_events', 'phase', 'EVENT_COLUMNS'), ('build_events', 'phase_title', 'EVENT_COLUMNS'), ('build_events', 'visibility', 'EVENT_COLUMNS'),
  ('build_events', 'produced_node_id', 'EVENT_COLUMNS'), ('build_events', 'created_at', 'EVENT_COLUMNS'),
  ('node_types', 'key', 'NODE_TYPE_COLUMNS'), ('node_types', 'label', 'NODE_TYPE_COLUMNS'), ('node_types', 'category', 'NODE_TYPE_COLUMNS'),
  ('node_types', 'colour', 'NODE_TYPE_COLUMNS'), ('node_types', 'icon', 'NODE_TYPE_COLUMNS'), ('node_types', 'schema', 'NODE_TYPE_COLUMNS'),
  ('node_types', 'renderer', 'NODE_TYPE_COLUMNS'), ('node_types', 'copyable', 'NODE_TYPE_COLUMNS'), ('node_types', 'is_active', 'NODE_TYPE_COLUMNS'),
  ('node_types', 'sort', 'NODE_TYPE_COLUMNS'),
  ('build_media', 'id', 'MEDIA_COLUMNS'), ('build_media', 'build_id', 'MEDIA_COLUMNS'), ('build_media', 'node_id', 'MEDIA_COLUMNS'),
  ('build_media', 'bucket', 'MEDIA_COLUMNS'), ('build_media', 'path', 'MEDIA_COLUMNS'), ('build_media', 'kind', 'MEDIA_COLUMNS'),
  ('build_media', 'mime', 'MEDIA_COLUMNS'), ('build_media', 'bytes', 'MEDIA_COLUMNS'), ('build_media', 'width', 'MEDIA_COLUMNS'),
  ('build_media', 'height', 'MEDIA_COLUMNS'), ('build_media', 'duration', 'MEDIA_COLUMNS'), ('build_media', 'poster_path', 'MEDIA_COLUMNS'),
  ('build_media', 'created_at', 'MEDIA_COLUMNS'), ('build_media', 'post_position', 'POST_MEDIA_COLUMNS (20260911120000:100)'),
  ('build_media', 'post_text', 'POST_MEDIA_COLUMNS (20260911140000:111)'),
  ('import_sessions', 'id', 'SESSION_COLUMNS'), ('import_sessions', 'user_id', 'the owner policies'), ('import_sessions', 'client', 'SESSION_COLUMNS'),
  ('import_sessions', 'model', 'SESSION_COLUMNS (20261001280000:10)'), ('import_sessions', 'target_build_id', 'SESSION_COLUMNS'),
  ('import_sessions', 'build_id', 'SESSION_COLUMNS'), ('import_sessions', 'created_at', 'SESSION_COLUMNS'),
  ('import_sessions', 'updated_at', 'setSessionModel'), ('import_sessions', 'status', 'listSessions filter'),
  ('import_sessions', 'proposal', 'SESSION_COLUMNS (first prompt, turn counts)'),
  ('profiles', 'colour_swatches', 'the colour picker (20261020120000_ca06_colour_swatches.sql:19)'),
  ('profiles', 'id', 'fetchProfile'), ('profiles', 'username', 'fetchProfile'), ('profiles', 'display_name', 'fetchProfile'),
  ('profiles', 'avatar_url', 'fetchProfile'), ('profiles', 'banner_url', 'fetchProfile'), ('profiles', 'bio', 'fetchProfile'),
  ('profiles', 'website_url', 'fetchProfile'), ('profiles', 'twitter_handle', 'fetchProfile'), ('profiles', 'is_admin', 'fetchProfile'),
  ('profiles', 'is_creator', 'fetchProfile'), ('profiles', 'is_curator', 'fetchProfile'), ('profiles', 'curator_application_status', 'fetchProfile'),
  ('profiles', 'account_type', 'fetchProfile'), ('profiles', 'user_interests', 'fetchProfile'), ('profiles', 'follower_count', 'fetchProfile'),
  ('profiles', 'following_count', 'fetchProfile'), ('profiles', 'joined_at', 'fetchProfile')
),
live_columns AS (
  SELECT c.table_name::text AS tbl, c.column_name::text AS col,
         CASE WHEN c.data_type = 'ARRAY' THEN replace(c.udt_name::text, '_', '') || '[]' ELSE c.data_type::text END AS typ
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name IN ('builds', 'build_nodes', 'build_events', 'node_types', 'build_media', 'import_sessions', 'profiles')
),
column_rows AS (
  SELECT e.tbl, e.col, e.why, l.typ
  FROM expected_columns e
  LEFT JOIN live_columns l ON l.tbl = e.tbl AND l.col = e.col
),

-- ── C · the functions the flows call, directly or through a policy or trigger ─
expected_functions (fn, types, why) AS (
  VALUES
  ('gallery_facets', 'jsonb', 'RPC: the composer reads it on load for Who it is for (gallery.ts:761; 20260824140000:35)'),
  ('set_build_post_media', 'uuid, uuid[]', 'RPC: the Post tab and the cover save the picture set (cover.ts:404; 20261016120000:78)'),
  ('is_admin', 'uuid', 'called by every builds, build_nodes and build_media policy (20260316202122:77)'),
  ('set_updated_at_timestamp', '', 'trigger function of trg_builds_updated_at (20260427120431:2)'),
  ('sync_build_cover_from_post_media', '', 'trigger function of trg_build_media_cover_mirror (20260911120000)'),
  ('enforce_import_ceilings', '', 'trigger function on import_sessions inserts, the connector''s (20260921120000)'),
  ('rc_xp_build_visible', '', 'trigger function that runs on every builds INSERT (20261001240000:197)'),
  ('rc_grant_xp', 'uuid, integer, text, text, uuid', 'called by the XP triggers (20261001240000:109)')
),
live_functions AS (
  SELECT p.proname::text AS fn, oidvectortypes(p.proargtypes) AS types, pg_get_function_identity_arguments(p.oid) AS args, p.prosrc
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
),

-- ── E · policies: as the newest migration that defines each one writes it ────
-- builds and build_nodes: 20260825112817 (the same text as 20260823120000:226-300);
-- the restrictive one: 20261001190000_rc_reports.sql:49; build_media: either
-- 20260823140000:70-110 (set A) or 20260825112911:60-95 (set B); import_sessions:
-- 20260917120000:213-229; profiles: 20260316202122:20-27.
expected_policies (tbl, pol, cmd, permissive, roles, using_raw, check_raw, source, alt) AS (
  VALUES
  ('builds', 'Builds are readable unless draft', 'SELECT', 'PERMISSIVE', '{public}',
     $$status <> 'draft' OR creator_id = (select auth.uid()) OR public.is_admin((select auth.uid()))$$, NULL::text, '20260825112817:226', NULL::text),
  ('builds', 'Users create their own builds', 'INSERT', 'PERMISSIVE', '{public}',
     NULL, $$creator_id = (select auth.uid())$$, '20260825112817:234', NULL),
  ('builds', 'Creators and admins update builds', 'UPDATE', 'PERMISSIVE', '{public}',
     $$creator_id = (select auth.uid()) OR public.is_admin((select auth.uid()))$$, NULL, '20260825112817:238', NULL),
  ('builds', 'Creators and admins delete builds', 'DELETE', 'PERMISSIVE', '{public}',
     $$creator_id = (select auth.uid()) OR public.is_admin((select auth.uid()))$$, NULL, '20260825112817:245', NULL),
  ('builds', 'Hidden builds are read by their creator and admins', 'SELECT', 'RESTRICTIVE', '{anon,authenticated}',
     $$NOT is_hidden OR creator_id = (select auth.uid()) OR public.is_admin((select auth.uid()))$$, NULL, '20261001190000_rc_reports.sql:49', NULL),
  ('build_nodes', 'Build nodes follow build readability', 'SELECT', 'PERMISSIVE', '{public}',
     $$EXISTS (SELECT 1 FROM public.builds b WHERE b.id = build_nodes.build_id AND (b.status <> 'draft' OR b.creator_id = (select auth.uid()) OR public.is_admin((select auth.uid()))))$$, NULL, '20260825112817:253', NULL),
  ('build_nodes', 'Build nodes follow build writability on insert', 'INSERT', 'PERMISSIVE', '{public}',
     NULL, $$EXISTS (SELECT 1 FROM public.builds b WHERE b.id = build_nodes.build_id AND (b.creator_id = (select auth.uid()) OR public.is_admin((select auth.uid()))))$$, '20260825112817:267', NULL),
  ('build_nodes', 'Build nodes follow build writability on update', 'UPDATE', 'PERMISSIVE', '{public}',
     $$EXISTS (SELECT 1 FROM public.builds b WHERE b.id = build_nodes.build_id AND (b.creator_id = (select auth.uid()) OR public.is_admin((select auth.uid()))))$$, NULL, '20260825112817:280', NULL),
  ('build_nodes', 'Build nodes follow build writability on delete', 'DELETE', 'PERMISSIVE', '{public}',
     $$EXISTS (SELECT 1 FROM public.builds b WHERE b.id = build_nodes.build_id AND (b.creator_id = (select auth.uid()) OR public.is_admin((select auth.uid()))))$$, NULL, '20260825112817:293', NULL),
  ('build_media', 'Build media follow build readability', 'SELECT', 'PERMISSIVE', '{public}',
     $$EXISTS (SELECT 1 FROM public.builds b WHERE b.id = build_media.build_id AND (b.status <> 'draft' OR b.creator_id = (select auth.uid()) OR public.is_admin((select auth.uid()))))$$, NULL, '20260823140000:70', 'A'),
  ('build_media', 'Build media follow build writability on insert', 'INSERT', 'PERMISSIVE', '{public}',
     NULL, $$EXISTS (SELECT 1 FROM public.builds b WHERE b.id = build_media.build_id AND (b.creator_id = (select auth.uid()) OR public.is_admin((select auth.uid()))))$$, '20260823140000:84', 'A'),
  ('build_media', 'Build media follow build writability on update', 'UPDATE', 'PERMISSIVE', '{public}',
     $$EXISTS (SELECT 1 FROM public.builds b WHERE b.id = build_media.build_id AND (b.creator_id = (select auth.uid()) OR public.is_admin((select auth.uid()))))$$, NULL, '20260823140000:97', 'A'),
  ('build_media', 'Build media follow build writability on delete', 'DELETE', 'PERMISSIVE', '{public}',
     $$EXISTS (SELECT 1 FROM public.builds b WHERE b.id = build_media.build_id AND (b.creator_id = (select auth.uid()) OR public.is_admin((select auth.uid()))))$$, NULL, '20260823140000:110', 'A'),
  ('build_media', 'Build media is readable by build readers', 'SELECT', 'PERMISSIVE', '{public}',
     $$EXISTS (SELECT 1 FROM public.builds b WHERE b.id = build_media.build_id AND (b.status <> 'draft' OR b.creator_id = (select auth.uid()) OR public.is_admin((select auth.uid()))))$$, NULL, '20260825112911:60', 'B'),
  ('build_media', 'Build media is writable by build owners', 'ALL', 'PERMISSIVE', '{public}',
     $$EXISTS (SELECT 1 FROM public.builds b WHERE b.id = build_media.build_id AND (b.creator_id = (select auth.uid()) OR public.is_admin((select auth.uid()))))$$,
     $$EXISTS (SELECT 1 FROM public.builds b WHERE b.id = build_media.build_id AND (b.creator_id = (select auth.uid()) OR public.is_admin((select auth.uid()))))$$, '20260825112911:74', 'B'),
  ('import_sessions', 'Import sessions are readable by their owner', 'SELECT', 'PERMISSIVE', '{authenticated}',
     $$(select auth.uid()) = user_id$$, NULL, '20260917120000:213', NULL),
  ('import_sessions', 'Import sessions are opened by their owner', 'INSERT', 'PERMISSIVE', '{authenticated}',
     NULL, $$(select auth.uid()) = user_id$$, '20260917120000:218', NULL),
  ('import_sessions', 'Import sessions are updated by their owner', 'UPDATE', 'PERMISSIVE', '{authenticated}',
     $$(select auth.uid()) = user_id$$, $$(select auth.uid()) = user_id$$, '20260917120000:223', NULL),
  ('import_sessions', 'Import sessions are deleted by their owner', 'DELETE', 'PERMISSIVE', '{authenticated}',
     $$(select auth.uid()) = user_id$$, NULL, '20260917120000:229', NULL),
  ('profiles', 'Profiles are viewable by everyone', 'SELECT', 'PERMISSIVE', '{public}', $$true$$, NULL, '20260316202122:20', NULL),
  ('profiles', 'Users can update their own profile', 'UPDATE', 'PERMISSIVE', '{public}', $$auth.uid() = id$$, NULL, '20260316202122:23', NULL),
  ('profiles', 'Users can insert their own profile', 'INSERT', 'PERMISSIVE', '{public}', NULL, $$auth.uid() = id$$, '20260316202122:26', NULL)
),
live_policies AS (
  SELECT p.tablename::text AS tbl, p.policyname::text AS pol, p.cmd::text AS cmd, p.permissive::text AS permissive,
         p.roles::text AS roles, p.qual AS using_raw, p.with_check AS check_raw
  FROM pg_policies p
  WHERE p.schemaname = 'public' AND p.tablename IN ('builds', 'build_nodes', 'build_media', 'import_sessions', 'profiles')
),
-- One way of writing a policy expression, so the migration's text and the
-- catalogue's print compare: (select auth.uid()) and ( SELECT auth.uid() AS uid)
-- read as auth.uid(), the admin check as rls_initplan may wrap it reads as
-- is_admin(auth.uid()), and casts, "public.", spaces, quotes and brackets go.
policy_parts AS (
  SELECT 'repo' AS side, e.tbl, e.pol, part.kind, part.raw
  FROM expected_policies e CROSS JOIN LATERAL (VALUES ('using', e.using_raw), ('check', e.check_raw)) AS part(kind, raw)
  UNION ALL
  SELECT 'live', l.tbl, l.pol, part.kind, part.raw
  FROM live_policies l CROSS JOIN LATERAL (VALUES ('using', l.using_raw), ('check', l.check_raw)) AS part(kind, raw)
),
policy_norm AS (
  SELECT side, tbl, pol, kind,
         CASE WHEN raw IS NULL THEN NULL ELSE
           lower(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(raw,
             '\(\s*select\s+(public\.)?is_admin\(\(\s*select\s+auth\.uid\(\)\s+as\s+uid\)\)\s+as\s+is_admin\)', 'is_admin(auth.uid())', 'gi'),
             '\(\s*select\s+auth\.uid\(\)(\s+as\s+uid)?\s*\)', 'auth.uid()', 'gi'),
             '::[a-z_]+(\[\])?', '', 'gi'),
             'public\.', '', 'gi'),
             '[[:space:]()"]', '', 'g'))
         END AS norm
  FROM policy_parts
),
policy_compare AS (
  SELECT e.tbl, e.pol, e.cmd, e.permissive, e.roles, e.source, e.alt,
         l.pol IS NOT NULL AS present, l.cmd AS live_cmd, l.permissive AS live_permissive, l.roles AS live_roles,
         l.using_raw AS live_using, l.check_raw AS live_check,
         (SELECT norm FROM policy_norm n WHERE n.side = 'repo' AND n.tbl = e.tbl AND n.pol = e.pol AND n.kind = 'using') AS repo_using,
         (SELECT norm FROM policy_norm n WHERE n.side = 'repo' AND n.tbl = e.tbl AND n.pol = e.pol AND n.kind = 'check') AS repo_check,
         (SELECT norm FROM policy_norm n WHERE n.side = 'live' AND n.tbl = e.tbl AND n.pol = e.pol AND n.kind = 'using') AS norm_using,
         (SELECT norm FROM policy_norm n WHERE n.side = 'live' AND n.tbl = e.tbl AND n.pol = e.pol AND n.kind = 'check') AS norm_check
  FROM expected_policies e
  LEFT JOIN live_policies l ON l.tbl = e.tbl AND l.pol = e.pol
),
policy_rows AS (
  SELECT c.*,
         c.present AND c.live_cmd = c.cmd AND c.live_permissive = c.permissive AND c.live_roles = c.roles
           AND c.repo_using IS NOT DISTINCT FROM c.norm_using AND c.repo_check IS NOT DISTINCT FROM c.norm_check AS matches
  FROM policy_compare c
),
media_sets AS (
  SELECT alt, bool_and(matches) AS whole FROM policy_rows WHERE alt IS NOT NULL GROUP BY alt
),

-- ── F · triggers on the five tables ──────────────────────────────────────────
expected_triggers (tbl, tg, fn, source, note) AS (
  VALUES
  ('builds', 'trg_builds_updated_at', 'set_updated_at_timestamp', '20260825112817:169', ''),
  ('builds', 'trg_builds_rebuild_count_status', 'sync_build_rebuild_count', '20260827140000:184', ''),
  ('builds', 'trg_builds_rebuild_count_delete', 'sync_build_rebuild_count', '20260827140000:197', ''),
  ('builds', 'trg_rc_xp_build_visible', 'rc_xp_build_visible', '20261001240000:233', ''),
  ('builds', 'trg_rc_xp_build_reconfirmed', 'rc_xp_build_reconfirmed', '20261001240000:282', ''),
  ('builds', 'trg_rc_notify_build_visible', 'rc_notify_build_visible', '20261001200000:235', ' (runs only on a publish: if absent, these flows lose nothing)'),
  ('builds', 'trg_rc_badge_build_visible', 'rc_badge_build_visible', '20261001260000:396', ' (runs only on a publish: if absent, these flows lose nothing)'),
  ('builds', 'trg_rc_badge_build_reconfirmed', 'rc_badge_build_reconfirmed', '20261001260000:447', ' (runs only on a re-confirm: if absent, these flows lose nothing)'),
  ('build_media', 'trg_build_media_cover_mirror', 'sync_build_cover_from_post_media', '20260911120000:333', ''),
  ('import_sessions', 'enforce_import_ceilings', 'enforce_import_ceilings', '20260921120000:187', ''),
  ('profiles', 'trg_create_default_collection', 'create_default_collection_for_user', '20260501102008:86', ''),
  ('profiles', 'on_profile_created_progress', 'handle_new_user_progress', '20260612120000_gamification_schema.sql:68', ' (runs only on a new profile: if absent, these flows lose nothing)')
),
live_triggers AS (
  SELECT c.relname::text AS tbl, t.tgname::text AS tg, p.proname::text AS fn, t.tgenabled::text AS enabled,
         regexp_replace(regexp_replace(pg_get_triggerdef(t.oid), '^CREATE (CONSTRAINT )?TRIGGER \S+ ', ''), '[[:space:]]+', ' ', 'g') AS def
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE n.nspname = 'public' AND NOT t.tgisinternal
    AND c.relname IN ('builds', 'build_nodes', 'build_media', 'import_sessions', 'profiles')
),

-- ── G · CHECK constraints on the five tables, and the two foreign keys a write needs
expected_checks (tbl, con, must_contain, source) AS (
  VALUES
  ('builds', 'builds_status_check', 'draft', '20260825112817:64'),
  ('builds', 'builds_shape_check', 'other', '20260825112817:65'),
  ('builds', 'builds_session_count_check', 'session_count >= 0', '20261001280000:95'),
  ('builds', 'builds_prompt_count_check', 'prompt_count >= 0', '20261001280000:96'),
  ('builds', 'builds_ai_turn_count_check', 'ai_turn_count >= 0', '20261001280000:97'),
  ('builds', 'builds_making_object_check', 'jsonb_typeof(making)', '20261001280000:98'),
  ('builds', 'builds_post_doc_check', '200000', '20261016120000_post_threads.sql:35'),
  ('build_media', 'build_media_kind_check', 'image', '20260825112911:41'),
  ('build_media', 'build_media_post_position_range_check', '39', '20261016120000_post_threads.sql:62 (was 0..3 in 20260911120000:122)'),
  ('build_media', 'build_media_post_position_kind_check', 'video', '20260911120000:139'),
  ('build_media', 'build_media_post_text_check', '280', '20260911140000:130'),
  ('import_sessions', 'import_sessions_client_check', 'claude-code', '20260917120000:110'),
  ('import_sessions', 'import_sessions_status_check', 'parsed', '20260917120000:120'),
  ('import_sessions', 'import_sessions_total_chars_check', '400000', '20260917120000:128'),
  ('import_sessions', 'import_sessions_model_length_check', '64', '20261001280000:19'),
  ('profiles', 'profiles_level_check', 'builder', '20260429123847:12'),
  ('profiles', 'profiles_colour_swatches_shape', 'colour_swatches', '20261020120000_ca06_colour_swatches.sql:30')
),
live_checks AS (
  SELECT c.relname::text AS tbl, k.conname::text AS con, k.contype::text AS kind, pg_get_constraintdef(k.oid) AS def
  FROM pg_constraint k
  JOIN pg_class c ON c.oid = k.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname IN ('builds', 'build_nodes', 'build_media', 'import_sessions', 'profiles')
),

-- ── J · the migration records ────────────────────────────────────────────────
migrations (version, name) AS (
  VALUES
  ('20261020120000', 'ca06_colour_swatches'),
  ('20261017110000', 'tf07_document_fields'),
  ('20261016120000', 'post_threads'),
  ('20261001300000', 'sandbox_node_types'),
  ('20261001290000', 'rls_initplan'),
  ('20261001280000', 'sessions_and_making'),
  ('20261001270000', 'ui_retire_frame'),
  ('20261001260000', 'rc_badge_catalogue'),
  ('20261001250000', 'rc_xp_reset'),
  ('20261001240000', 'rc_xp_build_events'),
  ('20261001230000', 'rc_xp_close'),
  ('20261001220000', 'rc_maker_stats'),
  ('20261001210000', 'rc_dm_builds'),
  ('20261001200000', 'rc_build_notifications'),
  ('20261001190000', 'rc_reports'),
  ('20261001180000', 'rc_build_social'),
  ('20261001170000', 'rc_rebuild_tree'),
  ('20261001160000', 'rc_top_solvers'),
  ('20261001150000', 'rc_build_feed_following'),
  ('20261001140000', 'rc_search_builds'),
  ('20261001130000', 'rc_clear_legacy_posts'),
  ('20261001123000', 'rc_rotate_demo_passwords'),
  ('20261001120000', 'rc_backup_legacy'),
  ('20260921130000', 'builds_created_via'),
  ('20260921120100', 'import_expiry_cron'),
  ('20260921120000', 'import_ceilings'),
  ('20260917120000', 'import_sessions'),
  ('20260911140000', 'build_post_text'),
  ('20260911120000', 'build_post_media'),
  ('20260830140000', 'single_me_too_counter'),
  ('20260830120000', 'solution_build_id'),
  ('20260829220000', 'build_feed_bounty_items'),
  ('20260829200000', 'bounty_me_too_marks'),
  ('20260829180000', 'drop_bounty_shims'),
  ('20260829160000', 'accept_bounty_solution'),
  ('20260829140000', 'repoint_meta_sub_definitions'),
  ('20260829120000', 'repoint_bounty_satellites'),
  ('20260828160000', 'repoint_solutions'),
  ('20260828140000', 'bounties_header_table'),
  ('20260828120000', 'build_feed_function'),
  ('20260827140000', 'rebuild_columns'),
  ('20260827130000', 'node_type_help_copy'),
  ('20260827120000', 'build_cover_media'),
  ('20260825140200', 'build_media_object_readability'),
  ('20260825140100', 'build_reproductions_canonical_shape'),
  ('20260825140000', 'build_media_canonical_shape'),
  ('20260825120000', 'build_source_content_item'),
  ('20260825113210', 'ea5ad113-252a-4435-b98a-31bc5af80196'),
  ('20260825113123', '2cf4adcf-ff6f-4a32-9196-636f6bbd9010'),
  ('20260825113022', '791c27e2-3f56-4e61-bb0b-ea2f421f2823'),
  ('20260825112911', 'c368fcd4-39b2-4421-94b5-151ce1da4e18'),
  ('20260825112817', '44a7f3a5-87dd-4287-a1db-327f75ae864b'),
  ('20260824160000', 'build_explanation_layers'),
  ('20260824140000', 'gallery_facets'),
  ('20260824120000', 'build_reproductions'),
  ('20260823140000', 'build_media_storage'),
  ('20260823130000', 'node_type_registry_seed'),
  ('20260823120000', 'build_record_core_schema'),
  ('20260630204810', '8ba8dfd6-02b1-479f-971e-c4866c636d8e'),
  ('20260630204548', 'cc851316-4434-4fa6-bf7f-7c23e703db75'),
  ('20260629173811', 'aab7c6c1-3342-47f6-ae72-b26097e01645'),
  ('20260629172454', '7e1bb160-6bb2-418c-986d-bbf232ac0e6b'),
  ('20260629163904', '9903135e-5d36-4436-aa53-80419a3863bb'),
  ('20260629162842', 'd6a32f50-e79a-4551-9296-47f9f181b441'),
  ('20260612120000', 'gamification_schema'),
  ('20260608123002', 'c010fe2c-eb34-4b0e-bf5a-6d5572eb0129'),
  ('20260521120000', 'auth_onboarding_columns'),
  ('20260516234913', '7cc4a06a-35b3-4606-ba8d-81475bd52f2e'),
  ('20260516234150', '481c82b0-9401-4db5-af4c-957227196ccb'),
  ('20260516233020', 'fb99e3fb-451a-4f18-95a0-45c9be4e6570'),
  ('20260516231924', '3ef2e57d-6611-46f5-9bff-3950247daed1'),
  ('20260516230940', '3e5f22e9-272a-4c2e-ae86-d2fd0eb251f8'),
  ('20260516224942', '739b55b7-3672-4ee8-899e-f44738c67c9e'),
  ('20260504092721', '33427a8a-2797-4dd6-ac80-b425b4bbca1a'),
  ('20260504091408', '13c3b629-e1a2-43a0-ae65-a6f4f17d9759'),
  ('20260504084620', 'bb398253-4045-4962-a742-191dc1992943'),
  ('20260503132953', 'dde1ba26-d63c-44c1-9d6c-4ddfd98e2231'),
  ('20260503114930', '77a6a519-ace1-4f67-ab03-8fbeebec01a9'),
  ('20260503112534', '00c54414-fe3b-4208-9091-69b9f3cb67e8'),
  ('20260503002204', '9710f578-b7ef-4bd7-9e8f-d522645ec61d'),
  ('20260503001534', 'e19ad1f2-1e2e-4f02-9496-f6720d8bc45c'),
  ('20260501102008', '1367a1e2-4a0f-41c1-8d29-906f789d3153'),
  ('20260430104203', 'ad2fa2d6-197d-43ed-a10f-4a5c0a2102de'),
  ('20260430100814', '257e8571-8300-4ffe-87c4-73078d07f457'),
  ('20260429130148', '9d386b5b-e5a8-43ed-a440-8d5149a55dec'),
  ('20260429123847', '072a490c-561e-4877-953f-efe49e02e152'),
  ('20260429115437', '32d4a306-8806-45d8-9daf-a924d91e2370'),
  ('20260429105837', 'bc1f4e7e-d351-4f9e-950f-b4bbf692d19d'),
  ('20260428155936', '2f42254e-90e0-44bf-a619-7782954c5405'),
  ('20260428130947', '9e3f7ff3-cde5-4dda-b3f6-a61d1100f6a6'),
  ('20260428123807', '4be49221-69c3-4755-af6d-8b9124d0569a'),
  ('20260428123444', '87917aaf-75b1-45a8-86c9-3a2349f390bb'),
  ('20260428122824', '30727b0e-a687-4569-8997-f506bfbdb884'),
  ('20260427161511', 'ff997743-f02b-454e-941f-1616bdc8e857'),
  ('20260427120431', 'b6805442-8ddb-4942-9b47-67e19d681b6b'),
  ('20260416000001', 'document_editing_system'),
  ('20260415000001', 'add_position_xy'),
  ('20260414214838', '76580f31-e657-41e6-84ea-81d4e29229d0'),
  ('20260410103732', '9340f19d-9aa4-40c2-b7f3-c077dfab4730'),
  ('20260409000002', 'canvas_system'),
  ('20260409000001', 'tutorial_block'),
  ('20260407000001', 'add_group_fields'),
  ('20260406000001', 'advanced_blocks'),
  ('20260405000001', 'add_post_type'),
  ('20260324200002', 'reblog_seed_data'),
  ('20260324200001', 'reblog_system_v2'),
  ('20260324142709', 'ea749ba8-99f2-4faf-842f-012e1ac18020'),
  ('20260324000001', 'restructure_post_categories'),
  ('20260323000001', 'bounty_system'),
  ('20260322105221', 'e39e232c-b01e-4def-b400-5f3f537e1a17'),
  ('20260320120000', 'populate-tools-registry'),
  ('20260320000001', 'universal_reblog_and_library_publish'),
  ('20260319132425', '37b9e94f-ae22-45e1-922d-31bcc92c2989'),
  ('20260319131843', '3f938006-56fa-4350-b3f0-5514addc0b3e'),
  ('20260319131242', '5283f078-411f-4a9f-8803-1fdd5b7f749c'),
  ('20260319125923', '4ac6e82f-ffc8-4e31-91f7-772f62f6c9b5'),
  ('20260319122725', 'b5b25022-7298-4a3b-89c8-ac8c7bf9d521'),
  ('20260319121148', '5cf22801-40ec-4d74-b8e5-b976c3eb2c09'),
  ('20260318233828', '2da4767c-6976-4990-8706-0f7134330ff1'),
  ('20260318231707', '96e9f397-4143-422d-afcd-bcf935904a31'),
  ('20260318230411', '387fd960-f561-4141-a7d7-581f415c4040'),
  ('20260318203403', '6373c0e0-5bc1-4d06-80f9-ceb9ada4d4bd'),
  ('20260318200722', '407e7641-8666-4bc4-a570-f4c6c1e27b5d'),
  ('20260318185802', 'f96d4825-c82c-4519-a9fa-5bc879122aeb'),
  ('20260318185439', '68df3ada-ec24-4ac8-9c6c-174d13f5603e'),
  ('20260318182202', '617891fe-9070-49a1-9fb9-4cd48ced84aa'),
  ('20260318174508', '8fe33508-5071-42df-b4f0-e200e490d24b'),
  ('20260318173159', '7b7cc244-2211-47ca-9462-b67b0d626433'),
  ('20260318163434', '73e9a436-019e-4bc1-8518-6f6f57e536c3'),
  ('20260318163423', '55c629fe-1246-4afa-a3f4-31e70ff2529a'),
  ('20260318160924', '04cae8db-315d-48cd-90a2-8f284c9f8a93'),
  ('20260318160154', 'f6278df5-990c-4693-ad81-d9ffe100399e'),
  ('20260318155439', 'd28e6f4b-4b3d-4802-a29a-89f86f16eaaa'),
  ('20260317020520', '4efb731e-61ff-4b61-96ff-40e0f4c8990c'),
  ('20260317020511', '3d058e59-bb90-4f44-85f4-3f76718dbc19'),
  ('20260317015814', 'e62adbcc-4a5f-4060-aed1-509fa9166a07'),
  ('20260317011930', '6d695287-a331-4fde-89ae-9e2e7a14409a'),
  ('20260317005528', '1015532f-c0d6-4947-b067-18cba1f58bb7'),
  ('20260316225912', '550a88a9-007d-4f20-adeb-c47708cb56c0'),
  ('20260316225805', 'e838049f-edea-4045-8611-3aa9ce61edee'),
  ('20260316224525', 'fc1dbcec-c7f7-4db4-91de-9c5fb3beb311'),
  ('20260316223257', 'c92c06cd-4700-43b2-94fc-1267eddc879c'),
  ('20260316212620', '62fdb653-973e-43d7-9b97-90b3dae978f6'),
  ('20260316212246', 'd7154108-b974-41b7-9df2-7525b485cff9'),
  ('20260316210823', '3b28178f-0759-4e00-a023-23c1838f261d'),
  ('20260316210356', '43f495a4-b03c-42d0-b19f-0f255baeca54'),
  ('20260316204932', 'fa3d7bf6-9c97-4691-9871-4e7a56414a03'),
  ('20260316204035', '0df3a8f3-d91f-4d33-8e19-eb4b0d15f6ae'),
  ('20260316203528', '24725248-e26e-42ea-b74c-2a124e04656c'),
  ('20260316202132', '80d697cf-a3dd-4954-b8d9-e7d3190b0fc8'),
  ('20260316202122', '7957ed86-2966-4526-bc9a-0f37309ec08f')
),
drizzle_journal (tag, created_at, repo_file) AS (
  VALUES
  ('0011_sandbox_node_types', 1791897168380::bigint, '20261001300000_sandbox_node_types'),
  ('0010_sessions_and_making', 1791469695447, '20261001280000_sessions_and_making'),
  ('0009_rc_xp_build_events', 1790779321751, '20261001240000_rc_xp_build_events'),
  ('0008_rc_xp_close', 1790779244872, '20261001230000_rc_xp_close'),
  ('0007_imports_storage_object_policies_and_drop_helper', 1790190703696, NULL),
  ('0006_temp_admin_apply_migration_helper', 1790190558332, NULL),
  ('0005_repoint_bounty_satellites', 1790190514747, '20260829120000_repoint_bounty_satellites'),
  ('0004_repoint_solutions_at_bounties', 1790190407914, '20260828160000_repoint_solutions'),
  ('0003_bounties_header_table', 1790190274275, '20260828140000_bounties_header_table'),
  ('0002_node_type_help_copy_and_build_feed', 1790172985048, '20260827130000_node_type_help_copy'),
  ('0001_build_cover_media_and_rebuild_columns', 1790172920288, '20260827120000_build_cover_media'),
  ('0000_builds_created_via', 1790172814123, '20260921130000_builds_created_via')
),
supabase_doc AS (
  SELECT CASE
           WHEN to_regclass('supabase_migrations.schema_migrations') IS NOT NULL
            AND has_table_privilege(to_regclass('supabase_migrations.schema_migrations'), 'SELECT')
           THEN query_to_xml('SELECT version FROM supabase_migrations.schema_migrations', false, false, '')
         END AS doc
),
supabase_recorded AS (
  SELECT (xpath('/row/version/text()', r))[1]::text AS version
  FROM supabase_doc CROSS JOIN LATERAL unnest(xpath('/table/row', supabase_doc.doc)) AS r
),
drizzle_doc AS (
  SELECT CASE
           WHEN to_regclass('drizzle.__drizzle_migrations') IS NOT NULL
            AND has_table_privilege(to_regclass('drizzle.__drizzle_migrations'), 'SELECT')
           THEN query_to_xml('SELECT created_at FROM drizzle.__drizzle_migrations', false, false, '')
         END AS doc
),
drizzle_recorded AS (
  SELECT ((xpath('/row/created_at/text()', r))[1]::text)::bigint AS created_at
  FROM drizzle_doc CROSS JOIN LATERAL unnest(xpath('/table/row', drizzle_doc.doc)) AS r
),

-- ── every row, in the order they are shown ──────────────────────────────────
checks (section, sort, "check", expected, found, ok) AS (

  -- A · the rows that decide it
  SELECT 'A', 1, 'A · builds.post_doc exists (20261016120000_post_threads.sql)',
         'present: every builds read and write the site makes names it',
         coalesce((SELECT typ FROM column_rows WHERE tbl = 'builds' AND col = 'post_doc'), 'MISSING'),
         (SELECT typ IS NOT NULL FROM column_rows WHERE tbl = 'builds' AND col = 'post_doc')
  UNION ALL
  SELECT 'A', 2, 'A · set_build_post_media takes 40 pictures (20261016120000_post_threads.sql:78)',
         '40 (post_threads applied)',
         coalesce((SELECT CASE WHEN prosrc ~ '_wanted\s*>\s*40\M' THEN '40'
                               WHEN prosrc ~ '_wanted\s*>\s*4\M' THEN '4 (the version before post_threads)'
                               ELSE 'another version' END
                   FROM live_functions WHERE fn = 'set_build_post_media' LIMIT 1), 'MISSING'),
         coalesce((SELECT prosrc ~ '_wanted\s*>\s*40\M' FROM live_functions WHERE fn = 'set_build_post_media' LIMIT 1), false)
  UNION ALL
  SELECT 'A', 3, 'A · node_types.document lists made_by (20261017110000_tf07_document_fields.sql)',
         'made_by, media_id and preview_media_id among its fields',
         coalesce((SELECT string_agg(f ->> 'key', ', ' ORDER BY f ->> 'key')
                     FROM public.node_types nt CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(nt.schema -> 'fields') = 'array' THEN nt.schema -> 'fields' ELSE '[]'::jsonb END) AS f
                    WHERE nt.key = 'document'), '(no fields)'),
         (SELECT bool_or(f ->> 'key' = 'made_by')
            FROM public.node_types nt CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(nt.schema -> 'fields') = 'array' THEN nt.schema -> 'fields' ELSE '[]'::jsonb END) AS f
           WHERE nt.key = 'document')
  UNION ALL
  SELECT 'A', 4, 'A · profiles.colour_swatches exists (20261020120000_ca06_colour_swatches.sql)',
         'present (the colour picker; it fails silently without it)',
         coalesce((SELECT typ FROM column_rows WHERE tbl = 'profiles' AND col = 'colour_swatches'), 'MISSING'),
         (SELECT typ IS NOT NULL FROM column_rows WHERE tbl = 'profiles' AND col = 'colour_swatches')
  UNION ALL
  SELECT 'A', 5, 'A · builds columns the two flows name',
         (SELECT count(*) FROM expected_columns WHERE tbl = 'builds' AND col NOT IN ('like_count', 'comment_count'))::text || ' of ' ||
         (SELECT count(*) FROM expected_columns WHERE tbl = 'builds' AND col NOT IN ('like_count', 'comment_count'))::text || ' present',
         (SELECT count(*) FILTER (WHERE typ IS NOT NULL)::text || ' present' ||
                 coalesce('; missing: ' || string_agg(col, ', ') FILTER (WHERE typ IS NULL), '')
            FROM column_rows WHERE tbl = 'builds' AND col NOT IN ('like_count', 'comment_count')),
         (SELECT bool_and(typ IS NOT NULL) FROM column_rows WHERE tbl = 'builds' AND col NOT IN ('like_count', 'comment_count'))
  UNION ALL
  SELECT 'A', 6, 'A · the other tables'' columns the two flows name (build_nodes, build_events, node_types, build_media, import_sessions, profiles)',
         'all present but profiles.colour_swatches, which is row A 4',
         (SELECT count(*) FILTER (WHERE typ IS NOT NULL)::text || ' of ' || count(*)::text || ' present' ||
                 coalesce('; missing: ' || string_agg(tbl || '.' || col, ', ') FILTER (WHERE typ IS NULL), '')
            FROM column_rows WHERE tbl <> 'builds' AND NOT (tbl = 'profiles' AND col = 'colour_swatches')),
         (SELECT bool_and(typ IS NOT NULL) FROM column_rows WHERE tbl <> 'builds' AND NOT (tbl = 'profiles' AND col = 'colour_swatches'))
  UNION ALL
  SELECT 'A', 7, 'A · authenticated may insert and update builds',
         'true, true',
         has_table_privilege('authenticated', 'public.builds', 'INSERT')::text || ', ' || has_table_privilege('authenticated', 'public.builds', 'UPDATE')::text,
         has_table_privilege('authenticated', 'public.builds', 'INSERT') AND has_table_privilege('authenticated', 'public.builds', 'UPDATE')
  UNION ALL
  SELECT 'A', 8, 'A · the builds policies admit their creator (rows E)',
         'all four present and as the migrations write them',
         (SELECT count(*) FILTER (WHERE matches)::text || ' of 4 match' FROM policy_rows WHERE tbl = 'builds' AND permissive = 'PERMISSIVE'),
         (SELECT bool_and(matches) FROM policy_rows WHERE tbl = 'builds' AND permissive = 'PERMISSIVE')
  UNION ALL
  SELECT 'A', 9, 'A · nothing that no migration defines can refuse a write (rows E, F, G)',
         '0 restrictive policies, 0 checks, 0 triggers that no migration defines; no trigger disabled',
         (SELECT count(*) FROM live_policies l WHERE l.permissive = 'RESTRICTIVE' AND NOT EXISTS (SELECT 1 FROM expected_policies e WHERE e.tbl = l.tbl AND e.pol = l.pol))::text || ' policies, ' ||
         (SELECT count(*) FROM live_checks l WHERE l.kind = 'c' AND NOT EXISTS (SELECT 1 FROM expected_checks e WHERE e.tbl = l.tbl AND e.con = l.con))::text || ' checks, ' ||
         (SELECT count(*) FROM live_triggers l WHERE NOT EXISTS (SELECT 1 FROM expected_triggers e WHERE e.tbl = l.tbl AND e.tg = l.tg))::text || ' triggers, ' ||
         (SELECT count(*) FROM live_triggers l WHERE l.enabled = 'D')::text || ' disabled',
         NOT EXISTS (SELECT 1 FROM live_policies l WHERE l.permissive = 'RESTRICTIVE' AND NOT EXISTS (SELECT 1 FROM expected_policies e WHERE e.tbl = l.tbl AND e.pol = l.pol))
         AND NOT EXISTS (SELECT 1 FROM live_checks l WHERE l.kind = 'c' AND NOT EXISTS (SELECT 1 FROM expected_checks e WHERE e.tbl = l.tbl AND e.con = l.con))
         AND NOT EXISTS (SELECT 1 FROM live_triggers l WHERE NOT EXISTS (SELECT 1 FROM expected_triggers e WHERE e.tbl = l.tbl AND e.tg = l.tg))
         AND NOT EXISTS (SELECT 1 FROM live_triggers l WHERE l.enabled = 'D')

  -- B · each column, one row each
  UNION ALL
  SELECT 'B', row_number() OVER (ORDER BY tbl, col)::int,
         'B · column ' || tbl || '.' || col, 'present · ' || why, coalesce(typ, 'MISSING'),
         CASE WHEN tbl = 'builds' AND col IN ('like_count', 'comment_count') AND typ IS NULL THEN NULL ELSE typ IS NOT NULL END
  FROM column_rows

  -- C · functions
  UNION ALL
  SELECT 'C', row_number() OVER (ORDER BY e.fn)::int,
         'C · function public.' || e.fn || ' · ' || e.why,
         'public.' || e.fn || '(' || e.types || ')',
         coalesce((SELECT string_agg('public.' || l.fn || '(' || l.args || ')', '; ') FROM live_functions l WHERE l.fn = e.fn), 'MISSING'),
         EXISTS (SELECT 1 FROM live_functions l WHERE l.fn = e.fn AND l.types = e.types)
  FROM expected_functions e
  UNION ALL
  SELECT 'C', 90, 'C · authenticated may execute set_build_post_media and gallery_facets', 'true, true',
         coalesce((SELECT has_function_privilege('authenticated', 'public.set_build_post_media(uuid, uuid[])', 'EXECUTE')::text
                    WHERE to_regprocedure('public.set_build_post_media(uuid, uuid[])') IS NOT NULL), 'MISSING') || ', ' ||
         coalesce((SELECT has_function_privilege('authenticated', 'public.gallery_facets(jsonb)', 'EXECUTE')::text
                    WHERE to_regprocedure('public.gallery_facets(jsonb)') IS NOT NULL), 'MISSING'),
         coalesce((SELECT has_function_privilege('authenticated', 'public.set_build_post_media(uuid, uuid[])', 'EXECUTE')
                    WHERE to_regprocedure('public.set_build_post_media(uuid, uuid[])') IS NOT NULL), false)
         AND coalesce((SELECT has_function_privilege('authenticated', 'public.gallery_facets(jsonb)', 'EXECUTE')
                    WHERE to_regprocedure('public.gallery_facets(jsonb)') IS NOT NULL), false)
  UNION ALL
  SELECT 'C', 91, 'C · the helper that ran any SQL (drizzle 0006) is gone again (drizzle 0007)', 'absent',
         CASE WHEN EXISTS (SELECT 1 FROM live_functions WHERE fn = '__tmp_apply_migration') THEN 'PRESENT' ELSE 'absent' END,
         NOT EXISTS (SELECT 1 FROM live_functions WHERE fn = '__tmp_apply_migration')

  -- D · privileges and row level security
  UNION ALL
  SELECT 'D', s.sort, 'D · ' || s.label, s.expected, s.found, s.found = s.expected
  FROM (
    SELECT 1 AS sort, 'authenticated: SELECT, INSERT, UPDATE, DELETE on builds' AS label, 'true, true, true, true' AS expected,
           has_table_privilege('authenticated', 'public.builds', 'SELECT')::text || ', ' || has_table_privilege('authenticated', 'public.builds', 'INSERT')::text || ', ' ||
           has_table_privilege('authenticated', 'public.builds', 'UPDATE')::text || ', ' || has_table_privilege('authenticated', 'public.builds', 'DELETE')::text AS found
    UNION ALL
    SELECT 2, 'authenticated: SELECT, INSERT, UPDATE, DELETE on build_nodes', 'true, true, true, true',
           has_table_privilege('authenticated', 'public.build_nodes', 'SELECT')::text || ', ' || has_table_privilege('authenticated', 'public.build_nodes', 'INSERT')::text || ', ' ||
           has_table_privilege('authenticated', 'public.build_nodes', 'UPDATE')::text || ', ' || has_table_privilege('authenticated', 'public.build_nodes', 'DELETE')::text
    UNION ALL
    SELECT 3, 'authenticated: SELECT, INSERT, UPDATE, DELETE on build_media', 'true, true, true, true',
           has_table_privilege('authenticated', 'public.build_media', 'SELECT')::text || ', ' || has_table_privilege('authenticated', 'public.build_media', 'INSERT')::text || ', ' ||
           has_table_privilege('authenticated', 'public.build_media', 'UPDATE')::text || ', ' || has_table_privilege('authenticated', 'public.build_media', 'DELETE')::text
    UNION ALL
    SELECT 4, 'authenticated: SELECT, UPDATE on import_sessions', 'true, true',
           has_table_privilege('authenticated', 'public.import_sessions', 'SELECT')::text || ', ' || has_table_privilege('authenticated', 'public.import_sessions', 'UPDATE')::text
    UNION ALL
    SELECT 5, 'anon: SELECT on import_sessions (none: 20260917120000:255)', 'false',
           has_table_privilege('anon', 'public.import_sessions', 'SELECT')::text
    UNION ALL
    SELECT 6, 'authenticated: SELECT, UPDATE on profiles', 'true, true',
           has_table_privilege('authenticated', 'public.profiles', 'SELECT')::text || ', ' || has_table_privilege('authenticated', 'public.profiles', 'UPDATE')::text
    UNION ALL
    SELECT 7, 'authenticated: UPDATE on builds.making (the session write)', 'true',
           CASE WHEN EXISTS (SELECT 1 FROM live_columns WHERE tbl = 'builds' AND col = 'making')
                THEN has_column_privilege('authenticated', 'public.builds', 'making', 'UPDATE')::text ELSE 'column missing' END
    UNION ALL
    SELECT 8, 'authenticated: UPDATE on builds.post_doc (the Post tab''s save)', 'true',
           CASE WHEN EXISTS (SELECT 1 FROM live_columns WHERE tbl = 'builds' AND col = 'post_doc')
                THEN has_column_privilege('authenticated', 'public.builds', 'post_doc', 'UPDATE')::text ELSE 'column missing' END
    UNION ALL
    SELECT 9, 'row level security is on for builds, build_nodes, build_media, import_sessions, profiles', 'true, true, true, true, true',
           (SELECT string_agg(coalesce((SELECT c.relrowsecurity::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                                         WHERE n.nspname = 'public' AND c.relname = t.name), 'no table'), ', ' ORDER BY t.ord)
              FROM (VALUES (1, 'builds'), (2, 'build_nodes'), (3, 'build_media'), (4, 'import_sessions'), (5, 'profiles')) AS t(ord, name))
  ) AS s

  -- E · policies
  UNION ALL
  SELECT 'E', row_number() OVER (ORDER BY tbl, pol)::int,
         'E · policy ' || tbl || ': "' || pol || '" (' || cmd || ', ' || lower(permissive) || ')',
         'as ' || source || CASE WHEN alt IS NOT NULL THEN ' (build_media set ' || alt || '; either set will do)'
                                 WHEN permissive = 'RESTRICTIVE' THEN ' (if absent, these flows lose nothing: it can only refuse)' ELSE '' END,
         CASE WHEN NOT present THEN 'absent'
              ELSE regexp_replace(live_cmd || ' ' || lower(live_permissive) || ' ' || live_roles
                   || coalesce(' USING ' || live_using, '') || coalesce(' WITH CHECK ' || live_check, ''), '[[:space:]]+', ' ', 'g') END,
         CASE WHEN alt IS NOT NULL AND NOT present THEN NULL ELSE matches END
  FROM policy_rows
  UNION ALL
  SELECT 'E', 900, 'E · build_media: one whole set of owner policies is in place', 'set A (20260823140000) or set B (20260825112911) complete',
         coalesce((SELECT string_agg('set ' || alt || ': ' || CASE WHEN whole THEN 'complete' ELSE 'incomplete' END, ', ' ORDER BY alt) FROM media_sets), 'none'),
         coalesce((SELECT bool_or(whole) FROM media_sets), false)
  UNION ALL
  SELECT 'E', 1000 + row_number() OVER (ORDER BY l.tbl, l.pol)::int,
         'E · policy no migration defines: ' || l.tbl || ': "' || l.pol || '" (' || l.cmd || ', ' || lower(l.permissive) || ')',
         'none (a restrictive one can refuse the owner)',
         regexp_replace(l.roles || coalesce(' USING ' || l.using_raw, '') || coalesce(' WITH CHECK ' || l.check_raw, ''), '[[:space:]]+', ' ', 'g'),
         CASE WHEN l.permissive = 'RESTRICTIVE' THEN false ELSE NULL END
  FROM live_policies l
  WHERE NOT EXISTS (SELECT 1 FROM expected_policies e WHERE e.tbl = l.tbl AND e.pol = l.pol)

  -- F · triggers
  UNION ALL
  SELECT 'F', row_number() OVER (ORDER BY e.tbl, e.tg)::int,
         'F · trigger ' || e.tbl || '.' || e.tg || ' (' || e.source || ')',
         'present, enabled, runs ' || e.fn || '()' || e.note,
         coalesce((SELECT l.def || ' · ' || CASE l.enabled WHEN 'D' THEN 'DISABLED' ELSE 'enabled' END FROM live_triggers l WHERE l.tbl = e.tbl AND l.tg = e.tg), 'absent'),
         EXISTS (SELECT 1 FROM live_triggers l WHERE l.tbl = e.tbl AND l.tg = e.tg AND l.fn = e.fn AND l.enabled <> 'D')
  FROM expected_triggers e
  UNION ALL
  SELECT 'F', 1000 + row_number() OVER (ORDER BY l.tbl, l.tg)::int,
         'F · trigger no migration defines: ' || l.tbl || '.' || l.tg, 'none (it runs on every matching write)',
         l.def || ' · ' || CASE l.enabled WHEN 'D' THEN 'DISABLED' ELSE 'enabled' END,
         false
  FROM live_triggers l
  WHERE NOT EXISTS (SELECT 1 FROM expected_triggers e WHERE e.tbl = l.tbl AND e.tg = l.tg)

  -- G · checks and the foreign keys a write needs
  UNION ALL
  SELECT 'G', row_number() OVER (ORDER BY e.tbl, e.con)::int,
         'G · check ' || e.tbl || '.' || e.con || ' (' || e.source || ')',
         'present, containing "' || e.must_contain || '"',
         coalesce((SELECT l.def FROM live_checks l WHERE l.tbl = e.tbl AND l.con = e.con), 'absent'),
         EXISTS (SELECT 1 FROM live_checks l WHERE l.tbl = e.tbl AND l.con = e.con AND position(e.must_contain IN l.def) > 0)
  FROM expected_checks e
  UNION ALL
  SELECT 'G', 1000 + row_number() OVER (ORDER BY l.tbl, l.con)::int,
         'G · check no migration defines: ' || l.tbl || '.' || l.con, 'none (it may refuse a write: SQLSTATE 23514)', l.def, false
  FROM live_checks l
  WHERE l.kind = 'c' AND NOT EXISTS (SELECT 1 FROM expected_checks e WHERE e.tbl = l.tbl AND e.con = l.con)
  UNION ALL
  SELECT 'G', 2000 + s.sort, 'G · ' || s.label, s.expected, coalesce(s.found, 'absent'), coalesce(s.found ~ s.pattern, false)
  FROM (
    SELECT 1 AS sort, 'foreign key build_nodes.type -> node_types.key (every node the composer writes)' AS label,
           'FOREIGN KEY (type) REFERENCES node_types(key)' AS expected, 'REFERENCES (public\.)?node_types\(key\)' AS pattern,
           (SELECT string_agg(def, '; ') FROM live_checks WHERE tbl = 'build_nodes' AND kind = 'f' AND def LIKE 'FOREIGN KEY (type)%') AS found
    UNION ALL
    SELECT 2, 'foreign key builds.creator_id -> profiles.id (createBuild needs the maker''s profile row)',
           'FOREIGN KEY (creator_id) REFERENCES profiles(id)', 'REFERENCES (public\.)?profiles\(id\)',
           (SELECT string_agg(def, '; ') FROM live_checks WHERE tbl = 'builds' AND kind = 'f' AND def LIKE 'FOREIGN KEY (creator_id)%')
  ) AS s

  -- H · the node types the composer writes (a missing one refuses that step: 23503)
  UNION ALL
  SELECT 'H', k.ord, 'H · node type ' || k.key || ' (' || k.used || ')', 'present and active',
         coalesce((SELECT CASE WHEN nt.is_active THEN 'present, active' ELSE 'present, INACTIVE' END FROM public.node_types nt WHERE nt.key = k.key), 'MISSING'),
         EXISTS (SELECT 1 FROM public.node_types nt WHERE nt.key = k.key)
  FROM (VALUES
    (1, 'prompt', 'Add › Prompt'), (2, 'agent_config', 'Add › Agent'), (3, 'team', 'Add › Agent or team (20261001300000)'),
    (4, 'manual_step', 'Add › Manual step (20261001300000)'), (5, 'document', 'Add › File, a setup file'), (6, 'integration', 'Add › Tool'),
    (7, 'result', 'Add › Result'), (8, 'code', 'Add › Code'), (9, 'eval_run', 'Add › Check'), (10, 'breakage', 'More details'),
    (11, 'gap', 'More details'), (12, 'recording', 'the cover (a video)'), (13, 'screenshot', 'the cover (a picture)')
  ) AS k(ord, key, used)

  -- I · counts and dates (no names, no emails)
  UNION ALL
  SELECT 'I', 1, 'I · your drafts (auth.uid())', 'about 15, if the editor runs as you',
         CASE WHEN auth.uid() IS NULL THEN 'auth.uid() is empty: the editor does not run as you. Use the PASTE-YOUR-USER-ID line below.'
              ELSE (SELECT count(*)::text FROM public.builds b WHERE b.creator_id = auth.uid() AND b.status = 'draft') END,
         NULL::boolean
  UNION ALL
  SELECT 'I', 2, 'I · drafts in the whole database (every account)', 'a count', (SELECT count(*)::text FROM public.builds WHERE status = 'draft'), NULL
  UNION ALL
  SELECT 'I', 3, 'I · the newest write to any draft (builds.updated_at)', 'after 16 Oct 2026 if anyone has saved a draft since PT-01',
         coalesce((SELECT to_char(max(updated_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI "UTC"') FROM public.builds WHERE status = 'draft'), 'none'), NULL
  UNION ALL
  SELECT 'I', 4, 'I · builds created since PT-01 reached main (2026-10-16 12:10 UTC)', 'a count; 0 says no new post has been made since',
         (SELECT count(*)::text FROM public.builds WHERE created_at >= timestamptz '2026-10-16 12:10:00+00'), NULL
  -- To count your own drafts: take out the two dashes at the start of the next line, and put your user id (NOT your email) in place of PASTE-YOUR-USER-ID.
  -- UNION ALL SELECT 'I', 5, 'I · drafts of the user id I pasted', 'about 15', (SELECT count(*)::text FROM public.builds WHERE creator_id = 'PASTE-YOUR-USER-ID'::uuid AND status = 'draft'), NULL

  -- J · the migration records: every file in supabase/migrations, newest first
  UNION ALL
  SELECT 'J', 0, 'J · supabase_migrations.schema_migrations', 'how many versions it records, and the newest',
         CASE WHEN (SELECT doc FROM supabase_doc) IS NULL THEN 'not there, or not readable here'
              ELSE (SELECT count(*)::text || ' versions, newest ' || coalesce(max(version), 'none') FROM supabase_recorded) END,
         NULL
  UNION ALL
  SELECT 'J', 1, 'J · drizzle.__drizzle_migrations (Lovable''s own record since 23 Sep)', 'how many it records, and the newest',
         CASE WHEN (SELECT doc FROM drizzle_doc) IS NULL THEN 'not there, or not readable here'
              ELSE (SELECT count(*)::text || ' rows, newest ' || coalesce(to_char(to_timestamp(max(created_at) / 1000.0) AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI "UTC"'), 'none') FROM drizzle_recorded) END,
         NULL
  UNION ALL
  SELECT 'J', 1 + row_number() OVER (ORDER BY d.created_at DESC)::int,
         'J · drizzle ' || d.tag || coalesce(' (= ' || d.repo_file || ')', ''), 'recorded',
         CASE WHEN (SELECT doc FROM drizzle_doc) IS NULL THEN 'cannot tell'
              WHEN EXISTS (SELECT 1 FROM drizzle_recorded r WHERE r.created_at = d.created_at) THEN 'recorded' ELSE 'no record' END,
         CASE WHEN (SELECT doc FROM drizzle_doc) IS NULL THEN NULL ELSE EXISTS (SELECT 1 FROM drizzle_recorded r WHERE r.created_at = d.created_at) END
  FROM drizzle_journal d
  UNION ALL
  SELECT 'K', row_number() OVER (ORDER BY m.version DESC, m.name DESC)::int,
         'K · migration ' || m.version || '_' || m.name || '.sql', 'recorded',
         CASE WHEN EXISTS (SELECT 1 FROM supabase_recorded r WHERE r.version = m.version) THEN 'recorded in supabase_migrations'
              WHEN EXISTS (SELECT 1 FROM drizzle_journal d JOIN drizzle_recorded r ON r.created_at = d.created_at WHERE d.repo_file = m.version || '_' || m.name)
                THEN 'recorded by Lovable (drizzle)'
              ELSE 'no record (not proof it is missing: rows A to H are)' END,
         CASE WHEN EXISTS (SELECT 1 FROM supabase_recorded r WHERE r.version = m.version)
                OR EXISTS (SELECT 1 FROM drizzle_journal d JOIN drizzle_recorded r ON r.created_at = d.created_at WHERE d.repo_file = m.version || '_' || m.name)
              THEN true ELSE NULL END
  FROM migrations m
)
SELECT "check", expected, found, ok
FROM checks
ORDER BY section, sort;
