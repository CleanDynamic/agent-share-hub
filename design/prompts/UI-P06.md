# UI-P06 — Identity: mark, lockup and the cover fallback

Follow `design/RULES.md`.

**Goal.** Three identity primitives in `src/components/brand/`, shown in the **Identity** section of `/dev/kit/components`.

**Reference.** `design/reference/components/{noon,dusk}.html` → section `Identity`; `data-ui="mark"`, `data-ui="lockup"`, `data-ui="cover-fallback"`. Six skies: `design/tokens/tokens.json → _notes.coverFallbackSkies`.

**Build.**
1. **`Mark`** (`size`, optional `halo`). An inline SVG, `viewBox="0 0 40 40"`, `aria-hidden`, body in `currentColor`:
   - lamp: `<ellipse cx="20" cy="4.8" rx="5.5" ry="3.4">` filled `--lit` (the tagline passes `--tagline-lamp` instead);
   - frame: `<rect x="5.5" y="11.5" width="29" height="26" rx="5">`, no fill, stroke `currentColor`, stroke-width 3;
   - work: `<rect x="12" y="18" width="16" height="13" rx="2.5">` filled `currentColor`;
   - halo (Dusk only, when `halo`): `<ellipse cx="20" cy="9" rx="10" ry="4">` filled `--lit` at opacity .22, drawn first.
2. **`Lockup`** (`size`, optional `color`). A row: `Mark` at `Math.trunc(size * 1.1)`px (with halo on Dusk), gap `Math.trunc(size * 0.38)`px, then the word **buildgallery** (lower case) in `type.display(size)` — Sentient 500, letter-spacing −0.03em, line-height 1. Sizes used: 16 (footer), 19 (mobile header), 21 (site header), 34 (mobile sign-in), 64 and 70 (desktop sign-in). When it is a link home, the link's accessible name is "buildgallery home".
3. **`CoverFallback`** (`seed: string`, `radius`). The landscape drawn when a build has no cover (`resolveCover()` returns nothing). SVG `viewBox="0 0 300 180"`, `preserveAspectRatio="xMidYMid slice"`, filling its box:
   - sky: a vertical linear gradient with the palette's colours 0, 1 and 2 at offsets 0, .55 and 1;
   - sun: `<ellipse cx={[70,120,190,230,150,210][i]} cy="112" rx="24" ry="24">` in colour 3 at opacity .9;
   - hills, three paths, filled with colours 4, 5 and 6, exactly:
     `M0 118 C40 98 70 108 100 94 C130 80 160 102 200 96 C240 90 270 106 300 98 L300 180 L0 180Z`
     `M0 140 C50 126 90 138 140 128 C190 118 230 138 300 126 L300 180 L0 180Z`
     `M0 162 C60 152 120 164 180 156 C230 150 270 160 300 154 L300 180 L0 180Z`
   - the palette index `i` is a stable hash of `seed` (the build id) modulo 6. The dev fixtures pass `cover_sky` to force the mockup's choice. Gradient ids must be unique per instance (`useId`).
   The skies are artwork: the same in both themes, not tokens.

**Done when.** The Identity section of `/dev/kit/components` compares within 0.04 in both themes.

**Commit.** `UI-P06: mark, lockup and cover fallback`
