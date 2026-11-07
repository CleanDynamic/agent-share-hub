UX-15 · Settings, and blocking
PASS with parts not done (below)
Branch / PR: claude/ux-15-settings-blocking-t3zm9e (no PR opened)
Facts in this prompt that were wrong on disk: no reports for UX-04, UX-05, UX-12; the site header has no theme control (only the phone's account sheet and sign-in page); `is_private` had no writer anywhere; the live notification kinds differ from the prompt's list. Details in part0.md.
Baseline → end: new tests: settings 87, security 15, prefs 8. Failures on main and unchanged: 12 lookRules (BuildSteps/BuildView), 3 ux03.p4, retiredAddresses flake.
Checks run: tsc clean; vitest on touched areas; Playwright settings-ux15 30/30 (1440 and 390, Light and Dark, no sideways scroll); migration and RLS plan on scratch Postgres 16 (passes, and passes on a second apply). NOT run: full npm test/build, tier1, audit:pages/perf/themes/contrast, Deno (not installed; Deno test written, same scenario run in Vitest).

Reach points: see part0.md table; closed by RESTRICTIVE insert policies, proved by design/audits/ux-15/rls-plan.sql (T1 to T17).
Parts not done / deviations:
- OpenBuilds topic lists (listPosts) and existing notifications still show blocked people's rows: they are table reads with no function to patch. A topic's replies collapse only for people YOU blocked; hiding people who blocked you there would need a database change that reveals the block.
- DM thread Block has no Vitest (legacy Messages page); the entry is in Conversation settings.
- Group threads are not blocked.
- Profile adds one request round for signed-in viewers (block state after the summary).
- A 'published' notification switch ("Someone you follow publishes a build") was added because that kind exists.
- Danger style: none exists; plain controls used. Messages.tsx not added to lookRules (legacy).
- navBudget test updated: phone account sheet now lists Settings.
- Playwright password-change and A/B block end-to-end need a real project: not run.
Lovable message (send exactly):
```
Apply supabase/migrations/20261111120000_ux15_settings_blocking.sql exactly as written. Change nothing else. Then deploy the edge functions export-my-data and delete-my-account. Please run the EXPLAIN (ANALYZE, BUFFERS) statements in the migration header and paste the plans back.
```
Questions for Miles: should blocking stop rebuilds of public builds (left open)? Replies on account deletion: removed (built) or anonymous? Does RebuildCredit say "original removed" when parent_build_id is null (not checked)? Theme: the desktop header has no control, so Settings is the only one; keep it so? Which actors may block (staff)?
What Miles needs to do: 1 send the Lovable message; 2 Supabase › Authentication: enable manual identity linking and Secure email change; 3 merge; 4 Publish › Publish changes; 5 test deleting a throwaway account end to end.
Screenshots: design/audits/ux-15/shots (every section, list, delete window). Block confirmation and blocked profile are covered by Vitest, not screenshots.
