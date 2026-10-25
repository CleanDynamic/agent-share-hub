# SV-15 · Activity: one read for Home, Library and notifications

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After SV-14, before SV-16. Read the series README (`design/prompts/sv-series/README.md`) first: its How to work, Pages, Motion limits, Performance and Database rules, and its Report apply. Pull main first. Lovable commits straight to main. Branch `sv-15-activity`. Commit at the end of every part with the part number in the message. Open one pull request titled `SV-15 Activity` at the end.

The facts here were checked on 25 October 2026, at `6b8fe91`, before SV-01 to SV-14 merged. **The file on disk wins.**

## Intent

Home's "Since you were last here", Library's changes and (from SV-20) notifications show the same events. One function produces them, so the three places never disagree.

## Rules for this prompt

- **Vercel rules:** `async-parallel` (one query per kind, all at once), `js-set-map-lookups` (events merged and de-duplicated by id with a map).
- **Indexes before speed claims.** Each per-kind query names the index it relies on. If one is missing, the migration adds it with its `EXPLAIN` note (README, Database rules).
- **Private by design.** Events are about the reader's own builds and saves. If SV-03 built the kept cache, these keys are stored only under the signed-in user and cleared on sign out.
- **Motion:** none. The sections show their events at rest.

---

## Part 0 · Read and plan

Read `build_reproductions` (`worked`, `model_used`, `note`, `confirmed_at`, `user_id`), `builds.parent_build_id` and `published_at` (rebuilds), `solutions` (`accepted_at`, `solver_id`, `bounty_id`), `build_saves`, `isStale` and `STALE_AFTER_DAYS`, `readHomeSeen` and `writeHomeSeen`, and the indexes on each. Write `Assumptions` and `Plan`.

Commit: `SV-15 P0: plan`.

## Part 1 · The function

`listActivityFor({ userId, since, limit })` in `src/lib/feed/activity.ts`, query key `['feed', 'listActivityFor', userId, since]`. It returns typed events, newest first:

| Kind | Rule | Seen by |
| --- | --- | --- |
| `run` | a reproduction by someone else of a build the reader made or saved, with worked or not, model, note | maker, savers |
| `rebuild` | a published build whose `parent_build_id` is one the reader made or saved | maker, savers |
| `answer` | a solution on a bounty the reader opened, or on a request the reader saved (from SV-17) | maker, savers |
| `stale` | a build the reader made or saved that passed `STALE_AFTER_DAYS` since `since` | maker, savers |

Each event carries the ids it is about, so the view links to the canonical page. A query per kind, run in parallel, each with named columns and `.limit()`. No new table. Failing tests first, one per kind and one for the `since` boundary.

If an index is missing, the migration for it is written now, with its `EXPLAIN` note.

Commit: `SV-15 P1: listActivityFor`.

## Part 2 · Home and Library

1. Home's left column renders "Since you were last here" from `listActivityFor` with `since = readHomeSeen()`. The meta reads "<age> ago · what others did with your builds". No events: the section is left out. It starts in Home's first round (SV-10), never after it.
2. Library's changes list renders from the same function, limited to saved items, with the counts in its `PageFigure` meta. The kinds `edited` and `removed` are SV-19's.
3. `npm run audit:pages`: Home and Library keep their round targets.

Commit: `SV-15 P2: activity on Home and Library`.

---

## Report

The README's report.

## What Miles needs to do

Merge, then Publish › Publish changes. If the report names an index migration, apply it through Lovable with the message given, and run its `EXPLAIN`.
