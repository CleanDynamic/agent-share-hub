# SV-25 plan

## Assumptions (checked on disk at 47674ee)

- `saveItem(input)`, `unsaveItem(id)` exist in `src/lib/library/savedItems.ts`. A saved row is keyed (user, kind, build, ref); there is no read of "what the reader saved in this build", so one is added there.
- `PartCommentMarker` exists, but `AnatomyTree`'s `partComments` prop is passed by no live page (BuildPage's `full` AnatomyTree omits it). The marker is dormant on the live page. Save is added to the same row through its own optional prop and shows when that prop is given; the live surfaces are the reader's session heads and tiles (BuildSteps).
- Tile id = `ReaderStep.id` = `build_nodes.id`. Session key = `chat.key` (matches `sessionSnapshot`).
- Used in: `build_nodes.source_ref->>'node_id'` (SV-17's `idx_build_nodes_source_node`). `saved_items_used_in()` is the caller's own saved items only and cannot serve a public count, so a plain public read of `build_nodes` is used (RLS already hides unpublished builds). No migration.
- In collections: `collection_items.build_id` with `collections!inner(is_public)`, indexed by `idx_collection_items_build`.
- The byline already shows contributors (`build-contributors`, SV-16). Nothing to build.
- NOT on disk: a per-run list on the build page (only `reproduction_count`). Part 3.2 has no surface to sit on: reported, not built. `canOpenFromRun` / `REQUEST_FROM_RUN_LABEL` exist for it.
- The facts strip is the Reproduction column's `proof.details` rows (`proofDetails`).

## Plan

- Part 1: Save marker on session heads, tiles, and (when given) anatomy rows -> verified by: unit test of marker + BuildSteps test.
- Part 2: "Used in n builds" on tiles, "In n collections" row in facts -> verified by: connections lib test, view tests.
- Part 3: classification values link to `/builds?f=facet:id` through PageLink -> verified by: ClassificationSection test. 3.2 not done (no runs list), 3.3 already live.
