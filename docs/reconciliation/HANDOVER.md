# The reconciliation series — handover diary

Contract: docs/reconciliation/CONTRACT.md. Read it, then the newest entry below.

## Deploy queue
1. Owed, needs direct access to the live project (RC-P03): delete the deployed edge functions seed-demo-data, seed-ecosystem, seed-new-posts and update-seed-data, then check that seed-demo-data answers 404 to an OPTIONS request (never GET or POST).
2. Apply supabase/migrations/20261001123000_rc_rotate_demo_passwords.sql (RC-P03), then check that no demo account holds a session.
3. Apply supabase/migrations/20261001120000_rc_backup_legacy.sql (RC-P02), then check that rc_backup._manifest lists public.content_items with 87 rows, the Q1 post count. If it holds a different number, the live data has moved since RC-P01: run Q1 and Q7 of docs/reconciliation/rc-recon.sql again before item 4.
4. Apply supabase/migrations/20261001130000_rc_clear_legacy_posts.sql (RC-P04), only once the backup is confirmed and the seed functions are gone. Rehearse it first in the same session with `set rc.dry_run = 'on';`, which ends in "RC-P04 DRY RUN OK: …" and changes nothing. A real error starts "RC-P04:" and is never retried, edited or worked around. Afterwards content_items is 0 and the Q7 counts are unchanged: profiles 24, builds 9, build_nodes 13, dm_messages 3, dm_threads 1, follows 80.
5. 20261001140000_rc_search_builds.sql (RC-P07), by Lovable message L-P07-1. Its SQL was written in the RC-P07 session from the prompt's own specification, because the prompt's SQL block arrived as an unfilled placeholder; read it before sending L-P07-1. Rehearsed on a local Postgres 16 stand-in: applies twice cleanly, and `select count(*) from public.search_build_ids('ab');` runs.
6. 20261001150000_rc_build_feed_following.sql (RC-P11; the prompt said "5.", the queue already held five). WRITTEN FROM THE REPOSITORY'S DEFINITION, because L-P11-0's live output was not supplied: its body is 20260829220000_build_feed_bounty_items.sql's byte for byte, plus the following scope. Section 0 refuses to run ("RC-P11: …", nothing changed) unless the live function is that definition exactly: body md5 79ba5af25f4f4d1b6221f506652fa940, sql, STABLE, SECURITY INVOKER, search_path '', one overload. If it refuses, send L-P11-0 and regenerate the file from the live text; never edit the guard to get past it. Send it with the RC-P11 frontend, which calls only_following. Rehearsed on a local Postgres 16 stand-in: output identical for existing calls, the scope keeps only followed actors, a second run and a drifted body are both refused.
7. 20261001160000_rc_top_solvers.sql (RC-P13; the prompt said "6.", the queue already held six), by Lovable message L-P13-1: one read-only function, top_solvers (SECURITY INVOKER, STABLE), and one partial index, idx_solutions_accepted_solver. Send it with the RC-P13 frontend, which calls it. Rehearsed on a local Postgres 16 stand-in with the live solutions and bounties read policies: applies twice cleanly; signed out and signed in it counts only accepted solutions on bounties whose build is not a draft (submitted, withdrawn, legacy and draft-build rows never count), most solved first, then reward total, then latest; max_results is held to 1–100; EXECUTE is granted to anon and authenticated and not to PUBLIC.
8. 20261001170000_rc_rebuild_tree.sql (RC-P14; the prompt said "7.", the queue already held seven): one read-only function, rebuild_tree (SECURITY INVOKER, STABLE), and the parent_build_id index, created as idx_builds_parent only where no index on builds already leads with parent_build_id (NS-P36 created that exact index as idx_builds_parent_build in 20260827140000; a second copy would only slow writes). Send it with the RC-P14 frontend, which calls it. Rehearsed on a local Postgres 16 stand-in with the builds read policy: applies twice cleanly; the family is the root plus published and gallery rebuilds below it, oldest first within a generation, the walk stops at a draft and 20 levels down, a parent cycle ends; a draft root is empty to anon and whole to its creator; max_nodes is held to 1–200; EXECUTE to anon and authenticated, not PUBLIC; with idx_builds_parent_build present no index is added, without it idx_builds_parent is.
9. 20261001180000_rc_build_social.sql (RC-P15; the prompt said "8.", the queue already held eight), by Lovable message L-P15-1, then L-P15-2 (RLS proof): build_likes, build_saves and build_comments with RLS, builds.like_count, comment_count and save_count kept by triggers, and collection_items.build_id with the item_kind check replaced. Rehearsed on a local Postgres 16 stand-in with Supabase's roles and default privileges and the live builds, build_nodes and collection_items definitions: applies twice cleanly; L-P15-2 returns saves_seen_by_other_user 0, hidden_comment_seen_by_other_user 0, then "permission denied for table build_saves"; with no item_kind check present the migration stops with "RC-P15: no check constraint on collection_items.item_kind was found; nothing was changed. Constraints on collection_items: …", which is the list L-P15-1 asks for. L-P15-2 takes the second-oldest account as the other reader: if that account is an admin, hidden_comment_seen_by_other_user reads 1, because admins read hidden comments by design (L-P17b-2 excludes admins for this reason). One addition beyond the prompt: a second foreign key on build_comments.author_id, to profiles(id), so a page of comments embeds its authors (RC-P17's two-request budget).
10. 20261001190000_rc_reports.sql (RC-P17b; the prompt said "9.", the queue already held nine), by Lovable message L-P17b-1, then L-P17b-2 (RLS proof): builds.is_hidden under a NEW restrictive read policy (no existing builds policy touched), content_reports with RLS (reporter and admins read; authenticated keeps SELECT and INSERT only, anon nothing), and resolve_report (SECURITY DEFINER, "not allowed" for anyone but an admin, before it reads anything). Apply after item 9: hiding a comment writes build_comments. Rehearsed on the local Postgres 16 stand-in on top of item 9: applies twice cleanly; a reader files only as themselves, once per target, reads back only their own, cannot update, and gets "not allowed" from resolve_report; an admin's hide closes every open report on the target, hides a comment and drops the build's comment_count; anon and other readers no longer read a hidden build, its creator still does. L-P17b-2 AS WRITTEN STOPS AT "permission denied for table _p": its count runs after `set local role authenticated`, and a temp table is readable only by its owner. Add `grant select on _p to authenticated;` right after the create temp table line; with it the proof returns reports_seen_by_other_user 0, hidden_build_seen_by_other_user 0, then an error containing "not allowed" (rehearsed). It reads 1 hidden build if the second non-admin account created the build it picks.
11. 20261001200000_rc_build_notifications.sql (RC-P19; the prompt said "10.", the queue already held ten), by Lovable message L-P19-1: notifications written by database triggers only, through one writer, rc_notify (SECURITY DEFINER, executable by nobody but its owner; never the actor, never twice in ten minutes), for nine kinds: rebuilt, published (to at most 500 followers), reproduced, comment, reply, like, solution, solved, follow. It also widens notifications' target_type check (found in the catalogue; it stops, naming them, if a live row holds a value the new list would refuse) and adds notifications.build_id. Apply after item 9: its triggers sit on build_likes and build_comments. Rehearsed on the local Postgres 16 stand-in with the live notifications policies: applies twice cleanly; as authenticated under RLS each of the nine kinds is written once with its fixed message; like, unlike and like again is one row; nobody is told of their own act; a build that is already visible tells nobody when its status changes again; rc_notify refuses authenticated; a target_type of 'build' is accepted and 'nonsense' refused; publishing to 501 followers tells 500; a live row holding 'post' stops the migration with that value named and nothing changed.

## Deferred to after the merge
- FlatShell rightRail and forceRightRail, .fs-right CSS, AppShell's /upload/blueprint branch: removed in RC-P08b (RC-P06)
- UploadPickerContext, UploadTypePicker, UploadPickerProvider, still imported by src/pages/UploadTypeSelector.tsx and src/lib/bounty-legacy/legacyBountyCreateRetired.test.tsx; deleted in RC-P08b (RC-P08)
- sitemap-xml, public-api and post-json read content_items: repointed in RC-P30 (RC-P16b)

