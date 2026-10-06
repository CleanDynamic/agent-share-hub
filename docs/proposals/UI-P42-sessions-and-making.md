# UI-P42 — Sessions that stay, a model per session, the making stats

Status: **PROPOSAL, NOT APPLIED. Live evidence for Q1–Q6 is supplied (§2), as Lovable's read-only summaries rather than raw rows.** Nothing in the migration or connector diff changed as a result; §3 now says which answers are confirmed live. Nothing here has touched the live database, the connector or the app. Miles approves, then the migration and the connector diff are applied by whoever has live access.

## 0. What blocks this being a PASS

**Update, after Miles ran the query pack through Lovable.** All six queries are answered in §2. They are Lovable's summaries (tables and pasted function text), not raw result rows, and Q2 elides the explanatory comments inside `enforce_import_ceilings()`. The paragraph below describes why this session could not run them itself, which is why the evidence is second-hand.

The live database could not be reached from this session. The sandbox's network policy answers `403` to `CONNECT zybdotagjwektucfdkri.supabase.co:443` (the project in `supabase/config.toml`, the host in `.env`). That is a policy denial, so it was not worked around. Even with the host allowed, the publishable key could not answer checks 1, 2 and 5: `pg_policies`, `cron.job`, `pg_get_functiondef` and `import_sessions` rows are not readable as `anon`. They have to be run by Miles through Lovable, as every earlier `L-Pnn-n` query was (`docs/reconciliation/HANDOVER.md`). Section 2 is therefore the **query pack**, ready to paste, with an empty result slot under each query. Everything in §3 onward is derived from the repository and a local rehearsal, and is labelled so. Until §2 is filled in, treat §3 as unverified against live.

## 1. One line per change, and the screen that needs it

| # | Change | Needed by |
|---|---|---|
| 1 | `import_sessions.model TEXT NULL` (+ length check) | Composer: shows each session's model version (UI-P43 normalises it) |
| 2 | `expire_import_sessions()` sweeps `open` and `assembling` only | Drafts page: a parsed session stays until its creator removes it |
| 3 | `builds.session_count`, `prompt_count`, `ai_turn_count`, `models_used`, `making` (+ non-negative and object checks) | Gallery dashboard: sessions, models, prompts and AI turns per published build; readers cannot see `import_sessions`, so the figures live on `builds` |
| 4 | Connector: optional `model` input on `buildgallery_begin_import`, stored on the row | Composer (same as 1) |
| 5 | Connector: `expireOverdueImports()` gets its own list, `open` and `assembling` | Drafts page (same as 2); `LIVE_STATUSES` is unchanged so `findLiveImport` still finds a parsed import on retry |
| 6 | Connector: review address becomes `/drafts`; `errTotalExceeded` keeps `/import` | Drafts page; `/import` is where file drops live |

## 2. Live evidence — query pack (all read-only)

Send as one Lovable message, `L-P42-0`. Paste each result verbatim under its query. **Nothing below has been run.**

### Q1 — `import_sessions`: columns, policies, grants

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'import_sessions'
order by ordinal_position;

select policyname, cmd, roles, permissive, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'import_sessions'
order by cmd, policyname;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'import_sessions'
order by grantee, privilege_type;
```

Result (supplied by Miles via Lovable, read-only):

- **Columns:** 22, in this order, identical in name, type, nullability and default to `20260917120000_import_sessions.sql`: `id uuid`, `user_id uuid`, `client`, `source_hint`, `fingerprint`, `content_hash`, `status` (default `'open'`), `chunk_count` (0), `expected_chunks`, `total_chars` (0), `declared_turns`, `declared_chars`, `reader_id`, `detection_reason`, `proposal jsonb`, `secret_findings jsonb`, `error`, `target_build_id`, `build_id`, `created_at`, `updated_at`, `expires_at` (`now() + '7 days'`). There is no `model` column.
- **Policies:** four, all permissive, all `authenticated`, all owner-scoped on `auth.uid() = user_id`: DELETE (using), INSERT (with check), SELECT (using), UPDATE (using and with check), named as in the migration. No policy for `anon`.
- **Grants:** `information_schema.role_table_grants` returned zero rows, which Lovable reports is not reliable on this project, so the ACL was read from `pg_class.relacl`: `authenticated` SELECT, INSERT, UPDATE, DELETE (table-wide); `service_role` and `postgres` all; `anon` none; the sandbox tooling roles SELECT and INSERT only.

### Q2 — the sweep and the ceiling

```sql
select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'expire-import-sessions' or command ilike '%expire_import_sessions%';

