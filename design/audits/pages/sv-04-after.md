# SV-04 · after

Branch `sv-04-page-transitions`. The tour is `npm run audit:pages` (`e2e/audit/page-changes.spec.ts`): the built bundle, the audit database with every request 120 ms late, 1440 x 700, median of 3 runs, cold then warm. Raw numbers: `sv-04-after.json`.

**Before and after are from the same machine.** The session's container was replaced part-way through, and the new one is slower than the one `sv-04-before.md` was measured on (main's own Home takes 916 ms cold here, against 722 ms in SV-03's report). So the before column below is main at `71cbfd2`, played on this machine with this prompt's tour (`sv-04-before-same-machine.json`); `sv-04-before.md` keeps the first measurement. Videos: `sv-04/before/tour.webm` (main, first machine) and `sv-04/after/tour.webm` (this branch).

"Layout shift" is the page area's. The footer sits at the foot of the surface and moves whenever a page of another length is drawn; a shift that moved only the footer is in its own column, reported and not judged. "Click to change" is the first frame that differs from the one before the input: on main the old page vanished in that frame, so main's numbers are small; here the old page stays until the new one is drawn, and the nav marks its target at once.

## The tour, before (main) → after

| step | way | click to change ms | empty frames | placeholder states | layout shift (page area) | footer shift | header kept | opened at y | Back scroll off px |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home → Builds | cold | 3 → 2 | 0 → 0 | 2 → 2 | 0 → 0 | 0.018 → 0.043 | yes → yes | 0 → 0 |  →  |
| Builds → a build | cold | 5 → 39 | 0 → 0 | 1 → 1 | 0 → 0 | 0.05 → 0 | yes → yes | 295 → 0 |  →  |
| Back to Builds | cold | 1 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0.037 → 0.037 | yes → yes |  →  | 0 → 0 |
| Builds → OpenBuilds | cold | 6 → 5 | 0 → 0 | 1 → 1 | 0 → 0.044 | 0 → 0 | yes → yes | 0 → 0 |  →  |
| OpenBuilds → Library | cold | 6 → 6 | 0 → 0 | 1 → 1 | 0 → 0 | 0.001 → 0.017 | yes → yes | 0 → 0 |  →  |
| Library → Drafts | cold | 7 → 5 | 0 → 0 | 1 → 1 | 0 → 0.021 | 0.012 → 0 | yes → yes | 0 → 0 |  →  |
| Drafts → a draft | cold | 5 → 58 | 10 → 0 | 1 → 1 | 0 → 0.003 | 0.025 → 0.025 | no → yes | 0 → 0 |  →  |
| Back to Drafts | cold | 14 → 1 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0.012 | no → yes |  →  | 0 → 0 |
| Drafts → Profile | cold | 6 → 3 | 0 → 0 | 2 → 1 | 0.018 → 0.018 | 0.017 → 0 | yes → yes | 0 → 0 |  →  |
| Profile → Home | warm | 7 → 6 | 0 → 0 | 0 → 0 | 0 → 0 | 0.021 → 0.021 | yes → yes | 0 → 0 |  →  |
| Home → Builds | warm | 6 → 2 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | yes → yes | 0 → 0 |  →  |
| Builds → a build | warm | 7 → 52 | 0 → 0 | 0 → 0 | 0 → 0 | 0.037 → 0 | yes → yes | 295 → 0 |  →  |
| Back to Builds | warm | 2 → 13 | 0 → 0 | 0 → 0 | 0 → 0 | 0.037 → 0.037 | yes → yes |  →  | 0 → 0 |
| Builds → OpenBuilds | warm | 6 → 7 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | yes → yes | 0 → 0 |  →  |
| OpenBuilds → Library | warm | 6 → 6 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0 | yes → yes | 0 → 0 |  →  |
| Library → Drafts | warm | 3 → 6 | 0 → 0 | 0 → 0 | 0 → 0 | 0.013 → 0.013 | yes → yes | 0 → 0 |  →  |
| Drafts → a draft | warm | 6 → 39 | 0 → 0 | 0 → 0 | 0 → 0.003 | 0 → 0 | no → yes | 260 → 0 |  →  |
| Back to Drafts | warm | 3 → 3 | 0 → 0 | 0 → 0 | 0 → 0 | 0 → 0.012 | no → yes |  →  | 0 → 0 |
| Drafts → Profile | warm | 4 → 7 | 0 → 0 | 1 → 1 | 0.018 → 0.018 | 0.004 → 0 | yes → yes | 0 → 0 |  →  |

