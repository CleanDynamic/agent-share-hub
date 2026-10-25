# CA-52 · Builds data: filter sets, groups, filter layout, columns

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After CA-51, before CA-53. Read the series README (`design/prompts/ca-series/README.md`) first: its How to work, Pages, Motion limits, Performance and Database rules, and its Report apply. Pull main first. Lovable commits straight to main. Branch `ca-52-builds-data-b`. Commit at the end of every part with the part number in the message. Open one pull request titled `CA-52 Builds data: filter sets and layout` at the end.

The facts here were checked on 25 October 2026, at `6b8fe91`, before CA-29 to CA-51 merged. **The file on disk wins.**

## Intent

The Builds board's last pieces go live: saved filter sets, OpenBuilds groups, and the filter panel's layout and the table's columns. Each part is one mechanism. Part 2 is the least needed: if the session runs short, stop before it.

## Rules for this prompt

- **Vercel rules:** `rerender-use-ref-transient-values`, `client-passive-event-listeners`, `js-batch-dom-css` (dragging and resizing filters: the pointer in a ref, one update per animation frame, all reads before writes, passive listeners unless they call `preventDefault`), `client-localstorage-schema` (layout under a versioned key, `builds:layout:v1`, every read and write in try/catch).
- **Motion:** the filter being dragged follows the pointer with a transform; the others don't animate; on drop the order changes at once. Resizing changes height at once. No library. Each filter can also be moved with Move up and Move down from its grip's menu, so reordering works without a pointer.

---

## Part 0 · Read and plan

Read CA-39's filter panel and table, CA-45's saved items (`filter_set` kind), and the unmounted `guilds` and `guild_members` tables. Decide whether a Group is a public filter set with members or a guild. Write `Assumptions` and `Plan`.

Commit: `CA-52 P0: plan`.

## Part 1 · Filter sets and Groups

1. `filter_sets (id, user_id, name, query jsonb, is_public, created_at)`, migration, policies with `(select auth.uid())`: the owner writes; public sets are read by anyone. Save current, open, rename, delete. Library's Filter sets kind lists them (CA-45 built it).
2. A Group on OpenBuilds is a public filter set with members (`filter_set_members`), or `guilds` and `guild_members` if they fit; Part 0 decides and the report says which. OpenBuilds' Groups section goes live.

Commit: `CA-52 P1: filter sets and groups`.

## Part 2 · Filter layout and columns

1. The panel's order, which filters are open, and each filter's height are dragged and resized, and kept per viewer (in the filter set when one is open, `localStorage` otherwise).
2. The Columns chooser (12 of 24) and the footer's Add a calculation (sum, median, most common) per column, worked out from the loaded page; no request.

Commit: `CA-52 P2: filter layout and columns`.

---

## Report

The README's report.

## What Miles needs to do

Merge. Apply each migration the report names through Lovable. Publish › Publish changes.
