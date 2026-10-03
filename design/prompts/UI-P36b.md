# UI-P36b — Turn the frame on

Follow `design/RULES.md`.

**Run this only after `UI-D01` reports verdict B.** If it reported A, merge the branch instead. If C, go back and run the missing prompts. Turning on a flag in front of pages that were never built shows visitors a broken site.

**Goal.** The ten rebuilt pages are what a visitor sees. Everything from `UI-P16` on was built behind the `site_frame` flag, which is off by default — so until this prompt runs, every route renders its `legacy` branch and the overhaul is invisible outside a dev session.

**Read first.** `src/lib/shell/flags.ts` (what `isSiteFrameOn()` reads, and what it returns when the row is absent), `src/components/shell/siteFrameRoutes.ts`, `src/components/AppShell.tsx`, the `feature_flags` table **as it exists in the live database** (its real column names — `RULES.md` §8: the live schema has drifted from `supabase/migrations/`, so confirm rather than trust a migration file), and the newest filename in `supabase/migrations/`.

**Do.**

1. **Check the routes first.** Every route inside the layout must be in `SITE_FRAME_ROUTES`. List any that are not and **stop** if there are any: a half-flagged app shows a visitor the new frame on one page and the old one on the next. Name the missing routes and which prompt owns each.
2. **Walk the app with the flag forced on**, before changing any data — `?frame=site` (the dev override from `UI-P16`), at 1440 and 390, in Noon and in Dusk, signed in and signed out: `/`, `/gallery`, a build page, `/rebuild/:slug`, the lineage route, `/import`, `/bounties`, a profile, `/notifications`, `/login`. For each: does it render, does the header show, does the breadcrumb read correctly, are there console errors. **Stop and report** if any page throws, renders the old frame, or loses data that the legacy page showed.
3. **Enable the flag** with a migration that inserts the row, named to continue the project's sequence (`YYYYMMDDHHMMSS_snake_case.sql`, after the newest existing one). Write it so it is correct whether or not the row is already there, and so re-running it is harmless:
   - insert `site_frame` enabled, `on conflict do update`;
   - use the table's real column names from the step above;
   - no `auth.uid()` bare in any policy you touch — `(select auth.uid())`.
   Do not change any other flag's row.
4. **Keep the way back.** In the migration file's header comment, write the one-line SQL that disables it again. The point of the flag is that a bad deploy is one `update` away from the old frame, and whoever needs that at 2am should not have to read this prompt.
5. **Verify with the flag genuinely on**, not overridden: the ten routes again, desktop and mobile, both themes. Then `npm run audit:design` across every board.
6. Update `design/README.md` — under "Checking a change", note that the frame is now on for everyone and `?frame=flat` shows the old one until `UI-P41` deletes it.

**Do not.** Delete `FlatShell`, the legacy branches or the flag — that is `UI-P41`, and only once this has been live long enough to trust. Turn on any other flag. Change a policy to make the flag readable; if a signed-out visitor cannot read `feature_flags`, **stop and propose** the policy rather than widening one.

**Done when.** A signed-out visitor in a clean browser gets the new frame on all ten routes at 1440 and 390 in both themes; `npm run audit:design` compares every board within its threshold; `npx tsc --noEmit -p tsconfig.app.json`, `npm test`, `npm run build` and `npx playwright test e2e/tier1 --project=desktop --project=mobile` all pass; and the migration's header carries the one-line rollback.

**Commit.** `UI-P36b: turn on the site frame`
