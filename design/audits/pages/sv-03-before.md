# SV-03 · before

Branch `sv-03-fast-data`, from main `cd20f49` (SV-02 merged). Taken on 25 October 2026 with `npm run audit:pages` (a built bundle through `vite preview`, the audit harness as the database, signed in as the audit user, every request answered 120 ms late, median of 3). Raw numbers: `design/audits/pages/sv-03-before.json`.

## Assumptions

Each fact in "What is slow now", and what the code and the audit showed.

- **Drafts, three requests one after another.** Confirmed in code and in the audit. `listDraftsWithSessions` calls `auth.getSession`, then `listDraftBuildsByCreator` (`BUILD_COLUMNS`, 38 columns including `post_doc` and `making`, limit 50), then reads `builds` again for `session_count`. On the page that is 3 rounds cold (profile, drafts, counts), because `ProtectedRoute` also waits for the profile read first. `session_count` is a column on `builds`, so the third read is not needed.
- **Opening a draft.** Confirmed. `ComposeRoute` returns a blank `FALLBACK` while `loading` and while the `parent_build_id` check (`getBuild`, the whole record) runs; `SandboxPage` is a `lazy()` import that starts only when the page renders. Six `getNodeType` queries in `SandboxPage` (team, decision, system_prompt, dataset, repo, manual_step; lines 362 to 443), while `composeRecord` already holds `getNodeTypes()`. In the audit: 2104 ms, 3 rounds cold (profile, then the build header, then the nodes, tray, events and types).
- **Gallery.** Confirmed. `classificationLive` and `feedSort` depend on `classification_facets`, so the feed key changes when the facets answer. Cold on Builds is 6 rounds and 21 requests. `getBuildClassifications` and `getBuildTries` run after the ids are known.
- **Library, Saved.** Confirmed: `lazyPage` fallback is a blank block; `listMySavedBuilds` reads the session, then `build_saves`, then `builds`. 3 rounds cold with the profile read in front. The error ("Something went wrong") is not reproduced in the harness yet (see Part 5).
- **Every signed-in page, a small skeleton first.** Confirmed: `ProtectedRoute` waits on `loading`, which `AuthContext` clears only after `fetchProfile` finishes.
- **Cache times.** Confirmed: `staleTime` 30 s, no `gcTime`, nothing kept across a reload.
- **25 calls to `auth.getUser()`.** Confirmed, exactly 25 in `src` outside tests. Listed in Part 1.
- **Found on the way (not in the prompt): `/builds` redirected to `/gallery` and back, forever.** SV-02 moved the route to `/builds` and left `GALLERY_PATH = "/gallery"` in `galleryParams.ts`, so `galleryHref()` wrote `/gallery`, `KeepSearchRedirect` sent it to `/builds`, and the page's own "write the canonical address" effect sent it back. Fixed in this commit (one constant, 17 test expectations), because the audit cannot measure Builds without it.
- **Found on the way: `npm test` does not pass on main.** 57 tests in 11 files fail before any SV-03 change (the list is in the report). `npm run audit:perf`'s "feed reserves its slots" test also fails before any change: it finds 0 cards on the Builds tab.

## Plan

