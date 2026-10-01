# UI-P27 — Page: Home

Follow `design/RULES.md` (the page pattern is §7).

**Goal.** `/` rebuilt as the reference Home: hero with the tagline, the visitors' book, two orbs, this week's challenges, the streak and where next.

**Read first.** `pages/Home.tsx`, `feed/FeedShell.tsx`, `BuildsTab.tsx`, `BuildFeedItems.tsx`, `src/lib/feed/getBuildFeed.ts` — verified: it calls the RPC `get_build_feed(before, page_size)` with keyset paging and item kinds `build | rebuild | repro_note | bounty`. **It takes no scope argument.** Read it, and read `FeedShell` / `BuildsTab` for whether a Following scope exists at all — `progress/ThisWeek.tsx`, `lib/progress/weekly.ts` (`WEEKLY_CHALLENGES`, `getMyWeekEvents`, `weeklyProgress`, `weekStartUtc`), `streaks/*` and `getStreakDays`, the UI-P21 and UI-P25 functions, `design/HANDOFF.md` §5.1.

**Reference.** `design/reference/desktop/{noon,dusk}/home.html`, `design/reference/mobile/{noon,dusk}/home.html`.

**Data → props.** Feed pages from `getBuildFeed()` with its real arguments; `countLitToday()`; `countReproducedToday()`; `countRunsThisWeek()`; challenges from `WEEKLY_CHALLENGES` + `weeklyProgress(getMyWeekEvents())`; the current week's days from `getStreakDays`; `getWhereNextForViewer(userId)`. Signed out: no challenges, streak or where-next panels' data — each shows its empty state (below).

**Desktop.** Grid `minmax(0, 1fr) 420px`, gap 12, filling the 820px board.
- **Left column** (gap 12):
  1. **Hero** — height 340. `Panel` glass, padding 22px 24px, `position: relative`. Behind the content, filling the panel: the hero art — `CoverFallback` with sky 0 (fixed brand artwork, not a build) — and a scrim `linear-gradient(90deg, var(--scrim) 0%, transparent 60%)`. Content: a full-height column, `space-between`:
     - a row, `space-between`, centred: `Segmented` (34/12) **Following · Everyone**, and the lit badge. The control binds to the feed scope **only if the feed already supports one**; the RPC takes none today, so unless `FeedShell` has a scope, render the control with Everyone selected and Following disabled (`aria-disabled`, title "Following is coming") and note it in the report rather than inventing a scope parameter or filtering client-side. Signed out, Following goes to `/login?redirect=/`. The lit badge: — padding 6px 10px, radius 12, background `--media-tag`, gap 8px, DM Mono 11px `--text`: `LampDot` + "{n} builds lit today";
     - `Tagline` 46, offsets 0 / 90 / 30: "Every AI build," / "hung with" / "its proof." The chips are `aria-hidden`; the page's `h1` is the same sentence, visually hidden;
     - a row, gap 8px: `Button` primary 36/13 "Enter the gallery" with `ArrowRight` → `/gallery`; `Button` secondary 36/13 "How proof works" → the existing page that explains reproduction (`/about` unless a more specific route exists).
  2. **The visitors' book** — fills. `Panel` padding 14px 16px. `PanelHead` "The visitors’ book" / "Builds, rebuilds, reproduction notes and asks — newest first", right: `Segmented` 30/11 **All · Builds · Rebuilds · Notes · Asks** (filters the loaded items on `kind`, client-side). Rows, 10px below, one per item:
     - grid `92px 30px minmax(0, 1fr) 84px 32px`, gap 12, centred, padding 9px 12px, radius 14, 1px bottom border `--hairline`;
     - kind label, DM Mono 10px, .07em, caps: BUILD `--lit-ink`, REBUILD `--cat-agents`, REPRO NOTE `--evidence`, BOUNTY `--cat-breakage`;
     - `Avatar` 28;
     - a column, gap 3px: the who-line (Figtree 12px `--text2`, one line, ellipsis) — "@maker hung", "@maker rebuilt {source title} →", "@maker ran {title} on {model} — “{note}”", "@maker opened an ask · {part} · £{reward}"; the build title in `type.display(20)`, −0.02em, line-height 1; `Plaque` at row size (tag 9 → 10px, text 10px);
     - cover thumbnail 84×54, radius 10 (`resolveCover` or `CoverFallback`);
     - relative time, DM Mono 10px `--label`, right-aligned.
     The first row gets background `--row-highlight` and a transparent bottom border when it is newer than the viewer's previous visit (a per-browser timestamp in `localStorage` under `bg-home-seen`, read and written in try/catch). Each row links to its build (bounty rows to the bounty). Live: keyset paging continues below with a secondary 34/12 "Show more" button.
