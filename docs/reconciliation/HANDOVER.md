# The reconciliation series — handover diary

Contract: docs/reconciliation/CONTRACT.md. Read it, then the newest entry below.

## Deploy queue
1. Owed, needs direct access to the live project (RC-P03): delete the deployed edge functions seed-demo-data, seed-ecosystem, seed-new-posts and update-seed-data, then check that seed-demo-data answers 404 to an OPTIONS request (never GET or POST).
2. Apply supabase/migrations/20261001123000_rc_rotate_demo_passwords.sql (RC-P03), then check that no demo account holds a session.
3. Apply supabase/migrations/20261001120000_rc_backup_legacy.sql (RC-P02), then check that rc_backup._manifest lists public.content_items with 87 rows, the Q1 post count. If it holds a different number, the live data has moved since RC-P01: run Q1 and Q7 of docs/reconciliation/rc-recon.sql again before item 4.
4. Apply supabase/migrations/20261001130000_rc_clear_legacy_posts.sql (RC-P04), only once the backup is confirmed and the seed functions are gone. Rehearse it first in the same session with `set rc.dry_run = 'on';`, which ends in "RC-P04 DRY RUN OK: …" and changes nothing. A real error starts "RC-P04:" and is never retried, edited or worked around. Afterwards content_items is 0 and the Q7 counts are unchanged: profiles 24, builds 9, build_nodes 13, dm_messages 3, dm_threads 1, follows 80.
5. 20261001140000_rc_search_builds.sql (RC-P07), by Lovable message L-P07-1. Its SQL was written in the RC-P07 session from the prompt's own specification, because the prompt's SQL block arrived as an unfilled placeholder; read it before sending L-P07-1. Rehearsed on a local Postgres 16 stand-in: applies twice cleanly, and `select count(*) from public.search_build_ids('ab');` runs.

## Deferred to after the merge
- FlatShell rightRail and forceRightRail, .fs-right CSS, AppShell's /upload/blueprint branch: removed in RC-P08b (RC-P06)
- UploadPickerContext, UploadTypePicker, UploadPickerProvider, still imported by src/pages/UploadTypeSelector.tsx and src/lib/bounty-legacy/legacyBountyCreateRetired.test.tsx; deleted in RC-P08b (RC-P08)

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

## RC-P09b — 

## RC-P10 — 

## RC-P11 — 

## RC-P12 — 

## RC-P13 — 

## RC-P14 — 

## RC-P14b — 

## RC-P14c — 

## RC-P15 — 

## RC-P15b — 

## RC-P16 — 

## RC-P16b — 

## RC-P17 — 

## RC-P17b — 

## RC-P18 — 

## RC-P19 — 

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
