# CA-48 · Notifications about builds

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After CA-47, before CA-49. Read the series README (`design/prompts/ca-series/README.md`) first: its How to work, Motion limits, Performance and Database rules, and its Report apply. Pull main first. Lovable commits straight to main. Branch `ca-48-notifications`. Commit at the end of every part with the part number in the message. Open one pull request titled `CA-48 notifications about builds` at the end.

The facts here were checked on 25 October 2026, at `6b8fe91`, before CA-29 to CA-47 merged. **The file on disk wins.**

## Intent

The events `listActivityFor` returns (CA-43) can also reach the bell. Today a notification can't point at a build.

## Rules for this prompt

- **The database notifies, never the client.** Notifications are written by a trigger on the source table. Clients can't be trusted to notify others.
- **Trigger functions** follow CA-29 Part 6: `SECURITY DEFINER` only if needed, `search_path` set, `EXECUTE` revoked from `anon` and `PUBLIC`, and they write only notifications for the build's maker or its savers who turned them on.
- **No self-notification, no repeats.** Nobody is notified about their own action, and one event makes one notification per reader.
- **Motion:** none added to the bell.

---

## Part 0 · Read and plan

Read `src/lib/notifications/` (`insertNotification`, `createNotification`, `triggers.ts`, `resolveTarget.ts`), any existing notification triggers in `supabase/migrations/`, CA-29's function access migration, and the live `notifications.target_type` check (`blueprint|blog|bounty|stage|block|comment|message|thread|profile`). Write `Assumptions` and `Plan`.

Commit: `CA-48 P0: plan`.

## Part 1 · Schema

A migration file: `target_type` also accepts `build`, `node` and `collection`. A per-collection off switch for savers (`collection_items` or `saved_items` gains `notify boolean not null default false`, whichever Part 0 finds fits). Write the file and the Lovable message.

Commit: `CA-48 P1: notification targets`.

## Part 2 · Delivery

1. Failing tests first for each event (`run`, `rebuild`, `answer` on the reader's own builds), for the off switch, for no self-notification, and for one notification per event per reader.
2. The triggers on `build_reproductions`, `builds` (a rebuild published) and `solutions`, in the same migration file or a second one. Saved items notify only if the reader turned it on for that collection.
3. `resolveTarget` opens the canonical page: a build, a tile on the build page, a collection, through `PageLink`.

Commit: `CA-48 P2: notifications about builds`.

---

## Report

The README's report, plus: `Triggers added: (table · function · runs as)`.

## What Miles needs to do

Merge. Apply the migration through Lovable with the message the report gives. Then run the security advisor and paste what it lists into the next session. Publish › Publish changes.