select pg_get_functiondef('public.expire_import_sessions()'::regprocedure);

-- the ceiling: confirms it counts open and assembling only, and that the trigger is on
select pg_get_functiondef('public.enforce_import_ceilings()'::regprocedure);
select tgname, tgenabled from pg_trigger
where tgrelid = 'public.import_sessions'::regclass and not tgisinternal;
```

Result (supplied by Miles via Lovable, read-only):

- **`cron.job`:** `jobid 2`, `expire-import-sessions`, `20 3 * * *`, `SELECT public.expire_import_sessions();`, `active = true`. pg_cron is installed and the sweep is scheduled as the repository says.
- **`expire_import_sessions()`**, as stored (`RETURNS integer`, `LANGUAGE plpgsql`, `SET search_path TO ''`; `SECURITY INVOKER` is the default and is not printed):

```sql
CREATE OR REPLACE FUNCTION public.expire_import_sessions()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  _expired INTEGER;
BEGIN
  UPDATE public.import_sessions
  SET status     = 'expired',
      updated_at = now()
  WHERE expires_at < now()
    AND status IN ('open', 'assembling', 'parsed');

  GET DIAGNOSTICS _expired = ROW_COUNT;

  RETURN _expired;
END
$function$
```

- **`enforce_import_ceilings()`:** the live body matches `20260921120000_import_ceilings.sql` in every statement shown (the paste omitted only its explanatory comments): 20 per UTC day counting every row created since midnight, 5 open counting `status IN ('open', 'assembling')` only, advisory lock on `(table, user)`, `ERRCODE 'BGCAP'`. Trigger `enforce_import_ceilings`, `tgenabled = O` (firing normally). The trigger's BEFORE INSERT timing was not read from `pg_trigger.tgtype`; the repository migration creates it `BEFORE INSERT`.

### Q3 — `builds`: columns, policies, triggers

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'builds'
order by ordinal_position;

-- the five new names must be absent; the five existing-or-not names must be reported
select n as column_name, exists (
  select 1 from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'builds' and c.column_name = n
) as exists_live
from unnest(array[
  'session_count','prompt_count','ai_turn_count','models_used','making',
  'created_via','reproduction_count','rebuild_count','comment_count','save_count'
]) as n;

select policyname, cmd, permissive, roles, qual, with_check
from pg_policies where schemaname = 'public' and tablename = 'builds'
order by cmd, policyname;

select tgname, tgenabled, pg_get_triggerdef(oid) from pg_trigger
where tgrelid = 'public.builds'::regclass and not tgisinternal order by tgname;
```

Result (supplied by Miles via Lovable, read-only):

- **Columns:** 37, from `id` to `solves_node_id`. The five new names are all absent. Existence of the others:

| column | exists_live |
|---|---|
| session_count, prompt_count, ai_turn_count, models_used, making | **false** (as required) |
| created_via | true |
| reproduction_count | true (`integer NOT NULL DEFAULT 0`) |
| rebuild_count | true (`integer NOT NULL DEFAULT 0`) |
| comment_count | **false** |
| save_count | **false** |

  So UI-P44 may select `created_via`, `reproduction_count` and `rebuild_count`, and must not select `comment_count` or `save_count`. `like_count` and `is_hidden` are not among the 37 either, so `20261001180000_rc_build_social.sql` and `20261001190000_rc_reports.sql` are not applied live.
- **Policies** (all permissive, roles `{public}`): DELETE and UPDATE `creator_id = (SELECT auth.uid()) OR is_admin((SELECT auth.uid()))`; INSERT with check `creator_id = (SELECT auth.uid())`; SELECT `status <> 'draft' OR creator_id = ... OR is_admin(...)`. The UPDATE policy has **no `WITH CHECK` and no column list**.
- **Triggers** (5, all `O`): `trg_builds_rebuild_count_delete`, `trg_builds_rebuild_count_status` (AFTER UPDATE OF status), `trg_builds_updated_at` (BEFORE UPDATE, every update), `trg_rc_xp_build_reconfirmed` (AFTER UPDATE OF last_confirmed_at), `trg_rc_xp_build_visible` (AFTER INSERT OR UPDATE OF status). None mentions the new columns.

