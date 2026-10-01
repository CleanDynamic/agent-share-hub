# UI-P28 — Page: Gallery

Follow `design/RULES.md` (§7).

**Goal.** `/gallery` as the reference: header with lenses and the stats wall label, the facet column, the featured build and the wall of cards.

**Read first.** `pages/Gallery.tsx`, `components/gallery/*` (verified: `GalleryCard`, `CardThread`, `FacetRail`, `cardMedia`; the lens row may be named differently — §8), `lib/build/gallery.ts` (`listGallery`, `getGalleryFacets`, `inGallery`, `GALLERY_BUILD_COLUMNS`, and the real lens list, page size and threshold helper), UI-P22, UI-P23 and UI-P24 functions, HANDOFF §5.2.

**Reference.** `desktop/{noon,dusk}/gallery.html`, `mobile/{noon,dusk}/gallery.html`.

**Data → props.** Wall pages from the existing gallery query with the current lens and facets (keep its URL parameters exactly); `countGalleryLenses()`; `getGalleryStats()`; `getOpenBountyPool()`; `getGalleryFacets()` (roles, tools, shapes); `getFeaturedBuild()`.

**Desktop.** A column, gap 12: the header panel (natural height), then a grid `230px minmax(0, 1fr)` that fills.
- **Header** `Panel` padding 18px 20px:
  - a row, `space-between`, `align-items: flex-end`, gap 20: left, a column with gap 8: `Eyebrow` "Gallery"; `h1` `type.display(50)`, −0.035em, line-height 1, "Builds worth running"; the intro, Figtree 13px `--text2`, line-height 1.5, max-width 560: "Written down completely enough to follow, ordered by how many people other than their maker have run them and said what happened." Right, a column with gap 10, aligned right: `Segmented` 36/12 with **All · Proven · Rebuilt · Unsolved**, each label followed by an en space and its count (`en-GB` grouping); under it "MOST REPRODUCED FIRST, THEN MOST RECENTLY CONFIRMED" in DM Mono 11px `--label`.
  - 14px below, `WallLabel` with 4 columns of `Stat`: "In the gallery" {inGallery}; "Reproduced this week" {reproducedThisWeek} — with "/ {weeklyGoal}" and a `--lit` bar at value/goal when a goal is set, otherwise a `--lit` bar at this week / last week (cap 100); "Fresh · under 120 days" "{freshPct}%" with an `--evidence` bar; "Open bounties" "£{poolGbp}" / "{open} asks" with an `--action` bar at withSolutions/open.
- **Facet column** `Panel` padding 4px 16px, full height. Three groups — **Made for** (top 4 roles), **Made with** (top 4 tools), **Shape** (top 6 shapes) — each a column, gap 6, padding 10px 0, 1px bottom `--hairline`: `Eyebrow` 10px; rows 23px tall, flex, gap 8: the name (Figtree 12px `--text`, grows), a mini bar 44×4 (radius 2, `--bar-base`, filled in `--label` at count/max of the group), the count (DM Mono 10px `--label`, 30px wide, right). Each row is a toggle button (`aria-pressed`) that applies the same filter `FacetRail` applies today; an applied row's name is weight 600.
- **The wall** — grid `repeat(4, minmax(0, 1fr))`, gap 14, `padding: 0 4px`. In `board` fit, two rows of 250px: the featured build spans 2 columns (`HeroPlate featured` with `PictureLamp`, rank "01", its plaque via `tone="inverse"`), then six build cards (cover 92, title 19). In `content` fit rows are auto (≥250), the featured slot appears only on the first page and only when `getFeaturedBuild()` returns a build; the wall keeps the existing paging (24 per page) with a secondary "Show more" at the end.

**Mobile** (390×1860), gap 12:
1. Page heading: `Eyebrow` "Gallery", `h1` `type.display(36)` −0.035em "Builds worth running", Figtree 14px `--text2` line-height 1.5: "Written down completely enough to follow, ordered by how many people other than their maker have run them." (column gap 8, padding 4px 2px).
2. `ScrollRow` (gap 6) of `FilterChip`s for the four lenses with counts.
3. A row, gap 8: a search field (grows; height 44, padding 0 12px, radius 12, `--field`, 1px `--line`, `Search` 16, input **16px** — the reference's 15px is raised to the iOS minimum) that filters as the existing gallery search does; `Button` secondary 44/13 with `SlidersHorizontal`, "Filters · {n applied}" ("Filters" when none), opening a `BottomSheet` titled "Filters" with the three facet groups (rows 44px tall) and a primary "Show {n} builds".
4. `WallLabel` 2 columns: In the gallery · This week (`--lit` bar) · Fresh (`--evidence` bar) · Open asks "£{pool}" (`--action` bar).
5. Featured build, stacked: `PictureLamp`; a block radius 16, `overflow: hidden`, `--shadow-card`, 1px `--glass-border`: the cover 190 tall with the tag "MOST REPRODUCED THIS MONTH" (top 10, left 10, `--media-tag`, DM Mono 10px, padding 3px 8px, radius 8); the inverse panel (`--inverse`, padding 18px 18px 18px 104px, min-height 120, column gap 8): title `type.display(26)`, outcome Figtree 13px `--on-inverse-2`, the inverse plaque. The rank square overlaps both at left 14, top 160: 78×78, radius 14, `--inverse`, 2px border `--on-inverse`, `--shadow-square`; "NO." DM Mono 10px over "01" `type.display(36)`.
6. "MOST REPRODUCED FIRST, THEN MOST RECENTLY CONFIRMED" (DM Mono 11px `--label`, padding 0 2px).
7. The wall: grid 2 columns, gap 6px 10px, cards with cover 96 and title 18.

**Empty states.** A lens with no builds: "Nothing here yet." + a secondary "See all builds". No featured build: the wall starts at the first card.

**Done when.** The four Gallery boards compare within 0.04; filters, lenses and paging behave exactly as before (existing gallery tests and tier1 specs pass).

**Commit.** `UI-P28: Gallery in the site frame`
