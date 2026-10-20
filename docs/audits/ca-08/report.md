# CA-08 · Audit: drafts don't load, and nothing can be added to a new post

Audited on 20 October 2026 against `main` at `6a5cd7f` (CA-07 merged). Read-only: no product code, migration, policy, setting or data was changed, nothing was deployed or merged. What this audit added is under `docs/audits/ca-08/` and `src/**/__audit__/`.

Files:

- `docs/audits/ca-08/report.md`: this report.
- `docs/audits/ca-08/live-checks.sql`: the read-only SQL for the live database (Part 4A).
- `docs/audits/ca-08/browser-steps.md`: the browser steps (Part 4B).
- `docs/audits/ca-08/scan-untyped.mjs`: a read-only scan of untyped columns and casts (cause 9).
- `src/lib/build/__audit__/fakeSupabase.ts`: a fake PostgREST and GoTrue behind the real supabase-js client.
- Five audit test files under `src/lib/build/__audit__/`, `src/pages/site/compose/__audit__/` and `src/pages/site/drafts/__audit__/` (section 4).

---

## 1. For Miles

The Drafts page can't show your 15 drafts, and a new post can't save anything (that is what "Couldn't make that session. Try again." means), but your drafts are safe and untouched on the server.

The most likely reason is that the database change that came with post threads on 16 October was never applied to the live database, while the site has asked for the new column it adds (`post_doc`) every time it reads or saves a build since that day.

To check, paste `docs/audits/ca-08/live-checks.sql` once into the database SQL editor in Lovable and run it, then follow the five-minute steps in `docs/audits/ca-08/browser-steps.md` in Chrome; neither changes anything.

If this is the reason, the SQL's first row ("builds.post_doc exists") will say MISSING and Chrome will show `column builds.post_doc does not exist`; if not, the other rows and the table at the end of the browser steps say where to look instead.

Next, the three database changes made since 10 October are applied through Lovable in date order, and no more feature work ships until a new post saves and your drafts are back.

---

## 2. Flows

How to read the tables: every Supabase call goes through the real `supabase` client (`src/integrations/supabase/client.ts`). "BUILD_COLUMNS" is the column list at `src/lib/build/builds.ts:28-29`: 37 columns, the last one `post_doc`.

**Policy, trigger and check legend.** These are the newest definitions in the repository; whether each one is live is decided by `live-checks.sql`.

| Code | What | Where |
|---|---|---|
| SEL-B | `Builds are readable unless draft`: SELECT `status <> 'draft' OR creator_id = auth.uid() OR is_admin(auth.uid())` | `20260825112817_….sql:226` (same text `20260823120000_build_record_core_schema.sql:226`) |
| INS-B | `Users create their own builds`: INSERT WITH CHECK `creator_id = auth.uid()` | `20260825112817_….sql:234` |
| UPD-B | `Creators and admins update builds`: UPDATE USING `creator_id = auth.uid() OR is_admin(…)`, no WITH CHECK | `20260825112817_….sql:238` |
| N-pol | build_nodes: SELECT if the build is readable; INSERT, UPDATE, DELETE if the build is the caller's | `20260825112817_….sql:253, 267, 280, 293` |
| M-pol | build_media: the same by build; set A (4 policies) or set B (2 policies) | `20260823140000_build_media_storage.sql:70-110`, `20260825112911_….sql:60-95` |
| I-pol | import_sessions: owner only, TO authenticated; anon has no grant | `20260917120000_import_sessions.sql:213-229, 255-256` |
| P-pol | profiles: SELECT true; UPDATE and INSERT own | `20260316202122_….sql:20-27` |
| T-upd | `trg_builds_updated_at` BEFORE UPDATE (so `updated_at` moves on every write) | `20260825112817_….sql:169` |
| T-ins | AFTER INSERT triggers on builds: `trg_rc_xp_build_visible`, which returns at once for a draft | `20261001240000_rc_xp_build_events.sql:197-208, 233` |
| T-cover | `trg_build_media_cover_mirror` AFTER INSERT OR UPDATE on build_media | `20260911120000_build_post_media.sql:333` |
| C-b | builds checks: status, shape (`20260825112817:64-65`); counts ≥ 0 and `jsonb_typeof(making) = 'object'` (`20261001280000:95-98`); post_doc an object ≤ 200 kB (`20261016120000:35`) | as given |
| C-m | build_media checks: kind (`20260825112911:41`); post_position 0..3, then 0..39 after post_threads (`20260911120000:122` → `20261016120000:62`); post_position kind (`20260911120000:139`); post_text ≤ 280 (`20260911140000:130`) | as given |
| FK-t / FK-c | `build_nodes.type → node_types.key` (`20260823120000:105`); `builds.creator_id → profiles.id` (`:28`) | as given |

### 2.1 Opening the Drafts page

| Step | File:line | Call | Table / function | Columns | Policy / trigger / check | Message on failure |
|---|---|---|---|---|---|---|
| Route | `App.tsx:342` | `ProtectedRoute` → `DraftsPage` | — | — | signed out → /login | (redirect) |
| Header badge | `SiteHeader.tsx:381-386` → `sessions.ts:228-241` | `countDraftBuilds`: `auth.getSession()`, then HEAD `count=exact`, `eq creator_id`, `eq status 'draft'` | builds | `id` | SEL-B | none: no number is drawn (`draftCount.data ?? 0`) |
| Drafts | `DraftsPage.tsx:40-44` → `drafts.ts:39-46` → `builds.ts:245-260` | `listDraftsWithSessions` → `auth.getSession()` → `listDraftBuildsByCreator`: GET `select=BUILD_COLUMNS`, `eq creator_id`, `eq status draft`, `order updated_at.desc`, offset 0, limit 50 | builds | BUILD_COLUMNS | SEL-B | "That didn't load." and **Try again**, in **both** panels (`DraftsView.tsx:586-591, 612-617`). Nothing is logged (no `[Drafts]` line) |
| Counts | `drafts.ts:49-58` | GET `select=id,session_count`, `in id (…)`, limit n | builds | `id, session_count` | SEL-B | as above |
| Waiting sessions | `DraftsPage.tsx:45` → `useWaitingSessions.ts:26-34` → `sessions.ts:159-171` | `listSessions({ includeAttached: false })`: GET `select=SESSION_COLUMNS`, `status in (parsed)`, `order created_at.desc`, limit 50; re-read every 10 s | import_sessions | `id, client, model, target_build_id, build_id, created_at`, `proposal->events->0->payload->>text`, `proposal->summary->user_turn_count`, `…assistant_turn_count` | I-pol | as above: one status for the page (`DraftsPage.tsx:111-112`) |
| All sessions | `DraftsPage.tsx:46-50` | `listSessions({ includeAttached: true })`: `status in (parsed, claimed)` | import_sessions | as above | I-pol | none: "Show N already in a build" is missing |
| Start a build from a session | `DraftsPage.tsx:66-77` → `sessions.ts:261-289` → `imports.ts:418-466` | `attachSession(new)`: GET `id,status,build_id`; `loadImportProposal` (GET `proposal`, `imports.ts:301`); `claimImport` → `createBuild` (POST builds, `select=BUILD_COLUMNS`); `materialiseProposal`; PATCH import_sessions `status=claimed, build_id` where `status=parsed`; `recordCreatedVia`; `refreshMakingStats` | import_sessions, builds | as listed; `created_via`; the making stats | I-pol, INS-B, UPD-B, T-ins, T-upd, C-b, FK-c | toast "Couldn't start a build from that session."; console `[Drafts] attachSession (new) failed` |
| Add a session to a draft | `DraftsPage.tsx:79-91` → `imports.ts:474-485` | `attachSession(existing)`: `verifyClaimTarget` → `getBuildHeader` (GET builds `select=BUILD_COLUMNS`), then as above | as above | as above | as above | toast "Couldn't add that session."; `[Drafts] attachSession (existing) failed` |
| Remove a session | `DraftsPage.tsx:93-105` → `imports.ts:496-522` | `discardImport`: PATCH `status=expired` where `status=parsed`, `select=user_id`; storage list and remove `imports/<user>/<id>/` | import_sessions; storage `imports` | `status, updated_at` | I-pol; imports object policies (drizzle `0007`) | toast "Couldn't remove that session."; `[Drafts] removeSession failed` |

### 2.2 Opening one draft (`/compose/:id`)

