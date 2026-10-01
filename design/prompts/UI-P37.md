# UI-P37 — Every state: loading, empty, error

Follow `design/RULES.md`.

**Goal.** The references show full pages. This gives every panel built in UI-P27 to UI-P36 its other three states, in the same grammar, so nothing ever shows a spinner, a blank box or a raw error.

**Read first.** Every `*View.tsx` and `*Page.tsx` from UI-P27 to UI-P36; how TanStack Query is configured in `src/main.tsx` or `App.tsx` (retries, `staleTime`); any existing skeleton or error component in the repo (reuse it if there is one).

**Build** three small primitives in `src/components/brand/`, then use them everywhere:
1. **`Skeleton`** (`width`, `height`, `radius = 8`) — background `--recess`, no animation under `prefers-reduced-motion`, otherwise a 1.4s opacity pulse between 1 and .55 (opacity only; the keyframe is the one thing that goes in `src/index.css`). A skeleton is **the same size as the content it replaces**, so a loading page has the reference's layout: card skeletons in the wall grid, row skeletons at the row height, an orb skeleton as a circle of the orb's diameter, a chart skeleton as a `--recess` block of the chart's box. Panels, their heads and their padding render normally while loading — only the content inside is skeletal. Each loading region carries `aria-busy="true"` and a visually hidden "Loading {what}".
2. **`EmptyState`** (`line`, `action?`) — a centred column, gap 12, padding 28px 20px: one sentence in `type.display(20)` `--text`, and at most one `Button` secondary 36/13. No illustration, no icon. The lines, per panel:
   - Feed: "Nothing hung yet." + "Enter the gallery" · Gallery wall: "Nothing here yet." + "See all builds" · Facets with no counts: hide the group · Challenges (signed out): "Sign in to take this week's challenges." + "Sign in" · Streak: "Run a build today to start a streak." · Where next: "Run a build this week and suggestions appear here." + "Enter the gallery" · Anatomy: "This build has no parts yet." · Timeline: "No events were kept for this build." · Solutions: "No solutions yet." · Top solvers: "Nobody has solved a bounty yet." + "See open bounties" (the live site's wording) · Bounty frames: "No open asks right now." + "Enter the gallery" · Works: "No builds hung yet." · Activity: "All caught up." · Family: "This build has no rebuilds yet." · Change list: "Nothing has changed yet." · Import parts: "Nothing to keep was found in this conversation."
3. **`ErrorState`** (`line`, `onRetry`) — a column, gap 10: one sentence in Figtree 14px `--text` ("That didn't load."), the panel's name in DM Mono 11px `--label`, and a `Button` secondary 34/12 "Try again" calling the query's `refetch`. Never show an exception message, a stack or an id; log the real error to the console once. A failed page shell (header, breadcrumb, footer) still renders — the error lives inside the panel that failed, and one failing panel never blanks the page.

**Also.** A signed-out visitor sees every public panel and, in place of a signed-in-only panel, one `EmptyState` with a "Sign in" action — never a disabled control with no explanation. Optimistic actions (reproduce, me too, mark read) show their new state immediately and roll back with an `ErrorState` line inside the panel if the write fails.

**Done when.** `/dev/kit/pages/:page?state=loading|empty|error` renders each state for every page (add the parameter to the dev compare page), with no layout shift between loading and populated at 1440 and 390 in both themes; the populated boards still compare within 0.04.

**Commit.** `UI-P37: loading, empty and error states`
