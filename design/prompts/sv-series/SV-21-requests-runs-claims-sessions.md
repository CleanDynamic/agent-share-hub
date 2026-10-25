# SV-21 · OpenBuilds requests: from runs, claims, sessions and parts

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After SV-20, before SV-22. Read the series README (`design/prompts/sv-series/README.md`) first: its How to work, Pages, Motion limits, Performance and Database rules, and its Report apply. Pull main first. Lovable commits straight to main. Branch `sv-21-requests-a`. Commit at the end of every part with the part number in the message. Open one pull request titled `SV-21 requests: runs, claims, sessions and parts` at the end.

The facts here were checked on 25 October 2026, at `6b8fe91`, before SV-01 to SV-20 merged. **The file on disk wins.**

## Intent

Three of the OpenBuilds board's request mechanisms go live: a request opened from a failed run, claims, and requests at session and part size. Each part is one mechanism; build them in order and stop at any part whose premise is false on disk.

## Rules for this prompt

- **Composer writes** (`sessions_meta[key].open`, `workstreams[key].open`) go through SV-07's single-path writers. The ghost row and the new tile menu item join the List through SV-06's animator, labelled with `motion.expect`.
- **Nothing is created on its own.** A request is made only when the maker chooses to.
- **Session copies** follow `addSession`'s rule: prompt text, model and source only.

---

## Part 0 · Read and plan

Read `src/lib/bounty/*`, `gaps.ts`, `src/lib/bounty/solutionRebuild.ts`, `rebuild.ts`, `addSession.ts`, SV-07's writers, SV-14's view, and the live `bounties` schema. Write `Assumptions` and `Plan`.

Commit: `SV-21 P0: plan`.

## Part 1 · Request from a failed run

On a run with `worked = false`, the build's maker (and only the maker) sees "Open a request from this run". It opens the existing gap and bounty flow with the run's note as `gap_problem` and the run linked. Shown on the build page's runs list (SV-25 places it) and on Home's failed run line.

Commit: `SV-21 P1: request from a failed run`.

## Part 2 · Claims

A migration: `request_claims (request_id, user_id, claimed_at, expires_at, fork_build_id null)`, one active claim per request, expiring after 3 days without a change to the fork. Policies with `(select auth.uid())`: anyone reads; the claimer writes their own. Index for the active-claim lookup, with its `EXPLAIN` note. OpenBuilds shows "Claimed by @kit · n days left · fork in progress", and Your claims (SV-14 built both sections).

Commit: `SV-21 P2: claims`.

## Part 3 · Session and part requests

A gap at session or part size: `sessions_meta[key].open` or `workstreams[key].open` with a problem, written through SV-07's writers. The composer's tile menu has Open as a request; the end of a part has an "Ask for the next session" ghost row. Answering is "Offer a session": the contributor picks one of their imports; it is copied by `addSession`'s rule into their fork, and the maker accepts it into the build (credit through SV-16). OpenBuilds' Sessions and Parts tabs go live.

Commit: `SV-21 P3: session and part requests`.

---

## Report

The README's report.

## What Miles needs to do

Merge. Apply each migration the report names through Lovable, in the order given. Publish › Publish changes.
