# UI-P41 — Retire the old frame

Follow `design/RULES.md`. **This is the only prompt that deletes anything.** Run it when every route is on the new frame and the flag has been on in production long enough to trust.

**Read first.** `design/RULES.md` §3, `AppShell.tsx`, `FlatShell.tsx`, `flat-shell.css`, `wideRoutes.ts`, `RightRailExplore.tsx`, `right-rail-explore.css`, `RightRailDrawer.tsx`, `hooks/useRightRailData.ts`, `MobileTopBar.tsx`, `MobileBottomNav.tsx`, `ProfileDrawer.tsx`, `src/lib/theme/semantics.ts`, and the tests `AppShell.test.tsx`, `FlatShell.wide.test.tsx`, `wideRoutes.test.ts`, `e2e/tier3/moved-routes-frame.spec.ts`, `src/lib/retiredSurfaces.test.tsx`, `docs/retired-surfaces.md`.

**Do, in this order, one commit each.**
1. **Confirm.** `SITE_FRAME_ROUTES` covers every route inside the layout, and `usesSiteFrame` returns true for each one. List any route that is not covered and stop if there is one.
2. **Make the frame unconditional.** `AppShell` renders `SiteFrame` always. Remove the flag branch, `useSiteFrameFlag`, `src/lib/shell/flags.ts`, `siteFrameRoutes.ts`, `FrameRoute` and the `?frame=` override, and the `site_frame` row from `feature_flags` (a migration that deletes the row, following the project's filename sequence).
3. **Delete the old frame:** `FlatShell.tsx`, `flat-shell.css`, `wideRoutes.ts`, `MobileTopBar.tsx`, `MobileBottomNav.tsx`, `ProfileDrawer.tsx`, `RightRailDrawer.tsx`, and the legacy page components each page prompt left in place as its `legacy` branch. Delete their tests, or rewrite each one against the new frame where it was testing behaviour that still exists (the nav list, the theme control, the search). `FlatShell.wide.test.tsx` and `wideRoutes.test.ts` go.
4. **Delete the right rail:** `RightRailExplore.tsx`, `right-rail-explore.css`, `hooks/useRightRailData.ts` and the dev page `/dev/wide/rail`. Its content already lives in page panels (Home's right column).
5. **Retire the tokens the new card does not use** — `--card-frame`, `--card-thread`, and any `--porthole`, `--chrome-hi`, `--chrome-lo`, `--glass-hi` with no remaining reader. For each: grep for every use, remove it from `TOKEN_NAMES`, both theme objects, every `:root` block and `t`, and update `css-parity.test.ts` and `compliance.test.ts` in the same commit. A token still used by anything stays.
6. **Update the register:** add the deleted surfaces to `docs/retired-surfaces.md` and to `src/lib/retiredSurfaces.test.tsx` so they cannot come back.
7. **Update the docs:** `CLAUDE.md`'s UI section, the `buildgallery-theme` skill text (Noon, Sentient, the new tokens, the new frame) and `design/HANDOFF.md` §3 and §7 — replacing "what exists / what is new" with what now exists. Note in `design/README.md` that the kit is now a record of the built UI, and that the compare harness still guards it.

**Do not.** Delete anything in the legacy inventory that is not the frame or the rail (the content path, `Upload.tsx`, `content_items`, the legacy discovery and reading pages are a separate piece of work). Delete `design/` or the compare harness.

**Done when.** No file imports `FlatShell`, `flat-shell.css`, `wideRoutes` or the rail; `npx tsc --noEmit -p tsconfig.app.json`, `npm test`, `npm run build` and the full Playwright suite pass; `npm run audit:design` still compares every board within 0.04; the app looks the same after the deletions as before them.

**Commit.** `UI-P41a: frame unconditional` · `UI-P41b: delete FlatShell and phone chrome` · `UI-P41c: delete the right rail` · `UI-P41d: retire unused tokens` · `UI-P41e: registers and docs`