### Q4 — `build_reproductions`: columns

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'build_reproductions'
order by ordinal_position;
```

Result (supplied by Miles via Lovable, read-only; a summary table, not raw rows): 10 columns.

| # | column | type | null | default |
|---|---|---|---|---|
| 1 | id | uuid | NO | gen_random_uuid() |
| 2 | build_id | uuid | NO | |
| 3 | user_id | uuid | NO | |
| 4 | model_used | text | YES | |
| 5 | result | text | YES | |
| 6 | note | text | YES | |
| 7 | metadata | jsonb | YES | '{}'::jsonb |
| 8 | created_at | timestamptz | NO | now() |
| 9 | confirmed_at | timestamptz | NO | now() |
| 10 | worked | boolean | NO | true |

Reading it: every column the code reads (`id, build_id, user_id, confirmed_at, model_used, worked, note`) exists, so nothing in this proposal needs a change here. `result`, `metadata` and `created_at` are the older shape (`20260825140100` relaxed `result` to nullable and added `confirmed_at` and `worked`). There is no `updated_at` or status column. This proposal does not touch the table.

### Q5 — proposal summary keys (keys only, never values)

Run as the SQL editor's role, which bypasses the owner-only RLS:

```sql
select status,
       count(*)                                                       as rows,
       count(*) filter (where proposal->'summary' ? 'user_turn_count')      as has_user_turn_count,
       count(*) filter (where proposal->'summary' ? 'assistant_turn_count') as has_assistant_turn_count,
       count(*) filter (where jsonb_typeof(proposal->'summary'->'user_turn_count') = 'number')      as user_is_number,
       count(*) filter (where jsonb_typeof(proposal->'summary'->'assistant_turn_count') = 'number') as assistant_is_number
