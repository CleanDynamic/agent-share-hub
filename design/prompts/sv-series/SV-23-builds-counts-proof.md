# SV-23 · Builds data: stored counts, proof filters, runs per week

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After SV-22, before SV-24. Read the series README (`design/prompts/sv-series/README.md`) first: its How to work, Pages, Motion limits, Performance and Database rules, and its Report apply. Pull main first. Lovable commits straight to main. Branch `sv-23-builds-data-a`. Commit at the end of every part with the part number in the message. Open one pull request titled `SV-23 Builds data: counts and proof` at the end.

The facts here were checked on 25 October 2026, at `6b8fe91`, before SV-01 to SV-22 merged. **The file on disk wins.**

## Intent

The Builds board's structure and proof filters and columns go live. Each part is one mechanism.

## Rules for this prompt

- **Counts come from SV-05's function** and `graph.ts`, so a stored count is the number the composer shows.
- **`builds.session_count` already exists** (SV-03 read it for Drafts). Find what writes it today before adding a writer, and keep one writer.
- **Writes** go with the classification facets, 1.5 seconds after tiles stop changing, through SV-07's queue.
- **Builds keeps one round** (SV-11): new counts and filters come in the list's own request or alongside it, never after it.

---

## Part 0 · Read and plan

Read `gallery.ts` (`listGallery`, the feed params, the `gallery_facets` and `classification_facets` RPCs), `graph.ts` (`buildSteps`, `sessionGroups`), SV-05's numbering and counting functions, how classification facets are written back after tiles stop changing, and what writes `builds.session_count`. Write `Assumptions` and `Plan`.

Commit: `SV-23 P0: plan`.

## Part 1 · Stored counts

A migration: `builds.step_count`, `part_count`, `agent_count` (int), and `session_count` only if it is missing. The composer writes them with the facets. Steps and Sessions columns and range filters go live, with an index for each range filter that needs one (`EXPLAIN` note). Existing builds get their counts written the next time they are saved; the report says how many have none yet, and offers a one-off backfill as a Lovable message if Miles wants it.

Commit: `SV-23 P1: stored counts`.

## Part 2 · Proof filters

1. Reproductions as a range, Rebuilds, Likes, Last confirmed (within n days), Confirmed or stale: build columns that exist.
2. Works on model: builds with a worked run on a chosen `model_used`. One query; counts for the panel in the same request as the facets if the RPC can carry them, else one more alongside.
3. Runs, 12 weeks: per build on the page, runs per week, one request for the page, started alongside the list where the ids allow.
4. `npm run audit:pages`: Builds keeps its round target.

Commit: `SV-23 P2: proof filters and runs per week`.

---

## Report

The README's report.

## What Miles needs to do

Merge. Apply each migration the report names through Lovable, and run each `EXPLAIN`. Publish › Publish changes.
