# UI-P35 — Page: Activity

Follow `design/RULES.md` (§7).

**Goal.** `/notifications` rebuilt as the reference (it has been in the frame with its old content since UI-P20).

**Read first.** `pages/Notifications.tsx`, `notifications/NotificationRow.tsx`, `NotificationCard.tsx`, `src/lib/notifications/` — verified: notifications are **inserted client-side** (`insertNotification`, `createNotification`, `triggers.ts`), with `resolveTarget.ts` and `types.ts`, and **nothing targets a build yet**, so the kinds this page can show are the ones `types.ts` declares and `notifications.target_type` allows (checked against `blueprint|blog|bounty|stage|block|comment|message|thread|profile`). Read them, use the kinds that exist, and list the drawn kinds that have no data yet under "Not covered" rather than inventing them. Also `getRunsOfMyBuilds` and `countPeopleWhoRanMyBuildsThisWeek` (UI-P26), HANDOFF §5.8.

**Reference.** `desktop/{noon,dusk}/activity.html`, `mobile/{noon,dusk}/activity.html`.

**Kinds.** icon and colour per kind — for the kinds that exist — used on the badge, the filter dot and nowhere else: reproduced `Check` `--evidence`; rebuilt `RefreshCw` `--cat-agents`; solution `Target` `--action`; solved `Trophy` `--lit-ink`; published `Image` `--lit-ink`; comment and reply `MessageSquare` `--text2`; like `Heart` `--text2`; follow `User` `--text2`.

**Desktop.** Grid `minmax(0, 1fr) 400px`, filling. Right track: a column, gap 12 — orbs (**180px**), chart (**190px**), filters (fills).
- **List** `Panel` padding 14px 16px: `PanelHead` "Activity" / "{n} unread · live" ("· live" only while the realtime channel is connected), right ghost 30/12 "Mark all read" with `Check`. Groups by the viewer's local day — Today, Yesterday, Earlier this week, Earlier — each headed by an `Eyebrow` (padding 14px 4px 6px). Rows: grid `14px 38px minmax(0, 1fr) 76px 40px`, gap 12, centred, min-height 64, padding 6px 12px, radius 14; unread rows `--row-highlight` with a `LampDot` 10×7 in the first track; the actor's `Avatar` 34 with the kind badge (absolute right −4, bottom −4, 20×20, radius 7, `--solid`, 1px `--glass-border`, the kind icon 12px stroke 2 in its colour); the text: the who-part in Figtree 13px `--text2` and the build title inline in `type.display(17)` `--text`, then the detail in DM Mono 11px `--label` 3px below; the build's cover 76×46 (radius 9; empty track when there is no build); the time in DM Mono 10px `--label`, right-aligned. A row links to its target and marks itself read.
- **Orbs** `Panel` padding 12: centred row, gap 12: `OrbSolid` 140 "This week" / {n} / "people ran your builds"; `OrbGlass` 140 "Listening" / "live" (while connected; "Reconnecting" / "offline" otherwise).
- **Chart** `Panel` padding 14px 16px: `PanelHead` (13px) "Runs of your builds" / "Last 90 days · dashed line: your rebuild went live" (no second clause when `rebuildLiveIndex` is null); `LineChart` 360×120 10px below.
- **Show me** `Panel` padding 14px 16px: `PanelHead` (14px) "Show me"; rows 32px, 1px bottom `--hairline`, gap 10: an 8px dot in the kind's colour, the kind (Figtree 13px, grows), the count among loaded notifications (DM Mono 11px `--label`). Rows are toggle buttons (`aria-pressed`) filtering the list; none pressed = all.

**Mobile** (390×880), gap 12:
1. Heading: `Eyebrow` "Activity", `h1` `type.display(34)` "{n} unread" ("All caught up" at 0).
2. A `ScrollRow` of `FilterChip`s with counts: All · Reproduced · Rebuilt · Solutions · Comments · Follows.
3. One glass `Panel` per group (padding 14px 8px): the `Eyebrow`, then rows: grid `38px minmax(0, 1fr) auto`, gap 12, padding 12px 10px, radius 14, bottom `--hairline`, unread `--row-highlight`: `Avatar` 36 with the badge; the who-line (Figtree 13px `--text2`), the title (`type.display(19)`, −0.01em, line-height 1.1), the detail (DM Mono 11px `--label`, 3px below); on the right a column, gap 6: the time (DM Mono 10px `--label`) and the unread `LampDot`.
Phones do not show the orbs, chart or filter panel (the chips replace the filter).

**Done when.** The four Activity boards compare within 0.04; new notifications appear live and update the header badge and dock badge; mark-read works per row and for all.

**Commit.** `UI-P35: Activity rebuilt`
