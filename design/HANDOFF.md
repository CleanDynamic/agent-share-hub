# buildgallery UI overhaul — Noon & Dusk handoff

This file is the written half of the "buildgallery — Noon & Dusk" artifact. The other half is the canvas: two brand boards, eighteen desktop page mockups (nine screens × two themes) and twenty mobile-web mockups (ten screens × two themes). Read both. The mockups show what it should look like; this file says what each piece is made of in the codebase, what already exists, what is new, and what must be decided before a line is written.

Repository: `CleanDynamic/agent-share-hub` (React 18, Vite, React Router, TanStack Query, Tailwind plus inline styles, Supabase via Lovable Cloud, Vitest, Playwright). Live preview: `agent-share-hub.lovable.app`.

---

## 0. Who this is for, and how to use it

This was the brief for writing the prompt series; **that series now exists**, as 42 prompts in `design/prompts/` (section 9). Read this file to understand *what* the design is and how each page maps to the code; read `design/RULES.md` and `design/prompts/00-INDEX.md` to build it.

It is still the brief for writing a *new* prompt — a page the series does not cover, or a revision. The rules such a prompt follows:

1. One discrete change per prompt, one commit per change, message format `UI-Pnn: description` (the repo's existing convention is `NS-Pnn:`; keep the shape, use the new prefix so the overhaul is traceable).
2. Name the files to open first, the existing functions to reuse (section 5 lists them per page), and the files that must not change.
3. Say what "done" looks like, and which checks to run: `npx tsc --noEmit -p tsconfig.app.json`, `npm test`, `npm run build`, the theme guard tests in `src/lib/theme/*.test.ts`, and `npx playwright test e2e/tier1 --project=desktop --project=mobile`.
4. Never let a prompt install a dependency. If one seems needed, the prompt proposes it and stops.
5. Never let a prompt query Supabase from a component. Data access lives in named, typed functions in `src/lib/<domain>/`. Where a page needs data no function returns yet, the prompt adds the function there first, in its own commit.
6. Every number in the mockups is sample data (see section 8). Prompts wire real data or leave a labelled empty state — they never hard-code the sample figures.
7. `design/RULES.md` §8 governs names: where a prompt names a function, component or column that does not exist on disk, the file wins — use the real one, or add it as new work, and never invent a table or widen a policy to make a prompt fit.
8. The repository copy of this kit lives in `design/`: `design/reference/` (standalone HTML for every board, elements marked `data-ui="…"`), `design/screens/` (a JPEG of each), `design/tokens/` (`tokens.json`, `tokens.css`, `token-map.md` — these supersede the token table in section 2 wherever they differ) `design/prompts/` (the prompt series), `design/fixtures/sample-data.json` (the sample content, used only by the dev compare pages) and `design/RULES.md` (the standing rules).

---

## 1. Names: Noon and Dusk

The two themes are now called **Noon** (light) and **Dusk** (dark). "Exhibition" is retired as a name; "light" and "dark" are not used in the UI.

What the rename touches in code:

- `src/lib/theme/semantics.ts` declares `ThemeName = "exhibition" | "dusk"`. Becomes `"noon" | "dusk"`.
- `src/index.css` holds three `:root` blocks (default, `[data-theme="exhibition"]`, `[data-theme="dusk"]` — confirm the exact selectors before editing). The Exhibition block becomes `[data-theme="noon"]` and takes the new Noon values in section 2.
- The theme is one attribute on `<html data-theme="…">`. Any stored preference with the value `exhibition` must be read as `noon` for one release (a one-line migration where the preference is read), so returning visitors are not flipped.
- The theme control label reads **Noon · Dusk · System** everywhere (the mockups show it on the sign-in screen and phone).
- Noon remains the default for a visitor with no stored preference.
- The buildgallery theme skill and every doc that says "Exhibition" should be updated in the same wave, so later prompts do not reintroduce the old name.

---

## 2. Colour: tokens

The token system is two tiers: `primitives.ts` (values) → `semantics.ts` (jobs) → CSS custom properties in `index.css` → `tokens.ts`, whose `t` object is the only thing components import (`t.text`, `t.glassBorder`, `t.onAction`, …). Keep that seam. No component names a hex.

### 2.1 Noon (was Exhibition) — "Birch Mist" forest sunrise

| Token | Noon value | Job |
|---|---|---|
| `--bg` | `#E9EBE7` | page ground (birch bark) |
| `--recess` | `#D7DBD5` | inset surfaces, wells (fog) |
| `--text` | `#1A2320` | primary text, inverse panels (night fern) |
| `--text2` | `#505A55` | secondary text, metadata |
| `--line` | `#C5CAC3` | hairlines, chip borders |
| `--glass` | `rgba(255,255,255,.66)` | glass panels |
| `--glass-2` | `rgba(255,255,255,.55)` | chips, inset groups |
| `--glass-border` | `rgba(255,255,255,.95)` | glass edge |
| `--action` | `#8C3B36` | primary buttons, active tab underline (rosewood) |
| `--on-action` | `#F8F8F6` | label on action |
| `--evidence` | `#256659` | reproduction, "it worked" (spruce) |
| `--evidence-fill` | `#C8E3DC` | reproduction tag fill, with `--text` on it |
| `--lit` | `#D9A441` | the lamp: light only, never text (sun gold) |
| `--on-lit` | `#1A2320` | text on a lamp fill |

Category hues are unchanged (`#9C3E12` instruction, `#0F6B31` configuration, `#1D4ED8` data, `#8F4309` artefact, `#0E635C` evidence, `#565B63` narrative, `#6D28D9` agents, `#B91C1C` breakage, `#BE185D` media).

Measured contrast on Noon (WCAG 2.2, script-verified): text/bg 13.41 · text/glass 14.84 · text2/bg 5.96 · text2/glass 6.60 · text2/recess 5.11 · action/bg 6.26 · on-action/action 7.07 · evidence/bg 5.60 · text/evidence-fill 11.86 · text/lit 7.15 · every category hue on bg ≥ 5.03. Lamp/bg is 1.87 — that is why the lamp is never type.

### 2.2 Dusk — unchanged

Dusk keeps its current values (`--bg #1F1B2B`, `--recess #372F4A`, `--text #EEEAF4`, `--text2 #B3ABC6`, `--action #D98C6B`, `--evidence #86BDD3`, `--lit #D9A441`, …) and its measured pairings.

### 2.3 New tokens the mockups need

The overhaul adds surfaces that no current token names. Add each to `TOKEN_NAMES`, to both theme objects and to every `:root` block (the compile-time `Record<TokenName,…>` enforces both themes):

| New token | Noon | Dusk | Used by |
|---|---|---|---|
| `--backdrop` | birch horizon gradient (see Brand board) | mostly deep aubergine (`#241C33` → `#1F1829` → `#1A1523`), with a violet and salmon glow only up by the arc | the page background |
| `--header` | `rgba(249,250,248,.50)` | `rgba(13,10,20,.60)` | the sticky site header and footer (glass) |
| `--header-border` | `rgba(255,255,255,.92)` | `rgba(238,234,244,.16)` | header and footer edges |
| `--slab` | `rgba(255,255,255,.68)` | `rgba(31,27,45,.66)` | content panels on the page |
| `--slab-border` | `rgba(255,255,255,.95)` | `rgba(238,234,244,.12)` | panel edges |
| `--tab` | `rgba(255,255,255,.82)` | `rgba(238,234,244,.10)` | raised chips: part-viewer tab, selected states |
| `--field` | `rgba(255,255,255,.72)` | `rgba(238,234,244,.07)` | search and inputs |
| `--inverse` / `--on-inverse` | `#1A2320` / `#F8F8F6` | `#F7F8F9` / `#1B2026` | hero plate, "No. 01" square |
| `--arc-1/2/3`, `--arc-haze` | `#8FA79B`, `#E3A594`, `#8C3B36`, `#F1D5CB` | white core, `#CBC6E4`, `#D98C6B`, `#8C78C4` | the horizon arc |
| `--shadow-card` | ink-tinted, low alpha | near-black, higher alpha | elevation |

`--card-frame` / `--card-thread` (the card pair described in `semantics.ts`) keep their meaning: the frame is the record, the thread box is lighter in both rooms. The mock card is that pair repainted.

### 2.4 One accessibility change

The theme skill puts the focus ring in `--lit`. On Noon (and on the old Exhibition ground) the lamp gold measures under 2:1, below the 3:1 floor for UI state. Change the focus ring to 2px `--text` with a 2px `--bg` offset in Noon; keep `--lit` in Dusk, where it clears 7:1. This is a one-token change in `src/lib/theme/focus.ts`.

---

## 3. The frame — the largest structural change

### 3.1 What exists

`src/components/AppShell.tsx` (nav list `allNavItems`, drawer and mobile bottom-nav handlers) mounts `src/components/shell/FlatShell.tsx`, which lays out `.fs-frame` (max 1200px; wide mode 1600px under `.fs-wide`), a 240px left nav, a 634px centre and a 300px right rail from `flat-shell.css`. `src/lib/…/wideRoutes.ts` decides which routes go wide. Phone chrome is `MobileTopBar`, `MobileBottomNav`, `ProfileDrawer`, `RightRailDrawer`. `ShellHeader`, `PageHeader`, `NavSearch` and `WorkspaceBar` live in `components/shell/`.

### 3.2 What the mockups show — a website, in the browser

**buildgallery is a website.** It lives in the visitor's own browser, which already supplies tabs, an address bar, back and forward. Each desktop board draws that browser across the top (a tab with the page title and the address, e.g. `buildgallery.ai/gallery`) purely so the page is read in context. **That strip is presentation only — never build it.** Everything below it is the site.

The desktop page is an ordinary scrolling web page, in three layers:

1. **Backdrop** — `--backdrop` is the page background: the birch horizon on Noon; mostly deep aubergine on Dusk, with the violet-and-salmon glow only near the top right, where the arc (inline SVG: a wide blurred haze, a mid stroke and a 2px core line) crosses it. On Dusk, a film-grain overlay (SVG `feTurbulence`, 15%, overlay blend). It scrolls with the page.
2. **Site header** — a sticky 64px glass bar across the full width (`--header` fill, 1px `--header-border` on its bottom edge, `backdrop-filter: blur(16px) saturate(1.15)`). Its contents sit in the same centred 1280px column as the page: the lockup (links home); primary links **Home · Gallery · Bounties · Library**, the current one marked by a small glowing lamp under it and `aria-current="page"`; then search (`NavSearch`), **New build** (the one primary button), Activity (a bell with the unread count from `getUnreadCount()`), the theme control and the avatar.
3. **Content column** — centred, 1280px wide at 1440 (`max-width: 1280px`, 24px side padding below that). The first row is a small **breadcrumb** that mirrors the URL (Home / Gallery / *Invoice triage agent*), derived from the route and the loaded record's title. Below it, the page's panels (`--slab`, 1px `--slab-border`, radius 16px, `--shadow-card`, a 1px top highlight) in the grid shown on each board. The page ends in a **footer**: lockup, About, API docs, Solvers, Connect a tool, Sign in (all existing routes), the Noon · Dusk · System control and © buildgallery.

There is **no floating window and no dock on desktop.** An earlier version framed the site as a floating window with a bottom dock; that read as a desktop application and is gone. The dock survives only on phones (section 5.10), where a bottom bar is a normal web pattern.

Each desktop board shows the first screenful plus the footer. In the browser the page scrolls: panels cut to fit a board (the feed, the gallery wall, long lists) continue down the page with their normal paging.

### 3.3 How to build it without breaking the review rules

The code review treats two things as automatic failures that this layout would trip if done by editing in place: changing structural CSS on an existing layout element, and modifying an externally supplied visual shell. So:

- Build a **new shell component** (suggested `src/components/shell/SiteFrame.tsx`: backdrop, sticky header, content column, breadcrumb, footer — plus the mobile header and dock) beside `FlatShell`, not inside it. `FlatShell` and `flat-shell.css` stay untouched until every route has moved.
- Gate it with the existing `feature_flags` table (a `site_frame` flag), read once in `AppShell`, so routes move one at a time and the old frame is one flag away.
- The left nav (`allNavItems`) becomes the header links. The right rail (`RightRailExplore`) has no place in the new layout; its content moves into page panels (the Home right column is its successor). Retire both only once the flag is fully on.
- `/compose/*` and `/import` are working surfaces: same header and column, but no glass on their own panels (section 5.5). Compose stays `React.lazy` and never enters the initial bundle.

### 3.4 Performance

- The only blurred surfaces are the sticky header (64px tall, not a full-height panel, so the theme skill's rule holds) and, on phones, the header and dock. Panels, cards and chips never blur, and nothing blurred is nested.
- The backdrop is a continuously rendering WebGL canvas (`PageBackdrop.tsx`) that renders at `min(devicePixelRatio, 1.5) × 0.85` of viewport size (× 0.72 above 2.2 megapixels). It pauses on visibility change and stops the animation loop when `prefers-reduced-motion` is set and no ripples are active. The arc and grain are now part of the shader field. The one `feDisplacementMap` in the app is the liquid-glass filter (UI-P09b, `GlassFilter`), mounted once by `SiteFrame` and used only by `.bg-glass`.
- The backdrop is `position: fixed` behind the site frame. It includes interactive ripple effects triggered by pointer events or keyboard activation.

## 4. Shared visual primitives

Each is one component in `src/components/brand/` (or an existing file repainted), built once and used by every page. The canvas's brand boards show each one in both themes.

| Primitive | Exists as | What changes |
|---|---|---|
| **Build card** | `gallery/GalleryCard.tsx`, `CardThread.tsx`, `cardBodies.tsx` | Content order stays fixed: media (shape tag top-left) → title (Sentient) → credit + Δ → plaque → part chips → open ask. Repainted to `--slab` with `--shadow-card`, media radius 10, card radius 14. Adds the picture lamp above. |
| **Picture lamp** | new (`brand/PictureLamp.tsx`) | A 30×8px `--lit` oval above each card, with a soft light wash onto the card top. **State comes from data:** lit when `reproduction_count > 0` and not `isStale()`; dimmed to 45% when `isStale()` (older than `STALE_AFTER_DAYS = 120`); absent when `reproduction_count = 0`. Dusk adds a glow; Noon never glows. |
| **Plaque** | `brand/Plaque.tsx` | Reproduction tag (`--evidence-fill`, "41 reproduced") + lamp dot + `freshnessLabel()` text ("last confirmed working 3 days ago, on sonnet-4.5"). Both always together, never in a footer. |
| **Category chip** | `brand/CategoryChip.tsx` | Unchanged role; mono 10–11px, radius 8, category hue as text on a `--line` border. |
| **Gap** | `brand/GapMarker.tsx`, `build/GapPanel.tsx`, `bounty/MissingBlockOverlay.tsx` | 1.5px dashed `--cat-breakage` border on the normal card; the bounty card adds a dashed "MISSING · part name" window centred on the cover (this is `MissingBlockOverlay` restyled). The gap keeps its true category chip. |
| **Rebuild credit** | `brand/RebuildCredit.tsx`, `build/CreditLine.tsx`, `ForkAttribution.tsx` | "Rebuilt from *name* by @handle" + mono Δ line from `serialiseChangeSet()`. |
| **Orb** | new (`brand/Orb.tsx`), plus `profile-game/LevelRing.tsx` | Three variants: *glass* (horizon inside a sphere, dotted spinner, a live label), *solid* (matte sphere with a mono number), *ring* (conic `--lit` progress around a glass orb — `LevelRing` repainted). Orbs display one number each; never decorative only. |
| **Striped bar** | `progress/LitBar.tsx` | Repeating 60° stripes: filled part in the metric's colour, rest in a neutral stripe. Optional threshold ticks (publish 60, gallery per shape). |
| **Details panel** | new (`brand/WallLabel.tsx`) | Cells joined by 1px hairlines (grid gap 1px on a hairline colour), label in mono 10px caps over a mono value. This is the density borrowed from the rig dashboard. |
| **Segmented control** | `gallery/LensRow.tsx`, theme toggle | 4px padded track, radius 12; active segment filled `--text` with `--bg` text. Never a pill. |
| **Staggered tagline** | new (`brand/Tagline.tsx`) | Three Sentient lines on filled `--text` chips, offset right then back, the middle one carrying the mark. Used on Home and Sign in, desktop and mobile. Decorative text must also exist as real text for screen readers (one `h1`/`p`). |
| **Hero composition** | new (`brand/HeroPlate.tsx`) | Cover image + inverse panel + an overlapping square (mark or "No. 01"). Gallery featured build, Build page header, Profile banner. |
| **Browser frame** | new (`brand/PartViewer.tsx`) | Traffic dots, a raised tab with the part's category chip and name, then content. Wraps the part viewer on the Build page. |
| **Timeline** | `build/eventDisplay.tsx`, `Replay.tsx` | Vertical rail; one dot per kept event, coloured by `EventKind`: prompt = instruction hue, milestone = `--evidence`, breakage = `--cat-breakage`, note = `--text2`, deploy = `--lit`. |
| **Rank rungs** | `trophies/badge-tile.tsx`, `creator-mark-tile.tsx` | Common = outline, rare = `--recess` fill, highest = `--lit` fill. Never a rainbow. |

Type: Sentient (display, uploaded `.otf`, 500 and 700) for every heading 20px and up, Figtree for UI and body, DM Mono for data, labels, counts and Δ lines. Radius scale unchanged: chip 8, control 12, media 10, card 14, panel 16, full only for orbs, avatars and dots.

---

## 5. Page by page

Every page below is drawn at 1440×1000 in both themes. Each entry lists the route, the page file, the existing functions and components that already provide the data, what the mockup adds, and gaps where the data does not exist yet.

### 5.1 Home — `/` (`pages/Home.tsx`, `feed/FeedShell.tsx`, `BuildsTab.tsx`, `BuildFeedItems.tsx`)

- **Hero slab** (left, 300px): a cover image fills the slab; Following / Everyone segmented control (existing feed scope); the staggered tagline; "Enter the gallery" (primary) and "How proof works" (secondary); a lamp badge "N builds lit today".
  - *Gap:* "lit today" needs a count of builds with `last_confirmed_at` in the last 24h — add `countLitToday()` in `src/lib/build/signals.ts`, estimated count.
- **Visitors' book** (left, fills): `getBuildFeed()` items, kinds `build | rebuild | repro_note | bounty`, keyset paging, `FEED_PAGE_SIZE = 20`. Each row: kind label (mono, hue per kind), avatar, a one-line "who did what", the build title in Sentient, the plaque, a cover thumbnail, relative time. One row may be highlighted (the most recent unseen). Filter segments (All, Builds, Rebuilds, Notes, Asks) filter client-side on `kind`.
- **Orbs** (right): glass orb "Reproduced today · N runs" (count of `build_reproductions` created since 00:00 UTC — new `countReproducedToday()`) and solid orb "This week · N runs reported" (created since `weekStartUtc`). Nothing records a run in progress, so the mockups no longer claim "now".
- **This week's challenges**: exactly `WEEKLY_CHALLENGES` from `src/lib/progress/weekly.ts` — "Run three builds you haven't run before", "Solve a gap", "Re-confirm one of your stale builds" — progress from `getMyWeekEvents()` + `weeklyProgress()`, resets Monday 00:00 UTC (`weekStartUtc`). `progress/ThisWeek.tsx` is the existing component.
- **Streak**: `getStreakDays()` rows are `active | frozen`; frozen days render as an outlined lamp in `--evidence`. `streaks/streak-flame.tsx`, `freeze-indicator.tsx`.
- **Where next**: `getWhereNext()` exists but is per build (rebuilds, shared tool, more from maker). The Home version needs a variant keyed on the viewer's recent reproductions — new function `getWhereNextForViewer()` in `src/lib/build/whereNext.ts`.

### 5.2 Gallery — `/gallery` (`pages/Gallery.tsx`, `gallery/LensRow.tsx`, `FacetRail.tsx`, `GalleryCard.tsx`)

- **Header slab**: eyebrow, "Builds worth running" (Sentient), the existing intro sentence, and the lens control with counts: `GALLERY_LENSES = all | proven | rebuilt | unsolved`. Order note in mono: most reproduced first, then most recently confirmed.
  - *Gap:* per-lens counts. Add `countGalleryLenses()` in `gallery.ts` (estimated counts).
- **Stats row** (a details panel): In the gallery · Reproduced this week (striped bar) · Fresh under 120 days (%) · Open bounties (£ and count; `countOpenBountyBuilds()` exists, the £ sum does not).
  - The mock's "400 goal" is invented. Either make the goal a config value or drop the bar and show the number.
- **Facet column** (230px): Made for (`getGalleryFacets().roles`), Made with (`.tools`), each with a count and a mini bar.
  - *Gap:* Shape is not in `GalleryFacets`. Add `shapes` to `getGalleryFacets()`; shapes are `app, agent, workflow, prompt, dataset, study, media, technique, other`.
- **Featured build** (spans two columns): hero composition — cover, inverse panel with "Most reproduced this month", title, one-line outcome, plaque, and the overlapping "No. 01" square. *Gap:* a "most reproduced in the last 30 days" query.
- **The wall**: four columns of cards with picture lamps. `GALLERY_PAGE_SIZE = 24`; keep its paging. Only builds where `inGallery()` is true appear (completeness ≥ `galleryThreshold(shape)`).

### 5.3 Build page — `/b2/:slug` (`pages/BuildPage.tsx`, `build/BuildHeader.tsx`, `BuildTabs.tsx`, `AnatomyTree.tsx`, `NodeCard.tsx`, `LayerView.tsx`, `RunView.tsx`, `BreakageView.tsx`, `Replay.tsx`, `ReproductionAction.tsx`, `PortableExport.tsx`, `ForkControl.tsx`, `CreatedViaLine.tsx`, `WhereNext.tsx`, `RebuildsTab.tsx`)

- **Hero** (left, 402px tall, first row of the column): the build's cover (`resolveCover()` — `cover_media_id` or hero node) fills the slab, the arc crosses it, a shape tag plus "via connector" when `getCreatedVia()` says so (`CreatedViaLine`). A frosted title plate along the bottom: title (Sentient 44), outcome, rebuild credit and Δ. The overlapping mark square sits on the plate's left.
- **Action dock** (top-right of the hero): Copy for AI (`toPortable()` → `toMarkdown()`, clipboard), Download (portable file), Rebuild (`startRebuild()` → `/rebuild/:slug`), Lineage (`/b2/:slug/lineage`). These are `PortableExport` and `ForkControl` restyled as dock tiles.
- **Proof slab** (right, 420px):
  - Glass orb with the reproduction count and last date; plaque with `freshnessLabel()`.
  - **Primary action "I ran this and it worked"** → `recordReproduction()` (`ReproductionAction`). The build's creator cannot reproduce their own build (the insert policy refuses it); for the creator this button becomes "Re-confirm it still works" → `recordSelfConfirmation()`.
  - Details panel: Made for, Made with, Setup and Monthly cost (`PortableCost.setup` / `.monthly` / `.currency`), First result (`time_to_first_result`), Needs (the prerequisite node).
  - Completeness: `computeCompleteness()` score out of 100, a striped bar with two ticks — publish at `MINIMUM_PUBLISHABLE_SCORE = 60` and gallery at `galleryThreshold(shape)` (the mock shows 80; it varies by shape) — and the first `missing[]` item's `copy` as the next step. Show this block only to the creator.
- **Anatomy** (left column, 300px): numbered parts (Sentient 01, 02…), a category dot, the part title, a mono meta value. The gap part has the dashed breakage edge and its reward. Built from the node tree (`getBuildRecord` / nodes); gaps from `collectGaps()`.
  - Note on categories: `NodeCategory` in code is six values — `instruction, configuration, data, artefact, evidence, narrative`. The theme's `agents`, `media` and `breakage` hues are not node categories. Use the node type's category for the dot; use `breakage` only for gaps. (The v3 mockups follow this.)
- **Part viewer** (centre): the browser frame. Its tab shows the selected part's chip and name. Under it, the page's tabs — the live site shows **Anatomy · Watch it get built · Run it yourself · Where it broke · Result**; the repo map lists `anatomy watch run understand broke rebuilds`. Read `BuildTabs.tsx` for the current set before prompting, and keep its keys. Inside: the Run / Understand switch (`LAYERS`, `LAYER_BLURB`: "Do this, then this. No understanding required." / "What each step does, and why, in plain language."), a Copy button, then the content (`LayerView` / `NodeCard` / `GenericPayload`).
- **Watch it get built** (right, 280px): the kept `build_events` as a timeline (section 4), with a Play button opening `Replay`.

### 5.4 Rebuild and lineage — `/rebuild/:slug` (`pages/RebuildRoute.tsx`), `/b2/:slug/lineage` (`pages/Lineage.tsx`, `build/RebuildTree.tsx`)

- **Family tree** (left): `getRebuildTree()` / `getBuildFamily()` (caps: depth 20, 200 rows). Each node is a mini card (cover, title, maker, reproduction count) with its own picture lamp. The viewer's draft is outlined in dashed `--action`. Curved connectors, drawn as one SVG behind the nodes.
- **What changed** (right, top): `changeSet()` → `serialiseChangeSet()` lines, grouped by `header`, each `added` (+, configuration green), `changed` (~, lamp gold as a glyph only), `removed` (−, breakage red). The list is computed, not editable — say so in the panel subtitle.
- **Readiness** (right, bottom): an orb ring showing `rebuildReadiness()`, the one thing still missing, the credit the rebuild will carry (built by `RebuildCredit`, structural, not removable), and "Publish rebuild" → `publishRebuild()`.

### 5.5 Import and compose — `/import` (`pages/ImportPage.tsx`), `/compose/new` (`ComposeNew.tsx`), `/compose/:buildId` (`Compose.tsx`)

This is a working surface: **flat panels, no glass** (`--recess` and hairlines only), per the theme rule. The site header and footer still frame it.

- **Transcript** (left): the source conversation turns, the viewer's on the right in `--recess`. Any `SecretFinding` is highlighted inline in breakage red.
- **What we found** (centre): `loadImportProposal()` → `TranscriptProposal`: `ProposedNode`s as checkable rows with category chips, `ProposedEvent`s as checkable rows with their kind label. "Keep everything" → `keepEverything()`. A dashed breakage banner when secrets were found ("A live API key was found in turn 22 — removed from every part"). Components: `IntakeProposal`, `WaitingImports`, `ImportDestination`, `IntakeProgress`.
- **How it will hang** (right): a live card preview (lamp off — nothing reproduced yet) and the completeness panel (`CompletenessPanel`) with the 60 / gallery ticks and the `MissingItem.copy` checklist. "Create the draft" → `materialiseProposal()` / `claimImport()`.
- Everything here stays `React.lazy` and outside any legacy centre column.

### 5.6 Bounties — `/bounties` (`pages/Bounties.tsx`), solve (`pages/BountySolvePage.tsx` — confirm its route in `App.tsx`), `/bounties/solvers` (`pages/Solvers.tsx`)

- **Header**: "Open asks on real builds" (Sentient), the sentence "The build works. One part is left open on purpose, with a reward for whoever solves it.", sort (Newest, Reward, Closing soon) and the Bounties / Solvers switch.
- **Vacant frames** (three columns): `listOpenBountyCards()`. Each card: dimmed lamp, dashed breakage border, cover with the "MISSING · part" window (`MissingBlockOverlay`), build title, reward (`reward_gbp`, mono), true category chip, closes-in, solutions count (`countSolutionsByBounty()`), me-too count. Made-with filter from `bountyFacetsMadeWith()`.
- **Solve panel** (right, 420px; `bounty/SolvePanel.tsx`): the problem (`gapProblem()`), reward, deadline (and "extended once" from `bounty_deadline_extensions` / `extendDeadline()`), Me too (`toggleMeToo()` / `myMeToo()`), "Submit a solution" → `submitSolution()`, the solutions list from `listSolutions()` with Accept for the bounty's author (`AcceptSolutionDialog`, `acceptSolution()`), and a stepped chart of solutions over time (from solution `created_at`; hand-drawn SVG, or a lazily imported chart library).
- **Top solvers**: `listTopSolvers()` (limit 25), rank rungs lit / filled / outlined.

### 5.7 Profile — `/profile/:handle` (`pages/Profile.tsx`, `profile/ProfileHeader.tsx`, `MakerFigures.tsx`, `profile-game/ProfileLevelHeader.tsx`, `LevelRing.tsx`, `ProfileStatsBar.tsx`, `trophies/*`, `streaks/streak-calendar.tsx`)

- **Banner**: a hero composition — cover image, the arc, the avatar in an overlapping square, eyebrow (Maker · place · since), name in Sentient 52, bio, Follow (primary) and Message.
- **Level orb** (right): the ring orb from `getUserProgress()` (`xpProgressInLevel()`, `levelFromXp()`), the track switch — `TrackId = architect | curator | mentor | explorer` (`setUserTrack()`, `respecTrack()`) — xp to next level, streak.
- **Stats row**: builds hung (`listBuildsByCreator()` count), reproduced by others, rebuilds of their work, bounties solved and earned. *Gap:* a single `getMakerFigures()` that returns these four; parts exist in `MakerFigures` / `EarnedNumbers`.
- **Works**: tabs Builds · Rebuilds · Reproduced · Collections (library `getCollections()`), four-column cards with lamps.
- **Activity grid**: 60 days from `getStreakDays(userId, 60)`, lamp gold by intensity; frozen days outlined in `--evidence`.
- **Creator marks**: `getCreatorMarks()` and badges, rungs by weight and fill.
- Note: the repo map records that `award_xp()` lets a signed-in user award themselves any amount of XP. That is a security fix to schedule separately; the UI must not add any client path that calls it.

### 5.8 Activity — `/notifications` (`pages/Notifications.tsx`, `notifications/NotificationRow.tsx`, `NotificationCard.tsx`)

- **List** (left): grouped Today / Yesterday / earlier; each row: unread lamp dot, actor avatar with a kind badge, "who did what" with the build title in Sentient, a mono detail, a cover thumbnail, time. Data: `getNotifications()`, `markRead()`, `getUnreadCount()`, realtime via `lib/notifications/realtime.ts`. Kinds: `BUILD_NOTIFICATION_KINDS` = rebuilt, published, reproduced, comment, reply, like, solution, solved, follow.
- **Right column**: two orbs (people who ran your builds this week; a "listening" live indicator tied to the realtime channel), a line chart of runs of your builds over 90 days with a dashed marker where a rebuild went live, and a filter list of kinds with counts. *Gap:* a `getRunsOfMyBuilds(days)` series function.
- Reached from the header's Activity bell on desktop and the dock's Activity tile on phones, both with the unread badge.

### 5.9 Sign in / Join — `/login` (`pages/Login.tsx`), `/signup` (`Signup.tsx`), `/reset-password`, `/verify-email`

- No header or column: the backdrop fills the page with the glowing-edge treatment from the brand lockup tile. Left: the large lockup, the staggered tagline, two orbs. Right: a frosted card — Back, Sign in / Join switch, Continue with Google, GitHub, X (existing OAuth), an "or with email" divider, Email or username, Password, Keep me signed in, Forgot password (→ `/reset-password`), Sign in (primary). Theme control under the card: Noon · Dusk · System.
- Keep every existing field name, handler and redirect (`?redirect=`) exactly; this is a repaint of the form, not a rewrite of auth. Identity only through `useAuth()`.

### 5.10 Mobile web — 390 wide, in the phone's browser

Twenty boards (ten screens × Noon and Dusk). Long boards show the whole scrolling page; the header and dock are sticky.

**The mobile frame.** On a phone, panels sit straight on `--backdrop`, 14px from the edges. A sticky 58px glass header holds the lockup (home link), a search button and the avatar (or Sign in). The dock floats 16px above the bottom: five 62×54 tiles — Home, Gallery, New (always `--action`), Bounties, Activity (unread badge). Build it for the browser, not for a device:

- Use `100dvh`, not `100vh`, so the browser's own toolbars do not push the dock off-screen.
- Pad the dock with `env(safe-area-inset-bottom)` and add `viewport-fit=cover` to the viewport meta so it clears the home indicator.
- Page content ends with bottom padding equal to the dock's height plus its gap (≈110px), so the last item is never hidden behind it.
- Horizontal chip rows (lenses, tabs, filters, tracks) scroll sideways with the scrollbar hidden and 14px of bleed past the edge, so a half-visible chip signals there is more.
- Inputs are 16px or larger so iOS Safari does not zoom on focus. Touch targets are 44px or more.
- This replaces `MobileTopBar` (becomes the header) and `MobileBottomNav` (becomes the dock). `ProfileDrawer` and `RightRailDrawer` are retired; their content moves into pages.

**Screens** (same data as the desktop sections above; only the layout changes):

- **Home** — Following / Everyone and the "lit today" badge; the hero slab with the tagline at 30px and one primary action; two orbs (Reproduced today, This week); challenges; the visitors' book with a sideways filter row; the streak.
- **Gallery** — heading and intro; lens chips with counts in a sideways row; a full-width search plus a **Filters** button that opens the facets (Made for, Made with, Shape) as a bottom sheet; a 2×2 stats panel; the featured build stacked (cover, then inverse panel, "No. 01" square overlapping both); a two-column wall.
- **Build page** — the cover with its frosted title plate (title 32px, outcome, credit, Δ); the four action tiles as a row under the hero (Copy for AI, Download, Rebuild, Lineage); the proof slab with the orb, a full-width **I ran this and it worked**, and a two-column details panel; the page tabs as a sideways row; the anatomy list (first six parts, then "Show more"); the part viewer; the timeline.
- **Rebuild + lineage** — readiness ring, the carried credit and a full-width Publish rebuild first (the decision), then what changed, then the family as an indented list with lamps (a tree does not fit 390px).
- **Import** — flat, no glass. Step chips; the secret-found banner; parts and events as checklists with 20px checkboxes and 48px rows; completeness; a sticky action bar above the dock with Discard and **Create the draft**.
- **Bounties** — heading; Bounties / Solvers and sort; the two orbs; vacant frames one per row; top solvers.
- **Solve sheet** — solving is a bottom sheet over the dimmed bounty list: grabber, the dashed problem card, a three-cell details panel (reward, closes, me too), Submit a solution and Me too as full-width buttons, then the solutions. Use a real dialog with focus trapped and Escape / swipe-down to close.
- **Profile** — banner with the arc, avatar square overlapping, name at 30px; Follow and Message side by side; the level ring with the track chips; 2×2 stats; tabs; a two-column works grid; the activity grid.
- **Activity** — kind filters as chips with counts; Today / Yesterday groups; each row has the actor, a kind badge, the build title in Sentient and an unread lamp.
- **Sign in** — no header or dock; lockup, tagline, then the form card (48px controls, 16px inputs), then Noon · Dusk · System.

---

## 6. Behaviour, states and accessibility

- **Motion**: scroll entry only on the gallery wall and build-page sections (450ms opacity + 14px translate, once). UI feedback ≤200ms, transform and opacity only. The lamp and arc never animate. Everything off under `prefers-reduced-motion`.
- **States for every slab**: loading (skeleton in `--recess`, same size as the content), empty (one Sentient line and one action — e.g. "Nobody has solved a bounty yet." + "See open bounties", which is the live site's current copy), error (one sentence, a retry), populated. The mockups show populated only.
- **Minimum sizes in code**: the mockups use 9–10px mono in a few labels at 1440 scale. In code, nothing under 11px; body text 16–17px; mono labels 11–12px. Touch targets ≥44px (dock tiles are 68×60).
- **Focus**: the new ring from 2.4. Every header link, dock tile, tab and segment is a real `<a>` or `<button>` with an accessible name; the tagline's chips are presentation, with the sentence in real text.
- **Responsive**: check 390, 768, 1280 and 1440. At 768 the app swaps chrome components (phone frame); at 1280 the right column narrows before it drops.
- **Tests**: add `data-testid`s to new frame parts (`site-frame`, `site-header`, `breadcrumb`, `site-footer`, and on phones `dock`, `dock-tile-<name>`); keep every `e2e/tier1` spec green; the theme guards (`compliance`, `contrast`, `glass`, `radius`, `ns-classes`) must pass with Noon values.

---

## 7. What is new versus what exists

- **Exists and is only repainted**: GalleryCard / CardThread, Plaque, CategoryChip, GapMarker, RebuildCredit, LensRow, FacetRail, BuildHeader, BuildTabs, AnatomyTree, NodeCard, LayerView, Replay, ReproductionAction, PortableExport, ForkControl, RebuildTree, SolvePanel, MissingBlockOverlay, AcceptSolutionDialog, NotificationRow, LevelRing, LitBar, streak components, Login / Signup forms.
- **New components**: SiteFrame (backdrop, sticky site header, content column, breadcrumb, footer; mobile header and dock), PictureLamp, Orb, WallLabel, Tagline, HeroPlate, PartViewer, timeline rail, rank rungs.
- **New data functions** (each in its own commit, in `src/lib/…`, typed, limited, estimated counts where possible): `countLitToday`, `countGalleryLenses`, a shapes facet in `getGalleryFacets`, `mostReproducedThisMonth`, open-bounty £ sum, `getWhereNextForViewer`, `getMakerFigures`, `getRunsOfMyBuilds`.
- **No new state for the header**: the breadcrumb is derived from the route and the loaded record's title.

---

## 8. Sample data in the mockups (do not hard-code)

All names, handles, titles, counts, prices, dates and quotes are illustrative: Invoice triage agent, @maya, "41 reproduced", "1,284", "702 builds lit today", "312 runs", "400 goal", "£4,250", "£150", "86 / 100", "Level 7 · 1,840 / 2,400 xp", "12-day streak", "7 runs in progress", the transcript text and the API-key example. Every one of them is replaced by real data or by an empty state.

---

## 9. The prompt series

This handoff is no longer the plan — it is the reference behind one. The plan is `design/prompts/`: **42 prompts, `UI-P00` to `UI-P41`**, one per Claude Code session, listed in order in `design/prompts/00-INDEX.md` and gathered in `ALL-PROMPTS.md`. `design/RULES.md` carries the standing rules they all assume; `design/README.md` says how to run them and how to check a change.

The waves, in short:

- **Wave 0 (UI-P00–P05)** — the kit in the repository, the compare harness and its dev pages, Exhibition → Noon, the token values, the focus ring, Sentient.
- **Wave 1 (UI-P06–P15)** — the primitives, one prompt each, all shown in a component catalogue that is compared against `reference/components/`: identity, controls, the lamp and plaque, panels and wall labels, orbs, tagline and compositions, charts and timeline, the backdrop, the build card, the vacant frame.
- **Wave 2 (UI-P16–P20)** — `SiteFrame` beside `FlatShell` behind the `site_frame` flag: the skeleton, the site header, breadcrumb and footer, the mobile header, dock and sheets, then `/notifications` moved across to prove it.
- **Wave 3 (UI-P21–P26)** — the data functions section 7 lists as new, one commit each.
- **Wave 4 (UI-P27–P36)** — one prompt per page, desktop and mobile together, each as a pure view plus a thin container, compared against its four boards.
- **Wave 5 (UI-P37–P41)** — loading, empty and error states; the accessibility pass; the widths between the boards; the performance pass; and finally retiring `FlatShell`, the right rail, the flag and the dead tokens.

Where a prompt names a function, component or column that does not exist or has been renamed, the file on disk wins — `RULES.md` §8 says what to do, and it is never "invent a table".