from public.import_sessions
where proposal is not null
group by status
order by status;
```

Result (supplied by Miles via Lovable, read-only; counts only):

| status | rows | has_user_turn_count | has_assistant_turn_count | user_is_number | assistant_is_number |
|---|---|---|---|---|---|
| claimed | 3 | 3 | 3 | 3 | 3 |
| expired | 2 | 2 | 2 | 2 | 2 |

Five rows carry a proposal and all five have both keys as numbers, so the shape UI-P43 relies on holds on this sample. **Limits:** the query skips rows whose `proposal` is null; the sample is five rows, all `claimed` or `expired`, so no freshly parsed import is covered. Re-run after the first new parsed import if that matters before UI-P43. These are counts of rows that carry each key, not proposal values. UI-P43 reads prompts as `user_turn_count` and AI turns as `user_turn_count + assistant_turn_count`; rows parsed before `ProposalSummary` gained the two fields would lack them, and this query shows whether any do.

### Q6 — the dashboard query's plan (no new index unless this says so)

```sql
explain (analyze, buffers)
select id, slug, title, published_at, reproduction_count
from public.builds
where status in ('published', 'gallery')
order by published_at desc nulls last
limit 24;
```

Result (supplied by Miles via Lovable, read-only, as a summary of the plan): `Limit` over `Sort` (key `published_at DESC NULLS LAST`, quicksort, 25kB) over `Seq Scan on builds` with filter `status = ANY('{published,gallery}')`; 13 rows read, 12 removed by the filter, 1 returned; `Buffers: shared hit=1`; warm run `Planning Time: 0.151 ms`, `Execution Time: 0.050 ms` (the first run's 15.5 ms planning was cold catalogue warm-up). The table is one 8kB page, so a sequential scan is right. It ran as a role that bypasses row-level security, so the app's plan carries an extra policy filter, same shape. Only 1 of 13 builds is published or gallery.

Run once more after UI-P44 is deployed with the real column list. **No index is proposed.** At 13 rows the planner ignores indexes anyway, and the five new columns are only ever selected, never filtered or ordered by, so `idx_builds_status_published` (from `20260823120000`, unverified live) already serves the query. A GIN index on `models_used` would be warranted only if the dashboard filters "built with model X"; no prompt asks for that.

## 3. The migration (derived from the repository; not applied)

File name when approved: `supabase/migrations/20261001280000_sessions_and_making.sql` (newest existing file is `20261001270000_ui_retire_frame.sql`). **It goes in this file only; it is not in `supabase/migrations/` yet.**

Answers to the questions the prompt asked, each now checked against §2:

- **Can the owner set `model`?** **Yes, confirmed live (Q1).** The live UPDATE policy and a table-wide `authenticated` UPDATE grant match the migration files: `Import sessions are updated by their owner` is `FOR UPDATE TO authenticated USING/WITH CHECK ((select auth.uid()) = user_id)` with no column list, and `GRANT SELECT, INSERT, UPDATE, DELETE` is table-wide, so a new column is covered. Because the live policy exists, the migration's guarded policy block is a no-op here (it is kept for the other world). With the table-wide grant, `GRANT UPDATE (model)` is redundant and harmless. No policy change is needed.
- **Do kept sessions block new ones?** **No, confirmed live (Q2):** the live `enforce_import_ceilings()` matches `20260921120000_import_ceilings.sql`: `enforce_import_ceilings` counts `status IN ('open','assembling')` for the open ceiling (5). It also counts every row created today for the daily ceiling (20), which kept sessions do not change. 
- **Can the creator write the new `builds` columns?** **Yes, confirmed live (Q3):** `Creators and admins update builds` is `FOR UPDATE USING (creator_id = (select auth.uid()) OR is_admin(...))`, no column guard, no `WITH CHECK`. See question 4 on what that implies.
- **Side effect, confirmed live (Q3):** `trg_builds_updated_at` is a `BEFORE UPDATE` trigger on `builds`, so `refreshMakingStats` bumps `builds.updated_at`. The `AFTER UPDATE OF status` / `OF last_confirmed_at` triggers (live: rebuild count, XP) do not fire for these columns.

**Rehearsal.** Run on a throwaway local Postgres 16 with the repository's own `import_sessions`, `import_ceilings` and `import_expiry_cron` migrations underneath (Q1 and Q2 show the live objects match them) and a reduced `builds`: applies twice with only "already exists, skipping" notices; the five columns exist with the right types and are NOT NULL; the sweep function no longer mentions `parsed` and `authenticated` cannot execute it; with an overdue `open`, `assembling` and `parsed` row, the sweep flips two and leaves `parsed`; a 65-character `model` and a non-object `making` are both refused. This is a stand-in, not the live schema; `builds` was reduced, so the live trigger set (Q3) was not exercised.

```sql
-- =============================================================================
-- buildgallery — sessions that stay, a model per session, the making stats (UI-P42)
-- =============================================================================
-- Idempotent and correct in both worlds: every change checks the catalogue
-- first, so a second run changes nothing and a drifted live schema is not
-- assumed away.

-- --- 1. import_sessions.model -------------------------------------------------
ALTER TABLE public.import_sessions
  ADD COLUMN IF NOT EXISTS model TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.import_sessions'::regclass
      AND conname  = 'import_sessions_model_length_check'
  ) THEN
    ALTER TABLE public.import_sessions
      ADD CONSTRAINT import_sessions_model_length_check
      CHECK (model IS NULL OR char_length(model) <= 64);
  END IF;
END
$$;

COMMENT ON COLUMN public.import_sessions.model IS
  'The model version the session ran on, exactly as the client sent it (e.g. claude-sonnet-5-5). NULL when the client did not say. The app normalises it for display; this column is never rewritten to match.';

-- The owner UPDATE policy of 20260917120000 already covers every column. Only
-- if the live table has NO update policy for signed-in users is it recreated,
-- in the same shape; an existing policy is never touched.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'import_sessions'
      AND cmd IN ('UPDATE', 'ALL')
      AND roles && ARRAY['authenticated', 'public']::name[]
  ) THEN
    CREATE POLICY "Import sessions are updated by their owner"
      ON public.import_sessions FOR UPDATE
      TO authenticated
      USING ((select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) = user_id);
  END IF;
END
$$;

GRANT UPDATE (model) ON public.import_sessions TO authenticated;

