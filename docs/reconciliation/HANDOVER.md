# The reconciliation series — handover diary

Contract: docs/reconciliation/CONTRACT.md. Read it, then the newest entry below.

## Deploy queue
1. Owed, needs direct access to the live project (RC-P03): delete the deployed edge functions seed-demo-data, seed-ecosystem, seed-new-posts and update-seed-data, then check that seed-demo-data answers 404 to an OPTIONS request (never GET or POST).
2. Apply supabase/migrations/20261001123000_rc_rotate_demo_passwords.sql (RC-P03), then check that no demo account holds a session.
3. Apply supabase/migrations/20261001120000_rc_backup_legacy.sql (RC-P02), then check that rc_backup._manifest lists public.content_items with 87 rows, the Q1 post count. If it holds a different number, the live data has moved since RC-P01: run Q1 and Q7 of docs/reconciliation/rc-recon.sql again before item 4.
4. Apply supabase/migrations/20261001130000_rc_clear_legacy_posts.sql (RC-P04), only once the backup is confirmed and the seed functions are gone. Rehearse it first in the same session with `set rc.dry_run = 'on';`, which ends in "RC-P04 DRY RUN OK: …" and changes nothing. A real error starts "RC-P04:" and is never retried, edited or worked around. Afterwards content_items is 0 and the Q7 counts are unchanged: profiles 24, builds 9, build_nodes 13, dm_messages 3, dm_threads 1, follows 80.

## Deferred to after the merge
(empty)

## Critique findings deferred
(empty)

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

## RC-P09 — 

## RC-P06 — 

## RC-P07 — 

## RC-P08 — 

## RC-P09c — 

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
