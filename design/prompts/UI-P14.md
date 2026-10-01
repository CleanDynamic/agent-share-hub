# UI-P14 — The build card

Follow `design/RULES.md`.

**Goal.** Repaint the build card so every card in the product is the reference card. It is shared by the gallery, the feed, profiles and rows, so it changes once.

**Read first.** `components/gallery/GalleryCard.tsx`, `CardThread.tsx`, `cardBodies.tsx`, `cardMedia`, the `GalleryBuild` type and `GALLERY_BUILD_COLUMNS` in `lib/build/gallery.ts`, the card-frame / card-thread comment in `lib/theme/semantics.ts`.

**Reference.** Section `Build cards`; `data-ui="build-card"` on every board that shows cards.

**Build.**
1. **Order is fixed**: `PictureLamp` → the card: cover (with the shape tag) → title → credit and Δ → plaque → part chips → open ask. Keep it impossible to render the plaque without the title above it.
2. **Card**: position relative; background `--glass`; 1px border `--glass-border`; radius 14; padding 7px; column with gap 7px; `box-shadow: var(--shadow-card)`. The whole card is one link to `/b2/:slug` whose accessible name is the title.
3. **Cover**: height per context (112 catalogue, 92 gallery wall, 86 profile works, 96 mobile two-column, 120–150 single column), radius 10, `overflow: hidden`. The build's cover from `resolveCover()` with `object-fit: cover`, else `CoverFallback` seeded with the build id. The shape tag at top 6px, left 6px: background `--media-tag`, text `--text`, DM Mono 10px, padding 2px 6px, radius 8.
4. **Body**: padding 0 5px 5px, column, gap 6px:
   - title: `h3`, `type.display(19)` (18 or 17 on mobile two-column), `--text`, one line with ellipsis;
   - credit block, gap 2px: "by {maker}" or "Rebuilt from *{source}* by {maker}" (the source title in italic `--text`) in Figtree 11px `--text2`, ellipsis; when rebuilt, "Δ {change summary}" in DM Mono 10px `--text2`, ellipsis;
   - `Plaque size="card"`;
   - part chips: `CategoryChip`s for the node categories present, gap 4px, wrapping. Categories come from the node types (`instruction, configuration, data, artefact, evidence, narrative`). `breakage` is never a chip; a gap keeps its own category;
   - open ask, when the build has an open bounty: "{n} part unsolved · £{reward}" in DM Mono 10px `--cat-breakage`.
5. **Gap**: when the build has an open gap, the border becomes `1.5px dashed var(--cat-breakage)`. Nothing else changes colour.
6. The card is now one surface. Update the card-frame / card-thread comment in `semantics.ts` to say so; keep the two tokens (UI-P41 removes them).

**Do not.** Change `GalleryCard`'s props or data dependencies. Change any grid that places cards (each page does that in its own prompt).

**Done when.** Build cards section compares within 0.04 (fresh, rebuilt, stale, never reproduced, gap), and the live `/gallery` renders the new card with real data in both themes.

**Commit.** `UI-P14: build card repaint`
