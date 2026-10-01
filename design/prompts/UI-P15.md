# UI-P15 — The vacant frame (bounty card)

Follow `design/RULES.md`.

**Goal.** The bounty card: an empty frame on the wall where one part of a working build is missing, with a reward.

**Read first.** `components/bounty/MissingBlockOverlay.tsx`, `MissingStageBadge.tsx`, `lib/bounty/bounties.ts` (`listOpenBountyCards`, `OpenBountyCard`), `lib/build/gaps.ts` (`gapProblem`).

**Reference.** Section `Build cards` (`data-ui="vacant-frame"`, selected and not); `desktop/*/bounties.html`; `mobile/*/bounties.html`.

**Build.**
1. `PictureLamp` (always `stale`/dimmed on a vacant frame: it marks the missing part, not the build's freshness), then the card: 1.5px dashed `--cat-breakage` border, radius 14, padding 7px, background `--glass` (selected: `--row-highlight`), `--shadow-card`, column with gap 8px.
2. Cover (104px on desktop and mobile), radius 10, with the **missing window** centred on it: 110×58 (mobile 110×58), radius 10, 1.5px dashed `#F7F8F9` border, background `rgba(14,11,20,.55)`, a centred column in `#F7F8F9`: "MISSING" (DM Mono 10px, .1em) over the part name (Figtree 11px 600, centred). These two colours are fixed because the window sits on artwork, not on the theme. This is `MissingBlockOverlay` restyled.
3. Body, padding 0 5px 5px, gap 7px: a row with the build title (`type.display(18)`, one line, ellipsis) and the reward (DM Mono 18px, `--text`, "£400"); then a row with the gap's `CategoryChip` and "{closes in} · {n} solutions · {m} me too" in DM Mono 10px `--text2`.
4. The card is a link to the bounty's solve view (or selects it on the Bounties page on desktop; see UI-P33).

**Done when.** The two vacant frames in the Build cards section compare within 0.04.

**Commit.** `UI-P15: vacant frame bounty card`
