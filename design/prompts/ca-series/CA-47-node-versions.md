# CA-47 · Node versions: a saved step knows it was edited

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After CA-46, before CA-48. Read the series README (`design/prompts/ca-series/README.md`) first: its How to work, Motion limits, Performance and Database rules, and its Report apply. Pull main first. Lovable commits straight to main. Branch `ca-47-node-versions`. Commit at the end of every part with the part number in the message. Open one pull request titled `CA-47 node versions` at the end.

The facts here were checked on 25 October 2026, at `6b8fe91`, before CA-29 to CA-46 merged. **The file on disk wins.**

## Intent

Library shows `Edited` when a saved step's source changed and `Removed` when it is gone, and offers the saved and current versions. That needs a version on each node.

## Rules for this prompt

- **CA-35's guard is for builds, not nodes.** `staleWrites.ts` checks `builds.updated_at` on a build write, and reads a node inside the write because `build_nodes` has no stamp. If this prompt adds one, check whether `staleWrites.ts` should use it, and change it only if a test shows a gap.
- **Saved copies stay usable** when the source is edited or removed, credited to its maker (the series decision). What happens to copies when the maker deletes their account is reported as a question, not decided here.
- **Motion:** the version switch changes the content at once. Changed lines are marked by colour at rest, with no animation.

---

## Part 0 · Read and plan

Confirm against the live schema whether `build_nodes` has an updated time. Read how the composer writes nodes (CA-35's queue, `EditBuffer`, the restorer) and `staleWrites.ts`. Find what account deletion does to a user's builds today. Write `Assumptions` and `Plan`.

Commit: `CA-47 P0: plan`.

## Part 1 · Version

If there is no updated time: a migration adding `build_nodes.updated_at timestamptz not null default now()` and a trigger that sets it on update (the trigger function follows the README's `SECURITY DEFINER` rules if it needs to be one). A content hash is used instead only if updated times prove unreliable under the restorer (Undo writes rows back with their original ids; that is an update and moves the time, which is correct). Write the file and the Lovable message. `saveItem` stores the time in `source_version`.

Commit: `CA-47 P1: node versions`.

## Part 2 · States and versions

1. Failing tests first: a source edited after the save reads `Edited`; a source deleted or unpublished reads `Removed` and the snapshot stays usable, credited to its maker; the version switch shows the snapshot and the current content, with changed lines marked.
2. `listActivityFor` (CA-43) gains `edited` and `removed`.
3. Add from Library (CA-46) defaults to the saved version and offers the current one.

Commit: `CA-47 P2: edited and removed`.

---

## Report

The README's report, plus: `Copies when a maker deletes their account: (what happens today, and the question)`.

## What Miles needs to do

Merge. Apply the migration through Lovable if the report names one. Publish › Publish changes. Answer the account-deletion question in the report before CA-48 if you can.
