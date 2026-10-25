# SV-13 · Builds: Classification

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After SV-12, before SV-14. Read the series README (`design/prompts/sv-series/README.md`) first: its How to work, Pages, Motion limits, Performance and Database rules, and its Report apply. Pull main first. Lovable commits straight to main. Branch `sv-13-builds-classification`. Commit at the end of every part with the part number in the message. Open one pull request titled `SV-13 Builds: Classification` at the end.

The facts here were checked on 25 October 2026, at `6b8fe91`, before SV-01 to SV-12 merged. **The file on disk wins.**

## Intent

The Classification view shows each filtered build's classification as a card. Every value says where it came from, and every value links to the Table filtered by it. It must match `design/reference/vision/dusk/builds-classification.html`.

## Source

- Board: `design/reference/vision/dusk/builds-classification.html`, picture `design/screens/vision/builds-classification.png`, sample data in `design/reference/vision/source/BuildsClassification.dc.html`.
- Today: `src/lib/classify/types.ts` (`declared`, `derived` with tile ids, `disputes`), `src/lib/classify/facets.ts` (`shownValues` returns the values and their `Provenance`, `regulatedArea`), `src/lib/classify/taxonomy.ts` (`FACET_LABEL`), `src/lib/classify/derive.ts`, `getBuildClassifications(ids)`, `src/lib/classify/storage.ts` (SV-05 tightened its column check).

## Layout (exact values are in the board)

- The page head as the board draws it: "n builds" 20/500 with "Classification of each build · select a value to filter by it" in `--text2`, and the view switch. (No stats line here; the board wins.) Below it: a Filters control, a "Facets shown n of 15" control, and on the right the key "Under each facet: from n tiles, stated by the maker, or corrected by the maker".
- 32 below, a grid of three columns, 24 apart, aligned to the top (two below 1100px, one below 760px). Each card is a module (padding 16): title 14/500, "@maker · Shape" (and " · Regulated area" when `regulatedArea` is true) in 12 `--label`, "n" and the lamp on the right. Then rows, 10 top and bottom with a hairline above: a 112px label column (facet name 12 `--text2`, under it the source in 11 `--label`) and the values as comma-separated links in 12.5 `--text`, underlined on hover with no fade.
- The default eight facets: Field, Task, What was built, Techniques, Autonomy, Tools and stack, Data handled, Cost to run.

## Rules for this prompt

- **Vercel rules:** `client-localstorage-schema` (the facet choice is stored under a versioned key, `builds:facets:v1`, holding only the facet ids), `rendering-content-visibility` (cards past the first screen), `bundle-dynamic-imports` (its own chunk, prefetched on hover of its segment).
- **No second read.** The classifications come from what SV-11 already loaded for the page; this view makes no request of its own unless the list didn't carry them.
- **A value's link** is the same page with a new parameter (`?view=table&<facet key>`): old content stays until the Table's arrives, no fade.
- **Motion:** none added.

---

## Part 0 · Read and plan

Confirm which facets `derive.ts` fills (the boards assume built, role, technique, modality, method, autonomy, oversight, skill, cost and stack) and which are only declared. A facet the board expects as derived but which is only declared shows "stated" or nothing; say which in the report. Write `Assumptions` and `Plan`.

Commit: `SV-13 P0: plan`.

## Part 1 · The view and data

1. Failing tests first: a derived value with three source tiles reads "from 3 tiles"; a declared value reads "stated"; a facet in `disputes` reads "corrected"; selecting a value opens the Table with that facet key in the address; blocked storage falls back to the default eight without throwing.
2. `BuildsClassificationView`, pure. The live page reads the page's classifications from SV-11's load.
3. Facets shown: a chooser of the 15 facets; the choice is kept per viewer in `localStorage` as above (every read and write in try/catch), default the eight above.
4. The dev page `vision-builds-classification` renders the fixture.

Commit: `SV-13 P1: Classification view`.

## Part 2 · Compare

`npm run audit:design -- --grep "vision/dusk/builds-classification"` within 4%. `npm run audit:pages`: the view adds no request round.

Commit: `SV-13 P2: compare and checks`.

---

## Report

The README's report, plus: `Facets derived / declared only: (lists)`.

## What Miles needs to do

Merge, then Publish › Publish changes. No migration.
