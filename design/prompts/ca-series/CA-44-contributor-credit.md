# CA-44 · Contributor credit on tiles and sessions

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After CA-43, before CA-45. Read the series README (`design/prompts/ca-series/README.md`) first: its How to work, Motion limits, Performance and Database rules, and its Report apply. Pull main first. Lovable commits straight to main. Branch `ca-44-contributor-credit`. Commit at the end of every part with the part number in the message. Open one pull request titled `CA-44 contributor credit` at the end.

The facts here were checked on 25 October 2026, at `6b8fe91`, before CA-29 to CA-43 merged. **The file on disk wins.**

## Intent

A build can hold work by more than one person. Each tile and each session records who made it, so credit is exact and travels with the method when the tile is copied.

## Rules for this prompt

- **Writers.** `sessions_meta[key]` is written only through CA-35's `making` writers (one path, inside the `serial` queue). Tile writes go through the existing node writers. No new writer.
- **Who may write credit.** Only the build's maker writes their build's rows (the existing policies). Credit is set by the maker's own writers when the maker accepts a solution or inserts from Library; nobody writes credit on someone else's build.
- **Motion:** none. The byline changes at rest.

---

## Part 0 · Read and plan

Read `build_nodes`, `builds.making.sessions_meta`, `fork.ts`, `forkRules.ts`, `src/lib/bounty/solutionRebuild.ts` (the filled tile's credit), `addSession.ts`, `duplicate.ts`, and CA-35's writers in `making.ts`. Confirm against the live schema that `build_nodes` has no contributor column. Write `Assumptions` and `Plan`.

Commit: `CA-44 P0: plan`.

## Part 1 · Schema

A migration file: `build_nodes.contributor_id uuid null references profiles(id)`; null means the build's maker. Sessions record `contributor_id` in `sessions_meta[key]`. The policies are unchanged: only the build's maker writes rows. Index `(contributor_id)` with its `EXPLAIN` note in the header. Write the file and the Lovable message; do not apply it.

The app works before the migration is applied: writers that set `contributor_id` leave it out when the column is missing (`42703` or `PGRST204`, the codes only).

Commit: `CA-44 P1: contributor column`.

## Part 2 · Writers

1. Failing tests first: an accepted solution sets the filled tile's contributor to the solver; an insert from Library (CA-46) sets it to the source tile's contributor or maker; a fork keeps every tile's contributor (credit is method, not evidence); a tile the maker writes leaves it null; a session's contributor is written to its own `sessions_meta[key]` entry and no other.
2. Change only those writers.

Commit: `CA-44 P2: contributor set by its writers`.

## Part 3 · Where it shows

1. The byline on the post, the card and the build page: "<maker> with @kit and @dax" (contributors other than the maker, by number of tiles, at most two named, then "and n more"). The contributors come in the same request as the build's other rows, never a second round.
2. OpenBuilds "Your record": Builds contributed to (distinct builds by others with a tile of yours). Builds maintained is left out until ownership can be handed over; say so in the report.

Commit: `CA-44 P3: contributors shown`.

---

## Report

The README's report.

## What Miles needs to do

Merge. Apply the migration through Lovable with the message the report gives, and run its `EXPLAIN`. Publish › Publish changes.
