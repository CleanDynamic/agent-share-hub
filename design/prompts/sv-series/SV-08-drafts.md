# SV-08 · Drafts

One Claude Code session on `CleanDynamic/agent-share-hub`, default branch.

**Order.** After SV-07, before SV-09. Read the series README (`design/prompts/sv-series/README.md`) first: its How to work, Pages, Motion limits, Performance and Database rules, and its Report apply. Pull main first. Lovable commits straight to main. Branch `sv-08-drafts`. Commit at the end of every part with the part number in the message. Open one pull request titled `SV-08 Drafts` at the end.

The facts here were checked on 25 October 2026, at `6b8fe91`, before SV-01 to SV-07 merged. **The file on disk wins.**

## Intent

Drafts keeps what it does and takes the site's layout. It must match `design/reference/vision/dusk/drafts.html`.

## Source

- Board: `design/reference/vision/dusk/drafts.html`, picture `design/screens/vision/drafts.png`, sample data in `design/reference/vision/source/Drafts.dc.html`.
- Today: `src/pages/site/drafts/DraftsView.tsx`, `DraftsPage.tsx`, `draftsModel.ts`; `src/lib/build/drafts.ts` (`listDraftsWithSessions`); `src/hooks/useLibrarySessions.ts` (the Sessions list).

## What earlier prompts left here (keep all of it)

- **SV-03:** the drafts list is one request (`id, title, updated_at, session_count`); New build no longer leaves an empty draft; `Remove empty drafts (N)` sits at the foot of the list, behind CA-20's confirm window; Your sessions loads alongside the drafts, never before; the route table entry and `usePageReady("drafts")`.
- **SV-04:** the route's `Placeholder`, the match test, `PageLink` on draft rows, Back keeps the scroll.
- **SV-05:** counts include every session.
- **SV-07 and the series decision:** a session row is named by its first prompt, a Claude Code summary turn is skipped for the name, and the detail line reads `<tool> · <model> · <date> · in n drafts` (`No app chosen` first when the tool is unknown).

The board doesn't draw `Remove empty drafts`; keep it, in the board's row style, after the last draft row. The board's sample shows a summary turn as a title; the live page follows SV-07.

## Layout (exact values are in the board)

- Surface padding `40px clamp(16px, 5vw, 76px) 0`. Head: "Drafts" 20/500, "Pick up a build, or start one from a session." in `--text2`; Connect a tool (control) on the right.
- 48 below: columns `minmax(0, 1fr) 400px`, 72 apart; below 1100px one column.
- **Continue editing:** `SectionHead` "Continue editing", "n drafts · latest first". 16 below, Start a new build: a page-width `DashedSlot` (radius 8, 52 high, padding `0 16px`) with a plus and "Start a new build", and "or drop a session here" on the right; it is the drop target it is today. Then rows 56 high: title 500 (an untitled draft in `--text2`), "n sessions" in 12 `--label`, "edited <age>" on the right, a chevron. Show more (control) below.
- **Sessions:** `SectionHead` "Sessions", "n imported · drag one into a draft", "How they get here" as an underlined link on the right. Rows 56 high: grip, model mark, title, the detail line in 12 `--label`, a 28 `+` named "Start a build from this session". Dragging works as it does today.
- **Connected tools:** the page's one `InnerTile`: "Connected tools" and Manage, then one row per tool with its last import date.
- **Phone:** one column: Continue editing, then Sessions, then Connected tools.

## Rules for this prompt

- **Vercel rules:** `rerender-no-inline-components`, `client-passive-event-listeners`, `rerender-use-ref-transient-values` (the session drag keeps the pointer in a ref, and its listeners are passive unless they call `preventDefault`).
- **Motion:** none added. Dragging keeps its current behaviour. Show more adds rows at once.

---

## Part 0 · Read and plan

1. Read the files above and SV-03's, SV-04's and SV-07's changes to them.
2. Confirm the import rows record the tool and the import time. If they don't, the Connected tools tile is left out and the report says so.
3. Write `Assumptions` and `Plan`.

Commit: `SV-08 P0: plan`.

## Part 1 · Behaviour first

Failing tests for every behaviour Drafts has today, run against the new view: open a draft, start a new build, drop a session on Start a new build, `+` on a session, drag a session into a draft, Show more, Remove empty drafts.

Commit: `SV-08 P1: Drafts behaviour tests`.

## Part 2 · View and data

1. Restyle `DraftsView` to the board. Behaviour, copy and data are unchanged, except the session naming above.
2. The route's `Placeholder` becomes the new page's loading state (`LoadingBlocks` sized like the rows), and SV-04's match test stays green.
3. The dev page `vision-drafts` renders the fixture from `src/dev/fixtures/vision/drafts.ts`.
4. `npm run audit:pages`: Drafts stays at 1 request round.

Commit: `SV-08 P2: Drafts in the site layout`.

## Part 3 · Compare

`npm run audit:design -- --grep "vision/dusk/drafts"` within 4%, with the Remove empty drafts row hidden on the dev page. List every remaining difference.

Commit: `SV-08 P3: compare and checks`.

---

## Report

The README's report.

## What Miles needs to do

Merge, then Publish › Publish changes. No migration.