| Step | File:line | Call | Table / function | Columns | Policy / trigger / check | Message on failure |
|---|---|---|---|---|---|---|
| Route | `App.tsx:527-530`, `ComposeRoute.tsx:57-75` | the check query `getBuild` (retry 1); rebuilds and `?from=` go to the legacy screen | — | — | signed out → /login (`ComposeRoute.tsx:67-69`) | blank fallback while pending |
| Header | `builds.ts:124-133` (`getBuildHeader`, from `getBuild` `:163`) | GET `select=BUILD_COLUMNS`, `eq id`, maybeSingle | builds | BUILD_COLUMNS | SEL-B | "This build didn't load." and **Try again** (`SandboxView.tsx:494-498`); nothing logged |
| Tree | `nodes.ts:119-131` | GET `select=NODE_COLUMNS`, `eq build_id`, `position not null`, `order position`, limit 2000 | build_nodes | `id, build_id, parent_id, position, type, title, note, payload, source_ref, event_id, is_gap, created_at` | N-pol | as above |
| Tray | `nodes.ts:136-148` | as above, `position is null`, `order created_at` | build_nodes | as above | N-pol | as above |
| Events | `events.ts:36-50` | GET `select=EVENT_COLUMNS`, `eq build_id`, `order ordinal` | build_events | 11 columns (`events.ts:13`) | build_events SELECT (`20260823120000`) | as above |
| Node types | `nodeTypes.ts:38-46` (cached for the visit) | GET `select=NODE_TYPE_COLUMNS`, `order category, sort` | node_types | 10 columns | SELECT true | as above |
| The post thread | `useComposeThread.ts:95-103` → `thread.ts:732-743` → `cover.ts:338-349` | when `post_doc` is not a thread: `getPostMedia`: GET build_media `select=POST_MEDIA_COLUMNS`, `post_position not null`, `order post_position`, limit 40; `threadOf` → `legacyThread`; readers call `toGrids` (`thread.ts:358`, pure) | build_media | MEDIA_COLUMNS + `post_position, post_text` | M-pol | the Post tab's own error state |
| Cover | `ComposePage.tsx:173-179` → `composeCover.ts:145-148` | `getComposerCover` → `getPostMedia` | build_media | as above | M-pol | none (no cover) |
| Sessions, Made with | `useComposeSessions.ts:101-114` → `sessions.ts:195-204`, `183-192`; `making.ts:303-313` | `listBuildSessions` (`eq build_id`, `status claimed`); `listLibrarySessions` (`status in (parsed, claimed, expired)`, `proposal not null`, every 10 s); `getMadeWith` (GET builds `made_with, making`) | import_sessions; builds | SESSION_COLUMNS + `status`; `made_with, making` | I-pol; SEL-B | Your sessions shows its error state; Made with falls back to the record |
| Facets | `ComposePage.tsx:309-314` → `gallery.ts:760-772` | RPC `gallery_facets(thresholds)` | `public.gallery_facets(jsonb)` (`20260824140000_gallery_facets.sql:35`) | — | EXECUTE to anon, authenticated (`:121`) | none (no audience suggestions) |
| Teams, manual steps | `SandboxPage.tsx:160, 227` | `getNodeType('team')`, `getNodeType('manual_step')` (cached) | node_types | — | — | no team offered; Manual step disabled |
| The maker | `AuthContext.tsx:43-50` | GET profiles, 17 columns, `eq id` | profiles | 17 columns | P-pol | none |
| References, colours | `postRefs.ts` (`refGroups`), `usePostLinks.ts`, `previewColours` | pure | — | — | — | a throw reaches the app's boundary: "Something went wrong." (`ErrorBoundary.tsx:20-27`; `ComposeRoute` has no `RouteBoundary` on purpose, `ComposeRoute.tsx:78-80`) |
| Colour swatches | `useColourSwatches.ts:52-65` → `colourSwatches.ts:66-73` | on the first picker: `auth.getUser()` (GET `/auth/v1/user`), GET profiles `select=colour_swatches` | profiles | `colour_swatches` | P-pol | none, by design |

### 2.3 Starting a new post (`/compose/new`)

| Step | File:line | Call | Table / function | Columns | Policy / trigger / check | Message on failure |
|---|---|---|---|---|---|---|
| Route | `ComposeRoute.tsx:55, 76-84` | no build read on `/compose/new`; `SandboxPage` (`SANDBOX_COMPOSER_ENABLED = true`, `flags.ts:17`) | — | — | — | — |
| On load | as 2.2: library sessions, facets, node types, the maker | | | | | as 2.2 |
| First change | `ComposePage.tsx:153-167` (title, description, audience) or any add | `edit` → `held` + `ensureBuild` (`ComposePage.tsx:134-144`, `108-132`) | — | — | — | — |
| createBuild | `builds.ts:89-121` | `auth.getSession()`; POST builds `{creator_id, slug, title, outcome, shape: 'other', status: 'draft', made_for, made_with: [], live_url, repo_url}`, `select=BUILD_COLUMNS`, single | builds | the 10 written; BUILD_COLUMNS returned | INS-B, SEL-B (the returned row), FK-c, C-b, T-ins | toast "Couldn't start your draft. Try again." (`ComposePage.tsx:127`) and console `[Compose] createBuild failed` (`:126`), then the caller's own toast |
| Address | `ComposePage.tsx:121` | `navigate('/compose/{id}', { replace: true })` | — | — | — | — |
| Held edits | `ComposePage.tsx:146-151` → `useComposeBuild.ts:204-213`, `153-198` → `builds.ts:204-217` | `patchBuild` → after 800 ms `updateBuild`: PATCH builds `eq id`, `select=BUILD_COLUMNS`, single | builds | `title, outcome, made_for, completeness` | UPD-B, SEL-B, T-upd, C-b | status line "Draft · not saved · Try again" (`SandboxView.tsx:534-548`); no toast, nothing logged, and the patch is sent again every 800 ms (`useComposeBuild.ts:185-197`) |

### 2.4 Every "add" or "create" in the composer

Every add on a new post starts with `ensureBuild` (2.3), so a failed `createBuild` gives "Couldn't start your draft. Try again." **and** the add's own toast.

