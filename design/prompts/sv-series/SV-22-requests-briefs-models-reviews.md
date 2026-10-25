# SV-22 · OpenBuilds requests: briefs, model checks, reviews

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After SV-21, before SV-23. Read the series README (`design/prompts/sv-series/README.md`) first: its How to work, Pages, Motion limits, Performance and Database rules, and its Report apply. Pull main first. Lovable commits straight to main. Branch `sv-22-requests-b`. Commit at the end of every part with the part number in the message. Open one pull request titled `SV-22 requests: briefs, model checks, reviews` at the end.

The facts here were checked on 25 October 2026, at `6b8fe91`, before SV-01 to SV-21 merged. **The file on disk wins.**

## Intent

The OpenBuilds board's remaining pieces go live: briefs, model tests and the model release check, reviews and the weekly goal. Each part is one mechanism; build them in order and stop at any part whose premise is false on disk. Part 3 is the last and the least needed: if the session runs short, stop before it.

## Rules for this prompt

- **Publishing** a brief goes through `missingForPublish` (SV-07 made every publish path check the title).
- **Admin-edited tables** (`model_releases`) are written only by admins: the policy names the admin check the repo already uses.
- **Aggregates** run on the database in one request, with their `EXPLAIN` note.

---

## Part 0 · Read and plan

Read `src/lib/bounty/*`, `rebuild.ts`, `compare.ts`, `getReproductionsByModel`, `weeklyProgress`, `listRebuilds`, `missingForPublish`, the live `bounties` and `builds` schema, and how the repo marks an admin. Write `Assumptions` and `Plan`.

Commit: `SV-22 P0: plan`.

## Part 1 · Briefs

A build marked as a brief (`builds.is_brief`, migration) is a published build of `gap` type tiles. Its answers are its rebuilds (`listRebuilds`). "Compare answers" runs `compare.ts` over the brief's answers, two at a time if `compare.ts` takes two. OpenBuilds' Briefs tab goes live.

Commit: `SV-22 P1: briefs`.

## Part 2 · Model tests and the model release check

1. A model test is a request naming a model on a reproduced build. Its table is `getReproductionsByModel`. The Model tests tab goes live.
2. The model release check: a list of models with release dates (`model_releases`, migration, edited by admins), and an aggregate over `build_reproductions` by `model_used` for builds with `reproduction_count > 0`: works, fails, not tested. One request, started in OpenBuilds' first round. `EXPLAIN` in the header. The section SV-14 built goes live.

Commit: `SV-22 P2: model tests and release check`.

## Part 3 · Reviews and the weekly goal

1. Review: `builds.in_review` (migration) holds a published build out of Builds (`listGallery` and its counts leave it out) until the maker ends the review. Runs and part comments are the review. The Reviews tab goes live.
2. The weekly goal: a site-wide challenge row counting requests closed since Monday 00:00 UTC. The `InnerTile` SV-14 built goes live.

Commit: `SV-22 P3: reviews and the weekly goal`.

---

## Report

The README's report.

## What Miles needs to do

Merge. Apply each migration the report names through Lovable, in the order given, and run each `EXPLAIN`. Add the first model releases as an admin. Publish › Publish changes.