## Critique findings deferred
From RC-P09c, docs/reconciliation/critique/phase-2.md. Two majors fall outside step 5's limits, each with its reason:
- M4 · /, /bounties, /library, /notifications ↔ /gallery (every standard ↔ wide move) · critique-composition › Gestalt (continuity); hicks-law › Choice Audit (desktop nav) · the nav moves between layout modes: x 283 on standard routes, 24 on the Gallery at 1440 (259px sideways, 24 down); 51 at 1024, 179 at 1280, 339 at 1920. REASON: one nav edge needs structural CSS on .fs-frame and .fs-wide .fs-frame (flat-shell.css:68, :670), which CONTRACT §2.2 forbids short of an owner decision like §3.1. Options: (a) standard routes take the wide frame's 24px inset; (b) wide routes keep the standard nav position, about 260px less grid at 1440; (c) keep the jump. The owner decides.
- M5 · /gallery, reached from the nav's search and the phone's magnifier · critique-affordance › Action Discoverability; hicks-law › Choice Audit (search field) · the Gallery ignores q and focus=search: the desktop shows the whole gallery under a field still holding the query; the phone's "Search builds" opens a page with no field. REASON: the fix is Gallery.tsx, outside the files RC-P05 to RC-P08 changed; it is RC-P10's first step (RC-P07, Open).
Minor findings and LOW rows (route · skill · finding):
- m1 · /bounties (phone; desktop signed out) · critique-visual-hierarchy › Emphasis · the empty state's filled "Browse the gallery" sits beside another primary (the bar's New build; the rail's Join free); STATES.md row 19 makes it secondary then (Bounties.tsx:47)
- m2 · / (phone) · critique-visual-hierarchy › Emphasis · two filled controls open the composer: the compose strip's New and the bar's New build (FeedShell.tsx)
- m3 · every route (phone) · hicks-law › Common Failure Patterns · the top bar's avatar opens the drawer the bar's Profile already opens (MobileTopBar.tsx:120; the v0 brief keeps it)
- m4 · every route (phone drawer) · buildgallery-theme › Part-category hues · Sign out is painted --cat-breakage, which STATES.md row 16 forbids (ProfileDrawer.tsx:219)
- m5 · /notifications (phone) · hicks-law › Familiarity · the top bar says "Alerts" where the nav and drawer say "Notifications" (MobileTopBar.tsx:82)
- m6 · /upload (phone) · CONTRACT §13 · the top bar's title is "Upload" (MobileTopBar.tsx:84; the route retires in RC-P08b)
- m7 · every route (desktop) · better-layout › Group with space (LOW) · 8px under the search field against 4px between rows and 21px between groups, so it reads as Browse's first row (FlatShell.tsx:189)
- m8 · every route (desktop, Dusk) · buildgallery-theme › Tokens · the native search-clear × draws in the browser's blue while a query is typed (NavSearch.tsx, type="search")
- m9 · / · critique-visual-hierarchy › Entry Point · Home opens on For You, empty for a reader who follows nobody, beside a populated Builds tab; six tabs where CONTRACT §14 sets two (Home.tsx:500; FeedShell.tsx)
- m10 · / · critique-affordance › CTA Clarity · the empty For You and Following tabs offer "Open Discover", a retired destination (FeedShell.tsx:202, :207)
- m11 · / · critique-composition › Whitespace · 382px of empty column at 1440 between the competitions card and the empty state (FeedShell.tsx)
- m12 · / · buildgallery-theme › Part-category hues · the legacy competitions card's "Reward" chip is breakage red (FeedShell.tsx)
- m13 · /library · CONTRACT §13; STATES.md row 19 · the empty state names blueprints, stages and blocks, at 13px, with no action (LibraryShell.tsx)
- m14 · /notifications, /library (phone) · better-layout › Order by importance (LOW) · an 84px empty band between the top bar and the tabs (ShellHeader.tsx; LibraryShell.tsx)
- m15 · /notifications, /library (desktop) · critique-visual-hierarchy › Entry Point · a filled --recess "Back" is the first element on pages reached from the nav (ShellHeader.tsx; LibraryShell.tsx)
- m16 · /notifications · critique-visual-hierarchy › Weight · rows at 13px/500 over 12px/400 with 11px dates: flat, and under the 16px body size (Notifications.tsx)
- m17 · /notifications · critique-affordance › Clickability Signals; buildgallery-theme › Radius · "View" is an 11px label on a 45×27 square-cornered button and says nothing the row does not (Notifications.tsx)
- m18 · /gallery · hicks-law › Budgets · Made for shows 9 options and Made with 8, over "≤ 6 visible, then More" (FacetRail.tsx; RC-P10's gallery work)
- m19 · /gallery · critique-composition › Rhythm · a row's cards end at different heights, 824, 851 and 828 at 1440 (the gallery grid)
- m20 · /bounties, /library · critique-composition › Balance · the frame's two empty states sit differently: Bounties' at the top of the column (y 118), Library's centred (y 499) (Bounties.tsx)
- m21 · / (390) · better-layout › Hint at hidden content (LOW) · the tab row clips "Trending"; Recent and Bounties scroll into reach with the clip as the only cue (FeedShell.tsx)
- m22 · every route (desktop) · better-layout › Plan for growth (LOW) · nav rows are a fixed 40px with one-line labels (flat-shell.css:331); not verified with pseudo-localisation
- m23 · every route (desktop) · better-layout › Logical properties (LOW) · the active edge is an inset shadow on the physical left (flat-shell.css:365); no RTL build to verify
- m24 · every route (phone drawer) · critique-affordance › Clickability Signals · Close is 36×36 and View profile 35px tall, under the 44px minimum (ProfileDrawer.tsx)
- m25 · every route (phone) · better-layout › Order by importance (LOW) · MobileTopBar and MobileBottomNav mount after <main>, so the top bar comes after the page for a screen reader and for Tab (AppShell.tsx:294, :309)

From RC-P14c, docs/reconciliation/critique/phase-3.md. No major is deferred: M1 (where-next cards had no pictures) and M2 (the lineage page could not open its own build) were fixed in CRITIQUE-5 and CRITIQUE-6. The IDs below are phase 3's own. Minor findings and LOW rows (route · skill · finding):
- m1 · /gallery (desktop) · hicks-law › Common Failure Patterns · two identical "Search builds" fields, the nav's and the page's, both holding the query; the page's exists for the phone, where the nav has none (Gallery.tsx:382; NavSearch.tsx)
- m2 · /gallery (390) · better-layout › Order by importance (MEDIUM); critique-information-density › Content Priority · about 640px of header before the first card, and the five-line description restates the order line (Gallery.tsx:376)
- m3 · /gallery (390) · better-layout › Hold structure until it breaks (LOW) · the four lenses wrap three and one, Unsolved alone on a second line, so the single-select row reads as two groups (LensRow.tsx:96)
- m4 · /gallery · hicks-law › Choice Audit (scent) · facet counts describe the whole gallery, not the lens: "Claude 10" leads to at most the 8 proven builds (gallery.ts:637, gallery_facets)
- m5 · /gallery?q= · critique-information-density › Content Priority · the results line reads "2 builds · most reproduced first, …" and does not name the query (Gallery.tsx:578)
- m6 · /gallery, / · critique-composition › Rhythm · a row's cards end at different heights (phase 2's m19, carried; the gallery grid)
- m7 · / (phone) · critique-visual-hierarchy › Emphasis · two filled controls open the composer, the compose strip's New and the bar's New build (phase 2's m2, carried; FeedShell.tsx:238)
- m8 · / (desktop) · better-layout › Plan for clipping (LOW); critique-composition › Whitespace · Home's tab strip starts at y 0 while the nav starts 24px down, so it reads as cut off (FeedShell.tsx)
- m9 · every wide route · better-layout › Plan for clipping (LOW) · the document is 24px taller than the viewport (1440×924 at 900), a stray scroll (flat-shell.css:670; outside the phase's files)
- m10 · /bounties (1440) · better-layout › Align to shared edges (MEDIUM); critique-composition › Balance · two right edges: the rows end at x 1272, the title row, "Solvers" and the facet rule at 1392 (Bounties.tsx:177)
- m11 · /bounties/solvers (1440) · critique-composition › Balance (LOW) · the 720 list leaves the right half of the wide column empty (Solvers.tsx:99)
- m12 · /b2/:slug, its foot (768–1023) · better-layout › Hold structure until it breaks (LOW); critique-composition › Rhythm · where-next cards are 192px at 768 and 205px at 1024 and titles clamp mid-phrase; already two columns there, three measured 120px (WhereNext.tsx:158)
- m13 · /b2/:slug/lineage (390) · better-layout › Order by importance (LOW) · "Open the build" wraps between the headline and its sentence (Lineage.tsx:138)
- m14 · test infrastructure · neoscale-e2e-testing › Writing tests · the audit harness answers every table with all its rows, so a build page opened through it renders "This build could not be loaded" (pre-existing, also at e5551793; e2e/audit/support/harness.ts). The phase-3 critique spec answers through e2e/audit/support/restFilter.ts; the sweeps (audit:contrast, audit:glass) still use the harness alone
- m15 · /bounties, /b2/:slug/lineage, the Rebuilds tab, every maker link · better-ui › Every state needs a static cue (LOW) · text links have rest and focus states and no hover (Bounties.tsx:215; Lineage.tsx:138; RebuildTree.tsx:198; MakerLink.tsx:28)

## RC-P00 — Set-up: skills check, contract, diary, baseline
Date: 2026-09-28 · Commits: SETUP-1 · Head: e2db7e50
Landed: docs/reconciliation/CONTRACT.md, this diary (47 prompt headings) and e2e/audit/rc-baseline.spec.ts (anonymous request counts on / and /gallery, backend stubbed).
Skills applied: ⟦neoscale-performance › Measure before you change anything⟧ ⟦neoscale-e2e-testing › Writing tests; Running and reporting⟧ ⟦neoscale-code-review › Review output format⟧ ⟦buildgallery-repo-map › 7⟧
Migrations queued: none
Lovable messages owed: none
Open: tsc PASS · unit tests 1981/1981 passed, 0 failed · build PASS · JS bytes 4292852 · largest chunk 3373934 index-DbkPwbmY.js · requests / 4, /gallery 3 · main was at e2db7e50; ex-door merged: yes · Playwright in a cloud container needs the uncommitted local config described in docs/connector/HANDOVER.md "EX-P16-fix" (Chromium /opt/pw-browsers/chromium, Vite on 127.0.0.1) · Head above is the commit this entry was written on; SETUP-1 sits on it.
Next: RC-P01

## RC-P01 — Clear reconnaissance (live results not supplied)
Date: 2026-09-28 · Commits: CLEAR-1 · Head: 90d7405e
Landed: docs/reconciliation/CLEAR-RECON.md. Q1–Q7 were never pasted and the owner said to continue, so every live value reads "not supplied"; the repo side is filled: 45 types.ts references to content_items in 39 tables, 19 with no index in migrations and 7 indexed only after another column, each "check live".
Skills applied: ⟦supabase-postgres-best-practices › references/schema-foreign-key-indexes.md⟧ ⟦buildgallery-repo-map › 4⟧ ⟦neoscale-code-review › Review output format⟧
Migrations queued: none
Lovable messages owed: RC-P01 results for Q1–Q7
Open: POSTS not supplied · FK_BLOCKING not supplied · SURVIVORS_OK not supplied (types.ts shows the dm_messages, dm_threads and builds references as nullable) · DEMO_ADMINS not supplied · rebuild_count in BUILD_COLUMNS_PRESENT not supplied (types.ts has it; the repo map's §4 note that it lacks it is out of date) · no live value exists until Q1–Q7 are pasted into CLEAR-RECON.md.
Next: RC-P02

## RC-P02 — Private backup (written and tested locally; not yet applied)
Date: 2026-09-28 · Commits: CLEAR-2 · Head: 675fc666
Landed: supabase/migrations/20261001120000_rc_backup_legacy.sql copies into the private schema rc_backup every table the clear can touch, found from the live catalogue at run time: whole tables for what the clear deletes, only the linked rows for what keeps its rows. rc_backup._manifest lists each copy. Revoked from PUBLIC, anon and authenticated; it refuses to overwrite a backup.
Skills applied: ⟦supabase-postgres-best-practices › references/security-privileges.md; references/lock-short-transactions.md⟧ ⟦buildgallery-repo-map › 4⟧ ⟦neoscale-code-review › Database⟧
Migrations queued: 20261001120000_rc_backup_legacy.sql
Lovable messages owed: none; applying it is owed to a session with direct access to the live project
Open: written without live RC-P01 results, so it finds its own table list. Tested with the clear and the rotation against a local Postgres 16 stand-in holding every foreign-key shape supabase/migrations shows: all checks passed (scratch harness, not committed).
Next: RC-P04

## RC-P03 — Retire the four seeders (repository half, run ahead of RC-P02)
Date: 2026-09-28 · Commits: CLEAR-3, CLEAR-4, CLEAR-6 · Head: daf31d68
Landed: the four seed function folders and their two config.toml blocks are gone ([functions.mcp] byte-identical); /admin loses its two seed buttons; src/lib/rcGuards.test.ts fails if a seeder folder or a call to one comes back; docs/retired-surfaces.md records the deletion and its rollback. CLEAR-6 adds supabase/migrations/20261001123000_rc_rotate_demo_passwords.sql: every demo account gets its own random password, generated in the database and never shown, and its sessions end.
Skills applied: ⟦neoscale-code-review › Automatic fail; Root cause, not symptom⟧ ⟦neoscale-error-monitoring › Privacy⟧ ⟦neoscale-e2e-testing › Writing tests⟧ ⟦buildgallery-repo-map › 3⟧
Migrations queued: 20261001123000_rc_rotate_demo_passwords.sql
Lovable messages owed: none. The live half, deleting the four deployed functions and applying the rotation (Deploy queue items 1 and 2), waits for a session with direct access to the live project.
Open: run ahead of RC-P02 by owner decision, because this session had no live access (no SUPABASE_ACCESS_TOKEN; the network policy denies api.supabase.com). CLEAR-2 stays reserved for RC-P02's backup. tsc PASS · unit tests 1983/1983, 0 new failures vs baseline · build PASS.
Next: RC-P04b; then RC-P02 and RC-P04 once live access exists

## RC-P04 — The clear (written and tested locally; not yet applied)
Date: 2026-09-28 · Commits: CLEAR-5 · Head: 09eed013
Landed: supabase/migrations/20261001130000_rc_clear_legacy_posts.sql, one DO block with 14 guards that fail closed, its plan found from the live catalogue at run time. A row that cannot exist without its post goes, children before parents, so RESTRICT and NO ACTION keys cannot stop it half way. A row that can exist without its post stays with the link emptied: dm_messages, dm_threads and builds, and any other nullable key that does not cascade (xp_events keeps its XP). Legacy notifications and legacy bounties go. `set rc.dry_run = 'on'` rehearses it.
Skills applied: ⟦supabase-postgres-best-practices › references/lock-short-transactions.md⟧ ⟦buildgallery-repo-map › 4⟧ ⟦neoscale-code-review › Database⟧
Migrations queued: 20261001130000_rc_clear_legacy_posts.sql
Lovable messages owed: none; applying it is owed to a session with direct access to the live project
Open: Every surface that reads content_items is now designed for zero rows. Storage is emptied in RC-P34. Both hold once the clear in the Deploy queue has been applied. It embeds RC-P01's gate: survivors nullable, rebuild_count live, no trigger that calls out on delete.
Next: RC-P04b (landed as TOKENS-1)

## RC-P04b — The state map, resolved to existing tokens and measured (run ahead of RC-P02 and RC-P04)
Date: 2026-09-28 · Commits: TOKENS-1 · Head: 17d5299c
Landed: docs/reconciliation/STATES.md maps the 22 states to 44 existing keys (72 citations), held by src/lib/theme/rcStates.test.ts; contrast.test.ts measures the four new pairings in both themes, all above floor (lowest: Exhibition --text2 on --recess, 4.55).
Skills applied: ⟦buildgallery-theme⟧ ⟦color-system › Accessibility Requirements; Best Practices⟧ ⟦buildgallery-repo-map › 7⟧ ⟦neoscale-code-review › Review output format⟧
Migrations queued: none
Lovable messages owed: none
Open: Every interface prompt from RC-P05 uses docs/reconciliation/STATES.md. Row 6 records the nav as built: the desktop rail's active label is --text on an --action wash, not --action. The notes under the map name the helpers it departs from: Button's secondary, outline and destructive paints, chipSelectedStyle, and the unthemed AlertDialog. The backup and the legacy clear (RC-P02, RC-P04) have not run. tsc PASS · unit tests 2065/2065, 0 new failures vs baseline · build PASS · audit:contrast PASS · audit:themes PASS.
Next: RC-P05; RC-P02 and RC-P04 once live access exists

## RC-P01 — Clear reconnaissance, live results (re-run after RC-P04b)
Date: 2026-09-28 · Commits: CLEAR-8 · Head: ebfaecc7
Landed: docs/reconciliation/CLEAR-RECON.md holds the owner's live Q1–Q7 results (a summary in the owner's words, not query rows) and every value derived from them. The recon left the Deploy queue; the backup and clear items now name the live numbers to check.
Skills applied: ⟦buildgallery-repo-map › 4⟧ ⟦supabase-postgres-best-practices › references/schema-foreign-key-indexes.md; references/security-rls-basics.md⟧ ⟦neoscale-code-review › Review output format; Verification before completion⟧
Migrations queued: none
Lovable messages owed: none new; the Deploy queue stands
Open: POSTS 87 · FK_BLOCKING 6 · SURVIVORS_OK yes · DEMO_ADMINS 0 · rebuild_count live · the ten keys Q2 names match supabase/migrations. The backup and the clear were rehearsed on a local Postgres 16 stand-in with Q2's 45 keys (blocking keys as NO ACTION, then as RESTRICT) and the Q1, Q3 and Q7 row counts: the backup copies 87 posts and changes nothing in public; the dry run changes nothing; the clear leaves content_items 0 and the HOLD_CONSTANT counts unchanged; a second run is refused (scratch harness, not committed). Committed on claude/legacy-posts-clear-recon-dzh1zs, this session's branch, not rc-reconcile (CONTRACT §1.1).
Next: RC-P05

## RC-P05 — Navigation on the build model
Date: 2026-09-28 · Commits: FRAME-1, FRAME-2, FRAME-3 · Head: e55c084c
Landed: desktop nav is hicks-law's nine in four groups (four signed out: Home, Gallery, Bounties, New build); phone bar Home, Gallery, New build, Bounties, Profile; drawer Library, Drafts, Messages, Notifications, Analytics, About. /bounties (STATES.md row 19) is lazy inside the new RouteBoundary (row 21). /browse, /discover, /discover-legacy, /recent, /fyp, /feed, /category/:slug land on /gallery; /search on /gallery?q=. Onboarding lands on /gallery and /profile/:handle. navBudget.test.tsx counts all four budgets in the DOM; e2e/tier3/discovery-redirects.spec.ts proves the addresses; docs/reconciliation/critique/choice-audit-nav.md: pass / pass / pass.
Skills applied: ⟦hicks-law › Budgets; Remedies 1 Remove; Choice Audit; Enforcing It in the Code⟧ ⟦law-of-proximity⟧ ⟦better-ui › Match icon stroke to text weight; One SVG, recolored per state⟧ ⟦responsive-design › Input Method Adaptation⟧ ⟦buildgallery-theme › Before you call it done⟧ ⟦neoscale-performance › Checklist for any new route⟧ ⟦neoscale-error-monitoring › Error boundaries⟧ ⟦neoscale-e2e-testing › Selector rules; Writing tests⟧ ⟦buildgallery-repo-map › 2; 6⟧ ⟦neoscale-code-review › Review output format⟧
Migrations queued: none
Lovable messages owed: none
Open: committed on claude/stoic-tesla-uejb2k, this session's branch (as RC-P01's re-run was), not rc-reconcile. AppShell.test.tsx's expectations (step 16a) moved into FRAME-2 so that commit is green. The bar's Profile item is the desktop User glyph now, per "icons as on desktop"; the avatar stays in the top bar. Its dot sums the unread counts, which AppShell now passes as counts: it passed the badge text through Number(), and Number("9+") is NaN, so above nine unread the phone's dots went dark (pre-existing; test in AppShell.test.tsx). playwright.config.ts's mobile project also matches discovery-redirects.spec.ts. Rewritten to assert the redirect (§3.4): e2e/tier3/legacy-meta-bounty.spec.ts "/discover?q=bounty" (skipped by default). e2e/audit/support/harness.ts still sweeps /discover-legacy, which now lands on /gallery (RC-P29). For RC-P09c: the rail's rows are not keyboard reachable (FlatShell), the top bar's avatar duplicates the bar's Profile, the drawer's Sign out is --cat-breakage, /gallery's phone title reads "Discover" (MobileTopBar). tsc PASS · unit 2076/2076, 0 new failures · build PASS · JS bytes 4290716 → 4160385 · tier1 92/92 · redirects 9/9 desktop, 9/9 mobile.
Next: RC-P09 (the picture), then RC-P06

## RC-P09 — The frame without the rail, as a picture (owner's step)
Date: 2026-09-28 · Commits: none · Head: 7c1b488c
Landed: nothing in the repository. The brief is a v0 prompt the owner pastes and looks at; its code is never used. It was not run in this session.
Skills applied: none (no code)
Migrations queued: none
Lovable messages owed: none
Open: A or B is the owner's call. No preference for B was stated before RC-P06, so RC-P06 builds A: the left nav and the 634 column as one centred pair, which is how /notifications renders today.
Next: RC-P06

## RC-P06 — Remove the right rail (the sanctioned structural change)
Date: 2026-09-28 · Commits: FRAME-4, FRAME-5, FRAME-6 · Head: a503a529
Landed: no route renders a right rail or an Explore drawer. The frame is the nav and the 634 column as one centred pair: at 1440, / and /notifications both put the nav at x 283 and the centre at x 523, 634 wide; at 1024 the nav is at x 75, no sideways scroll. The phone's magnifier is "Search builds" and opens /gallery?focus=search. RightRailExplore, its stylesheet, RightRailDrawer and useRightRailData are deleted; flat-shell.css lost one rule; index.css and shared-ns.css lost none (every candidate carries .ns-). /upload/blueprint keeps its "Editor workspace" slot. noRail.test.tsx 7/7; frame-no-rail.spec.ts 4/4 (2 desktop, 2 phone).
Skills applied: ⟦neoscale-code-review › Automatic fail 2, 5⟧ ⟦neoscale-performance › Forbidden fixes 2; The four known causes 2⟧ ⟦layout-grid › Responsive Behavior: Fixed⟧ ⟦better-layout › Hold structure until it breaks; Content bleeds, controls float⟧ ⟦law-of-figure-ground⟧ ⟦responsive-design⟧ ⟦buildgallery-theme › Before you call it done 1, 10, 11⟧ ⟦neoscale-e2e-testing⟧ ⟦buildgallery-repo-map › 2; 3⟧
Migrations queued: none
Lovable messages owed: none
Open: requests on / 4 → 1, /gallery 3 → 3; JS bytes 4160385 → 4143211, largest chunk 3239939 → 3222765. Existing tests that asserted the rail were rewritten in the commit that removed it (FRAME-4, FRAME-5), so each commit is green; that includes e2e/tier1/wide-layout.spec.ts, e2e/tier3/home-ground.spec.ts and feed-repaint.spec.ts, which measured it. Deleted: five home-ground.spec.ts tests whose only subject was the Explore rail's content. moved-routes-frame.spec.ts now fakes the backend (§7), and its import-page file check no longer depends on a transient state. index.css keeps two unreferenced keyframes, rrFade and rrSlide. /dev/wide/rail is a 404. tsc PASS · unit 2084/2084, 0 new failures · build PASS · tier1 92/92.
Next: RC-P07

## RC-P07 — One search, over builds
Date: 2026-09-28 · Commits: SEARCH-1, SEARCH-2 · Head: c05429e1
Landed: supabase/migrations/20261001140000_rc_search_builds.sql enables pg_trgm, adds three trigram GIN indexes and search_build_ids (SECURITY INVOKER, STABLE, search_path empty): published and gallery builds matched on title, outcome, made-for, made-with and placed-node titles, most reproduced first, then most recently published, at most 200. ITS SQL WAS WRITTEN IN THIS SESSION from the prompt's "SEARCH, EXACTLY" paragraph, because the prompt's SQL block arrived as an unfilled {{SQL_P07}}. src/lib/build/search.ts (SEARCH_MIN 2, SEARCH_MAX 80, normaliseQuery, searchBuildIds) and src/lib/profile/searchMakers.ts (at most 3 makers); neither puts query text in an error. The left nav's one search field: NavSearch, "/" focuses it, Enter opens /gallery?q=, and on /gallery it shows q.
Skills applied: ⟦supabase-postgres-best-practices › references/query-index-types.md; references/advanced-full-text-search.md; references/security-rls-basics.md⟧ ⟦hicks-law › Remedies 7 Add scent; Familiarity⟧ ⟦neoscale-error-monitoring › Privacy⟧ ⟦responsive-design › Input Method Adaptation: Keyboard⟧ ⟦buildgallery-theme › Radius; Focus ring; Before you call it done⟧ ⟦neoscale-performance › Checklist for any new route⟧ ⟦neoscale-e2e-testing⟧ ⟦buildgallery-repo-map › 1; 4⟧ ⟦neoscale-code-review › Review output format⟧
Migrations queued: 20261001140000_rc_search_builds.sql, Deploy queue item 5 (the prompt said "4."; the queue already held four)
Lovable messages owed: L-P07-1, once the owner has read the SQL
Open: RC-P10 makes /gallery read q and focus=search. Rehearsed on a local Postgres 16 stand-in with the real read policies: applies twice cleanly; a creator's own draft is never returned; tray-node titles never match (a node counts once placed); %, _ and \ match literally; both trigram indexes are chosen. searchMakers does not filter profiles.is_private (RLS governs; RC-P10's call); PostgREST reads a * in a maker search as a wildcard. The browser's native search-clear × draws in its own blue on Dusk; removing it needs a stylesheet rule (CONTRACT §2.1) or type=text (step 9). tsc PASS · unit 2104/2104, 0 new failures · build PASS · tier1 92/92 · audit:themes PASS.
Next: RC-P08