| Step | File:line | Call | Table / function | Columns | Policy / trigger / check | Message on failure |
|---|---|---|---|---|---|---|
| New session | `SandboxPage.tsx:1146, 1308, 1362` → `AddSessionDialog.tsx:43-46` → `SandboxPage.tsx:431-445` | `ensureBuild`; `setSessionMeta` (`making.ts:438-453`): `sessionMetaRefusal` (pure, `:425-431`); `readMadeWith`: GET builds `made_with, making`, maybeSingle (`:303-308`); `updateBuild`: PATCH `making`, `select=BUILD_COLUMNS`; `addMadeWithTools` for a tool (caught, `:451`); `refreshRecord` = `invalidateQueries` (`SandboxPage.tsx:402`) | builds | `making.sessions_meta['typed-<uuid>'] = {tool, date}` | SEL-B, UPD-B, C-b (making is an object), T-upd | "Couldn't make that session. Try again." (`SandboxPage.tsx:441`), console `[Sandbox] session not made` (`:440`) |
| Session meta: tool, date | `SandboxPage.tsx:447-465` | `setSessionMeta` (an old build's typed run: `claim`) | builds | `making` | as above | "Couldn't save that session. Try again."; `[Sandbox] session not saved` |
| Goal | `SandboxPage.tsx:468-494` | `goalRefusal`; `setSessionMeta` | builds | `making` | as above | the refusal sentence, or "Couldn't save the goal. Try again." |
| Colour (session) | `SandboxPage.tsx:546-561` | `setSessionMeta` with `colour` | builds | `making` | as above | "Couldn't save that colour. Try again." |
| Extras | `SandboxPage.tsx:497-520` | `extrasRefusal`; `setSessionMeta` | builds | `making` | as above | the refusal sentence, or "Couldn't save that. Try again." |
| At the same time as | `SandboxPage.tsx:523-543` | `setSessionMeta` once per paired session, in a loop | builds | `making` | as above | "Couldn't save that. Try again." |
| Add prompt | `BuildList.tsx` AddPrompt → `SandboxPage.tsx:563-566` → `useComposePrompts.ts:530-542` → `composePrompts.ts:134-160` → `composeCover.ts:34-49` → `nodes.ts:36-45` | `ensureBuild`; `addWrittenPrompt` → `placeTopNode` → `upsertNode`: POST build_nodes (`resolution=merge-duplicates`, `on_conflict=id`), `select=NODE_COLUMNS`, single; then `addMadeWithTools` (async) | build_nodes; builds | `type 'prompt'`, `payload {text, tool, model, session}`, `position` | N-pol, FK-t, the unique placed-position index | "Couldn't add that prompt. Try again."; `[Compose] prompt write failed` (`useComposePrompts.ts:115-118`) |
| Add tool | `AddToolDialog` → `SandboxPage.tsx:757-763` → `useComposePrompts.ts:609-623` → `graph.ts:1594` | `addTool` → `upsertNode` | build_nodes | `type 'integration'`, `payload {service}` | N-pol, FK-t | "Couldn't add that tool. Try again." |
| Add result | as above → `graph.ts:1604` | `addResult` | build_nodes | `type 'result'` | N-pol, FK-t | "Couldn't add that result. Try again." |
| Add agent or team | `AddAgentDialog` → `SandboxPage.tsx:680-693` → `useComposePrompts.ts:641-669` → `graph.ts:1026, 1039` | `toolRefsFor` (an `addTool` per tool), then `addAgent`, or `addTeam` (the team, then its first agent) | build_nodes | `agent_config` / `team` payloads | N-pol, FK-t (`team`: `20261001300000`) | "Couldn't add that agent. Try again." / "… team …" / "Teams need the Deploy queue item from UI-P61." |
| Add code | `AddCodeDialog` → `SandboxPage.tsx:735-746` → `useComposePrompts.ts:733-749` → `graph.ts:1204` | `addCode` per piece | build_nodes | `type 'code'` | N-pol, FK-t | "Couldn't add that code. Try again." / "Code is at most 100,000 characters. …" |
| Add manual step | `SandboxPage.tsx:714-722` → `useComposePrompts.ts:710-731` → `graph.ts:1153, 1407` | `uploadMedia` (with a picture); `addManualStep`; `placeStepAfter` → `reorderNodes` | storage, build_media, build_nodes | `type 'manual_step'` | M-pol, N-pol, FK-t | "Couldn't add that manual step. Try again." |
| Add check | `SandboxPage.tsx:724-733` → `useComposePrompts.ts:751-764` → `graph.ts:1277` | `addCheck` | build_nodes | `type 'eval_run'` | N-pol, FK-t | the refusal sentence, or "Couldn't add that check. Try again." |
| Add document or file step | Add › File → `SandboxPage.tsx:1102-1107` → `addSetup` (`:957-1022`) or `addOneFile` (`:846-875`) → `media.ts:229-305` → `graph.ts:1549` | `uploadMedia`: PUT storage `build-media/<build>/…` (XHR, `media.ts:528-555`); POST build_media, `select=MEDIA_COLUMNS`, single; `addFile` → `upsertNode` | storage `build-media`; build_media; build_nodes | build_media: `build_id, node_id, bucket, path, kind, mime, bytes, width, height, duration`; node `payload {title, media_id}` | storage "build-media owner upload" (`20260825112911:122`); M-pol; C-m kind; T-cover | "Couldn't add {name}. Try again."; `[Sandbox] file not added` |
| Setup files | `SandboxPage.tsx:957-1022` → `setup.ts:386-433` | `sessionForSetup` (may make a session: `setSessionMeta`), then nodes per file | builds; build_nodes; storage | as above | as above | "Couldn't add that to the setup. Try again."; `[Sandbox] setup not added` |
| Nesting a tile | `SandboxPage.tsx:654-678` → `useComposePrompts.ts:787-803` → `graph.ts:1540` → `nodes.ts:58-105` | `reorderNodes`: GET build_nodes `in id`; POST upsert parked at negative positions; POST upsert placed | build_nodes | `parent_id, position` | N-pol, the unique placed-position index | the guard's sentence (`NEST_COPY`), or "Couldn't move that. Try again." |
| Copy together | `BuildList.tsx:354-360, 1711` → `copyTogether.ts:35-44` | pure, to the clipboard | — | — | — | — |
| Claiming a legacy session | `SandboxPage.tsx:405-416` (`claim`) → `useComposePrompts.ts:766-782` (`claimSession`) | `ensureBuild`; `setSessionMeta` (a new key); `setStepSession` (`graph.ts:813`) per step through `upsertNode`; invalidate | builds; build_nodes | `making.sessions_meta`; `payload.session` | UPD-B, N-pol | "Couldn't save that session. Try again." |
| Link a step | `PostTab.tsx:264` → `GridView.tsx:300` → `useComposeThread.ts:213-226, 145-203` → `thread.ts:765-773` | the grid's `attrs.step` in the document → `saveThread`: `checkThread`; `setPostMedia` → RPC `set_build_post_media(p_build_id, p_media_ids)`, `select=POST_MEDIA_COLUMNS` (`cover.ts:378-409`); `updateBuild` PATCH `post_doc` | build_media; builds | `post_position, post_text`; `post_doc` | M-pol (the function is SECURITY INVOKER), C-m (0..3 live before post_threads), T-cover; UPD-B, C-b | status line "not saved · Try again"; console `[Compose] thread save failed` (`useComposeThread.ts:181`); no toast |
| A reference | `PostTab.tsx` (`references`) | a `ref` or `link` mark (`session:…`, `node:…`) in the document → `saveThread` | as above | as above | as above | as above |
| A colour (tile) | `SandboxPage.tsx:622-633` → `useComposePrompts.ts:575` → `graph.ts:1750` | `setNodeColour` → `upsertNode` | build_nodes | `payload.colour` | N-pol | "Couldn't save that colour. Try again." |
| A colour (swatches) | `useColourSwatches.ts:67-77` → `colourSwatches.ts:76-86` | `auth.getUser()`; PATCH profiles `colour_swatches` `eq id`, **no select** | profiles | `colour_swatches` | P-pol; `profiles_colour_swatches_shape` (`20261020120000:30`) | none, by design (kept in memory) |
| A picture in the post | `pictures.ts:413-441` → `postMedia.ts:78-92` → `media.ts:229-305`; then `saveThread`; then `syncThreadCover` (`composeCover.ts:260-276`) | `ensureBuild`; `uploadMedia`; RPC `set_build_post_media`; PATCH `post_doc`; GET build_nodes and build_media, `upsertNode` for the cover's node | storage, build_media, builds, build_nodes | as above | M-pol, C-m, T-cover, UPD-B | the tile is marked failed (Retry or Remove); `[Compose] could not start the picture upload` / `[Compose] picture upload failed` |
| A picture on a result | `SandboxPage.tsx:785-801` | `uploadMedia`; `setFields` (`upsertNode` with `media_id`) | as above | | | "Couldn't add {name}. Try again." |
| The cover (Card) | `ComposePage.tsx:186-214` → `composeCover.ts:188-238` | `uploadMedia`; `addPostMedia` (`cover.ts:425`) or `setPostMedia`; `placeCoverNode` | as above | | | "That didn't add. Try again." (`mediaError`); `[Compose] cover failed` |
| Saving the post thread | as Link a step | | | | | |
| Title, outcome, audience | 2.3, Held edits (`patchBuild`, `held`) | | | | | |

### 2.5 Other writes from the composer

| Step | File:line | Call | Table / function | Columns | Policy / trigger / check | Message on failure |
|---|---|---|---|---|---|---|
| Made with: tick, untick, typed | `useComposeSessions.ts:174-200` → `making.ts:340-350, 386-393` | `readMadeWith`; PATCH `made_with` (and `making.excluded_models`); `refreshMakingStats` | builds | `made_with, making` | UPD-B | "Couldn't change Made with. Try again." / "Couldn't add that to Made with. Try again." |
| A session's tool | `useComposeSessions.ts:259-274` → `making.ts:405-419` | `listBuildSessions`; `readMadeWith`; PATCH `making.session_tools`; `addMadeWithTools` | builds; import_sessions | `making` | UPD-B, I-pol | "Couldn't save that tool. Try again." |
| A session's model | `useComposeSessions.ts:241-256` → `sessions.ts:306-326` | PATCH import_sessions `model, updated_at`, `select=id,build_id`; `refreshMakingStats` | import_sessions; builds | `model, updated_at` | I-pol; `import_sessions_model_length_check` | "Couldn't save that model. Try again." |
| A session into this draft | `useComposeSessions.ts:222-239`; Add › Session `SandboxPage.tsx:819-843` | `attachSession` (2.1) | import_sessions; builds | | | "Couldn't add that session. Try again."; `claimForBuild`: console only |
| Making stats | `making.ts:232-288` | `listBuildSessions`; GET builds `made_with, making`; PATCH counts, `models_used`, `making`, `made_with` | builds | | UPD-B, C-b counts | none (console.warn with the code and the build id) |
| More details | `useComposeDetails.ts:28-31, 130-160` → `composeDetails.ts:83-115` | the breakage and gap nodes (`upsertNode`, `deleteNode`); costs through `edit` → `patchBuild` | build_nodes; builds | | N-pol, UPD-B | `[Compose] details write failed` and its toast |
| Publish | `ComposePage.tsx:273-294` → `useComposeBuild.ts:285-385` | `updateBuild` (status, `published_at`); `refreshMakingStats` | builds | | UPD-B, T-ins (XP fires now) | "Couldn't publish. Try again." |
| Not shared (setup) | `SandboxPage.tsx:1032-1046` → `setup.ts:440` | `upsertNode` | build_nodes | `payload` | N-pol | "Couldn't change that. Try again." |

No edge function is called by any of these flows.

---

## 3. Causes

Verdicts: **Confirmed**, **Ruled out**, or **Needs the live check**. "Proved" means a test, a file or a live read shows it; "likely" means the evidence points there but has not been seen on the live database.

### Cause 1 · The live database is behind the repository. **Needs the live check: SQL rows A 1 to A 6, and the Response in browser step 9. Likely (strong).**

Every column, RPC and edge function the flows name, paired with the migration that creates it:

| Name | Used by | Created by | In `types.ts` (live, 13 Oct)? |
|---|---|---|---|
| `builds.post_doc` | BUILD_COLUMNS: every builds read and write in 2.1 to 2.5 (`builds.ts:28-29`); `GALLERY_BUILD_COLUMNS` (`gallery.ts:305-306`); `saveThread` (`thread.ts:772`) | `20261016120000_post_threads.sql:22-23` | **no** |
| `profiles.colour_swatches` | the colour picker (`colourSwatches.ts:70, 82`) | `20261020120000_ca06_colour_swatches.sql:19-20` | **no** |
| `builds.session_count, prompt_count, ai_turn_count, models_used, making` | Drafts counts; every session write; making stats | `20261001280000_sessions_and_making.sql:83-87` (drizzle `0010`, 8 Oct) | yes |
| `builds.created_via` | `recordCreatedVia` | `20260921130000_builds_created_via.sql` (drizzle `0000`) | yes |
| `builds.rebuild_note, rebuild_count, source_title_at_fork, source_handle_at_fork` | BUILD_COLUMNS | `20260827140000_rebuild_columns.sql` (drizzle `0001`) | yes |
| `builds.cover_media_id` | BUILD_COLUMNS | `20260827120000_build_cover_media.sql` (drizzle `0001`) | yes |
| `builds.solves_node_id, source_content_item_id` | BUILD_COLUMNS | `20260828140000_bounties_header_table.sql`, `20260825120000_build_source_content_item.sql` | yes |
| the other 29 BUILD_COLUMNS | as above | `20260823120000_build_record_core_schema.sql` and its August follow-ups | yes |
| `build_nodes.*` (12), `build_events.*` (11), `node_types.*` (10) | 2.2, 2.4 | `20260823120000` | yes |
| `build_media.*` (13) + `post_position`, `post_text` | 2.2, 2.4 | `20260823140000`; `20260911120000:100`; `20260911140000:111` | yes |
| `import_sessions.*` and `model` | 2.1, 2.2, 2.5 | `20260917120000`; `20261001280000:9-10` | yes |
| `builds.like_count, comment_count` | the Gallery feed since PT-09 (`gallery.ts:1320, 1431`), not these flows | `20261001180000_rc_build_social.sql` | **no** (UI-P42 found them not live) |
| RPC `gallery_facets(jsonb)` | 2.2 | `20260824140000_gallery_facets.sql:35` | (functions are not in the scan) |
| RPC `set_build_post_media(uuid, uuid[])` | 2.4 (thread save, cover) | `20260911120000:362`; cap 4 → 40 in `20261016120000:78-170` | |
| `is_admin(uuid)` (in every builds policy), `set_updated_at_timestamp()`, `rc_xp_build_visible()`, `sync_build_cover_from_post_media()` | policies and triggers | `20260316202122:77`, `20260427120431:2`, `20261001240000:197`, `20260911120000` | |
| Edge functions | none in these flows | — | — |

Evidence (each item is proved unless it says "likely"):

- **The code names `post_doc` everywhere a build is read or written.** It is in BUILD_COLUMNS (`builds.ts:29`), which `createBuild` (`:116`), `getBuildHeader` (`:127`), `updateBuild` (`:212`) and `listDraftBuildsByCreator` (`:251`) all select. It came with PT-01, commit `ec81d5a0`, which reached `main` in #334 on 16 Oct at 12:10 UTC. It is the only change to BUILD_COLUMNS since September (`git log -p`).
- **Of every column the two flows name, only `builds.post_doc` and `profiles.colour_swatches` are missing from `types.ts`.** `node docs/audits/ca-08/scan-untyped.mjs` lists all the others as typed. `types.ts` is generated from the live database by Lovable: `docs/reconciliation/HANDOVER.md:22`, item 17, says so, and since 16 Sep every change to it is a `gpt-engineer-app[bot]` commit, the last on 13 Oct (`80396686`). The replay of the repository's migrations up to 13 Oct gives a `builds` table with exactly the 42 columns `types.ts` lists (section 4.3).
- **Lovable's own record of applied changes stops on 13 Oct.**
  - `drizzle/migrations/meta/_journal.json` ends at `0011_sandbox_node_types`: its `when` is 1791897168380, which is 2026-10-13 13:12 UTC.
  - The last Lovable database commits are "Applied sessions/making migration" (8 Oct) and "Ensure sandbox node_types exist in DB" (13 Oct).
  - Nothing applies `post_threads` (16 Oct), `tf07` (17 Oct) or `ca06` (20 Oct).
  - The deploy queue (`docs/reconciliation/HANDOVER.md:5-23`) ends at item 18 and never mentions those three files. A repository-wide search finds no mention of them outside the migration folder.
- **Migrations are applied by hand.** The deploy queue applies them "by Lovable message", and Lovable once applied 16 at once through a temporary run-any-SQL helper (drizzle `0006`, dropped in `0007`). So the drizzle journal is not a complete record, and SQL pasted into Lovable's editor leaves no trace in the repository. That is why this cause stays **Needs the live check** and is not Confirmed.
- **The live listing shows no draft made or changed since 10 Oct.** The prompt's facts say so, and this audit listed them again today through the connector (`buildgallery_list_drafts`, read-only, after #357 shipped the session toast at 10:35 UTC): 15 drafts, the newest touched `2026-10-10T19:31:55Z`.
  - `updated_at` moves on every write (T-upd), and `createBuild` inserts a `draft`.
  - Miles's attempts today therefore made no draft. The failure is at or before `createBuild`, not after it (section 4.2 shows a later failure would leave a new empty draft).
- **The connector's read names none of the new columns.** It selects `id, title, updated_at, build_nodes!build_nodes_build_id_fkey(count)` (`supabase/functions/mcp/index.ts:1582-1590`) under Miles's own token (`withSupabase<Database>({ auth: "user" })`, `:2347`). So "the data is there and readable by that path" is exactly what this cause predicts.
- **The reproduction matches what Miles sees.** With `post_doc` taken out of the fake's schema, the real `SandboxPage` shows two toasts with "Couldn't make that session. Try again." in front, makes no draft, and logs `createBuild failed: column builds.post_doc does not exist` with code 42703. The real `DraftsPage` shows "That didn't load." in both panels (section 4).
- **The date fits.** The last writes were on 10 Oct at 19:16 to 19:31 UTC, after #303 merged (19:01 UTC), so writes worked then. Nothing that could break them reached `main` until 16 Oct. Nothing was saved between 10 and 16 Oct; the code does not explain that, so the likely reading is that nobody tried. Writes have most likely failed since #334 shipped on 16 Oct.

The SQL rows that decide it:

- A 1 `builds.post_doc exists`: MISSING means Confirmed.
- A 2: the cap is 40 only if `post_threads` was applied whole.
- A 3: TF-07's `made_by` field.
- A 4: `colour_swatches`.
- A 5 and A 6: every other column the flows name.

Run on a local stand-in replayed from the repository (4.3), these rows read MISSING, 4, no `made_by` and MISSING. After the three migrations they all read true.

### Cause 2 · A check or trigger refuses the write. **Ruled out in the repository; Needs the live check for drift: SQL rows A 9, F and G.**

- Checks on the five tables, all of them listed in 2 (C-b, C-m, plus `import_sessions` and `profiles`).
  - Nothing validates the shape of `making` beyond `jsonb_typeof(making) = 'object'` (`20261001280000:98`). Every client write sends an object (`making.ts:449`: `{ ...asObject(making), sessions_meta }`).
  - `post_doc` is checked only for being an object of at most 200 kB (`20261016120000:35`).
  - No migration adds a column check to these tables with `ALTER TABLE … ADD COLUMN … CHECK` (searched).
- The insert from `createBuild` meets the following, and all pass for a draft:
  - the status and shape checks: it sends `draft` and `other`;
  - `making` defaults to `{}`;
  - FK-c needs the maker's profile row, which Miles has;
  - T-ins: `trg_rc_xp_build_visible` returns at once unless the status is published or gallery (`20261001240000:206-208`). The notify and badge triggers do the same (`20261001200000:206-208`, `20261001260000:357-359`), and per UI-P42 they are not live anyway.
- RAISE: the only ones on these paths are in `set_build_post_media` (`20261016120000:98, 104, 146`: too many, duplicate, not on the build) and in `enforce_import_ceilings`, which runs on the connector's inserts only.
- The reproduction shows what a refused check would look like: one toast and an empty draft left behind (4.2). Miles's live listing has no such draft.
- On the live side, A 9 counts any restrictive policy, check or trigger that no migration defines, and any disabled trigger. Rows F and G show each one. The stand-in tests (4.3) show that a stray check, a stray restrictive policy and a disabled trigger are each caught.

### Cause 3 · Row level security. **Ruled out for reading; Needs the live check for the write policies: SQL rows A 7, A 8, D and E.**

- **Reading.** The connector reads Miles's drafts under his own token, so the builds SELECT policy admits him: proved by its 15 rows, newest 10 Oct.
- **The policies as written admit the owner.** SEL-B, INS-B, UPD-B and the `build_nodes`, `build_media` and `import_sessions` policies all admit the signed-in owner.
  - `20261001290000_rls_initplan.sql` only wraps `auth.uid()` and `is_admin(auth.uid())` in sub-selects, policy by policy, each in its own subtransaction (`:44-100`). It changes how often a policy asks, not what it admits.
  - On the stand-in, every policy still matches after it runs (4.3).
  - No later migration touches a policy on these tables, except `rc_reports`' restrictive read policy (`20261001190000:49`). That one only narrows reading of hidden builds and is not live per UI-P42.
- **A refused update is not silent here.**
  - `updateBuild` ends in `.single()` (`builds.ts:213`), so zero rows updated comes back as PGRST116, "Cannot coerce the result to a single JSON object" (proved, `dataLayer.audit.test.ts`).
  - A draft the policy hides fails one step earlier, in `readMadeWith`: "That build is no longer available." (proved).
  - The one silent write in these flows is `saveColourSwatches`, a PATCH with no select (`colourSwatches.ts:82`).

### Cause 4 · The client refuses before any request is made. **Ruled out (proved: `sessionMeta.audit.test.ts`, 7 tests).**

- `newSessionKey()` is always a typed key, never a legacy one: checked over 2,000 keys, and in the branch with no `crypto.randomUUID`.
- `todayDay()` is always `YYYY-MM-DD`. It was checked in seven time zones and twelve instants, including midnight in BST and 25 Oct 2026 01:00 UTC, when BST ends.
- A `null` tool, a tool id and a typed name all pass. The picker trims typed names to 40 (`toolPickerModel.ts:42`, `ToolPicker.tsx:112`), the same as `SESSION_TOOL_MAX`.
- `extrasOf` and `extrasRefusal` ask nothing of an entry with no extras.
- An old or odd `sessions_meta` does not make the write refuse: only the new entry is checked (`making.ts:439-442`).

Side findings, not the cause:

- `todayDay()` names the UTC day, so for the first hour after midnight in BST a session is dated yesterday.
- The rewrite deletes any entry the reader can't read (`making.ts:444, 153-175`).

### Cause 5 · `addMadeWithTools` or `refreshRecord` throws after the write. **Ruled out (proved).**

- `addMadeWithTools` is caught inside `setSessionMeta` (`making.ts:451`).
- `refreshRecord` is `queryClient.invalidateQueries` (`SandboxPage.tsx:402`). In `@tanstack/query-core` 5.90.20 that goes through `refetchQueries`, which swallows every fetch error unless `throwOnError` is set (`node_modules/@tanstack/query-core/build/modern/queryClient.js:166-181`).
- The reproduction makes every re-read fail after a successful write: no toast appears. The session is saved, but it is not drawn and the page says "This build didn't load." That is the half-made screen the prompt asked about, and it is not what Miles sees (4.2).

### Cause 6 · Signed-in state. **Ruled out as the cause; Needs the live check to be sure: the badge number in browser steps "two quick looks", and the `[Compose]` line.**

- **The published site uses plain `localStorage`.** `brokeredPreviewStorage()` returns `localStorage` unless the page is framed on a Lovable preview host (`previewAuthStorage.ts:13-18`), and the published site is not framed. The broker is used only inside the Lovable editor's preview.
- **No session, an expired one, or a restored one.**
  - `AuthContext` reads the same client's session (`AuthContext.tsx:58-79`), so a page with no session has `isLoggedIn` false.
  - Both routes then send the visitor to `/login` (`ComposeRoute.tsx:67-69`; `ProtectedRoute`).
  - An expired token is refreshed by `getSession`; a failed refresh signs out, which also redirects.
  - A session restored after a refresh shows the blank fallback while `loading` (`ComposeRoute.tsx:66`).
- **If a request is made with no session anyway:**
  - `listDraftsWithSessions` returns `[]` without asking (`drafts.ts:42-43`).
  - `listSessions` is refused for anon with 42501 (`20260917120000:255`), so the Drafts page shows "That didn't load.", not "Nothing in progress." (proved, 4.2).
  - `createBuild` throws "no signed-in user" (`builds.ts:98-100`): two toasts (proved).
- **The connector's read under Miles's token** shows that his account and his rights are fine server-side.

### Cause 7 · The Drafts page's second query. **Ruled out as the cause; Confirmed as a design flaw.**

- `useWaitingSessions` → `listSessions` reads `import_sessions` (2.1), with no RPC and no edge function.
- No migration after 10 Oct touches `import_sessions`; the last was `20261001280000`, applied as drizzle `0010` on 8 Oct. All its columns are in `types.ts`.
- The flaw: one status covers the page (`DraftsPage.tsx:111-112`), so if either read fails, both panels say "That didn't load." The reproduction shows this both ways: the drafts loaded and the sessions read was refused, then the reverse (4.2).
- SQL rows D 4, D 5 and the `import_sessions` E rows check the live side.

### Cause 8 · The composer crashes on old drafts. **Ruled out (proved: `oldDrafts.audit.test.tsx`, 9 tests).**

- Every stored shape runs through every reader, through `PostThread`, and through the real editor (PostTab) without a throw, and the editor opens with the words.
  - The shapes: PT-06 pictures between lines, a row, sizes and captions; CA-06 references (the `postLinks` fixture); the CA-07 grid; a post of pictures only; five pictures in one post.
- The editor's schema lacks only `postMediaRow`, and `toGrids` removes it before the editor opens (`usePostEditor.ts:22`, `threadEditor.ts:56-70`).
- `checkThread` refuses only counts and lengths, never an old shape. A post with five pictures waits with a sentence ("at most 4") instead of failing.
- A draft saved before PT-01 opens through `legacyThread` from the post-media set.
- Miles's live drafts were all last saved by 10 Oct, before `post_doc` existed, so none of them can hold a PT-era document.
- A throw would show "Something went wrong." with Reload (`ErrorBoundary.tsx:20-27`), not the toasts Miles reports.

### Cause 9 · Types and narrow casts. **Confirmed as the reason nothing warned; not itself the failure.**

`node docs/audits/ca-08/scan-untyped.mjs` lists 49 `as unknown as` casts in the flows' files (output in 4.4).

The narrow casts in `drafts.ts:49`, `making.ts:192`, `sessions.ts:128` and `colourSwatches.ts:59`, and `Build = Tables<"builds"> & { post_doc }` (`src/lib/build/types.ts:28`), let code name columns the generated types do not have. TypeScript therefore cannot say "this column is not in the live schema".

Two differences between the code and the prompt:

- The comments saying `session_count` and `making` are "newer than the generated types" (`drafts.ts:6-7`, `making.ts:8-10`) are out of date. `types.ts` has had them since Lovable's 8 Oct regeneration (commit `9f83ebc7`).
- The only untyped columns left in these flows are `builds.post_doc` and `profiles.colour_swatches`.

### Cause 10 · Anything else. **Several, all in section 5.**

- **Likely, Needs the live check (rows B `like_count` and B `comment_count`).** The Gallery feed has also selected `like_count, comment_count` since PT-09 (16 Oct, `gallery.ts:1320, 1431`), and UI-P42's live check found neither column (`docs/proposals/UI-P42-sessions-and-making.md:131-134`). The Gallery may therefore fail even once `post_doc` exists.
- **Confirmed** design and coverage flaws:
  - the endless header save retry;
  - the double toast;
  - nothing logged on the Drafts page;
  - half-made writes;
  - a test suite that is red on `main` and runs in no CI;
  - no front-end monitoring.

---

## 4. Reproductions

All under `src/**/__audit__/`. No product code is mocked: `src/lib/build/__audit__/fakeSupabase.ts` gives the data layer supabase-js's own `createClient` (2.103) with only `fetch` replaced. That fake is a small PostgREST and GoTrue:

- **Status codes and bodies** are PostgREST's: 400 `42703`, 400 `PGRST204`, 403 or 401 `42501`, 404 `42883` or `PGRST202`, 406 `PGRST116`, 400 `23514`.
- **Its schema is data:** the live schema as `types.ts` lists it, or every migration applied.
- **RLS** follows the migrations' policies.
- **Faults** cover the failures the schema can't make by itself.

Every test passes, and so asserts what happens today. The two `it.fails` tests state what should happen and fail on purpose until it does.

### 4.1 `src/lib/build/__audit__/dataLayer.audit.test.ts`: the data calls (20 tests: 18 pass, 2 expected to fail)

| Test | What it shows |
|---|---|
| control: lists the fifteen drafts | with every migration applied, two GETs, 15 drafts, newest 10 Oct |
| control: makes a new session | the draft is made, then `sessions_meta` holds the key |
| live: the Drafts read fails with 42703 | `listDraftBuildsByCreator failed: column builds.post_doc does not exist`, `cause.code` 42703, one request, nothing else asked |
| live: the header count and Sessions still work | `countDraftBuilds()` reads 15 and `listSessions` 1: the badge is right while the page fails |
| live: a new post fails in `createBuild` | 42703, **no draft made** (the insert and its select are one statement) |
| live: an existing draft can't be written | GET `made_with, making` 200, then PATCH 400 |
| live: the Post tab's save | the picture set is written (RPC 200), then `post_doc` is refused (PGRST204): half written |
| `it.fails` ×2 | on the live schema, the Drafts read should list 15 and a new post should make a draft. Both fail today, on purpose |
| without `session_count` | the counts read fails: the page still errors |
| without `making` | the draft is made, the session is not: `setSessionMeta failed: column builds.making does not exist` |
| 42883 | a function a policy calls is missing: both paths fail, no draft |
| 42501 | a missing grant on the read, the insert policy refusing the write: both fail, no draft |
| 23514 | a check refuses the making write: **the draft is made, the session is not** |
| zero rows (PGRST116), forced | `updateBuild` is never a silent success |
| zero rows, as RLS does it | a draft that isn't yours: "That build is no longer available." |
| no session | the Drafts read returns `[]` without a request; the write refuses ("no signed-in user"); Sessions is refused for anon (42501) |
| network, on a write | not retried: `createBuild failed: TypeError: Failed to fetch` at once |
| network, on a read | postgrest-js retries a GET three times (1 s, 2 s, 4 s): four requests and about 7 s before the error |
| PGRST202 | `gallery_facets` and `set_build_post_media` missing from the schema cache: the messages name them |

### 4.2 The pages, mounted for real

**`src/pages/site/compose/__audit__/newSession.audit.test.tsx` (10 tests).** This mounts the real `SandboxPage` on `/compose/new`, in App's route shape, with the real `AuthProvider`, App's QueryClient defaults and sonner's real `<Toaster>`, then presses Add › New session › Add.

| Failure the fake returns | What the maker sees | Where the cause is kept |
|---|---|---|
| none (control) | no toast; the address becomes `/compose/{id}`; the session is saved | — |
| 42703, no `post_doc` (the live schema) | **two toasts: "Couldn't make that session. Try again." in front, "Couldn't start your draft. Try again." behind**; no draft | console only: `[Compose] createBuild failed` and `[Sandbox] session not made`, each with `createBuild failed: column builds.post_doc does not exist`, code 42703 in `cause.code` |
| 42883 | the same two toasts; no draft | console, as above, `function public.is_admin(uuid) does not exist` |
| 42501, insert refused | the same two toasts; no draft | console: `new row violates row-level security policy for table "builds"` |
| no session | the same two toasts; no draft | console: `createBuild failed: no signed-in user` |
| network | the same two toasts; no draft | console: `createBuild failed: TypeError: Failed to fetch` |
| 23514 on the making write | **one toast** ("Couldn't make that session. Try again."); **an empty draft is left behind**; the address has moved | console: `[Sandbox] session not made`, 23514 |
| zero rows updated (PGRST116) | one toast; an empty draft left behind | console: PGRST116 |
| the re-read fails after a good write | no toast; the session is saved but not drawn; the page then says "This build didn't load." | nowhere (`refreshRecord` swallows it) |
| an existing draft whose UPDATE is refused, after one title edit | only the status line: "not saved · Try again"; the PATCH is sent again every 800 ms, at least 3 times in a few seconds, and keeps going | nowhere: no toast, no console line |

**`src/pages/site/drafts/__audit__/DraftsPage.audit.test.tsx` (8 tests).** This mounts the real `DraftsPage` with App's QueryClient defaults.

| Failure | What the maker sees | Where the cause is kept |
|---|---|---|
| none (control) | 15 drafts | — |
| 42703, no `post_doc` | **"That didn't load." in both panels**, two Try again buttons, although the Sessions read worked | **nowhere in the console**: only the Network tab (two 400 42703 requests, App's one retry) |
| no `session_count` | the same | the same |
| 42883 | the same | the same |
| only Sessions refused | the same: the drafts that loaded are hidden | the same |
| no session | the same ("That didn't load."); the drafts read sends nothing, Sessions is refused for anon and not retried | the same |
| drafts RLS won't show | **"Nothing in progress."**, said as if there were none | nowhere |
| network | grey bars for about 15 s (4 postgrest-js attempts × 2 TanStack attempts = 8 requests), then "That didn't load." | nowhere |

### 4.3 The live checks, run against a local Postgres 16 stand-in

`live-checks.sql` was run with `psql` against Postgres 16.15 started in this container. The stand-in was built like this:

- Supabase-like roles, `auth.uid()`, a stub `storage` schema, and both migration-record tables.
- The repository's own migrations replayed in order up to 13 Oct. Left out: the files UI-P42's live check and `HANDOVER.md` say were never applied (`bounty_system`, `gamification_schema`, `rc_build_social`, `rc_reports`, `rc_build_notifications`, `rc_badge_catalogue`), the data-only RC files, and `rls_initplan`.

The replay's `builds` has exactly the 42 columns `types.ts` lists.

| World | Rows | `false` rows | Section A |
|---|---|---|---|
| live-like (as of 13 Oct) | 384 | 16 | A 1 `post_doc` **MISSING**, A 2 cap **4**, A 3 TF-07 not applied, A 4 `colour_swatches` **MISSING**, A 5 "41 present; missing: post_doc"; A 6 to A 9 true |
| plus `post_threads`, `tf07`, `ca06` | 384 | 5 | A 1 to A 9 all true. The 5 left are the RC and gamification objects UI-P42 found missing (the `rc_reports` restrictive policy, two badge triggers, the notify trigger, the progress trigger), each marked "if absent, these flows lose nothing" |
| plus `rls_initplan` | 384 | 5 | every policy still matches after the wrapping |
| broken on purpose | 386 | 12 | the broken update policy, a stray restrictive policy, a stray check, a disabled trigger and a deleted node type are each caught; A 9 reads "1 policies, 1 checks, 0 triggers, 1 disabled", false |

The file was also checked by reading and by a scan: one `WITH … SELECT` statement, no line that starts a write. It reads `supabase_migrations` and `drizzle` through `query_to_xml()`, only when the table exists and can be read, so it runs either way. The stand-in is a stand-in: the live database was not reached (section 7).

The stand-in itself shows one small drift: live `build_media` has `caption`, `filename` and `metadata` (in `types.ts`), and no migration creates them.

### 4.4 `docs/audits/ca-08/scan-untyped.mjs`

`node docs/audits/ca-08/scan-untyped.mjs` (read-only) printed, on 6a5cd7f:

- **Untyped columns:** only `builds.post_doc` (BUILD_COLUMNS, GALLERY_BUILD_COLUMNS, `saveThread`) and `profiles.colour_swatches` (`getColourSwatches`, `saveColourSwatches`). Every other select and write key in the flows is in `types.ts`.
- **Casts:** 49 `as unknown as`, listed by file and line: `builds.ts` 7, `drafts.ts` 1, `making.ts` 5, `sessions.ts` 1, `cover.ts` 1, `thread.ts` 3, `graph.ts` 7, `composePrompts.ts` 3, `setup.ts` 1, `gallery.ts` 16, `imports.ts` 2, `colourSwatches.ts` 1, among the 27 files scanned.

### 4.5 The repository's own checks

Run on this branch, with the audit files added:

| Command | Result |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | exit 0, no errors |
| `npm run lint` | exit 1: 2,249 problems (1,959 errors, 290 warnings), every one in a file this audit did not touch. `npx eslint` on the audit's own files reports none |
| `npm run build` | exit 0 (`✓ built in 9.90s`) |
| `npm test` | exit 1: 9 files and 55 tests failed, 5,439 passed, 2 expected to fail (5,496 tests in 329 files). The 55 are exactly the ones already failing on `main`, listed below. Every audit test passes, and the 2 `it.fails` fail as expected |

`npm test` was **already red on `main` (6a5cd7f) before this audit added anything**: 9 files, 55 tests failed out of 5,442.

- **Where:**
  - `AppShell.test.tsx` 31;
  - `BuildPage.test.tsx` 11;
  - `noRail.test.tsx` 7 ("No QueryClient set");
  - `motion.test.ts` 3;
  - `rcStates.test.ts`, `ns-classes.test.ts` and `retiredSurfaces.test.tsx` 1 each;
  - `siteFrame.test.tsx`, where one block has no tests left ("No test found in suite");
  - `flat-shell.wide.test.ts`, which fails to load (`ENOENT … flat-shell.css`).
- **Why:** these tests still expect what the UI overhaul removed or changed. They read files that are gone (`flat-shell.css`, `FrameRoute`, `MobileBottomNav`), look for the old frame's nav and the old build page (`data-testid="build-viewer"`), or mount the frame without a provider it now needs ("No QueryClient set").

None of them is in the two flows, and the audit did not touch them. There is no `.github/workflows`, so nothing runs the suite on a merge.

---

## 5. Findings, most serious first

### F1 · Every builds read and write names a column the live database most likely doesn't have. Critical.

- **What is wrong.**
  - PT-01 (#334, 16 Oct) added `post_doc` to BUILD_COLUMNS and to the Gallery's column list. Its migration was most likely never applied live.
  - If it wasn't, every request that names the column fails with 42703 (or PGRST204 on a write), and nothing is written.
  - That covers the Drafts page, opening a draft, starting a post (every add), sessions into drafts, the build page (`getBuildBySlug`, `builds.ts:174-191`), the profile's build list (`listBuildsByCreator`) and the Gallery.
- **Where.**
  - `src/lib/build/builds.ts:28-29` (used at `:116, :127, :147, :177, :212, :229, :251`).
  - `src/lib/build/gallery.ts:305-306`.
  - `src/lib/build/thread.ts:772`.
  - Migration `supabase/migrations/20261016120000_post_threads.sql:22-23`.
- **Evidence.** Cause 1: the code, `types.ts`, the drizzle journal, the deploy queue, the live listing, and the reproductions (4.1, 4.2).
- **Who it affects.** Every signed-in maker, and every visitor to the Gallery or a build page.
- **The fix, in words.**
  - Apply `20261016120000_post_threads.sql` to the live database through Lovable. It is written to run twice safely: `ADD COLUMN IF NOT EXISTS`, constraints looked up by name.
  - Then the two later migrations. Then have Lovable regenerate `types.ts`.
  - If PostgREST still answers PGRST204, reload its schema cache.
  - In the code: don't add a column to a shared column list until it is live. The Gallery dashboard already works to that rule (`gallery.ts:1525-1534`).

### F2 · No step makes sure a migration reaches the live database. Critical (process).

- **What is wrong.** Migrations are applied by hand (the deploy queue, "by Lovable message"). The last queue entry is item 18 (UI-P61, `sandbox_node_types`). PT-01, TF-07 and CA-06 each merged a migration with no queue entry, no apply step and no check.
- **Where.** `docs/reconciliation/HANDOVER.md:5-23`; `drizzle/migrations/meta/_journal.json` (ends 13 Oct).
- **Evidence.** Cause 1.
- **Who it affects.** Every feature that adds a column.
- **The fix, in words.**
  - One queue entry per migration, written by the session that writes it.
  - "Applied" means Lovable has run it and regenerated `types.ts`.
  - A guard test that fails when a column list in `src/lib/build` names a column `types.ts` lacks (`scan-untyped.mjs` is a starting point).

### F3 · The Gallery feed most likely fails for a second reason too. High. Needs the live check.

- **What is wrong.** Since PT-09 (#339, 16 Oct) the feed selects `like_count, comment_count`. UI-P42's live check found neither column, and `rc_build_social` was never applied. The dashboard leaves them out for exactly this reason (`gallery.ts:1525-1534`).
- **Where.** `src/lib/build/gallery.ts:1320, 1431`.
- **Evidence.**
  - `docs/proposals/UI-P42-sessions-and-making.md:131-134`.
  - `types.ts` lacks both columns.
  - SQL rows B `builds.like_count` and B `builds.comment_count`.
- **Who it affects.** Every visitor to `/gallery`.
- **The fix, in words.** Either apply `20261001180000_rc_build_social.sql` (deploy queue item 9, with its RLS proof), or stop selecting the two columns until they are live.

### F4 · A failure leaves no trace a developer can find. High.

- **What is wrong.**
  - **The Drafts page writes nothing to the console when a read fails.** `ErrorState` logs only when it is given an `error` (`ErrorState.tsx:60-67`), and `DraftsView` never passes one (`:590, :616`). TanStack Query v5 logs nothing either.
  - **The composer's "didn't load"** has the same gap (`SandboxView.tsx:497`).
  - **A failed header save is never logged** (`useComposeBuild.ts:185-190`).
  - **The lines that are logged keep the SQLSTATE only inside `cause.code`**, not in the line itself.
  - **There is no front-end error monitoring.** `package.json` has no Sentry or similar. The connector's edge function reports to Sentry only when its `SENTRY_DSN` secret is set (`supabase/functions/mcp/monitor.ts:28-35`), and only for the connector.
- **Evidence.** 4.2 (`appLines` empty on every Drafts failure).
- **Who it affects.** Miles, and whoever fixes the next failure.
- **The fix, in words.**
  - Pass `query.error` to `ErrorState` on the Drafts page and in the composer.
  - Log `{ code, message, details, hint }` in one line in every `catch` listed in F6.
  - Install Sentry as the `neoscale-error-monitoring` skill describes, with its privacy rules: never prompt text, codes only.

### F5 · A save the database refuses is retried every 800 ms, forever. High.

- **What is wrong.** On failure, `flush` puts the patch back (`useComposeBuild.ts:189`) and `finally` schedules another flush (`:195`). A permanent refusal (42703, 23514, 42501, PGRST204, PGRST116) therefore sends a PATCH every ~0.8 s for as long as the composer is open, and logs nothing.
- **Where.** `src/hooks/useComposeBuild.ts:185-197`.
- **Evidence.** 4.2, last row (at least 3 PATCHes in a few seconds, still going).
- **Who it affects.** Any maker whose draft loads but can't be written. In Miles's current state no draft loads, so it doesn't fire yet.
- **The fix, in words.** Retry only what can succeed later (network, 5xx, 520/503), a few times with backoff. Stop on a permanent code and say so.

### F6 · Error messages replace the cause with a fixed sentence, and one failure can show two toasts. Medium.

- **The double toast.** `ensureBuild` toasts, then rethrows (`ComposePage.tsx:124-129`). Every caller then toasts its own sentence too: `SandboxPage.tsx:441, 461, 490, 516, 539, 557, 797, 833, 870, 1017`, the `useComposePrompts.ts` lines through `failed()` (`:115-118`), and `useComposeDetails.ts:28-31`.
  - The second toast lands in front. Sonner's default stack is collapsed, newest in front, at the bottom right, and the "Edit with Lovable" badge covers that corner.
  - So Miles reads the add's sentence, here "Couldn't make that session", while the cause sits behind it in "Couldn't start your draft". Reproduced (4.2).
- **Catches that log the cause but show a fixed sentence:**
  - `ComposePage.tsx:124-129, 208-211, 222-225, 290-293`;
  - `SandboxPage.tsx:439-442` and the others listed above;
  - `useComposePrompts.ts:115-118`; `useComposeSessions.ts:184-188, 196-199, 248-252, 266-270`;
  - `useComposeThread.ts:180-183`; `pictures.ts:422, 436`;
  - `DraftsPage.tsx:72-76, 87-91, 102-106`.
- **Catches that swallow the cause entirely:**
  - `useComposeBuild.ts:185-190`; `refreshRecord` (`SandboxPage.tsx:402`);
  - `useColourSwatches.ts:62, 74`; `countDraftBuilds`'s badge (`SiteHeader.tsx:405`);
  - `getGalleryFacets` (`ComposePage.tsx:309-315`); `claimForBuild` (`useComposeSessions.ts:233`).
- **The fix, in words.**
  - One helper for writes, used by every catch above: log the code with the scope, show one toast per failure, and let the caller skip its own toast when `ensureBuild` already showed one.
  - Keep the SQLSTATE in the log for every write.
  - Tell the user more only where they can act on it: "You are signed out" for 401/PGRST301, "Your connection dropped" for a fetch failure. Show the code in small print, "Code 42703", so it can be quoted.
  - Hide the badge, or move the toaster to the top (F12).

### F7 · Writes in several steps, with no undo, leave half-made builds. Medium.

1. **A new post makes a draft before its first step** (`ComposePage.tsx:108-132`). If the step then fails, an empty "Untitled build" is left behind: reproduced for 23514 and PGRST116 (4.2). Miles's live list already holds six "Untitled build" drafts with 0 parts, from 25 Aug to 5 Oct.
2. **`saveThread` writes the picture set and cover first, then `post_doc`** (`thread.ts:765-773`). A refused `post_doc` leaves the set changed and the words not saved (reproduced, 4.1).
3. **"At the same time as" writes one session after another** (`SandboxPage.tsx:531-535`). A failure part-way leaves pairs one-sided.
4. **`claimSession` writes `sessions_meta`, then moves steps one by one** (`useComposePrompts.ts:766-782`).
5. **`addTeam` writes the team, then its agent** (`graph.ts:1039-1049`). `addAgentOrTeam` may first make tool nodes (`useComposePrompts.ts:645`), and `addCodeSteps` loops (`:738-742`).
6. **`addOneFile` uploads and inserts `build_media`, then the node** (`SandboxPage.tsx:860-865`). A failed node leaves a media row nobody sees; `media.ts:291-299` tidies only the object, on an insert failure.
7. **`attachSession` (new) makes a draft, then marks the session claimed** (`imports.ts:424-445`). A failed mark leaves an empty draft (the code says so, `sessions.ts:256-260`).
8. **A failed re-read after a good write leaves a session saved but not drawn** (cause 5).

**The fix, in words.** Make each of these one database call (an RPC that writes the build and its first step, the set and the document, or all the pairs), or undo the earlier steps on failure. Above all, never leave an empty draft for a first write that failed.

### F8 · One failed read blanks the whole Drafts page. Medium.

- **What is wrong.** `status` is one value for both lists (`DraftsPage.tsx:111-112`), so a failed Sessions read hides drafts that loaded, and the reverse.
- **Evidence.** 4.2.
- **Who it affects.** Makers on the Drafts page.
- **The fix, in words.** Give each panel its own status; `DraftsView` already draws each panel's state separately.

### F9 · The tests could not have caught this, and nothing runs them. Medium.

- **No test sends a real-shaped Supabase error through these flows.**
  - `drafts.test.ts` replaces `listDraftBuildsByCreator` entirely.
  - `making.test.ts` replaces `./builds` (line 19), so `setSessionMeta` never meets `updateBuild`'s column list.
  - 93 test files stub the client by hand.
- **No test mounts `SandboxPage`, `ComposeRoute` or `DraftsPage`.** Only the views are mounted.
- **No test compares a column list with `types.ts`.**
- **The suite has been red on `main`** (55 tests, 4.5), and there is no CI workflow.
- **The fix, in words.**
  - Keep the audit's fake (`fakeSupabase.ts`) as a fixture and give each flow a test against the live-schema world.
  - Add the column-list guard (F2).
  - Fix the 55 tests.
  - Run tsc, lint, test and build on every pull request.

### F10 · A lost network keeps the Drafts page on grey bars for about 15 s. Low.

postgrest-js retries a GET three times (1 s, 2 s, 4 s; `node_modules/@supabase/postgrest-js/dist/index.cjs:7-29, 255-292`) under TanStack's own retry (`App.tsx:178-182`). That makes 8 requests, reproduced (4.2). The fix: turn off one of the two retry layers for page reads.

### F11 · Smaller issues found on the way. Low.

- `todayDay()` names the UTC day, so in BST a session made just after midnight is dated yesterday (`making.ts:148`; 4.1).
- `setSessionMeta` rewrites `sessions_meta` through a reader that drops any entry it can't read (`making.ts:444, 153-175`; tested in `sessionMeta.audit.test.ts`).
- `saveColourSwatches` is a PATCH with no select, so an RLS refusal is a silent success (`colourSwatches.ts:82`).
- `getMediaById` selects `MEDIA_COLUMNS`, which has no `filename` (`media.ts:26-27, 342-351`), but Details reads `row.filename` (`SandboxPage.tsx:591`), so a file's name never shows.
- Live `build_media` has `caption`, `filename` and `metadata` with no migration creating them (4.3).
- Stale comments: `session_count` and `making` "newer than the generated types" (`drafts.ts:6-7`, `making.ts:8-10`). And `20261020120000_ca06_colour_swatches.sql:12-14` names the profiles policy "Users can update own profile"; the migrations call it "Users can update their own profile" (`20260316202122:23`).

### F12 · The "Edit with Lovable" badge covers the toasts. Low.

- **What is wrong.** The badge is not part of this repository. `index.html` and `src/` have no badge code, and `lovable-tagger` runs only in development builds (`vite.config.ts:15`). Lovable's hosting adds it on the published site, in the corner where sonner draws toasts (`src/components/ui/sonner.tsx`; App mounts it at `App.tsx:203`).
- **The fix, in words.** Turn the badge off in the Lovable project's settings: Lovable documents a project setting to hide it, which may need a paid plan. Or give the toaster a `position` away from that corner.

### Where this prompt and the code differ

- **The branch.** The prompt names `ca-08-audit-drafts-sessions`; this session was required to work on `claude/ca-08-audit-drafts-sessions-w6mafi`, and did.
- **"Miles reports only the session toast. So check first whether the build is made."** In the code, a failed `createBuild` shows both toasts with the session one in front (F6). The live listing shows the build was not made.
- **`session_count` "newer than the generated types".** Not any more: `types.ts` has it (cause 9).
- **The repo map skill** says the newest migration is `20260917120000`; there are 151, the newest `20261020120000`. It says `types.ts` lacks `builds.rebuild_count`; it now has it.
- **"setSessionMeta … then calls addMadeWithTools".** True, and that call is caught (`making.ts:451`), so it cannot raise the toast.
- **CA-06's migration names the profiles policy** "Users can update own profile"; the migrations' name is "Users can update their own profile" (F11).

---

## 6. Fix order

1. Miles runs `docs/audits/ca-08/live-checks.sql` and `docs/audits/ca-08/browser-steps.md`, and pastes the results with keys and email removed.
2. If row A 1 reads MISSING, apply through Lovable, in this order: `20261016120000_post_threads.sql`, `20261017110000_tf07_document_fields.sql`, `20261020120000_ca06_colour_swatches.sql`. Each is safe to run twice. Lovable regenerates `types.ts`. If writes answer PGRST204, reload the PostgREST schema cache.
3. Run `live-checks.sql` again: A 1 to A 9 must all read true. Then, on the live site: the Drafts page lists 15 drafts, a new post saves, Add › New session works, and an existing draft opens and saves.
4. Decide the Gallery's `like_count, comment_count` (F3): apply `20261001180000_rc_build_social.sql` with its RLS proof, or take the two columns out of `gallery.ts:1320, 1431`.
5. One code PR for the failures:
   - pass the error to `ErrorState` (Drafts, composer);
   - stop `useComposeBuild` retrying permanent errors, and log the code;
   - one toast per failure, with the code in the log;
   - give each Drafts panel its own status.
6. One code PR for the half-made writes (F7), starting with the empty draft left by a failed first write.
7. Guards: a test that every column list in `src/lib/build` is in `types.ts`; flow tests on the audit's fake against the live-schema world; fix the 55 red tests; a CI workflow that runs tsc, lint, test and build.
8. Monitoring: Sentry for the front end, per the `neoscale-error-monitoring` skill.
9. Process: a deploy queue entry for every migration, closed only when `types.ts` is regenerated with it.
10. Hide the "Edit with Lovable" badge, or move the toaster.

---

## 7. What this audit could not see

- **The live database.** The container's network allowlist blocks `*.supabase.co`, so nothing in it was read directly. That `post_doc` is missing live is inferred, strongly, from the repository, Lovable's own records and the reproductions. It is not seen. That is what `live-checks.sql` row A 1 is for.
- **SQL run by hand.** Anything pasted into Lovable's SQL editor leaves no trace in the repository. Lovable's own record (drizzle) is known to be incomplete: drizzle `0006` applied 16 files at once.
- **Miles's console and network output** from his attempts. The exact message is inferred from the code and reproduced, not read from his browser. Browser steps 5 and 9 collect it.
- **Which commit the published site runs.** It must include #357, because the session toast only exists from there (merged 20 Oct 10:35 UTC). Whether it is `6a5cd7f` or a later publish is not visible from here, and nor is whether Lovable publishes on every merge.
- **The one live read that was made.** The connector's draft listing (`buildgallery_list_drafts`) runs server-side with its own column list, without `post_doc`. It shows the drafts exist and are readable as Miles. It cannot show what the site's queries get. Its titles are not copied here; the report only counts the drafts that still have the default title "Untitled build" (F7).
- **The order of the prompt's listing and Miles's attempts.** Not known. This audit's own listing came after #357 shipped the session toast, so it covers any attempt that produced that toast before it.
- **PostgREST's exact wording on the live version.** The fake follows PostgREST 12's bodies. The codes (42703, PGRST204, …) are what the browser steps match on, not the wording.
- **Storage and its policies** (`build-media`, `imports`). Uploads go to storage by XHR, outside the fake. The storage policies were read in the migrations, not exercised.
- **Lovable project settings:** the badge, publishing, secrets such as `SENTRY_DSN` on the edge function.
- **Other accounts.** Row I 3 of the SQL (the newest write to any draft) will show whether anyone has saved since 16 Oct. The audit did not look at anyone's data.