-- --- 2. the nightly sweep stops touching parsed sessions ----------------------
-- Same signature, language, security and search_path as 20260921120100; CREATE
-- OR REPLACE keeps the function's owner and its grants (none to any client
-- role). The schedule and expires_at are not touched.
CREATE OR REPLACE FUNCTION public.expire_import_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  _expired INTEGER;
BEGIN
  UPDATE public.import_sessions
  SET status     = 'expired',
      updated_at = now()
  WHERE expires_at < now()
    AND status IN ('open', 'assembling');

  GET DIAGNOSTICS _expired = ROW_COUNT;
  RETURN _expired;
END
$$;

COMMENT ON FUNCTION public.expire_import_sessions() IS
  'Nightly sweep: flips public.import_sessions past expires_at from open/assembling to expired. A parsed session is never swept: it stays its creator''s until they remove it (discardImport marks it expired) or claim it. Status only — it touches no storage. Returns the number of rows flipped.';

REVOKE ALL ON FUNCTION public.expire_import_sessions() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_import_sessions() FROM anon, authenticated, service_role;

-- --- 3. builds: the making stats ----------------------------------------------
ALTER TABLE public.builds
  ADD COLUMN IF NOT EXISTS session_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prompt_count  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_turn_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS models_used   TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS making        JSONB   NOT NULL DEFAULT '{}'::jsonb;

DO $$
DECLARE
  _c RECORD;
BEGIN
  FOR _c IN
    SELECT * FROM (VALUES
      ('builds_session_count_check',  'CHECK (session_count >= 0)'),
      ('builds_prompt_count_check',   'CHECK (prompt_count >= 0)'),
      ('builds_ai_turn_count_check',  'CHECK (ai_turn_count >= 0)'),
      ('builds_making_object_check',  'CHECK (jsonb_typeof(making) = ''object'')')
    ) AS v(name, ddl)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.builds'::regclass AND conname = _c.name
    ) THEN
      EXECUTE format('ALTER TABLE public.builds ADD CONSTRAINT %I %s', _c.name, _c.ddl);
    END IF;
  END LOOP;
END
$$;

COMMENT ON COLUMN public.builds.session_count IS
  'How many AI sessions this build was made from. Written by its creator (refreshMakingStats); readable wherever the build is.';
COMMENT ON COLUMN public.builds.prompt_count IS
  'Prompts across those sessions (user turns). Written by its creator.';
COMMENT ON COLUMN public.builds.ai_turn_count IS
  'AI turns across those sessions (user turns plus assistant turns). Written by its creator.';
COMMENT ON COLUMN public.builds.models_used IS
  'Normalised model names across those sessions, e.g. {"Sonnet 5.5"}. Written by its creator.';
COMMENT ON COLUMN public.builds.making IS
  'Counts, client and model names only, never conversation text: {"sessions":[{"client":"claude-code","model":"Sonnet 5.5","prompts":9,"turns":38}],"excluded_models":[]}. Written by its creator.';
```

## 4. The connector diff (`supabase/functions/mcp/`; not applied)

How these reach live is **unknown** (question 2). The migrations ship by Lovable message; nothing in `DEPLOYMENT_CHECKLIST.md`, `docs/connector/` or `docs/reconciliation/` says how the `mcp` function is deployed.

### 4.1 `constants.ts`

```diff
-/**
- * The upload page, as the error table names it. The manual writes
- * buildgallery.ai here; until the custom domain is connected the address is
- * the Lovable one, and this constant is the only place the substitution lives.
- */
-export const COMPOSE_NEW_URL = "agent-share-hub.lovable.app/compose/new";
-
-/**
- * The same page as a full address, for the finish_import summary, which tells
- * the caller where the import is waiting. Derived, not retyped, so the domain
- * substitution above stays the one place to change.
- */
-export const COMPOSE_NEW_HTTPS_URL = `https://${COMPOSE_NEW_URL}`;
+/**
+ * The host the manual writes as buildgallery.ai. Until the custom domain is
+ * connected it is the Lovable one; this is the only place the substitution lives.
+ */
+const PUBLIC_HOST = "agent-share-hub.lovable.app";
+
+/** The Drafts page: where an import waits for its creator, as the tools name it. */
+export const DRAFTS_URL = `${PUBLIC_HOST}/drafts`;
+
+/** The same page as a full address, for the finish_import summary and review_url. */
+export const DRAFTS_HTTPS_URL = `https://${DRAFTS_URL}`;
+
+/** File drops live here; only errTotalExceeded sends people to it. */
+export const IMPORT_URL = `${PUBLIC_HOST}/import`;
```

### 4.2 `index.ts`

```diff
@@ imports (≈ lines 144-145)
-  COMPOSE_NEW_HTTPS_URL,
-  COMPOSE_NEW_URL,
+  DRAFTS_HTTPS_URL,
+  DRAFTS_URL,
+  IMPORT_URL,

