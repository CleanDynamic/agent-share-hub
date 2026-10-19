# CA-03 Part 0 · the baseline

Recorded on 19 October 2026, before any CA-03 change, on `claude/ca-03-deeper-builds-7t73l0` at `8e3d3aa`.

## Where CA-03 starts

CA-02 is merged. `main` is at `8e3d3aa` (Merge pull request #355 from `claude/ca-02-composer-7ze4wd`) and holds
`CA-02 P1` to `CA-02 P10`, plus a later `CA-02 P2: follow the two sources that could be read` (`3a956fd`). The prompt's
`87e2636` (the default branch it was checked against) and `54bd486` (`CA-02 P9`) are both ancestors of `8e3d3aa`.
CA-03 branches from `main`, and its pull request targets `main`.

## Checks

| Check | Result |
|---|---|
| `npm test` | 279 files, 4,571 tests: **4,516 pass, 55 fail** in 9 files (below) |
| `npx tsc --noEmit -p tsconfig.app.json` | 0 errors |
| `npm run lint` (whole repo) | 2,217 problems: 1,959 errors, 258 warnings |
| `eslint` on the 25 files CA-03 will touch | 0 errors, 21 warnings (all `react-refresh/only-export-components`) |

The 55 failing tests are outside the composer, and none of them is caused by CA-02:

| File | Failing |
|---|---|
| `src/components/AppShell.test.tsx` | 31 |
| `src/pages/site/build/BuildPage.test.tsx` | 11 |
| `src/components/shell/noRail.test.tsx` | 7 |
| `src/lib/theme/motion.test.ts` | 3 |
| `src/components/shell/flat-shell.wide.test.ts` | 1 |
| `src/components/shell/siteFrame.test.tsx` | 1 |
| `src/lib/retiredSurfaces.test.tsx` | 1 |
| `src/lib/theme/ns-classes.test.ts` | 1 |
| `src/lib/theme/rcStates.test.ts` | 1 |

Several read `src/components/shell/flat-shell.css`, deleted in PR #302. `BuildPage.test.tsx` looks for a
`build-viewer` and first-screen text the build page no longer draws. CA-03 holds these at 55 and adds no failure;
"every test green" in the prompt is read as "no new failure".

## Design compare

`DESIGN_MAX_DIFF=0 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run audit:design -- --grep composer`.
The same as CA-02's "after" numbers in `design/audits/composer/README.md`.

| Board | Size | Different pixels | Share |
|---|---|---|---|
| refined/dusk/composer-list | 1440 × 1560 | 46,782 | 2.083% |
| refined/dusk/composer-map | 1440 × 1240 | 28,074 | 1.572% |
| refined/dusk/composer-card | 1440 × 1000 | 12,898 | 0.896% |
| refined/noon/composer-list | 1440 × 1560 | 48,662 | 2.166% |
| refined/noon/composer-map | 1440 × 1240 | 28,312 | 1.586% |
| refined/noon/composer-card | 1440 × 1000 | 32,095 | 2.229% |

## Contrast

`PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run audit:contrast`: 16 routes × 2 rooms, 1,741 pairings measured,
**50 unaccepted failures**, 0 accepted, 402 hairlines, 54 exempt. On the two routes CA-03 changes, the only failure
is one focus ring each (`outline 2px offset 2px`, ratio 1 against the floor of 3) in each room: compose 2, build 2.
The rest are on dev-kit (11), legacy-discover (6), gallery (6), signup (4), login (4), home (3) and one or two on
each other route.

## Facts in the prompt that differ from the code

- The branch is `claude/ca-03-deeper-builds-7t73l0` (the session's assigned branch), not `ca-03-deeper-builds`.
- The composer's `Field` (`composeControls.tsx`) puts its label 4 above the control, not 6.
- `requireLiveType` is a private function in `graph.ts`, not exported. `addCheck` can use it from there.
- The registry has no Google Sheets tool (Part 9). It saves as a typed tool, and Part 7's warning names Gmail only,
  which is what Part 9 expects.
- `eval_run` is seeded `copyable: false` and active. An `eval_run` in a build meets the completeness item "add the
  comparison table or eval run" (`signals.ts`, `comparison`). The plaque reads only `reproduction_count` and
  `isStale()`, so a check cannot move the lamp, but it does change that completeness line.
- The live database cannot be queried from this session; `eval_run` being active is confirmed in the seed and will
  be confirmed live by `requireLiveType` when a check is first added.
- `SHAPE_NODE_TYPES` in `src/dev/fixtures/shapes.ts` has no `eval_run` row yet.
- The `buildgallery-repo-map` skill named in `CLAUDE.md` is not installed in this session. Names come from the files.
- The reader map (`src/pages/site/build/ReaderMap.tsx`) has no layout of its own. It draws `BuildMap` in reader
  mode, so Part 4's layout in `mapLayout.ts` reaches the build page through it.
- CA-02 did not report fan-out or fan-in. A team draws as one box, and `layoutOpened` puts its agents in one row,
  left to right. Part 4's side-by-side column is new work.

Every other file, function, line reference and value the prompt names matches the code.
