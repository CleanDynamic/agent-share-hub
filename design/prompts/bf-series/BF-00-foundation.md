# BF-00 · Foundation: the series in the repo, the Builds boards retired, the baseline

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** First of the series. Read `design/prompts/bf-series/README.md`, then `design/prompts/sv-series/README.md`. Pull main first. Lovable commits straight to main. Branch `bf-00-foundation`. Commit at the end of every part with the part number in the message. Open one pull request titled `BF-00 Foundation` at the end.

The facts here were checked on 10 November 2026, at `c177bb0`. **The file on disk wins.**

## Intent

Nothing a reader sees changes. This prompt makes the next fifteen possible: the series is in the repository where `CLAUDE.md` can point to it, the three Builds boards that draw the old filter rail stop being compared, one end to end test file exists for later prompts to add to, and the numbers every later report is measured against are written down.

## The four rules, for this prompt

- **Think first.** The board kit carries its boards as a compressed blob. Do not guess how a board is retired: find how the OpenBuilds board was retired and do exactly that.
- **Simplicity.** No board is redrawn. No new compare mechanism. No change to any view.
- **Surgical.** Outside `design/`, this prompt touches `CLAUDE.md` (one section added) and adds one test file. Nothing in `src/` changes.
- **Goal-driven.** Done when `python3 design/vision-kit.py --check` passes, `npm run audit:design` no longer lists a `vision/dusk/builds-*` test, the new e2e test passes on desktop and mobile, and the baseline table is in the report.

---

## Part 0 · Read and plan

Read, in this order:

1. `design/prompts/bf-series/README.md` and `design/prompts/sv-series/README.md`.
2. `CLAUDE.md` (9 lines at `c177bb0`).
3. `design/vision-kit.py`, lines 1 to 60 and from the line `MANIFEST = json.loads(` (near 14895) to the end. Note how `_MANIFEST` and `_BLOB` are encoded (`base64` then `zlib`, JSON inside).
4. `design/reference/vision/index.json` and `design/reference/vision/archive/` (it holds `index.json` and `openbuilds.html` at `c177bb0`).
5. `e2e/audit/design-compare.spec.ts`, the header comment and the `BOARDS` constant.
6. `git log --oneline -- design/reference/vision/archive design/vision-kit.py design/reference/vision/index.json` (fetch more history first if the clone is shallow: `git fetch --depth=400 origin main`). Open the commit that created `archive/` and read its whole diff.

Write `Assumptions`, answering each of these from the files:

- A1. How did that commit retire the OpenBuilds board? List every file it changed and what it did to `_MANIFEST` and `_BLOB` in `design/vision-kit.py`.
- A2. Does anything outside `design/` read the three Builds boards by name? Run `grep -rn "builds-table\|builds-maps\|builds-classification" src e2e scripts design/scripts package.json` and list every match with what it does.
- A3. Do the dev pages `/dev/kit/pages/vision-builds-table`, `-maps` and `-classification` depend on the boards being in `index.json`, or only the compare does?
- A4. Is `e2e/tier1/builds-site-frame.spec.ts` the only tier 1 spec that opens `/builds`? What does it assert?

Write the `Plan`. If A1 cannot be answered (the commit cannot be found, or its method cannot be repeated without a tool that is not in the repository), do not invent a method: skip Part 2, say so in the report under `Questions for Miles`, and carry on with Parts 1, 3 and 4.

Commit: `BF-00 P0: plan`.

## Part 1 · The series in the repository

1. Confirm every file of this series is at `design/prompts/bf-series/`: `README.md` and `BF-00` to `BF-15`. If the session was handed them some other way, put them there unchanged.
2. Add one section to the end of `CLAUDE.md`, matching the two sections already there in tone and length:

   ```
   ## BF series (Builds filters)

   The prompts **BF-00 to BF-15** are in `design/prompts/bf-series/`: `README.md` holds the order, the rules, the design spec and the table of every fix, and each prompt is `BF-nn-<name>.md`. When asked to run "BF-01", "bf 1" or similar, open the file with that number and follow it. For the Builds pages the BF README's design spec replaces the three Builds vision boards, which BF-00 retired.
   ```