@@ ≈ line 194 — LIVE_STATUSES stays; the expiry gets its own list
 const LIVE_STATUSES = ["open", "assembling", "parsed"] as const;
+
+/** What the connector's own sweep may expire. A parsed import stays its creator's. */
+const EXPIRABLE_STATUSES = ["open", "assembling"] as const;

@@ expireOverdueImports (≈ line 464)
-      .in("status", [...LIVE_STATUSES])
+      .in("status", [...EXPIRABLE_STATUSES])
       .lt("expires_at", stamp)

@@ errTotalExceeded (≈ line 557) — the one message that keeps the import page
-    `file and drop it on ${COMPOSE_NEW_URL}, which has no such limit.`;
+    `file and drop it on ${IMPORT_URL}, which has no such limit.`;

@@ errDuplicate (≈ line 570)
-    `${humanTime(twinCreatedAt, now)}. Nothing new was created. Open ${COMPOSE_NEW_URL} to review it.`;
+    `${humanTime(twinCreatedAt, now)}. Nothing new was created. Open ${DRAFTS_URL} to review it.`;

@@ LIST_DRAFTS_DESCRIPTION (≈ line 741)
-  "on the upload page, so never insist on a draft or on a new build — offer " +
+  "on the Drafts page, so never insist on a draft or on a new build — offer " +

@@ BeginImportInput (≈ line 761, after `client`)
+    model: z
+      .string()
+      .max(64)
+      .optional()
+      .describe(
+        "The exact model version you are running as, for example claude-sonnet-5-5. " +
+          "Optional; the creator can correct it on buildgallery.",
+      ),

@@ begin_import handler: destructure `model` with the other inputs, then (≈ line 1683)
             client: normaliseClient(client),
+            model: model?.trim() || null,
             source_hint: source_hint ?? null,

@@ FinishImportOutput (≈ line 1069)
-  review_url: z.string().describe(`Where the import is waiting: ${COMPOSE_NEW_HTTPS_URL}.`),
+  review_url: z.string().describe(`Where the import is waiting: ${DRAFTS_HTTPS_URL}.`),

@@ FINISH_IMPORT_DESCRIPTION (≈ line 1078)
-  "the result, and parks it for the creator to review on the upload page. " +
+  "the result, and parks it for the creator to review on the Drafts page. " +

@@ finish_import result (≈ lines 1185, 1215)
-    review_url: COMPOSE_NEW_HTTPS_URL,
+    review_url: DRAFTS_HTTPS_URL,
...
-  lines.push("", `Review it at ${COMPOSE_NEW_HTTPS_URL}`);
+  lines.push("", `Review it at ${DRAFTS_HTTPS_URL}`);
```

### 4.3 `database.types.ts` (kept by hand)

Add `model: string | null;` to `import_sessions` **Row**, and `model?: string | null;` to **Insert** and **Update**, after `client`.

### 4.4 Tests and docs that must change with it

`supabase/functions/mcp/index.test.ts`: lines ≈ 847 and 1394 expect `agent-share-hub.lovable.app/import` (not `/compose/new`); ≈ 1287 expects `review_url` `https://agent-share-hub.lovable.app/drafts`; ≈ 1336 imports the renamed constant; ≈ 1409 expects `/drafts`; ≈ 1710-1717 expect "Drafts page". New tests: `begin_import` stores `model` (and null when omitted, and rejects 65 characters); an overdue `parsed` import survives the next `begin_import` while an overdue `open` one does not. `docs/connector/OPERATIONS.md` line 43 names `/compose/new` and moves to `/drafts` with the code.

### 4.5 Left alone on purpose

`LIVE_STATUSES`, `findLiveImport`, every other message and schema. Comments that still say "upload page" (`index.ts` ≈ 64, 926, 1154; `extract.ts` line 7) are not tool descriptions or messages and are not in the prompt's list; they would read stale and could be tidied in the same commit if Miles wants.

## 5. Rollback, per change