- **Right column** (gap 12):
  1. **Orbs** — height 180. `Panel` padding 12px; a centred row, gap 12: `OrbGlass` 150 "Reproduced today" / "{n} runs"; `OrbSolid` 150 "This week" / {n} / "runs reported".
  2. **This week's challenges** — height 230. `Panel` padding 14px 16px. `PanelHead` "This week’s challenges" / "Resets Monday 00:00 UTC", right: `IconButton` 34 `Maximize2` "Open this week" linking to the full `ThisWeek` view if a route exists (omit the button otherwise). One row per challenge: column, gap 7px, padding 10px 0, 1px bottom `--hairline`; a row with the title (Figtree 13px `--text`) and "{done} / {target} · +{xp} xp" or "{done} / {target} · done" (DM Mono 11px `--text2`, no wrap); `StripedBar` height 9 at done/target — colour by meaning: running builds `--lit`, solving a gap `--action`, re-confirming `--evidence`.
  3. **Streak** — auto height. `Panel` padding 14px 16px. A row, `space-between`: `PanelHead` "{n}-day streak" / "one frozen day used" ("no frozen days used", "{k} frozen days used"), and `Flame` 22 in `--lit-ink`. 12px below, a row `space-between` of seven columns (Mon–Sun of the current UTC week), each a centred column with gap 6px: active day `LampDot` 20×12; frozen day a 20×12 ellipse with a 1.5px `--evidence` border; other days a 20×12 ellipse with a 1.5px dashed `--line` border; the day letter in DM Mono 10px `--label`.
  4. **Where next** — fills. `Panel` padding 14px 16px. `PanelHead` "Where next" / "From what you ran this week". Rows 6px below: flex, gap 10, padding 7px 0, 1px bottom `--hairline`: a 34×34 cover (radius 8); a column (title Figtree 13px `--text` ellipsis; reason DM Mono 10px `--label` caps — "SAME TOOL · SONNET-4.5", "REBUILT FROM ONE YOU RAN", "MORE FROM @INES"); `Sparkline` 54×18.

**Mobile** (board 390×1640), in this order, gap 12:
1. A row `space-between`: `Segmented` 36/13 Following · Everyone; the lit badge — padding 7px 10px, radius 12, background `--glass-2`, 1px `--line`, DM Mono 11px — `LampDot` + "{n} lit today".
2. Hero `Panel` padding 16, height 270: the same art; scrim `linear-gradient(180deg, transparent 30%, var(--scrim) 100%)`; a `space-between` column: `Tagline` 30 (0 / 44 / 14) and one `Button` primary 42/14 "Enter the gallery".
3. The two orbs, no panel: a centred row, gap 12, padding 4px 0: `OrbGlass` 162, `OrbSolid` 162.
4. Challenges `Panel` padding 14px 16px 6px: rows with padding 11px 0, title Figtree 14px, "{done}/{target}" DM Mono 11px, `StripedBar` 9.
5. The visitors' book `Panel` padding 14px 12px: `PanelHead` "The visitors’ book" / "Newest first"; a `ScrollRow` (gap 6, margin 10px −4px 0) of `FilterChip`s All · Builds · Rebuilds · Notes · Asks; rows 8px below: grid `minmax(0, 1fr) 72px`, gap 12, padding 12, radius 14, bottom `--hairline` (highlight as desktop); left column gap 5: a line with `Avatar` 22, the kind label (DM Mono 10px) and "· {time}" (DM Mono 10px `--label`), gap 8; the who-line (Figtree 12px `--text2`); the title `type.display(20)` line-height 1.05; `Plaque` row; right: a 72×72 cover, radius 10.
6. Streak `Panel` as desktop.
Phones do not show Where next (as drawn).

**Empty states.** Feed: "Nothing hung yet." + "Enter the gallery". Challenges signed out: "Sign in to take this week's challenges." + "Sign in". Streak with no days: "Run a build today to start a streak." Where next with no runs this week: "Run a build this week and suggestions appear here." + "Enter the gallery".

**Done when.** The four Home boards compare within 0.04 (differences limited to RULES §7's list); tier1 specs that visit `/` pass with the flag off and with `?frame=site`.

**Commit.** `UI-P27: Home in the site frame`
