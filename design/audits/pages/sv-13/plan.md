# SV-13 · Builds: Classification · plan

## Assumptions (checked on disk at b819ca8, SV-12 merged)

- `BuildsClassificationView.tsx` is the SV-11 stub ("Not built yet"); `buildsViews.ts` lazy-loads it as its own chunk and `prefetchView("classification")` already starts it from the view switch. Kept as is.
- `listBuildsTable` already selects `classification` and maps it to `BuildsTableBuild.classifiedAs` (absent when the build has none). The view needs no read of its own: the page hands it the builds it holds.
- `FACET_LABEL` and `FACETS` (`taxonomy.ts`) give the 15 facets in the order field, task, setting, built, role, technique, modality, method, autonomy, stack, data, oversight, age, skill, cost. The board's default eight (Field, Task, What was built, Techniques, Autonomy, Tools and stack, Data handled, Cost to run) are in that order.
- `shownValues` returns the values and `Provenance`, but folds a dispute into "stated". The board needs "corrected", so the model reads `disputes[facet].values` itself.
- A facet link is `?f=<facet>:<id>` (`cleanFacetKeys`), and a link to the Table drops `view`. A custom value has no id and cannot be a filter, so it is text.
- Which facets `derive.ts` fills: built, role, technique, modality, method, autonomy, oversight, skill, cost, stack. Declared only: field, task, setting, data, age. "Data handled" is declared only, so it reads "stated" (the board agrees). Tools and stack is derived and may also hold the maker's own entries (`declared.stack`), shown after the derived ones.
- `derived.from` holds tile ids, so "from n tiles" is `from.length`. A derived facet with no tile ids reads "derived" rather than "from 0 tiles".
- The Table (SV-11) has the `view` param in the address and `keepPreviousData` on the list, so a value link is the same page with a new parameter.
- The page already loads classification, lens counts, stats and facets in one round; the view adds none.

## Plan

- Part 1: `classificationModel.ts` (facet choice in `builds:facets:v1`, card from a build, provenance, links), `BuildsClassificationView` (head, controls, grid of cards, chooser), page wiring, fixture and dev page `vision-builds-classification` -> verified by: `classificationModel.test.ts`, `BuildsClassificationView.test.tsx`, `BuildsPage.test.tsx`.
- Part 2: compare against the board and the audits -> verified by: `npm run audit:design -- --grep "vision/dusk/builds-classification"` within 4%, `npm run audit:pages`.