Rollback is data-losing for the columns it drops; each is only run if the change is being withdrawn, and the app code from UI-P43 to UI-P51 must be withdrawn first, or it will select a column that is gone.

| Change | Rollback |
|---|---|
| 1 `model` | `ALTER TABLE public.import_sessions DROP CONSTRAINT IF EXISTS import_sessions_model_length_check; ALTER TABLE public.import_sessions DROP COLUMN IF EXISTS model;` (the owner policy and grant are left as they were; the migration only recreated the policy if it was missing, so leave it) |
| 2 sweep | Re-create the body of `20260921120100_import_expiry_cron.sql` with `status IN ('open', 'assembling', 'parsed')` and its original comment. Parsed sessions kept past `expires_at` meanwhile are then flipped to `expired` by the next night's run, which is the old behaviour. |
| 3 `builds` columns | `ALTER TABLE public.builds DROP CONSTRAINT IF EXISTS builds_session_count_check, DROP CONSTRAINT IF EXISTS builds_prompt_count_check, DROP CONSTRAINT IF EXISTS builds_ai_turn_count_check, DROP CONSTRAINT IF EXISTS builds_making_object_check, DROP COLUMN IF EXISTS session_count, DROP COLUMN IF EXISTS prompt_count, DROP COLUMN IF EXISTS ai_turn_count, DROP COLUMN IF EXISTS models_used, DROP COLUMN IF EXISTS making;` |
| 4 `model` input | Revert the diff; the column may stay (nullable, unused). |
| 5 connector expiry | Revert the `EXPIRABLE_STATUSES` hunk. |
| 6 review address | Revert the constants and message hunks; redeploy the function. |

## 6. What happens to existing rows

- **Sessions already `expired`** stay expired. The new sweep does not revive anything, including parsed sessions the old sweep expired. Re-sending the same conversation creates a new session.
- **`import_sessions.model`** is NULL for every existing session.
- **Parsed sessions inside their seven days** stay `parsed` after the sweep changes, and are no longer swept at all.
- **Parsed sessions already past `expires_at` but not yet swept** (the live job runs nightly at 03:20 UTC, jobid 2, active) also stay `parsed` from now on; the first run of the new function leaves them alone.
- **`builds`**: every row gets `0`, `0`, `0`, `{}` and `{}`. Nothing is backfilled; UI-P43's `refreshMakingStats` fills a build when its creator next opens it. The adds are metadata-only (constant defaults), so no table rewrite.
- **Side effects of keeping parsed sessions** (not changes in this file): a kept parsed session still occupies its unique `(user_id, fingerprint)` and `(user_id, content_hash)` slots, so re-sending the same conversation resolves to it (or `duplicate`) until the creator removes it, which is the intended Drafts behaviour; and its `proposal` JSONB, which holds conversation text, is now retained indefinitely.

## 7. Questions for Miles before UI-P43

1. **Answered:** Q1–Q6 are in §2. Nothing left to paste, unless you want the raw rows kept beside Lovable's summaries.
2. **How does the `mcp` edge function reach live?** Migrations go by Lovable message; I found no statement for the function. Is it a Lovable message, a direct deploy, or automatic on merge? If you want the sandbox to be able to read the live project in future, `read_documentation` topic `environment.network` explains the allowed-hosts setting, though the publishable key still cannot read `pg_policies` or `cron.job`.
3. **Retention.** Parsed sessions now never expire and carry the proposal, with conversation text, forever. Do you want a cap (say, newest N per creator) or an eventual age limit, and should removing a draft null out `proposal`?
4. **Creator-written figures.** The builds UPDATE policy has no column guard, so a creator can write any value into `session_count`, `prompt_count`, `ai_turn_count`, `models_used` or `making`, as they already can into `reproduction_count`. The dashboard would show what they wrote. Accept that, or compute the figures server-side (a `SECURITY DEFINER` function reading `import_sessions`) in a later prompt?
5. **`updated_at` bump.** `refreshMakingStats` moves `builds.updated_at`, which orders "recently worked" lists. Fine, or should UI-P43 write only when the figures actually change?
6. **Already-expired parsed sessions.** Leave them expired (proposed), or revive those whose proposal still exists?
7. **`model` bound.** 64 characters, enforced in both the connector schema and the database. OK?