3. Change nothing else in `CLAUDE.md`.

Verify: `ls design/prompts/bf-series | wc -l` prints 17.

Commit: `BF-00 P1: series in the repo`.

## Part 2 · Retire the three Builds boards

Only if A1 was answered. Repeat the OpenBuilds retirement exactly, for `builds-table`, `builds-maps` and `builds-classification`:

1. Move `design/reference/vision/dusk/builds-table.html`, `builds-maps.html` and `builds-classification.html` to `design/reference/vision/archive/`.
2. Move their three entries from `design/reference/vision/index.json` to `design/reference/vision/archive/index.json`, each entry unchanged.
3. Do to `design/vision-kit.py` whatever the OpenBuilds commit did, so that running the kit never writes the three boards back and `--check` passes. Update the kit's header comment (the count of boards and of files, and the sentence about what was retired) the way that commit did.
4. Leave `design/reference/vision/source/Builds.dc.html`, `BuildsMaps.dc.html`, `BuildsClassification.dc.html` and `design/screens/vision/builds-*.png` wherever the OpenBuilds commit left the matching OpenBuilds files. Do not delete a file that commit did not delete.
5. If A2 found a test or script that reads a Builds board by name, change that reference the way the OpenBuilds commit changed its own, and list it in the report.

Verify, in order:

- `python3 design/vision-kit.py --check` exits 0.
- `python3 design/vision-kit.py` then `git status --porcelain design/` shows nothing new (the kit does not write the three boards back).
- `npm run audit:design 2>&1 | grep -c "vision/dusk/builds-"` prints 0.
- `npm run audit:design` shows no board with a larger difference than on main. Give both numbers for every board in the report.
- The three dev pages still load: `npx playwright test e2e/audit --grep "vision-builds"` if such a test exists, otherwise open each in the audit harness and confirm `data-design-ready="true"`.

Commit: `BF-00 P2: retire the Builds boards`.

## Part 3 · One end to end file for the series

Create `e2e/tier1/builds-filters.spec.ts`. Copy the imports, the fixture use and the way of opening a page from `e2e/tier1/builds-site-frame.spec.ts`, so it runs under the same projects with the same stubs. One test for now:

- `builds: the page opens with its table` · go to `/builds`, expect `getByTestId("builds-page")` and `getByTestId("builds-table")` to be visible, and expect `getByRole("navigation", { name: "View" })` to hold three links named Table, Maps and Classification.

Do not assert anything about the filter rail here. Later prompts add their own tests to this file.

Verify: `npx playwright test e2e/tier1/builds-filters.spec.ts --project=desktop --project=mobile` passes.

Commit: `BF-00 P3: e2e file for the series`.

## Part 4 · The baseline

Run on the branch, with nothing else changed, and put the output numbers in the report:

1. `npm test`: the count of test files and tests, and that all pass. Separately, the count of tests in each file under `src/pages/site/builds/` (`grep -c "^\s*it(\|^\s*test(" src/pages/site/builds/*.test.ts*`). At `c177bb0` they were 11, 17, 34, 15, 5, 34, 12 and 9.
2. `npm run audit:pages`: the request rounds and the number of requests for `/builds`.
3. `npm run audit:perf`: LCP, CLS and the INP proxy for `/builds`.
4. `npm run audit:contrast` and `npm run audit:themes`: pass or fail, and any failure that names a Builds file.
5. `npm run build`, then the size lines `scripts/check-size.mjs` prints.

No commit: nothing changed.

---

## Not in this prompt

- Any change under `src/`.
- Redrawing a board, or writing a new one.
- Changing `MAX_DIFF` or adding a skip list to the compare.

## Report

The BF README's report. Add: the answer to each of A1 to A4, and the baseline table from Part 4.

## What Miles needs to do

Merge. Press Publish › Publish changes. If Part 2 was skipped, answer the question in the report before BF-06 runs: BF-01 to BF-05 do not move the rail and can run meanwhile.