## Thresholds

| Threshold | Result |
| --- | --- |
| Click to first visible change at or under 100 ms | **Yes, every step** (worst 58 ms, opening a draft; 39 ms opening a build, after the build page joined the idle loader). |
| Zero frames with an empty page area | **Yes** (main: 10 frames opening a draft). |
| At most one placeholder state per change, none on a warm change | **No, two steps.** Home → Builds (cold) goes through two shapes: the Builds page draws its feed's loading state, then its board's when the classification facets answer (`GalleryPage.tsx`: `classification` and `board` are passed only once `classificationLive`). SV-11 redraws this page and its loading state. Drafts → Profile (warm) shows its placeholder again because the audit harness's profile summary read fails twice (a retry after 1 s), and a failed read is not kept; with a profile that reads, it is kept like the others. |
| Layout shift at or under 0.02 | **No, two steps**, both from content that differs from its loading state: Builds → OpenBuilds 0.044 (the test board has no open asks, so the ask panel goes and Top solvers moves up 346 px) and Library → Drafts 0.021 (fifteen drafts arrive where the loading state drew three rows, and "Older post drafts" moves down). Neither happens on main, which drew the generic list placeholder and then the page with its data. |
| The header never replaced and never moved | **Yes** (main: replaced on opening a draft and on Back from it). |
| Back restores the scroll within 4 px | **Yes**, 0 px; and a new page opens at the top (main: a build opened 295 px down, a draft 260 px down). |

`npm run audit:pages` fails on the four lines above, as Part 7 asks.

## SV-03's checks in `npm run audit:pages`

- Request rounds: Drafts 1, Library Saved 1, opening a draft 2 at best. Pass.
- Cold request counts against `pageBaseline.json`: `drafts` 8 → 10 and `composer` 15 → 19 were raised. Over a fixed window (1.5 s after the mark) Drafts makes 11 requests on main and on this branch; two of them now start in the first round, before the ready mark, so the counter sees them. The composer's ready mark is later (it now holds its full skeleton until Sources' session library is in; see Part 4), which lets more of its reads into the window. Home's cold count reads 15 against 9 on this machine for main and this branch alike: the slower machine holds Home's mark long enough for its side panels' reads to be counted.

## Web Vitals against SV-03's after (`npm run audit:perf`, built bundle)

| route | theme | LCP ms (SV-03 → SV-04) | INP proxy ms | CLS |
| --- | --- | --- | --- | --- |
| home | noon | 5904 → 3880 | 24 → 24 | 0.008 → 0.008 |
| home | dusk | 1424 → 1288 | 24 → 24 | 0.008 → 0.008 |
| gallery | noon | 1632 → 1448 | 24 → 24 | 0.004 → **0.019** |
| gallery | dusk | 1596 → 1384 | 32 → 32 | 0.004 → **0.019** |
| build | noon | 972 → 940 | 24 → 24 | 0.011 → 0.006 |
| build | dusk | 1112 → 932 | 32 → 32 | 0.011 → 0.006 |

No worse except the Builds page's CLS, which is all the footer moving as Builds passes through its loading shapes (the facets switching it between feed and board, above). Under the 0.02 line, and SV-11's to remove. "The feed reserves its slots under a slow network" fails as it did before SV-04 (SV-03 reports the same).

## At rest

- `npm run audit:design`: the same 7 boards fail as on main (`build-map`, `composer-map`, `composer-card` in both themes, `noon/prompt-window`); the other 11 pass.
- `npm run audit:contrast`: stops at the `ca22-selection` route on main and on this branch alike: the sweep presses `act-pick-two` on a dev page, and no source file draws that test id any more. The theme's contrast unit tests (`src/lib/theme/contrast.test.ts`) pass.
- The page fade and the progress line are the only motion added (`src/lib/routing/sv04Motion.test.ts`).
- No em dash in the diff.

## Watching the videos

Contact sheets of both tours (a frame every half second) show the header and footer steady on every frame, no blank page area, and one loading shape per change. One frame catches OpenBuilds mid-arrival, the old and new text overlapping for the 150 ms fade, which is the fade doing what it should. Nothing was cut back.