- Part 0: page-ready marks, `audit:pages`, this file -> verified by: `pageReady.test.tsx`, `npm run audit:pages`.
- Part 1: loading ends at the session; the profile loads alongside; `getUser` out of page-load paths -> verified by: AuthContext and ProtectedRoute tests, a spy test, composer cold rounds 3 to 2.
- Part 2: Drafts in one request, light columns, no empty drafts made, Remove empty drafts -> verified by: `drafts.test.ts`, a New build test, audit drafts rounds 3 to 1.
- Part 3: chunk and data start together, the rebuild check is light, node types once, first-screen reads together -> verified by: `ComposeRoute` and `SandboxPage` tests, audit composer rounds 2 and under 900 ms; `compose_open` only if that fails.
- Part 4: classification and tries in `listGallery` and `getBuildFeed` -> verified by: gallery tests, audit builds rounds.
- Part 5: Saved in one request, panel error with Retry -> verified by: `saves.test.ts`, a LibraryBuilds test, audit library-saved rounds 3 to 1.
- Part 6: route table, intent fetching, idle loading, preconnect -> verified by: `routeTable.test.ts`, `intent.test.tsx`, `idleLoad.test.ts`, a built `index.html` test.
- Part 7: cache times and `keepPreviousData`; the kept cache only if a reload misses 600 ms -> verified by: tests of the times and a tab change, audit reload column.
- Part 8: indexes, wrapped `auth.uid()` policies, `EXPLAIN` comments -> verified by: a migration test that reads the file.
- Part 9: measure again, `pageBaseline.json`, em dash search -> verified by: `npm run audit:pages`, `npm run audit:perf`, `npm run audit:design`.

## Numbers before

Every database request 120 ms late. Median of 3.

| page | cold ms | cold requests | cold rounds | cold KB | warm ms | warm requests | reload ms | reload requests | reload rounds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| home | 810 | 16 | 2 | 10.9 | 21 | 0 | 737 | 16 | 2 |
| builds | 1417 | 21 | 6 | 62.2 | 17 | 0 | 1259 | 21 | 6 |
| openbuilds | 779 | 11 | 2 | 2 | 10 | 0 | 710 | 11 | 2 |
| library-saved | 990 | 11 | 3 | 3.5 | 13 | 0 | 886 | 11 | 3 |
| library-collections | 844 | 10 | 2 | 1.9 | 9 | 0 | 709 | 10 | 2 |
| drafts | 988 | 13 | 3 | 19.6 | 13 | 0 | 881 | 13 | 3 |
| composer | 2104 | 11 | 3 | 12.7 | 33 | 0 | 1179 | 11 | 3 |
| build | 991 | 14 | 3 | 13.5 | 16 | 0 | 849 | 14 | 3 |
| profile | 1925 | 11 | 3 | 2.6 | 1297 | 2 | 1826 | 11 | 3 |

"Warm" here is a page opened a second time from inside the app within 30 s: it shows from the cache already; the numbers after SV-03 for warm matter beyond 30 s, which Part 7's times change.

## Web Vitals before (`npm run audit:perf`, built bundle)

| route | theme | LCP ms | INP proxy ms | CLS | DOM nodes |
| --- | --- | ---: | ---: | ---: | ---: |
| home | noon | 7028 | 48 | 0.008 | 384 |
| home | dusk | 1596 | 24 | 0.008 | 384 |
| gallery | noon | 1600 | 24 | 0.034 | 237 |
| gallery | dusk | 1612 | 32 | 0.034 | 237 |
| build | noon | 952 | 24 | 0.006 | 99 |
| build | dusk | 1028 | 32 | 0.006 | 99 |

The Home Noon LCP of 7028 ms is the first run of the first route in the process (cold font and chunk cache); Home Dusk, run right after, is 1596 ms.

## Tests before

`npm test` on main at `cd20f49`: 8805 tests, 8748 pass, **57 fail in 11 files**, none from SV-03: `AppShell`, `flat-shell.wide`, `noRail`, `siteFrame`, `retiredSurfaces`, `onePrompt.composer.snapshot`, `compliance`, `motion`, `ns-classes`, `rcStates` and `BuildPage` (11 tests, the same 11 with and without the page-ready line). Several of them name things that no longer exist (`FrameRoute`, `flat-shell.css`, `MobileBottomNav`). They are left as they are and listed in the report.

Changing `GALLERY_PATH` to `/builds` made 12 more tests in `GalleryPage.test.tsx` and `GalleryClassification.test.tsx` fail, because they expected `/gallery?...`; their expectations are now `/builds?...` and they pass.
