# SV-17 · Saved items below build size, and collection kinds

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After SV-16, before SV-18. SV-18 (Add from Library) inserts what this prompt saves, and switches the composer's window on. Read the series README (`design/prompts/sv-series/README.md`) first: its How to work, Pages, Motion limits, Performance and Database rules, and its Report apply. Pull main first. Lovable commits straight to main. Branch `sv-17-saved-items`. Commit at the end of every part with the part number in the message. Open one pull request titled `SV-17 saved items` at the end.

The facts here were checked on 25 October 2026, at `6b8fe91`, before SV-01 to SV-16 merged. **The file on disk wins.**

## Intent

A reader can save a part, a session, a step, a request or a filter set, not only a build. Library lists them and collections hold them.

## Rules for this prompt

- **Vercel rules:** `async-parallel` (Library's kinds and counts start together), `js-set-map-lookups` ("Used in" counts grouped with one map).
- **What a snapshot holds** follows the rules that already exist for copying: `forkRules` for a step, `addSession` for a session. Never run costs, trace URLs or anything a fork doesn't copy.
- **Privacy.** A saved item is private to its saver. Nobody else reads it, including the source's maker.
- **Motion:** a Save control changes its glyph at once, as Like and Save do today.

---

## Part 0 · Read and plan

Read `build_saves` and its trigger on `save_count`, `collection_items` and its `item_kind` check (the live check allows `blueprint|blog|bounty|stage|block` and `build`; confirm against the live schema), `src/lib/library/builds.ts`, `forkRules.ts`, `addSession.ts`, and SV-09's Library view. Write `Assumptions` and `Plan`.

Commit: `SV-17 P0: plan`.

## Part 1 · Schema

A migration file:

- `saved_items`: `id`, `user_id`, `kind` (`part | session | step | request | filter_set`), `build_id`, `ref` (node id, session key, part key, bounty id, or null for a filter set), `snapshot jsonb`, `source_version text null` (SV-19 fills it), `note text null`, `created_at`, `last_used_at`. Unique `(user_id, kind, build_id, ref)`. Index `(user_id, kind, last_used_at desc)` with its `EXPLAIN` note. Policies with `(select auth.uid())`: the owner reads and writes their rows; nobody else reads them.
- `collection_items`: `item_kind` also accepts `part | session | step | request | filter_set`; add `saved_item_id uuid null`, `position int null`, `note text null`.
- Builds stay in `build_saves`, so `save_count` keeps working.

Write the file and the Lovable message; do not apply it.

Commit: `SV-17 P1: saved items schema`.

## Part 2 · Save and snapshot

1. Failing tests first: saving a step stores its method as `forkRules` copies it (no `build_cost`, `run_cost`, `trace_url`); saving a session stores prompt text, model and source only (the `addSession` rule); a draft's content can't be saved; saving twice is not an error; another reader can't read the row.
2. `saveItem`, `unsaveItem`, `listSavedItems({ kind, sort, limit, after })` in `src/lib/library/savedItems.ts`, query keys `['library', '<fn>', ...args]`. Sorts: last used, saved, changed, name.

Commit: `SV-17 P2: save, snapshot, list`.

## Part 3 · Library

1. Library's Parts, Sessions, Steps, Requests and Filter sets kinds go live (SV-09 built their sections); notes save; "Start a build from this collection" makes a draft from the collection's items in order, each inserted as SV-18 inserts, so it arrives with that prompt.
2. "Used in n builds": a count of tiles whose `source_ref` points at the source, read for the page in one request, with an index on `source_ref` if none exists (its `EXPLAIN` note in the migration). Shown on the saved item.
3. Saved-by count on a public collection (the board draws "saved by n"): a count of readers who saved that collection. Add `collection` to `kind` for it, and show it as the board does.
4. `npm run audit:pages`: Library keeps its one-round target.

"Start a build from this collection" ships with SV-18; until then it isn't drawn on the live page.

Commit: `SV-17 P3: saved items in Library`.

---

## Report

The README's report.

## What Miles needs to do

Merge. Apply the migration through Lovable with the message the report gives, and run its `EXPLAIN`. Publish › Publish changes.