## RC-P08 — One way to start a build
Date: 2026-09-28 · Commits: ENTRY-1, ENTRY-2 · Head: 98d18bdd
Landed: every new-build control outside the legacy /upload page opens /compose/new: the phone bar's New build, the composer bar, the home compose strip, the profile's first-build button, the drafts page's New draft and empty state, the category empty state, the analytics quest step and the project page's new item. src/lib/rcGuards.test.ts fails if any other file calls openUploadTypePicker( again (it fails on the pre-ENTRY-1 tree, naming those eight files). L held 43 lines in 16 files, 10 of them calls outside the picker's own file.
Skills applied: ⟦hicks-law › Remedies 2 Default; Common Failure Patterns⟧ ⟦critique-affordance › CTA Clarity⟧ ⟦neoscale-e2e-testing › Writing tests⟧ ⟦buildgallery-repo-map › 3⟧ ⟦neoscale-code-review › Review output format⟧
Migrations queued: none
Lovable messages owed: none
Open: labels changed to "New build": Category's empty-state "Upload". Left: Home's compose strip "New" (on the list, but its label is in FeedShell.tsx, outside the files step 4 allows), Drafts' "New draft" and "Start writing", ProjectDetail's "New blueprint", Analytics' "Publish your first post", Profile's "Publish your first build" (ProfileContentZones.tsx), the composer bar's "Share something...", and the phone bar, already "New build". The picker is not deleted (UploadTypeSelector.tsx and a bounty-legacy test still import it; Deferred), so its Cmd/Ctrl+N shortcut still opens it until RC-P08b. No test asserted the picker, so none broke; Drafts.test and AppShell.test now assert /compose/new, and four tests dropped a dead picker mock. tsc PASS · unit 2107/2107, 0 new failures · build PASS · tier1 92/92.
Next: RC-P09c

## RC-P09c — Critique pass on the frame
Date: 2026-09-28 · Commits: CRITIQUE-1, CRITIQUE-2, CRITIQUE-3, CRITIQUE-4 · Head: 6318bd3d
Landed: docs/reconciliation/critique/phase-2.md, one section per skill. It draws on 40 screenshots and on browser probes. The screenshots come from e2e/audit/rc-critique.spec.ts over twelve synthetic builds in e2e/audit/fixtures/rcBuilds.ts; the folder is gitignored. Fixed, one commit per cause: the desktop nav's rows and wordmark are keyboard links with the theme's ring (CRITIQUE-1); the phone no longer titles the Gallery "Discover" (CRITIQUE-2); the search placeholder is --text2, 1.75:1 → 4.55:1 on Exhibition (CRITIQUE-3). Rated items: major 7 → 4, minor 7 → 9, pass 1 → 2. better-layout: Approve.
Skills applied: ⟦critique-composition⟧ ⟦critique-visual-hierarchy⟧ ⟦critique-affordance⟧ ⟦law-of-figure-ground⟧ ⟦better-layout › Reporting⟧ ⟦responsive-design › Input Method Adaptation⟧ ⟦hicks-law › Choice Audit; Budgets⟧ ⟦aesthetic-usability › Applying It⟧ ⟦buildgallery-theme › The colour contract; Before you call it done⟧ ⟦neoscale-e2e-testing › Writing tests⟧ ⟦neoscale-code-review › Root cause, not symptom⟧
Migrations queued: none
Lovable messages owed: none
Open: TWO MAJORS ARE DEFERRED and are the owner's call before RC-P09b. M4: the nav jumps between standard and wide routes, 259px at 1440; the fix is structural (§2.2). M5: search lands on a Gallery that ignores q until RC-P10. Both are under Critique findings deferred, with 25 minor and LOW findings. tsc PASS · unit 2114/2114, 0 new failures · build PASS · tier1 92/92 · discovery-redirects 10/10 on each project · frame-no-rail 4 desktop, 2 phone.
Next: RC-P09b (the picture), then RC-P10

## RC-P09b — The discovery screens, as a picture (owner's step)
Date: 2026-09-29 · Commits: none · Head: d441223b
Landed: nothing in the repository. The brief is a v0 prompt the owner pastes and looks at; its code is never used. It was not run in this session.
Skills applied: none (no code)
Migrations queued: none
Lovable messages owed: L-P11-0 (read-only: get_build_feed's live definition and the indexes on follows), not supplied when RC-P11 ran
Open: No preference was stated, so RC-P10 and RC-P12 build what is drawn: the lens row above the facet band, and Bounties as a list.
Next: RC-P10

## RC-P10 — The Gallery becomes the discovery home
Date: 2026-09-29 · Commits: DISCOVERY-1, DISCOVERY-2, DISCOVERY-3 · Head: c4497566
Landed: /gallery reads lens, for, with and q from its address (src/lib/build/galleryParams.ts) and writes every change back. The lens row (All, Proven, Rebuilt, Unsolved; links with role radio) sits above a band of two facet groups, six options each by count and then More/Fewer. The page's own search field narrows through search_build_ids and offers up to three makers. Row 19's two sentences, row 21's refusal (src/lib/errors/permission.ts).
Skills applied: ⟦hicks-law › Budgets; Readers table; Remedies 7 Add scent; Enforcing It in the Code⟧ ⟦law-of-proximity⟧ ⟦law-of-similarity⟧ ⟦law-of-continuity › Directional indicators⟧ ⟦better-layout › Group with space; Hint at hidden content; Plan for growth⟧ ⟦responsive-design › Touch⟧ ⟦von-restorff-effect⟧ ⟦aesthetic-usability › Applying It 4⟧ ⟦buildgallery-theme › Motion; The colour contract; Before you call it done⟧ ⟦neoscale-error-monitoring › Privacy⟧ ⟦neoscale-performance › Reporting⟧ ⟦neoscale-e2e-testing⟧ ⟦buildgallery-repo-map › 1⟧ ⟦neoscale-code-review⟧
Migrations queued: none
Lovable messages owed: none new; L-P07-1 (search_build_ids) must land before the query works live
Open: requests /gallery 3 → 2, not equal: the Open bounties chip's count request left with the chip. /gallery?q=agent 3 on the baseline's empty database (nothing matches, so step 2c skips the builds request); 4 when the search matches a build. gallery.ts locked lines changed 0. The drawn burnt-orange More measured 3.69:1 on the Exhibition filter sheet (glass over the scrim), so More/Fewer is --text (10.08). Pre-existing, untouched: that sheet's --text2 chip labels are 4.05:1 on Exhibition. "The order sentence" is read as the header's description, so the lens wrapper's −16 top margin collapses PageHeader's 40 to 24. Committed on claude/rc-phase-3-discovery-q8vt2m, this session's branch (rc-reconcile is 21 commits behind main). tsc PASS · unit 2159/2159, 0 new failures · build PASS · tier1 92/92 on both projects · gallery-discovery 6/6 desktop, 6/6 mobile · audit:contrast PASS · audit:glass PASS.
Next: RC-P11

## RC-P11 — Home becomes two tabs on the build feed (live definition not supplied)
Date: 2026-09-29 · Commits: FEED-1, FEED-2, FEED-3 · Head: 530f37e4
Landed: Home is Following and Everyone, both BuildsTab on get_build_feed; Following passes only_following (20261001150000, Deploy queue item 6). Default Following for a signed-in reader who follows anyone (countFollowing, one estimated HEAD), else Everyone; neither is fetched until that is known. The legacy tab hooks, every Supabase query in Home.tsx, the realtime channel, the new-posts pill and the bounty strip are gone. Row 19's three sentences; the one suggestion list (listSuggestedMakers, ≤3) under Following for a reader who follows nobody. MakerLink is shared with the gallery's makers row.
Skills applied: ⟦hicks-law › Budgets; Remedies 1 Remove; Remedies 2 Default⟧ ⟦neoscale-performance › The four known causes 2; Reporting⟧ ⟦supabase-postgres-best-practices › references/data-pagination.md; references/schema-foreign-key-indexes.md; references/security-rls-performance.md⟧ ⟦buildgallery-repo-map › 4⟧ ⟦law-of-continuity › Alignment⟧ ⟦critique-information-density › Cognitive Load⟧ ⟦aesthetic-usability › Applying It 4⟧ ⟦buildgallery-theme › Before you call it done⟧ ⟦neoscale-e2e-testing⟧ ⟦neoscale-code-review › Database⟧
Migrations queued: 20261001150000_rc_build_feed_following.sql (Deploy queue item 6)
Lovable messages owed: L-P11-0 was never answered. The migration was written from 20260829220000 and refuses to run unless the live function is exactly that definition; if it refuses, send L-P11-0 and regenerate.
Open: live definition differs from migration files: unknown (not supplied). DEPLOY ORDER: the Following tab calls only_following, so item 6 must be applied with the frontend; Everyone works on the current live function. Requests on / (anonymous baseline) 1 → 1; signed in, following nobody, 34 → 34; following one maker 38 → 37. Home's own requests are now the follows count plus one feed RPC. content_items requests: 0 from Home on either tab; a signed-in frame still makes 3 HEAD counts through AppShell's Drafts badge (useDraftCount), which is the frame and outside this prompt; repoint it at builds drafts when the frame's legacy path is retired. BuildFeedItems spaces entries 16 apart, not 24: unchanged, per step 7d. tsc PASS · unit 2165/2165, 0 new failures · build PASS (JS 4152715 → 4085628) · tier1 92/92 on both projects · home-two-tabs 8/8 + 8/8.
Next: RC-P12

## RC-P12 — The open bounties board
Date: 2026-09-29 · Commits: BOUNTIES-1, BOUNTIES-2, BOUNTIES-3 · Head: 8936e990
Landed: /bounties is a wide route listing every open ask on a published build, newest first: listOpenBountyCards (three requests a page: the asks with build and gap title embedded, then solutions and makers together, keyset on created_at) and bountyFacetsMadeWith (one request, ≤12). One Made with group through the gallery's FacetRail (?with=), rows parted by hairlines with row 13's dashed edge, one outline "Open the build" per row, "Show more", row 19 and row 21.
Skills applied: ⟦hicks-law › Budgets; Readers table⟧ ⟦layout-grid › Grid Anatomy; Responsive Behavior⟧ ⟦law-of-common-region › use the weakest container⟧ ⟦law-of-proximity⟧ ⟦law-of-continuity › Alignment⟧ ⟦von-restorff-effect⟧ ⟦responsive-design › Reflow⟧ ⟦better-layout › Inset buttons; Plan for growth; Hold structure until it breaks⟧ ⟦buildgallery-theme › Gap / bounty; Type; Before you call it done⟧ ⟦supabase-postgres-best-practices › references/data-pagination.md; references/data-n-plus-one.md⟧ ⟦neoscale-performance › Checklist for any new route⟧ ⟦neoscale-error-monitoring⟧ ⟦neoscale-e2e-testing⟧ ⟦buildgallery-repo-map › 1⟧ ⟦neoscale-code-review⟧
Migrations queued: none
Lovable messages owed: none
Open: THE ROW REFLOWS BELOW 1024, NOT 768 as step 7d says: in the wide frame the list is about 408px at 768 and the three-column row overlapped itself (HIGH). 1024 is where FacetRail folds too. The list holds the prompt's three columns and each row uses them through subgrid, so the columns align down the board. Asks on draft builds are left off, as the feed's bounty arm does. With a Made with filter and no match, the board says "No open bounties are made with that." + Clear filters; unfiltered it is row 19's exact sentence. /bounties is wide now, so M4's nav jump applies to it. tsc PASS · unit 2180/2180, 0 new failures · build PASS · tier1 92/92 on both projects · bounties-board 7/7 + 7/7 · audit:contrast PASS.
Next: RC-P13

## RC-P13 — The board of solvers
Date: 2026-09-29 · Commits: BOUNTIES-4, BOUNTIES-5 · Head: 246d6e35
Landed: /bounties/solvers (wide, lazy, in RouteBoundary) ranks the people whose solutions were accepted on bounties that live on a build, in two requests: top_solvers (SECURITY INVOKER, STABLE; most solved, then reward total, then latest; 1–100 rows) and one profiles read by id. At most 25 rows, max 720, each its own "40px minmax(0,1fr) auto" grid with hairlines between; positions and tallies in DM Mono tabular-nums; the tally moves under the name below 768; row 19 "Nobody has solved a bounty yet." + See open bounties; row 21. /bounties carries one "Solvers" text link at the trailing end of its title row; no navigation entry (still 9). /b/:id/leaderboard lands on /bounties/solvers; BountyLeaderboard.tsx stays, no longer imported.
Skills applied: ⟦hicks-law › Budgets; Enforcing It in the Code⟧ ⟦law-of-continuity › Alignment and reading flow⟧ ⟦buildgallery-theme › Type; Before you call it done⟧ ⟦layout-grid⟧ ⟦responsive-design › Reflow⟧ ⟦supabase-postgres-best-practices › references/query-partial-indexes.md; references/security-rls-basics.md⟧ ⟦neoscale-performance › Checklist for any new route⟧ ⟦neoscale-error-monitoring › Error boundaries⟧ ⟦neoscale-e2e-testing⟧ ⟦buildgallery-repo-map › 1⟧ ⟦neoscale-code-review⟧
Migrations queued: 20261001160000_rc_top_solvers.sql (Deploy queue item 7; the prompt said 6)
Lovable messages owed: L-P13-1 (queued): apply 20261001160000_rc_top_solvers.sql exactly as written, then run and paste `select * from public.top_solvers(5);`
Open: No test asserted the old leaderboard route, so step 10 rewrote none; solvers-board.spec.ts proves the redirect. MakerLink now draws the theme's focus ring on the link, which also reaches the gallery's makers row and Home's suggestions (keyboard focus only). top_solvers(NULL) answers one row, as the specified LIMIT LEAST(GREATEST(max_results,1),100) reads a NULL; the page always passes 25. Contrast on /bounties/solvers and /bounties at 390 and 1440, both themes: 0 text failures; the new links wear the system ring (Exhibition 1.8:1, row 9's owner-escalated survivor). tsc PASS · unit 2207/2207, 0 new failures · build PASS · tier1 92/92 on both projects · solvers-board 6/6 + 6/6.
Next: RC-P14

## RC-P14 — Lineage becomes the rebuild tree
Date: 2026-09-29 · Commits: LINEAGE-1, LINEAGE-2, LINEAGE-3 · Head: 90068502
Landed: rebuild_tree (SECURITY INVOKER, STABLE; root whatever its status, then published and gallery rebuilds down parent_build_id; 20 levels, 200 rows; a draft cuts the walk; a cycle ends) read by getRebuildTree in two requests and nested by the pure buildTree (orphans to the root, the cap held). RebuildTree draws the family as nested ordered lists, 24 in per generation through padding-inline-start with a 1px --line connector, title → /b2/<slug>, maker, "n reproduced" in DM Mono tabular, "Δ note" clamped in DM Mono 12, "you are here" unlinked; below 768 the indent stops at depth 4 and deeper rows say "depth n". The Rebuilds tab draws it under THE FAMILY above the unchanged direct list, asking only when the tab opens. /b2/:slug/lineage (lazy, RouteBoundary) is "Rebuilds of this"; /b/:slug/lineage lands there when the slug names a build and says "No build at this address." otherwise; empty is "No rebuilds yet." + Rebuild this.
Skills applied: ⟦law-of-continuity › Timelines; Continuity and Visual Hierarchy⟧ ⟦better-layout › Align to shared edges; logical properties⟧ ⟦responsive-design⟧ ⟦buildgallery-theme › Rebuild credit; Before you call it done⟧ ⟦supabase-postgres-best-practices › references/schema-foreign-key-indexes.md; references/security-rls-basics.md⟧ ⟦neoscale-performance⟧ ⟦neoscale-e2e-testing⟧ ⟦buildgallery-repo-map › 1⟧ ⟦neoscale-code-review⟧
Migrations queued: 20261001170000_rc_rebuild_tree.sql (Deploy queue item 8; the prompt said 7)
Lovable messages owed: none queued by the prompt; the Deploy queue item names the check to run
Open: THE INDEX IS GUARDED: NS-P36 already made the identical index (idx_builds_parent_build) and IF NOT EXISTS compares names only, so idx_builds_parent is created only where no index leads with parent_build_id. "post_lineage reads in src" is 3, not 0: all in the frozen remix path (src/lib/remix/hooks.ts ×2, feeding Upload.tsx under the §4 lock and ContentDetail; createRemix.ts ×1, behind the freeze), which §2.12 keeps live until the prompt that deletes it; Lineage.tsx has none, get_post_lineage calls are 0 and getPostLineage (its only caller the page) is gone. getBuildFamily draws from the build itself, two more requests, when its root is unreadable or the walk misses it. retiredSurfaces.test.tsx's lineage case was rewritten in LINEAGE-2 so every commit is green; lineage-readable.spec.ts now asserts the old address (2/2, no skips). The tab still appears only where direct rebuilds exist (BuildTabs unchanged). tsc PASS · unit 2245/2245, 0 new failures · build PASS · tier1 92/92 on both projects · lineage-rebuilds 5/5 + 5/5.
Next: RC-P14b

## RC-P14b — Where next at the foot of a build page
Date: 2026-09-29 · Commits: DISCOVERY-4, DISCOVERY-5 · Head: d83ff338
Landed: WhereNext at the foot of /b2/:slug, after the tab panel, in the page's own column: "Rebuilds of this", "More made with <tool>", "More from <maker>", DM Mono 12 headings, rows 40 apart, each at most three unchanged GalleryCards and never the build being read; an empty row is left out and with nothing onward nothing renders. getWhereNext issues at most three requests together (GALLERY_BUILD_COLUMNS, limit 3, not this build; none for the tool row when made_with is empty; the maker row embeds the maker's name). A 1px sentinel asks only within 400px of the viewport: 0 requests before, 3 after. Blurred surfaces with it in view: 9 on desktop, 11 on a phone (the phone chrome's two).
Skills applied: ⟦hicks-law › Budgets; Readers table⟧ ⟦law-of-similarity⟧ ⟦law-of-continuity › Using interrupted continuity to separate groups⟧ ⟦layout-grid⟧ ⟦buildgallery-theme › Glass; Before you call it done⟧ ⟦neoscale-performance⟧ ⟦neoscale-e2e-testing⟧ ⟦buildgallery-repo-map › 1⟧ ⟦neoscale-code-review⟧
Migrations queued: none
Lovable messages owed: none
Open: TWO COLUMNS BETWEEN 768 AND 1023, three from 1024 as asked: at 768 three made 120px cards with titles cut to fragments (measured); two hold 192px, no narrower than three at 1024. The rows select header columns only, as asked, so cards draw their text body with no cover and nothing is signed. Row 2's eligibility string is rebuilt from GALLERY_THRESHOLD (galleryPredicate is locked and private); whereNext.test.ts holds it equal to listGallery's. DISCOVERY-4 WAS COMMITTED WITH motion.test.ts RED: WhereNext imported useReveal, which the theme sanctions in BuildPage.tsx and Gallery.tsx only; that commit's review ran the build-page suites, not the whole suite. DISCOVERY-5 removes the reveal and fixes the rows' gap (SPACE.xl is 64; SPACE.lg is 40), both caught by tests. Pre-existing, for RC-P14c: the audit harness's /b2/inbox-triage-agent renders "This build could not be loaded" (also at e5551793), so the sweeps never see a build page; the measurements here used the spec's own stub. tsc PASS · unit 2264/2264, 0 new failures · build PASS · tier1 92/92 on both projects · where-next 4/4 + 4/4 · build-page-repaint 17/17 · audit:glass PASS.
Next: RC-P14c

## RC-P14c — Critique pass on discovery
Date: 2026-09-29 · Commits: CRITIQUE-5, CRITIQUE-6, CRITIQUE-7, CRITIQUE-8 · Head: d06dc232
Landed: docs/reconciliation/critique/phase-3.md, one section per skill, from 72 screenshots (nine addresses at 390, 768, 1024 and 1440 in both rooms, by e2e/audit/rc-critique.spec.ts re-pointed at phase 3) and browser probes. Fixed, one commit per cause: where-next cards drew no picture and now read the gallery's card select, embed caps and signed covers (CRITIQUE-5, M1); the lineage page names its build in the eyebrow and opens it with "Open the build" (CRITIQUE-6, M2). Dimensions: major 3 · minor 6 · pass 7 → major 0 · minor 6 · pass 10. better-ui Approve · better-layout Approve · the card identical on /gallery, / and where next: yes.
Skills applied: ⟦critique-information-density⟧ ⟦critique-visual-hierarchy⟧ ⟦critique-affordance⟧ ⟦critique-composition⟧ ⟦hicks-law › Choice Audit; Budgets⟧ ⟦law-of-similarity⟧ ⟦better-ui › Reporting⟧ ⟦better-layout › Reporting⟧ ⟦responsive-design › Input Method Adaptation⟧ ⟦aesthetic-usability › Applying It⟧ ⟦buildgallery-theme › Before you call it done⟧ ⟦neoscale-e2e-testing › Writing tests; Running and reporting⟧ ⟦neoscale-code-review › Root cause, not symptom⟧
Migrations queued: none
Lovable messages owed: none
Open: Phase 3 complete. No major is deferred; phase 3's m1–m15 are under Critique findings deferred. THE VERIFICATION RUN CAUGHT A PRE-EXISTING RACE: tier3 gallery-repaint.spec.ts:207 (BG-P19) measured the cards while the stagger still moved them, failing 5 in 10 at d4412238 (before this phase) and 4 in 10 at 4389ef34; CRITIQUE-7 waits for the reveal's end state, test only, 20/20. The audit harness still answers every table unfiltered (m14): the critique spec answers through e2e/audit/support/restFilter.ts, and the sweeps still see no build page. The fixture gained a third generation (1 → 7 → 13), a no-reward ask, two solvers and the board's answers. tsc PASS · unit 2267/2267, 0 new failures · build PASS · tier1 92/92 on both projects · tier3 346/346 on both projects, 26 skipped by project · critique capture 18/18.
Next: RC-P15

## RC-P15 — Tables for likes, comments, saves and builds in collections
Date: 2026-09-29 · Commits: SOCIAL-1, SOCIAL-2 · Head: fc5ae8b0
Landed: 20261001180000_rc_build_social.sql (build_likes, build_saves, build_comments with RLS on 3/3, builds.like_count, comment_count and save_count kept by SECURITY DEFINER triggers, collection_items.build_id with the item_kind check found in the catalogue and replaced). src/lib/social: likeBuild, unlikeBuild, getMyLikes, saveBuild, unsaveBuild, getMySaves, listMySavedBuilds (keyset before, cards through gallerySelect and withCardEmbeds, 2 requests), listComments, nestComments, addComment, editComment, deleteComment, getEngagementCounts; every list query has .limit; SocialError carries identifiers, code and status only (no message, details, hint or cause), kind no_access for 42501, PGRST301/302, 401 and 403.
Skills applied: ⟦supabase-postgres-best-practices › SKILL.md; references/security-rls-basics.md; security-rls-performance.md; security-privileges.md; schema-foreign-key-indexes.md; schema-constraints.md; schema-primary-keys.md; query-partial-indexes.md⟧ ⟦neoscale-code-review › Database; Data layer; Review output format⟧ ⟦neoscale-error-monitoring › Privacy⟧ ⟦neoscale-e2e-testing › Auth fixtures⟧
Migrations queued: 20261001180000_rc_build_social.sql (Deploy queue item 9; the prompt said 8)
Lovable messages owed: L-P15-1, then L-P15-2 (RLS proof)
Open: TWO DEPARTURES, BOTH FOR RC-P17's TWO-REQUEST BUDGET. (1) build_comments.author_id also keys to profiles(id) (build_comments_author_profile_fkey) so a page of comments embeds its authors; auth.users is not exposed to PostgREST. (2) listComments(buildId, { limit = 50, after }) pages FORWARD with after, not before, because RC-P17 lists oldest first; one request a page reads top-level comments and replies together in time order (limit counts both), and nestComments hangs each reply under its comment across pages. L-P15-2 reads 1 hidden comment if its second-oldest account is an admin (by design). buildgallery-repo-map, listed in the expected report, is not installed in this session (nor color-system, law-of-proximity, law-of-similarity, law-of-continuity, critique-information-density, which later phase-4 prompts list). builds.updated_at moves with every count change (trg_builds_updated_at), as with the reproduction and rebuild counters. Committed on claude/upbeat-shannon-57dvps, this session's branch, not rc-reconcile. tsc PASS · unit 2282/2282, 0 new failures · build PASS.
Next: RC-P15b (the picture), then RC-P16

## RC-P15b — Engagement and comments, as a picture (owner's step)
Date: 2026-09-29 · Commits: none · Head: 0f306688
Landed: nothing in the repository. The brief is a v0 prompt the owner pastes and looks at; its code is never used. It was not run in this session.
Skills applied: none (no code)
Migrations queued: none
Lovable messages owed: none
Open: No drawing was supplied, so RC-P16 builds what the brief describes, with one difference recorded there: the page row sits 24 under the reproduction action, not 24 beside it.
Next: RC-P16

## RC-P16 — Like, comment, save and share, on cards and build pages
Date: 2026-09-29 · Commits: SOCIAL-3, SOCIAL-4, SOCIAL-5 · Head: 2c527a82
Landed: src/hooks/useEngagement.ts (getEngagementCounts, and signed in getMyLikes and getMySaves, together: 3 requests for a list signed in, 1 signed out, in 60-id slices; updateEngagement writes an accepted change into every cached list) and src/components/social/EngagementRow.tsx (card: Like, Comment, Save; page: the same and Share; tertiary, lucide 18 at stroke 1.5, active the same icon filled --action with aria-pressed and its count --text, counts DM Mono 12 tabular, 4 icon to count, 16 between pairs, 44×44 by padding, colour and opacity at 150ms and none under reduced motion; optimistic with rollback and the sonner toast; signed out to /login?redirect=; Share is the share sheet or a copy of https://buildgallery.ai/b2/<slug> and "Link copied"). The card's new last element on the Gallery, Home's feed and where next, one hook call per list; the build header's row 24 under the reproduction action.
Skills applied: ⟦buildgallery-theme › Components: Card, Plaque, Actions; Motion; Before you call it done⟧ ⟦hicks-law › Budgets; Enforcing It in the Code⟧ ⟦von-restorff-effect⟧ ⟦better-ui › Match icon stroke to text weight; One SVG, recolored per state; Motion restraint; icons.md⟧ ⟦critique-affordance › Action Discoverability⟧ ⟦responsive-design › Input Method Adaptation⟧ ⟦neoscale-performance⟧ ⟦neoscale-error-monitoring⟧ ⟦neoscale-e2e-testing › Writing tests⟧ ⟦neoscale-code-review⟧
Migrations queued: none
Lovable messages owed: none new. DEPLOY ORDER: the row reads 20261001180000 (Deploy queue item 9); before it is live the counts read fails, the row draws no numbers and Like and Save end in "Something went wrong."
Open: FOUR LISTED SKILLS ARE NOT INSTALLED in this session (law-of-similarity, law-of-proximity, color-system, buildgallery-repo-map); their rules were taken from the prompt's own figures. The header's one filled button is "Rebuild this" (ForkControl): "I ran this and it worked" has been secondary since BG-P21 and is unchanged, so "the reproduction action stays the only filled button" is read as "the row adds none". Beside the action the row sat 215px from it at 1440 (the slot is as wide as its freshness line), so it is 24 under it at every width. A card is one link and the row's buttons sit inside it: the row stops the click and cancels the link's navigation (e2e: a press stays on /gallery); axe would call it nested-interactive, and moving the link off the frame is outside CONTRACT §3.5. Off the spacing scale: 4 (icon to count, the prompt's) and 13 (block padding that makes an 18px icon a 44px target). The card skeleton reserves the row. gallery-discovery.spec.ts records the list requests only (SOCIAL-4). Theme 10/11, n/a 8 (gaps untouched). tsc PASS · unit 2288/2288, 0 new failures · build PASS · engagement 6/6 + 6/6 · gallery-discovery 6/6 + 6/6 · tier1 92/92 on both projects · audit:contrast PASS · audit:glass PASS.
Next: RC-P16b

## RC-P16b — Link previews and search tags for builds
Date: 2026-09-29 · Commits: SEO-1, SEO-2 · Head: 5367f9eb
Landed: a build page renders SeoHead once loaded: "<title> — buildgallery", the outcome cut at a word boundary to 155 with "…" (src/lib/build/shareMeta.ts), or "A build by <maker>, reproduced <n> times." (getMakerName, one two-column read, only then); canonical https://buildgallery.ai/b2/<slug>; og:type article; og:image from the hero still the page already signed; noindex on a draft. SeoHead defaults to https://buildgallery.ai and emits twitter:site only when passed. index.html: the new title and description, og:site_name buildgallery, no twitter:site. /gallery and /bounties carry their own titles and descriptions.
Skills applied: ⟦aesthetic-usability › Where It Applies: First impressions⟧ ⟦neoscale-e2e-testing › Writing tests⟧ ⟦neoscale-code-review⟧
Migrations queued: none
Lovable messages owed: none
Open: THE AFTER-DEPLOY CHECK WILL LIKELY SHOW THE SITE'S TAGS, NOT THE BUILD'S. The app is a client-rendered SPA with no prerendering (netlify.toml) and no edge function writing meta, and messaging apps read the HTML without running JavaScript, so a pasted build link previews index.html's static tags; search engines that render JavaScript do see the build's. A per-build preview needs a crawler-facing edge function or Netlify prerendering, which this prompt's MUST NOT CHANGE (supabase/functions/**) rules out; the owner decides. index.html's og:title, og:description and their twitter twins still carry the old "AI Agent Tactics Forum" and "blueprints" copy ("nothing else in index.html changes"), and React 19 renders each page's tags beside those static ones. VITE_SITE_URL, if set on the host, still overrides the canonical host (.env.example says neoscaleai.com). Outside this prompt's two files "neoscale" remains in Home.tsx's title, Footer.tsx and portable.ts. BuildPage.test.tsx now stubs the engagement counts read, which SOCIAL-4 left reaching the real client. buildgallery-repo-map is not installed. tsc PASS · unit 2300/2300, 0 new failures · build PASS · tier1 92/92 on both projects.
Next: RC-P17

## RC-P17 — Comments on a build and on its parts
Date: 2026-09-29 · Commits: COMMENTS-1, COMMENTS-2, COMMENTS-3 · Head: 7d711f36
Landed: src/components/social/Comments.tsx, one section (id="comments") after the tab panel and before where next: the COMMENTS eyebrow, the box with a secondary Post beside it and an attachable "on part n · title" chip, comments oldest first 24 apart and unboxed (avatar 32, name to /profile/:username, DM Mono 12 time, "on part" chip, plain-text body with its line breaks), Reply / Edit / Delete (16 further along, confirmed in the Dialog, "Delete comment"), replies 24 in behind a 1px --line with no Reply, 50 a page then "Show more comments", "Sign in to comment" signed out, "No comments yet." empty, rows 20 and 21 for loading and refusal. A NEW trailing marker on each anatomy row (MessageCircle 1.5, the part's count above zero, "Comment on this part") attaches the part and focuses the box. Two requests together within 400px of the screen, or at once for #comments: the first page and listPartCommentCounts; the markers read the cached counts.
Skills applied: ⟦law-of-common-region › When Containment Is Counterproductive⟧ ⟦von-restorff-effect⟧ ⟦critique-affordance › Action Discoverability⟧ ⟦hicks-law › Budgets⟧ ⟦aesthetic-usability › Applying It 4⟧ ⟦responsive-design › Input Method Adaptation⟧ ⟦buildgallery-theme › Type; Before you call it done⟧ ⟦neoscale-error-monitoring › Privacy⟧ ⟦neoscale-performance⟧ ⟦neoscale-e2e-testing⟧ ⟦neoscale-code-review⟧
Migrations queued: none
Lovable messages owed: none new; the section reads build_comments and the author embed from 20261001180000 (Deploy queue item 9)
Open: NOT INSTALLED: law-of-continuity, law-of-proximity, buildgallery-repo-map (the prompt's figures were used: replies 24 in with a hairline; 8 between chip, box and Post). Parts are numbered depth first as the Anatomy draws them; replying opens a box under the thread ("Post reply", Cancel) rather than the top box, and an edit happens in place ("Save", Cancel). A draft build shows no section and no markers (the database refuses comments on drafts). The only filled button a reader can see is "Rebuild this"; the frame's progress-chip flyout holds a filled "View profile" at opacity 0 (pre-existing). Theme 9/11, n/a 7 (no plaque in the section) and 8 (no gap); overflow 0 at 390, 768, 1024 and 1440 in both rooms; every action 44 tall. BuildPage.test.tsx stubs the comments reads. tsc PASS · unit 2308/2308, 0 new failures · build PASS · build-comments 7/7 + 7/7 · build-page-repaint 17/17 · tier1 92/92 on both projects.
Next: RC-P17b

## RC-P17b — Report and hide, for builds and comments
Date: 2026-09-29 · Commits: MODERATION-1, MODERATION-2, MODERATION-3 · Head: 8a1dda1a
Landed: 20261001190000_rc_reports.sql: builds.is_hidden under a NEW restrictive read policy (no existing builds policy touched), content_reports (reporter and admins read; authenticated keeps SELECT and INSERT, anon nothing) and resolve_report (admin only, "not allowed" before it reads). src/lib/moderation: reportTarget, listOpenReports, resolveReport, isBuildHidden. A signed-in reader reports a build from a quiet "Report" at the end of the build page's new credit line ("by <maker>", embedded on the page's own request), or somebody else's comment from a text action after Reply. The Dialog offers Spam, Doesn't work, Harmful, Not theirs, Something else, an optional 500-character note and one filled "Send report", then "Thanks. An admin will look at it." Admin's Content Queue is now Reports (secondary Hide confirmed by "Hide it", tertiary Dismiss); still six tabs. A maker whose build is hidden sees "An admin has hidden this build."; a hidden comment says "hidden by an admin" to the author and admins who still read it, and offers no Report.
Skills applied: ⟦supabase-postgres-best-practices › references/security-rls-basics.md; security-rls-performance.md; security-privileges.md; schema-constraints.md; query-partial-indexes.md⟧ ⟦law-of-figure-ground › Overlays and scrims⟧ ⟦hicks-law › Budgets⟧ ⟦von-restorff-effect⟧ ⟦critique-affordance › CTA Clarity⟧ ⟦buildgallery-theme › Elevation; Radius; Before you call it done⟧ ⟦neoscale-error-monitoring › Privacy⟧ ⟦neoscale-e2e-testing⟧ ⟦neoscale-code-review⟧
Migrations queued: 20261001190000_rc_reports.sql (Deploy queue item 10, after item 9)
Lovable messages owed: L-P17b-1, then L-P17b-2 with the one-line grant item 10 names (as written it stops at "permission denied for table _p")
Open: buildgallery-repo-map is not installed. The queue reads the open reports with their reporters in one request, then the target summaries in at most two more (builds, comments), each only when the page holds one of its kind. The Content Queue's approve and reject code left with its tab; the stats row still counts pending legacy posts. On a phone the bars' zIndex 1000 lives inside a zIndex 1 stacking context, so the scrim covers them; the spec proves it by hit-testing with the page's pointer events briefly restored (a Radix modal turns them off). Theme 9/11, n/a 7 (no plaque) and 8 (no gap); overflow 0 at 390 and 1440 in both rooms. tsc PASS · unit 2343/2343, 0 new failures · build PASS · reports 9/9 + 9/9 · tier1 92/92 on both projects.
Next: RC-P18

## RC-P18 — Library and collections hold builds
Date: 2026-09-29 · Commits: LIBRARY-1, LIBRARY-2 · Head: dc2a8b38
Landed: /library has two tabs. Saved is build_saves as the gallery's cards, newest save first, with a secondary Show more; Collections are the reader's own, the one used last first, and one opens in place as cards (?tab=collections&collection=<id>) with Rename, Make public or private, and a confirmed Delete for its owner. Empty: "Save a build and it waits for you here." with Browse the gallery; "Group builds you want to keep together." with New collection. src/lib/library: the "build" kind; resolveBuildItems (one .in request, GALLERY_BUILD_COLUMNS and the card's embeds); addBuildToCollection, removeBuildFromCollection, listCollections, listCollectionBuilds, startCollection, renameCollection, deleteBuildCollection and getLibraryOwner, identifiers only in their errors. A successful Save toasts "Saved." with one text action, "Add to a collection": the Dialog lists the reader's collections, most recently used first, seven rows before it scrolls, and a New collection field.
Skills applied: ⟦hicks-law › Budgets; Remedies 6 Customise⟧ ⟦law-of-figure-ground › Overlays and scrims⟧ ⟦aesthetic-usability › Applying It 4⟧ ⟦buildgallery-theme › Before you call it done⟧ ⟦neoscale-performance⟧ ⟦neoscale-e2e-testing⟧ ⟦neoscale-code-review⟧
Migrations queued: none
Lovable messages owed: none new; build items need 20261001180000 (Deploy queue item 9)
Open: NOT INSTALLED: law-of-similarity, buildgallery-repo-map. The legacy default "Saved items" collection is left out of every list, since Saved is build_saves now; it stays in the database. collections.item_count has no trigger in the repository, so counts are an embedded collection_items(count). /library/collections/:id and /library/:handle/collections/:id now open the same collection in the Library: the old page could not draw a build, and its reorder, share link, bulk copy and legacy picker went with it. The dialog is mounted once beside the toasters (AddToCollectionHost), because a dialog inside a card receives the card link's clicks through React's portal bubbling. A visitor's /library/:handle is their public collections, with no tabs. Theme 10/11, n/a 8 (no gap); overflow 0 at 390 and 1440 in both rooms. tsc PASS · unit 2376/2376, 0 new failures · build PASS · library-builds 6/6 + 6/6 · engagement 6/6 + 6/6 · tier1 92/92 on both projects.
Next: RC-P19

## RC-P19 — Notifications about builds
Date: 2026-09-29 · Commits: NOTIFY-1, NOTIFY-2, NOTIFY-3 · Head: 0b24ed59
Landed: 20261001200000_rc_build_notifications.sql: nine kinds written by triggers through rc_notify (SECURITY DEFINER, executable by nobody but its owner; never to the actor; never twice in ten minutes), each with a fixed message; the target_type check widened with build, build_comment and bounty_build (catalogue-checked, and it stops on an unknown live value); notifications.build_id. src/lib/notifications: the nine kinds and three targets; resolveNotificationBuilds names every build on a page in one request (from metadata.build_id); build and bounty_build lead to /b2/<slug>, build_comment to /b2/<slug>#comments. /notifications is one list with no filter tabs: avatar and name, the stored message, the build's title and the time, grouped by day under "Mark all as read"; an unknown kind shows its stored message and leads nowhere; the legacy kinds keep their words.
Skills applied: ⟦supabase-postgres-best-practices › references/security-privileges.md; schema-constraints.md; schema-foreign-key-indexes.md; lock-short-transactions.md⟧ ⟦neoscale-error-monitoring › Privacy⟧ ⟦hicks-law⟧ ⟦neoscale-performance⟧ ⟦buildgallery-theme › Before you call it done⟧ ⟦neoscale-e2e-testing⟧ ⟦neoscale-code-review⟧
Migrations queued: 20261001200000_rc_build_notifications.sql (Deploy queue item 11, after item 9)
Lovable messages owed: L-P19-1
Open: buildgallery-repo-map is not installed. Client calls removed, since the database writes their events now: notifyNewFollower, notifyBountySolutionSubmitted and notifyBountySolutionAccepted in src/lib/notifications/triggers.ts (none was called), and FollowButton's own new_follower insert. STILL DOUBLED because this prompt locks src/lib/bounty: submitSolution and acceptSolution (src/lib/bounty/solutions.ts:163 and :321, solutionRebuild.ts:342) still write their own bounty_interaction row for the two events the database now writes as solution and solved, so the bounty's author and the solver each see two rows until those calls go. The prompt's (user_id, created_at DESC) is the existing idx_notifications_recipient_created on recipient_id. Until item 11 is applied nothing writes the nine kinds, and a follow notifies nobody. Theme 9/11, n/a 7 (no plaque) and 8 (no gap); overflow 0 at 390 and 1440 in both rooms. tsc PASS · unit 2386/2386, 0 new failures · build PASS · build-notifications 4/4 + 4/4 · tier2 notifications 26/26 · tier1 92/92 on both projects.
Next: RC-P20

## RC-P20 — 

## RC-P20b — 

## RC-P21 — 

## RC-P22 — 

## RC-P23 — 

## RC-P24 — 

## RC-P25 — 

## RC-P26 — 

## RC-P27 — 

## RC-P28 — 

## RC-P28a — 

## RC-P28b — 

## RC-P08b — 

## RC-P29 — 

## RC-P30 — 

## RC-P31 — 

## RC-P32 — 

## RC-P33 — 

## RC-P34 — 
